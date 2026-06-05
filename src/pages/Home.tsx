import { useEffect, useState, type FormEvent } from 'react';
import { useResponsive } from '../lib/useResponsive';
import { useErrorState } from '../lib/useErrorState';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { AccountMenu } from '../components/AccountMenu';
import { LogoMark } from '../components/LogoMark';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BookCard } from '../components/BookCard';
import { CoverPicker, COVERS } from '../components/CoverPicker';
import { GenrePicker } from '../components/GenrePicker';
import { supabase, type Book } from '../lib/supabase';
import { createBook, updateBook, deleteBook as deleteBookApi } from '../lib/books';
import { markOnboarded } from '../lib/profiles';
import { useAuth } from '../lib/auth';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useBooks, useProfile, QUERY_KEYS } from '../lib/queries';

function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

const ONBOARDING_FEATURES = [
  { icon: 'feather' as const, title: 'Редактор глав', desc: 'Rich-text, фокусный режим, подсчёт слов в реальном времени' },
  { icon: 'user' as const, title: 'Персонажи', desc: 'Карточки героев, связи между персонажами, описания' },
  { icon: 'clock' as const, title: 'Хронология', desc: 'Все события книги на одной оси времени' },
  { icon: 'map' as const, title: 'Карта мира', desc: 'Локации и места действия' },
];

type Plan = 'free' | 'pro' | 'lifetime';

export default function Home() {
  const { user } = useAuth();
  const { displayName } = useUserDisplay();
  const queryClient = useQueryClient();
  const { data: books, error: booksError } = useBooks(user?.id);
  const { data: profile } = useProfile(user?.id);
  const plan = ((profile?.plan ?? 'free') as Plan);
  const { isMobile } = useResponsive();
  const { error: err, setError: setErr } = useErrorState();
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editGoal, setEditGoal] = useState(0);
  const [editCover, setEditCover] = useState(COVERS[0]);
  const [editSaving, setEditSaving] = useState(false);
  const { error: editError, setError: setEditError, clearError: clearEditError } = useErrorState();

  const [createGenres, setCreateGenres] = useState<string[]>([]);
  const [createCover, setCreateCover] = useState(COVERS[0]);
  const [createUploading, setCreateUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [confirmDeleteBook, setConfirmDeleteBook] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);

  const uploadCover = async (file: File, setter: (url: string) => void, setUploading: (v: boolean) => void) => {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('book-covers').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from('book-covers').getPublicUrl(path);
      setter(data.publicUrl);
    } catch {
      // оставляем текущее значение при ошибке
    } finally {
      setUploading(false);
    }
  };

  const deleteBook = async () => {
    if (!editBook) return;
    setDeleting(true);
    try {
      await deleteBookApi(editBook.id);
      queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user!.id), (prev) => prev?.filter((b) => b.id !== editBook.id));
      setEditBook(null);
      setConfirmDeleteBook(false);
    } catch {
      // оставляем диалог открытым при ошибке
    } finally {
      setDeleting(false);
    }
  };

  const openEditBook = (b: Book) => {
    setEditBook(b);
    setEditTitle(b.title);
    setEditGenres(b.genres ?? []);
    setEditGoal(b.goal);
    setEditCover(b.cover ?? COVERS[0]);
    clearEditError();
  };

  const saveEditBook = async () => {
    if (!editBook || !editTitle.trim()) return;
    setEditSaving(true);
    clearEditError();
    try {
      const data = await updateBook(editBook.id, { title: editTitle.trim(), genres: editGenres, goal: Math.max(0, editGoal), cover: editCover });
      queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user!.id), (prev) => prev?.map((b) => b.id === editBook.id ? data : b));
      setEditBook(null);
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  };


  useEffect(() => {
    if (books != null && books.length === 0 && !localStorage.getItem('as_onboarding_done')) {
      setShowWelcome(true);
    }
  }, [books]);

  useEffect(() => {
    if (profile?.onboarded_at) {
      localStorage.setItem('as_onboarding_done', '1');
      setShowWelcome(false);
    }
  }, [profile]);

  const handleWelcomeCreate = () => {
    localStorage.setItem('as_onboarding_done', '1');
    if (user) markOnboarded(user.id);
    setShowWelcome(false);
    setShowCreate(true);
  };

  const dismissWelcome = () => {
    localStorage.setItem('as_onboarding_done', '1');
    if (user) markOnboarded(user.id);
    setShowWelcome(false);
  };

  const handleNewBookClick = () => {
    if (plan === 'free' && (books?.length ?? 0) >= 1) {
      setShowUpgrade(true);
    } else {
      setShowCreate(true);
    }
  };

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || creating) return;
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') ?? '').trim();
    const goalRaw = String(fd.get('goal') ?? '').trim();
    const goal = goalRaw ? Math.max(0, Number(goalRaw)) : 0;
    if (!title) return;
    setCreating(true);
    try {
      const data = await createBook({ user_id: user.id, title, genre: null, genres: createGenres, goal, words: 0, cover: createCover });
      queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user.id), (prev) => [data, ...(prev ?? [])]);
      setShowCreate(false);
      setCreateCover(COVERS[0]);
      setCreateGenres([]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const totalWords = (books ?? []).reduce((s, b) => s + b.words, 0);

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* ─── Header ─── */}
      <header style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, borderBottom: '1px solid var(--border-soft)' }}>
        <LogoMark size={20} />
        <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        <span style={{ flex: 1 }} />
        <span className="hide-sm" style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}>{displayName}</span>
        <AccountMenu placement="below">
          {({ onClick, open }) => (
            <button className="tb-btn" onClick={onClick} aria-label="Аккаунт" aria-haspopup="menu" aria-expanded={open}>
              <Icon name="user" size={16} />
            </button>
          )}
        </AccountMenu>
      </header>

      {/* ─── Content ─── */}
      <div style={{ flex: 1, padding: isMobile ? '24px 16px' : '40px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ font: '600 36px var(--font-serif)', letterSpacing: '-0.012em' }}>Мои книги</h1>
            <p style={{ font: '400 14px var(--font-ui)', color: 'var(--ink-3)', marginTop: 6 }}>
              {books == null ? '…' : `${books.length} ${plural(books.length, 'проект', 'проекта', 'проектов')} · ${totalWords.toLocaleString('ru')} ${plural(totalWords, 'слово', 'слова', 'слов')}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" onClick={handleNewBookClick}>
              <Icon name="plus" size={14} /> Новая книга
            </button>
          </div>
        </div>

        {(err ?? (booksError as Error | null)?.message) && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {err ?? (booksError as Error).message}
          </div>
        )}

        {books == null && <div style={{ color: 'var(--ink-3)' }}>Загрузка…</div>}

        {/* ─── Empty state ─── */}
        {books && books.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', textAlign: 'center' }}>
            <div style={{ width: 96, height: 120, marginBottom: 32, position: 'relative', flexShrink: 0 }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, var(--surface-2), var(--surface))', borderRadius: '4px 10px 10px 4px', border: '1px solid var(--border-soft)', boxShadow: '4px 6px 20px oklch(0 0 0 / 0.25)' }} />
              <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 6, background: 'var(--accent)', borderRadius: '2px 0 0 2px', opacity: 0.9 }} />
              <div style={{ position: 'absolute', left: 18, right: 14, top: 28, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[0.7, 0.5, 0.6, 0.4, 0.55].map((w, i) => (
                  <div key={i} style={{ height: 2, borderRadius: 999, background: 'var(--ink-4)', width: `${w * 100}%` }} />
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: 16, left: 18, right: 14, height: 2, borderRadius: 999, background: 'var(--accent)', opacity: 0.5 }} />
            </div>
            <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 10 }}>
              Начните свою первую историю
            </h2>
            <p style={{ font: '400 14px/1.6 var(--font-ui)', color: 'var(--ink-3)', maxWidth: 360, marginBottom: 28 }}>
              Создайте книгу — все главы, персонажи и заметки будут храниться в вашем аккаунте.
            </p>
            <button className="btn btn--primary btn--lg" onClick={handleNewBookClick}>
              <Icon name="plus" size={15} /> Создать книгу
            </button>
          </div>
        )}

        {/* ─── Books grid ─── */}
        {books && books.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {books.map((b) => (
              <BookCard key={b.id} book={b} onEdit={() => openEditBook(b)} />
            ))}
          </div>
        )}
      </div>

      {/* ─── Edit book modal ─── */}
      {editBook && (
        <div className="modal-overlay" onClick={() => { if (!editSaving) setEditBook(null); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Редактировать книгу"
            className="modal-panel"
            style={{ width: 460, maxWidth: 'calc(100vw - 32px)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setEditBook(null); return; }
              if (e.key === 'Tab') {
                const focusable = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
                const arr = Array.from(focusable);
                if (!arr.length) return;
                const first = arr[0], last = arr[arr.length - 1];
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
              }
            }}
          >
            <div style={{ font: '600 16px var(--font-ui)' }}>Редактировать книгу</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Название</label>
                <input
                  className="input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEditBook(); if (e.key === 'Escape') setEditBook(null); }}
                  autoFocus
                  maxLength={120}
                />
              </div>
              <GenrePicker value={editGenres} onChange={setEditGenres} />
              <div>
                <label className="label">Цель по словам</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1000}
                  value={editGoal || ''}
                  placeholder="необязательно"
                  onChange={(e) => setEditGoal(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditBook(null); }}
                />
                <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Рассказ 1–10 тыс. · Новелла 10–20 тыс. · Повесть 20–50 тыс. · Роман 50–120 тыс. · Эпос / сага 120–300 тыс. слов
                </div>
              </div>
              <CoverPicker
                value={editCover}
                onChange={setEditCover}
                uploading={editUploading}
                onFileSelect={(f) => uploadCover(f, setEditCover, setEditUploading)}
              />
            </div>
            {editError && (
              <div style={{ fontSize: 12, color: 'var(--danger)' }}>{editError}</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn--danger-ghost"
                onClick={() => setConfirmDeleteBook(true)}
              >
                Удалить книгу
              </button>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn--ghost" onClick={() => setEditBook(null)}>Отмена</button>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={saveEditBook}
                  disabled={editSaving || !editTitle.trim()}
                >
                  {editSaving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Upgrade modal ─── */}
      {showUpgrade && (
        <div className="modal-overlay" onClick={() => setShowUpgrade(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Планы и подписка"
            className="modal-panel modal-panel--lg"
            style={{ width: 480 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setShowUpgrade(false); return; }
              if (e.key === 'Tab') {
                const focusable = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
                const arr = Array.from(focusable);
                if (!arr.length) return;
                const first = arr[0], last = arr[arr.length - 1];
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
              }
            }}
          >
            <div>
              <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 10 }}>Pro</div>
              <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 8 }}>Безлимит проектов</h2>
              <p style={{ font: '400 14px/1.65 var(--font-ui)', color: 'var(--ink-3)' }}>
                Бесплатный план включает одну книгу. Перейдите на Pro, чтобы создавать неограниченное количество проектов, экспортировать текст и получать доступ ко всем функциям.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                'Неограниченное количество книг',
                'Экспорт в DOCX и EPUB',
                'Приоритетная поддержка',
              ].map((f) => (
                <div key={f} className="upgrade-check">
                  <span className="upgrade-check__icon">✓</span>
                  {f}
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ font: '600 28px var(--font-serif)', letterSpacing: '-0.02em' }}>290 ₽<span style={{ font: '400 14px var(--font-ui)', color: 'var(--ink-3)', letterSpacing: 0 }}>/мес</span></div>
                <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginTop: 2 }}>или 2 900 ₽/год — 2 месяца в подарок</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--ghost" onClick={() => setShowUpgrade(false)}>Отмена</button>
                <button className="btn btn--primary" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled>Скоро</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Welcome / onboarding modal ─── */}
      {showWelcome && (
        <div
          className="modal-overlay"
          style={{ zIndex: 200, background: 'oklch(0 0 0 / 0.65)', backdropFilter: 'blur(8px)' }}
          onClick={dismissWelcome}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="modal-panel modal-panel--xl"
            style={{ width: 520 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { dismissWelcome(); return; }
              if (e.key === 'Tab') {
                const focusable = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
                const arr = Array.from(focusable);
                if (!arr.length) return;
                const first = arr[0], last = arr[arr.length - 1];
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
              }
            }}
            tabIndex={-1}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20, color: 'oklch(0.98 0 0)' }}>
                <Icon name="feather" size={26} />
              </div>
              <h2 style={{ font: '600 24px var(--font-serif)', letterSpacing: '-0.01em', marginBottom: 10 }}>
                Добро пожаловать в Авторскую студию
              </h2>
              <p style={{ font: '400 14px/1.65 var(--font-ui)', color: 'var(--ink-3)', maxWidth: 360 }}>
                Всё необходимое для работы над книгой — от первой строки до экспорта.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 28 }}>
              {ONBOARDING_FEATURES.map(({ icon, title, desc }) => (
                <div key={title} className="feature-item">
                  <div className="feature-item__icon">
                    <Icon name={icon} size={16} />
                  </div>
                  <div>
                    <div className="feature-item__name">{title}</div>
                    <div className="feature-item__desc">{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--primary btn--lg" style={{ flex: 1 }} onClick={handleWelcomeCreate}>
                <Icon name="plus" size={15} /> Создать первую книгу
              </button>
              <button className="btn btn--ghost btn--lg" style={{ borderColor: 'var(--border)' }} onClick={dismissWelcome}>
                Посмотрю позже
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteBook && editBook && (
        <ConfirmDialog
          message={`Удалить книгу «${editBook.title}»? Это действие необратимо — все главы, персонажи и данные будут удалены навсегда.`}
          onConfirm={deleteBook}
          onCancel={() => { if (!deleting) setConfirmDeleteBook(false); }}
        />
      )}

      {/* ─── Create book modal ─── */}
      {showCreate && (
        <div className="modal-overlay" style={{ zIndex: 50, background: 'oklch(0.10 0.012 50 / 0.55)' }} onClick={() => { if (!creating) setShowCreate(false); }}>
          <form
            onSubmit={onCreate}
            role="dialog"
            aria-modal="true"
            aria-label="Новая книга"
            className="modal-panel"
            style={{ width: 460, maxWidth: 'calc(100vw - 32px)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setShowCreate(false); return; }
              if (e.key === 'Tab') {
                const focusable = (e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
                const arr = Array.from(focusable);
                if (!arr.length) return;
                const first = arr[0], last = arr[arr.length - 1];
                if (e.shiftKey ? document.activeElement === first : document.activeElement === last) { e.preventDefault(); (e.shiftKey ? last : first).focus(); }
              }
            }}
          >
            <h2 style={{ font: '600 22px var(--font-serif)', marginBottom: 16 }}>Новая книга</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Название</label>
                <input className="input" name="title" required autoFocus maxLength={120} />
              </div>
              <GenrePicker value={createGenres} onChange={setCreateGenres} />
              <div>
                <label className="label">Цель по словам</label>
                <input className="input" name="goal" type="number" min={0} step={1000} placeholder="необязательно" />
                <div style={{ marginTop: 5, fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.5 }}>
                  Рассказ 1–10 тыс. · Новелла 10–20 тыс. · Повесть 20–50 тыс. · Роман 50–120 тыс. · Эпос / сага 120–300 тыс. слов
                </div>
              </div>
              <CoverPicker
                value={createCover}
                onChange={setCreateCover}
                uploading={createUploading}
                onFileSelect={(f) => uploadCover(f, setCreateCover, setCreateUploading)}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
              <button type="button" className="btn btn--ghost" onClick={() => setShowCreate(false)} disabled={creating}>Отмена</button>
              <button type="submit" className="btn btn--primary" disabled={creating}>
                {creating ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
