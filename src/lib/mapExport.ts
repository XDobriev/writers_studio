import type { Book } from './supabase';
import { TYPE_GLYPHS, type Location } from './locations';
import type { LocationConnection } from './connections';
import { getMapTemplate, renderTemplateBgSvg } from './mapTemplates';

const CW = 1600;
const CH = 900;

// Concrete colors for SVG export (no CSS custom properties)
const CONN_STROKES: Record<string, { stroke: string; width: number; dash: string }> = {
  road:   { stroke: '#c49a3c', width: 2,   dash: '6 4' },
  river:  { stroke: '#4aa3b8', width: 2.5, dash: '' },
  path:   { stroke: '#888880', width: 1.5, dash: '4 5' },
  border: { stroke: '#9a9a8a', width: 2,   dash: '8 3' },
};

function escXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('FileReader error'));
    r.readAsDataURL(blob);
  });
}

function buildSvgString(
  book: Book,
  locations: Location[],
  connections: LocationConnection[],
  bgDataUrl: string | null,
): string {
  const template = getMapTemplate(book.map_template);
  const isLight = template === 'paper' && !bgDataUrl;

  const bg = bgDataUrl
    ? `<image href="${bgDataUrl}" x="0" y="0" width="${CW}" height="${CH}" preserveAspectRatio="xMidYMid slice" opacity="0.9"/>`
    : renderTemplateBgSvg(template);

  const pinStroke = isLight ? '#8a7060' : 'rgba(255,255,255,0.25)';
  const pinFill   = isLight ? 'rgba(200,180,150,0.9)' : 'rgba(30,25,20,0.85)';
  const glyphClr  = isLight ? '#4a3420' : '#e0d5c0';
  const nameClr   = isLight ? '#3a2810' : '#d0c5b0';

  const connsSvg = connections.map(c => {
    const from = locations.find(l => l.id === c.from_id);
    const to   = locations.find(l => l.id === c.to_id);
    if (!from || !to || from.x == null || from.y == null || to.x == null || to.y == null) return '';
    const cs = CONN_STROKES[c.style] ?? CONN_STROKES.path;
    const dashAttr = cs.dash ? ` stroke-dasharray="${cs.dash}"` : '';
    const mx = ((from.x + to.x) / 2) * CW;
    const my = ((from.y + to.y) / 2) * CH - 8;
    const label = c.label
      ? `<text x="${mx}" y="${my}" text-anchor="middle" font-size="11" fill="${nameClr}" font-family="Georgia,serif" opacity="0.7">${escXml(c.label)}</text>`
      : '';
    return `<line x1="${from.x * CW}" y1="${from.y * CH}" x2="${to.x * CW}" y2="${to.y * CH}" stroke="${cs.stroke}" stroke-width="${cs.width}"${dashAttr} opacity="0.65"/>
${label}`;
  }).join('\n');

  const pinsSvg = locations
    .filter(l => l.x != null && l.y != null)
    .map(l => {
      const name = l.name.length > 18 ? l.name.slice(0, 17) + '…' : l.name;
      return `<g transform="translate(${l.x! * CW},${l.y! * CH})">
  <circle r="16" fill="${pinFill}" stroke="${pinStroke}" stroke-width="1.5"/>
  <text text-anchor="middle" dominant-baseline="central" font-size="13" fill="${glyphClr}" font-family="Georgia,serif">${TYPE_GLYPHS[l.type]}</text>
  <text y="28" text-anchor="middle" font-size="9.5" fill="${nameClr}" font-family="Georgia,serif" font-weight="500">${escXml(name)}</text>
</g>`;
    }).join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${CW}" height="${CH}" viewBox="0 0 ${CW} ${CH}">
${bg}
${connsSvg}
${pinsSvg}
</svg>`;
}

export async function generateMapPngBuffer(
  book: Book,
  locations: Location[],
  connections: LocationConnection[],
): Promise<ArrayBuffer> {
  let bgDataUrl: string | null = null;
  if (book.map_bg_url) {
    try {
      const resp = await fetch(book.map_bg_url);
      const blob = await resp.blob();
      bgDataUrl = await blobToDataUrl(blob);
    } catch { /* render template only */ }
  }

  const svgStr = buildSvgString(book, locations, connections, bgDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext('2d')!;

  const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(svgBlob);
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Ошибка загрузки карты'));
    });
    ctx.drawImage(img, 0, 0);
  } finally {
    URL.revokeObjectURL(url);
  }

  return new Promise<ArrayBuffer>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('Ошибка создания PNG карты')); return; }
      blob.arrayBuffer().then(resolve).catch(reject);
    }, 'image/png');
  });
}

export function triggerMapDownload(buffer: ArrayBuffer, bookTitle: string) {
  const slug = (bookTitle || 'world').toLowerCase().replace(/\s+/g, '-').replace(/[^a-zа-яё0-9-]/gi, '');
  const url = URL.createObjectURL(new Blob([buffer], { type: 'image/png' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `map-${slug}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
