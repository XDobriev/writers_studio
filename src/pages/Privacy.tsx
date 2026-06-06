import { Link } from 'react-router-dom';
import { LogoMark } from '../components/LogoMark';

export default function Privacy() {
  return (
    <div className="as" style={{ minHeight: '100vh', background: 'var(--bg)', padding: '56px 24px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 48 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <LogoMark size={20} />
            <span style={{ font: '500 12px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
          </Link>
        </div>

        <h1 style={{ font: '600 36px/1.1 var(--font-serif)', letterSpacing: '-0.02em', marginBottom: 8 }}>
          Политика обработки персональных данных
        </h1>
        <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 48 }}>
          Дата вступления в силу: 19 мая 2026 г.
        </p>

        <Section title="1. Оператор данных">
          <p>
            Физическое лицо (самозанятый, налог на профессиональный доход) <strong>Добриев Хамзат Юсупович</strong>, контактный адрес:{' '}
            <a href="mailto:frfrancuz@gmail.com" style={{ color: 'var(--accent)' }}>frfrancuz@gmail.com</a>.
            Сервис: <strong>Авторская студия</strong> (avtorstudio.com).
          </p>
        </Section>

        <Section title="2. Какие данные мы собираем">
          <p>Мы собираем только то, что необходимо для работы сервиса:</p>
          <ul>
            <li>Адрес электронной почты — при регистрации через email.</li>
            <li>Email и публичный профиль (имя, аватар) — при входе через Google OAuth, в объёме, который предоставляет Google.</li>
          </ul>
          <p>Мы не собираем платёжные данные, геолокацию, cookie-слежение или поведенческую аналитику.</p>
        </Section>

        <Section title="3. Цели обработки">
          <p>Данные используются исключительно для:</p>
          <ul>
            <li>аутентификации и идентификации пользователя в сервисе;</li>
            <li>обеспечения доступа к личным книгам и проектам.</li>
          </ul>
          <p>Данные не используются для рекламы, профилирования или передачи третьим лицам в коммерческих целях.</p>
        </Section>

        <Section title="4. Где хранятся данные">
          <p>
            Данные обрабатываются в инфраструктуре провайдера <strong>Supabase</strong> (supabase.com).
            Серверная инфраструктура Supabase расположена за пределами Российской Федерации.
            Передача персональных данных осуществляется в соответствии со статьёй 12 ФЗ-152
            о трансграничной передаче данных. Сервис ведёт работу по переносу первичного хранения
            данных на российскую инфраструктуру.
          </p>
        </Section>

        <Section title="5. Срок хранения">
          <p>
            Данные хранятся до тех пор, пока существует аккаунт пользователя. После удаления аккаунта
            все связанные данные удаляются в течение 30 дней.
          </p>
        </Section>

        <Section title="6. Передача данных третьим лицам">
          <p>
            Данные не передаются третьим лицам в коммерческих целях. В рамках технической работы
            сервиса данные обрабатываются следующими провайдерами:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> (supabase.com) — хранение данных и аутентификация.{' '}
              <a href="https://supabase.com/privacy" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                Политика конфиденциальности Supabase
              </a>.
            </li>
            <li>
              <strong>Sentry</strong> (sentry.io) — мониторинг технических ошибок. Получает
              технические данные (сессионные идентификаторы, стек вызовов) в объёме, необходимом
              для диагностики сбоев.{' '}
              <a href="https://sentry.io/privacy/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>
                Политика конфиденциальности Sentry
              </a>.
            </li>
          </ul>
          <p>
          </p>
        </Section>

        <Section title="7. Права пользователя">
          <p>Вы имеете право:</p>
          <ul>
            <li>запросить копию своих данных;</li>
            <li>потребовать исправления или удаления данных;</li>
            <li>отозвать согласие на обработку в любой момент.</li>
          </ul>
          <p>
            Для удаления аккаунта и всех данных напишите на{' '}
            <a href="mailto:frfrancuz@gmail.com?subject=Удаление аккаунта" style={{ color: 'var(--accent)' }}>
              frfrancuz@gmail.com
            </a>{' '}
            с темой «Удаление аккаунта» — данные будут удалены в течение 3 рабочих дней.
          </p>
        </Section>

        <Section title="8. Безопасность">
          <p>
            Пароли никогда не хранятся в открытом виде — только в виде хэша (bcrypt).
            Соединение с сервисом защищено TLS/HTTPS.
          </p>
        </Section>

        <Section title="9. Изменения политики">
          <p>
            При существенных изменениях мы уведомим пользователей по email не менее чем за 14 дней.
            Актуальная версия всегда доступна по адресу{' '}
            <strong>avtorstudio.com/privacy</strong>.
          </p>
        </Section>

        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border-soft)' }}>
          <Link
            to="/login"
            style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)', textDecoration: 'none' }}
          >
            ← Вернуться к входу
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ font: '500 15px var(--font-ui)', color: 'var(--ink)', marginBottom: 10 }}>{title}</h2>
      <div style={{ font: '400 14px/1.7 var(--font-ui)', color: 'var(--ink-2)' }}>
        {children}
      </div>
    </section>
  );
}
