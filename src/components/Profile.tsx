import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  fetchFollowers,
  fetchFollowing,
  fetchLibrary,
  follow,
  getProfile,
  profileStats,
  unfollow,
  updateProfile,
  type LibraryRow,
} from "../lib/data";
import type { Profile as ProfileType } from "../types";
import { LIBRARY_STATUS_LABELS } from "../types";
import Modal from "./Modal";

export default function Profile({
  userId,
  isSelf,
  onOpenSeries,
}: {
  userId: string;
  isSelf: boolean;
  onOpenSeries: (seriesId: string) => void;
  onOpenProfile: (userId?: string) => void;
}) {
  const { profile: me, refreshProfile } = useAuth();
  const [target, setTarget] = useState<ProfileType | null>(null);
  const [stats, setStats] = useState({ seriesCount: 0, readCount: 0 });
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [library, setLibrary] = useState<LibraryRow[]>([]);
  const [editing, setEditing] = useState(false);

  async function reload() {
    const [p, s, followers, following, lib] = await Promise.all([
      isSelf ? Promise.resolve(me) : getProfile(userId),
      profileStats(userId),
      fetchFollowers(userId),
      fetchFollowing(userId),
      fetchLibrary(userId),
    ]);
    setTarget(p);
    setStats(s);
    setFollowerCount(followers.length);
    setFollowingCount(following.length);
    setLibrary(lib);
    if (!isSelf && me) setIsFollowing(followers.some((f) => f.follower_id === me.id));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isSelf, me?.id]);

  async function toggleFollow() {
    if (!me) return;
    if (isFollowing) {
      setIsFollowing(false);
      setFollowerCount((c) => c - 1);
      await unfollow(me.id, userId);
    } else {
      setIsFollowing(true);
      setFollowerCount((c) => c + 1);
      await follow(me.id, userId);
    }
  }

  if (!target) return <div className="empty">Loading…</div>;

  return (
    <div>
      <div className="page-title">{isSelf ? "You" : `@${target.username}`}</div>

      <div className="card">
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className="avatar" style={{ width: 60, height: 60, fontSize: 18 }}>
            {target.username.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: 0 }}>@{target.username}</h3>
            {target.bio && <div className="sub">{target.bio}</div>}
          </div>
        </div>

        <div className="stats-row">
          <div className="stat">
            <b>{stats.seriesCount}</b>
            <span>Series</span>
          </div>
          <div className="stat">
            <b>{stats.readCount}</b>
            <span>Read</span>
          </div>
          <div className="stat">
            <b>{followerCount}</b>
            <span>Followers</span>
          </div>
          <div className="stat">
            <b>{followingCount}</b>
            <span>Following</span>
          </div>
        </div>

        {isSelf ? (
          <button className="btn-secondary" onClick={() => setEditing(true)}>
            Edit bio
          </button>
        ) : (
          <button className="btn-secondary" onClick={toggleFollow}>
            {isFollowing ? "Following" : "Follow"}
          </button>
        )}
      </div>

      <div className="section-title">{isSelf ? "Your shelf" : "Shelf"}</div>
      {library.length === 0 && <div className="empty">Nothing on the shelf yet.</div>}
      {library.map((row) => (
        <div className="card series-row" key={row.id} onClick={() => onOpenSeries(row.series_id)}>
          <div className="cover">{!row.series.cover_url && row.series.title.slice(0, 2).toUpperCase()}</div>
          <div className="meta">
            <h3>{row.series.title}</h3>
            <span className="status-pill">{LIBRARY_STATUS_LABELS[row.status]}</span>
          </div>
        </div>
      ))}

      {editing && (
        <EditBioModal
          initial={target.bio}
          onClose={() => setEditing(false)}
          onSaved={async (bio) => {
            await updateProfile(userId, { bio });
            await refreshProfile();
            setEditing(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function EditBioModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: string;
  onClose: () => void;
  onSaved: (bio: string) => void;
}) {
  const [bio, setBio] = useState(initial);
  return (
    <Modal title="Edit bio" onClose={onClose}>
      <label className="field">
        <span>Bio</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} autoFocus maxLength={280} />
      </label>
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={() => onSaved(bio.trim())}>
          Save
        </button>
      </div>
    </Modal>
  );
}
