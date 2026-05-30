import { describe, it, expect } from 'vitest';
import { shortcutLabel, EDITOR_SHORTCUTS, type ShortcutDef } from './shortcuts';

describe('shortcutLabel', () => {
  const def: ShortcutDef = { keys: 'Ctrl + S', macKeys: '⌘ S', label: 'Сохранить' };

  it('возвращает непустую строку', () => {
    expect(shortcutLabel(def).length).toBeGreaterThan(0);
  });

  it('возвращает одно из двух значений', () => {
    const result = shortcutLabel(def);
    expect([def.keys, def.macKeys]).toContain(result);
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
});
