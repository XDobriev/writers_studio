import { useState, useCallback } from 'react';

export function useErrorState() {
  const [error, setErrorState] = useState<string | null>(null);

  const setError = useCallback((e: Error | string) => {
    setErrorState(typeof e === 'string' ? e : e.message);
  }, []);

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  return { error, setError, clearError };
}
