import { describe, it, expect, vi, beforeEach } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('./repository', () => ({
  createRepository: () => ({ list: vi.fn(), create, update: vi.fn(), delete: vi.fn() }),
}));

import { createRelationship } from './relationships';

beforeEach(() => create.mockReset());

describe('createRelationship', () => {
  it('пустая подпись партнёра → связь взаимная, обе стороны с одной подписью', async () => {
    await createRelationship('book', 'user', 'a', 'b', 'Друг', '');
    expect(create).toHaveBeenCalledWith('book', 'user', {
      char_a_id: 'a', char_b_id: 'b', label_a: 'Друг', label_b: 'Друг',
    });
  });

  it('подпись из пробелов считается пустой', async () => {
    await createRelationship('book', 'user', 'b', 'a', 'Друг', '   ');
    expect(create).toHaveBeenCalledWith('book', 'user', {
      char_a_id: 'a', char_b_id: 'b', label_a: 'Друг', label_b: 'Друг',
    });
  });

  it('заданная подпись партнёра сохраняется в канонической стороне', async () => {
    await createRelationship('book', 'user', 'b', 'a', 'Наставник', 'Ученик');
    expect(create).toHaveBeenCalledWith('book', 'user', {
      char_a_id: 'a', char_b_id: 'b', label_a: 'Ученик', label_b: 'Наставник',
    });
  });
});
