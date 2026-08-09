import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { fetchFollowing, follow, searchProfiles, searchSeries, unfollow } from "../lib/data";
import type { Profile, Series } from "../types";
import { Icon } from "./Icons";

export default function Discover({
  onOpenSeries,
  onOpenProfile,
}: {
  onOpenSeries: (seriesId: string) => void;
  onOpenProfile: (userId: string) => void;
}) {
  const { profile } = useAuth();
  const [mode, setMode] = useState<"series" | "people">("series");
  const [query, setQuery] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!profile) return;
    fetchFollowing(profile.id).then((f) => setFollowingIds(new Set(f.map((x) => x.followee_id))));
  }, [profile]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (mode === "series") setSeries(await searchSeries(query));
      else if (profile) setPeople(await searchProfiles(query, profile.id));
    }, 200);
    return () => clearTimeout(t);
  }, [query, mode, profile]);

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
    }
  }

  return (
    <div>
      <div className="page-title">discover</div>

      <div className="tabs-inline">
        <button className={mode === "series" ? "active" : ""} onClick={() => setMode("series")}>
          comics
        </button>
        <button className={mode === "people" ? "active" : ""} onClick={() => setMode("people")}>
          people
        </button>
      </div>

      <div className="search-row">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === "series" ? "search series…" : "search by username…"}
          />
        </div>
      </div>

      {mode === "series" &&
        (series.length === 0 ? (
          <div className="empty">no series found.</div>
        ) : (
          <div className="cover-grid">
            {series.map((s) => (
              <div className="cover-tile" key={s.id} onClick={() => onOpenSeries(s.id)}>
                {s.cover_url ? (
                  <img className="cover" src={s.cover_url} alt="" />
                ) : (
                  <div className="cover">{s.title.slice(0, 2).toUpperCase()}</div>
                )}
                <h3>{s.title}</h3>
                <div className="tile-meta">
                  <span>{s.publisher || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        ))}

      {mode === "people" &&
        (people.length === 0 ? (
          <div className="empty">no readers found.</div>
        ) : (
          <div className="card">
            {people.map((p) => (
              <div className="user-row" key={p.id}>
                <div className="avatar" onClick={() => onOpenProfile(p.id)}>
                  {p.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="name" onClick={() => onOpenProfile(p.id)}>
                  @{p.username}
                </div>
                <button className="btn-secondary" onClick={() => toggleFollow(p.id)}>
                  {followingIds.has(p.id) ? "following" : "follow"}
                </button>
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
