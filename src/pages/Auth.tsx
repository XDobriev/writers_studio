import { Link } from 'react-router-dom';
import { useResponsive } from '../lib/useResponsive';
import { usePostAuthRedirect } from '../lib/usePostAuthRedirect';
import { useTelegramAuth } from '../lib/useTelegramAuth';
import { usePageMeta } from '../lib/usePageMeta';
import { LogoMark } from '../components/LogoMark';
import { AuthForm } from '../components/AuthForm';
import { PendingCheckoutPanel } from '../components/PendingCheckoutPanel';

export default function Auth() {
  const tgAuth = useTelegramAuth();
  const { redirectingToPay, pendingCheckout, confirmCheckout, cancelCheckout } = usePostAuthRedirect(tgAuth.busy);
  const { isMobile } = useResponsive();
  usePageMeta({
    title: 'Вход — Авторская студия',
    description: 'Войдите или создайте аккаунт. Email, Telegram, ВКонтакте.',
    path: '/login',
  });

  if (redirectingToPay) {
    return (
      <div className="as" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="btn-spinner" style={{ display: 'inline-block', marginBottom: 16 }} />
          <p style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-3)' }}>Переходим к оплате…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="as" style={{ minHeight: '100dvh', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.05fr 1fr', background: 'var(--bg)' }}>
      <div style={{ position: 'relative', padding: isMobile ? '32px 24px' : 'clamp(36px, 4.5vw, 56px) clamp(28px, 4.5vw, 64px)', background: 'var(--bg-deep)', borderRight: isMobile ? 'none' : '1px solid var(--border-soft)', borderBottom: isMobile ? '1px solid var(--border-soft)' : 'none', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: isMobile ? 32 : 0 }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', margin: '-10px 0', textDecoration: 'none' }}>
          <LogoMark size={20} />
          <span style={{ font: '500 11px var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--ink-2)' }}>авторская студия</span>
        </Link>

        <div>
          <div style={{ font: '500 10.5px var(--font-mono)', letterSpacing: '0.2em', color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 18 }}>Редактор для писателей · 2026</div>
          <h1 style={{ font: `600 ${isMobile ? '32px' : 'clamp(36px, 3.8vw, 52px)'}/1.06 var(--font-serif)`, letterSpacing: '-0.02em', marginBottom: 24 }}>
            Здесь пишете{isMobile ? ' ' : <br />}<em style={{ fontStyle: 'italic', fontWeight: 500, color: 'var(--accent-2)' }}>только вы</em>.
          </h1>
          <p style={{ font: '400 17px/1.65 var(--font-serif)', color: 'var(--ink-2)', maxWidth: 480 }}>
            Рукопись, картотека персонажей, карта мира и хронология — в одном чистом редакторе. Без нейросети, которая дописывает за вас.
          </p>
        </div>

        {!isMobile && (
          <div style={{ paddingTop: 24, borderTop: '1px solid var(--border-soft)' }}>
            <p style={{ font: '400 15px/1.6 var(--font-serif)', color: 'var(--ink-3)', fontStyle: 'italic', margin: 0 }}>
              «Писатель пишет, потому что не может не писать.»
            </p>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: isMobile ? '32px 24px' : 'clamp(32px, 4vw, 48px)' }}>
        {pendingCheckout
          ? <PendingCheckoutPanel plan={pendingCheckout.plan} error={pendingCheckout.error} onConfirm={confirmCheckout} onCancel={cancelCheckout} />
          : <AuthForm telegramAuth={tgAuth} />}
      </div>
    </div>
  );
}
