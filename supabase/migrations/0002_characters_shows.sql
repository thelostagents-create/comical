-- Adds "characters" and "shows" as additional shared, crowd-sourced catalog
-- tables alongside "series" — browsable from the Discover tab, following the
-- same public-read / creator-write pattern.

create table public.characters (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  image_url text,
  series_id uuid references public.series (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.characters enable row level security;

create policy "characters are publicly readable"
  on public.characters for select
  using (true);

create policy "authenticated users can add characters"
  on public.characters for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "creators can update their characters"
  on public.characters for update
  to authenticated
  using (created_by = auth.uid());

create policy "creators can delete their characters"
  on public.characters for delete
  to authenticated
  using (created_by = auth.uid());

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  network text not null default '',
  description text not null default '',
  image_url text,
  series_id uuid references public.series (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.shows enable row level security;

create policy "shows are publicly readable"
  on public.shows for select
  using (true);

create policy "authenticated users can add shows"
  on public.shows for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "creators can update their shows"
  on public.shows for update
  to authenticated
  using (created_by = auth.uid());

create policy "creators can delete their shows"
  on public.shows for delete
  to authenticated
  using (created_by = auth.uid());

create index characters_series_id_idx on public.characters (series_id);
create index shows_series_id_idx on public.shows (series_id);
