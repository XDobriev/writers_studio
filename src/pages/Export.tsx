import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { supabase, type Book } from '../lib/supabase';
import { listChapters, type Chapter } from '../lib/chapters';

type Format = 'html' | 'txt' | 'md';

const FORMAT_INFO: { value: Format; label: string; ext: string; desc: string }[] = [
  { value: 'html', label: 'HTML', ext: 'html', desc: 'Готовая страница со стилями, открывается в браузере.' },
  { value: 'txt', label: 'TXT', ext: 'txt', desc: 'Чистый текст без форматирования.' },
  { value: 'md', label: 'Markdown', ext: 'md', desc: 'Заголовки, абзацы, выделения курсивом и жирным.' },
];

function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li|blockquote)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z0-9#]+;/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

function htmlToMarkdown(html: string): string {
  let s = html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '\n# $1\n\n');
  s = s.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '\n## $1\n\n');
  s = s.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n\n');
  s = s.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, '**$2**');
  s = s.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, '_$2_');
  s = s.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner: string) => '\n> ' + htmlToText(inner) + '\n\n');
  s = s.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z0-9#]+;/gi, '');
  return s.replace(/\n{3,}/g, '\n\n').trim();
}

const HTML_DOC_STYLE = `
  body { font: 16px/1.7 Georgia, 'Times New Roman', serif; max-width: 720px; margin: 48px auto; padding: 0 24px; color: #1a1715; background: #faf8f4; }
  h1.book-title { font-size: 32px; letter-spacing: -0.01em; margin-bottom: 4px; }
  .book-meta { color: #6a635c; font: 13px/1.5 system-ui, -apple-system, Segoe UI, sans-serif; margin-bottom: 48px; }
  h2.chapter-title { font-size: 22px; letter-spacing: -0.01em; margin: 56px 0 24px; padding-top: 32px; border-top: 1px solid #e6dfd4; }
  p { margin: 0 0 1em; text-indent: 1.4em; }
  p.no-indent, p:first-of-type { text-indent: 0; }
  blockquote { margin: 1.4em 1em; padding-left: 1em; border-left: 3px solid #c8b89a; color: #4a443f; font-style: italic; }
  em, i { font-style: italic; }
  strong, b { font-weight: 600; }
`;

function buildHtmlDoc(book: Book, chapters: Chapter[], opts: { includeChapterTitles: boolean }): string {
  const meta = [book.author && `Автор: ${escapeHtml(book.author)}`, book.genre && `Жанр: ${escapeHtml(book.genre)}`]
    .filter(Boolean)
    .join(' · ');
  const body = chapters
    .map((ch) => {
      const title = opts.includeChapterTitles ? `<h2 class="chapter-title">${escapeHtml(ch.title)}</h2>` : '';
      return title + (ch.content || '');
    })
    .join('\n');
  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(book.title)}</title>
<style>${HTML_DOC_STYLE}</style>
</head>
<body>
<h1 class="book-title">${escapeHtml(book.title)}</h1>
${meta ? `<div class="book-meta">${meta}</div>` : ''}
${body}
</body>
</html>`;
}

function buildTextDoc(book: Book, chapters: Chapter[], opts: { includeChapterTitles: boolean }): string {
  const header = [
    book.title,
    book.author ? `Автор: ${book.author}` : '',
    book.genre ? `Жанр: ${book.genre}` : '',
  ].filter(Boolean).join('\n');
  const body = chapters.map((ch) => {
    const text = htmlToText(ch.content || '');
    if (!opts.includeChapterTitles) return text;
    return `\n\n${ch.title}\n${'─'.repeat(ch.title.length)}\n\n${text}`;
  }).join('\n');
  return `${header}\n${body}\n`.trim() + '\n';
}

function buildMarkdownDoc(book: Book, chapters: Chapter[], opts: { includeChapterTitles: boolean }): string {
  const header = `# ${book.title}\n\n` +
    (book.author ? `*Автор: ${book.author}*  \n` : '') +
    (book.genre ? `*Жанр: ${book.genre}*\n` : '') + '\n';
  const body = chapters.map((ch) => {
    const md = htmlToMarkdown(ch.content || '');
    if (!opts.includeChapterTitles) return md;
    return `\n## ${ch.title}\n\n${md}`;
  }).join('\n');
  return `${header}${body}\n`.trim() + '\n';
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'manuscript';
}

function downloadBlob(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Export() {
  const { id: bookId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [format, setFormat] = useState<Format>('html');
  const [doneOnly, setDoneOnly] = useState(false);
  const [includeChapterTitles, setIncludeChapterTitles] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!bookId) return;
    let cancelled = false;
    (async () => {
      try {
        const [bookRes, list] = await Promise.all([
          supabase.from('books').select('*').eq('id', bookId).single(),
          listChapters(bookId),
        ]);
        if (cancelled) return;
        if (bookRes.error) throw bookRes.error;
        setBook(bookRes.data as Book);
        setChapters(list);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [bookId]);

  const close = useCallback(() => {
    if (bookId) navigate(`/books/${bookId}`);
    else navigate('/books');
  }, [bookId, navigate]);

  const selectedChapters = useMemo(() => {
    if (!chapters) return [];
    const list = doneOnly ? chapters.filter((c) => c.status === 'done') : chapters;
    return [...list].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  }, [chapters, doneOnly]);

  const totalWords = useMemo(() => selectedChapters.reduce((s, c) => s + c.words, 0), [selectedChapters]);

  const filename = useMemo(() => {
    if (!book) return '';
    const date = new Date().toISOString().slice(0, 10);
    const ext = FORMAT_INFO.find((f) => f.value === format)!.ext;
    return `${slugify(book.title)}-${date}.${ext}`;
  }, [book, format]);

  const onDownload = useCallback(() => {
    if (!book) return;
    if (selectedChapters.length === 0) {
      setError('Нет глав для экспорта.');
      return;
    }
    setBusy(true);
    try {
      const opts = { includeChapterTitles };
      if (format === 'html') {
        downloadBlob(buildHtmlDoc(book, selectedChapters, opts), 'text/html', filename);
      } else if (format === 'md') {
        downloadBlob(buildMarkdownDoc(book, selectedChapters, opts), 'text/markdown', filename);
      } else {
        downloadBlob(buildTextDoc(book, selectedChapters, opts), 'text/plain', filename);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [book, selectedChapters, format, includeChapterTitles, filename]);

  if (!bookId) return <Navigate to="/books" replace />;

  if (error) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)', padding: 32 }}>
        <div style={{ color: 'var(--danger)', marginBottom: 16 }}>Ошибка: {error}</div>
        <button className="btn" onClick={close}>← К дэшборду</button>
      </div>
    );
  }

  if (!book || !chapters) {
    return (
      <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink-3)', padding: 32 }}>
        Загрузка…
      </div>
    );
  }

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: 680, maxWidth: '100%', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '22px 28px 18px', borderBottom: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>Экспорт книги</div>
            <h2 style={{ font: '600 22px var(--font-serif)', letterSpacing: '-0.01em', color: 'var(--ink)' }}>{book.title} · {totalWords.toLocaleString('ru-RU')} слов</h2>
          </div>
          <Link to={`/books/${bookId}`} className="tb-btn" style={{ width: 30, height: 30, borderRadius: 999, border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', color: 'var(--ink-3)' }}>×</Link>
        </div>

        <div style={{ padding: '20px 28px 8px' }}>
          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Формат</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 24 }}>
            {FORMAT_INFO.map((o) => {
              const active = o.value === format;
              return (
                <button
                  key={o.value}
                  onClick={() => setFormat(o.value)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 10,
                    border: active ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                    background: active ? 'var(--accent-soft)' : 'var(--surface)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ width: 14, height: 14, borderRadius: 999, border: '1.5px solid ' + (active ? 'var(--accent)' : 'var(--border-strong)'), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {active && <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--accent)' }} />}
                    </span>
                    <span style={{ font: '500 14px var(--font-serif)', color: 'var(--ink)' }}>{o.label}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--ink-3)', lineHeight: 1.4 }}>{o.desc}</div>
                </button>
              );
            })}
          </div>

          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Метаданные</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {[
              ['Название', book.title],
              ['Автор', book.author || '—'],
              ['Жанр', book.genre || '—'],
              ['Слов', totalWords.toLocaleString('ru-RU') + (doneOnly ? ' (только готовые)' : '')],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '10px 12px', background: 'var(--surface)', border: '1px solid var(--border-soft)', borderRadius: 8 }}>
                <div style={{ font: '400 10px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{l}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink)' }}>{v}</div>
              </div>
            ))}
          </div>

          <div style={{ font: '500 10.5px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Включить</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
            <ToggleRow
              label={`Только готовые главы (${chapters.filter((c) => c.status === 'done').length} из ${chapters.length})`}
              on={doneOnly}
              onChange={setDoneOnly}
            />
            <ToggleRow
              label="Заголовки глав внутри документа"
              on={includeChapterTitles}
              onChange={setIncludeChapterTitles}
              last
            />
          </div>
        </div>

        <div style={{ padding: '18px 28px', borderTop: '1px solid var(--border-soft)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Файл: <span style={{ font: '500 12px var(--font-mono)', color: 'var(--ink-2)' }}>{filename}</span>
          </span>
          <span style={{ flex: 1 }} />
          <Link to={`/books/${bookId}`} className="btn btn--ghost" style={{ textDecoration: 'none' }}>Отмена</Link>
          <button onClick={onDownload} disabled={busy || selectedChapters.length === 0} className="btn btn--primary">
            <Icon name="download" size={14} /> Скачать {FORMAT_INFO.find((f) => f.value === format)!.label}
          </button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, on, onChange, last }: { label: string; on: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--border-soft)', fontSize: 13, color: 'var(--ink-2)', cursor: 'pointer' }}>
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      <span style={{ width: 32, height: 18, borderRadius: 999, background: on ? 'var(--accent)' : 'var(--surface-2)', position: 'relative', transition: 'background 150ms', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 14, height: 14, borderRadius: 999, background: on ? 'oklch(0.98 0 0)' : 'var(--ink-2)', transition: 'left 150ms' }} />
      </span>
      {label}
    </label>
  );
}
