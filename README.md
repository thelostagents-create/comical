# Comical

Track what comics you're reading, rate issues and series, and follow other
readers to see their activity — a Goodreads-style tracker for comics.

## Features

- **Shared catalog** — anyone can add a series or issue; the catalog is
  crowd-sourced and shared across all users.
- **Personal library** — add series to your shelf with a status (Plan to
  Read / Reading / Completed / Dropped), mark individual issues read/unread,
  and see per-series progress.
- **Ratings & reviews** — 1-5 star ratings with an optional written review,
  on series or individual issues.
- **Social** — follow other readers, browse their public shelf and stats,
  and see a Feed of what people you follow are reading and rating.
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
  auth.tsx             # auth context (session + profile) and sign up/in/out
  lib/
    supabase.ts         # Supabase client
    data.ts              # all reads/writes: series, issues, library, reads,
                          # ratings, follows, feed
  App.tsx               # tab shell (Library / Discover / Feed / Profile)
  components/
    AuthGate.tsx         # login/signup screen, gates the app on a session
    Library.tsx          # your shelf + add-series flow (search or create)
    SeriesDetail.tsx      # series info, status, rating, issue list + add issue
    Discover.tsx          # search the comic catalog or find/follow people
    Feed.tsx               # activity from people you follow
    Profile.tsx            # your or someone else's profile, stats, shelf
    RatingStars.tsx, Modal.tsx, Icons.tsx   # shared UI
```

## Backend (Supabase)

This app requires a Supabase project — there's no local/offline mode.

**Setup**

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL editor**, run `supabase/migrations/0001_init.sql`. This
   creates the schema (`profiles`, `series`, `issues`, `library_entries`,
   `reads`, `ratings`, `follows`), row-level security policies, and a
   trigger that auto-creates a profile row on sign-up.
3. Auth → Providers: **Email** should be enabled by default.
4. Copy `.env.example` to `.env.local` and fill in your **Project URL** and
   **anon key** (Project Settings → API).
5. `npm run dev`.

### Data model

- `series` / `issues` are a **shared, crowd-sourced catalog** — any signed-in
  user can add a series or issue, readable by everyone.
- `library_entries`, `reads`, and `ratings` are **per-user** rows (each row
  is owned by one `user_id`) but are publicly readable, so profiles and the
  feed can show what other people are doing. Row-level security restricts
  writes to the owning user.
- `follows` is a simple `follower_id -> followee_id` edge table that drives
  the Feed.

## Notes

- Series/issue covers (`cover_url`) are accepted as plain URLs; there's no
  image upload/storage wired up yet — series without a cover show a
  letter-tile placeholder instead.
