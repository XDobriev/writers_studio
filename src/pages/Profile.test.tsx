// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ProfilePage from './Profile';
import { useUserDisplay } from '../lib/useUserDisplay';
import { BookCard } from '../components/BookCard';
import { QUERY_KEYS } from '../lib/queries';
import type { Profile } from '../lib/profiles';
import type { Book } from '../lib/supabase';

const mockUpdateProfile = vi.fn();
const mockUploadAvatar = vi.fn();
const mockDeleteAvatar = vi.fn();
const mockGetProfile = vi.fn();

let mockAuthUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
} | null = {
  id: 'u1',
  email: 'writer@example.com',
  user_metadata: {
    full_name: 'OAuth Автор',
    avatar_url: 'https://oauth.example.com/photo.jpg',
  },
};

vi.mock('../lib/auth', () => ({
  useAuth: () => ({ user: mockAuthUser }),
  translateAuthError: (msg: string) => msg,
}));

vi.mock('../lib/profiles', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/profiles')>();
  return {
    ...actual,
    getProfile: (...args: unknown[]) => mockGetProfile(...args),
    updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
    uploadAvatar: (...args: unknown[]) => mockUploadAvatar(...args),
    deleteAvatar: (...args: unknown[]) => mockDeleteAvatar(...args),
  };
});

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    user_id: 'u1',
    plan: 'free',
    plan_expires_at: null,
    grandfathered: false,
    cancel_at_period_end: false,
    recurring_inv_id: null,
    billing_attempts: 0,
    display_name: 'Иван Бунин',
    avatar_url: null,
    onboarded_at: null,
    checklist_dismissed_at: null,
    first_export_at: null,
    user_dictionary: [],
    trial_started_at: null,
    trial_ends_at: null,
    trial_used: false,
    ...overrides,
  };
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;
let queryClient: QueryClient;
let currentProfile: Profile | null = null;

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthUser = {
    id: 'u1',
    email: 'writer@example.com',
    user_metadata: {
      full_name: 'OAuth Автор',
      avatar_url: 'https://oauth.example.com/photo.jpg',
    },
  };
  currentProfile = makeProfile();
  mockGetProfile.mockImplementation(async () => currentProfile);
  mockUpdateProfile.mockImplementation(async (_uid: string, patch: Partial<Profile>) => {
    if (currentProfile) currentProfile = { ...currentProfile, ...patch };
  });
  mockUploadAvatar.mockImplementation(async () => {
    const url = 'https://cdn.example.com/storage/v1/object/public/avatars/u1/new.webp';
    if (currentProfile) currentProfile = { ...currentProfile, avatar_url: url };
    return url;
  });
  mockDeleteAvatar.mockImplementation(async () => {
    if (currentProfile) currentProfile = { ...currentProfile, avatar_url: null };
  });
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
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

function renderWithProviders(ui: React.ReactNode, initialProfile: Profile | null = makeProfile()) {
  currentProfile = initialProfile;
  queryClient.setQueryData(QUERY_KEYS.profile('u1'), initialProfile);
  act(() => {
    root!.render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{ui}</MemoryRouter>
      </QueryClientProvider>,
    );
  });
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('useUserDisplay — приоритет profile.avatar_url и profile.display_name', () => {
  function Probe() {
    const d = useUserDisplay();
    return (
      <div>
        <span data-testid="name">{d.displayName}</span>
        <span data-testid="initials">{d.initials}</span>
        <span data-testid="avatar">{d.avatarUrl ?? 'none'}</span>
      </div>
    );
  }

  it('отдаёт profile.avatar_url вперёд OAuth avatar_url и переключается на OAuth при удалении кастомного аватара', async () => {
    renderWithProviders(
      <Probe />,
      makeProfile({
        display_name: 'Антон Чехов',
        avatar_url: 'https://cdn.example.com/custom.webp',
      }),
    );

    expect(container!.querySelector('[data-testid="name"]')!.textContent).toBe('Антон Чехов');
    expect(container!.querySelector('[data-testid="initials"]')!.textContent).toBe('АЧ');
    expect(container!.querySelector('[data-testid="avatar"]')!.textContent).toBe('https://cdn.example.com/custom.webp');

    // Сбрасываем кастомный аватар -> должен сработать фолбэк на OAuth
    await act(async () => {
      currentProfile = makeProfile({ display_name: null, avatar_url: null });
      queryClient.setQueryData(
        QUERY_KEYS.profile('u1'),
        currentProfile,
      );
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(container!.querySelector('[data-testid="name"]')!.textContent).toBe('OAuth Автор');
    expect(container!.querySelector('[data-testid="avatar"]')!.textContent).toBe('https://oauth.example.com/photo.jpg');
  });
});

describe('Страница /profile (F-2)', () => {
  it('отображает текущие данные профиля и блокирует кнопку «Сохранить», пока имя не изменено', () => {
    renderWithProviders(<ProfilePage />, makeProfile({ display_name: 'Иван Бунин', plan: 'free' }));

    const input = container!.querySelector('#profile-name') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('Иван Бунин');

    const saveBtn = container!.querySelector('.profile-save-btn') as HTMLButtonElement;
    expect(saveBtn.disabled).toBe(true);
    expect(container!.textContent).toContain('writer@example.com');
    expect(container!.textContent).toContain('Перейти на Pro');
  });

  it('сохраняет новое отображаемое имя и мгновенно обновляет кэш профиля', async () => {
    renderWithProviders(<ProfilePage />, makeProfile({ display_name: 'Иван Бунин' }));

    const input = container!.querySelector('#profile-name') as HTMLInputElement;
    const saveBtn = container!.querySelector('.profile-save-btn') as HTMLButtonElement;

    act(() => {
      setNativeInputValue(input, 'Михаил Булгаков');
    });
    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      saveBtn.click();
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith('u1', { display_name: 'Михаил Булгаков' });
    const cached = queryClient.getQueryData<Profile>(QUERY_KEYS.profile('u1'));
    expect(cached?.display_name).toBe('Михаил Булгаков');
    expect(container!.querySelector('.profile-header-name')!.textContent).toBe('Михаил Булгаков');
  });

  it('сохранение пустого имени передаёт display_name: null (возврат к фолбэку)', async () => {
    renderWithProviders(<ProfilePage />, makeProfile({ display_name: 'Иван Бунин' }));

    const input = container!.querySelector('#profile-name') as HTMLInputElement;
    const saveBtn = container!.querySelector('.profile-save-btn') as HTMLButtonElement;

    act(() => {
      setNativeInputValue(input, '   ');
    });
    expect(saveBtn.disabled).toBe(false);

    await act(async () => {
      saveBtn.click();
    });

    expect(mockUpdateProfile).toHaveBeenCalledWith('u1', { display_name: null });
    const cached = queryClient.getQueryData<Profile>(QUERY_KEYS.profile('u1'));
    expect(cached?.display_name).toBeNull();
  });

  it('отклоняет файл > 2 МБ и не-изображение с понятным сообщением об ошибке', () => {
    renderWithProviders(<ProfilePage />, makeProfile());
    const fileInput = container!.querySelector('input[type="file"]') as HTMLInputElement;

    // 1. Не изображение
    const pdfFile = new File([new Uint8Array(128)], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', { value: [pdfFile], configurable: true });
    act(() => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container!.textContent).toContain('Только изображения');
    expect(mockUploadAvatar).not.toHaveBeenCalled();

    // 2. Слишком большой файл (> 2 МБ)
    const bigFile = new File([new Uint8Array(2 * 1024 * 1024 + 10)], 'huge.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [bigFile], configurable: true });
    act(() => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });
    expect(container!.textContent).toContain('Файл слишком большой (макс. 2 МБ)');
    expect(mockUploadAvatar).not.toHaveBeenCalled();
  });

  it('загружает валидный аватар и позволяет удалить его', async () => {
    renderWithProviders(<ProfilePage />, makeProfile({ avatar_url: null }));
    expect(container!.textContent).not.toContain('Удалить аватар');

    const fileInput = container!.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File([new Uint8Array(1024)], 'photo.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [validFile], configurable: true });

    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mockUploadAvatar).toHaveBeenCalledWith('u1', validFile, null);
    expect(queryClient.getQueryData<Profile>(QUERY_KEYS.profile('u1'))?.avatar_url).toBe(
      'https://cdn.example.com/storage/v1/object/public/avatars/u1/new.webp',
    );
    expect(container!.textContent).toContain('Удалить аватар');

    const deleteBtn = Array.from(container!.querySelectorAll('button')).find(
      (b) => b.textContent === 'Удалить аватар',
    )!;
    await act(async () => {
      deleteBtn.click();
    });

    expect(mockDeleteAvatar).toHaveBeenCalledWith(
      'u1',
      'https://cdn.example.com/storage/v1/object/public/avatars/u1/new.webp',
    );
    expect(queryClient.getQueryData<Profile>(QUERY_KEYS.profile('u1'))?.avatar_url).toBeNull();
  });

  it('не сбрасывает несохранённый ввод имени при загрузке аватара и корректно отображает VK и активный триал', async () => {
    mockAuthUser = {
      id: 'u1',
      email: 'vk-777888@vk.local',
      user_metadata: {
        provider: 'vk',
        vk_id: 777888,
        first_name: 'Антон',
        last_name: 'Чехов',
      },
    };
    const futureIso = new Date(Date.now() + 5 * 86400_000).toISOString();
    renderWithProviders(
      <ProfilePage />,
      makeProfile({
        display_name: 'Иван Бунин',
        avatar_url: 'https://cdn.example.com/storage/v1/object/public/avatars/u1/prev.webp',
        plan: 'free',
        trial_started_at: new Date().toISOString(),
        trial_ends_at: futureIso,
        trial_used: true,
      }),
    );

    expect(container!.textContent).toContain('ВКонтакте');
    expect(container!.textContent).toContain('VK ID: 777888');
    expect(container!.textContent).not.toContain('vk-777888@vk.local');
    expect(container!.textContent).toContain('Пробный период Pro');
    expect(container!.textContent).toContain('Перейти на Pro');

    const input = container!.querySelector('#profile-name') as HTMLInputElement;
    act(() => {
      setNativeInputValue(input, 'Несохранённое Имя');
    });
    expect(input.value).toBe('Несохранённое Имя');

    const fileInput = container!.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File([new Uint8Array(512)], 'next.png', { type: 'image/png' });
    Object.defineProperty(fileInput, 'files', { value: [validFile], configurable: true });
    await act(async () => {
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(mockUploadAvatar).toHaveBeenCalledWith(
      'u1',
      validFile,
      'https://cdn.example.com/storage/v1/object/public/avatars/u1/prev.webp',
    );
    expect(input.value).toBe('Несохранённое Имя');
  });
});

describe('BookCard — отображение имени автора из профиля', () => {
  const sampleBook: Book = {
    id: 'b1',
    user_id: 'u1',
    title: 'Тёмные аллеи',
    genre: 'Проза',
    genres: ['Проза'],
    words: 12000,
    imported_words: 0,
    goal: 40000,
    daily_goal: 500,
    cover: null,
    author: null,
    map_bg_url: null,
    map_template: null,
    series_id: null,
    series_order: null,
    share_token: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-10T00:00:00Z',
  };

  it('показывает defaultAuthor из профиля, когда у книги author === null, и собственное имя автора книги, когда оно задано', () => {
    renderWithProviders(
      <BookCard book={sampleBook} defaultAuthor="Иван Бунин" onEdit={vi.fn()} onCreateSequel={vi.fn()} />,
    );
    expect(container!.textContent).toContain('Иван Бунин');

    renderWithProviders(
      <BookCard
        book={{ ...sampleBook, author: 'Псевдоним Автора' }}
        defaultAuthor="Иван Бунин"
        onEdit={vi.fn()}
        onCreateSequel={vi.fn()}
      />,
    );
    expect(container!.textContent).toContain('Псевдоним Автора');
    expect(container!.textContent).not.toContain('Иван Бунин');
  });
});
