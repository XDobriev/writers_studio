-- book-covers/character-avatars/map-backgrounds имели INSERT/UPDATE/DELETE-политики
-- на storage.objects, но ни одной SELECT. supabase-js .upload(..., {upsert:true})
-- компилируется в "INSERT ... ON CONFLICT DO UPDATE" — Postgres RLS для такого
-- запроса требует видимость строки через SELECT-политику даже когда конфликта нет,
-- иначе кидает "new row violates row-level security policy". Итог: любая загрузка
-- обложки книги / аватара персонажа / фона карты падала с 400 на каждой попытке,
-- т.к. все три upload-вызова используют upsert:true.
create policy "Users read own covers" on storage.objects for select to authenticated
  using (bucket_id = 'book-covers' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "character_avatars_select" on storage.objects for select to authenticated
  using (bucket_id = 'character-avatars' and (auth.uid())::text = split_part(name, '/', 1));

create policy "Users read own map bg" on storage.objects for select to authenticated
  using (bucket_id = 'map-backgrounds' and (auth.uid())::text = (storage.foldername(name))[1]);
