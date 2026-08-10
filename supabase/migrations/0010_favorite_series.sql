-- Favorite comics on a profile, same pattern as favorite_characters: a
-- capped, ordered pick-list of series a user wants to spotlight. Only
-- series already in the shared catalog can be favorited (enforced
-- client-side by only offering catalog search results, and structurally
-- here by the foreign key to series).

create table public.favorite_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  series_id uuid not null references public.series (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, series_id)
);

alter table public.favorite_series enable row level security;

create policy "favorite series are publicly readable"
  on public.favorite_series for select
  using (true);

create policy "users manage their own favorite series"
  on public.favorite_series for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index favorite_series_user_id_idx on public.favorite_series (user_id, created_at);
