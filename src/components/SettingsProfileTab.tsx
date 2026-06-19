import { useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { PasswordInput } from './PasswordInput';

const FL: CSSProperties = { font: '400 12px var(--font-ui)', color: 'var(--ink-3)', marginBottom: 4 };
const FG: CSSProperties = { display: 'flex', flexDirection: 'column' };
const ROW: CSSProperties = { display: 'flex', gap: 8 };
const H = 38;

export function SettingsProfileTab() {
  const { user, signOut, updatePassword } = useAuth();
  const isTelegram = user?.user_metadata?.provider === 'telegram';
  const accountLabel = isTelegram ? 'Telegram' : 'Email';
  const accountDisplay = isTelegram
    ? (user?.user_metadata?.telegram_username ? `@${user.user_metadata.telegram_username}` : `Telegram ID: ${user?.user_metadata?.telegram_id ?? ''}`)
    : (user?.email ?? '');

  const [name, setName] = useState(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.user_metadata?.first_name ?? '');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [newPass, setNewPass] = useState('');
  const [passSaving, setPassSaving] = useState(false);
  const [passError, setPassError] = useState<string | null>(null);
  const [passSaved, setPassSaved] = useState(false);

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

  return (
    <div id="sm-panel-profile" role="tabpanel" aria-labelledby="sm-tab-profile" tabIndex={0} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={FG}>
        <label htmlFor="settings-name" style={FL}>Имя</label>
        <div style={ROW}>
          <input
            id="settings-name"
            className="input"
            value={name}
            onChange={(e) => { setName(e.target.value); setNameSaved(false); }}
            placeholder="Ваше имя"
            maxLength={100}
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
        <label htmlFor="settings-account" style={FL}>{accountLabel}</label>
        <input
          id="settings-account"
          className="input"
          value={accountDisplay}
          readOnly
          style={{ fontSize: 13, height: H, opacity: 0.5, cursor: 'default' }}
        />
      </div>

      {!isTelegram && (
        <form style={FG} onSubmit={(e) => { e.preventDefault(); handleSavePass(); }}>
          <label htmlFor="settings-new-password" style={FL}>Новый пароль</label>
          <div style={ROW}>
            <div style={{ flex: 1 }}>
              <PasswordInput
                id="settings-new-password"
                value={newPass}
                onChange={(v) => { setNewPass(v); setPassSaved(false); setPassError(null); }}
                placeholder="Минимум 6 символов"
                autoComplete="new-password"
              />
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
  );
}
