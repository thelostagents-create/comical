-- A display nickname shown above @username on a profile. Falls back to
-- the username when empty — the handle (@username) itself never changes,
-- this is purely a friendlier display label.

alter table public.profiles
  add column nickname text not null default '';
