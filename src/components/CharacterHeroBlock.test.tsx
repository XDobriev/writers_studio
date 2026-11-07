// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CharacterHeroBlock } from './CharacterHeroBlock';
import type { Character } from '../lib/characters';

vi.mock('../lib/crossrefs', () => ({
  findNameVariantsInText: vi.fn().mockResolvedValue([]),
}));
vi.mock('../lib/supabase', () => ({
  supabase: {},
  ensureAuthReady: vi.fn(),
  storagePathFromPublicUrl: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const baseChar: Character = {
  id: 'char-1',
  book_id: 'book-1',
  user_id: 'user-1',
  name: '',
  role: 'protagonist',
  position: 0,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  avatar_url: null,
  aliases: [],
  quote: '',
  age: null,
  appearance: '',
  personality: '',
  interior_life: '',
  exterior_life: '',
  gap: '',
  backstory: '',
  notes: '',
};

let root: Root | null = null;
let el: HTMLDivElement | null = null;

async function mount(overrides: Partial<Character> = {}) {
  if (root) {
    act(() => root?.unmount());
    document.body.innerHTML = '';
  }
  el = document.createElement('div');
  document.body.appendChild(el);
  root = createRoot(el);

  const character = { ...baseChar, ...overrides };
  const onChange = vi.fn();
  const onError = vi.fn();

  await act(async () => {
    root?.render(
      <CharacterHeroBlock
        character={character}
        bookId="book-1"
        onChange={onChange}
        onError={onError}
      />
    );
  });

  return { character, onChange, onError };
}

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  el = null;
  document.body.innerHTML = '';
});

describe('CharacterHeroBlock — аватар и заглушка персонажа', () => {
  it('при отсутствии аватара и имени отображает аккуратный силуэт пользователя вместо полос и точек', async () => {
    await mount({ name: '', avatar_url: null });

    const placeholder = el!.querySelector('[data-testid="char-portrait-placeholder"]');
    expect(placeholder).not.toBeNull();
    // Проверяем SVG иконку user (48px)
    const svg = placeholder!.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute('width')).toBe('48');
    expect(svg?.getAttribute('height')).toBe('48');

    // Никаких "··" и диагональных полос нет
    expect(el!.textContent).not.toContain('··');
    expect(el!.querySelector('[data-testid="char-portrait-initials"]')).toBeNull();
    expect(el!.innerHTML).not.toContain('repeating-linear-gradient');
  });

  it('при отсутствии аватара, но наличии имени отображает инициалы персонажа', async () => {
    await mount({ name: 'Анна Ахматова', avatar_url: null });

    expect(el!.querySelector('[data-testid="char-portrait-placeholder"]')).toBeNull();
    const initialsEl = el!.querySelector('[data-testid="char-portrait-initials"]');
    expect(initialsEl).not.toBeNull();
    expect(initialsEl?.textContent).toBe('АА');
    expect(el!.innerHTML).not.toContain('repeating-linear-gradient');
  });

  it('при наличии валидного avatar_url рендерит изображение img', async () => {
    await mount({ name: 'Анна', avatar_url: 'https://example.com/avatar.jpg' });

    const img = el!.querySelector<HTMLImageElement>('[data-testid="char-portrait-img"]');
    expect(img).not.toBeNull();
    expect(img?.src).toBe('https://example.com/avatar.jpg');
    expect(el!.querySelector('[data-testid="char-portrait-placeholder"]')).toBeNull();
    expect(el!.querySelector('[data-testid="char-portrait-initials"]')).toBeNull();
  });

  it('при ошибке загрузки изображения (onError) переключается на заглушку', async () => {
    await mount({ name: '', avatar_url: 'https://example.com/broken-avatar.jpg' });

    const img = el!.querySelector<HTMLImageElement>('[data-testid="char-portrait-img"]');
    expect(img).not.toBeNull();

    // Имитируем ошибку загрузки изображения (404 / network error)
    await act(async () => {
      img!.dispatchEvent(new Event('error'));
    });

    // Картинка скрылась, вместо неё появился силуэт
    expect(el!.querySelector('[data-testid="char-portrait-img"]')).toBeNull();
    const placeholder = el!.querySelector('[data-testid="char-portrait-placeholder"]');
    expect(placeholder).not.toBeNull();
    expect(placeholder!.querySelector('svg')).not.toBeNull();
  });

  it('при ошибке загрузки изображения для персонажа с именем переключается на инициалы', async () => {
    await mount({ name: 'Лев Толстой', avatar_url: 'https://example.com/broken-avatar.jpg' });

    const img = el!.querySelector<HTMLImageElement>('[data-testid="char-portrait-img"]');
    expect(img).not.toBeNull();

    await act(async () => {
      img!.dispatchEvent(new Event('error'));
    });

    expect(el!.querySelector('[data-testid="char-portrait-img"]')).toBeNull();
    const initials = el!.querySelector('[data-testid="char-portrait-initials"]');
    expect(initials).not.toBeNull();
    expect(initials?.textContent).toBe('ЛТ');
  });

  it('при смене avatar_url на новый сбрасывает состояние ошибки', async () => {
    const { character, onChange, onError } = await mount({
      name: '',
      avatar_url: 'https://example.com/broken.jpg',
    });

    // Вызываем onError
    const img = el!.querySelector<HTMLImageElement>('[data-testid="char-portrait-img"]');
    await act(async () => {
      img!.dispatchEvent(new Event('error'));
    });
    expect(el!.querySelector('[data-testid="char-portrait-placeholder"]')).not.toBeNull();

    // Проп avatar_url меняется на новый URL
    await act(async () => {
      root?.render(
        <CharacterHeroBlock
          character={{ ...character, avatar_url: 'https://example.com/new.jpg' }}
          bookId="book-1"
          onChange={onChange}
          onError={onError}
        />
      );
    });

    const newImg = el!.querySelector<HTMLImageElement>('[data-testid="char-portrait-img"]');
    expect(newImg).not.toBeNull();
    expect(newImg?.src).toBe('https://example.com/new.jpg');
  });
});
