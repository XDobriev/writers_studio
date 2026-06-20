import { useEffect, useRef, useState } from 'react';
import { useAuth, translateAuthError, type TelegramAuthData } from './auth';

const TG_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;
const TG_CALLBACK = '__onTelegramAuth';

declare global {
  interface Window {
    __onTelegramAuth?: (user: TelegramAuthData) => void;
  }
}

export function useTelegramAuth() {
  const { signInWithTelegram } = useAuth();
  const tgSlotRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!TG_BOT_USERNAME || !tgSlotRef.current) return;

    window.__onTelegramAuth = async (user) => {
      setBusy(true);
      setError(null);
      const { error: authErr } = await signInWithTelegram(user);
      setBusy(false);
      if (authErr) setError(`Telegram: ${translateAuthError(authErr)}`);
    };

    const slot = tgSlotRef.current;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TG_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-radius', '6');
    script.setAttribute('data-onauth', `${TG_CALLBACK}(user)`);
    script.setAttribute('data-request-access', 'write');

    const observer = new MutationObserver(() => {
      const iframe = slot.querySelector('iframe');
      if (iframe) {
        iframe.style.width = '100%';
        iframe.style.height = '42px';
        observer.disconnect();
      }
    });
    observer.observe(slot, { childList: true, subtree: true });
    slot.appendChild(script);

    return () => {
      observer.disconnect();
      slot.innerHTML = '';
      delete window.__onTelegramAuth;
    };
  }, [signInWithTelegram]);

  return { tgSlotRef, busy, error, clearError: () => setError(null) };
}

export { TG_BOT_USERNAME };
