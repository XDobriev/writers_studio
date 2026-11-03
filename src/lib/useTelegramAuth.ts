import { useEffect, useRef, useState } from 'react';
import { useAuth, translateAuthError } from './auth';
import { createTelegramAuthUrl, hasTelegramCallback, takeTelegramCallback } from './telegramCallback';

const TG_BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME as string | undefined;

export function useTelegramAuth() {
  const { signInWithTelegram } = useAuth();
  const tgSlotRef = useRef<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(hasTelegramCallback);
  const [error, setError] = useState<string | null>(null);
  const callbackHandled = useRef(false);

  useEffect(() => {
    if (callbackHandled.current) return;
    callbackHandled.current = true;
    const callback = takeTelegramCallback();
    if (!callback) return;
    if (callback.error !== null) { setError(callback.error); setBusy(false); return; }
    setBusy(true);
    void (async () => {
      try {
        const { error: authErr } = await signInWithTelegram(callback.data);
        if (authErr) setError(`Telegram: ${translateAuthError(authErr)}`);
      } catch {
        setError('Ошибка авторизации Telegram. Попробуйте ещё раз.');
      } finally {
        setBusy(false);
      }
    })();
  }, [signInWithTelegram]);

  useEffect(() => {
    if (!TG_BOT_USERNAME || !tgSlotRef.current) return;
    let authUrl: string;
    try {
      authUrl = createTelegramAuthUrl();
    } catch {
      setError('Для входа через Telegram разрешите хранилище сайта и попробуйте ещё раз.');
      return;
    }
    const slot = tgSlotRef.current;
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', TG_BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-userpic', 'false');
    script.setAttribute('data-radius', '6');
    script.setAttribute('data-auth-url', authUrl);
    script.setAttribute('data-request-access', 'write');

    // The widget copies location.href into mobile return_to; bind that path to the same state.
    const originalUrl = window.location.href;
    window.history.replaceState(window.history.state, '', authUrl);
    const restoreUrl = () => {
      if (window.location.href === authUrl) window.history.replaceState(window.history.state, '', originalUrl);
    };
    script.onload = restoreUrl;
    script.onerror = () => { restoreUrl(); setError('Не удалось загрузить Telegram. Попробуйте ещё раз.'); };

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
      restoreUrl();
    };
  }, [signInWithTelegram]);

  return { tgSlotRef, busy, error, clearError: () => setError(null) };
}

export { TG_BOT_USERNAME };
