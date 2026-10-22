import { useState, useCallback } from 'react';
import { toUserMessage } from './errors';

// setError принимает что угодно (Error, строку из e.message) — в state попадает
// только понятный пользователю текст (см. errors.ts).
export function useErrorState() {
  const [error, setErrorState] = useState<string | null>(null);

  const setError = useCallback((e: unknown) => {
    setErrorState(toUserMessage(e));
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  return { error, setError, clearError };
}
