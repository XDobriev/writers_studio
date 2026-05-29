import { describe, it, expect, vi } from 'vitest';

vi.mock('./supabase', () => ({
  supabase: { from: vi.fn(), storage: { from: vi.fn() } },
}));

import { initialsFromName, ROLE_LABELS } from './characters';

describe('initialsFromName', () => {
  it('два слова → первые буквы каждого', () => {
    expect(initialsFromName('Алексей Морозов')).toBe('АМ');
  });
  it('одно слово → первые два символа', () => {
    expect(initialsFromName('Алексей')).toBe('АЛ');
  });
  it('три слова → первые буквы первых двух', () => {
    expect(initialsFromName('Анна Ивановна Петрова')).toBe('АИ');
  });
  it('пустая строка → ··', () => {
    expect(initialsFromName('')).toBe('··');
  });
  it('лишние пробелы игнорируются', () => {
    expect(initialsFromName('  Иван  Петров  ')).toBe('ИП');
  });
});

describe('ROLE_LABELS', () => {
  it('содержит все три роли', () => {
    expect(Object.keys(ROLE_LABELS)).toHaveLength(3);
  });
  it('каждая роль имеет непустой label', () => {
    for (const label of Object.values(ROLE_LABELS)) {
      expect(label.length).toBeGreaterThan(0);
    }
  });
});
