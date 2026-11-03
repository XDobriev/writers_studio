import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import { type Book } from '../lib/supabase';
import { type ChapterMeta } from '../lib/chapters';
import { type Character, ROLE_LABELS } from '../lib/characters';
import { type Location, TYPE_LABELS } from '../lib/locations';
import { type Format, type ParagraphStyle, LAYOUT_FORMATS } from '../lib/export';
import { type PdfPageSize } from '../lib/exportPdf';
import { useChapterContent } from '../lib/queries';
import { isImageUrl } from './CoverPicker';
import { plural } from '../lib/i18n';
import { Icon } from './Icon';

export type PreviewPageId = 'title' | 'toc' | 'chapter' | 'characters' | 'locations' | 'map';

export interface BookExportPreviewProps {
  book: Book;
  authorName: string;
  format: Format;
  paragraphStyle: ParagraphStyle;
  pdfPageSize?: PdfPageSize;
  selectedChapters: ChapterMeta[];
  includeTitlePage: boolean;
  includeChapterTitles: boolean;
  includeCharacters: boolean;
  includeLocations: boolean;
  includeMap: boolean;
  characters?: Character[];
  locations?: Location[];
  hasMapContent: boolean;
  series?: { name: string; number?: number | null };
}

const SAMPLE_PROSE = [
  'В тишине кабинета мерцал ровный свет настольной лампы. За окном шумел ночной город, укрытый густым туманом, но здесь, среди книжных полок и исписанных листов бумаги, время словно замедлило свой ход.',
  'Каждая строчка требовала точности и внимания. Слова складывались в образы, а те вели за собой сюжет — неторопливый, полный скрытого напряжения и недосказанности.',
  'Писатель отложил перо и перечитал последний абзац. Рукопись оживала, обретая плотность и собственный голос, готовый зазвучать для первого читателя.',
];

export function BookExportPreview({
  book,
  authorName,
  format,
  paragraphStyle,
  pdfPageSize = 'a5',
  selectedChapters,
  includeTitlePage,
  includeChapterTitles,
  includeCharacters,
  includeLocations,
  includeMap,
  characters = [],
  locations = [],
  hasMapContent,
  series,
}: BookExportPreviewProps) {
  const availablePages = useMemo(() => {
    const pages: { id: PreviewPageId; label: string }[] = [];
    if (includeTitlePage) {
      pages.push({ id: 'title', label: 'Титул' });
      pages.push({ id: 'toc', label: 'Оглавление' });
    }
    if (selectedChapters.length > 0) {
      pages.push({ id: 'chapter', label: 'Глава' });
    }
    if (includeCharacters && characters.length > 0) {
      pages.push({ id: 'characters', label: 'Персонажи' });
    }
    if (includeLocations && locations.length > 0) {
      pages.push({ id: 'locations', label: 'Локации' });
    }
    if (includeMap && hasMapContent && LAYOUT_FORMATS.includes(format)) {
      pages.push({ id: 'map', label: 'Карта' });
    }
    return pages;
  }, [
    includeTitlePage,
    selectedChapters.length,
    includeCharacters,
    characters.length,
    includeLocations,
    locations.length,
    includeMap,
    hasMapContent,
    format,
  ]);

  const [activePage, setActivePage] = useState<PreviewPageId>('title');
  const [activeChapterIndex, setActiveChapterIndex] = useState(0);

  // Плавное переключение на первую доступную страницу при смене тумблеров
  useEffect(() => {
    if (availablePages.length > 0 && !availablePages.some((p) => p.id === activePage)) {
      setActivePage(availablePages[0].id);
    }
  }, [availablePages, activePage]);

  // Сброс индекса главы при изменении состава глав
  useEffect(() => {
    if (activeChapterIndex >= selectedChapters.length) {
      setActiveChapterIndex(Math.max(0, selectedChapters.length - 1));
    }
  }, [selectedChapters.length, activeChapterIndex]);

  const activeChapter = selectedChapters[activeChapterIndex] ?? selectedChapters[0];
  const { data: chapterData, isLoading: chapterLoading } = useChapterContent(activeChapter?.id);

  const displayAuthor = authorName.trim() || book.author || 'Автор не указан';
  const displayGenres = (book.genres?.length ? book.genres.join(', ') : book.genre) || '';

  const formatBadge = useMemo(() => {
    if (format === 'epub') return 'EPUB 3.0';
    if (format === 'fb2') return 'FB2 2.0';
    if (format === 'docx') return 'Word (.docx)';
    if (format === 'pdf') return `PDF (${pdfPageSize.toUpperCase()})`;
    if (format === 'html') return 'HTML-книга';
    if (format === 'md') return 'Markdown';
    return 'Текст (.txt)';
  }, [format, pdfPageSize]);

  // Расчёт стилей абзаца
  const paragraphClass = useMemo(() => {
    if (format === 'fb2') return 'preview-p--fb2';
    if (paragraphStyle === 'spacing') return 'preview-p--spacing';
    if (paragraphStyle === 'both') return 'preview-p--both';
    return 'preview-p--indent';
  }, [format, paragraphStyle]);

  return (
    <div className="book-preview-container" data-testid="book-export-preview">
      {/* Header with page tabs and format badge */}
      <div className="book-preview-header">
        <div className="book-preview-tabs" role="tablist" aria-label="Страницы предпросмотра">
          {availablePages.map((p) => {
            const active = p.id === activePage;
            return (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActivePage(p.id)}
                className={`book-preview-tab ${active ? 'book-preview-tab--active' : ''}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="book-preview-badge" title="Целевой формат макета">
          {formatBadge}
        </div>
      </div>

      {/* Book Sheet simulation */}
      <div className="book-preview-viewport">
        <div className="book-preview-sheet">
          {/* Running head */}
          <div className="book-preview-running-head">
            <span className="book-preview-running-title">{book.title}</span>
            <span className="book-preview-running-section">
              {activePage === 'title' && 'Титульный лист'}
              {activePage === 'toc' && 'Оглавление'}
              {activePage === 'chapter' && (activeChapter?.title || 'Глава')}
              {activePage === 'characters' && 'Действующие лица'}
              {activePage === 'locations' && 'Локации'}
              {activePage === 'map' && 'Карта мира'}
            </span>
          </div>

          {/* Page Body */}
          <div className="book-preview-body">
            {/* 1. TITLE PAGE */}
            {activePage === 'title' && (
              <div className="book-preview-page-title" data-testid="preview-page-title">
                {book.cover && isImageUrl(book.cover) ? (
                  <div className="book-preview-cover-wrap">
                    <img
                      src={book.cover}
                      alt={book.title}
                      className="book-preview-cover-img"
                    />
                  </div>
                ) : (
                  <div
                    className="book-preview-cover-placeholder"
                    style={{ background: typeof book.cover === 'string' && !isImageUrl(book.cover) ? book.cover : 'var(--accent-soft)' }}
                  >
                    <Icon name="book" size={28} />
                  </div>
                )}

                {series && (
                  <div className="book-preview-series">
                    Серия «{series.name}»{series.number ? ` · Книга ${series.number}` : ''}
                  </div>
                )}

                <h1 className="book-preview-book-title">{book.title}</h1>
                <div className="book-preview-divider">❖ ❖ ❖</div>
                <div className="book-preview-author">{displayAuthor}</div>

                {displayGenres && (
                  <div className="book-preview-genre">{displayGenres}</div>
                )}

                <div className="book-preview-imprint">
                  Авторская студия · {new Date().getFullYear()}
                </div>
              </div>
            )}

            {/* 2. TABLE OF CONTENTS */}
            {activePage === 'toc' && (
              <div className="book-preview-page-toc" data-testid="preview-page-toc">
                <h2 className="book-preview-section-heading">Оглавление</h2>

                <div className="book-preview-toc-list">
                  {selectedChapters.map((ch, idx) => (
                    <button
                      key={ch.id}
                      type="button"
                      onClick={() => {
                        setActiveChapterIndex(idx);
                        setActivePage('chapter');
                      }}
                      className="book-preview-toc-row"
                      title="Перейти к предпросмотру главы"
                    >
                      <span className="book-preview-toc-num">{idx + 1}.</span>
                      <span className="book-preview-toc-name">{ch.title}</span>
                      <span className="book-preview-toc-dots" />
                      <span className="book-preview-toc-meta">
                        {ch.words.toLocaleString('ru-RU')} {plural(ch.words, 'слово', 'слова', 'слов')}
                      </span>
                    </button>
                  ))}

                  {/* Appendices entries */}
                  {includeCharacters && characters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActivePage('characters')}
                      className="book-preview-toc-row book-preview-toc-row--appendix"
                    >
                      <span className="book-preview-toc-num">✦</span>
                      <span className="book-preview-toc-name">Приложение: Действующие лица</span>
                      <span className="book-preview-toc-dots" />
                      <span className="book-preview-toc-meta">
                        {characters.length} {plural(characters.length, 'персонаж', 'персонажа', 'персонажей')}
                      </span>
                    </button>
                  )}

                  {includeLocations && locations.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActivePage('locations')}
                      className="book-preview-toc-row book-preview-toc-row--appendix"
                    >
                      <span className="book-preview-toc-num">✦</span>
                      <span className="book-preview-toc-name">Приложение: География и локации</span>
                      <span className="book-preview-toc-dots" />
                      <span className="book-preview-toc-meta">
                        {locations.length} {plural(locations.length, 'локация', 'локации', 'локаций')}
                      </span>
                    </button>
                  )}

                  {includeMap && hasMapContent && LAYOUT_FORMATS.includes(format) && (
                    <button
                      type="button"
                      onClick={() => setActivePage('map')}
                      className="book-preview-toc-row book-preview-toc-row--appendix"
                    >
                      <span className="book-preview-toc-num">✦</span>
                      <span className="book-preview-toc-name">Приложение: Карта мира</span>
                      <span className="book-preview-toc-dots" />
                      <span className="book-preview-toc-meta">Иллюстрация</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 3. CHAPTER VIEW */}
            {activePage === 'chapter' && (
              <div className="book-preview-page-chapter" data-testid="preview-page-chapter">
                {/* Chapter pagination / switcher */}
                {selectedChapters.length > 1 && (
                  <div className="book-preview-chapter-nav">
                    <button
                      type="button"
                      disabled={activeChapterIndex === 0}
                      onClick={() => setActiveChapterIndex((i) => Math.max(0, i - 1))}
                      className="book-preview-nav-btn"
                      aria-label="Предыдущая глава"
                    >
                      ‹
                    </button>
                    <span className="book-preview-chapter-counter">
                      Глава {activeChapterIndex + 1} из {selectedChapters.length}
                    </span>
                    <button
                      type="button"
                      disabled={activeChapterIndex >= selectedChapters.length - 1}
                      onClick={() => setActiveChapterIndex((i) => Math.min(selectedChapters.length - 1, i + 1))}
                      className="book-preview-nav-btn"
                      aria-label="Следующая глава"
                    >
                      ›
                    </button>
                  </div>
                )}

                {includeChapterTitles && activeChapter && (
                  <h2 className="book-preview-chapter-title">{activeChapter.title}</h2>
                )}

                {/* Prose content */}
                <div className={`book-preview-prose ${paragraphClass}`}>
                  {chapterLoading ? (
                    <div className="book-preview-loading-skeletons">
                      <div className="book-preview-skeleton-line" style={{ width: '92%' }} />
                      <div className="book-preview-skeleton-line" style={{ width: '100%' }} />
                      <div className="book-preview-skeleton-line" style={{ width: '84%' }} />
                      <div className="book-preview-skeleton-line" style={{ width: '96%', marginTop: 14 }} />
                      <div className="book-preview-skeleton-line" style={{ width: '70%' }} />
                    </div>
                  ) : chapterData?.content && chapterData.content.trim() ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(chapterData.content, { FORBID_TAGS: ['input', 'label'] }),
                      }}
                    />
                  ) : (
                    SAMPLE_PROSE.map((p, idx) => (
                      <p key={idx} className={idx === 0 ? 'no-indent' : undefined}>
                        {p}
                      </p>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* 4. CHARACTERS APPENDIX */}
            {activePage === 'characters' && (
              <div className="book-preview-page-appendix" data-testid="preview-page-characters">
                <h2 className="book-preview-section-heading">Действующие лица</h2>
                <div className="book-preview-appendix-sub">
                  Глоссарий персонажей книги · {characters.length}{' '}
                  {plural(characters.length, 'герой', 'героя', 'героев')}
                </div>

                <div className="book-preview-characters-list">
                  {characters.map((c) => {
                    const snippet = c.appearance || c.personality || c.quote || '';
                    return (
                      <div key={c.id} className="book-preview-character-item">
                        <div className="book-preview-char-header">
                          <span className="book-preview-char-name">{c.name}</span>
                          {c.role && (
                            <span className="book-preview-char-role">
                              {ROLE_LABELS[c.role] ?? c.role}
                            </span>
                          )}
                        </div>
                        {c.aliases && c.aliases.length > 0 && (
                          <div className="book-preview-char-aliases">
                            Имена: {c.aliases.join(', ')}
                          </div>
                        )}
                        {snippet && (
                          <div className="book-preview-char-desc">
                            {snippet.length > 160 ? `${snippet.slice(0, 160)}…` : snippet}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. LOCATIONS APPENDIX */}
            {activePage === 'locations' && (
              <div className="book-preview-page-appendix" data-testid="preview-page-locations">
                <h2 className="book-preview-section-heading">География и локации</h2>
                <div className="book-preview-appendix-sub">
                  Перечень мест действия книги · {locations.length}{' '}
                  {plural(locations.length, 'локация', 'локации', 'локаций')}
                </div>

                <div className="book-preview-locations-list">
                  {locations.map((loc) => (
                      <div key={loc.id} className="book-preview-location-item">
                        <div className="book-preview-loc-header">
                          <span className="book-preview-loc-name">{loc.name}</span>
                          {loc.type && loc.type !== 'other' && (
                            <span className="book-preview-loc-type">
                              {TYPE_LABELS[loc.type] ?? loc.type}
                            </span>
                          )}
                        </div>
                        {loc.description && (
                          <div className="book-preview-loc-desc">
                            {loc.description.length > 160
                              ? `${loc.description.slice(0, 160)}…`
                              : loc.description}
                          </div>
                        )}
                      </div>
                  ))}
                </div>
              </div>
            )}

            {/* 6. MAP APPENDIX */}
            {activePage === 'map' && (
              <div className="book-preview-page-map" data-testid="preview-page-map">
                <h2 className="book-preview-section-heading">Карта мира</h2>
                <div className="book-preview-appendix-sub">
                  Иллюстрация к книге · отдельная вкладка
                </div>

                {book.map_bg_url ? (
                  <div className="book-preview-map-wrap">
                    <img
                      src={book.map_bg_url}
                      alt="Карта мира"
                      className="book-preview-map-img"
                    />
                  </div>
                ) : (
                  <div className="book-preview-map-placeholder">
                    <Icon name="map" size={32} />
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--paper-ink-2)' }}>
                      Карта книги с размещёнными локациями
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Running foot */}
          <div className="book-preview-running-foot">
            <span className="book-preview-page-num">
              {activePage === 'title' && 'I'}
              {activePage === 'toc' && 'II'}
              {activePage === 'chapter' && `${activeChapterIndex + 1}`}
              {activePage === 'characters' && 'П-1'}
              {activePage === 'locations' && 'П-2'}
              {activePage === 'map' && 'П-3'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
