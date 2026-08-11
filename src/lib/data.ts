import { supabase } from "./supabase";
import type {
  Character,
  FandomPost,
  FandomReaction,
  FandomReply,
  FavoriteCharacter,
  Follow,
  Issue,
  LibraryEntry,
  LibraryStatus,
  Profile,
  Rating,
  RatingTargetType,
  Read,
  ReactionType,
  Series,
} from "../types";

function db() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

// Used only to avoid creating a duplicate character row on import when an
// existing (manually-added, not yet comicvine-linked) character shares a
// name — an unset publisher on either side is treated as a wildcard.
function publishersCompatible(a: string | undefined, b: string | undefined): boolean {
  const pa = (a ?? "").trim().toLowerCase();
  const pb = (b ?? "").trim().toLowerCase();
  return !pa || !pb || pa === pb;
}

// ---------------------------------------------------------------------------
// series & issues (shared catalog)
// ---------------------------------------------------------------------------

export async function searchSeries(query: string): Promise<Series[]> {
  let q = db().from("series").select("*").order("title");
  const trimmed = query.trim();
  if (trimmed)
    q = q.or(`title.ilike.%${trimmed}%,publisher.ilike.%${trimmed}%,description.ilike.%${trimmed}%`);
  const { data, error } = await q.limit(15);
  if (error) throw error;
  return data ?? [];
}

// Default view of "Add a comic" before the user types anything — just the
// newest additions, not the whole catalog, so opening the modal doesn't pull
// every series in the shared catalog. Actually searching still checks the
// full catalog via searchSeries above.
export async function fetchRecentSeries(limit = 6): Promise<Series[]> {
  const { data, error } = await db()
    .from("series")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function getSeries(seriesId: string): Promise<Series> {
  const { data, error } = await db().from("series").select("*").eq("id", seriesId).single();
  if (error) throw error;
  return data;
}

export async function createSeries(input: {
  title: string;
  publisher: string;
  description: string;
  cover_url: string | null;
  start_year: string | null;
  created_by: string;
}): Promise<Series> {
  const { data, error } = await db().from("series").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function listIssues(seriesId: string): Promise<Issue[]> {
  const { data, error } = await db()
    .from("issues")
    .select("*")
    .eq("series_id", seriesId)
    .order("created_at");
  if (error) throw error;
  return data ?? [];
}

export async function createIssue(input: {
  series_id: string;
  issue_number: string;
  title: string;
  cover_url: string | null;
  created_by: string;
}): Promise<Issue> {
  const { data, error } = await db().from("issues").insert(input).select().single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// characters & shows (shared catalog, browsable from Discover)
// ---------------------------------------------------------------------------

export async function searchCharacters(query: string): Promise<Character[]> {
  let q = db().from("characters").select("*").order("name");
  const trimmed = query.trim();
  if (trimmed) q = q.or(`name.ilike.%${trimmed}%,description.ilike.%${trimmed}%`);
  const { data, error } = await q.limit(15);
  if (error) throw error;
  return data ?? [];
}

// Default view of Discover's Characters tab before the user types anything —
// mirrors fetchRecentSeries, so opening the tab doesn't pull the whole
// catalog. Actually searching still checks everything via searchCharacters.
export async function fetchRecentCharacters(limit = 6): Promise<Character[]> {
  const { data, error } = await db()
    .from("characters")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function createCharacter(input: {
  name: string;
  description: string;
  image_url: string | null;
  publisher: string;
  comicvine_id?: string | null;
  series_id: string | null;
  created_by: string;
}): Promise<Character> {
  const { data, error } = await db().from("characters").insert(input).select().single();
  if (error) throw error;
  return data;
}

// Finds the character Comic Vine says this is (by comicvine_id, falling
// back to a same-name/compatible-publisher match for characters added
// before this linking existed), or creates a new one. `fetchImage: false`
// skips the extra Comic Vine request for a photo — used to cap how many
// image lookups a single import can rack up.
export async function findOrCreateComicVineCharacter(input: {
  comicvineId: string;
  name: string;
  publisher: string;
  created_by: string;
  fetchImage?: boolean;
}): Promise<Character> {
  const fetchImage = input.fetchImage ?? true;
  const { data: byId, error: byIdErr } = await db()
    .from("characters")
    .select("*")
    .eq("comicvine_id", input.comicvineId)
    .maybeSingle();
  if (byIdErr) throw byIdErr;
  if (byId) return byId.image_url || !fetchImage ? byId : backfillCharacterImage(byId, input.comicvineId);

  const { data: nameMatches, error: nameErr } = await db()
    .from("characters")
    .select("*")
    .ilike("name", input.name)
    .is("comicvine_id", null);
  if (nameErr) throw nameErr;
  const existing = (nameMatches ?? []).find((c) => publishersCompatible(c.publisher, input.publisher));
  if (existing) {
    // Best-effort: tag it with the comicvine_id (and a photo, if it's
    // missing one) so future imports find it directly. RLS only allows the
    // creator to update it, so this silently no-ops for characters other
    // users made — the name-match fallback above still finds it next time.
    try {
      const imageUrl =
        existing.image_url ?? (fetchImage ? (await getComicVineCharacter(input.comicvineId).catch(() => null))?.imageUrl : null) ?? null;
      const { data: updated, error: updateErr } = await db()
        .from("characters")
        .update({ comicvine_id: input.comicvineId, publisher: existing.publisher || input.publisher, image_url: imageUrl })
        .eq("id", existing.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      return updated;
    } catch {
      return existing;
    }
  }

  const cvCharacter = fetchImage ? await getComicVineCharacter(input.comicvineId).catch(() => null) : null;
  return createCharacter({
    name: input.name,
    description: "",
    image_url: cvCharacter?.imageUrl ?? null,
    publisher: input.publisher,
    comicvine_id: input.comicvineId,
    series_id: null,
    created_by: input.created_by,
  });
}

// A character already linked by comicvine_id (from an earlier import,
// possibly before photo-fetching existed) still gets its photo filled in
// the next time it's encountered, instead of only ever happening once at
// creation time.
async function backfillCharacterImage(character: Character, comicvineId: string): Promise<Character> {
  try {
    const cvCharacter = await getComicVineCharacter(comicvineId).catch(() => null);
    if (!cvCharacter?.imageUrl) return character;
    const { data: updated, error } = await db()
      .from("characters")
      .update({ image_url: cvCharacter.imageUrl })
      .eq("id", character.id)
      .select()
      .single();
    if (error) throw error;
    return updated;
  } catch {
    return character;
  }
}

export async function linkIssueCharacters(issueId: string, characterIds: string[]) {
  if (characterIds.length === 0) return;
  const { error } = await db()
    .from("issue_characters")
    .upsert(
      characterIds.map((character_id) => ({ issue_id: issueId, character_id })),
      { onConflict: "issue_id,character_id", ignoreDuplicates: true },
    );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// library (per-user shelf)
// ---------------------------------------------------------------------------

export interface LibraryRow extends LibraryEntry {
  series: Series;
  issueCount: number;
  readCount: number;
}

// limit/offset are optional so callers that need the whole library (e.g.
// cross-referencing a character's runs) keep getting everything, while the
// Library page itself can page through 50 at a time.
export async function fetchLibrary(userId: string, limit?: number, offset = 0): Promise<LibraryRow[]> {
  let q = db()
    .from("library_entries")
    .select("*, series(*)")
    .eq("user_id", userId)
    .order("starred", { ascending: false })
    .order("added_at", { ascending: false });
  if (limit !== undefined) q = q.range(offset, offset + limit - 1);
  const { data: entries, error } = await q;
  if (error) throw error;
  const rows = (entries ?? []) as (LibraryEntry & { series: Series })[];
  if (rows.length === 0) return [];

  const seriesIds = rows.map((r) => r.series_id);
  const { data: issues, error: issuesErr } = await db()
    .from("issues")
    .select("id, series_id")
    .in("series_id", seriesIds);
  if (issuesErr) throw issuesErr;

  const { data: reads, error: readsErr } = await db()
    .from("reads")
    .select("issue_id, issues!inner(series_id)")
    .eq("user_id", userId)
    .in("issues.series_id", seriesIds);
  if (readsErr) throw readsErr;

  const issueCountBySeries = new Map<string, number>();
  for (const i of issues ?? []) {
    issueCountBySeries.set(i.series_id, (issueCountBySeries.get(i.series_id) ?? 0) + 1);
  }
  const readCountBySeries = new Map<string, number>();
  for (const r of (reads ?? []) as unknown as { issues: { series_id: string } }[]) {
    const sid = r.issues.series_id;
    readCountBySeries.set(sid, (readCountBySeries.get(sid) ?? 0) + 1);
  }

  return rows.map((r) => ({
    ...r,
    issueCount: issueCountBySeries.get(r.series_id) ?? 0,
    readCount: readCountBySeries.get(r.series_id) ?? 0,
  }));
}

export async function fetchSeriesReaderCount(seriesId: string): Promise<number> {
  const { count, error } = await db()
    .from("library_entries")
    .select("id", { count: "exact", head: true })
    .eq("series_id", seriesId);
  if (error) throw error;
  return count ?? 0;
}

export async function getLibraryEntry(
  userId: string,
  seriesId: string,
): Promise<LibraryEntry | null> {
  const { data, error } = await db()
    .from("library_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("series_id", seriesId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function addToLibrary(
  userId: string,
  seriesId: string,
  status: LibraryStatus = "plan_to_read",
): Promise<LibraryEntry> {
  const { data, error } = await db()
    .from("library_entries")
    .upsert({ user_id: userId, series_id: seriesId, status }, { onConflict: "user_id,series_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLibraryStatus(entryId: string, status: LibraryStatus) {
  const { error } = await db().from("library_entries").update({ status }).eq("id", entryId);
  if (error) throw error;
}

export async function removeFromLibrary(entryId: string) {
  const { error } = await db().from("library_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export async function setLibraryStarred(entryId: string, starred: boolean) {
  const { error } = await db().from("library_entries").update({ starred }).eq("id", entryId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// reads
// ---------------------------------------------------------------------------

export async function listMyReadsForSeries(userId: string, seriesId: string): Promise<Read[]> {
  const { data, error } = await db()
    .from("reads")
    .select("*, issues!inner(series_id)")
    .eq("user_id", userId)
    .eq("issues.series_id", seriesId);
  if (error) throw error;
  return data ?? [];
}

export async function markRead(userId: string, issueId: string) {
  const { error } = await db()
    .from("reads")
    .upsert({ user_id: userId, issue_id: issueId }, { onConflict: "user_id,issue_id" });
  if (error) throw error;
}

export async function markUnread(userId: string, issueId: string) {
  const { error } = await db()
    .from("reads")
    .delete()
    .eq("user_id", userId)
    .eq("issue_id", issueId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// ratings
// ---------------------------------------------------------------------------

export async function fetchRatingSummary(
  targetType: RatingTargetType,
  targetId: string,
): Promise<{ average: number | null; count: number }> {
  const { data, error } = await db()
    .from("ratings")
    .select("rating")
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error) throw error;
  const ratings = (data ?? []).map((r) => r.rating);
  if (ratings.length === 0) return { average: null, count: 0 };
  return {
    average: ratings.reduce((a, b) => a + b, 0) / ratings.length,
    count: ratings.length,
  };
}

export async function fetchMyRating(
  userId: string,
  targetType: RatingTargetType,
  targetId: string,
): Promise<Rating | null> {
  const { data, error } = await db()
    .from("ratings")
    .select("*")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertRating(input: {
  user_id: string;
  target_type: RatingTargetType;
  target_id: string;
  rating: number;
  review: string;
}) {
  const { error } = await db()
    .from("ratings")
    .upsert(
      { ...input, updated_at: new Date().toISOString() },
      { onConflict: "user_id,target_type,target_id" },
    );
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// profiles & follows
// ---------------------------------------------------------------------------

export async function searchProfiles(query: string, excludeUserId?: string): Promise<Profile[]> {
  let q = db().from("profiles").select("*").order("username").limit(30);
  if (query.trim()) q = q.ilike("username", `%${query.trim()}%`);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).filter((p) => p.id !== excludeUserId);
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await db().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile(
  userId: string,
  patch: {
    bio?: string;
    avatar_url?: string | null;
    banner_url?: string | null;
    fandoms?: string;
    nickname?: string;
  },
) {
  const { error } = await db().from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

// Admin-only: flips a user's is_muted/is_banned flags via a narrow RPC
// (see migration 0011) rather than a broad profile-update grant — the
// database itself re-checks the caller is an admin, so this can't be
// abused even if the client-side is_admin gate were bypassed.
export async function adminSetUserModeration(targetUserId: string, muted: boolean, banned: boolean) {
  const { error } = await db().rpc("set_user_moderation", {
    target_user_id: targetUserId,
    muted,
    banned,
  });
  if (error) throw error;
}

export async function fetchFollowing(userId: string): Promise<Follow[]> {
  const { data, error } = await db().from("follows").select("*").eq("follower_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchFollowers(userId: string): Promise<Follow[]> {
  const { data, error } = await db().from("follows").select("*").eq("followee_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function follow(followerId: string, followeeId: string) {
  const { error } = await db()
    .from("follows")
    .insert({ follower_id: followerId, followee_id: followeeId });
  if (error) throw error;
  await createNotification(followeeId, followerId, "follow", null);
}

export async function unfollow(followerId: string, followeeId: string) {
  const { error } = await db()
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("followee_id", followeeId);
  if (error) throw error;
}

export async function profileStats(userId: string) {
  const [{ count: seriesCount }, { count: readCount }] = await Promise.all([
    db()
      .from("library_entries")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    db().from("reads").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);
  return { seriesCount: seriesCount ?? 0, readCount: readCount ?? 0 };
}

export interface ReadHistoryEntry {
  id: string;
  readAt: string;
  issue: Issue;
  series: Series;
}

// Your own reading history, most-recently-read first, one page at a time —
// nothing is fetched until Journal's history section is expanded, and each
// subsequent page is only fetched when the user explicitly asks to see
// more, so this never turns into a single unbounded fetch for a heavy
// reader. The caller (Journal) also stops offering further pages past a
// hard cap.
export async function fetchReadHistory(userId: string, limit = 100, offset = 0): Promise<ReadHistoryEntry[]> {
  const { data, error } = await db()
    .from("reads")
    .select("id, read_at, issues(*, series(*))")
    .eq("user_id", userId)
    .order("read_at", { ascending: false })
    .range(offset, offset + limit - 1);
  if (error) throw error;
  return ((data ?? []) as unknown as { id: string; read_at: string; issues: Issue & { series: Series } }[])
    .filter((r) => r.issues && r.issues.series)
    .map((r) => ({ id: r.id, readAt: r.read_at, issue: r.issues, series: r.issues.series }));
}

// ---------------------------------------------------------------------------
// feed (activity from people you follow)
// ---------------------------------------------------------------------------

export type FeedItem =
  | { kind: "read"; id: string; at: string; profile: Profile; issue: Issue; series: Series }
  | {
      kind: "rating";
      id: string;
      at: string;
      profile: Profile;
      rating: Rating;
      label: string;
    };

export async function fetchFeed(userId: string, limit = 50): Promise<FeedItem[]> {
  const following = await fetchFollowing(userId);
  const ids = following.map((f) => f.followee_id);
  if (ids.length === 0) return [];

  const [{ data: reads, error: readsErr }, { data: ratings, error: ratingsErr }] =
    await Promise.all([
      db()
        .from("reads")
        .select("id, read_at, user_id, issues(*, series(*))")
        .in("user_id", ids)
        .order("read_at", { ascending: false })
        .limit(limit),
      db()
        .from("ratings")
        .select("*")
        .in("user_id", ids)
        .order("updated_at", { ascending: false })
        .limit(limit),
    ]);
  if (readsErr) throw readsErr;
  if (ratingsErr) throw ratingsErr;

  const { data: profiles, error: profilesErr } = await db()
    .from("profiles")
    .select("*")
    .in("id", ids);
  if (profilesErr) throw profilesErr;
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const readItems: FeedItem[] = (
    (reads ?? []) as unknown as {
      id: string;
      read_at: string;
      user_id: string;
      issues: Issue & { series: Series };
    }[]
  )
    .filter((r) => r.issues && profileById.get(r.user_id))
    .map((r) => ({
      kind: "read",
      id: r.id,
      at: r.read_at,
      profile: profileById.get(r.user_id)!,
      issue: r.issues,
      series: r.issues.series,
    }));

  const labelByRatingId = await labelRatings(ratings ?? []);
  const ratingItems: FeedItem[] = (ratings ?? [])
    .filter((r) => profileById.get(r.user_id))
    .map((r) => ({
      kind: "rating",
      id: r.id,
      at: r.updated_at,
      profile: profileById.get(r.user_id)!,
      rating: r,
      label: labelByRatingId.get(r.id) ?? (r.target_type === "series" ? "a series" : "an issue"),
    }));

  return [...readItems, ...ratingItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}

// ---------------------------------------------------------------------------
// journal (a user's own written reviews, plus reading stats)
// ---------------------------------------------------------------------------

async function labelRatings(ratings: Rating[]): Promise<Map<string, string>> {
  const targetSeriesIds = ratings.filter((r) => r.target_type === "series").map((r) => r.target_id);
  const targetIssueIds = ratings.filter((r) => r.target_type === "issue").map((r) => r.target_id);

  const seriesTitleById = new Map<string, string>();
  if (targetSeriesIds.length) {
    const { data } = await db().from("series").select("id, title").in("id", targetSeriesIds);
    for (const s of data ?? []) seriesTitleById.set(s.id, s.title);
  }

  const issueLabelById = new Map<string, string>();
  if (targetIssueIds.length) {
    const { data } = await db()
      .from("issues")
      .select("id, issue_number, series(title)")
      .in("id", targetIssueIds);
    for (const i of (data ?? []) as unknown as {
      id: string;
      issue_number: string;
      series: { title: string } | { title: string }[] | null;
    }[]) {
      const s = Array.isArray(i.series) ? i.series[0] : i.series;
      issueLabelById.set(i.id, `${s?.title ?? "Unknown"} #${i.issue_number}`);
    }
  }

  const labelById = new Map<string, string>();
  for (const r of ratings) {
    labelById.set(
      r.id,
      r.target_type === "series"
        ? seriesTitleById.get(r.target_id) ?? "a series"
        : issueLabelById.get(r.target_id) ?? "an issue",
    );
  }
  return labelById;
}

export interface Blurb {
  id: string;
  at: string;
  rating: number;
  review: string;
  label: string;
  targetType: RatingTargetType;
  targetId: string;
}

export async function fetchMyBlurbs(userId: string): Promise<Blurb[]> {
  const { data, error } = await db()
    .from("ratings")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const withReview = (data ?? []).filter((r) => r.review.trim().length > 0);
  if (withReview.length === 0) return [];

  const labelByRatingId = await labelRatings(withReview);
  return withReview.map((r) => ({
    id: r.id,
    at: r.updated_at,
    rating: r.rating,
    review: r.review,
    targetType: r.target_type,
    targetId: r.target_id,
    label: labelByRatingId.get(r.id) ?? (r.target_type === "series" ? "a series" : "an issue"),
  }));
}


// ---------------------------------------------------------------------------
// Comic Vine (external catalog search, via the "comicvine" edge function)
// ---------------------------------------------------------------------------

export interface ComicVineVolume {
  id: string;
  name: string;
  publisher: string;
  imageUrl: string | null;
  startYear: string | null;
  issueCount: number | null;
  description: string;
}

export interface ComicVineIssue {
  id: string;
  issueNumber: string;
  title: string;
  characters: { comicvineId: string; name: string }[];
}

async function invokeComicVine<T>(query: string): Promise<T> {
  const { data, error } = await db().functions.invoke(`comicvine?${query}`, { method: "GET" });
  if (error) throw error;
  return data as T;
}

export async function searchComicVine(query: string): Promise<ComicVineVolume[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const { results } = await invokeComicVine<{ results: (ComicVineVolume | null)[] }>(
    `resource=search&query=${encodeURIComponent(trimmed)}`,
  );
  return results.filter((v): v is ComicVineVolume => v !== null);
}

export async function getComicVineVolume(
  id: string,
): Promise<{ volume: ComicVineVolume | null; issues: ComicVineIssue[]; characterFetchWarning: string | null }> {
  return invokeComicVine(`resource=volume&id=${encodeURIComponent(id)}`);
}

export interface ComicVineCharacter {
  id: string;
  name: string;
  imageUrl: string | null;
}

export async function getComicVineCharacter(id: string): Promise<ComicVineCharacter | null> {
  const { character } = await invokeComicVine<{ character: ComicVineCharacter | null }>(
    `resource=character&id=${encodeURIComponent(id)}`,
  );
  return character;
}

// ---------------------------------------------------------------------------
// fandom (tweet-style posts, reactions, hashtags)
// ---------------------------------------------------------------------------

const HASHTAG_RE = /#([a-z0-9_]+)/gi;

function extractHashtags(body: string): string[] {
  const tags = new Set<string>();
  for (const match of body.matchAll(HASHTAG_RE)) tags.add(match[1].toLowerCase());
  return [...tags];
}

export interface FandomPostRow extends FandomPost {
  profile: Profile;
  reactionCounts: Partial<Record<ReactionType, number>>;
  myReactions: ReactionType[];
  hashtags: string[];
  replyCount: number;
}

async function hydratePosts(posts: FandomPost[], currentUserId: string): Promise<FandomPostRow[]> {
  if (posts.length === 0) return [];
  const postIds = posts.map((p) => p.id);
  const userIds = [...new Set(posts.map((p) => p.user_id))];

  const [
    { data: profiles, error: profilesErr },
    { data: reactions, error: reactionsErr },
    { data: hashtags, error: hashtagsErr },
    { data: replies, error: repliesErr },
  ] = await Promise.all([
    db().from("profiles").select("*").in("id", userIds),
    db().from("fandom_reactions").select("*").in("post_id", postIds),
    db().from("fandom_post_hashtags").select("*").in("post_id", postIds),
    db().from("fandom_replies").select("post_id").in("post_id", postIds),
  ]);
  if (profilesErr) throw profilesErr;
  if (reactionsErr) throw reactionsErr;
  if (hashtagsErr) throw hashtagsErr;
  if (repliesErr) throw repliesErr;

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const reactionCountsByPost = new Map<string, Partial<Record<ReactionType, number>>>();
  const myReactionsByPost = new Map<string, ReactionType[]>();
  for (const r of (reactions ?? []) as FandomReaction[]) {
    const counts = reactionCountsByPost.get(r.post_id) ?? {};
    counts[r.reaction] = (counts[r.reaction] ?? 0) + 1;
    reactionCountsByPost.set(r.post_id, counts);
    if (r.user_id === currentUserId) {
      const mine = myReactionsByPost.get(r.post_id) ?? [];
      mine.push(r.reaction);
      myReactionsByPost.set(r.post_id, mine);
    }
  }

  const hashtagsByPost = new Map<string, string[]>();
  for (const h of (hashtags ?? []) as { post_id: string; tag: string }[]) {
    const tags = hashtagsByPost.get(h.post_id) ?? [];
    tags.push(h.tag);
    hashtagsByPost.set(h.post_id, tags);
  }

  const replyCountByPost = new Map<string, number>();
  for (const r of (replies ?? []) as { post_id: string }[]) {
    replyCountByPost.set(r.post_id, (replyCountByPost.get(r.post_id) ?? 0) + 1);
  }

  return posts
    .filter((p) => profileById.get(p.user_id))
    .map((p) => ({
      ...p,
      profile: profileById.get(p.user_id)!,
      reactionCounts: reactionCountsByPost.get(p.id) ?? {},
      myReactions: myReactionsByPost.get(p.id) ?? [],
      hashtags: hashtagsByPost.get(p.id) ?? [],
      replyCount: replyCountByPost.get(p.id) ?? 0,
    }));
}

export async function fetchFandomPosts(currentUserId: string, limit = 50): Promise<FandomPostRow[]> {
  const { data: posts, error } = await db()
    .from("fandom_posts")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return hydratePosts(posts ?? [], currentUserId);
}

export async function searchFandomPostsByHashtag(
  tag: string,
  currentUserId: string,
  limit = 50,
): Promise<FandomPostRow[]> {
  const normalized = tag.trim().toLowerCase().replace(/^#/, "");
  if (!normalized) return [];
  const { data: matches, error } = await db()
    .from("fandom_post_hashtags")
    .select("post_id")
    .eq("tag", normalized)
    .limit(limit);
  if (error) throw error;
  const postIds = [...new Set((matches ?? []).map((m) => m.post_id))];
  if (postIds.length === 0) return [];
  const { data: posts, error: postsErr } = await db()
    .from("fandom_posts")
    .select("*")
    .in("id", postIds)
    .order("created_at", { ascending: false });
  if (postsErr) throw postsErr;
  return hydratePosts(posts ?? [], currentUserId);
}

export async function searchHashtags(query: string, limit = 12): Promise<{ tag: string; count: number }[]> {
  const trimmed = query.trim().toLowerCase().replace(/^#/, "");
  let q = db().from("fandom_post_hashtags").select("tag");
  if (trimmed) q = q.ilike("tag", `${trimmed}%`);
  const { data, error } = await q.limit(500);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { tag: string }[]) counts.set(row.tag, (counts.get(row.tag) ?? 0) + 1);
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, limit);
}

export async function createFandomPost(input: {
  user_id: string;
  body: string;
  image_url: string | null;
}): Promise<FandomPost> {
  const { data: post, error } = await db().from("fandom_posts").insert(input).select().single();
  if (error) throw error;
  const tags = extractHashtags(input.body);
  if (tags.length > 0) {
    const { error: tagErr } = await db()
      .from("fandom_post_hashtags")
      .insert(tags.map((tag) => ({ post_id: post.id, tag })));
    if (tagErr) throw tagErr;
  }
  return post;
}

export async function deleteFandomPost(postId: string) {
  const { error } = await db().from("fandom_posts").delete().eq("id", postId);
  if (error) throw error;
}

export interface FandomReplyRow extends FandomReply {
  profile: Profile;
}

export async function fetchReplies(postId: string): Promise<FandomReplyRow[]> {
  const { data: replies, error } = await db()
    .from("fandom_replies")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!replies || replies.length === 0) return [];

  const userIds = [...new Set(replies.map((r) => r.user_id))];
  const { data: profiles, error: profilesErr } = await db().from("profiles").select("*").in("id", userIds);
  if (profilesErr) throw profilesErr;
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return replies.filter((r) => profileById.get(r.user_id)).map((r) => ({ ...r, profile: profileById.get(r.user_id)! }));
}

export async function createFandomReply(input: {
  post_id: string;
  user_id: string;
  body: string;
  postOwnerId: string;
}): Promise<FandomReply> {
  const { postOwnerId, ...row } = input;
  const { data, error } = await db().from("fandom_replies").insert(row).select().single();
  if (error) throw error;
  await createNotification(postOwnerId, input.user_id, "reply", input.post_id);
  return data;
}

export async function deleteFandomReply(replyId: string) {
  const { error } = await db().from("fandom_replies").delete().eq("id", replyId);
  if (error) throw error;
}

export async function toggleReaction(
  postId: string,
  userId: string,
  reaction: ReactionType,
  currentlyActive: boolean,
  postOwnerId: string,
) {
  if (currentlyActive) {
    const { error } = await db()
      .from("fandom_reactions")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", userId)
      .eq("reaction", reaction);
    if (error) throw error;
  } else {
    const { error } = await db()
      .from("fandom_reactions")
      .insert({ post_id: postId, user_id: userId, reaction });
    if (error) throw error;
    await createNotification(postOwnerId, userId, "reaction", postId);
  }
}

// ---------------------------------------------------------------------------
// favorite characters (a user's showcase, shown on their profile)
// ---------------------------------------------------------------------------

export const MAX_FAVORITE_CHARACTERS = 9;

export interface FavoriteCharacterRow extends FavoriteCharacter {
  character: Character;
}

export async function fetchFavoriteCharacters(userId: string): Promise<FavoriteCharacterRow[]> {
  const { data, error } = await db()
    .from("favorite_characters")
    .select("*, character:characters(*)")
    .eq("user_id", userId)
    .order("created_at")
    .limit(MAX_FAVORITE_CHARACTERS);
  if (error) throw error;
  return (data ?? []) as unknown as FavoriteCharacterRow[];
}

export async function addFavoriteCharacter(input: {
  user_id: string;
  character_id: string;
  image_url: string | null;
}): Promise<FavoriteCharacterRow> {
  const { data, error } = await db()
    .from("favorite_characters")
    .insert(input)
    .select("*, character:characters(*)")
    .single();
  if (error) throw error;
  return data as unknown as FavoriteCharacterRow;
}

export async function removeFavoriteCharacter(id: string) {
  const { error } = await db().from("favorite_characters").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// favorite comics
// ---------------------------------------------------------------------------

export const MAX_FAVORITE_SERIES = 9;

export interface FavoriteSeriesRow {
  id: string;
  series_id: string;
  series: Series;
}

export async function fetchFavoriteSeries(userId: string): Promise<FavoriteSeriesRow[]> {
  const { data, error } = await db()
    .from("favorite_series")
    .select("*, series(*)")
    .eq("user_id", userId)
    .order("created_at")
    .limit(MAX_FAVORITE_SERIES);
  if (error) throw error;
  return (data ?? []) as unknown as FavoriteSeriesRow[];
}

export async function addFavoriteSeries(userId: string, seriesId: string): Promise<FavoriteSeriesRow> {
  const { data, error } = await db()
    .from("favorite_series")
    .insert({ user_id: userId, series_id: seriesId })
    .select("*, series(*)")
    .single();
  if (error) throw error;
  return data as unknown as FavoriteSeriesRow;
}

export async function removeFavoriteSeries(id: string) {
  const { error } = await db().from("favorite_series").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// character appearances — real per-issue character data pulled from Comic
// Vine on import (issue_characters), as opposed to guessing from titles.
// ---------------------------------------------------------------------------

export interface CharacterAppearance {
  characterId: string;
  issueId: string;
  seriesId: string;
}

export async function fetchReadCharacterAppearances(userId: string): Promise<CharacterAppearance[]> {
  const { data: readRows, error: readsErr } = await db().from("reads").select("issue_id").eq("user_id", userId);
  if (readsErr) throw readsErr;
  const issueIds = [...new Set((readRows ?? []).map((r) => r.issue_id))];
  if (issueIds.length === 0) return [];

  const { data: links, error: linksErr } = await db()
    .from("issue_characters")
    .select("issue_id, character_id, issues!inner(series_id)")
    .in("issue_id", issueIds);
  if (linksErr) throw linksErr;

  return ((links ?? []) as unknown as { issue_id: string; character_id: string; issues: { series_id: string } }[]).map(
    (l) => ({ characterId: l.character_id, issueId: l.issue_id, seriesId: l.issues.series_id }),
  );
}

// Every comic run (library row) featuring a character, based only on real
// issue_characters links for issues you've actually marked read.
export async function fetchCharacterRuns(
  userId: string,
  character: Character,
  library: LibraryRow[],
): Promise<LibraryRow[]> {
  const appearances = await fetchReadCharacterAppearances(userId);
  const seriesIds = new Set(appearances.filter((a) => a.characterId === character.id).map((a) => a.seriesId));
  return library.filter((row) => seriesIds.has(row.series_id) && row.readCount > 0);
}

export async function fetchCharactersByIds(ids: string[]): Promise<Character[]> {
  if (ids.length === 0) return [];
  const { data, error } = await db().from("characters").select("*").in("id", ids);
  if (error) throw error;
  return data ?? [];
}

export interface CharacterSpotlight {
  series: Series;
  issueCount: number;
}

// A character's main comics across the whole shared catalog, not just what
// the current user has personally read — ranked by how many linked issues
// each series has (issue_characters), so the series they show up in most
// surface first. Used for Discover's "Comic Spotlights".
export async function fetchCharacterSpotlights(characterId: string, limit = 6): Promise<CharacterSpotlight[]> {
  const { data: links, error: linksErr } = await db()
    .from("issue_characters")
    .select("issue_id, issues!inner(series_id)")
    .eq("character_id", characterId);
  if (linksErr) throw linksErr;

  const countBySeriesId = new Map<string, number>();
  for (const l of (links ?? []) as unknown as { issue_id: string; issues: { series_id: string } }[]) {
    const seriesId = l.issues.series_id;
    countBySeriesId.set(seriesId, (countBySeriesId.get(seriesId) ?? 0) + 1);
  }
  if (countBySeriesId.size === 0) return [];

  const topSeriesIds = [...countBySeriesId.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const { data: seriesRows, error: seriesErr } = await db().from("series").select("*").in("id", topSeriesIds);
  if (seriesErr) throw seriesErr;
  const seriesById = new Map((seriesRows ?? []).map((s) => [s.id, s]));

  return topSeriesIds
    .filter((id) => seriesById.get(id))
    .map((id) => ({ series: seriesById.get(id)!, issueCount: countBySeriesId.get(id)! }));
}

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------

export type NotificationType = "reaction" | "reply" | "follow";

export interface NotificationRow {
  id: string;
  type: NotificationType;
  post_id: string | null;
  read: boolean;
  created_at: string;
  actor: Profile;
}

// Never notifies yourself (e.g. reacting to your own post) — silently a
// no-op in that case rather than an error, since callers don't need to
// special-case it themselves.
async function createNotification(
  recipientId: string,
  actorId: string,
  type: NotificationType,
  postId: string | null,
) {
  if (recipientId === actorId) return;
  const { error } = await db()
    .from("notifications")
    .insert({ recipient_id: recipientId, actor_id: actorId, type, post_id: postId });
  if (error) throw error;
}

export async function fetchNotifications(userId: string, limit = 30): Promise<NotificationRow[]> {
  const { data, error } = await db()
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  const rows = data ?? [];
  const actorIds = [...new Set(rows.map((r) => r.actor_id))];
  const { data: actors, error: actorsErr } =
    actorIds.length > 0
      ? await db().from("profiles").select("*").in("id", actorIds)
      : { data: [] as Profile[], error: null };
  if (actorsErr) throw actorsErr;
  const actorById = new Map((actors ?? []).map((a) => [a.id, a]));
  return rows.filter((r) => actorById.get(r.actor_id)).map((r) => ({ ...r, actor: actorById.get(r.actor_id)! }));
}

export async function fetchUnreadNotificationCount(userId: string): Promise<number> {
  const { count, error } = await db()
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", userId)
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markNotificationsRead(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await db().from("notifications").update({ read: true }).in("id", ids);
  if (error) throw error;
}
