-- Lets a character carry its own publisher/brand (e.g. "Marvel", "DC"),
-- independent of any linked series. Used to keep same-named characters
-- from different universes (e.g. two heroes both called "Captain Marvel")
-- from being blended together in most-read-characters matching.

alter table public.characters
  add column publisher text not null default '';
