-- Картинки глав (B-5): бакет chapter-images. Путь файла: <user_id>/<book_id>/<имя>.
-- Public — как у character-avatars: картинки видны на публичной странице /share/:token
-- и в экспорте по public URL без подписанных ссылок (public URL RLS не проверяет).
-- SELECT-политика — только своя папка (как 20260727_storage_upsert_missing_select_policy):
-- открытый SELECT дал бы любому, включая anon, листинг всех картинок через storage.list().
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chapter-images',
  'chapter-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "chapter_images_select" on storage.objects;
create policy "chapter_images_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'chapter-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "chapter_images_insert" on storage.objects;
create policy "chapter_images_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chapter-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "chapter_images_delete" on storage.objects;
create policy "chapter_images_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chapter-images'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
