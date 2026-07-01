import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

async function fetchFlag(key: string): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('key', key)
    .maybeSingle();
  if (error) return null;
  return data?.enabled ?? null;
}

export function useFeatureFlag(key: string, defaultValue = true) {
  const { data, isLoading } = useQuery({
    queryKey: ['feature-flag', key] as const,
    queryFn: () => fetchFlag(key),
    staleTime: 5 * 60_000,
  });
  return { enabled: data ?? defaultValue, isLoading };
}
