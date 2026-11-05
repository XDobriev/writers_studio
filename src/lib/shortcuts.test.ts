import { describe, it, expect } from 'vitest';
import { shortcutLabel, EDITOR_SHORTCUTS, type ShortcutDef } from './shortcuts';

describe('shortcutLabel', () => {
  const def: ShortcutDef = { keys: 'Ctrl + S', macKeys: '⌘ S', label: 'Сохранить' };

  it('возвращает непустую строку', () => {
    expect(shortcutLabel(def).length).toBeGreaterThan(0);
  });

  it('возвращает def.macKeys на платформе macOS', () => {
    const origPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    expect(shortcutLabel(def)).toBe('⌘ S');
    Object.defineProperty(navigator, 'platform', { value: origPlatform, configurable: true });
  });

  it('возвращает def.keys на платформе Windows/Linux', () => {
    const origPlatform = navigator.platform;
    Object.defineProperty(navigator, 'platform', { value: 'Win32', configurable: true });
    expect(shortcutLabel(def)).toBe('Ctrl + S');
    Object.defineProperty(navigator, 'platform', { value: origPlatform, configurable: true });
  });
});

describe('EDITOR_SHORTCUTS', () => {
  it('содержит хотя бы один шорткат', () => {
    expect(EDITOR_SHORTCUTS.length).toBeGreaterThan(0);
  });

  it('каждый шорткат имеет непустые keys, macKeys и label', () => {
    for (const s of EDITOR_SHORTCUTS) {
      expect(s.keys.length).toBeGreaterThan(0);
      expect(s.macKeys.length).toBeGreaterThan(0);
      expect(s.label.length).toBeGreaterThan(0);
    }
  });

  it('содержит обновлённые бесконфликтные шорткаты B-8', () => {
    const keys = EDITOR_SHORTCUTS.map((s) => s.keys);
    // Alt + N для заметок
    expect(keys).toContain('Alt + N');
    // Alt + стрелки для глав
    expect(keys).toContain('Alt + ←');
    expect(keys).toContain('Alt + →');
    // Старые конфликтные шорткаты удалены
    expect(keys).not.toContain('Ctrl + Shift + M');
    expect(keys).not.toContain('Ctrl + Shift + [');
    expect(keys).not.toContain('Ctrl + Shift + ]');
  });

  it('содержит шорткаты форматирования TipTap', () => {
    const keys = EDITOR_SHORTCUTS.map((s) => s.keys);
    expect(keys).toContain('Ctrl + B');
    expect(keys).toContain('Ctrl + I');
    expect(keys).toContain('Ctrl + U');
    expect(keys).toContain('Shift + Enter');
  });
});
