import { useEffect, useRef, type MutableRefObject } from 'react';
import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

// Keepalive-сохранение незаписанного патча главы при закрытии вкладки.
// Debounce (700 мс) может не успеть флашнуться, если пользователь закрывает
// вкладку сразу после правки — этот обработчик дописывает pending-патч через
// fetch({ keepalive: true }), который переживает выгрузку страницы.
// Единая точка паттерна для Editor / Focus / Split.
export function useBeforeUnloadSave<P extends object>(
  pendingPatchRef: MutableRefObject<P | null>,
  targetIdRef: MutableRefObject<string | null>,
  onUnload?: () => void,
) {
  const tokenRef = useRef<string | null>(null);
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) tokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      tokenRef.current = session?.access_token ?? null;
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const onUnloadRef = useRef(onUnload);
  onUnloadRef.current = onUnload;

  useEffect(() => {
    const handleBeforeUnload = () => {
      const patch = pendingPatchRef.current;
      const id = targetIdRef.current;
      const token = tokenRef.current;
      if (patch && id && token) {
        void fetch(`${SUPABASE_URL}/rest/v1/chapters?id=eq.${id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${token}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify(patch),
          keepalive: true,
        });
      }
      onUnloadRef.current?.();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingPatchRef, targetIdRef]);
}
