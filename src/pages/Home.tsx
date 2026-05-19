import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/LogoMark';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { supabase, type Book } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL ?? '';

const COVERS = [
  '#7c1d1d', '#3d4a2e', '#1c3a4a', '#4a2e3c',
  '#2a4a3a', '#4a3a2a', '#1e2a4a', '#3a2a4a',
  '#4a2a1e', '#2a3a4a', '#1c4a32', '#4a1c3a',
];

const ONBOARDING_FEATURES = [
  { icon: 'feather' as const, title: 'Редактор глав', desc: 'Rich-text, фокусный режим, подсчёт слов в реальном времени' },
  { icon: 'user' as const, title: 'Персонажи', desc: 'Карточки героев, связи между персонажами, описания' },
  { icon: 'clock' as const, title: 'Хронология', desc: 'Все события книги на одной оси времени' },
  { icon: 'map' as const, title: 'Карта мира', desc: 'Локации и места действия' },
];

const isImageUrl = (v: string) => v.startsWith('http') || v.startsWith('blob:');

function CoverPicker({
  value, onChange, uploading, onFileSelect,
}: {
  value: string;
  onChange: (c: string) => void;
  uploading?: boolean;
  onFileSelect?: (f: File) => void;
}) {
  const hasImage = isImageUrl(value);
  return (
    <div>
      <label className="label">Обложка</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
        {COVERS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            style={{
              width: 36, height: 36, borderRadius: 8, cursor: 'pointer', padding: 0,
              background: `linear-gradient(160deg, ${c}, oklch(0.20 0.02 50))`,
              border: !hasImage && value === c ? '2px solid var(--accent)' : '2px solid transparent',
              outline: !hasImage && value === c ? '2px solid var(--accent)' : 'none',
              outlineOffset: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'outline 0.12s, border-color 0.12s',
            }}
          >
            {!hasImage && value === c && (
              <span style={{ color: 'oklch(0.97 0.01 80)', fontSize: 15, fontWeight: 700, lineHeight: 1 }}>✓</span>
            )}
          </button>
        ))}

        {onFileSelect && (
          <label
            title="Загрузить изображение"
            style={{
              width: 36, height: 36, borderRadius: 8, cursor: uploading ? 'default' : 'pointer',
              border: hasImage ? '2px solid var(--accent)' : '2px dashed var(--border)',
              outline: hasImage ? '2px solid var(--accent)' : 'none',
              outlineOffset: 2,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: hasImage ? `url(${value}) center/cover` : 'var(--surface-2)',
              color: 'var(--ink-3)',
              flexShrink: 0,
              transition: 'border-color 0.12s',
              position: 'relative', overflow: 'hidden',
            }}
          >
            {!hasImage && !uploading && <Icon name="camera" size={16} />}
            {uploading && (
              <span style={{ fontSize: 10, color: 'var(--ink-3)' }}>…</span>
            )}
            {hasImage && (
              <div style={{
                position: 'absolute', inset: 0,
                background: 'oklch(0 0 0 / 0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: 'white', fontSize: 15, fontWeight: 700 }}>✓</span>
              </div>
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFileSelect(f);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      {hasImage && (
        <button
          type="button"
          onClick={() => onChange(COVERS[0])}
          style={{ marginTop: 6, fontSize: 11, color: 'var(--ink-3)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          Удалить изображение
        </button>
      )}
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function dayDiff(iso: string): number {
  return Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

type Plan = 'free' | 'pro' | 'lifetime';

export default function Home() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[] | null>(null);
  const [plan, setPlan] = useState<Plan>('free');
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);

  const [editBook, setEditBook] = useState<Book | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editGenre, setEditGenre] = useState('');
  const [editGoal, setEditGoal] = useState(0);
  const [editCover, setEditCover] = useState(COVERS[0]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [createCover, setCreateCover] = useState(COVERS[0]);
  const [createUploading, setCreateUploading] = useState(false);
  const [editUploading, setEditUploading] = useState(false);
  const [confirmDeleteBook, setConfirmDeleteBook] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      const { error } = await supabase.from('books').delete().eq('id', editBook.id);
      if (error) throw error;
      setBooks((prev) => prev?.filter((b) => b.id !== editBook.id) ?? prev);
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
    setEditGenre(b.genre ?? '');
    setEditGoal(b.goal);
    setEditCover(b.cover ?? COVERS[0]);
    setEditError(null);
  };

  const saveEditBook = async () => {
    if (!editBook || !editTitle.trim()) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const { data, error } = await supabase
        .from('books')
        .update({ title: editTitle.trim(), genre: editGenre.trim() || null, goal: Math.max(0, editGoal), cover: editCover })
        .eq('id', editBook.id)
        .select()
        .single();
      if (error) throw error;
      setBooks((prev) => prev?.map((b) => b.id === editBook.id ? data as Book : b) ?? prev);
      setEditBook(null);
    } catch (e) {
      setEditError((e as Error).message);
    } finally {
      setEditSaving(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [booksRes, profileRes] = await Promise.all([
        supabase.from('books').select('*').order('updated_at', { ascending: false }),
        supabase.from('profiles').select('plan').eq('user_id', user!.id).single(),
      ]);
      if (cancelled) return;
      if (booksRes.error) setErr(booksRes.error.message);
      else setBooks((booksRes.data ?? []) as Book[]);
      if (profileRes.data) setPlan(profileRes.data.plan as Plan);
    })();
    return () => { cancelled = true; };
  }, [user]);

  useEffect(() => {
    if (books !== null && books.length === 0 && !localStorage.getItem('as_onboarding_done')) {
      setShowWelcome(true);
    }
  }, [books]);

  const handleWelcomeCreate = () => {
    localStorage.setItem('as_onboarding_done', '1');
    setShowWelcome(false);
    setShowCreate(true);
  };

  const dismissWelcome = () => {
    localStorage.setItem('as_onboarding_done', '1');
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
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get('title') ?? '').trim();
    const genre = String(fd.get('genre') ?? '').trim() || null;
    const goal = Number(fd.get('goal') ?? 80000) || 80000;
    if (!title) return;
    const { data, error } = await supabase
      .from('books')
      .insert({ user_id: user.id, title, genre, goal, words: 0, cover: createCover })
      .select()
      .single();
    if (error) {
      setErr(error.message);
      return;
    }
    setBooks((prev) => [data as Book, ...(prev ?? [])]);
    setShowCreate(false);
    setCreateCover(COVERS[0]);
  };

  const totalWords = (books ?? []).reduce((s, b) => s + b.words, 0);

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, borderBottom: '1px solid var(--border-soft)' }}>
        <LogoMark size={20} />
        <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        <span style={{ flex: 1 }} />
        <span className="hide-sm" style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}>{user?.email}</span>
        {user?.email === ADMIN_EMAIL && (
          <Link
            to="/admin"
            style={{
              font: '500 10px var(--font-mono)',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              textDecoration: 'none',
              padding: '3px 8px',
              border: '1px solid var(--accent)',
              borderRadius: 4,
              opacity: 0.75,
            }}
          >
            admin
          </Link>
        )}
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
            <button className="btn btn--primary" onClick={handleNewBookClick}>
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 32px', textAlign: 'center' }}>
            <div style={{
              width: 96, height: 120, marginBottom: 32, position: 'relative', flexShrink: 0,
            }}>
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
            <button className="btn btn--primary" style={{ height: 42, padding: '0 24px', fontSize: 14 }} onClick={handleNewBookClick}>
              <Icon name="plus" size={15} /> Создать книгу
            </button>
          </div>
        )}

        {books && books.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {books.map((b) => (
              <div
                key={b.id}
                style={{ position: 'relative' }}
                onMouseEnter={() => setHoveredId(b.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <Link to={`/books/${b.id}`} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border-soft)', overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none' }}>
                  <div style={{
                    height: 180,
                    ...(b.cover && isImageUrl(b.cover)
                      ? { backgroundImage: `url(${b.cover})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                      : { background: `linear-gradient(160deg, ${b.cover ?? '#3a3a4a'}, oklch(0.20 0.02 50))` }
                    ),
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                    padding: '18px 20px', borderBottom: '1px solid var(--border-soft)',
                    position: 'relative',
                  }}>
                    {b.cover && isImageUrl(b.cover) && (
                      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, oklch(0.08 0.01 50 / 0.85) 0%, transparent 55%)' }} />
                    )}
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
                    <div style={{ height: 3, background: 'var(--surface-3)', borderRadius: 999, overflow: 'hidden', marginBottom: 12 }}>
                      <div style={{ width: `${(b.words / Math.max(1, b.goal)) * 100}%`, minWidth: 4, height: '100%', background: b.words > 0 ? 'var(--accent)' : 'var(--ink-4)' }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--ink-3)' }}>
                      <span>{dayDiff(b.created_at)} дн. в работе</span>
                      <span>изм. {formatDate(b.updated_at)}</span>
                    </div>
                  </div>
                </Link>
                <button
                  onClick={() => openEditBook(b)}
                  title="Редактировать"
                  style={{
                    position: 'absolute', top: 10, right: 10, zIndex: 1,
                    width: 28, height: 28, borderRadius: 6,
                    background: 'oklch(0.12 0.01 50 / 0.70)',
                    border: '1px solid oklch(1 0 0 / 0.12)',
                    backdropFilter: 'blur(6px)',
                    cursor: 'pointer',
                    display: hoveredId === b.id ? 'flex' : 'none',
                    alignItems: 'center', justifyContent: 'center',
                    color: 'oklch(0.95 0.01 80)',
                  }}
                >
                  <Icon name="pencil" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {editBook && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'oklch(0 0 0 / 0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEditBook(null)}
        >
          <div
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 14, padding: '24px 28px', width: 460, display: 'flex', flexDirection: 'column', gap: 18, boxShadow: '0 24px 60px rgba(0,0,0,0.4)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ font: '600 20px var(--font-serif)' }}>Редактировать книгу</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label">Название</label>
                <input
                  className="input"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveEditBook(); if (e.key === 'Escape') setEditBook(null); }}
                  autoFocus
                />
              </div>
              <div>
                <label className="label">Жанр</label>
                <input
                  className="input"
                  value={editGenre}
                  onChange={(e) => setEditGenre(e.target.value)}
                  placeholder="Фэнтези, Детектив, Роман…"
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditBook(null); }}
                />
              </div>
              <div>
                <label className="label">Цель по словам</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  step={1000}
                  value={editGoal}
                  onChange={(e) => setEditGoal(Number(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Escape') setEditBook(null); }}
                />
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
                onClick={() => setConfirmDeleteBook(true)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: '400 13px var(--font-ui)', color: 'var(--danger)', padding: '4px 0', opacity: 0.8 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.8'; }}
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

      {showUpgrade && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'oklch(0 0 0 / 0.55)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowUpgrade(false)}
        >
          <div
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 16, padding: '32px 36px', width: 480, display: 'flex', flexDirection: 'column', gap: 24, boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
            onClick={(e) => e.stopPropagation()}
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
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, font: '400 13.5px var(--font-ui)', color: 'var(--ink-2)' }}>
                  <span style={{ width: 18, height: 18, borderRadius: 999, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 11, color: 'oklch(0.98 0 0)', fontWeight: 600 }}>
                    ✓
                  </span>
                  {f}
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border-soft)', paddingTop: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ font: '600 28px var(--font-serif)', letterSpacing: '-0.02em' }}>390 ₽<span style={{ font: '400 14px var(--font-ui)', color: 'var(--ink-3)', letterSpacing: 0 }}>/мес</span></div>
                <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginTop: 2 }}>или 2 900 ₽/год — экономия 40%</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn--ghost" onClick={() => setShowUpgrade(false)}>Отмена</button>
                <button className="btn btn--primary" style={{ opacity: 0.5, cursor: 'not-allowed' }} disabled>Скоро</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showWelcome && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'oklch(0 0 0 / 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={dismissWelcome}
        >
          <div
            role="dialog"
            aria-modal="true"
            style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)', borderRadius: 18, padding: '36px 40px', width: 520, maxWidth: 'calc(100vw - 32px)', display: 'flex', flexDirection: 'column', boxShadow: '0 32px 80px oklch(0 0 0 / 0.55)' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === 'Escape') dismissWelcome(); }}
            tabIndex={-1}
          >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: 28 }}>
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
                <div key={title} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '10px 12px', borderRadius: 10, background: 'var(--surface)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: 'var(--accent)' }}>
                    <Icon name={icon} size={16} />
                  </div>
                  <div>
                    <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink-1)', marginBottom: 2 }}>{title}</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn--primary" style={{ flex: 1, height: 42, fontSize: 14 }} onClick={handleWelcomeCreate}>
                <Icon name="plus" size={15} /> Создать первую книгу
              </button>
              <button className="btn btn--ghost" style={{ height: 42, padding: '0 18px', fontSize: 14 }} onClick={dismissWelcome}>
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
              <CoverPicker
                value={createCover}
                onChange={setCreateCover}
                uploading={createUploading}
                onFileSelect={(f) => uploadCover(f, setCreateCover, setCreateUploading)}
              />
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
