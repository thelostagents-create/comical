-- In-app notifications: someone reacted to or replied to your Fandom post,
-- or someone followed you. Insert is open to any authenticated user acting
-- as themselves (actor_id = auth.uid()) since the recipient is someone
-- else entirely — only read/update is restricted to the recipient.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in ('reaction', 'reply', 'follow')),
  post_id uuid references public.fandom_posts (id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "recipients can view their notifications"
  on public.notifications for select
  to authenticated
  using (recipient_id = auth.uid());

create policy "recipients can mark their notifications read"
  on public.notifications for update
  to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

create policy "authenticated users can notify others of their own actions"
  on public.notifications for insert
  to authenticated
  with check (actor_id = auth.uid());

create index notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);
