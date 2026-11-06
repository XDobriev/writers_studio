import { supabase } from './supabase';
import type { Tables } from './database.types';

export interface PlanLimits {
  maxBooks: number;
  maxCharacters: number;
  maxTimelineEvents: number;
  canExportRich: boolean;
}

type EffectivePlan = 'free' | 'pro' | 'lifetime';

export type PlanFields = {
  plan: string;
  plan_expires_at: string | null;
  trial_started_at?: string | null;
  trial_ends_at?: string | null;
  trial_used?: boolean;
};

/**
 * Пользователь с уже оплаченной активной подпиской (lifetime или активный pro).
 * Используется при чекауте (LandingPricingSection, usePostAuthRedirect) и в UI подписки:
 * пользователь с активным триалом (plan = 'free', trial_ends_at > now) НЕ имеет платной подписки
 * и может в любой момент оформить Pro или Lifetime.
 */
export function hasPaidSubscription(profile: PlanFields | null | undefined, now: Date = new Date()): boolean {
  if (!profile) return false;
  if (profile.plan === 'lifetime') return true;
  if (profile.plan !== 'pro') return false;
  return profile.plan_expires_at === null || new Date(profile.plan_expires_at) > now;
}

/**
 * Активен ли 7-дневный пробный период Pro (Reverse Trial).
 * Истинен, если у пользователя нет оплаченной подписки, но trial_ends_at в будущем.
 */
export function isTrialActive(profile: PlanFields | null | undefined, now: Date = new Date()): boolean {
  if (!profile || hasPaidSubscription(profile, now)) return false;
  return Boolean(profile.trial_ends_at && new Date(profile.trial_ends_at) > now);
}

/**
 * Может ли пользователь активировать 7-дневный пробный период Pro в 1 клик.
 * Разрешено 1 раз на аккаунт для пользователей без активного платного тарифа или триала.
 */
export function canStartTrial(profile: PlanFields | null | undefined, now: Date = new Date()): boolean {
  if (!profile) return false;
  if (profile.trial_used || profile.trial_started_at) return false;
  return !isPaidPlan(profile, now);
}

/**
 * Единственный источник «доступны ли возможности Pro» на фронте. Зеркалит SQL public.is_paid:
 * lifetime — всегда; pro — пока plan_expires_at в будущем (NULL у pro = бессрочный грант админа);
 * активный Reverse Trial — пока trial_ends_at в будущем.
 * Истёкший pro или истёкший триал считается free.
 */
export function isPaidPlan(profile: PlanFields | null | undefined, now: Date = new Date()): boolean {
  if (!profile) return false;
  return hasPaidSubscription(profile, now) || isTrialActive(profile, now);
}

/** План с учётом срока: истёкший pro → 'free'. */
export function effectivePlan(profile: PlanFields | null | undefined, now: Date = new Date()): EffectivePlan {
  if (!profile || !isPaidPlan(profile, now)) return 'free';
  return profile.plan === 'lifetime' ? 'lifetime' : 'pro';
}

/** Лимиты Free зеркалят серверные триггеры 20261022000400_free_plan_limits.sql. */
export function getPlanLimits(profile: PlanFields | null | undefined, now: Date = new Date()): PlanLimits {
  if (!isPaidPlan(profile, now)) {
    return { maxBooks: 1, maxCharacters: 3, maxTimelineEvents: 10, canExportRich: false };
  }
  return { maxBooks: Infinity, maxCharacters: Infinity, maxTimelineEvents: Infinity, canExportRich: true };
}

/** Ошибка серверного лимита Free: RAISE 'plan_limit' USING ERRCODE 'P0001' (PostgrestError или DbError). */
export function isPlanLimitError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const code = 'code' in e ? e.code : undefined;
  const message = 'message' in e ? e.message : undefined;
  return code === 'P0001' && typeof message === 'string' && message.includes('plan_limit');
}

// Частичная выборка из БД (Tables<'profiles'>); user_dictionary — non-null (контракт приложения).
export type Profile = Pick<
  Tables<'profiles'>,
  | 'user_id'
  | 'plan'
  | 'plan_expires_at'
  | 'onboarded_at'
  | 'grandfathered'
  | 'recurring_inv_id'
  | 'cancel_at_period_end'
  | 'billing_attempts'
  | 'display_name'
  | 'checklist_dismissed_at'
  | 'first_export_at'
  | 'trial_started_at'
  | 'trial_ends_at'
  | 'trial_used'
> & { user_dictionary: string[] };

/** Pro истёк, а автосписание не прошло: счёт есть, попытки были. Подписку не продлили. */
export function isRenewalFailed(
  profile: (PlanFields & { recurring_inv_id: string | null; billing_attempts: number }) | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!profile || profile.plan !== 'pro' || !profile.plan_expires_at) return false;
  return new Date(profile.plan_expires_at) <= now && !!profile.recurring_inv_id && profile.billing_attempts > 0;
}

export interface StartTrialResult {
  trial_started_at: string;
  trial_ends_at: string;
  trial_used: boolean;
}

export async function startProTrial(): Promise<StartTrialResult> {
  const { data, error } = await supabase.rpc('start_pro_trial');
  if (error) throw error;
  return data as unknown as StartTrialResult;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('user_id, plan, plan_expires_at, onboarded_at, user_dictionary, grandfathered, recurring_inv_id, cancel_at_period_end, billing_attempts, display_name, checklist_dismissed_at, first_export_at, trial_started_at, trial_ends_at, trial_used')
    .eq('user_id', userId)
    .single();
  // PGRST116 — строки нет: это ответ, а не сбой. Остальное бросаем, чтобы React Query
  // повторил запрос, а не закэшировал null (null = «free» → неверные лимиты и пейволлы).
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
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
