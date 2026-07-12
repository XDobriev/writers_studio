-- Уведомление владельца в Telegram о каждой новой регистрации через new-user-notify.
-- Секрет для заголовка X-Webhook-Secret хранится в Vault (vault.decrypted_secrets,
-- name = 'notify_webhook_secret'), не в этом файле — см. docs/superpowers/plans/2026-07-12-telegram-signup-notifications.md.

create or replace function public.notify_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_secret text;
  v_provider text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'notify_webhook_secret'
  limit 1;

  if v_secret is null then
    return new;
  end if;

  v_provider := case
    when new.raw_app_meta_data ? 'telegram_id' then 'telegram'
    when new.raw_app_meta_data ? 'vk_id' then 'vk'
    else 'email'
  end;

  perform net.http_post(
    url := 'https://joaxeoavjvlqmtlepkrr.supabase.co/functions/v1/new-user-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Webhook-Secret', v_secret
    ),
    body := jsonb_build_object(
      'email', new.email,
      'provider', v_provider,
      'created_at', new.created_at
    )
  );

  return new;
end;
$$;

revoke all on function public.notify_new_user() from public, anon, authenticated;

create trigger on_auth_user_notify_new_signup
  after insert on auth.users
  for each row
  execute function public.notify_new_user();
