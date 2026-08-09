-- Optional starter catalog: a curated set of well-known comics so the app
-- isn't empty on first run. Run this in the Supabase SQL editor AFTER
-- 0001_init.sql and 0002_characters_shows.sql. Safe to skip — the app works
-- fine with an empty catalog too, since anyone can add series from the app.
--
-- Run as the project owner (the SQL editor does this by default), so it
-- bypasses the "created_by = auth.uid()" insert policies — created_by is
-- left NULL here, which the schema allows.

with s as (
  insert into public.series (title, publisher, description)
  values ('Saga', 'Image', 'A sprawling space-opera about a family caught between warring civilizations.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 12) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Batman', 'DC', 'The Dark Knight defends Gotham City from an ever-growing rogues gallery.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 12) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('The Sandman', 'DC / Vertigo', 'Dream of the Endless is drawn into the waking world after decades of imprisonment.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 12) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Monstress', 'Image', 'A dark fantasy set in a matriarchal, monster-haunted alternate 1900s Asia.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 8) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Watchmen', 'DC', 'A murder mystery unravels a conspiracy among a retired group of vigilantes.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 12) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Ms. Marvel', 'Marvel', 'Kamala Khan, a Jersey City teenager, discovers she has shapeshifting powers.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 10) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('The Amazing Spider-Man', 'Marvel', 'Peter Parker balances life as a photographer, student, and web-slinger.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 10) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Chainsaw Man', 'Shueisha', 'A young devil hunter merges with his chainsaw devil dog to survive.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 11) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Invincible', 'Image', 'A teenager discovers his father''s heroism has a much darker cost than expected.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 12) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Y: The Last Man', 'Vertigo', 'The last man on Earth after a plague kills every other mammal with a Y chromosome.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 10) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Hellboy', 'Dark Horse', 'A demon raised by humans investigates occult threats for a paranormal agency.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 8) as gs;

with s as (
  insert into public.series (title, publisher, description)
  values ('Fables', 'Vertigo', 'Exiled fairy-tale characters build a secret community hidden in modern New York.')
  returning id
)
insert into public.issues (series_id, issue_number, title)
select id, gs::text, '' from s, generate_series(1, 10) as gs;
