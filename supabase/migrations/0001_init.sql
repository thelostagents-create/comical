-- Comical schema: profiles, a shared comic catalog (series/issues), and
-- per-user reading state (library shelf, reads, ratings) + follows.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row when someone signs up.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'username', ''),
      split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------------------------------------------------------------------------
-- series (shared, crowd-sourced catalog)
-- ---------------------------------------------------------------------------
create table public.series (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  publisher text not null default '',
  description text not null default '',
  cover_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.series enable row level security;

create policy "series are publicly readable"
  on public.series for select
  using (true);

create policy "authenticated users can add series"
  on public.series for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "creators can update their series"
  on public.series for update
  to authenticated
  using (created_by = auth.uid());

create policy "creators can delete their series"
  on public.series for delete
  to authenticated
  using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- issues (belong to a series)
-- ---------------------------------------------------------------------------
create table public.issues (
  id uuid primary key default gen_random_uuid(),
  series_id uuid not null references public.series (id) on delete cascade,
  issue_number text not null,
  title text not null default '',
  cover_url text,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (series_id, issue_number)
);

alter table public.issues enable row level security;

create policy "issues are publicly readable"
  on public.issues for select
  using (true);

create policy "authenticated users can add issues"
  on public.issues for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "creators can update their issues"
  on public.issues for update
  to authenticated
  using (created_by = auth.uid());

create policy "creators can delete their issues"
  on public.issues for delete
  to authenticated
  using (created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- library_entries (a user's shelf: which series they're tracking + status)
-- ---------------------------------------------------------------------------
create table public.library_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  series_id uuid not null references public.series (id) on delete cascade,
  status text not null default 'plan_to_read'
    check (status in ('reading', 'completed', 'plan_to_read', 'dropped')),
  added_at timestamptz not null default now(),
  unique (user_id, series_id)
);

alter table public.library_entries enable row level security;

create policy "library entries are publicly readable"
  on public.library_entries for select
  using (true);

create policy "users manage their own library entries"
  on public.library_entries for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- reads (a user marking a specific issue as read)
-- ---------------------------------------------------------------------------
create table public.reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  issue_id uuid not null references public.issues (id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (user_id, issue_id)
);

alter table public.reads enable row level security;

create policy "reads are publicly readable"
  on public.reads for select
  using (true);

create policy "users manage their own reads"
  on public.reads for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- ratings (a user's star rating + optional review of a series or issue)
-- ---------------------------------------------------------------------------
create table public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('series', 'issue')),
  target_id uuid not null,
  rating smallint not null check (rating between 1 and 5),
  review text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, target_type, target_id)
);

alter table public.ratings enable row level security;

create policy "ratings are publicly readable"
  on public.ratings for select
  using (true);

create policy "users manage their own ratings"
  on public.ratings for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- follows
-- ---------------------------------------------------------------------------
create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

alter table public.follows enable row level security;

create policy "follows are publicly readable"
  on public.follows for select
  using (true);

create policy "users manage their own follows"
  on public.follows for all
  to authenticated
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid());

-- ---------------------------------------------------------------------------
-- indexes for the queries the app actually runs
-- ---------------------------------------------------------------------------
create index issues_series_id_idx on public.issues (series_id);
create index library_entries_user_id_idx on public.library_entries (user_id);
create index library_entries_series_id_idx on public.library_entries (series_id);
create index reads_user_id_idx on public.reads (user_id, read_at desc);
create index reads_issue_id_idx on public.reads (issue_id);
create index ratings_target_idx on public.ratings (target_type, target_id);
create index follows_followee_id_idx on public.follows (followee_id);
