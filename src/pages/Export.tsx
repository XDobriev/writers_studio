import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useErrorState } from '../lib/useErrorState';
import { useAuth } from '../lib/auth';
import { getPlanLimits, markFirstExport } from '../lib/profiles';
import {
  useBook,
  useBookContentCounts,
  useChapters,
  useConnections,
  useLocations,
  useNotes,
  useProfile,
  useSeries,
  useStamps,
  QUERY_KEYS,
} from '../lib/queries';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { ErrorBanner } from '../components/ErrorBanner';
import { ToggleRow } from '../components/ToggleRow';
import { Icon } from '../components/Icon';
import { isImageUrl } from '../components/CoverPicker';
import { updateBook } from '../lib/books';
import { listChapters } from '../lib/chapters';
import { listAllCharacters } from '../lib/characters';
import { generateMapPngBuffer } from '../lib/mapExport';
import { plural } from '../lib/i18n';
import { todayLocalISODate } from '../lib/dates';
import { useEscapeToClose } from '../lib/useEscapeToClose';
import { type Book } from '../lib/supabase';
import {
  type Appendix,
  type Format,
  type ParagraphStyle,
  type BuildOpts,
  type CoverData,
  LANGUAGES,
  FORMAT_MAIN,
  FORMAT_TEXT,
  FORMAT_EXT,
  PRO_FORMATS,
  LAYOUT_FORMATS,
  slugify,
  triggerDownload,
  downloadText,
  buildFb2Doc,
  buildHtmlDoc,
  buildMarkdownDoc,
  buildTextDoc,
  buildCharactersAppendix,
  buildLocationsAppendix,
  fetchCoverData,
  toEbookCover,
  estimateSize,
} from '../lib/export';
import { type PdfPageSize } from '../lib/exportPdf';

export default function Export() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: profile } = useProfile(user?.id);
  const limits = getPlanLimits(profile);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const { data: book, error: bookError } = useBook(bookId);
  const { data: chapters, error: chaptersError } = useChapters(bookId);
  const { data: notes = [] } = useNotes(bookId);
  const { data: mapLocations = [] } = useLocations(bookId);
  const { data: mapConnections = [] } = useConnections(bookId);
  const { data: mapStamps = [] } = useStamps(bookId);
  const { data: counts } = useBookContentCounts(bookId);
  const { data: seriesList } = useSeries(user?.id);
  const loadError = (bookError ?? chaptersError) as Error | null;

  const [includeMap, setIncludeMap] = useState(false);
  const { error, setError, clearError } = useErrorState();
  const [authorName, setAuthorName] = useState('');
  // Значение, которым поле предзаполнено: в книгу пишем, только если автор его поменял.
  const authorInitial = useRef<string | null>(null);

  const [format, setFormat] = useState<Format>('epub');
  const formatDefaulted = useRef(false);
  const [doneOnly, setDoneOnly] = useState(false);
  const [includeChapterTitles, setIncludeChapterTitles] = useState(true);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [includeCharacters, setIncludeCharacters] = useState(false);
  const [includeLocations, setIncludeLocations] = useState(false);
  const [language, setLanguage] = useState('ru-RU');
  const [langOpen, setLangOpen] = useState(false);
  const [langPos, setLangPos] = useState({ top: 0, left: 0, width: 0 });
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const [paragraphStyle, setParagraphStyle] = useState<ParagraphStyle>(() => {
    const s = localStorage.getItem('export-paragraph-style');
    return (s === 'indent' || s === 'spacing' || s === 'both') ? s : 'indent';
  });
  const [busy, setBusy] = useState(false);
  const [pdfPageSize, setPdfPageSize] = useState<PdfPageSize>('a5');

  const closeLang = useCallback(() => setLangOpen(false), []);
  useEscapeToClose(langOpen, closeLang);

  useEffect(() => {
    if (formatDefaulted.current || profile === undefined) return;
    formatDefaulted.current = true;
    if (!limits.canExportRich) setFormat('html');
  }, [profile, limits.canExportRich]);

  useEffect(() => {
    if (!book || authorInitial.current !== null) return;
    const meta = user?.user_metadata ?? {};
    const profileName = (meta.full_name ?? meta.name ?? meta.first_name ?? '') as string;
    const initial = book.author || profileName;
    authorInitial.current = initial;
    setAuthorName(initial);
  }, [book, user]);

  const close = useCallback(() => {
    navigate(bookId ? `/books/${bookId}` : '/books');
  }, [bookId, navigate]);

  const selectedChapters = useMemo(() => {
    if (!chapters) return [];
    const list = doneOnly ? chapters.filter((c) => c.status === 'done') : chapters;
    return [...list].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }, [chapters, doneOnly]);

  const totalWords = useMemo(() => selectedChapters.reduce((s, c) => s + c.words, 0), [selectedChapters]);

  const filename = useMemo(() => {
    if (!book) return '';
    return `${slugify(book.title)}-${todayLocalISODate()}.${FORMAT_EXT[format]}`;
  }, [book, format]);

  const series = useMemo(() => {
    if (!book?.series_id) return undefined;
    const s = seriesList?.find((x) => x.id === book.series_id);
    return s ? { name: s.title, number: book.series_order } : undefined;
  }, [book, seriesList]);

  const hasMapContent = !!(book?.map_bg_url || mapLocations.some((l) => l.x != null));
  const characterCount = counts?.characters ?? 0;
  const locationCount = mapLocations.length;
  const chapterNotesCount = notes.filter((n) => n.chapter_id).length;
  const bookNotesCount = notes.length - chapterNotesCount;

  const onDownload = useCallback(async () => {
    if (!book || !bookId) return;
    if (!limits.canExportRich && PRO_FORMATS.includes(format)) {
      setShowUpgrade(true);
      return;
    }
    if (selectedChapters.length === 0) { setError('Нет глав для экспорта.'); return; }
    // Для PDF открываем окно синхронно — до любого await — чтобы не потерять user gesture
    let pdfWindow: Window | null = null;
    if (format === 'pdf') {
      pdfWindow = window.open('', '_blank');
      if (!pdfWindow) {
        setError('Браузер заблокировал открытие вкладки. Разрешите всплывающие окна для этого сайта.');
        return;
      }
    }
    setBusy(true);
    clearError();
    const trimmedAuthor = authorName.trim();
    const bookWithAuthor: Book = { ...book, author: trimmedAuthor || book.author };
    const selectedIds = new Set(selectedChapters.map((c) => c.id));
    try {
      const [full, characters] = await Promise.all([
        listChapters(bookId),
        includeCharacters && characterCount > 0 ? listAllCharacters(bookId) : Promise.resolve([]),
      ]);
      const chaptersWithContent = full
        .filter((c) => selectedIds.has(c.id))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));

      const appendices: Appendix[] = [];
      if (includeCharacters) {
        const a = buildCharactersAppendix(characters);
        if (a) appendices.push(a);
      }
      if (includeLocations) {
        const a = buildLocationsAppendix(mapLocations);
        if (a) appendices.push(a);
      }

      let coverData: CoverData | undefined;
      if (bookWithAuthor.cover && isImageUrl(bookWithAuthor.cover) && format !== 'html' && format !== 'pdf') {
        const raw = await fetchCoverData(bookWithAuthor.cover);
        coverData = format === 'epub' || format === 'fb2' ? await toEbookCover(raw) : raw;
      }
      let mapImageData: ArrayBuffer | undefined;
      if (includeMap && hasMapContent && LAYOUT_FORMATS.includes(format)) {
        try {
          mapImageData = await generateMapPngBuffer(book, mapLocations, mapConnections, mapStamps);
        } catch { /* skip map on error */ }
      }
      const opts: BuildOpts = {
        includeChapterTitles, includeTitlePage, language, includeNotes, notes, paragraphStyle,
        cover: coverData, mapImage: mapImageData, appendices, series,
      };

      if (format === 'docx') {
        const { buildDocxBlob } = await import('../lib/exportDocx');
        triggerDownload(await buildDocxBlob(bookWithAuthor, chaptersWithContent, opts), filename);
      } else if (format === 'epub') {
        const { buildEpubBlob } = await import('../lib/exportEpub');
        triggerDownload(await buildEpubBlob(bookWithAuthor, chaptersWithContent, opts), filename);
      } else if (format === 'fb2') {
        downloadText(buildFb2Doc(bookWithAuthor, chaptersWithContent, opts), 'application/xml', filename);
      } else if (format === 'html') {
        downloadText(buildHtmlDoc(bookWithAuthor, chaptersWithContent, opts), 'text/html', filename);
      } else if (format === 'md') {
        downloadText(buildMarkdownDoc(bookWithAuthor, chaptersWithContent, opts), 'text/markdown', filename);
      } else if (format === 'pdf' && pdfWindow) {
        const { openPrintPdf } = await import('../lib/exportPdf');
        openPrintPdf(pdfWindow, bookWithAuthor, chaptersWithContent, {
          pageSize: pdfPageSize,
          includeChapterTitles,
          includeTitlePage,
          authorName: trimmedAuthor,
          language,
          includeNotes,
          notes,
          appendices,
        });
      } else {
        downloadText(buildTextDoc(bookWithAuthor, chaptersWithContent, opts), 'text/plain', filename);
      }
    } catch (e) {
      pdfWindow?.close();
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
      setBusy(false);
      return;
    }
    // Файл уже выгружен — сбои ниже не должны выглядеть как «ошибка экспорта».
    if (user && !profile?.first_export_at) {
      try {
        await markFirstExport(user.id);
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile(user.id) });
      } catch { /* silent: шаг онбординга, не экспорт */ }
    }
    const nextAuthor = trimmedAuthor || null;
    if (trimmedAuthor !== (authorInitial.current ?? '').trim() && nextAuthor !== (book.author ?? null)) {
      try {
        const updated = await updateBook(bookId, { author: nextAuthor });
        authorInitial.current = trimmedAuthor;
        queryClient.setQueryData<Book>(QUERY_KEYS.book(bookId), updated);
        if (user) {
          queryClient.setQueryData<Book[]>(QUERY_KEYS.books(user.id), (prev) => prev?.map((b) => (b.id === bookId ? updated : b)));
        }
      } catch { /* silent */ }
    }
    setBusy(false);
  }, [book, bookId, authorName, selectedChapters, format, limits, includeChapterTitles, includeTitlePage,
      includeNotes, notes, language, paragraphStyle, filename, includeMap, hasMapContent, mapLocations, mapConnections,
      mapStamps, includeCharacters, includeLocations, characterCount, series,
      pdfPageSize, setError, clearError, user, profile?.first_export_at, queryClient]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (loadError && !book) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <ErrorBanner message={`Ошибка: ${loadError.message}`} style={{ marginBottom: 16 }} />
        <button className="btn" onClick={close}>← К дэшборду</button>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="page-spinner" />
      </div>
    );
  }

  const doneCnt = chapters.filter((c) => c.status === 'done').length;
  const downloadLabel = busy ? 'Генерация…'
    : format === 'pdf' ? 'Открыть PDF'
    : `Скачать ${FORMAT_MAIN.find((f) => f.value === format)?.label ?? format.toUpperCase()}`;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 680, maxWidth: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>Экспорт книги</div>
            <h2 style={{ font: '600 22px var(--font-serif)', letterSpacing: '-0.01em', color: 'var(--ink)', overflowWrap: 'anywhere' }}>
              {book.title} · {totalWords.toLocaleString('ru-RU')} {plural(totalWords, 'слово', 'слова', 'слов')}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label="Закрыть" title="Закрыть" className="icon-close-btn icon-close-btn--round">×</button>
        </div>

        <div style={{ padding: '20px 28px 8px' }}>

          {/* Main format cards */}
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Формат</div>
          <div className="export-fmt-grid">
            {FORMAT_MAIN.map((o) => {
              const active = o.value === format;
              const locked = !limits.canExportRich;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => locked ? setShowUpgrade(true) : setFormat(o.value)}
                  aria-pressed={active}
                  className="export-fmt-card"
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                    position: 'relative', overflow: 'hidden',
                  }}
                >
                  {locked && (
                    <div style={{ position: 'absolute', inset: 0, background: 'oklch(0 0 0 / 0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="oklch(0.95 0 0 / 0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--border-strong)'), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {active && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />}
                    </span>
                    <span style={{ font: '500 14px var(--font-serif)', color: 'var(--ink)' }}>{o.label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>{o.desc}</div>
                </button>
              );
            })}
          </div>

          {/* Text formats strip */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-soft)' }}>
            {FORMAT_TEXT.map((o) => {
              const active = o.value === format;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setFormat(o.value)}
                  aria-pressed={active}
                  className="export-fmt-btn"
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                    color: active ? 'var(--ink)' : 'var(--ink-3)',
                    font: '500 12px var(--font-mono)',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
            <span style={{ fontSize: 11, color: 'var(--ink-4)', alignSelf: 'center', marginLeft: 4, whiteSpace: 'nowrap' }}>
              {FORMAT_TEXT.find(f => f.value === format)?.desc ?? 'текстовые форматы'}
            </span>
          </div>

          {/* Metadata */}
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Метаданные</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Название</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{book.title}</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Автор</div>
              <input
                aria-label="Автор"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Имя автора…"
                style={{ background: 'none', border: 'none', padding: 0, margin: 0, fontSize: 13.5, color: 'var(--ink)', width: '100%', outline: 'none', fontFamily: 'inherit' }}
              />
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Жанр</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', overflowWrap: 'anywhere' }}>{(book.genres?.length ? book.genres.join(', ') : book.genre) || '—'}</div>
            </div>
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Язык</div>
              <button
                ref={langBtnRef}
                type="button"
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label="Язык документа"
                onClick={() => {
                  if (langOpen) { setLangOpen(false); return; }
                  const r = langBtnRef.current!.getBoundingClientRect();
                  setLangPos({ top: r.bottom + 4, left: r.left, width: r.width });
                  setLangOpen(true);
                }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', width: '100%', textAlign: 'left', fontSize: 13.5, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: 'inherit', outline: 'none' }}
              >
                <span>{LANGUAGES.find(l => l.value === language)?.label}</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--ink-3)', flexShrink: 0 }}>
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Включить</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
            <ToggleRow
              label={`Все ${chapters.length} ${plural(chapters.length, 'глава', 'главы', 'глав')} (готовых: ${doneCnt} из ${chapters.length})`}
              hint={doneOnly ? `— только готовые (${doneCnt})` : undefined}
              isOn={!doneOnly}
              onChange={(v) => setDoneOnly(!v)}
            />
            <ToggleRow
              label="Титульная страница и оглавление"
              isOn={includeTitlePage}
              onChange={setIncludeTitlePage}
            />
            <ToggleRow
              label="Заголовки глав внутри документа"
              isOn={includeChapterTitles}
              onChange={setIncludeChapterTitles}
            />
            <ToggleRow
              label="Примечания автора в конце глав"
              hint={notes.length
                ? `— ${chapterNotesCount} к главам${bookNotesCount ? `, ${bookNotesCount} общих — отдельным разделом` : ''}`
                : '— нет заметок'}
              isOn={includeNotes && notes.length > 0}
              onChange={(v) => notes.length > 0 && setIncludeNotes(v)}
              isDisabled={notes.length === 0}
            />
            <ToggleRow
              label="Действующие лица в конце книги"
              hint={characterCount ? `— ${characterCount} ${plural(characterCount, 'персонаж', 'персонажа', 'персонажей')}` : '— нет персонажей'}
              isOn={includeCharacters && characterCount > 0}
              onChange={(v) => characterCount > 0 && setIncludeCharacters(v)}
              isDisabled={characterCount === 0}
            />
            <ToggleRow
              label="Локации в конце книги"
              hint={locationCount ? `— ${locationCount} ${plural(locationCount, 'локация', 'локации', 'локаций')}` : '— нет локаций'}
              isOn={includeLocations && locationCount > 0}
              onChange={(v) => locationCount > 0 && setIncludeLocations(v)}
              isDisabled={locationCount === 0}
              isLast={format === 'pdf'}
            />
            {format !== 'pdf' && (
              <ToggleRow
                label="Карта мира отдельной страницей"
                hint={!LAYOUT_FORMATS.includes(format) ? '— недоступно для текстовых форматов' : !hasMapContent ? '— карта не заполнена' : undefined}
                isOn={includeMap && hasMapContent && LAYOUT_FORMATS.includes(format)}
                onChange={(v) => hasMapContent && LAYOUT_FORMATS.includes(format) && setIncludeMap(v)}
                isDisabled={!hasMapContent || !LAYOUT_FORMATS.includes(format)}
                isLast
              />
            )}
          </div>

          {/* PDF page settings */}
          {format === 'pdf' && (
            <div style={{ paddingTop: 16, marginBottom: 4 }}>
              <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Страница</div>

              <div style={{ display: 'flex', gap: 7, marginBottom: 12 }}>
                {(['a5', 'a4'] as PdfPageSize[]).map((size) => {
                  const active = pdfPageSize === size;
                  const labels: Record<PdfPageSize, { name: string; sub: string }> = {
                    a5: { name: 'A5 — Книга', sub: '148 × 210 мм · самиздат' },
                    a4: { name: 'A4 — Рукопись', sub: '210 × 297 мм · редактор' },
                  };
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setPdfPageSize(size)}
                      aria-pressed={active}
                      style={{
                        flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                        background: 'var(--surface)',
                      }}
                    >
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: active ? 'var(--ink)' : 'var(--ink-2)', marginBottom: 2 }}>
                        {labels[size].name}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-4)' }}>{labels[size].sub}</div>
                    </button>
                  );
                })}
              </div>

              <div style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                background: 'var(--surface)', border: '1px solid var(--border-soft)',
                borderRadius: 8, padding: '10px 14px',
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0, marginTop: 5 }} />
                <span style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.6 }}>
                  PDF откроется в диалоге браузера. Выбери «Сохранить как PDF». Для наилучшего результата используй Chrome или Edge.
                </span>
              </div>
            </div>
          )}

          {/* Paragraph style — rich formats only */}
          {LAYOUT_FORMATS.includes(format) && (
            <div style={{ paddingTop: 16, marginBottom: 4 }}>
              <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 10 }}>Абзацы</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {([
                  { value: 'indent' as ParagraphStyle, label: 'Книжный', hint: 'красная строка, без интервала' },
                  { value: 'spacing' as ParagraphStyle, label: 'Цифровой', hint: 'интервал между абзацами' },
                  { value: 'both' as ParagraphStyle, label: 'Смешанный', hint: 'красная строка + интервал' },
                ]).map((s) => {
                  const active = paragraphStyle === s.value;
                  return (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => { setParagraphStyle(s.value); localStorage.setItem('export-paragraph-style', s.value); }}
                      aria-pressed={active}
                      className="export-fmt-card"
                      style={{
                        padding: '6px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                      }}
                    >
                      <div style={{ font: '500 12.5px var(--font-ui)', color: active ? 'var(--ink)' : 'var(--ink-2)' }}>{s.label}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--ink-4)', marginTop: 1 }}>{s.hint}</div>
                    </button>
                  );
                })}
              </div>
              {format === 'fb2' && (
                <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 8 }}>
                  Для FB2 стиль абзацев задаётся настройками читалки, не документом
                </div>
              )}
            </div>
          )}

          {error && <ErrorBanner message={error} onDismiss={clearError} size="sm" style={{ marginBottom: 8 }} />}
        </div>

        {/* Footer */}
        <div className="export-footer" style={{ padding: '16px 28px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
          <div className="export-footer-info" style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ font: '500 12px var(--font-mono)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>
              {format === 'pdf'
                ? `~${Math.round(totalWords / 250)} стр. · ${pdfPageSize.toUpperCase()}`
                : estimateSize(format, selectedChapters)}
            </div>
          </div>
          <span className="export-footer-spacer" style={{ flex: 1 }} />
          <div className="export-footer-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to={`/books/${bookId}`} className="btn btn--ghost" style={{ textDecoration: 'none' }}>Отмена</Link>
            <button
              onClick={onDownload}
              disabled={busy || selectedChapters.length === 0}
              className="btn btn--primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {busy && <span className="btn-spinner" />}
              {!busy && <Icon name="download" size={14} />}
              {downloadLabel}
            </button>
          </div>
        </div>
      </div>

      <UpgradePrompt open={showUpgrade} feature="export" onClose={() => setShowUpgrade(false)} />
      {langOpen && <div onClick={() => setLangOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />}
      {langOpen && (
        <div role="listbox" aria-label="Язык документа" style={{ position: 'fixed', top: langPos.top, left: langPos.left, width: langPos.width, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, zIndex: 9999, boxShadow: '0 8px 24px oklch(0 0 0 / 0.5)', overflow: 'hidden' }}>
          {LANGUAGES.map(l => (
            <button
              key={l.value}
              type="button"
              role="option"
              aria-selected={language === l.value}
              onClick={() => { setLanguage(l.value); setLangOpen(false); }}
              className="listbox-option"
              style={{ fontSize: 13.5 }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
