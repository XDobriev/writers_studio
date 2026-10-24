// Общее для telegram-auth / vk-auth: поиск пользователя и флаг регистрации.
// deno-lint-ignore-file no-explicit-any
type Db = { rpc: (fn: string, args?: Record<string, unknown>) => any; from: (t: string) => any };

/**
 * Пользователь по email через SECURITY DEFINER RPC find_auth_user_by_email
 * (20261022000300, только service_role). Заменяет listUsers 5×200, который
 * ломал вход после 1000 пользователей.
 */
export async function findUserByEmail(db: Db, email: string): Promise<
  { ok: true; user: { id: string; app_metadata: Record<string, unknown> } | null } | { ok: false; error: string }
> {
  const { data, error } = await db.rpc('find_auth_user_by_email', { p_email: email });
  if (error) return { ok: false, error: error.message };
  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return { ok: true, user: null };
  return { ok: true, user: { id: row.id, app_metadata: (row.app_metadata ?? {}) as Record<string, unknown> } };
}

type AuthAdmin = {
  auth: { admin: { updateUserById: (id: string, attrs: Record<string, unknown>) => Promise<{ error: { message: string } | null }> } };
};

/** Аккаунт, созданный по email (или иначе без telegram_id/vk_id): служебный адрес tg-/vk-…@*.local занят до первого входа владельца. */
export function isEmailSquatter(appMeta: Record<string, unknown>): boolean {
  return !appMeta.telegram_id && !appMeta.vk_id;
}

/** Освобождает служебный адрес: переименовывает захватчика, ничего не удаляя. */
export async function releaseSquattedEmail(admin: AuthAdmin, userId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await admin.auth.admin.updateUserById(userId, { email: `released-${userId}@invalid.local`, email_confirm: true });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/** feature_flags.registration_open: нет строки → открыто (как на фронте); ошибка чтения → закрыто. */
export async function isRegistrationOpen(db: Db): Promise<boolean> {
  const { data, error } = await db.from('feature_flags').select('enabled').eq('key', 'registration_open').maybeSingle();
  if (error) {
    console.error('[auth] registration_open read failed:', error.message);
    return false;
  }
  return data ? data.enabled !== false : true;
}
