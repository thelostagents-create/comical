-- Basic anti-spam: caps how many Fandom posts/replies one person can
-- create in a rolling 60-second window. Enforced in the database, not
-- just the client, via a restrictive insert policy — same AND-with-
-- permissive pattern as the mute/ban block in migration 0011, so it
-- can't be bypassed by hitting the API directly. Each table's count only
-- looks at that table's own rows, so posting and replying have separate
-- budgets.

create policy "rate limit fandom posts"
  on public.fandom_posts as restrictive for insert
  to authenticated
  with check (
    (
      select count(*) from public.fandom_posts
      where user_id = auth.uid() and created_at > now() - interval '60 seconds'
    ) < 5
  );

create policy "rate limit fandom replies"
  on public.fandom_replies as restrictive for insert
  to authenticated
  with check (
    (
      select count(*) from public.fandom_replies
      where user_id = auth.uid() and created_at > now() - interval '60 seconds'
    ) < 5
  );
