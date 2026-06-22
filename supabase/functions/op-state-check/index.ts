// ОТКЛЮЧЕНО. Временная диагностика возвратов (22.06.2026) выполнена.
// Удалить функцию через Supabase Dashboard → Edge Functions → op-state-check → Delete.
Deno.serve(() => new Response('gone', { status: 410 }));
