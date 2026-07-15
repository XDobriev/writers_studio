import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useResponsive } from '../lib/useResponsive';
import { useErrorState } from '../lib/useErrorState';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../components/Icon';
import { AccountMenu } from '../components/AccountMenu';
import { LogoMark } from '../components/LogoMark';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { BookCard } from '../components/BookCard';
import { BookGroupHeading } from '../components/BookGroupHeading';
import { SeriesNameEdit } from '../components/SeriesNameEdit';
import { CoverPicker, COVERS } from '../components/CoverPicker';
import { GenrePicker } from '../components/GenrePicker';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { supabase, ensureAuthReady, type Book } from '../lib/supabase';
import { createBook, updateBook, deleteBook as deleteBookApi, duplicateBookContent, updateSeries, type Series } from '../lib/books';
import {
  SeriesTransferPicker,
  INITIAL_SERIES_TRANSFER,
  toTransferOptions,
  type SeriesTransferState,
} from '../components/SeriesTransferPicker';
import { createChapter } from '../lib/chapters';
import { getPlanLimits } from '../lib/profiles';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { useAuth } from '../lib/auth';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useBooks, useProfile, useSeries, QUERY_KEYS } from '../lib/queries';
import { optimizeImage, COVER_OPTS } from '../lib/imageOptimize';
import { useFeatureFlag } from '../lib/useFeatureFlag';

import { plural } from '../lib/i18n';

const GRID_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
  gap: 24,
} as const;

export default function Home() {
  const { user } = useAuth();
  const { displayName } = useUserDisplay();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: books, error: booksError } = useBooks(user?.id);
  const { data: seriesList } = useSeries(user?.id);
  const { data: profile } = useProfile(user?.id);
  const limits = getPlanLimits(profile?.plan);
  const { isMobile } = useResponsive();
  const { error: err, setError: setErr } = useErrorState();
  const { enabled: onboardingEnabled } = useFeatureFlag('onboarding_checklist');
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGenres, setEditGenres] = useState<string[]>([]);
  const [editGoal, setEditGoal] = useState(0);
  const [editCover, setEditCover] = useState(COVERS[0]);
  const [editAuthor, setEditAuthor] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const { error: editError, setError: setEditError, clearError: clearEditError } = useErrorState();

  const [createGenres, setCreateGenres] = useState<string[]>([]);
  const [createCover, setCreateCover] = useState(COVERS[0]);
  const [createUploading, setCreateUploading] = useState(false);
  const [seriesTransfer, setSeriesTransfer] = useState<SeriesTransferState>(INITIAL_SERIES_TRANSFER);

  const openCreateModal = () => {
    setCreateCover(COVERS[(books?.length ?? 0) % COVERS.length]);
    setCreateGenres([]);
    setSeriesTransfer(INITIAL_SERIES_TRANSFER);
    setShowCreate(true);
  };
  const [editUploading, setEditUploading] = useState(false);
  const [confirmDeleteBook, setConfirmDeleteBook] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [creating, setCreating] = useState(false);

  const uploadCover = async (
    file: File,
    setter: (url: string) => void,
    setUploading: (v: boolean) => void,
    setError: (msg: string) => void,
  ) => {
    setUploading(true);
    try {
      await ensureAuthReady();
      const optimized = await optimizeImage(file, COVER_OPTS);
      const ext = optimized.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('book-covers').upload(path, optimized, { upsert: true, contentType: optimized.type });
      if (error) throw error;
      const { data } = supabase.storage.from('book-covers').getPublicUrl(path);
      setter(data.publicUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки обложки');
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
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Неизвестная ошибка');
      throw e;
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
    setEditAuthor(b.author ?? '');
    clearEditError();
  };

  const saveEditBook = async () => {
    if (editSaving || !editBook || !editTitle.trim()) return;
    setEditSaving(true);
    clearEditError();
    try {
      const data = await updateBook(editBook.id, { title: editTitle.trim(), genres: editGenres, goal: Math.max(0, editGoal), cover: editCover, author: editAuthor.trim() || null });
      queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user!.id), (prev) => prev?.map((b) => b.id === editBook.id ? data : b));
      setEditBook(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setEditSaving(false);
    }
  };

  const handleNewBookClick = () => {
    if ((books?.length ?? 0) >= limits.maxBooks) {
      setShowUpgrade(true);
    } else {
      openCreateModal();
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
      const isFirstBook = (books?.length ?? 0) === 0;
      if (isFirstBook) {
        await createChapter(data.id, user.id, { title: 'Глава 1', position: 0 });
        navigate(`/books/${data.id}/editor`);
        return;
      }
      if (seriesTransfer.enabled && seriesTransfer.sourceBookId) {
        await duplicateBookContent(seriesTransfer.sourceBookId, data.id, toTransferOptions(seriesTransfer));
        // Книга-источник тоже изменилась (получила series_id/series_order) —
        // точечный setQueryData не покрывает, перезапрашиваем список.
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.books(user.id) });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.seriesList(user.id) });
      } else {
        queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user.id), (prev) => [data, ...(prev ?? [])]);
      }
      setShowCreate(false);
      setCreateCover(COVERS[0]);
      setCreateGenres([]);
      setSeriesTransfer(INITIAL_SERIES_TRANSFER);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setCreating(false);
    }
  };

  const renameSeries = async (id: string, title: string) => {
    if (!user) return;
    try {
      const updated = await updateSeries(id, title);
      queryClient.setQueryData<Series[]>(QUERY_KEYS.seriesList(user.id), (prev) =>
        (prev ?? []).map((s) => (s.id === id ? updated : s)),
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Не удалось переименовать серию');
    }
  };

  const totalWords = (books ?? []).reduce((s, b) => s + b.words, 0);

  // Книги серии — сгруппированы и упорядочены по series_order; остальные — плоско.
  const { seriesGroups, standaloneBooks } = useMemo(() => {
    const list = books ?? [];
    const groups = new Map<string, Book[]>();
    const standalone: Book[] = [];
    for (const b of list) {
      if (b.series_id) {
        const arr = groups.get(b.series_id);
        if (arr) arr.push(b);
        else groups.set(b.series_id, [b]);
      } else {
        standalone.push(b);
      }
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => (a.series_order ?? 0) - (b.series_order ?? 0));
    }
    return { seriesGroups: [...groups.entries()], standaloneBooks: standalone };
  }, [books]);

  const seriesTitle = (id: string) => seriesList?.find((s) => s.id === id)?.title ?? 'Серия';

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
            <button className="tb-btn" onClick={onClick} aria-label="Аккаунт" aria-haspopup="menu" aria-expanded={open} style={{ width: 36, height: 36 }}>
              <Icon name="user" size={16} />
            </button>
          )}
        </AccountMenu>
      </header>

      {/* ─── Content ─── */}
      <main style={{ flex: 1, padding: isMobile ? '24px 16px' : '40px 48px' }}>
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

        {books != null && user && onboardingEnabled && (
          <OnboardingChecklist
            books={books}
            userId={user.id}
            onboardedAt={profile?.onboarded_at ?? null}
            onCreateBook={handleNewBookClick}
          />
        )}

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: 36 }}>
            {seriesGroups.map(([sid, arr]) => (
              <section key={sid}>
                <BookGroupHeading count={arr.length}>
                  Серия «<SeriesNameEdit name={seriesTitle(sid)} onRename={(t) => void renameSeries(sid, t)} />»
                </BookGroupHeading>
                <div style={GRID_STYLE}>
                  {arr.map((b) => (
                    <BookCard key={b.id} book={b} onEdit={() => openEditBook(b)} />
                  ))}
                </div>
              </section>
            ))}
            {standaloneBooks.length > 0 && (
              <section>
                {/* Подпись нужна только чтобы отделить одиночные книги от серий выше */}
                {seriesGroups.length > 0 && (
                  <BookGroupHeading count={standaloneBooks.length}>Отдельные книги</BookGroupHeading>
                )}
                <div style={GRID_STYLE}>
                  {standaloneBooks.map((b) => (
                    <BookCard key={b.id} book={b} onEdit={() => openEditBook(b)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ─── Edit book modal ─── */}
      {editBook && (
        <div className="modal-overlay" onClick={() => { if (!editSaving) setEditBook(null); }}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Редактировать книгу"
            tabIndex={-1}
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
                <label htmlFor="edit-book-title" className="label">Название</label>
                <input
                  id="edit-book-title"
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
                <label htmlFor="edit-book-author" className="label">Автор</label>
                <input
                  id="edit-book-author"
                  className="input"
                  value={editAuthor}
                  onChange={(e) => setEditAuthor(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditBook(null); }}
                  placeholder="Из профиля"
                  maxLength={120}
                />
              </div>
              <div>
                <label htmlFor="edit-book-goal" className="label">Цель по словам</label>
                <input
                  id="edit-book-goal"
                  className="input"
                  type="number"
                  min={0}
                  step={1000}
                  value={editGoal || ''}
                  placeholder="необязательно"
                  onChange={(e) => setEditGoal(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditBook(null); }}
                />
                <div className="input-hint">
                  Рассказ 1–10 тыс. · Новелла 10–20 тыс. · Повесть 20–50 тыс. · Роман 50–120 тыс. · Эпос / сага 120–300 тыс. слов
                </div>
              </div>
              <CoverPicker
                value={editCover}
                onChange={setEditCover}
                uploading={editUploading}
                onFileSelect={(f) => uploadCover(f, setEditCover, setEditUploading, setEditError)}
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
                  style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {editSaving && <span className="btn-spinner" />}
                  {editSaving ? 'Сохраняем…' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <UpgradePrompt open={showUpgrade} feature="books" onClose={() => setShowUpgrade(false)} />

      <ConfirmDialog
        open={confirmDeleteBook && !!editBook}
        message={editBook ? `Удалить книгу «${editBook.title}»? Это действие необратимо — все главы, персонажи и данные будут удалены навсегда.` : ''}
        onConfirm={deleteBook}
        onCancel={() => { if (!deleting) setConfirmDeleteBook(false); }}
      />

      {/* ─── Create book modal ─── */}
      {showCreate && (
        <div className="modal-overlay" style={{ zIndex: 50 }} onClick={() => { if (!creating) setShowCreate(false); }}>
          <form
            onSubmit={onCreate}
            role="dialog"
            aria-modal="true"
            aria-label="Новая книга"
            tabIndex={-1}
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
                <label htmlFor="create-book-title" className="label">Название</label>
                <input id="create-book-title" className="input" name="title" required autoFocus maxLength={120} />
              </div>
              <GenrePicker value={createGenres} onChange={setCreateGenres} />
              <div>
                <label htmlFor="create-book-goal" className="label">Цель по словам</label>
                <input id="create-book-goal" className="input" name="goal" type="number" min={0} step={1000} placeholder="необязательно" />
                <div className="input-hint">
                  Рассказ 1–10 тыс. · Новелла 10–20 тыс. · Повесть 20–50 тыс. · Роман 50–120 тыс. · Эпос / сага 120–300 тыс. слов
                </div>
              </div>
              <CoverPicker
                value={createCover}
                onChange={setCreateCover}
                uploading={createUploading}
                onFileSelect={(f) => uploadCover(f, setCreateCover, setCreateUploading, setErr)}
              />
              <SeriesTransferPicker
                books={books ?? []}
                value={seriesTransfer}
                onChange={setSeriesTransfer}
                disabled={creating}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
              <button type="button" className="btn btn--ghost" onClick={() => setShowCreate(false)} disabled={creating}>Отмена</button>
              <button type="submit" className="btn btn--primary" disabled={creating} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {creating && <span className="btn-spinner" />}
                {creating ? 'Создаём…' : 'Создать'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
