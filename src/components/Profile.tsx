import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { containsBlockedLanguage } from "../lib/contentFilter";
import {
  addFavoriteCharacter,
  createCharacter,
  fetchCharacterRuns,
  fetchFavoriteCharacters,
  fetchFollowers,
  fetchFollowing,
  fetchLibrary,
  follow,
  getProfile,
  MAX_FAVORITE_CHARACTERS,
  profileStats,
  removeFavoriteCharacter,
  searchCharacters,
  unfollow,
  updateProfile,
  type FavoriteCharacterRow,
  type LibraryRow,
} from "../lib/data";
import type { Character, Profile as ProfileType } from "../types";
import { Icon } from "./Icons";
import ImageField from "./ImageField";
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
  const [favorites, setFavorites] = useState<FavoriteCharacterRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [addingFavorite, setAddingFavorite] = useState(false);
  const [openFavorite, setOpenFavorite] = useState<FavoriteCharacterRow | null>(null);
  const [favoriteRuns, setFavoriteRuns] = useState<LibraryRow[] | null>(null);

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

  async function openFavoriteRuns(fav: FavoriteCharacterRow) {
    setOpenFavorite(fav);
    setFavoriteRuns(null);
    const library = await fetchLibrary(userId);
    setFavoriteRuns(await fetchCharacterRuns(userId, fav.character, library));
  }

  if (!target) return <div className="empty">Loading…</div>;

  return (
    <div>
      <div className="profile-header">
        <div className="profile-banner">
          {target.banner_url ? (
            <img src={target.banner_url} alt="" />
          ) : (
            <div className="profile-banner-placeholder" />
          )}
          {isSelf && (
            <button className="icon-btn profile-banner-edit" onClick={() => setEditing(true)} aria-label="Edit profile">
              <Icon name="edit" size={15} />
            </button>
          )}
        </div>
        <div className="profile-avatar-wrap">
          {target.avatar_url ? (
            <img className="avatar profile-avatar" src={target.avatar_url} alt="" />
          ) : (
            <div className="avatar profile-avatar">{target.username.slice(0, 2).toUpperCase()}</div>
          )}
        </div>
        <div className="profile-identity">
          <h2>{target.username}</h2>
          <div className="sub">@{target.username}</div>
          {target.fandoms.trim() && <div className="profile-fandoms">fandoms : {target.fandoms}</div>}
          {target.bio && <div className="sub" style={{ marginTop: 8 }}>{target.bio}</div>}
        </div>
      </div>

      <div className="card">
        <div className="stats-row" style={{ justifyContent: "center" }}>
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
            Edit profile
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
            <div className="character-tile favorite-tile" key={fav.id} onClick={() => openFavoriteRuns(fav)}>
              {isSelf && (
                <button
                  className="favorite-tile-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFavorite(fav.id);
                  }}
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
        <EditProfileModal
          initial={target}
          onClose={() => setEditing(false)}
          onSaved={async (patch) => {
            await updateProfile(userId, patch);
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

      {openFavorite && (
        <Modal title={`${openFavorite.character.name}'s runs`} onClose={() => setOpenFavorite(null)}>
          {favoriteRuns === null && <div className="empty">Loading…</div>}
          {favoriteRuns !== null && favoriteRuns.length === 0 && (
            <div className="empty">No comic runs read with {openFavorite.character.name} yet.</div>
          )}
          {favoriteRuns?.map((row) => (
            <div
              className="card series-row"
              key={row.id}
              onClick={() => {
                setOpenFavorite(null);
                onOpenSeries(row.series_id);
              }}
            >
              {row.series.cover_url ? (
                <img className="cover" src={row.series.cover_url} alt="" />
              ) : (
                <div className="cover">{row.series.title.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="meta">
                <h3>{row.series.title}</h3>
                <div className="sub">
                  {row.series.publisher || "—"} · {row.readCount}/{row.issueCount || "–"} read
                </div>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}

function EditProfileModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ProfileType;
  onClose: () => void;
  onSaved: (patch: { bio: string; avatar_url: string | null; banner_url: string | null; fandoms: string }) => void;
}) {
  const [bannerUrl, setBannerUrl] = useState(initial.banner_url ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? "");
  const [fandoms, setFandoms] = useState(initial.fandoms);
  const [bio, setBio] = useState(initial.bio);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (containsBlockedLanguage(fandoms) || containsBlockedLanguage(bio)) {
      setError("That contains language that's not allowed here.");
      return;
    }
    onSaved({
      bio: bio.trim(),
      avatar_url: avatarUrl.trim() || null,
      banner_url: bannerUrl.trim() || null,
      fandoms: fandoms.trim(),
    });
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <ImageField label="Banner image" value={bannerUrl} onChange={setBannerUrl} folder="profile-banners" />
      <ImageField label="Avatar photo" value={avatarUrl} onChange={setAvatarUrl} folder="avatars" />
      <label className="field">
        <span>Fandoms (comma-separated)</span>
        <input
          value={fandoms}
          onChange={(e) => { setFandoms(e.target.value); setError(null); }}
          placeholder="marvel, owl house, dc"
          maxLength={140}
        />
      </label>
      <label className="field">
        <span>Bio</span>
        <textarea value={bio} onChange={(e) => { setBio(e.target.value); setError(null); }} maxLength={280} />
      </label>
      {error && <div className="auth-error">{error}</div>}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={handleSave}>
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
            <img className="avatar avatar-square" src={selected.image_url} alt="" />
          ) : (
            <div className="avatar avatar-square">{selected.name.slice(0, 2).toUpperCase()}</div>
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
                    <img className="avatar avatar-square" src={c.image_url} alt="" />
                  ) : (
                    <div className="avatar avatar-square">{c.name.slice(0, 2).toUpperCase()}</div>
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
