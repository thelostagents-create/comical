import { supabase } from "./supabase";
import type {
  Follow,
  Issue,
  LibraryEntry,
  LibraryStatus,
  Profile,
  Rating,
  RatingTargetType,
  Read,
  Series,
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
  if (query.trim()) q = q.ilike("title", `%${query.trim()}%`);
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

  const targetSeriesIds = (ratings ?? []).filter((r) => r.target_type === "series").map((r) => r.target_id);
  const targetIssueIds = (ratings ?? []).filter((r) => r.target_type === "issue").map((r) => r.target_id);

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

  const ratingItems: FeedItem[] = (ratings ?? [])
    .filter((r) => profileById.get(r.user_id))
    .map((r) => ({
      kind: "rating",
      id: r.id,
      at: r.updated_at,
      profile: profileById.get(r.user_id)!,
      rating: r,
      label:
        r.target_type === "series"
          ? seriesTitleById.get(r.target_id) ?? "a series"
          : issueLabelById.get(r.target_id) ?? "an issue",
    }));

  return [...readItems, ...ratingItems]
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, limit);
}
