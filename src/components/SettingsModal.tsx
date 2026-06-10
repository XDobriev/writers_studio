import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { overlayVariants, modalPanelVariants } from '../lib/motion';
import { Icon } from './Icon';
import { supabase } from '../lib/supabase';
import { getProfile, getLifetimeSlotsRemaining } from '../lib/profiles';
import { useAuth } from '../lib/auth';
import { applyTheme, getStoredTheme, type Theme } from '../lib/theme';
import { EDITOR_FONTS, getStoredEditorFont, applyEditorFont, EDITOR_FONT_EVENT, type EditorFontId } from '../lib/editorFont';
import { EDITOR_SHORTCUTS, shortcutLabel } from '../lib/shortcuts';

type Plan = 'free' | 'pro' | 'lifetime';
type Tab = 'profile' | 'interface' | 'subscription';

const PLAN_META: Record<Plan, { name: string; desc: string }> = {
  free:     { name: 'Бесплатный план', desc: '1 книга · базовый редактор · без экспорта' },
  pro:      { name: 'Pro',             desc: 'Безлимит книг · все функции · экспорт' },
  lifetime: { name: 'Lifetime',        desc: 'Безлимит книг · все функции · навсегда' },
};

const PRO_FEATURES = [
  'Безлимитное количество книг',
  'Полный экспорт (PDF, DOCX, ePub)',
  'Хронология и карта мира',
  'Соавторство с редактором',
  'Приоритетная поддержка',
];

function UpgradeModal({ onClose }: { onClose: () => void }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [lifetimeSlots, setLifetimeSlots] = useState<number | null>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    getLifetimeSlotsRemaining().then((slots) => {
      if (slots !== null) setLifetimeSlots(slots);
    });
  }, []);

  const showLifetime = lifetimeSlots !== null && lifetimeSlots > 0;

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'oklch(0 0 0 / 0.55)', backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Перейти на Pro"
        style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 14, width: 360, maxWidth: '100%',
          boxShadow: '0 32px 80px oklch(0.05 0.01 50 / 0.55)', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '20px 24px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ font: '600 16px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.01em', marginBottom: 3 }}>
                Перейти на Pro
              </div>
              <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>
                Полный доступ ко всем функциям редактора
              </div>
            </div>
            <button
              className="tb-btn"
              onClick={onClose}
              style={{ fontSize: 20, lineHeight: 1, padding: '0 6px', color: 'var(--ink-4)', flexShrink: 0 }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {PRO_FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ color: 'var(--ok)', fontSize: 13, flexShrink: 0, lineHeight: 1 }}>✓</span>
                <span style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-2)' }}>{f}</span>
              </div>
            ))}
          </div>

          <div style={{
            background: 'var(--surface)', borderRadius: 10,
            padding: '12px 14px', marginBottom: 16,
            display: 'flex', alignItems: 'baseline', gap: 6,
          }}>
            <span style={{ font: '700 26px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.03em' }}>290 ₽</span>
            <span style={{ font: '400 13px var(--font-ui)', color: 'var(--ink-4)' }}>/ месяц</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <a
              href="https://avtorskaya-studiya.vercel.app/#pricing"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn--primary"
              style={{
                textDecoration: 'none', justifyContent: 'center', fontSize: 13,
                height: 38, display: 'flex', alignItems: 'center',
              }}
            >
              Оформить подписку
            </a>
            <button className="btn btn--ghost" onClick={onClose} style={{ fontSize: 13, height: 38 }}>
              Позже
            </button>
          </div>

          {showLifetime && (
            <div style={{ borderTop: '1px solid var(--border-soft)', marginTop: 16, paddingTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div>
                  <span style={{ font: '600 14px var(--font-ui)', color: 'var(--ink)' }}>Lifetime</span>
                  <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)', marginLeft: 8 }}>один раз · навсегда</span>
                </div>
                <span style={{
                  font: '500 10px var(--font-mono)', letterSpacing: '0.08em',
                  color: 'var(--accent)', background: 'var(--accent-soft)',
                  border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                  borderRadius: 5, padding: '2px 7px',
                }}>
                  {lifetimeSlots} мест
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
                <span style={{ font: '700 22px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.03em' }}>4 990 ₽</span>
                <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>разовый платёж</span>
              </div>
              <a
                href="https://avtorskaya-studiya.vercel.app/#pricing"
                target="_blank"
                rel="noopener noreferrer"
                className="btn"
                style={{
                  textDecoration: 'none', justifyContent: 'center', fontSize: 13,
                  height: 36, display: 'flex', alignItems: 'center', width: '100%',
                }}
              >
                Купить Lifetime
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, signOut, updatePassword } = useAuth();
  const isTelegram = user?.user_metadata?.provider === 'telegram';
  const accountLabel = isTelegram ? 'Telegram' : 'Email';
  const accountDisplay = isTelegram
    ? (user?.user_metadata?.telegram_username ? `@${user.user_metadata.telegram_username}` : `Telegram ID: ${user?.user_metadata?.telegram_id ?? ''}`)
    : (user?.email ?? '');

  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [helpOpen, setHelpOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [name, setName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.user_metadata?.first_name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSaved, setPassSaved] = useState(false);
  const [theme, setTheme] = useState<Theme>(getStoredTheme);
  const [activeFont, setActiveFont] = useState<EditorFontId>(getStoredEditorFont);
  const [plan, setPlan] = useState<Plan>('free');
  const [planExpiresAt, setPlanExpiresAt] = useState<string | null>(null);
  const [grandfathered, setGrandfathered] = useState(false);
  const [planLoaded, setPlanLoaded] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    getProfile(user.id).then((profile) => {
      if (profile?.plan) setPlan(profile.plan as Plan);
      if (profile?.plan_expires_at) setPlanExpiresAt(profile.plan_expires_at);
      if (profile?.grandfathered) setGrandfathered(true);
      setPlanLoaded(true);
    });
  }, [user]);

  const handleTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const handleFont = (id: EditorFontId) => {
    setActiveFont(id);
    applyEditorFont(id);
  };

  useEffect(() => {
    const handler = (e: Event) => setActiveFont((e as CustomEvent<EditorFontId>).detail);
    window.addEventListener(EDITOR_FONT_EVENT, handler);
    return () => window.removeEventListener(EDITOR_FONT_EVENT, handler);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>('button, input, a[href]');
    firstFocusable?.focus();
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

  const FL: CSSProperties = { font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 4 };
  const FG: CSSProperties = { display: 'flex', flexDirection: 'column' };
  const ROW: CSSProperties = { display: 'flex', gap: 8 };
  const H = 38;

  const TABS: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Профиль' },
    { key: 'interface', label: 'Интерфейс' },
    { key: 'subscription', label: 'Подписка' },
  ];

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            ref={overlayRef}
            variants={overlayVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(3px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
          >
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Настройки"
          variants={modalPanelVariants}
          style={{
            background: 'var(--bg)', border: '1px solid var(--border)',
            borderRadius: 14, width: 440, maxWidth: '100%', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 32px 80px oklch(0.05 0.01 50 / 0.55)',
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Tab') return;
            const focusable = dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? [];
            const arr = Array.from(focusable);
            if (!arr.length) return;
            const first = arr[0];
            const last = arr[arr.length - 1];
            if (e.shiftKey ? document.activeElement === first : document.activeElement === last) {
              e.preventDefault();
              (e.shiftKey ? last : first).focus();
            }
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '18px 24px 0', flexShrink: 0 }}>
            <span style={{ font: '600 14px var(--font-ui)', color: 'var(--ink)', letterSpacing: '-0.01em' }}>Настройки</span>
            <span style={{ flex: 1 }} />
            <button className="tb-btn" onClick={onClose} style={{ fontSize: 20, lineHeight: 1, padding: '0 6px', color: 'var(--ink-4)' }}>×</button>
          </div>

          {/* Tab bar */}
          <div style={{
            display: 'flex', padding: '12px 24px 0',
            borderBottom: '1px solid var(--border-soft)', flexShrink: 0,
          }}>
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                style={{
                  font: activeTab === t.key ? '500 13px var(--font-ui)' : '400 13px var(--font-ui)',
                  color: activeTab === t.key ? 'var(--ink)' : 'var(--ink-4)',
                  background: 'none', border: 'none',
                  borderBottom: activeTab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                  padding: '0 2px 10px', marginRight: 20, cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                  letterSpacing: '-0.01em', flexShrink: 0,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>

            {activeTab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={FG}>
                  <span style={FL}>Имя</span>
                  <div style={ROW}>
                    <input
                      className="input"
                      value={name}
                      onChange={(e) => { setName(e.target.value); setNameSaved(false); }}
                      placeholder="Ваше имя"
                      style={{ flex: 1, fontSize: 13, height: H }}
                    />
                    <button
                      className="btn btn--primary"
                      style={{ fontSize: 13, padding: '0 14px', height: H, flexShrink: 0, minWidth: 88 }}
                      onClick={handleSaveName}
                      disabled={nameSaving || !name.trim()}
                    >
                      {nameSaving ? '…' : nameSaved ? '✓' : 'Сохранить'}
                    </button>
                  </div>
                  {nameError && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', marginTop: 6 }}>{nameError}</span>}
                </div>

                <div style={FG}>
                  <span style={FL}>{accountLabel}</span>
                  <input
                    className="input"
                    value={accountDisplay}
                    readOnly
                    style={{ fontSize: 13, height: H, opacity: 0.5, cursor: 'default' }}
                  />
                </div>

                {!isTelegram && (
                  <form style={FG} onSubmit={(e) => { e.preventDefault(); handleSavePass(); }}>
                    <span style={FL}>Новый пароль</span>
                    <div style={ROW}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          className="input"
                          type={showPass ? 'text' : 'password'}
                          value={newPass}
                          onChange={(e) => { setNewPass(e.target.value); setPassSaved(false); setPassError(null); }}
                          placeholder="Минимум 6 символов"
                          style={{ width: '100%', fontSize: 13, height: H, paddingRight: 36 }}
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(v => !v)}
                          style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--ink-4)', padding: 0 }}
                          tabIndex={-1}
                          aria-label={showPass ? 'Скрыть пароль' : 'Показать пароль'}
                        >
                          <Icon name={showPass ? 'eye-off' : 'eye'} size={15} />
                        </button>
                      </div>
                      <button
                        type="submit"
                        className="btn btn--primary"
                        style={{ fontSize: 13, padding: '0 14px', height: H, flexShrink: 0, minWidth: 88 }}
                        disabled={passSaving || !newPass}
                      >
                        {passSaving ? '…' : passSaved ? '✓' : 'Сменить'}
                      </button>
                    </div>
                    {passError && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--danger)', marginTop: 6 }}>{passError}</span>}
                    {passSaved && <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ok)', marginTop: 6 }}>Пароль изменён</span>}
                  </form>
                )}

                <button
                  className="settings-signout-btn"
                  onClick={() => signOut()}
                >
                  Выйти из аккаунта
                </button>
              </div>
            )}

            {activeTab === 'interface' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>Тема</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>Оформление интерфейса</div>
                  </div>
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

                <div style={{ height: 1, background: 'var(--border-soft)' }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div>
                    <div style={{ font: '500 13px var(--font-ui)', color: 'var(--ink)', marginBottom: 2 }}>Шрифт редактора</div>
                    <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>Используется при наборе текста</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'nowrap' }}>
                    {EDITOR_FONTS.map(f => (
                      <button
                        key={f.id}
                        onClick={() => handleFont(f.id)}
                        style={{
                          fontFamily: f.family,
                          fontSize: 13,
                          padding: '0 12px',
                          height: 30,
                          borderRadius: 7,
                          border: activeFont === f.id ? '1px solid var(--accent)' : '1px solid var(--border-soft)',
                          background: activeFont === f.id ? 'var(--accent-soft)' : 'transparent',
                          color: activeFont === f.id ? 'var(--ink)' : 'var(--ink-3)',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'border-color 0.13s, background 0.12s, color 0.12s',
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div style={{
                    background: 'var(--bg-deep)',
                    border: '1px solid var(--border-soft)',
                    borderRadius: 10,
                    padding: '12px 14px',
                  }}>
                    <div style={{ font: '500 10px var(--font-mono)', letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 8 }}>
                      {EDITOR_FONTS.find(f => f.id === activeFont)?.fullName} · предпросмотр
                    </div>
                    <div style={{ fontFamily: EDITOR_FONTS.find(f => f.id === activeFont)?.family, fontSize: 17, lineHeight: 1.78, color: 'var(--ink-2)', transition: 'font-family 0.2s ease' }}>
                      Она вошла тихо, как входят люди, которые боятся спугнуть что-то хрупкое.{' '}
                      <em>Письмо было всё ещё на столе.</em>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ background: 'var(--surface)', borderRadius: 10, padding: '14px 16px' }}>
                  {!planLoaded
                    ? <div style={{ height: 52, borderRadius: 6, background: 'var(--surface-2)' }} />
                    : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                          <div>
                            <div style={{ font: '600 14px var(--font-ui)', color: 'var(--ink)', marginBottom: 3 }}>{PLAN_META[plan].name}</div>
                            <div style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-4)' }}>{PLAN_META[plan].desc}</div>
                            {plan === 'pro' && planExpiresAt && (
                              <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ink-4)', marginTop: 5 }}>
                                Активна до {new Date(planExpiresAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                              </div>
                            )}
                            {plan === 'pro' && grandfathered && (
                              <div style={{ font: '400 11px var(--font-ui)', color: 'var(--ok)', marginTop: 5, display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span>✦</span>
                                <span>Ранняя цена · 290 ₽/мес навсегда</span>
                              </div>
                            )}
                          </div>
                          {plan !== 'free' && (
                            <span style={{
                              font: '500 10.5px var(--font-mono)', color: 'var(--accent)',
                              background: 'var(--accent-soft)',
                              border: '1px solid color-mix(in oklch, var(--accent) 30%, transparent)',
                              borderRadius: 6, padding: '3px 8px', letterSpacing: '0.06em', textTransform: 'uppercase',
                              whiteSpace: 'nowrap', flexShrink: 0,
                            }}>
                              {plan === 'lifetime' ? 'Lifetime' : 'Pro'}
                            </span>
                          )}
                        </div>

                        {plan === 'free' && (
                          <button
                            className="btn btn--primary"
                            onClick={() => setUpgradeOpen(true)}
                            style={{ fontSize: 13, height: H }}
                          >
                            Апгрейд до Pro
                          </button>
                        )}

                        {plan === 'pro' && (
                          <a
                            href={`mailto:support@avtorskaya-studiya.ru?subject=Отмена подписки&body=Прошу отменить мою подписку Pro. Email аккаунта: ${user?.email ?? ''}`}
                            className="btn btn--ghost"
                            style={{ fontSize: 12, padding: '5px 12px', textDecoration: 'none', color: 'var(--ink-3)' }}
                          >
                            Отменить подписку
                          </a>
                        )}
                      </div>
                    )
                  }
                </div>
              </div>
            )}
          </div>

          {/* Help collapsible */}
          <div style={{ borderTop: '1px solid var(--border-soft)', padding: '0 24px', flexShrink: 0 }}>
            <button
              onClick={() => setHelpOpen(v => !v)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '13px 0',
                font: '500 10.5px var(--font-mono)',
                color: 'var(--ink-4)', letterSpacing: '0.09em', textTransform: 'uppercase',
              }}
            >
              Помощь
              <span style={{ transition: 'transform 0.15s', transform: helpOpen ? 'rotate(180deg)' : 'rotate(0deg)', display: 'flex' }}>
                <Icon name="chevd" size={12} />
              </span>
            </button>
            {helpOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 14 }}>
                {EDITOR_SHORTCUTS.map((s) => (
                  <div
                    key={s.label}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}
                  >
                    <span style={{ font: '400 12px var(--font-ui)', color: 'var(--ink-3)' }}>{s.label}</span>
                    <kbd style={{
                      font: '500 11px var(--font-mono)', color: 'var(--ink-2)',
                      background: 'var(--surface)', border: '1px solid var(--border)',
                      borderRadius: 5, padding: '2px 8px', whiteSpace: 'nowrap', letterSpacing: '0.02em',
                    }}>
                      {shortcutLabel(s)}
                    </kbd>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {upgradeOpen && <UpgradeModal onClose={() => setUpgradeOpen(false)} />}
    </>
  );
}
