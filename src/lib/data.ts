import { supabase } from "./supabase";
import type {
  Character,
  FandomPost,
  FandomReaction,
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
  Show,
} from "../types";

function db() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

// ---------------------------------------------------------------------------
// series & issues (shared catalog)
// ---------------------------------------------------------------------------

export async function searchSeries(query: string): Promise<Series[]> {
  let q = db().from("series").select("*").order("title");
  const trimmed = query.trim();
  if (trimmed)
    q = q.or(`title.ilike.%${trimmed}%,publisher.ilike.%${trimmed}%,description.ilike.%${trimmed}%`);
  const { data, error } = await q.limit(50);
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
  const { data, error } = await q.limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function createCharacter(input: {
  name: string;
  description: string;
  image_url: string | null;
  publisher: string;
  series_id: string | null;
  created_by: string;
}): Promise<Character> {
  const { data, error } = await db().from("characters").insert(input).select().single();
  if (error) throw error;
  return data;
}

export async function searchShows(query: string): Promise<Show[]> {
  let q = db().from("shows").select("*").order("title");
  const trimmed = query.trim();
  if (trimmed)
    q = q.or(`title.ilike.%${trimmed}%,network.ilike.%${trimmed}%,description.ilike.%${trimmed}%`);
  const { data, error } = await q.limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function createShow(input: {
  title: string;
  network: string;
  description: string;
  image_url: string | null;
  series_id: string | null;
  created_by: string;
}): Promise<Show> {
  const { data, error } = await db().from("shows").insert(input).select().single();
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// library (per-user shelf)
// ---------------------------------------------------------------------------

export interface LibraryRow extends LibraryEntry {
  series: Series;
  issueCount: number;
  readCount: number;
}

export async function fetchLibrary(userId: string): Promise<LibraryRow[]> {
  const { data: entries, error } = await db()
    .from("library_entries")
    .select("*, series(*)")
    .eq("user_id", userId)
    .order("added_at", { ascending: false });
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

export async function fetchSeriesReaders(seriesId: string): Promise<Profile[]> {
  const { data, error } = await db()
    .from("library_entries")
    .select("profiles(*)")
    .eq("series_id", seriesId)
    .limit(12);
  if (error) throw error;
  return ((data ?? []) as unknown as { profiles: Profile | Profile[] | null }[])
    .map((row) => (Array.isArray(row.profiles) ? row.profiles[0] : row.profiles))
    .filter((p): p is Profile => Boolean(p));
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
  patch: { bio?: string; avatar_url?: string | null },
) {
  const { error } = await db().from("profiles").update(patch).eq("id", userId);
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

export async function fetchFeed(userId: string, limit = 40): Promise<FeedItem[]> {
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
): Promise<{ volume: ComicVineVolume | null; issues: ComicVineIssue[] }> {
  return invokeComicVine(`resource=volume&id=${encodeURIComponent(id)}`);
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
}

async function hydratePosts(posts: FandomPost[], currentUserId: string): Promise<FandomPostRow[]> {
  if (posts.length === 0) return [];
  const postIds = posts.map((p) => p.id);
  const userIds = [...new Set(posts.map((p) => p.user_id))];

  const [
    { data: profiles, error: profilesErr },
    { data: reactions, error: reactionsErr },
    { data: hashtags, error: hashtagsErr },
  ] = await Promise.all([
    db().from("profiles").select("*").in("id", userIds),
    db().from("fandom_reactions").select("*").in("post_id", postIds),
    db().from("fandom_post_hashtags").select("*").in("post_id", postIds),
  ]);
  if (profilesErr) throw profilesErr;
  if (reactionsErr) throw reactionsErr;
  if (hashtagsErr) throw hashtagsErr;

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

  return posts
    .filter((p) => profileById.get(p.user_id))
    .map((p) => ({
      ...p,
      profile: profileById.get(p.user_id)!,
      reactionCounts: reactionCountsByPost.get(p.id) ?? {},
      myReactions: myReactionsByPost.get(p.id) ?? [],
      hashtags: hashtagsByPost.get(p.id) ?? [],
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

export async function toggleReaction(
  postId: string,
  userId: string,
  reaction: ReactionType,
  currentlyActive: boolean,
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
