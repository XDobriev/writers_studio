import { useCallback, useEffect, useMemo, useState } from 'react';
import { Skeleton } from '../components/Skeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { toUserMessage } from '../lib/errors';
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
import { COVERS } from '../components/CoverPicker';
import { OnboardingChecklist } from '../components/OnboardingChecklist';
import { supabase, ensureAuthReady, type Book } from '../lib/supabase';
import { updateBook, deleteBook as deleteBookApi, updateSeries, type Series } from '../lib/books';
import {
  INITIAL_SERIES_TRANSFER,
  type SeriesTransferState,
} from '../components/SeriesTransferPicker';
import { getPlanLimits } from '../lib/profiles';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { ImportManuscriptModal } from '../components/ImportManuscriptModal';
import { OnboardingForkModal } from '../components/OnboardingForkModal';
import { EditBookModal } from '../components/EditBookModal';
import { isSampleBook } from '../lib/onboardingTemplates';
import { useAuth } from '../lib/auth';
import { useUserDisplay } from '../lib/useUserDisplay';
import { useBooks, useHasAnyCharacter, useProfile, useSeries, QUERY_KEYS } from '../lib/queries';
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
  const { displayName, avatarUrl } = useUserDisplay();
  const [avatarError, setAvatarError] = useState(false);
  useEffect(() => {
    setAvatarError(false);
  }, [avatarUrl]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: books, error: booksError } = useBooks(user?.id);
  const { data: seriesList } = useSeries(user?.id);
  const { data: profile } = useProfile(user?.id);
  const defaultAuthor = profile?.display_name?.trim() || (displayName && !displayName.includes('@') ? displayName : null);
  const limits = getPlanLimits(profile);
  const { isMobile } = useResponsive();
  const { error: err, setError: setErr } = useErrorState();
  const { enabled: onboardingEnabled } = useFeatureFlag('onboarding_checklist');
  const checklistVisible = onboardingEnabled
    && !!profile && !profile.onboarded_at && !profile.checklist_dismissed_at;
  const { data: hasCharacter } = useHasAnyCharacter(user?.id, checklistVisible);
  // Автоматическое открытие развилки при первом входе в пустой аккаунт (G-7)
  useEffect(() => {
    if (books && books.length === 0 && user) {
      const key = `fork_seen_${user.id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        setShowFork(true)
      }
    }
  }, [books, user]);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('fork') === 'true') {
      setShowFork(true);
    }
  }, []);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<'books' | 'import'>('books');
  const [showImport, setShowImport] = useState(false);
  const [showFork, setShowFork] = useState(false);
  const [forkSeriesTransfer, setForkSeriesTransfer] = useState<SeriesTransferState>(INITIAL_SERIES_TRANSFER);
  const trialResumeRef = useRef<(() => void) | null>(null);

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [confirmDeleteBook, setConfirmDeleteBook] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteBook = async () => {
    if (!editBook) return;
    setDeleting(true);
    try {
      await deleteBookApi(editBook.id);
      queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user!.id), (prev) => prev?.filter((b) => b.id !== editBook.id));
      const deletedId = editBook.id;
      queryClient.removeQueries({ predicate: (q) => q.queryKey[1] === deletedId });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.seriesList(user!.id) });
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
  };

  const handleSaveEditBook = async (patch: {
    title: string;
    author: string | null;
    genres: string[];
    goal: number;
    cover: string;
  }) => {
    if (!editBook) return;
    const data = await updateBook(editBook.id, patch);
    queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user!.id), (prev) => prev?.map((b) => b.id === editBook.id ? data : b));
    queryClient.setQueryData<Book>(QUERY_KEYS.book(editBook.id), data);
    setEditBook(null);
  };

  const handleNewBookClick = () => {
    const nonSampleBooks = (books ?? []).filter((b) => !isSampleBook(b));
    if (nonSampleBooks.length >= limits.maxBooks) {
      setUpgradeFeature('books');
      trialResumeRef.current = () => {
        setForkSeriesTransfer(INITIAL_SERIES_TRANSFER);
        setShowFork(true);
      };
      setShowUpgrade(true);
      return;
    }
    setForkSeriesTransfer(INITIAL_SERIES_TRANSFER);
    setShowFork(true);
  };

  const handleUploadCoverForFork = async (file: File): Promise<string | null> => {
    try {
      await ensureAuthReady();
      const optimized = await optimizeImage(file, COVER_OPTS);
      const ext = optimized.type === 'image/webp' ? 'webp' : 'jpg';
      const path = `${user!.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('book-covers').upload(path, optimized, { upsert: true, contentType: optimized.type });
      if (error) throw error;
      const { data } = supabase.storage.from('book-covers').getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      console.error('Cover upload error:', err);
      return null;
    }
  };

  const handleForkSuccess = (bookOrId: Book | string) => {
    const bookId = typeof bookOrId === 'string' ? bookOrId : bookOrId.id;
    if (typeof bookOrId !== 'string') {
      queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user!.id), (prev) => [bookOrId, ...(prev ?? [])]);
    } else {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.books(user!.id) });
    }
    if (forkSeriesTransfer.enabled) {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.seriesList(user!.id) });
    }
    setShowFork(false);
    navigate(`/books/${bookId}/editor`);
  };

  // Импорт создаёт новую книгу — тот же лимит Free, что и «Новая книга».
  const handleImportClick = () => {
    const nonSampleBooks = (books ?? []).filter((b) => !isSampleBook(b));
    if (nonSampleBooks.length >= limits.maxBooks) {
      setUpgradeFeature('books');
      trialResumeRef.current = () => setShowImport(true);
      setShowUpgrade(true);
    } else {
      setShowImport(true);
    }
  };

  const handleImportNeedsPro = useCallback(() => {
    setShowImport(false);
    setUpgradeFeature('import');
    trialResumeRef.current = null;
    setShowUpgrade(true);
  }, []);

  // Создать продолжение серии: открывает развилку с предзаполненной серией
  const handleCreateSequel = (source: Book) => {
    const nonSampleBooks = (books ?? []).filter((b) => !isSampleBook(b));
    if (nonSampleBooks.length >= limits.maxBooks) {
      setUpgradeFeature('books');
      trialResumeRef.current = () => {
        setForkSeriesTransfer({ ...INITIAL_SERIES_TRANSFER, enabled: true, sourceBookId: source.id });
        setShowFork(true);
      };
      setShowUpgrade(true);
      return;
    }
    setForkSeriesTransfer({ ...INITIAL_SERIES_TRANSFER, enabled: true, sourceBookId: source.id });
    setShowFork(true);
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
              {avatarUrl && !avatarError ? (
                <div className="sb-avatar" style={{ width: 28, height: 28 }}>
                  <img
                    src={avatarUrl}
                    alt={displayName || 'Аватар'}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    onError={() => setAvatarError(true)}
                  />
                </div>
              ) : (
                <Icon name="user" size={16} />
              )}
            </button>
          )}
        </AccountMenu>
      </header>

      {/* ─── Content ─── */}
      <main style={{ flex: 1, padding: isMobile ? '24px 16px' : '40px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 28 }}>
          <div>
            <h1 style={{ font: '600 36px var(--font-serif)', letterSpacing: '-0.012em', whiteSpace: 'nowrap' }}>Мои книги</h1>
            <p style={{ font: '400 14px var(--font-ui)', color: 'var(--ink-3)', marginTop: 6 }}>
              {books == null ? '…' : `${books.length} ${plural(books.length, 'проект', 'проекта', 'проектов')} · ${totalWords.toLocaleString('ru')} ${plural(totalWords, 'слово', 'слова', 'слов')}`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={handleImportClick} aria-label="Импорт рукописи">
              <Icon name="book" size={14} /> {isMobile ? 'Импорт' : 'Импорт рукописи'}
            </button>
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
            checklistDismissedAt={profile?.checklist_dismissed_at ?? null}
            hasCharacter={hasCharacter ?? false}
            firstExportAt={profile?.first_export_at ?? null}
            onCreateBook={handleNewBookClick}
          />
        )}

        {(err ?? booksError) && (
          <ErrorBanner message={err ?? toUserMessage(booksError)} style={{ marginBottom: 16 }} />
        )}

        {books == null && !booksError && <Skeleton lines={3} height={64} gap={14} />}

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
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="btn btn--primary btn--lg" onClick={handleNewBookClick}>
                <Icon name="plus" size={15} /> Создать книгу
              </button>
              <button className="btn btn--lg" onClick={handleImportClick}>
                <Icon name="book" size={15} /> Импортировать рукопись
              </button>
            </div>
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
                    <BookCard key={b.id} book={b} defaultAuthor={defaultAuthor} onEdit={() => openEditBook(b)} onCreateSequel={() => handleCreateSequel(b)} />
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
                    <BookCard key={b.id} book={b} defaultAuthor={defaultAuthor} onEdit={() => openEditBook(b)} onCreateSequel={() => handleCreateSequel(b)} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* ─── Edit book modal ─── */}
      <EditBookModal
        isOpen={editBook !== null}
        onClose={() => setEditBook(null)}
        book={editBook}
        onSave={handleSaveEditBook}
        onDelete={() => setConfirmDeleteBook(true)}
        onUploadCover={handleUploadCoverForFork}
      />

      {/* ─── Onboarding Fork Modal (G-7) ─── */}
      <OnboardingForkModal
        isOpen={showFork}
        onClose={() => setShowFork(false)}
        userId={user?.id}
        books={books ?? []}
        onSelectImport={() => setShowImport(true)}
        onSuccess={handleForkSuccess}
        initialCover={COVERS[(books?.length ?? 0) % COVERS.length]}
        initialSeriesTransfer={forkSeriesTransfer}
        onUploadCover={handleUploadCoverForFork}
      />

      <UpgradePrompt
        open={showUpgrade}
        feature={upgradeFeature}
        onClose={() => {
          setShowUpgrade(false);
          trialResumeRef.current = null;
        }}
        onTrialActivated={() => {
          const resume = trialResumeRef.current;
          trialResumeRef.current = null;
          resume?.();
        }}
      />

      <ImportManuscriptModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
        userId={user?.id}
        isPro={limits.canExportRich}
        cover={COVERS[(books?.length ?? 0) % COVERS.length]}
        onNeedUpgrade={handleImportNeedsPro}
      />

      <ConfirmDialog
        open={confirmDeleteBook && !!editBook}
        message={editBook ? `Удалить книгу «${editBook.title}»? Это действие необратимо — все главы, персонажи и данные будут удалены навсегда.` : ''}
        onConfirm={deleteBook}
        onCancel={() => { if (!deleting) setConfirmDeleteBook(false); }}
      />
    </div>
  );
}
