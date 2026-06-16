import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useErrorState } from '../lib/useErrorState';
import { useAuth } from '../lib/auth';
import { getPlanLimits } from '../lib/profiles';
import { useProfile } from '../lib/queries';
import { UpgradePrompt } from '../components/UpgradePrompt';
import { Icon } from '../components/Icon';
import { isImageUrl } from '../components/CoverPicker';
import { getBook, updateBook } from '../lib/books';
import { listChapters, listChaptersMeta, type ChapterMeta } from '../lib/chapters';
import { fetchNotes, type Note } from '../lib/notes';
import { listLocations, type Location } from '../lib/locations';
import { listConnections, type LocationConnection } from '../lib/connections';
import { generateMapPngBuffer } from '../lib/mapExport';
import { plural } from '../lib/i18n';
import { type Book } from '../lib/supabase';
import {
  type Format,
  type ParagraphStyle,
  type BuildOpts,
  type CoverData,
  LANGUAGES,
  FORMAT_MAIN,
  FORMAT_TEXT,
  FORMAT_EXT,
  slugify,
  triggerDownload,
  downloadText,
  buildFb2Doc,
  buildHtmlDoc,
  buildMarkdownDoc,
  buildTextDoc,
  estimateSize,
} from '../lib/export';

export default function Export() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile } = useProfile(user?.id);
  const limits = getPlanLimits(profile?.plan);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<ChapterMeta[] | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [mapLocations, setMapLocations] = useState<Location[]>([]);
  const [mapConnections, setMapConnections] = useState<LocationConnection[]>([]);
  const [includeMap, setIncludeMap] = useState(false);
  const { error, setError, clearError } = useErrorState();
  const [authorName, setAuthorName] = useState('');
  const authorInitialized = useRef(false);

  const [format, setFormat] = useState<Format>('epub');
  const [doneOnly, setDoneOnly] = useState(false);
  const [includeChapterTitles, setIncludeChapterTitles] = useState(true);
  const [includeTitlePage, setIncludeTitlePage] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [language, setLanguage] = useState('ru-RU');
  const [langOpen, setLangOpen] = useState(false);
  const [langPos, setLangPos] = useState({ top: 0, left: 0, width: 0 });
  const langBtnRef = useRef<HTMLButtonElement>(null);
  const [paragraphStyle, setParagraphStyle] = useState<ParagraphStyle>(() => {
    const s = localStorage.getItem('export-paragraph-style');
    return (s === 'indent' || s === 'spacing' || s === 'both') ? s : 'indent';
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      try {
        const [book, list, notesList, locs, conns] = await Promise.all([
          getBook(bookId),
          listChaptersMeta(bookId),
          fetchNotes(bookId),
          listLocations(bookId),
          listConnections(bookId),
        ]);
        if (cancelled) return;
        setBook(book);
        setChapters(list);
        setNotes(notesList);
        setMapLocations(locs);
        setMapConnections(conns);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId, setError]);

  useEffect(() => {
    if (!limits.canExportRich && (format === 'epub' || format === 'fb2' || format === 'docx')) {
      setFormat('html');
    }
  }, [limits.canExportRich, format]);

  useEffect(() => {
    if (!book || authorInitialized.current) return;
    const meta = user?.user_metadata ?? {};
    const profileName = (meta.full_name ?? meta.name ?? meta.first_name ?? '') as string;
    setAuthorName(book.author || profileName);
    authorInitialized.current = true;
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
    return `${slugify(book.title)}-${new Date().toISOString().slice(0, 10)}.${FORMAT_EXT[format]}`;
  }, [book, format]);

  const onDownload = useCallback(async () => {
    if (!book || !bookId) return;
    if (selectedChapters.length === 0) { setError('Нет глав для экспорта.'); return; }
    setBusy(true);
    clearError();
    const bookWithAuthor = { ...book, author: authorName.trim() || book.author };
    const selectedIds = new Set(selectedChapters.map((c) => c.id));
    let chaptersWithContent;
    try {
      const full = await listChapters(bookId);
      chaptersWithContent = full
        .filter((c) => selectedIds.has(c.id))
        .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
      return;
    }
    let coverData: CoverData | undefined;
    if (bookWithAuthor.cover && isImageUrl(bookWithAuthor.cover)) {
      try {
        const resp = await fetch(bookWithAuthor.cover);
        if (resp.ok) {
          const mime = resp.headers.get('content-type') ?? 'image/jpeg';
          const ext = mime.split('/')[1]?.split(';')[0] ?? 'jpg';
          coverData = { data: await resp.arrayBuffer(), mime, ext };
        }
      } catch { /* no cover */ }
    }
    let mapImageData: ArrayBuffer | undefined;
    const hasMapContent = book.map_bg_url || mapLocations.some(l => l.x != null);
    if (includeMap && hasMapContent && (['epub', 'fb2', 'docx', 'html'] as Format[]).includes(format)) {
      try {
        mapImageData = await generateMapPngBuffer(book, mapLocations, mapConnections);
      } catch { /* skip map on error */ }
    }
    const opts: BuildOpts = { includeChapterTitles, includeTitlePage, language, includeNotes, notes, paragraphStyle, cover: coverData, mapImage: mapImageData };
    try {
      // Set onboarding flag on first export
      if (!localStorage.getItem('as_checklist_export')) {
        localStorage.setItem('as_checklist_export', '1');
      }
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
      } else {
        downloadText(buildTextDoc(bookWithAuthor, chaptersWithContent, opts), 'text/plain', filename);
      }
      try {
        await updateBook(bookId, { author: authorName.trim() || null });
      } catch { /* silent */ }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [book, bookId, authorName, selectedChapters, format, includeChapterTitles, includeTitlePage, includeNotes, notes, language, paragraphStyle, filename, includeMap, mapLocations, mapConnections, setError, clearError]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error && !book) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)', marginBottom: 16 }}>Ошибка: {error}</div>
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
  const downloadLabel = busy ? 'Генерация…' : `Скачать ${FORMAT_MAIN.find((f) => f.value === format)?.label ?? format.toUpperCase()}`;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg-void)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 680, maxWidth: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>Экспорт книги</div>
            <h2 style={{ font: '600 22px var(--font-serif)', letterSpacing: '-0.01em', color: 'var(--ink)' }}>
              {book.title} · {totalWords.toLocaleString('ru-RU')} {plural(totalWords, 'слово', 'слова', 'слов')}
            </h2>
          </div>
          <button type="button" onClick={close} aria-label="Закрыть" title="Закрыть" style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', cursor: 'pointer', color: 'var(--ink-3)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '20px 28px 8px' }}>

          {/* Main format cards */}
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Формат</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
            {FORMAT_MAIN.map((o) => {
              const active = o.value === format;
              const locked = !limits.canExportRich;
              return (
                <button
                  key={o.value}
                  onClick={() => locked ? setShowUpgrade(true) : setFormat(o.value)}
                  aria-pressed={active}
                  style={{
                    padding: '14px 16px', borderRadius: 10, textAlign: 'left', cursor: 'pointer',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                    background: active ? 'var(--accent-soft)' : 'var(--surface)',
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
          <div style={{ display: 'flex', gap: 6, marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid var(--border-soft)' }}>
            {FORMAT_TEXT.map((o) => {
              const active = o.value === format;
              return (
                <button
                  key={o.value}
                  onClick={() => setFormat(o.value)}
                  aria-pressed={active}
                  style={{
                    padding: '4px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                    background: active ? 'var(--accent-soft)' : 'var(--surface)',
                    color: active ? 'var(--ink)' : 'var(--ink-3)',
                    font: '500 12px var(--font-mono)',
                  }}
                >
                  {o.label}
                </button>
              );
            })}
            <span style={{ fontSize: 11, color: 'var(--ink-4)', alignSelf: 'center', marginLeft: 4 }}>
              {FORMAT_TEXT.find(f => f.value === format)?.desc ?? 'текстовые форматы'}
            </span>
          </div>

          {/* Metadata */}
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Метаданные</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
              <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>Название</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{book.title}</div>
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
              <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{(book.genres?.length ? book.genres.join(', ') : book.genre) || '—'}</div>
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
              on={!doneOnly}
              onChange={(v) => setDoneOnly(!v)}
            />
            <ToggleRow
              label="Титульная страница и оглавление"
              on={includeTitlePage}
              onChange={setIncludeTitlePage}
            />
            <ToggleRow
              label="Заголовки глав внутри документа"
              on={includeChapterTitles}
              onChange={setIncludeChapterTitles}
            />
            <ToggleRow
              label="Заметки на полях как примечания автора"
              hint={notes.length ? `— ${notes.length} ${plural(notes.length, 'заметка', 'заметки', 'заметок')}` : '— нет заметок'}
              on={includeNotes && notes.length > 0}
              onChange={(v) => notes.length > 0 && setIncludeNotes(v)}
              disabled={notes.length === 0}
            />
            {(() => {
              const hasMapContent = !!(book?.map_bg_url || mapLocations.some(l => l.x != null));
              const supportsMap = (['epub', 'fb2', 'docx', 'html'] as Format[]).includes(format);
              return (
                <ToggleRow
                  label="Карта мира отдельной страницей"
                  hint={!supportsMap ? '— недоступно для текстовых форматов' : !hasMapContent ? '— карта не заполнена' : undefined}
                  on={includeMap && hasMapContent && supportsMap}
                  onChange={(v) => hasMapContent && supportsMap && setIncludeMap(v)}
                  disabled={!hasMapContent || !supportsMap}
                  last
                />
              );
            })()}
          </div>

          {/* Paragraph style — rich formats only */}
          {(['epub', 'fb2', 'docx', 'html'] as Format[]).includes(format) && (
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
                      onClick={() => { setParagraphStyle(s.value); localStorage.setItem('export-paragraph-style', s.value); }}
                      aria-pressed={active}
                      style={{
                        padding: '6px 14px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                        border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                        background: active ? 'var(--accent-soft)' : 'var(--surface)',
                      }}
                    >
                      <div style={{ font: '500 12.5px var(--font-sans)', color: active ? 'var(--ink)' : 'var(--ink-2)' }}>{s.label}</div>
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

          {error && <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ font: '500 12px var(--font-mono)', color: 'var(--ink-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{filename}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 1 }}>{estimateSize(format, selectedChapters)}</div>
          </div>
          <span style={{ flex: 1 }} />
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
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px', fontSize: 13.5, background: language === l.value ? 'var(--surface-2, oklch(0.22 0.01 50))' : 'none', border: 'none', cursor: 'pointer', color: 'var(--ink)', fontFamily: 'inherit' }}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, hint, on, onChange, disabled, last }: {
  label: string; hint?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; last?: boolean;
}) {
  return (
    <label style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid var(--border-soft)',
      fontSize: 13, color: disabled ? 'var(--ink-4)' : 'var(--ink-2)', cursor: disabled ? 'default' : 'pointer',
    }}>
      <input type="checkbox" checked={on} onChange={(e) => !disabled && onChange(e.target.checked)} disabled={disabled} style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }} />
      <span style={{ width: 32, height: 18, borderRadius: 999, background: on && !disabled ? 'var(--accent)' : 'var(--surface-2)', position: 'relative', transition: 'background 150ms', flexShrink: 0, opacity: disabled ? 0.4 : 1 }}>
        <span style={{ position: 'absolute', top: 2, left: on && !disabled ? 16 : 2, width: 14, height: 14, borderRadius: 999, background: on && !disabled ? 'oklch(0.98 0 0)' : 'var(--ink-2)', transition: 'left 150ms' }} />
      </span>
      <span>{label}{hint && <span style={{ color: 'var(--ink-4)', marginLeft: 4 }}>{hint}</span>}</span>
    </label>
  );
}
