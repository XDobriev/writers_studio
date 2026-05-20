-- Фото персонажа: avatar_url в таблице + Storage bucket character-avatars

alter table public.characters add column if not exists avatar_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'character-avatars',
  'character-avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists "character_avatars_select" on storage.objects;
create policy "character_avatars_select"
  on storage.objects for select
  using (bucket_id = 'character-avatars');

drop policy if exists "character_avatars_insert" on storage.objects;
create policy "character_avatars_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'character-avatars'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "character_avatars_update" on storage.objects;
create policy "character_avatars_update"
  on storage.objects for update
  using (
    bucket_id = 'character-avatars'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "character_avatars_delete" on storage.objects;
create policy "character_avatars_delete"
  on storage.objects for delete
  using (
    bucket_id = 'character-avatars'
    and auth.uid()::text = split_part(name, '/', 1)
  );
