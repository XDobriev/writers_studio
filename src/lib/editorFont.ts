export type EditorFontId = 'source-serif-4' | 'lora' | 'pt-serif' | 'spectral' | 'ibm-plex-mono';

export interface EditorFont {
  id: EditorFontId;
  label: string;
  fullName: string;
  family: string;
}

export const EDITOR_FONTS: EditorFont[] = [
  { id: 'source-serif-4', label: 'Source Serif', fullName: 'Source Serif 4', family: "'Source Serif 4', Georgia, serif" },
  { id: 'lora',           label: 'Lora',         fullName: 'Lora',           family: "'Lora', Georgia, serif" },
  { id: 'pt-serif',       label: 'PT Serif',      fullName: 'PT Serif',       family: "'PT Serif', Georgia, serif" },
  { id: 'spectral',       label: 'Spectral',      fullName: 'Spectral',       family: "'Spectral', Georgia, serif" },
  { id: 'ibm-plex-mono',  label: 'Mono',          fullName: 'IBM Plex Mono',  family: "'IBM Plex Mono', monospace" },
];

const STORAGE_KEY = 'as-editor-font';
export const EDITOR_FONT_EVENT = 'as-editor-font';
const DEFAULT_ID: EditorFontId = 'source-serif-4';

export function getStoredEditorFont(): EditorFontId {
  return (localStorage.getItem(STORAGE_KEY) as EditorFontId | null) ?? DEFAULT_ID;
}

export function applyEditorFont(id: EditorFontId): void {
  const font = EDITOR_FONTS.find(f => f.id === id) ?? EDITOR_FONTS[0];
  document.documentElement.style.setProperty('--font-editor', font.family);
  localStorage.setItem(STORAGE_KEY, id);
  window.dispatchEvent(new CustomEvent(EDITOR_FONT_EVENT, { detail: id }));
}
