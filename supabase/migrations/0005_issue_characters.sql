-- Real per-issue character data pulled from Comic Vine on import, instead of
-- guessing characters from series titles. `characters.comicvine_id` lets
-- imports find-or-create the same character across separate volumes instead
-- of spawning duplicates; `issue_characters` records which characters
-- actually appear in which issue (Comic Vine's own "character_credits").

alter table public.characters
  add column comicvine_id text;

create unique index characters_comicvine_id_idx
  on public.characters (comicvine_id)
  where comicvine_id is not null;

create table public.issue_characters (
  issue_id uuid not null references public.issues (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  primary key (issue_id, character_id)
);

alter table public.issue_characters enable row level security;

create policy "issue characters are publicly readable"
  on public.issue_characters for select
  using (true);

create policy "authenticated users can link issue characters"
  on public.issue_characters for insert
  to authenticated
  with check (true);

create index issue_characters_character_id_idx on public.issue_characters (character_id);
