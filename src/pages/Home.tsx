import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { supabase, type Book } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const COVERS = ['#7c1d1d', '#3d4a2e', '#1c3a4a', '#4a2e3c', '#2a4a3a', '#4a3a2a'];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function dayDiff(iso: string): number {
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function Home() {
  const { user, signOut } = useAuth();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('updated_at', { ascending: false });
      if (cancelled) return;
      if (error) setErr(error.message);
      else setBooks((data ?? []) as Book[]);
    })();
    return () => { cancelled = true; };
  }, []);

  const onCreate = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') ?? '').trim();
    const genre = String(fd.get('genre') ?? '').trim() || null;
    const goal = Number(fd.get('goal') ?? 80000) || 80000;
    if (!title) return;
    const cover = COVERS[Math.floor(Math.random() * COVERS.length)];
    const { data, error } = await supabase
      .from('books')
      .insert({ user_id: user.id, title, genre, goal, words: 0, cover })
      .select()
      .single();
    if (error) {
      setErr(error.message);
      return;
    }
    setBooks((prev) => [data as Book, ...(prev ?? [])]);
    setShowCreate(false);
  };

  const totalWords = (books ?? []).reduce((s, b) => s + b.words, 0);

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, borderBottom: '1px solid var(--border-soft)' }}>
        <span style={{ width: 18, height: 22, background: 'var(--accent)', borderRadius: '1px 4px 4px 1px', position: 'relative' }}>
          <span style={{ position: 'absolute', inset: 3, border: '0.5px solid oklch(0.98 0 0 / 0.6)' }} />
        </span>
        <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        <span style={{ flex: 1 }} />
        <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}>{user?.email}</span>
        <button className="btn btn--ghost" onClick={signOut}>Выйти</button>
      </div>

      <div style={{ flex: 1, padding: '40px 48px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 28 }}>
          <div>
            <h1 style={{ font: '600 36px var(--font-serif)', letterSpacing: '-0.012em' }}>Мои книги</h1>
            <p style={{ font: '400 14px var(--font-ui)', color: 'var(--ink-3)', marginTop: 6 }}>
              {books == null ? '…' : `${books.length} ${books.length === 1 ? 'проект' : 'проектов'} · ${totalWords.toLocaleString('ru')} слов`}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={14} /> Новая книга
            </button>
          </div>
        </div>

        {err && (
          <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'oklch(0.65 0.18 25 / 0.10)', color: 'var(--danger)', fontSize: 13 }}>
            {err}
          </div>
        )}

        {books == null && <div style={{ color: 'var(--ink-3)' }}>Загрузка…</div>}

        {books && books.length === 0 && (
          <div style={{ padding: '64px 32px', textAlign: 'center', border: '1px dashed var(--border-strong)', borderRadius: 12, color: 'var(--ink-3)' }}>
            <div style={{ font: '500 18px var(--font-serif)', color: 'var(--ink-2)', marginBottom: 8 }}>Полка пуста.</div>
            <div style={{ marginBottom: 16, fontSize: 13 }}>Создайте первую книгу — её данные будут храниться в вашем аккаунте.</div>
            <button className="btn btn--primary" onClick={() => setShowCreate(true)}>
              <Icon name="plus" size={14} /> Начать новую книгу
            </button>
          </div>
        )}

        {books && books.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24 }}>
            {books.map((b) => (
              <Link key={b.id} to={`/books/${b.id}`} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-soft)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ height: 180, background: `linear-gradient(160deg, ${b.cover ?? '#3a3a4a'}, oklch(0.20 0.02 50))`, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '18px 20px', borderBottom: '1px solid var(--border-soft)' }}>
                  <div style={{ font: '500 10px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'oklch(0.95 0.008 80 / 0.7)', marginBottom: 6 }}>
                    {b.genre || 'Без жанра'}
                  </div>
                  <div style={{ font: '600 22px var(--font-serif)', color: 'oklch(0.97 0.01 80)', letterSpacing: '-0.01em', lineHeight: 1.15 }}>{b.title}</div>
                  {b.author && (
                    <div style={{ font: '400 11px var(--font-mono)', color: 'oklch(0.97 0.01 80 / 0.6)', marginTop: 6, letterSpacing: '0.06em' }}>{b.author}</div>
                  )}
                </div>
                <div style={{ padding: '14px 20px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                    <span>{b.words.toLocaleString('ru')} / {b.goal.toLocaleString('ru')}</span>
                    <span>{Math.round((b.words / Math.max(1, b.goal)) * 100)}%</span>
                  </div>
                  <div style={{ height: 3, background: 'var(--surface-2)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                    <div style={{ width: `${(b.words / Math.max(1, b.goal)) * 100}%`, height: '100%', background: b.words > 0 ? 'var(--accent)' : 'var(--ink-4)' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-3)' }}>
                    <span>{dayDiff(b.created_at)} дн. в работе</span>
                    <span>изм. {formatDate(b.updated_at)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'oklch(0.10 0.012 50 / 0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={() => setShowCreate(false)}>
          <form
            onSubmit={onCreate}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 460, background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px' }}
          >
            <h2 style={{ font: '600 22px var(--font-serif)', marginBottom: 16 }}>Новая книга</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Название</label>
                <input className="input" name="title" required autoFocus />
              </div>
              <div>
                <label className="label">Жанр</label>
                <input className="input" name="genre" placeholder="например, тёмное фэнтези" />
              </div>
              <div>
                <label className="label">Цель по словам</label>
                <input className="input" name="goal" type="number" min={1000} step={1000} defaultValue={80000} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 22 }}>
              <button type="button" className="btn btn--ghost" onClick={() => setShowCreate(false)}>Отмена</button>
              <button type="submit" className="btn btn--primary">Создать</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
