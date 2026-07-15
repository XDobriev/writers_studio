import { supabase } from './supabase';
import type { CancelReason } from './cancellations';

export type Plan = 'free' | 'pro' | 'lifetime';
export type Tab = 'users' | 'analytics' | 'audit' | 'payments' | 'finances' | 'flags';
export type SortKey = 'created_at' | 'words_total' | 'last_active';

export interface AdminStats {
  users_total: number;
  users_7d: number;
  users_30d: number;
  books_total: number;
  chapters_total: number;
  words_total: number;
  dau: number;
  wau: number;
  mau: number;
  snapshots_30d: number;
}

export interface AdminUser {
  id: string;
  email: string;
  created_at: string;
  books_count: number;
  words_total: number;
  last_active: string | null;
  plan: Plan;
  suspended: boolean;
  is_test: boolean;
}

export interface AuditEntry {
  id: string;
  action: string;
  target_user_id: string | null;
  target_email: string | null;
  payload: Record<string, string> | null;
  created_at: string;
  is_test: boolean;
}

/** Прогресс по шагам онбординга. Не строгая воронка — шаги можно проходить не по порядку. */
export interface ActivationFunnel {
  signed_up: number;
  created_book: number;
  wrote_words: number;
  added_character: number;
  tried_export: number;
  activated: number;
  dismissed_early: number;
}

export interface CancellationEntry {
  id: string;
  reason: CancelReason;
  comment: string | null;
  plan: string | null;
  created_at: string;
  email: string;
}

export interface AdminCancellations {
  by_reason: { reason: CancelReason; count: number }[];
  recent: CancellationEntry[];
}

export interface AdminRevenue {
  mrr: number;
  arr: number;
  pro_count: number;
  lifetime_count: number;
  churn_count_30d: number;
  churn_rate: number;
}

export interface FeatureFlag {
  key: string;
  enabled: boolean;
}

export const PLAN_COLOR: Record<Plan, string> = {
  free: 'var(--ink-4)',
  pro: 'oklch(0.62 0.18 270)',
  lifetime: 'oklch(0.62 0.18 50)',
};

export const TAB_LABELS: Record<Tab, string> = {
  users: 'Пользователи',
  analytics: 'Аналитика',
  audit: 'Аудит',
  payments: 'Платежи',
  finances: 'Финансы',
  flags: 'Флаги',
};

export function fmtNum(n: number): string {
  return n.toLocaleString('ru');
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtWords(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} млн`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)} тыс`;
  return String(n);
}

export function displayEmail(email: string): string {
  const m = email.match(/^vk-(\d+)@vk\.local$/);
  return m ? `ВКонтакте #${m[1]}` : email;
}

// This is the ONLY file where `as T` casts are permitted for admin RPC responses.

export class AdminRpcError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'AdminRpcError';
  }
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_stats');
  if (error) throw new AdminRpcError(error.message, error.code);
  return data as unknown as AdminStats;
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabase.rpc('get_admin_users');
  if (error) throw new AdminRpcError(error.message, error.code);
  return data as AdminUser[];
}

export async function fetchAuditLog(): Promise<AuditEntry[]> {
  const { data, error } = await supabase.rpc('get_admin_audit_log');
  if (error) throw new AdminRpcError(error.message, error.code);
  return data as AuditEntry[];
}

export async function fetchActivationFunnel(): Promise<ActivationFunnel> {
  const { data, error } = await supabase.rpc('get_admin_activation_funnel');
  if (error) throw new AdminRpcError(error.message, error.code);
  return data as unknown as ActivationFunnel;
}

export async function fetchCancellations(): Promise<AdminCancellations> {
  const { data, error } = await supabase.rpc('get_admin_cancellations');
  if (error) throw new AdminRpcError(error.message, error.code);
  return data as unknown as AdminCancellations;
}

export async function fetchRevenue(): Promise<AdminRevenue> {
  const { data, error } = await supabase.rpc('get_admin_revenue');
  if (error) throw new AdminRpcError(error.message, error.code);
  return data as unknown as AdminRevenue;
}

export async function fetchFeatureFlags(): Promise<FeatureFlag[]> {
  const { data, error } = await supabase.rpc('get_feature_flags');
  if (error) throw new AdminRpcError(error.message, error.code);
  return data as FeatureFlag[];
}

export async function rpcSetUserPlan(targetUserId: string, newPlan: Plan): Promise<void> {
  const { error } = await supabase.rpc('set_user_plan', {
    target_user_id: targetUserId,
    new_plan: newPlan,
  });
  if (error) throw new AdminRpcError(error.message, error.code);
}

export async function rpcSuspendUser(targetUserId: string, suspend: boolean): Promise<void> {
  const { error } = await supabase.rpc('suspend_user', { target_user_id: targetUserId, suspend });
  if (error) throw new AdminRpcError(error.message, error.code);
}

export async function rpcExtendPlan(targetUserId: string, days: number): Promise<void> {
  const { error } = await supabase.rpc('extend_plan', { target_user_id: targetUserId, days });
  if (error) throw new AdminRpcError(error.message, error.code);
}

export async function rpcSetLifetimeSlots(newValue: number): Promise<void> {
  const { error } = await supabase.rpc('set_lifetime_slots', { new_value: newValue });
  if (error) throw new AdminRpcError(error.message, error.code);
}

export async function rpcSetFeatureFlag(key: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_feature_flag', { p_key: key, p_enabled: enabled });
  if (error) throw new AdminRpcError(error.message, error.code);
}

export async function rpcSetUserTest(targetUserId: string, isTestValue: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_user_test', {
    target_user_id: targetUserId,
    is_test_value: isTestValue,
  });
  if (error) throw new AdminRpcError(error.message, error.code);
}
