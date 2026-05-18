import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

interface PublicStats {
  users_total: number;
  books_total: number;
  words_total: number;
}

const FEATURES = [
  {
    title: 'Умный редактор',
    desc: 'Rich-форматирование, focus-режим без отвлечений, split-view для сверки источников. TipTap под капотом.',
  },
  {
    title: 'Живые персонажи',
    desc: 'Досье с внешностью, биографией и связями. Каждый персонаж привязан к главам, где появляется.',
  },
  {
    title: 'Карта мира',
    desc: 'Добавляйте локации с координатами и описанием. Места истории — на одном экране.',
  },
  {
    title: 'Хронология',
    desc: 'Лента событий с датами и участниками. Держите порядок в сложных временных линиях.',
  },
  {
    title: 'Структура книги',
    desc: 'Карточки глав с аннотациями, статусами и drag-and-drop. Пробковая доска для планирования.',
  },
  {
    title: 'Экспорт',
    desc: 'Выгрузка текста в TXT и Markdown. DOCX и EPUB — в разработке.',
  },
];

export default function Landing() {
  const { session } = useAuth();
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    supabase.rpc('get_public_stats').then(({ data }) => {
      if (data) setStats(data as PublicStats);
    });
  }, []);

  if (session) return <Navigate to="/books" replace />;

  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg-deep)', color: 'var(--ink)' }}>
      <LandingNav />

      {/* Hero */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(64px, 12vw, 120px) 32px clamp(48px, 8vw, 80px)' }}>
        <div style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 20 }}>
          Редактор для писателей · 2026
        </div>

        <h1 style={{ font: '600 clamp(42px, 8vw, 80px)/1.04 var(--font-serif)', letterSpacing: '-0.025em', margin: '0 0 28px', maxWidth: 720 }}>
          Здесь<br />пишутся книги.
        </h1>

        <p style={{ font: '400 18px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 560, margin: '0 0 40px' }}>
          Один строит миры: карта локаций, живые персонажи, хронология событий. Другому нужна только тишина и чистый лист.
          Авторская студия не навязывает стиль — берите столько инструментов, сколько нужно.
        </p>

        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/login"
            className="btn btn--primary"
            style={{ height: 46, padding: '0 28px', fontSize: 15, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            Начать бесплатно
          </Link>
          <Link
            to="/login"
            className="btn btn--ghost"
            style={{ height: 46, padding: '0 20px', fontSize: 15, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
          >
            Войти
          </Link>
        </div>

        {stats && (
          <div style={{ display: 'flex', gap: 36, marginTop: 52, paddingTop: 28, borderTop: '1px solid var(--border-soft)' }}>
            <StatCell value={stats.users_total.toLocaleString('ru')} label={pluralRu(stats.users_total, 'автор', 'автора', 'авторов')} />
            <StatCell value={stats.books_total.toLocaleString('ru')} label={pluralRu(stats.books_total, 'книга написана', 'книги написано', 'книг написано')} />
            <StatCell value={formatWords(stats.words_total)} label={wordsLabel(stats.words_total)} />
          </div>
        )}
      </section>

      {/* Features */}
      <section style={{ background: 'var(--bg)', borderTop: '1px solid var(--border-soft)', borderBottom: '1px solid var(--border-soft)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(48px, 8vw, 80px) 32px' }}>
          <h2 style={{ font: '600 clamp(22px, 4vw, 32px) var(--font-serif)', letterSpacing: '-0.015em', margin: '0 0 40px' }}>
            Всё что нужно писателю
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 2 }}>
            {FEATURES.map((f) => (
              <div key={f.title} style={{ padding: '24px 28px', background: 'var(--surface)', borderRadius: 'var(--r-2)' }}>
                <div style={{ font: '500 14px var(--font-ui)', color: 'var(--ink)', marginBottom: 8 }}>{f.title}</div>
                <div style={{ font: '400 13px/1.6 var(--font-ui)', color: 'var(--ink-3)' }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(56px, 10vw, 96px) 32px', textAlign: 'center' }}>
        <h2 style={{ font: '600 clamp(26px, 5vw, 42px)/1.1 var(--font-serif)', letterSpacing: '-0.02em', margin: '0 0 16px' }}>
          Начните сегодня.
        </h2>
        <p style={{ font: '400 16px var(--font-serif)', color: 'var(--ink-3)', margin: '0 0 32px' }}>
          Бесплатно. Без ограничений по времени.
        </p>
        <Link
          to="/login"
          className="btn btn--primary"
          style={{ height: 46, padding: '0 32px', fontSize: 15, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
        >
          Создать аккаунт
        </Link>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid var(--border-soft)', padding: '20px 32px', textAlign: 'center' }}>
        <span style={{ font: '400 12px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.06em' }}>
          © 2026 Авторская студия
        </span>
      </footer>
    </div>
  );
}

function LandingNav() {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'oklch(0.165 0.012 50 / 0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-soft)', padding: '0 32px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 14, height: 18, background: 'var(--accent)', borderRadius: '1px 3px 3px 1px', position: 'relative', flexShrink: 0 }}>
            <span style={{ position: 'absolute', inset: 3, border: '0.5px solid oklch(0.98 0 0 / 0.5)' }} />
          </span>
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>
            авторская студия
          </span>
        </div>
        <Link
          to="/login"
          className="btn"
          style={{ height: 34, padding: '0 16px', fontSize: 13, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
        >
          Войти
        </Link>
      </div>
    </nav>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ font: '500 22px var(--font-serif)', color: 'var(--ink)' }}>{value}</div>
      <div style={{ font: '400 11px var(--font-mono)', color: 'var(--ink-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 2 }}>{label}</div>
    </div>
  );
}

function formatWords(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace('.', ',')} млрд`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} млн`;
  return n.toLocaleString('ru');
}

function pluralRu(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(Math.round(n)) % 100;
  const rem = abs % 10;
  if (abs >= 11 && abs <= 19) return many;
  if (rem === 1) return one;
  if (rem >= 2 && rem <= 4) return few;
  return many;
}

function wordsLabel(n: number): string {
  if (n >= 1_000_000) return 'слов';
  return pluralRu(n, 'слово', 'слова', 'слов');
}
