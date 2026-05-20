import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { Icon } from './Icon';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { applyTheme, getStoredTheme, type Theme } from '../lib/theme';

type Plan = 'free' | 'pro' | 'lifetime';

const PLAN_META: Record<Plan, { name: string; desc: string }> = {
  free:     { name: 'Бесплатный план', desc: '1 книга · базовый редактор · без экспорта' },
  pro:      { name: 'Pro',             desc: 'Безлимит книг · все функции · экспорт' },
  lifetime: { name: 'Lifetime',        desc: 'Безлимит книг · все функции · навсегда' },
};

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user, signOut, updatePassword } = useAuth();
  const [name, setName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSaved, setPassSaved] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [plan, setPlan] = useState<Plan>('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from('profiles').select('plan, plan_expires_at').eq('user_id', user.id).single()
      .then(({ data }) => {
        if (data?.plan) setPlan(data.plan as Plan);
        if (data?.plan_expires_at) setPlanExpiresAt(data.plan_expires_at as string);
      });
  }, [user]);

  const handleTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSaveName = async () => {
    setNameSaving(true); setNameError(null);
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim() } });
      if (error) setNameError(error.message);
      else setNameSaved(true);
    } finally {
      setNameSaving(false);
    }
  };

  const handleSavePass = async () => {
    if (newPass.length < 6) { setPassError('Минимум 6 символов'); return; }
    setPassSaving(true); setPassError(null);
    try {
      const { error } = await updatePassword(newPass);
      if (error) setPassError(error);
      else { setPassSaved(true); setNewPass(''); }
    } finally {
      setPassSaving(false);
    }
  };

  const SL: CSSProperties = { font: '500 10.5px var(--font-mono)', color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: 10 };
  const FL: CSSProperties = { font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 4 };
  const HR: CSSProperties = { border: 'none', borderTop: '1px solid var(--border-soft)', margin: '14px 0' };
  const FG: CSSProperties = { display: 'flex', flexDirection: 'column' };
  const ROW: CSSProperties = { display: 'flex', gap: 8 };
  const BTN: CSSProperties = { fontSize: 13, padding: '0 14px', flexShrink: 0, minWidth: 88 };

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 14, width: 440, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 32px 80px rgba(0,0,0,0.55)', display: 'flex', flexDirection: 'column' }}>

        <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 16px', borderBottom: '1px solid var(--border-soft)' }}>
          <span style={{ font: '600 14px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Настройки</span>
          <span style={{ flex: 1 }} />
          <button className="tb-btn" onClick={onClose} style={{ fontSize: 20, lineHeight: 1, padding: '0 6px', color: 'var(--ink-4)' }}>×</button>
        </div>

        <div style={{ padding: '18px 24px 16px', display: 'flex', flexDirection: 'column' }}>

          <section>
            <div style={SL}>Профиль</div>
            <div style={{ ...FG, gap: 10 }}>
              <div style={FG}>
                <span style={FL}>Имя</span>
                <div style={ROW}>
                  <input className="input" value={name} onChange={(e) => { setName(e.target.value); setNameSaved(false); }} placeholder="Ваше имя" style={{ flex: 1, fontSize: 13 }} />
                  <button className="btn btn--primary" style={BTN} onClick={handleSaveName} disabled={nameSaving || !name.trim()}>
                    {nameSaving ? '…' : nameSaved ? '✓' : 'Сохранить'}
                  </button>
                </div>
                {nameError && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', marginTop: 6 }}>{nameError}</span>}
              </div>
              <div style={FG}>
                <span style={FL}>Email</span>
                <input className="input" value={user?.email ?? ''} readOnly style={{ fontSize: 13, opacity: 0.5, cursor: 'default' }} />
              </div>
            </div>
          </section>

          <hr style={HR} />

          <section>
            <div style={SL}>Безопасность</div>
            <div style={FG}>
              <span style={FL}>Новый пароль</span>
              <div style={ROW}>
                <input className="input" type="password" value={newPass} onChange={(e) => { setNewPass(e.target.value); setPassSaved(false); setPassError(null); }} placeholder="Минимум 6 символов" style={{ flex: 1, fontSize: 13 }} />
                <button className="btn btn--primary" style={BTN} onClick={handleSavePass} disabled={passSaving || !newPass}>
                  {passSaving ? '…' : passSaved ? '✓' : 'Сменить'}
                </button>
              </div>
              {passError && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', marginTop: 6 }}>{passError}</span>}
              {passSaved && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ok)', marginTop: 6 }}>Пароль изменён</span>}
            </div>
          </section>

          <hr style={HR} />

          <section>
            <div style={SL}>Интерфейс</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={FL}>Тема</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  onClick={() => handleTheme('dark')}
                  className={'btn' + (theme === 'dark' ? ' btn--primary' : ' btn--ghost')}
                  style={{ fontSize: 12, gap: 5 }}
                >
                  <Icon name="moon" size={13} /> Тёмная
                </button>
                <button
                  onClick={() => handleTheme('light')}
                  className={'btn' + (theme === 'light' ? ' btn--primary' : ' btn--ghost')}
                  style={{ fontSize: 12, gap: 5 }}
                >
                  <Icon name="sun" size={13} /> Светлая
                </button>
              </div>
            </div>
          </section>

          <hr style={HR} />

          <section>
            <div style={SL}>Подписка</div>
            <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>{PLAN_META[plan].name}</div>
                  <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{PLAN_META[plan].desc}</div>
                  {plan === 'pro' && planExpiresAt && (
                    <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)', marginTop: 4 }}>
                      Активна до {new Date(planExpiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>
              </div>
              {plan === 'free' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href="https://avtorskaya-studiya.vercel.app/#pricing"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn--primary"
                    style={{ fontSize: 12, padding: '5px 14px', textDecoration: 'none' }}
                  >
                    Апгрейд до Pro
                  </a>
                </div>
              )}
              {plan === 'pro' && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <a
                    href={`mailto:support@avtorskaya-studiya.ru?subject=Отмена подписки&body=Прошу отменить мою подписку Pro. Email аккаунта: ${user?.email ?? ''}`}
                    className="btn btn--ghost"
                    style={{ fontSize: 12, padding: '5px 12px', textDecoration: 'none', color: 'var(--ink-3)' }}
                  >
                    Отменить подписку
                  </a>
                </div>
              )}
            </div>
          </section>

          <hr style={HR} />

          <section>
            <button
              onClick={() => signOut()}
              style={{ width: '100%', fontSize: 13, padding: '9px 0', color: 'var(--danger)', background: 'transparent', border: '1px solid color-mix(in oklch, var(--danger) 45%, transparent)', borderRadius: 8, cursor: 'pointer', letterSpacing: '-0.01em', transition: 'background 0.15s, border-color 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in oklch, var(--danger) 10%, transparent)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            >Выйти из аккаунта</button>
          </section>

        </div>
      </div>
    </div>
  );
}
