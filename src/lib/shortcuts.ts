export interface ShortcutDef {
  keys: string;    // Windows/Linux: 'Ctrl + S'
  macKeys: string; // Mac: '⌘ S'
  label: string;
  group?: 'general' | 'formatting';
}

// Горячие клавиши редактора. Рендерится в SettingsModal и используется как
// источник правды для документации. Логика обработки — в EditorHybrid.tsx,
// useKeyboardShortcuts.ts и GlobalSaveHandler.tsx.
export const EDITOR_SHORTCUTS: ShortcutDef[] = [
  { keys: 'Ctrl + S',          macKeys: '⌘ S',     label: 'Сохранить',              group: 'general' },
  { keys: 'Ctrl + Enter',      macKeys: '⌘ Enter', label: 'Новая глава',            group: 'general' },
  { keys: 'Alt + ←',           macKeys: '⌥ ←',     label: 'Предыдущая глава',       group: 'general' },
  { keys: 'Alt + →',           macKeys: '⌥ →',     label: 'Следующая глава',        group: 'general' },
  { keys: 'Ctrl + Shift + F',  macKeys: '⌘ ⇧ F',   label: 'Режим «Страница»',       group: 'general' },
  { keys: 'Alt + N',           macKeys: '⌥ N',     label: 'Новая заметка на полях',  group: 'general' },
  { keys: 'Ctrl + B',          macKeys: '⌘ B',     label: 'Полужирный',            group: 'formatting' },
  { keys: 'Ctrl + I',          macKeys: '⌘ I',     label: 'Курсив',                group: 'formatting' },
  { keys: 'Ctrl + U',          macKeys: '⌘ U',     label: 'Подчёркнутый',          group: 'formatting' },
  { keys: 'Shift + Enter',     macKeys: '⇧ Enter', label: 'Перенос строки',         group: 'formatting' },
];

function isMac(): boolean {
  return typeof navigator !== 'undefined' && (/mac/i.test(navigator.platform) || /mac/i.test(navigator.userAgent));
}

export function shortcutLabel(def: ShortcutDef): string {
  return isMac() ? def.macKeys : def.keys;
}

