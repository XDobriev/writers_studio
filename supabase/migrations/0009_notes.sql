create table notes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  book_id    uuid        not null references books(id) on delete cascade,
  kind       text        not null default 'idea'
               check (kind in ('idea', 'question', 'todo', 'important')),
  text       text        not null default '',
  created_at timestamptz not null default now()
);

alter table notes enable row level security;

create policy "notes: owner access"
  on notes
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
