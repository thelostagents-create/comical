-- Lets people reply to a Fandom post (a flat list of replies per post, no
-- nested threading), same public-read / owner-write pattern as everything
-- else in Fandom.

create table public.fandom_replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.fandom_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.fandom_replies enable row level security;

create policy "fandom replies are publicly readable"
  on public.fandom_replies for select
  using (true);

create policy "users manage their own fandom replies"
  on public.fandom_replies for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index fandom_replies_post_id_idx on public.fandom_replies (post_id, created_at);
