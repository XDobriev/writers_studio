import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

// Если в URL есть ?create=true — один раз вызвать action и убрать параметр.
// Используется страницами Timeline/Notes/Outline для «создать сразу при переходе».
export function useCreateOnMount(action: () => void): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (searchParams.get('create') !== 'true') return;
    firedRef.current = true;
    setSearchParams({}, { replace: true });
    action();
  }, [searchParams, setSearchParams, action]);
}
