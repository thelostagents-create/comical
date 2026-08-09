import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { fetchFeed, type FeedItem } from "../lib/data";
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

  useEffect(() => {
    if (!profile) return;
    fetchFeed(profile.id).then(setItems);
  }, [profile]);

  return (
    <div>
      <div className="page-title">Feed</div>

      {items === null && <div className="empty">Loading…</div>}

      {items !== null && items.length === 0 && (
        <div className="empty">
          Follow some readers in Discover to see what they're reading and rating here.
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
  );
}
