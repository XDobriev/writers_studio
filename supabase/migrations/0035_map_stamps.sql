CREATE TABLE public.map_stamps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id    uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id),
  type       text NOT NULL,
  x          float8 NOT NULL,
  y          float8 NOT NULL,
  size       float8 NOT NULL DEFAULT 1.0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.map_stamps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner" ON public.map_stamps
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX ON public.map_stamps (book_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.map_stamps TO anon, authenticated;
