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
- **Comic Vine search** — when adding a comic, search Comic Vine's real
  database instead of typing everything by hand; picking a result imports
  the title, publisher, cover art, description, and its full issue list —
  plus, for every imported issue, the real characters Comic Vine says
  appear in it (`character_credits`), auto-creating/linking catalog
  characters. Optional — requires the `comicvine` edge function (see below).
- **My Journal** — a pinned first tile in your Library with a custom cover
  image. Opens to your reading stats (issues read, series, most-read
  characters) and a running feed of every "blurb" (written review) you've
  left on a series or issue. Most-read characters is based only on real
  Comic Vine character data (`character_credits`) for issues you've marked
  read — a character only shows up if Comic Vine actually lists them in
  something you've read, no guessing from series titles.
- **Fandom** — a tweet-style feed: post short updates with `#hashtags`,
  react to any post with 👍 ❤️ 😂 😮 😢, and search hashtags to jump
  straight to everything posted under one.
- **Favorite characters** — pick up to 9 favorite characters on your
  profile, each with its own photo (search the catalog or type a new name).
  Tap one to see every comic run you've read that features them, based on
  the same real Comic Vine character data.
- **Social** — find and follow other readers from the Feed tab, browse
  their stats, and see what people you follow are reading and rating.
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
                          # journal blurbs, fandom posts/reactions/hashtags,
                          # favorite characters
    upload.ts             # uploads a File to Supabase Storage, returns its URL
    journalPrefs.ts       # journal cover image preference (localStorage)
    format.ts              # shared display helpers (timeAgo)
  App.tsx               # tab shell (Library / Fandom / Discover / Feed / Profile)
  components/
    AuthGate.tsx         # login/signup screen, gates the app on a session
    Library.tsx          # your shelf + add-series flow (search/create + rate)
    Journal.tsx           # pinned "My Journal" — stats, top characters, blurbs
    SeriesDetail.tsx      # series info, status, rating, issue list + add issue
    Discover.tsx          # browse Comics / Characters / Shows
    Fandom.tsx             # tweet-style posts, reactions, hashtag search
    Feed.tsx                # activity from people you follow + find friends
    Profile.tsx              # your or someone else's profile, favorite characters
    AccentPicker.tsx          # accent color picker modal
    ImageField.tsx             # image input: paste a URL or import a photo
    RatingStars.tsx, Modal.tsx, Icons.tsx, Toast.tsx   # shared UI
supabase/
  migrations/            # schema (run in order in the SQL editor)
  seed.sql                # optional starter catalog
  functions/comicvine/     # edge function proxying Comic Vine (optional)
```

## Backend (Supabase)

This app requires a Supabase project — there's no local/offline mode.

**Setup**

1. Create a free project at [supabase.com](https://supabase.com).
2. In the **SQL editor**, run the migrations in order:
   `supabase/migrations/0001_init.sql` (schema: `profiles`, `series`,
   `issues`, `library_entries`, `reads`, `ratings`, `follows`, row-level
   security, and a trigger that auto-creates a profile row on sign-up), then
   `supabase/migrations/0002_characters_shows.sql` (`characters`, `shows`),
   then `supabase/migrations/0003_fandom_favorites_storage.sql` (Fandom
   posts/reactions/hashtags, favorite characters, and a public `images`
   Storage bucket + policies so photos can be uploaded from the app), then
   `supabase/migrations/0004_character_publisher.sql` (adds a `publisher`
   column to `characters`), then
   `supabase/migrations/0005_issue_characters.sql` (adds `comicvine_id` to
   `characters` and an `issue_characters` link table for real per-issue
   character data from Comic Vine imports).
3. Auth → Providers: **Email** should be enabled by default.
4. **Optional but recommended:** in the SQL editor, run `supabase/seed.sql`
   to pre-populate the catalog with 12 well-known series (Saga, Batman, The
   Sandman, Watchmen, Ms. Marvel, Chainsaw Man, Invincible, and more), each
   with a run of issues already logged. Skip this if you'd rather start
   from an empty catalog and add everything yourself.
5. Copy `.env.example` to `.env.local` and fill in your **Project URL** and
   **anon key** (Project Settings → API).
6. `npm run dev`.

### Comic Vine search (optional)

Lets "Add a comic" search a real, huge cross-publisher comics database
instead of only your own crowd-sourced catalog, and pulls in real
character-per-issue data (Comic Vine's `character_credits`) that powers
most-read characters and favorite-character runs. Skip this and the rest of
the app works exactly the same — you'll just add series by hand or from
`seed.sql`, and since those have no character data, most-read characters
and favorite-character runs will simply stay empty for them.

1. Get a free API key at
   [comicvine.gamespot.com/api](https://comicvine.gamespot.com/api/) (needs
   a GameSpot/Comic Vine account).
2. Install the [Supabase CLI](https://supabase.com/docs/guides/cli) if you
   don't have it, then from the repo root:
   ```bash
   supabase login
   supabase link --project-ref <your-project-ref>   # find this in your project's URL/settings
   supabase secrets set COMICVINE_API_KEY=<your-key>
   supabase functions deploy comicvine
   ```
3. That's it — no client-side env vars needed, the function URL is derived
   from your existing Supabase project URL. Comic Vine's free tier is rate
   limited to 200 requests/hour; each series import now makes 2 upstream
   Comic Vine requests (volume metadata + issues with character credits)
   instead of 1.

### Data model

- `series` / `issues` / `characters` / `shows` are a **shared, crowd-sourced
  catalog** — any signed-in user can add one, readable by everyone.
- `library_entries`, `reads`, and `ratings` are **per-user** rows (each row
  is owned by one `user_id`) but are publicly readable, so profiles and the
  feed can show what other people are doing. Row-level security restricts
  writes to the owning user.
- `follows` is a simple `follower_id -> followee_id` edge table that drives
  the Feed.
- `fandom_posts` are public tweet-style posts; `fandom_post_hashtags` are
  the `#tags` parsed out of a post's body (used for hashtag search);
  `fandom_reactions` is one row per user/post/reaction-type (👍 ❤️ 😂 😮 😢).
- `favorite_characters` links a user to a character on their profile, with
  its own optional `image_url` so a favorite can have a different photo
  than the shared catalog entry. Capped at 9 per user.
- `issue_characters` links an issue to the characters Comic Vine says
  appear in it (`character_credits`), populated automatically on import —
  this is the *only* source most-read-characters and favorite-character
  runs use; a character with no linked read issues simply doesn't show up.
  `characters.comicvine_id` dedupes the same character across separate
  imports instead of creating a new row every time.

## Notes

- Every image field (series/character/show/journal covers,
  favorite-character photos) accepts either a pasted URL or an uploaded
  file — uploads go to a public `images` bucket in Supabase Storage (see
  migration `0003`).
- The accent color is a client-side preference (`localStorage`), not synced
  across devices.
