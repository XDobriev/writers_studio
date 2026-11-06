// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { SidebarFoot } from './SidebarFoot';

let mockUserDisplay = {
  displayName: 'Лев Толстой',
  initials: 'ЛТ',
  avatarUrl: null as string | null,
  plan: 'free',
  planLoaded: true,
};

vi.mock('../../lib/useUserDisplay', () => ({
  useUserDisplay: () => mockUserDisplay,
}));

vi.mock('../AccountMenu', () => ({
  AccountMenu: ({ children }: { children: (p: { onClick: () => void; open: boolean; signingOut: boolean }) => React.ReactNode }) =>
    children({ onClick: vi.fn(), open: false, signingOut: false }),
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
});

describe('SidebarFoot аватар', () => {
  it('отображает инициалы при отсутствии avatarUrl', () => {
    mockUserDisplay = {
      displayName: 'Лев Толстой',
      initials: 'ЛТ',
      avatarUrl: null,
      plan: 'pro',
      planLoaded: true,
    };

    act(() => {
      root!.render(<SidebarFoot />);
    });

    const avatar = container!.querySelector('.sb-avatar');
    expect(avatar).not.toBeNull();
    expect(avatar!.textContent).toContain('ЛТ');
    expect(avatar!.querySelector('img')).toBeNull();
  });

  it('рендерит тег img, если avatarUrl задан', () => {
    mockUserDisplay = {
      displayName: 'Анна Каренина',
      initials: 'АК',
      avatarUrl: 'https://example.com/photo.jpg',
      plan: 'free',
      planLoaded: true,
    };

    act(() => {
      root!.render(<SidebarFoot />);
    });

    const img = container!.querySelector('.sb-avatar img') as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute('src')).toBe('https://example.com/photo.jpg');
    expect(img.getAttribute('alt')).toBe('Анна Каренина');
  });

  it('переключается на фолбек с инициалами при ошибке загрузки картинки (onError)', () => {
    mockUserDisplay = {
      displayName: 'Анна Каренина',
      initials: 'АК',
      avatarUrl: 'https://broken-telegram-cdn.org/bad-image.jpg',
      plan: 'free',
      planLoaded: true,
    };

    act(() => {
      root!.render(<SidebarFoot />);
    });

    const img = container!.querySelector('.sb-avatar img');
    expect(img).not.toBeNull();

    act(() => {
      img!.dispatchEvent(new Event('error'));
    });

    // Картинка убрана, отображаются инициалы
    expect(container!.querySelector('.sb-avatar img')).toBeNull();
    expect(container!.querySelector('.sb-avatar')!.textContent).toContain('АК');
  });

  it('рендерит иконку-заглушку user, когда нет ни аватара, ни валидных инициалов', () => {
    mockUserDisplay = {
      displayName: '',
      initials: '?',
      avatarUrl: null,
      plan: 'free',
      planLoaded: true,
    };

    act(() => {
      root!.render(<SidebarFoot />);
    });

    const avatar = container!.querySelector('.sb-avatar');
    expect(avatar).not.toBeNull();
    expect(avatar!.querySelector('img')).toBeNull();
    // '?' не должен выводиться текстом в круге
    expect(avatar!.textContent?.trim()).toBe('');
    expect(avatar!.querySelector('svg')).not.toBeNull();
  });
});
