-- notes_kind_check никогда не включал 'custom', хотя custom_label/custom_color
-- и весь фронтенд (RightPanel, Notes.tsx) полностью поддерживают кастомный тип
-- заметки — сохранение такой заметки падало с 23514 на каждой попытке.
alter table notes drop constraint notes_kind_check;
alter table notes add constraint notes_kind_check
  check (kind in ('idea', 'question', 'todo', 'important', 'custom'));
