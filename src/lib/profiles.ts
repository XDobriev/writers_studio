import { supabase } from './supabase';

export interface Profile {
  user_id: string;
  plan: string;
  plan_expires_at: string | null;
  onboarded_at: string | null;
  user_dictionary: string[];
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('plan, plan_expires_at, onboarded_at, user_dictionary')
    .eq('user_id', userId)
    .single();
  if (error) console.error('[profiles] getProfile failed:', error.message);
  return (data as Profile | null) ?? null;
}

export async function addWordToDictionary(userId: string, word: string): Promise<void> {
  const { error } = await supabase.rpc('append_user_dictionary_word', {
    p_user_id: userId,
    p_word: word.toLowerCase(),
  });
  if (error) console.error('[profiles] addWordToDictionary failed:', error.message);
}

export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('onboarded_at', null);
  if (error) console.error('[profiles] markOnboarded failed:', error.message);
}
