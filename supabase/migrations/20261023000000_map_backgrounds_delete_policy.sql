-- У бакета map-backgrounds были политики INSERT/UPDATE/SELECT, но не DELETE:
-- storage.remove() молча удалял 0 файлов. «Убрать фон» оставлял файл, удалённые книги — тоже.
-- Тот же предикат, что у остальных политик бакета: первая папка пути = uid владельца.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'Users delete own map bg') THEN
    CREATE POLICY "Users delete own map bg" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'map-backgrounds' AND (auth.uid())::text = (storage.foldername(name))[1]);
  END IF;
END $$;
