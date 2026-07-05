import { useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditorHybrid } from '../components/EditorHybrid';
import { DemoBanner } from '../components/DemoBanner';
import { NOVEL, SAMPLE_PROSE } from '../data/sample';
import { usePageMeta } from '../lib/usePageMeta';
import { countWords, type ChapterMeta, type ChapterActions, type ChapterStatus } from '../lib/chapters';
import type { Book } from '../lib/supabase';

const DEMO_TS = '2026-05-08T14:32:00Z';

const DEMO_BOOK: Book = {
  id: 'demo',
  user_id: 'demo',
  title: NOVEL.title,
  author: NOVEL.author,
  genre: NOVEL.genre,
  genres: [NOVEL.genre],
  cover: null,
  daily_goal: 500,
  goal: 90000,
  words: NOVEL.chapters.reduce((sum, c) => sum + c.words, 0),
  share_token: null,
  map_bg_url: null,
  map_template: null,
  created_at: '2026-05-01T00:00:00Z',
  updated_at: DEMO_TS,
};

const INITIAL_CHAPTERS: ChapterMeta[] = NOVEL.chapters.map((c, i) => ({
  id: `demo-${c.num}`,
  book_id: 'demo',
  user_id: 'demo',
  title: c.title,
  position: i,
  synopsis: '',
  words: c.words,
  status: c.status,
  created_at: DEMO_TS,
  updated_at: DEMO_TS,
}));

// Первая глава — с прозой, остальные пустые (реалистичный WIP).
const INITIAL_CONTENT: Record<string, string> = { 'demo-1': SAMPLE_PROSE };

// Ссылки в chrome редактора ведут на защищённые /books/:id/* — в демо перехватываем
// клик и уводим на регистрацию вместо редиректа AuthGuard на страницу входа.
const GUARDED_PREFIXES = ['/books', '/dictionary', '/admin'];

export default function Demo() {
  usePageMeta({
    title: 'Демо — Авторская студия',
    description: 'Попробуйте редактор Авторской студии без регистрации: живой текст, главы, режимы письма.',
    path: '/demo',
    noindex: true,
  });

  const navigate = useNavigate();
  const [chapters, setChapters] = useState<ChapterMeta[]>(INITIAL_CHAPTERS);
  const [contentMap, setContentMap] = useState<Record<string, string>>(INITIAL_CONTENT);
  const [activeId, setActiveId] = useState<string>('demo-1');

  const activeChapter = chapters.find((c) => c.id === activeId) ?? null;
  const activeContent = contentMap[activeId] ?? '';

  const chapterActions: ChapterActions = {
    onSelectChapter: (id) => setActiveId(id),
    onCreateChapter: () => {
      const id = `demo-${Date.now()}`;
      setChapters((prev) => [
        ...prev,
        {
          id,
          book_id: 'demo',
          user_id: 'demo',
          title: 'Без названия',
          position: prev.length,
          synopsis: '',
          words: 0,
          status: 'draft',
          created_at: DEMO_TS,
          updated_at: DEMO_TS,
        },
      ]);
      setActiveId(id);
    },
    onStatusChange: (id, status: ChapterStatus) =>
      setChapters((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c))),
    onDeleteChapter: (id) =>
      setChapters((prev) => {
        const next = prev.filter((c) => c.id !== id);
        if (id === activeId) setActiveId(next[0]?.id ?? '');
        return next;
      }),
  };

  const handleContentChange = (html: string) => {
    setContentMap((prev) => ({ ...prev, [activeId]: html }));
    const words = countWords(html);
    setChapters((prev) => prev.map((c) => (c.id === activeId ? { ...c, words } : c)));
  };

  const handleTitleChange = (title: string) =>
    setChapters((prev) => prev.map((c) => (c.id === activeId ? { ...c, title } : c)));

  const handleCaptureClick = (e: MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a');
    if (!anchor) return;
    const href = anchor.getAttribute('href') ?? '';
    if (GUARDED_PREFIXES.some((p) => href.startsWith(p))) {
      e.preventDefault();
      e.stopPropagation();
      navigate('/login?tab=signup');
    }
  };

  return (
    <div
      className="as"
      style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}
      onClickCapture={handleCaptureClick}
    >
      <DemoBanner />
      <div style={{ flex: 1, minHeight: 0 }}>
        <EditorHybrid
          demo
          book={DEMO_BOOK}
          chapters={chapters}
          activeChapter={activeChapter}
          activeContent={activeContent}
          chapterActions={chapterActions}
          onContentChange={handleContentChange}
          onTitleChange={handleTitleChange}
        />
      </div>
    </div>
  );
}
