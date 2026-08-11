import { useEffect, useState } from "react";
import { adminSetUserModeration, searchProfiles } from "../lib/data";
import type { Profile } from "../types";
import Modal from "./Modal";

const DEFAULT_USER_COUNT = 9;

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<Profile[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => setUsers(await searchProfiles(query)), 200);
    return () => clearTimeout(t);
  }, [query]);

  const visibleUsers = query.trim() ? users : users.slice(0, DEFAULT_USER_COUNT);

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
    <Modal title="Admin — Users" onClose={onClose}>
      <label className="field">
        <span>Search users</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Username…"
          autoFocus
        />
      </label>
      {!query.trim() && users.length > DEFAULT_USER_COUNT && (
        <div className="sub" style={{ margin: "0 0 8px" }}>
          Showing {DEFAULT_USER_COUNT} users — search to find someone else.
        </div>
      )}
      {visibleUsers.map((u) => (
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
    </Modal>
  );
}
