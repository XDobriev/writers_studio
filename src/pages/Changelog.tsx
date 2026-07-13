import { Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoMark';
import { usePageMeta } from '../lib/usePageMeta';

interface Entry {
  date: string;
  items: string[];
}

const ENTRIES: Entry[] = [
  {
    date: '30 июня 2026',
    items: [
      'Усилена защита данных аккаунта и платежей (внутренние улучшения безопасности).',
      'Иконки приложения для установки на телефон (PWA) приведены к стандартным размерам.',
    ],
  },
  {
    date: '29 июня 2026',
    items: [
      'Улучшена доступность интерфейса: подписи для кнопок без текста, фокус в модальных окнах.',
      'Исправлено отображение пробковой доски на мобильных экранах.',
    ],
  },
  {
    date: '28 июня 2026',
    items: [
      'Обложки книг, аватары персонажей и фоны карты теперь оптимизируются перед загрузкой — страницы открываются быстрее.',
      'Карта мира на главной странице стала более реалистичной (стиль пергамента).',
      'Добавлен значок установки приложения и иконка для мобильных устройств.',
      'Поправлены мелкие неровности вёрстки лендинга на узких экранах.',
    ],
  },
  {
    date: '27 июня 2026',
    items: [
      'Усилена защита служебных функций аккаунта от посторонних запросов.',
      'Убраны лишние анимации, ускоряющие первую отрисовку интерфейса.',
    ],
  },
];

export default function Changelog() {
  usePageMeta({
    title: 'История изменений — Авторская студия',
    description: 'Что нового в Авторской студии: обновления интерфейса, производительности и безопасности.',
    path: '/changelog',
  });
  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', padding: '56px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto', overflowWrap: 'break-word' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', margin: '-10px 0', textDecoration: 'none' }}>
            <LogoMark size={20} />
            <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
          </Link>
        </div>

        <h1 style={{ font: '600 36px/1.1 var(--font-serif)', letterSpacing: '-0.02em', marginBottom: 8 }}>
          История изменений
        </h1>
        <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 48 }}>
          Что обновилось в Авторской студии — от новых возможностей до улучшений под капотом.
        </p>

        {ENTRIES.map((entry) => (
          <section key={entry.date} style={{ marginBottom: 32 }}>
            <h2 style={{ font: '500 15px var(--font-ui)', color: 'var(--ink)', marginBottom: 10 }}>{entry.date}</h2>
            <ul style={{ font: '400 14px/1.7 var(--font-ui)', color: 'var(--ink-2)', margin: 0, paddingLeft: 20 }}>
              {entry.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
