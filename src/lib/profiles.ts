import { supabase } from './supabase';

export interface PlanLimits {
  maxBooks: number;
  maxCharacters: number;
  maxTimelineEvents: number;
  canExportRich: boolean;
}

export function getPlanLimits(plan: string | undefined): PlanLimits {
  if (!plan || plan === 'free') {
    return { maxBooks: 1, maxCharacters: 3, maxTimelineEvents: 10, canExportRich: false };
  }
  return { maxBooks: Infinity, maxCharacters: Infinity, maxTimelineEvents: Infinity, canExportRich: true };
}

export interface Profile {
  user_id: string;
  plan: string;
  plan_expires_at: string | null;
  onboarded_at: string | null;
  user_dictionary: string[];
  grandfathered: boolean;
  recurring_inv_id: string | null;
  cancel_at_period_end: boolean;
  display_name: string | null;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, plan, plan_expires_at, onboarded_at, user_dictionary, grandfathered, recurring_inv_id, cancel_at_period_end, display_name')
    .eq('user_id', userId)
    .single();
  if (error) console.error('[profiles] getProfile failed:', error.message);
  return (data as Profile | null) ?? null;
}

export async function getLifetimeSlotsRemaining(): Promise<number | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'lifetime_slots_remaining')
    .maybeSingle();
  if (error) {
    console.error('[profiles] getLifetimeSlotsRemaining failed:', error.message);
    return null;
  }
  return data ? parseInt(data.value, 10) : null;
}

export async function addWordToDictionary(userId: string, word: string): Promise<void> {
  const { error } = await supabase.rpc('append_user_dictionary_word', {
    p_user_id: userId,
    p_word: word.toLowerCase(),
  });
  if (error) throw error;
}

export async function removeWordFromDictionary(userId: string, word: string): Promise<void> {
  const { error } = await supabase.rpc('remove_user_dictionary_word', {
    p_user_id: userId,
    p_word: word,
  });
  if (error) throw error;
}

export async function getRegistrationOpen(): Promise<boolean> {
  const { data, error } = await supabase
    .from('feature_flags')
    .select('enabled')
    .eq('key', 'registration_open')
    .maybeSingle();
  if (error) {
    console.error('[profiles] getRegistrationOpen failed:', error.message);
    return true;
  }
  return data?.enabled ?? true;
}

export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('onboarded_at', null);
  if (error) console.error('[profiles] markOnboarded failed:', error.message);
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name.trim() || null })
    .eq('user_id', userId);
  if (error) throw error;
}
