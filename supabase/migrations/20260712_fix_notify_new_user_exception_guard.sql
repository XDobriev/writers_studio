-- Оборачивает тело notify_new_user() в exception-хендлер: сбой отправки Telegram-уведомления
-- (pg_net/vault недоступны и т.п.) не должен откатывать регистрацию пользователя в auth.users.
-- Порядок относительно on_auth_user_profile_created не важен — обе AFTER INSERT функции
-- независимы друг от друга, полагаться на алфавитный порядок имён не нужно.

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
  exception when others then
    raise warning 'notify_new_user failed for user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

revoke all on function public.notify_new_user() from public, anon, authenticated;
