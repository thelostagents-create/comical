import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { fetchFeed, fetchFollowing, follow, searchProfiles, unfollow, type FeedItem } from "../lib/data";
import type { Profile } from "../types";
import { Icon } from "./Icons";
import RatingStars from "./RatingStars";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function Feed({
  onOpenSeries,
  onOpenProfile,
}: {
  onOpenSeries: (seriesId: string) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const { profile } = useAuth();
  const [items, setItems] = useState<FeedItem[] | null>(null);
  const [showFinder, setShowFinder] = useState(false);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
    fetchFeed(profile.id).then(setItems);
    fetchFollowing(profile.id).then((f) => setFollowingIds(new Set(f.map((x) => x.followee_id))));
  }, [profile]);

  useEffect(() => {
    if (!showFinder || !profile) return;
    const t = setTimeout(async () => setPeople(await searchProfiles(query, profile.id)), 200);
    return () => clearTimeout(t);
  }, [query, showFinder, profile]);

  async function toggleFollow(userId: string) {
    if (!profile) return;
    const next = new Set(followingIds);
    if (next.has(userId)) {
      next.delete(userId);
      setFollowingIds(next);
      await unfollow(profile.id, userId);
    } else {
      next.add(userId);
      setFollowingIds(next);
      await follow(profile.id, userId);
      fetchFeed(profile.id).then(setItems);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="page-title" style={{ margin: 0 }}>Feed</div>
        <button className="icon-btn" onClick={() => setShowFinder((v) => !v)} aria-label="Add friends">
          <Icon name="userplus" size={17} />
        </button>
      </div>

      {showFinder && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="field" style={{ marginBottom: 10 }}>
            <span>Find people to follow</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username…"
            />
          </div>
          {people.length === 0 ? (
            <div className="empty">No readers found.</div>
          ) : (
            people.map((p) => (
              <div className="user-row" key={p.id}>
                <div className="avatar" onClick={() => onOpenProfile(p.id)}>
                  {p.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="name" onClick={() => onOpenProfile(p.id)}>
                  @{p.username}
                </div>
                <button className={`btn-secondary ${followingIds.has(p.id) ? "active" : ""}`} onClick={() => toggleFollow(p.id)}>
                  {followingIds.has(p.id) ? "Following" : "Follow"}
                </button>
              </div>
            ))
          )}
        </div>
      )}

      <div style={{ marginTop: showFinder ? 20 : 14 }}>
        {items === null && <div className="empty">Loading…</div>}

        {items !== null && items.length === 0 && (
          <div className="empty">
            Follow some readers to see what they're reading and rating here.
          </div>
        )}

        {items !== null && items.length > 0 && (
          <div className="card">
            {items.map((item) => (
              <div className="feed-item" key={`${item.kind}-${item.id}`}>
                <div className="avatar" onClick={() => onOpenProfile(item.profile.id)}>
                  {item.profile.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="body">
                  {item.kind === "read" ? (
                    <div>
                      <b onClick={() => onOpenProfile(item.profile.id)}>@{item.profile.username}</b> read{" "}
                      <span onClick={() => onOpenSeries(item.series.id)}>
                        {item.series.title} #{item.issue.issue_number}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <b onClick={() => onOpenProfile(item.profile.id)}>@{item.profile.username}</b> rated{" "}
                      <span onClick={() => item.rating.target_type === "series" && onOpenSeries(item.rating.target_id)}>
                        {item.label}
                      </span>
                      <div>
                        <RatingStars value={item.rating.rating} size={13} />
                      </div>
                      {item.rating.review && <div className="review">"{item.rating.review}"</div>}
                    </div>
                  )}
                  <div className="when">{timeAgo(item.at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
