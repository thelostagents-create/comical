-- Lets a user star a series in their library to pin it to the top of the
-- list — a lightweight "favorite" separate from status/rating. No new RLS
-- policy needed: "users manage their own library entries" (0001_init.sql)
-- already covers updates to any column on a row the user owns.

alter table public.library_entries
  add column starred boolean not null default false;
