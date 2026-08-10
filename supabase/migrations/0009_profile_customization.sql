-- Lets a profile look like a real page instead of just initials: an
-- optional banner image behind the avatar, and a short free-text
-- "fandoms" line. Same owner-only update policy as the rest of profiles —
-- no new RLS needed.

alter table public.profiles
  add column banner_url text,
  add column fandoms text not null default '';
