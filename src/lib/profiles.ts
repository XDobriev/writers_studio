import { supabase } from './supabase';

export interface Profile {
  user_id: string;
  plan: string;
  plan_expires_at: string | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at')
    .eq('user_id', userId)
    .single();
  if (error) console.error('[profiles] getProfile failed:', error.message);
  return (data as Profile | null) ?? null;
}
