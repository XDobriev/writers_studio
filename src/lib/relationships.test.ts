import { describe, it, expect, vi, beforeEach } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('./repository', () => ({
  createRepository: () => ({ list: vi.fn(), create, update: vi.fn(), delete: vi.fn() }),
}));
vi.mock('./supabase', () => ({ supabase: {} }));

import { createRelationship, resolveRelationship, type CharacterRelationship, type RelationshipEvent } from './relationships';

beforeEach(() => create.mockReset());

describe('createRelationship', () => {
  it('пустая подпись партнёра → связь взаимная, обе стороны с одной подписью', async () => {
    await createRelationship('book', 'user', 'a', 'b', 'Друг', '');
    expect(create).toHaveBeenCalledWith('book', 'user', {
      char_a_id: 'a', char_b_id: 'b', label_a: 'Друг', label_b: 'Друг', is_secret: false,
    });
  });

  it('подпись из пробелов считается пустой', async () => {
    await createRelationship('book', 'user', 'b', 'a', 'Друг', '   ');
    expect(create).toHaveBeenCalledWith('book', 'user', {
      char_a_id: 'a', char_b_id: 'b', label_a: 'Друг', label_b: 'Друг', is_secret: false,
    });
  });

  it('заданная подпись партнёра сохраняется в канонической стороне', async () => {
    await createRelationship('book', 'user', 'b', 'a', 'Наставник', 'Ученик');
    expect(create).toHaveBeenCalledWith('book', 'user', {
      char_a_id: 'a', char_b_id: 'b', label_a: 'Ученик', label_b: 'Наставник', is_secret: false,
    });
  });
});

const baseline = {
  id: 'r', book_id: 'book', user_id: 'user', char_a_id: 'a', char_b_id: 'b',
  label_a: 'Брат', label_b: 'Сестра', is_secret: false, created_at: '', updated_at: '',
} satisfies CharacterRelationship;
const chapters = [
  { id: 'c3', title: 'Глава 3', position: 2, created_at: '2026-01-01' },
  { id: 'c8', title: 'Глава 8', position: 7, created_at: '2026-01-02' },
  { id: 'c12', title: 'Глава 12', position: 11, created_at: '2026-01-03' },
];
const milestone = (chapter_id: string | null, patch: Partial<RelationshipEvent> = {}): RelationshipEvent => ({
  id: chapter_id ?? 'deleted', relationship_id: 'r', book_id: 'book', user_id: 'user', chapter_id,
  chapter_title: chapter_id ?? 'Удалённая', label_a: 'Не доверяет', label_b: 'Использует',
  is_secret: true, note: 'Спасение', created_at: '2026-01-01', updated_at: '2026-01-01', ...patch,
});

describe('resolveRelationship', () => {
  it('сохраняет исходные подписи до изменений и при выборе исходного состояния', () => {
    expect(resolveRelationship(baseline, [milestone('c8')], chapters, 'c3')).toEqual(baseline);
    expect(resolveRelationship(baseline, [milestone('c8')], chapters, 'baseline')).toEqual(baseline);
  });

  it('применяет изменение к концу главы и сохраняет обе стороны и секретность', () => {
    const state = resolveRelationship(baseline, [milestone('c3'), milestone('c12', { is_secret: false })], chapters, 'c8');
    expect(state).toMatchObject({ label_a: 'Не доверяет', label_b: 'Использует', is_secret: true });
    expect(resolveRelationship(baseline, [milestone('c3')], chapters, 'c3').is_secret).toBe(true);
  });

  it('последнее состояние следует порядку глав, а не дате ввода', () => {
    const events = [milestone('c12', { label_a: 'Союзник', is_secret: false }), milestone('c3')];
    expect(resolveRelationship(baseline, events, chapters).label_a).toBe('Союзник');
    const reordered = chapters.map((c) => c.id === 'c3' ? { ...c, position: 20 } : c);
    expect(resolveRelationship(baseline, events, reordered).label_a).toBe('Не доверяет');
  });

  it('удалённые главы и события другой связи не меняют состояние', () => {
    expect(resolveRelationship(baseline, [milestone(null), milestone('gone'), milestone('c3', { relationship_id: 'other' })], chapters)).toEqual(baseline);
  });

  it('не показывает будущие изменения при неизвестном ID выбранной главы', () => {
    expect(resolveRelationship(baseline, [milestone('c3')], chapters, 'gone')).toEqual(baseline);
  });
});
