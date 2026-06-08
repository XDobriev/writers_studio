export type MapTemplateId = 'parchment' | 'sea' | 'paper' | 'dark';

export interface MapTemplate {
  id: MapTemplateId;
  label: string;
  desc: string;
  swatchBg: string;
  swatchBorder: string;
}

export const MAP_TEMPLATES: readonly MapTemplate[] = [
  {
    id: 'parchment',
    label: 'Пергамент',
    desc: 'Классический фэнтези',
    swatchBg: 'radial-gradient(ellipse at center, #3d2e1e 0%, #1e150d 100%)',
    swatchBorder: '#5a3f28',
  },
  {
    id: 'sea',
    label: 'Морская',
    desc: 'Тёмный морской стиль',
    swatchBg: 'linear-gradient(180deg, #060e1c 0%, #091526 100%)',
    swatchBorder: '#1e4570',
  },
  {
    id: 'paper',
    label: 'Бумага',
    desc: 'Светлый, современный',
    swatchBg: '#f7f2e8',
    swatchBorder: '#c8b89a',
  },
  {
    id: 'dark',
    label: 'Ночная',
    desc: 'Тёмный минимализм',
    swatchBg: 'radial-gradient(ellipse at center, #1a1a22 0%, #0e0e14 100%)',
    swatchBorder: '#404080',
  },
] as const;

export function getMapTemplate(id: string | null | undefined): MapTemplateId {
  const valid: MapTemplateId[] = ['parchment', 'sea', 'paper', 'dark'];
  return valid.includes(id as MapTemplateId) ? (id as MapTemplateId) : 'parchment';
}

// SVG background strings for off-screen export (no CSS vars, no JSX)
const CW = 1600;
const CH = 900;

export function renderTemplateBgSvg(id: MapTemplateId): string {
  switch (id) {
    case 'parchment':
      return `<defs>
  <radialGradient id="bg-g" cx="50%" cy="50%" r="65%">
    <stop offset="0%" stop-color="#3d2e1e"/>
    <stop offset="100%" stop-color="#1e150d"/>
  </radialGradient>
  <pattern id="bg-d" width="48" height="48" patternUnits="userSpaceOnUse">
    <circle cx="24" cy="24" r="0.9" fill="#9a7a52" opacity="0.18"/>
  </pattern>
</defs>
<rect width="${CW}" height="${CH}" fill="url(#bg-g)" rx="8"/>
<rect width="${CW}" height="${CH}" fill="url(#bg-d)" rx="8"/>
<rect width="${CW}" height="${CH}" fill="none" rx="8" stroke="#5a3f28" stroke-width="2"/>
<rect x="18" y="18" width="${CW - 36}" height="${CH - 36}" fill="none" rx="4" stroke="#4a3420" stroke-width="0.8" stroke-dasharray="10 5" opacity="0.5"/>`;

    case 'sea':
      return `<defs>
  <linearGradient id="bg-g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#060e1c"/>
    <stop offset="100%" stop-color="#091526"/>
  </linearGradient>
  <pattern id="bg-w" width="80" height="40" patternUnits="userSpaceOnUse">
    <path d="M0 20 Q20 10 40 20 Q60 30 80 20" fill="none" stroke="#1a3a5c" stroke-width="0.7" opacity="0.4"/>
  </pattern>
  <pattern id="bg-l" width="160" height="80" patternUnits="userSpaceOnUse">
    <line x1="80" y1="0" x2="80" y2="80" stroke="#1e4570" stroke-width="0.3" opacity="0.3"/>
    <line x1="0" y1="40" x2="160" y2="40" stroke="#1e4570" stroke-width="0.3" opacity="0.3"/>
  </pattern>
</defs>
<rect width="${CW}" height="${CH}" fill="url(#bg-g)"/>
<rect width="${CW}" height="${CH}" fill="url(#bg-w)"/>
<rect width="${CW}" height="${CH}" fill="url(#bg-l)"/>
<rect width="${CW}" height="${CH}" fill="none" stroke="#1e4570" stroke-width="1.5" opacity="0.5"/>
<rect x="12" y="12" width="${CW - 24}" height="${CH - 24}" fill="none" stroke="#1e4570" stroke-width="0.6" stroke-dasharray="8 4" opacity="0.35"/>`;

    case 'paper':
      return `<defs>
  <pattern id="bg-g" width="40" height="40" patternUnits="userSpaceOnUse">
    <line x1="40" y1="0" x2="40" y2="40" stroke="#c8b89a" stroke-width="0.4" opacity="0.5"/>
    <line x1="0" y1="40" x2="40" y2="40" stroke="#c8b89a" stroke-width="0.4" opacity="0.5"/>
  </pattern>
  <pattern id="bg-c" width="200" height="200" patternUnits="userSpaceOnUse">
    <line x1="100" y1="0" x2="100" y2="200" stroke="#b8a080" stroke-width="0.8" opacity="0.3"/>
    <line x1="0" y1="100" x2="200" y2="100" stroke="#b8a080" stroke-width="0.8" opacity="0.3"/>
  </pattern>
</defs>
<rect width="${CW}" height="${CH}" fill="#f7f2e8" rx="6"/>
<rect width="${CW}" height="${CH}" fill="url(#bg-g)" rx="6"/>
<rect width="${CW}" height="${CH}" fill="url(#bg-c)" rx="6"/>
<rect width="${CW}" height="${CH}" fill="none" rx="6" stroke="#c8b89a" stroke-width="1.5"/>
<rect x="16" y="16" width="${CW - 32}" height="${CH - 32}" fill="none" rx="3" stroke="#c8b89a" stroke-width="0.6" stroke-dasharray="6 4" opacity="0.6"/>`;

    case 'dark':
      return `<defs>
  <radialGradient id="bg-g" cx="50%" cy="50%" r="70%">
    <stop offset="0%" stop-color="#1a1a22"/>
    <stop offset="100%" stop-color="#0e0e14"/>
  </radialGradient>
  <pattern id="bg-d" width="32" height="32" patternUnits="userSpaceOnUse">
    <circle cx="16" cy="16" r="0.7" fill="#5050a0" opacity="0.12"/>
  </pattern>
  <pattern id="bg-x" width="160" height="160" patternUnits="userSpaceOnUse">
    <line x1="79" y1="76" x2="81" y2="84" stroke="#6060b0" stroke-width="0.4" opacity="0.2"/>
    <line x1="76" y1="80" x2="84" y2="80" stroke="#6060b0" stroke-width="0.4" opacity="0.2"/>
  </pattern>
</defs>
<rect width="${CW}" height="${CH}" fill="url(#bg-g)"/>
<rect width="${CW}" height="${CH}" fill="url(#bg-d)"/>
<rect width="${CW}" height="${CH}" fill="url(#bg-x)"/>
<rect width="${CW}" height="${CH}" fill="none" stroke="#303060" stroke-width="1" opacity="0.4"/>
<rect x="14" y="14" width="${CW - 28}" height="${CH - 28}" fill="none" stroke="#404080" stroke-width="0.5" stroke-dasharray="5 5" opacity="0.25"/>`;
  }
}
