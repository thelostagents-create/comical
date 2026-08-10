import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  createFandomPost,
  deleteFandomPost,
  fetchFandomPosts,
  searchFandomPostsByHashtag,
  searchHashtags,
  toggleReaction,
  type FandomPostRow,
} from "../lib/data";
import { timeAgo } from "../lib/format";
import { REACTION_EMOJI, REACTION_TYPES, type ReactionType } from "../types";
import { Icon } from "./Icons";

const HASHTAG_TOKEN_RE = /(#[a-z0-9_]+)/gi;

function renderBody(body: string, onHashtag: (tag: string) => void) {
  return body.split(HASHTAG_TOKEN_RE).map((part, i) =>
    /^#[a-z0-9_]+$/i.test(part) ? (
      <button key={i} className="hashtag" onClick={() => onHashtag(part.slice(1).toLowerCase())}>
        {part}
      </button>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

export default function Fandom() {
  const { profile } = useAuth();
  const [posts, setPosts] = useState<FandomPostRow[] | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const [tagResults, setTagResults] = useState<{ tag: string; count: number }[]>([]);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function reload() {
    if (!profile) return;
    setPosts(
      activeTag
        ? await searchFandomPostsByHashtag(activeTag, profile.id)
        : await fetchFandomPosts(profile.id),
    );
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, activeTag]);

  useEffect(() => {
    if (!tagQuery.trim()) {
      setTagResults([]);
      return;
    }
    const t = setTimeout(async () => setTagResults(await searchHashtags(tagQuery)), 200);
    return () => clearTimeout(t);
  }, [tagQuery]);

  function openTag(tag: string) {
    setActiveTag(tag);
    setTagQuery("");
  }

  async function handlePost() {
    if (!profile || !body.trim()) return;
    setPosting(true);
    try {
      await createFandomPost({ user_id: profile.id, body: body.trim(), image_url: null });
      setBody("");
      await reload();
    } finally {
      setPosting(false);
    }
  }

  async function handleDelete(postId: string) {
    setPosts((prev) => prev?.filter((p) => p.id !== postId) ?? null);
    await deleteFandomPost(postId);
  }

  async function handleReact(post: FandomPostRow, reaction: ReactionType) {
    if (!profile) return;
    const active = post.myReactions.includes(reaction);
    setPosts(
      (prev) =>
        prev?.map((p) =>
          p.id !== post.id
            ? p
            : {
                ...p,
                myReactions: active ? p.myReactions.filter((r) => r !== reaction) : [...p.myReactions, reaction],
                reactionCounts: {
                  ...p.reactionCounts,
                  [reaction]: Math.max(0, (p.reactionCounts[reaction] ?? 0) + (active ? -1 : 1)),
                },
              },
        ) ?? null,
    );
    try {
      await toggleReaction(post.id, profile.id, reaction, active);
    } catch {
      reload();
    }
  }

  return (
    <div>
      <div className="page-title">Fandom</div>

      <div className="search-row">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            value={tagQuery}
            onChange={(e) => setTagQuery(e.target.value)}
            placeholder="Search hashtags…"
          />
        </div>
      </div>

      {tagQuery.trim() && (
        <div className="card" style={{ marginBottom: 14 }}>
          {tagResults.length === 0 ? (
            <div className="empty" style={{ padding: 16 }}>No hashtags match "{tagQuery.trim()}".</div>
          ) : (
            tagResults.map((t) => (
              <div className="user-row" key={t.tag} onClick={() => openTag(t.tag)}>
                <div className="name">#{t.tag}</div>
                <span className="sub">{t.count} {t.count === 1 ? "post" : "posts"}</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTag && (
        <div className="tabs-inline">
          <button className="active">#{activeTag}</button>
          <button onClick={() => setActiveTag(null)}>Clear</button>
        </div>
      )}

      {!activeTag && (
        <div className="card composer">
          <label className="field">
            <span>Share something</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="What's happening in your fandom? Use #hashtags…"
              maxLength={500}
            />
          </label>
          <div className="modal-actions">
            <button className="btn-primary" disabled={posting || !body.trim()} onClick={handlePost}>
              Post
            </button>
          </div>
        </div>
      )}

      {posts === null && <div className="empty">Loading…</div>}
      {posts !== null && posts.length === 0 && (
        <div className="empty">
          {activeTag ? `No posts tagged #${activeTag} yet.` : "No posts yet. Be the first to share something."}
        </div>
      )}

      {posts?.map((post) => (
        <div className="card post-card" key={post.id}>
          <div className="post-head">
            {post.profile.avatar_url ? (
              <img className="avatar" src={post.profile.avatar_url} alt="" />
            ) : (
              <div className="avatar">{post.profile.username.slice(0, 2).toUpperCase()}</div>
            )}
            <div className="post-head-meta">
              <span className="name">@{post.profile.username}</span>
              <span className="when">{timeAgo(post.created_at)}</span>
            </div>
            {profile?.id === post.user_id && (
              <button className="icon-btn post-delete" onClick={() => handleDelete(post.id)} aria-label="Delete post">
                <Icon name="close" size={13} />
              </button>
            )}
          </div>
          <p className="post-body">{renderBody(post.body, openTag)}</p>
          <div className="reaction-row">
            {REACTION_TYPES.map((r) => {
              const count = post.reactionCounts[r] ?? 0;
              const active = post.myReactions.includes(r);
              return (
                <button
                  key={r}
                  className={`reaction-btn${active ? " active" : ""}`}
                  onClick={() => handleReact(post, r)}
                >
                  <span>{REACTION_EMOJI[r]}</span>
                  {count > 0 && <span className="reaction-count">{count}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
