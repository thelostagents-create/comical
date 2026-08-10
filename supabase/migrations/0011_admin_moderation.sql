-- Minimal admin moderation: mute (blocks posting) and ban (blocks using
-- the app) flags on profiles, plus letting admins delete any Fandom post
-- or reply instead of just their own.
--
-- There's no in-app way to grant the very first admin (chicken-and-egg —
-- someone has to be admin before an admin panel can promote anyone).
-- After running this migration, make yourself an admin once via the SQL
-- editor:
--   update public.profiles set is_admin = true where username = 'yourname';

alter table public.profiles
  add column is_admin boolean not null default false,
  add column is_muted boolean not null default false,
  add column is_banned boolean not null default false;

-- Additional (OR-ed) permissive policy: admins can delete anyone's post or
-- reply, on top of the existing owner-only policy.
create policy "admins can delete any fandom post"
  on public.fandom_posts for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

create policy "admins can delete any fandom reply"
  on public.fandom_replies for delete
  to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin));

-- Restrictive policies are AND-ed with permissive ones, so these can only
-- take permission away — a muted or banned user's own-post insert policy
-- still exists, but these block it from actually succeeding.
create policy "muted or banned users cannot post"
  on public.fandom_posts as restrictive for insert
  to authenticated
  with check (not exists (
    select 1 from public.profiles p where p.id = auth.uid() and (p.is_muted or p.is_banned)
  ));

create policy "muted or banned users cannot reply"
  on public.fandom_replies as restrictive for insert
  to authenticated
  with check (not exists (
    select 1 from public.profiles p where p.id = auth.uid() and (p.is_muted or p.is_banned)
  ));

-- A narrow RPC instead of a broad "admins can update any profile" policy,
-- so an admin can only flip these two flags on someone else's profile —
-- not edit their bio, username, or anything else.
create function public.set_user_moderation(target_user_id uuid, muted boolean, banned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'not authorized';
  end if;
  update public.profiles set is_muted = muted, is_banned = banned where id = target_user_id;
end;
$$;

grant execute on function public.set_user_moderation(uuid, boolean, boolean) to authenticated;
