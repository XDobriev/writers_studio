import { useCallback, useRef, useState } from 'react';
import * as VKID from '@vkid/sdk';
import { useAuth, translateAuthError } from './auth';
import { VK_APP_ID, VK_REDIRECT_URL } from './config';

export function useVkAuth() {
  const { signInWithVk } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  const initConfig = useCallback(() => {
    if (initializedRef.current) return;
    try {
      VKID.Config.init({
        app: VK_APP_ID,
        redirectUrl: VK_REDIRECT_URL,
        responseMode: VKID.ConfigResponseMode.Callback,
        source: VKID.ConfigSource.LOWCODE,
        mode: VKID.ConfigAuthMode.InNewWindow,
        scope: '',
      });
      initializedRef.current = true;
    } catch (e) {
      console.warn('[vk-auth] VKID.Config.init failed:', e);
    }
  }, []);

  const startLogin = useCallback(async () => {
    if (busy) return;
    initConfig();
    setBusy(true);
    setError(null);

    try {
      const res = await VKID.Auth.login();
      const { code, device_id } = (res || {}) as { code?: string; device_id?: string };
      if (!code || !device_id) {
        throw new Error('Код авторизации не получен');
      }

      const tokenData = await VKID.Auth.exchangeCode(code, device_id);
      const vkUserId = tokenData.user_id ?? 0;
      const { error: authErr } = await signInWithVk(tokenData.access_token, vkUserId);
      if (authErr) {
        setError(`VK: ${translateAuthError(authErr)}`);
      }
    } catch (err: unknown) {
      const authErr = err as { code?: number; error?: string } | undefined;
      if (authErr?.code === VKID.AuthErrorCode.NewTabHasBeenClosed) {
        // Окно было закрыто пользователем — не выводим ошибку
      } else if (authErr?.code === VKID.AuthErrorCode.CannotCreateNewTab) {
        setError('Всплывающее окно заблокировано браузером. Разрешите всплывающие окна для avtorstudio.com.');
      } else {
        setError('Не удалось войти через VK. Попробуйте ещё раз или войдите по почте.');
      }
    } finally {
      setBusy(false);
    }
  }, [busy, initConfig, signInWithVk]);

  return {
    startLogin,
    busy,
    error,
    clearError: () => setError(null),
  };
}
