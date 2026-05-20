-- §7 Шаринг книги по публичной ссылке
-- NULL = доступ закрыт, UUID = активна публичная ссылка

alter table public.books
  add column if not exists share_token uuid;

create index if not exists books_share_token_idx on public.books(share_token)
  where share_token is not null;

-- SELECT для анонимных пользователей: только если токен активен
drop policy if exists "books select via share token" on public.books;
create policy "books select via share token"
  on public.books for select
  to anon
  using (share_token is not null);

-- Главы: анонимный SELECT когда книга расшарена
drop policy if exists "chapters select via share token" on public.chapters;
create policy "chapters select via share token"
  on public.chapters for select
  to anon
  using (
    exists (
      select 1 from public.books b
      where b.id = chapters.book_id
        and b.share_token is not null
    )
  );
