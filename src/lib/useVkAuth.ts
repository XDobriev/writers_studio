import { useEffect, useRef, useState } from 'react';
import { useAuth, translateAuthError } from './auth';
import { VK_APP_ID, VK_REDIRECT_URL } from './config';

interface VkidOneTapInstance {
  on: (event: string, handler: (payload?: unknown) => void) => VkidOneTapInstance;
}

interface VkidSDK {
  Config: {
    init: (opts: {
      app: number;
      redirectUrl: string;
      responseMode: unknown;
      source: unknown;
      scope: string;
    }) => void;
  };
  ConfigResponseMode: { Callback: unknown };
  ConfigSource: { LOWCODE: unknown };
  OneTap: new () => {
    render: (opts: { container: HTMLElement; showAlternativeLogin: boolean }) => VkidOneTapInstance;
  };
  Auth: {
    exchangeCode: (code: string, deviceId: string) => Promise<{
      access_token: string;
      user_id?: number;
      user?: { id: number };
    }>;
  };
  WidgetEvents: { ERROR: string };
  OneTapInternalEvents: { LOGIN_SUCCESS: string };
}

declare global {
  interface Window { VKIDSDK?: VkidSDK; }
}

export function useVkAuth() {
  const { signInWithVk } = useAuth();
  const vkSlotRef = useRef<HTMLDivElement | null>(null);
  const vkHasClickedRef = useRef(false);
  const [sdkFailed, setSdkFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!vkSlotRef.current) return;
    const slot = vkSlotRef.current;

    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://unpkg.com/@vkid/sdk@<3.0.0/dist-sdk/umd/index.js';
    script.onerror = () => { setSdkFailed(true); };
    script.onload = () => {
      const VKID = window.VKIDSDK;
      if (!VKID) return;

      VKID.Config.init({
        app: VK_APP_ID,
        redirectUrl: VK_REDIRECT_URL,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        scope: '',
      });

      const oneTap = new VKID.OneTap();
      oneTap
        .render({ container: slot, showAlternativeLogin: false })
        .on(VKID.WidgetEvents.ERROR, () => {
          if (!vkHasClickedRef.current) return;
          setBusy(false);
          setError('Ошибка VK ID. Попробуйте войти по почте или повторите позже.');
        })
        .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload) => {
          void (async () => {
            const { code, device_id } = payload as { code: string; device_id: string };
            setBusy(true);
            setError(null);
            try {
              const tokenData = await VKID.Auth.exchangeCode(code, device_id);
              const vkUserId = tokenData.user?.id ?? tokenData.user_id ?? 0;
              const { error: authErr } = await signInWithVk(tokenData.access_token, vkUserId);
              if (authErr) setError(`VK: ${translateAuthError(authErr)}`);
            } catch {
              setError('Ошибка авторизации VK. Попробуйте ещё раз.');
            } finally {
              setBusy(false);
            }
          })();
        });
    };

    slot.appendChild(script);
    return () => { slot.innerHTML = ''; };
  }, [signInWithVk]);

  return { vkSlotRef, vkHasClickedRef, sdkFailed, busy, error, clearError: () => setError(null) };
}
