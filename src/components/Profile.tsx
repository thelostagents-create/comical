import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { containsBlockedLanguage } from "../lib/contentFilter";
import {
  addFavoriteCharacter,
  addFavoriteSeries,
  createCharacter,
  fetchCharacterRuns,
  fetchFavoriteCharacters,
  fetchFavoriteSeries,
  fetchFollowers,
  fetchFollowing,
  fetchLibrary,
  follow,
  getProfile,
  MAX_FAVORITE_CHARACTERS,
  MAX_FAVORITE_SERIES,
  profileStats,
  removeFavoriteCharacter,
  removeFavoriteSeries,
  searchCharacters,
  unfollow,
  updateProfile,
  type FavoriteCharacterRow,
  type FavoriteSeriesRow,
  type LibraryRow,
} from "../lib/data";
import type { Character, Profile as ProfileType, Series } from "../types";
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
  const [favoriteSeries, setFavoriteSeries] = useState<FavoriteSeriesRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [addingFavorite, setAddingFavorite] = useState(false);
  const [addingFavoriteSeries, setAddingFavoriteSeries] = useState(false);
  const [openFavorite, setOpenFavorite] = useState<FavoriteCharacterRow | null>(null);
  const [favoriteRuns, setFavoriteRuns] = useState<LibraryRow[] | null>(null);
  const [runsPage, setRunsPage] = useState(0);

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

    // Fetched separately so a failure here (e.g. migration 0003/0010 not
    // yet applied) can't leave the rest of the profile stuck on "Loading…".
    try {
      setFavorites(await fetchFavoriteCharacters(userId));
    } catch {
      setFavorites([]);
    }
    try {
      setFavoriteSeries(await fetchFavoriteSeries(userId));
    } catch {
      setFavoriteSeries([]);
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

  async function handleRemoveFavoriteSeries(id: string) {
    setFavoriteSeries((prev) => prev.filter((f) => f.id !== id));
    await removeFavoriteSeries(id);
  }

  async function openFavoriteRuns(fav: FavoriteCharacterRow) {
    setOpenFavorite(fav);
    setFavoriteRuns(null);
    setRunsPage(0);
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
          <h2>{target.nickname.trim() || target.username}</h2>
          <div className="sub">@{target.username}</div>
          {target.fandoms.trim() && <div className="profile-fandoms">fandoms : {target.fandoms}</div>}
          {target.bio && <div className="sub" style={{ marginTop: 5 }}>{target.bio}</div>}
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

      <div className="section-title">{isSelf ? "Your favorite comics" : "Favorite comics"}</div>
      {favoriteSeries.length === 0 && !isSelf && <div className="empty">No favorite comics yet.</div>}
      {favoriteSeries.length === 0 && isSelf && (
        <div className="empty">
          Nothing here yet.
          <br />
          Add a comic from your catalog.
        </div>
      )}
      {(favoriteSeries.length > 0 || isSelf) && (
        <div className="cover-grid">
          {favoriteSeries.slice(0, MAX_FAVORITE_SERIES).map((fav) => (
            <div
              className="cover-tile favorite-tile"
              key={fav.id}
              onClick={() => onOpenSeries(fav.series_id)}
            >
              {isSelf && (
                <button
                  className="favorite-tile-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFavoriteSeries(fav.id);
                  }}
                  aria-label={`Remove ${fav.series.title} from favorites`}
                >
                  <Icon name="close" size={11} />
                </button>
              )}
              {fav.series.cover_url ? (
                <img className="cover" src={fav.series.cover_url} alt="" loading="lazy" />
              ) : (
                <div className="cover">{fav.series.title.slice(0, 2).toUpperCase()}</div>
              )}
              <h3>{fav.series.title}</h3>
            </div>
          ))}
          {isSelf && favoriteSeries.length < MAX_FAVORITE_SERIES && (
            <div className="cover-tile favorite-add-tile" onClick={() => setAddingFavoriteSeries(true)}>
              <div className="cover">
                <Icon name="plus" size={18} />
              </div>
              <h3>Add</h3>
            </div>
          )}
        </div>
      )}

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
                <img className="avatar" src={fav.image_url ?? fav.character.image_url!} alt="" loading="lazy" />
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

      {addingFavoriteSeries && me && (
        <AddFavoriteSeriesModal
          existingIds={new Set(favoriteSeries.map((f) => f.series_id))}
          onClose={() => setAddingFavoriteSeries(false)}
          onAdded={(fav) => {
            setFavoriteSeries((prev) => [...prev, fav]);
            setAddingFavoriteSeries(false);
          }}
        />
      )}

      {openFavorite && (
        <Modal title={`${openFavorite.character.name}'s runs`} onClose={() => setOpenFavorite(null)}>
          {favoriteRuns === null && <div className="empty">Loading…</div>}
          {favoriteRuns !== null && favoriteRuns.length === 0 && (
            <div className="empty">No comic runs read with {openFavorite.character.name} yet.</div>
          )}
          {favoriteRuns?.slice(runsPage * 3, runsPage * 3 + 3).map((row) => (
            <div
              className="card series-row"
              key={row.id}
              onClick={() => {
                setOpenFavorite(null);
                onOpenSeries(row.series_id);
              }}
            >
              {row.series.cover_url ? (
                <img className="cover" src={row.series.cover_url} alt="" loading="lazy" />
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
          {favoriteRuns !== null && favoriteRuns.length > 3 && (
            <div className="runs-pager">
              <button
                className="icon-btn"
                disabled={runsPage === 0}
                onClick={() => setRunsPage((p) => Math.max(0, p - 1))}
                aria-label="Previous"
              >
                <Icon name="chevron-up" size={15} />
              </button>
              <span>
                {runsPage * 3 + 1}–{Math.min(runsPage * 3 + 3, favoriteRuns.length)} of {favoriteRuns.length}
              </span>
              <button
                className="icon-btn"
                disabled={(runsPage + 1) * 3 >= favoriteRuns.length}
                onClick={() => setRunsPage((p) => p + 1)}
                aria-label="Next"
              >
                <Icon name="chevron-down" size={15} />
              </button>
            </div>
          )}
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
  onSaved: (patch: {
    bio: string;
    avatar_url: string | null;
    banner_url: string | null;
    fandoms: string;
    nickname: string;
  }) => void;
}) {
  const [bannerUrl, setBannerUrl] = useState(initial.banner_url ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial.avatar_url ?? "");
  const [nickname, setNickname] = useState(initial.nickname);
  const [fandoms, setFandoms] = useState(initial.fandoms);
  const [bio, setBio] = useState(initial.bio);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    if (containsBlockedLanguage(nickname) || containsBlockedLanguage(fandoms) || containsBlockedLanguage(bio)) {
      setError("That contains language that's not allowed here.");
      return;
    }
    onSaved({
      bio: bio.trim(),
      avatar_url: avatarUrl.trim() || null,
      banner_url: bannerUrl.trim() || null,
      fandoms: fandoms.trim(),
      nickname: nickname.trim(),
    });
  }

  return (
    <Modal title="Edit profile" onClose={onClose}>
      <ImageField label="Banner image" value={bannerUrl} onChange={setBannerUrl} folder="profile-banners" />
      <ImageField label="Avatar photo" value={avatarUrl} onChange={setAvatarUrl} folder="avatars" />
      <label className="field">
        <span>Nickname (shown instead of your username)</span>
        <input
          value={nickname}
          onChange={(e) => { setNickname(e.target.value); setError(null); }}
          placeholder={initial.username}
          maxLength={40}
        />
      </label>
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
                    <img className="avatar avatar-square" src={c.image_url} alt="" loading="lazy" />
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

function AddFavoriteSeriesModal({
  existingIds,
  onClose,
  onAdded,
}: {
  existingIds: Set<string>;
  onClose: () => void;
  onAdded: (fav: FavoriteSeriesRow) => void;
}) {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [library, setLibrary] = useState<LibraryRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    fetchLibrary(profile.id).then(setLibrary);
  }, [profile]);

  // Favorites are meant to spotlight comics you've actually added, not the
  // whole shared catalog — so this only searches your own library.
  const q = query.trim().toLowerCase();
  const availableResults = (library ?? [])
    .map((row) => row.series)
    .filter((s) => !existingIds.has(s.id))
    .filter((s) => !q || s.title.toLowerCase().includes(q) || s.publisher.toLowerCase().includes(q));

  async function handleAdd(series: Series) {
    if (!profile || busy) return;
    setBusy(true);
    setError(null);
    try {
      const fav = await addFavoriteSeries(profile.id, series.id);
      onAdded(fav);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that comic.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Add a favorite comic" onClose={onClose}>
      <label className="field">
        <span>Search from your added comics</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Saga, Batman, Monstress…"
          autoFocus
        />
      </label>
      {availableResults.length > 0 && (
        <div className="card" style={{ marginTop: -6 }}>
          {availableResults.slice(0, 8).map((s) => (
            <div className="user-row" key={s.id} onClick={() => handleAdd(s)}>
              {s.cover_url ? (
                <img className="cover" style={{ width: 40, height: 56 }} src={s.cover_url} alt="" loading="lazy" />
              ) : (
                <div className="cover" style={{ width: 40, height: 56 }}>
                  {s.title.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="name">{s.title}</div>
              <span className="sub">{s.publisher || "—"}</span>
            </div>
          ))}
        </div>
      )}
      {library !== null && availableResults.length === 0 && (
        <div className="empty">
          {q ? "No matches in your added comics." : "Add some comics to your library first — favorites are pulled from there."}
        </div>
      )}
      {error && <div className="auth-error">{error}</div>}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}
