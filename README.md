# Comical

Track what comics you're reading, rate issues and series, and follow other
readers to see their activity — a Goodreads-style tracker for comics.

## Features

- **Shared catalog** — anyone can add a series, issue, character, or show;
  the catalog is crowd-sourced and shared across all users.
- **Personal library** — add series to your shelf with a status (Plan to
  Read / Reading / Completed / Dropped), mark individual issues read/unread,
  see per-series progress, and rate + leave a note right when you add a
  comic.
- **Ratings & reviews** — 1-5 star ratings with an optional written review,
  on series or individual issues.
- **Discover** — browse the catalog across three categories: Comics,
  Characters, and Shows.
- **My Journal** — a pinned first tile in your Library with a custom cover
  image. Opens to your reading stats (issues read, series, most-read
  characters) and a running feed of every "blurb" (written review) you've
  left on a series or issue.
- **Fandom** — a placeholder tab reserved for future fandom hubs.
- **Social** — find and follow other readers from the Feed tab, browse
  their public shelf and stats, and see what people you follow are reading
  and rating.
- **Light/dark mode** — toggle from the top bar; dark is near-black, light
  is a warm beige/cream. Each mode remembers its own accent color.
- **Custom accent color** — pick your own accent color (presets or a hex
  code) from the palette icon in the top bar; it's stored per-device, per
  mode (dark defaults to blue, light defaults to a cotton-candy pink).
- **Accounts** — real email/password auth via Supabase, with a unique
  username per user.

## Run it

```bash
npm install
npm run dev
```

Then open the printed URL (default http://localhost:5173).

```bash
npm run build    # type-check + production build
npm run preview  # preview the production build
```

## Project structure

```
src/
  types.ts             # domain types
  theme.ts              # light/dark mode + per-mode accent color (localStorage)
  auth.tsx             # auth context (session + profile) and sign up/in/out
  lib/
    supabase.ts         # Supabase client
    data.ts              # all reads/writes: series, issues, characters,
                          # shows, library, reads, ratings, follows, feed,
                          # journal blurbs
    journalPrefs.ts       # journal cover image preference (localStorage)
    format.ts              # shared display helpers (timeAgo)
  App.tsx               # tab shell (Library / Fandom / Discover / Feed / Profile)
  components/
    AuthGate.tsx         # login/signup screen, gates the app on a session
    Library.tsx          # your shelf + add-series flow (search/create + rate)
    Journal.tsx           # pinned "My Journal" — stats, top characters, blurbs
    SeriesDetail.tsx      # series info, status, rating, issue list + add issue
    Discover.tsx          # browse Comics / Characters / Shows
    Fandom.tsx             # placeholder tab
    Feed.tsx                # activity from people you follow + find friends
    Profile.tsx              # your or someone else's profile, stats, shelf
    AccentPicker.tsx          # accent color picker modal
    RatingStars.tsx, Modal.tsx, Icons.tsx, Toast.tsx   # shared UI
```

## Backend (Supabase)

This app requires a Supabase project — there's no local/offline mode.

**Setup**

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL editor**, run the migrations in order:
   `supabase/migrations/0001_init.sql` (schema: `profiles`, `series`,
   `issues`, `library_entries`, `reads`, `ratings`, `follows`, row-level
   security, and a trigger that auto-creates a profile row on sign-up), then
   `supabase/migrations/0002_characters_shows.sql` (`characters`, `shows`).
3. Auth → Providers: **Email** should be enabled by default.
4. **Optional but recommended:** in the SQL editor, run `supabase/seed.sql`
   to pre-populate the catalog with 12 well-known series (Saga, Batman, The
   Sandman, Watchmen, Ms. Marvel, Chainsaw Man, Invincible, and more), each
   with a run of issues already logged. Skip this if you'd rather start
   from an empty catalog and add everything yourself.
5. Copy `.env.example` to `.env.local` and fill in your **Project URL** and
   **anon key** (Project Settings → API).
6. `npm run dev`.

### Data model

- `series` / `issues` / `characters` / `shows` are a **shared, crowd-sourced
  catalog** — any signed-in user can add one, readable by everyone.
- `library_entries`, `reads`, and `ratings` are **per-user** rows (each row
  is owned by one `user_id`) but are publicly readable, so profiles and the
  feed can show what other people are doing. Row-level security restricts
  writes to the owning user.
- `follows` is a simple `follower_id -> followee_id` edge table that drives
  the Feed.

## Notes

- Series/issue/character/show images (`cover_url` / `image_url`) are
  accepted as plain URLs; there's no image upload/storage wired up yet —
  entries without one show a letter-tile placeholder instead.
- The accent color is a client-side preference (`localStorage`), not synced
  across devices.
