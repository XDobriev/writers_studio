export interface ShortcutDef {
  keys: string;    // Windows/Linux: 'Ctrl + S'
  macKeys: string; // Mac: '⌘ S'
  label: string;
}

// Горячие клавиши редактора. Рендерится в SettingsModal и используется как
// источник правды для документации. Логика обработки — в EditorHybrid.tsx.
export const EDITOR_SHORTCUTS: ShortcutDef[] = [
  { keys: 'Ctrl + S',          macKeys: '⌘ S',     label: 'Сохранить' },
  { keys: 'Ctrl + Enter',      macKeys: '⌘ Enter', label: 'Новая глава' },
  { keys: 'Ctrl + Shift + [',  macKeys: '⌘ ⇧ [',   label: 'Предыдущая глава' },
  { keys: 'Ctrl + Shift + ]',  macKeys: '⌘ ⇧ ]',   label: 'Следующая глава' },
  { keys: 'Ctrl + Shift + F',  macKeys: '⌘ ⇧ F',   label: 'Режим «Страница»' },
  { keys: 'Ctrl + Shift + M',  macKeys: '⌘ ⇧ M',   label: 'Новая заметка на полях' },
];

const _isMac = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);

export function shortcutLabel(def: ShortcutDef): string {
  return _isMac ? def.macKeys : def.keys;
}
