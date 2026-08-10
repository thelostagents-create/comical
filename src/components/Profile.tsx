import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  addFavoriteCharacter,
  createCharacter,
  fetchFavoriteCharacters,
  fetchFollowers,
  fetchFollowing,
  follow,
  getProfile,
  MAX_FAVORITE_CHARACTERS,
  profileStats,
  removeFavoriteCharacter,
  searchCharacters,
  unfollow,
  updateProfile,
  type FavoriteCharacterRow,
} from "../lib/data";
import type { Character, Profile as ProfileType } from "../types";
import { Icon } from "./Icons";
import ImageField from "./ImageField";
import Modal from "./Modal";

export default function Profile({
  userId,
  isSelf,
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
  const [favorites, setFavorites] = useState<FavoriteCharacterRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [addingFavorite, setAddingFavorite] = useState(false);

  async function reload() {
    const [p, s, followers, following] = await Promise.all([
      isSelf ? Promise.resolve(me) : getProfile(userId),
      profileStats(userId),
      fetchFollowers(userId),
      fetchFollowing(userId),
    ]);
    setTarget(p);
    setStats(s);
    setFollowerCount(followers.length);
    setFollowingCount(following.length);
    if (!isSelf && me) setIsFollowing(followers.some((f) => f.follower_id === me.id));

    // Fetched separately so a failure here (e.g. migration 0003 not yet
    // applied) can't leave the rest of the profile stuck on "Loading…".
    try {
      setFavorites(await fetchFavoriteCharacters(userId));
    } catch {
      setFavorites([]);
    }
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

  async function handleRemoveFavorite(id: string) {
    setFavorites((prev) => prev.filter((f) => f.id !== id));
    await removeFavoriteCharacter(id);
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

      <div className="section-title">{isSelf ? "Your favorite characters" : "Favorite characters"}</div>
      {favorites.length === 0 && !isSelf && <div className="empty">No favorite characters yet.</div>}
      {favorites.length === 0 && isSelf && (
        <div className="empty">
          Nothing here yet.
          <br />
          Add a character you love and give them a photo.
        </div>
      )}
      {(favorites.length > 0 || isSelf) && (
        <div className="character-grid">
          {favorites.slice(0, MAX_FAVORITE_CHARACTERS).map((fav) => (
            <div className="character-tile favorite-tile" key={fav.id}>
              {isSelf && (
                <button
                  className="favorite-tile-remove"
                  onClick={() => handleRemoveFavorite(fav.id)}
                  aria-label={`Remove ${fav.character.name} from favorites`}
                >
                  <Icon name="close" size={11} />
                </button>
              )}
              {fav.image_url || fav.character.image_url ? (
                <img className="avatar" src={fav.image_url ?? fav.character.image_url!} alt="" />
              ) : (
                <div className="avatar">{fav.character.name.slice(0, 2).toUpperCase()}</div>
              )}
              <h3>{fav.character.name}</h3>
            </div>
          ))}
          {isSelf && favorites.length < MAX_FAVORITE_CHARACTERS && (
            <div className="character-tile favorite-add-tile" onClick={() => setAddingFavorite(true)}>
              <div className="avatar">
                <Icon name="plus" size={18} />
              </div>
              <h3>Add</h3>
            </div>
          )}
        </div>
      )}

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

      {addingFavorite && me && (
        <AddFavoriteModal
          existingIds={new Set(favorites.map((f) => f.character_id))}
          onClose={() => setAddingFavorite(false)}
          onAdded={(fav) => {
            setFavorites((prev) => [...prev, fav]);
            setAddingFavorite(false);
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

function AddFavoriteModal({
  existingIds,
  onClose,
  onAdded,
}: {
  existingIds: Set<string>;
  onClose: () => void;
  onAdded: (fav: FavoriteCharacterRow) => void;
}) {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Character[]>([]);
  const [selected, setSelected] = useState<Character | null>(null);
  const [publisher, setPublisher] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (selected) return;
    const t = setTimeout(async () => setResults(await searchCharacters(query)), 200);
    return () => clearTimeout(t);
  }, [query, selected]);

  const availableResults = results.filter((c) => !existingIds.has(c.id));

  async function handleAdd() {
    if (!profile) return;
    if (!selected && !query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const character =
        selected ??
        (await createCharacter({
          name: query.trim(),
          description: "",
          image_url: imageUrl.trim() || null,
          publisher: publisher.trim(),
          series_id: null,
          created_by: profile.id,
        }));
      const fav = await addFavoriteCharacter({
        user_id: profile.id,
        character_id: character.id,
        image_url: imageUrl.trim() || null,
      });
      onAdded(fav);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that character.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a favorite character" onClose={onClose}>
      {selected ? (
        <div className="user-row" style={{ padding: 0 }}>
          {selected.image_url ? (
            <img className="avatar" src={selected.image_url} alt="" />
          ) : (
            <div className="avatar">{selected.name.slice(0, 2).toUpperCase()}</div>
          )}
          <div className="name">{selected.name}</div>
          <button className="btn-secondary" onClick={() => setSelected(null)}>
            Change
          </button>
        </div>
      ) : (
        <>
          <label className="field">
            <span>Character name</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search, or type a new name…"
              autoFocus
            />
          </label>
          {query.trim() && availableResults.length > 0 && (
            <div className="card" style={{ marginTop: -6 }}>
              {availableResults.slice(0, 6).map((c) => (
                <div className="user-row" key={c.id} onClick={() => setSelected(c)}>
                  {c.image_url ? (
                    <img className="avatar" src={c.image_url} alt="" />
                  ) : (
                    <div className="avatar">{c.name.slice(0, 2).toUpperCase()}</div>
                  )}
                  <div className="name">{c.name}</div>
                  {c.publisher && <span className="sub">{c.publisher}</span>}
                </div>
              ))}
            </div>
          )}
          <label className="field">
            <span>Publisher / brand (optional)</span>
            <input
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="Marvel, DC, Image…"
            />
          </label>
        </>
      )}

      <ImageField label="Photo (optional)" value={imageUrl} onChange={setImageUrl} folder="characters" />

      {error && <div className="auth-error">{error}</div>}

      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy || (!selected && !query.trim())} onClick={handleAdd}>
          Add
        </button>
      </div>
    </Modal>
  );
}
