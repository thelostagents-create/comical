-- Adds the Fandom feed (tweet-style posts, reactions, hashtags), a
-- "favorite characters" showcase for profiles, and a public Storage bucket
-- so images can be uploaded from the app instead of only pasted as URLs.

-- ---------------------------------------------------------------------------
-- fandom_posts
-- ---------------------------------------------------------------------------
create table public.fandom_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.fandom_posts enable row level security;

create policy "fandom posts are publicly readable"
  on public.fandom_posts for select
  using (true);

create policy "users manage their own fandom posts"
  on public.fandom_posts for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- fandom_post_hashtags (hashtags parsed out of a post's body, for search)
-- ---------------------------------------------------------------------------
create table public.fandom_post_hashtags (
  post_id uuid not null references public.fandom_posts (id) on delete cascade,
  tag text not null,
  primary key (post_id, tag)
);

alter table public.fandom_post_hashtags enable row level security;

create policy "fandom post hashtags are publicly readable"
  on public.fandom_post_hashtags for select
  using (true);

create policy "users manage hashtags on their own fandom posts"
  on public.fandom_post_hashtags for all
  to authenticated
  using (exists (
    select 1 from public.fandom_posts p
    where p.id = post_id and p.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.fandom_posts p
    where p.id = post_id and p.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- fandom_reactions (thumbs up / heart / laugh / wow / sad, one per user+type)
-- ---------------------------------------------------------------------------
create table public.fandom_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fandom_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  reaction text not null check (reaction in ('thumbs_up', 'heart', 'laugh', 'wow', 'sad')),
  created_at timestamptz not null default now(),
  unique (post_id, user_id, reaction)
);

alter table public.fandom_reactions enable row level security;

create policy "fandom reactions are publicly readable"
  on public.fandom_reactions for select
  using (true);

create policy "users manage their own fandom reactions"
  on public.fandom_reactions for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- favorite_characters (a user's showcase of favorite characters, shown on
-- their profile; each favorite can carry its own personalized image)
-- ---------------------------------------------------------------------------
create table public.favorite_characters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  image_url text,
  created_at timestamptz not null default now(),
  unique (user_id, character_id)
);

alter table public.favorite_characters enable row level security;

create policy "favorite characters are publicly readable"
  on public.favorite_characters for select
  using (true);

create policy "users manage their own favorite characters"
  on public.favorite_characters for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- indexes
-- ---------------------------------------------------------------------------
create index fandom_posts_created_at_idx on public.fandom_posts (created_at desc);
create index fandom_post_hashtags_tag_idx on public.fandom_post_hashtags (tag);
create index fandom_reactions_post_id_idx on public.fandom_reactions (post_id);
create index favorite_characters_user_id_idx on public.favorite_characters (user_id);

-- ---------------------------------------------------------------------------
-- storage: a public "images" bucket for uploaded photos (series/character/
-- show covers, journal cover, fandom post photos, favorite character photos)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('images', 'images', true)
on conflict (id) do nothing;

create policy "public read access to the images bucket"
  on storage.objects for select
  using (bucket_id = 'images');

create policy "authenticated users can upload to the images bucket"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'images');

create policy "users can update their own uploads in the images bucket"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'images' and owner = auth.uid());

create policy "users can delete their own uploads in the images bucket"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'images' and owner = auth.uid());
