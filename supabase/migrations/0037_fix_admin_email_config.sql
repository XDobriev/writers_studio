-- Миграция 0031 случайно обновляла app_settings вместо app_config.
-- Все admin RPC читают email из app_config, поэтому применяем изменение туда.
UPDATE public.app_config
SET value = 'XDobriev@yandex.ru'
WHERE key = 'admin_email';
