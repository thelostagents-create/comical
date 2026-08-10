# Comical

Track what comics you're reading, rate issues and series, and follow other
readers to see their activity — a Goodreads-style tracker for comics.

## Features

- **Shared catalog** — series, issues, and characters are crowd-sourced and
  shared across all users, primarily populated by Comic Vine imports (see
  below). Discover and "Add a comic" only let you browse/search the
  existing catalog or pull a title in from Comic Vine — there's no
  standalone "create a new series" or "add a character" form (Favorite
  Characters is the one exception, since a favorite needs *some* character
  row to point at).
- **Personal library** — add series to your shelf with a status (Plan to
  Read / Reading / Completed / Dropped), mark individual issues read/unread,
  see per-series progress, and rate + leave a note right when you add a
  comic. Star a series (from its detail page) to pin it to the top of your
  library, marked with a small star badge on its tile. "Add a comic" opens
  showing just the 6 most recently added catalog series — type to search
  the whole catalog, or search Comic Vine directly to pull in a title that
  isn't in the catalog yet.
- **Ratings & reviews** — 1-5 star ratings with an optional written review,
  on series or individual issues.
- **Discover** — browse the catalog across two categories: Comics and
  Characters. Comics opens to the 12 most-recently-added series; Characters
  opens to the 6 most-recently-added (fewer rows to fetch/render before
  you've typed anything); type to search the full catalog. Tap a character
  (here or in Journal's most-read characters) to see their **Comic
  Spotlights** — their top 3 series in the shared catalog by linked-issue
  count (`issue_characters`, from Comic Vine imports), catalog-wide rather
  than just what you've personally read. Use the small pencil button on a
  character's tile to set how that character's photo looks *to you* —
  it's stored on your device only (`localStorage`), never written to the
  shared catalog, so it never changes what anyone else sees.
- **Comic Vine search** — when adding a comic, search Comic Vine's real
  database instead of typing everything by hand, with an optional year
  filter for when a title has multiple runs (e.g. several different
  "Batman" volumes across decades); picking a result imports the title,
  publisher, cover art, description, and its full issue list — plus, for
  every imported issue, the real characters Comic Vine says appear in it
  (`character_credits`), auto-creating/linking catalog characters and
  pulling in a photo for any newly-created one. Optional —
  requires the `comicvine` edge function (see below).
- **My Journal** — a pinned first tile in your Library with a custom cover
  image. Opens to your reading stats (issues read, series, most-read
  characters) and a running feed of every "blurb" (written review) you've
  left on a series or issue. Most-read characters is based only on real
  Comic Vine character data (`character_credits`) for issues you've marked
  read — a character only shows up if Comic Vine actually lists them in
  something you've read, no guessing from series titles. Tap one to see
  every comic run you've read featuring them.
- **Fandom** — a tweet-style feed: post short updates with `#hashtags`,
  react to any post with 👍 ❤️ 😂 😮 😢, reply to a post (replies are
  collapsible), and search hashtags to jump straight to everything posted
  under one.
- **Basic content filter** — posts, replies, and profile bio/fandoms text
  are checked against a profanity/slur wordlist (the `bad-words` package)
  before they're allowed to save; blocked text shows an inline error
  instead of silently posting. Client-side only, so treat it as a
  deterrent for genuine users rather than abuse-proof moderation.
- **Notifications** — a bell icon in the top bar with an unread badge.
  You're notified when someone reacts to or replies to your Fandom post, or
  follows you (never for your own actions on your own stuff). Tap the bell
  to see recent activity and jump to it; opening the list marks it read.
- **Favorite characters** — pick up to 9 favorite characters on your
  profile, each with its own photo (search the catalog or type a new name).
  Tap one to see every comic run you've read that features them, based on
  the same real Comic Vine character data.
- **Customizable profile** — a banner image behind your avatar, an avatar
  photo (paste a URL or upload), and a free-text "fandoms" line, all
  editable from your own profile.
- **Social** — find and follow other readers from the Feed tab, browse
  their stats, and see what people you follow are reading and rating. A
  series page shows just the reader count, not who they are.
- **Light/dark mode** — toggle from the top bar; dark is near-black, light
  is a warm beige/cream. Each mode remembers its own accent color.
- **Custom accent color** — pick your own accent color (presets or a hex
  code) from the palette icon in the top bar; it's stored per-device, per
  mode (dark defaults to blue, light defaults to a cotton-candy pink).
- **Accounts** — real email/password auth via Supabase, with a unique
  username per user and a "Forgot password?" email-reset flow.

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
                          # library, reads, ratings, follows, feed,
                          # journal blurbs, fandom posts/reactions/hashtags,
                          # favorite characters, notifications
    upload.ts             # uploads a File to Supabase Storage, returns its URL
    journalPrefs.ts       # journal cover image preference (localStorage)
    characterImagePrefs.ts # per-device character photo overrides (localStorage)
    contentFilter.ts       # profanity/slur check for user-submitted text
    format.ts              # shared display helpers (timeAgo)
  App.tsx               # tab shell (Library / Fandom / Discover / Feed / Profile)
  components/
    AuthGate.tsx         # login/signup screen, gates the app on a session
    Library.tsx          # your shelf + add-series flow (search/Comic Vine + rate)
    Journal.tsx           # pinned "My Journal" — stats, top characters, blurbs
    SeriesDetail.tsx      # series info, status, rating, issue list + add issue
    Discover.tsx          # browse Comics / Characters
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
   character data from Comic Vine imports), then
   `supabase/migrations/0006_fandom_replies.sql` (adds `fandom_replies`), then
   `supabase/migrations/0007_library_starred.sql` (adds a `starred` column to
   `library_entries`, letting you pin a series to the top of your library),
   then `supabase/migrations/0008_notifications.sql` (adds `notifications`,
   for the reaction/reply/follow bell), then
   `supabase/migrations/0009_profile_customization.sql` (adds `banner_url`
   and `fandoms` to `profiles`).
3. Auth → Providers: **Email** should be enabled by default.
4. For the "Forgot password?" flow to work: Authentication → URL
   Configuration → **Redirect URLs**, add the URL the app is served from
   (e.g. `https://<your-username>.github.io/comical/` for the GitHub Pages
   deploy, or `http://localhost:5173/` for local dev). Without this, the
   reset-password email link won't be allowed to send the user back into
   the app.
5. **Optional but recommended:** in the SQL editor, run `supabase/seed.sql`
   to pre-populate the catalog with 12 well-known series (Saga, Batman, The
   Sandman, Watchmen, Ms. Marvel, Chainsaw Man, Invincible, and more), each
   with a run of issues already logged. Skip this if you'd rather start
   from an empty catalog and add everything yourself.
6. Copy `.env.example` to `.env.local` and fill in your **Project URL** and
   **anon key** (Project Settings → API).
7. `npm run dev`.

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
   limited to 200 requests/hour. Character data (and character photos) only
   come from an issue's/character's own detail endpoint (Comic Vine doesn't
   include either on bulk/list endpoints), so a series import costs roughly
   1 (volume) + 1 per issue (capped at 25, regardless of how many issues the
   series actually has) + 1 per *new* character encountered (capped at 15
   per import) — at most about 40 requests, a fifth of the hourly budget,
   paced in small batches with a delay between them rather than fired all at
   once. Characters already in your catalog don't re-cost a request, and
   issues beyond the 25-issue cap still import fine, just without character
   data.

### Data model

- `series` / `issues` / `characters` are a **shared, crowd-sourced catalog**,
  readable by everyone. (A `shows` table also exists from an earlier version
  of the app; it's no longer used by the UI, kept only so existing data
  isn't dropped.)
- `library_entries`, `reads`, and `ratings` are **per-user** rows (each row
  is owned by one `user_id`) but are publicly readable, so profiles and the
  feed can show what other people are doing. Row-level security restricts
  writes to the owning user. `library_entries.starred` pins a series to the
  top of that user's library (starred first, then most-recently-added).
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
