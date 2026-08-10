import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  adminSetUserModeration,
  deleteFandomPost,
  fetchFandomPosts,
  searchProfiles,
  type FandomPostRow,
} from "../lib/data";
import { timeAgo } from "../lib/format";
import type { Profile } from "../types";
import { Icon } from "./Icons";
import Modal from "./Modal";

type Tab = "posts" | "users";

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("posts");
  const [posts, setPosts] = useState<FandomPostRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    if (tab !== "posts" || !profile) return;
    fetchFandomPosts(profile.id, 50).then(setPosts);
  }, [tab, profile]);

  useEffect(() => {
    if (tab !== "users") return;
    const t = setTimeout(async () => setUsers(await searchProfiles(query)), 200);
    return () => clearTimeout(t);
  }, [query, tab]);

  async function handleDeletePost(postId: string) {
    setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
    await deleteFandomPost(postId);
  }

  async function toggleMute(u: Profile) {
    const next = !u.is_muted;
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_muted: next } : x)));
    await adminSetUserModeration(u.id, next, u.is_banned);
  }

  async function toggleBan(u: Profile) {
    const next = !u.is_banned;
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, is_banned: next } : x)));
    await adminSetUserModeration(u.id, u.is_muted, next);
  }

  return (
    <Modal title="Admin" onClose={onClose}>
      <div className="tabs-inline">
        <button className={tab === "posts" ? "active" : ""} onClick={() => setTab("posts")}>
          Fandom posts
        </button>
        <button className={tab === "users" ? "active" : ""} onClick={() => setTab("users")}>
          Users
        </button>
      </div>

      {tab === "posts" && (
        <>
          {posts === null && <div className="empty">Loading…</div>}
          {posts !== null && posts.length === 0 && <div className="empty">No posts yet.</div>}
          {posts?.map((post) => (
            <div className="card" key={post.id}>
              <div className="sub">
                @{post.profile.username} · {timeAgo(post.created_at)}
              </div>
              <p style={{ margin: "6px 0" }}>{post.body}</p>
              <button className="btn-secondary" onClick={() => handleDeletePost(post.id)}>
                <Icon name="close" size={13} /> Delete
              </button>
            </div>
          ))}
        </>
      )}

      {tab === "users" && (
        <>
          <label className="field">
            <span>Search users</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Username…"
              autoFocus
            />
          </label>
          {users.map((u) => (
            <div className="user-row" key={u.id}>
              {u.avatar_url ? (
                <img className="avatar" src={u.avatar_url} alt="" loading="lazy" />
              ) : (
                <div className="avatar">{u.username.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="name">
                @{u.username}
                {u.is_admin && <span className="sub"> · admin</span>}
              </div>
              <button className="btn-secondary" onClick={() => toggleMute(u)} disabled={u.is_admin}>
                {u.is_muted ? "Unmute" : "Mute"}
              </button>
              <button className="btn-secondary" onClick={() => toggleBan(u)} disabled={u.is_admin}>
                {u.is_banned ? "Unban" : "Ban"}
              </button>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
