import { supabase } from './supabase';
import type { Tables } from './database.types';

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

// Частичная выборка из БД (Tables<'profiles'>); user_dictionary — non-null (контракт приложения).
export type Profile = Pick<
  Tables<'profiles'>,
  'user_id' | 'plan' | 'plan_expires_at' | 'onboarded_at' | 'grandfathered' | 'recurring_inv_id' | 'cancel_at_period_end' | 'display_name' | 'checklist_dismissed_at' | 'first_export_at'
> & { user_dictionary: string[] };

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, plan, plan_expires_at, onboarded_at, user_dictionary, grandfathered, recurring_inv_id, cancel_at_period_end, display_name, checklist_dismissed_at, first_export_at')
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

/** Все шаги чеклиста пройдены. Метрика активации — не путать с dismissChecklist. */
export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ onboarded_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('onboarded_at', null);
  if (error) console.error('[profiles] markOnboarded failed:', error.message);
}

/** Чеклист закрыт крестиком. Скрывает баннер, но активацией не считается. */
export async function dismissChecklist(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ checklist_dismissed_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('checklist_dismissed_at', null);
  if (error) console.error('[profiles] dismissChecklist failed:', error.message);
}

/** Первый успешный экспорт. Пишется один раз — `.is(null)` защищает от перезаписи. */
export async function markFirstExport(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ first_export_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('first_export_at', null);
  if (error) console.error('[profiles] markFirstExport failed:', error.message);
}

export async function updateDisplayName(userId: string, name: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: name.trim() || null })
    .eq('user_id', userId);
  if (error) throw error;
}
