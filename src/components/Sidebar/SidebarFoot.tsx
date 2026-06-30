import { useUserDisplay } from '../../lib/useUserDisplay';
import { Icon } from '../Icon';
import { AccountMenu } from '../AccountMenu';

const PLAN_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  lifetime: 'Lifetime',
};

export function SidebarFoot() {
  const { displayName, initials, avatarUrl, plan, planLoaded } = useUserDisplay();

  return (
    <AccountMenu placement="above">
      {({ onClick, open, signingOut }) => (
        <button
          type="button"
          className="sb-foot"
          aria-label="Аккаунт"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={onClick}
        >
          <div className="sb-avatar" style={signingOut ? { opacity: 0.5 } : undefined}>
            {avatarUrl
              ? <img src={avatarUrl} alt={displayName} referrerPolicy="no-referrer" loading="lazy" decoding="async" />
              : initials
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sb-foot-name" title={displayName || undefined}>
              {displayName ? (displayName.includes('@') ? displayName.split('@')[0] : displayName) : '—'}
            </div>
            <div className="sb-foot-meta">{planLoaded ? (PLAN_LABEL[plan] ?? plan) : '…'}</div>
          </div>
          <span style={{ color: 'var(--ink-4)', flexShrink: 0, transition: 'transform 0.12s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', display: 'flex' }}>
            <Icon name="chevd" size={12} />
          </span>
        </button>
      )}
    </AccountMenu>
  );
}
