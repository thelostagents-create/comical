import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  fetchCharacterRuns,
  fetchCharactersByIds,
  fetchLibrary,
  fetchMyBlurbs,
  fetchReadCharacterAppearances,
  profileStats,
  type Blurb,
  type LibraryRow,
} from "../lib/data";
import { getCharacterImageOverride } from "../lib/characterImagePrefs";
import { getJournalCover, setJournalCover } from "../lib/journalPrefs";
import { timeAgo } from "../lib/format";
import type { Character } from "../types";
import EditCharacterImageModal from "./EditCharacterImageModal";
import { Icon } from "./Icons";
import ImageField from "./ImageField";
import Modal from "./Modal";
import RatingStars from "./RatingStars";

export default function Journal({
  onBack,
  onOpenSeries,
}: {
  onBack: () => void;
  onOpenSeries: (seriesId: string) => void;
}) {
  const { profile } = useAuth();
  const [cover, setCover] = useState(getJournalCover());
  const [readCount, setReadCount] = useState(0);
  const [seriesCount, setSeriesCount] = useState(0);
  const [topCharacters, setTopCharacters] = useState<(Character & { issuesRead: number })[]>([]);
  const [blurbs, setBlurbs] = useState<Blurb[] | null>(null);
  const [showCoverModal, setShowCoverModal] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [openCharacter, setOpenCharacter] = useState<Character | null>(null);
  const [characterRuns, setCharacterRuns] = useState<LibraryRow[] | null>(null);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [stats, myBlurbs, appearances] = await Promise.all([
        profileStats(profile.id),
        fetchMyBlurbs(profile.id),
        fetchReadCharacterAppearances(profile.id),
      ]);
      setReadCount(stats.readCount);
      setSeriesCount(stats.seriesCount);
      setBlurbs(myBlurbs);

      // Only characters Comic Vine actually lists in an issue you've marked
      // read — no more guessing a character's presence from series titles.
      const issuesReadByCharacter = new Map<string, number>();
      for (const a of appearances) {
        issuesReadByCharacter.set(a.characterId, (issuesReadByCharacter.get(a.characterId) ?? 0) + 1);
      }

      const characters = await fetchCharactersByIds([...issuesReadByCharacter.keys()]);
      const charsWithStats = characters
        .map((c) => ({ ...c, issuesRead: issuesReadByCharacter.get(c.id) ?? 0 }))
        .sort((a, b) => b.issuesRead - a.issuesRead)
        .slice(0, 6);
      setTopCharacters(charsWithStats);
    })();
  }, [profile]);

  async function openCharacterRuns(c: Character) {
    if (!profile) return;
    setOpenCharacter(c);
    setCharacterRuns(null);
    const library = await fetchLibrary(profile.id);
    setCharacterRuns(await fetchCharacterRuns(profile.id, c, library));
  }

  return (
    <div>
      <div className="detail-header">
        <button className="back" onClick={onBack}>
          <Icon name="back" />
        </button>
        <div className="page-title" style={{ margin: 0 }}>My Journal</div>
      </div>

      <div className="card journal-header">
        <div className="journal-cover">
          {cover ? (
            <img src={cover} alt="" />
          ) : (
            <div className="journal-cover-placeholder">
              <Icon name="sparkle" size={26} />
            </div>
          )}
          <button className="icon-btn journal-cover-edit" onClick={() => setShowCoverModal(true)} aria-label="Edit journal cover">
            <Icon name="edit" size={15} />
          </button>
        </div>

        <div className="stats-row journal-stats">
          <div className="stat">
            <b>{readCount}</b>
            <span>Issues read</span>
          </div>
          <div className="stat">
            <b>{seriesCount}</b>
            <span>Series</span>
          </div>
          <div className="stat">
            <b>{blurbs?.length ?? 0}</b>
            <span>Blurbs</span>
          </div>
        </div>
      </div>

      <div className="section-title">most-read characters</div>
      {topCharacters.length === 0 ? (
        <div className="empty">
          Nothing here yet.
          <br />
          This only counts characters Comic Vine lists in an issue you've
          read — add a comic via "Search Comic Vine" (not a manual entry)
          and mark some issues read to see them here.
        </div>
      ) : (
        <div className="character-grid">
          {topCharacters.map((c) => {
            const displayImage = getCharacterImageOverride(c.id) ?? c.image_url;
            return (
            <div className="character-tile" key={c.id} onClick={() => openCharacterRuns(c)}>
              <button
                className="character-tile-edit"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingCharacter(c);
                }}
                aria-label={`Edit ${c.name}'s photo`}
              >
                <Icon name="edit" size={11} />
              </button>
              {displayImage ? (
                <img className="avatar" src={displayImage} alt="" />
              ) : (
                <div className="avatar">{c.name.slice(0, 2).toUpperCase()}</div>
              )}
              <h3>{c.name}</h3>
              <div className="character-meta">
                <Icon name="book" size={9} />
                {c.issuesRead} {c.issuesRead === 1 ? "issue" : "issues"}
              </div>
            </div>
            );
          })}
        </div>
      )}

      <div className="section-title">your blurbs</div>
      {blurbs === null && <div className="empty">Loading…</div>}
      {blurbs !== null && blurbs.length === 0 && (
        <div className="empty">
          Nothing here yet.
          <br />
          Rate a series or issue with a note and it'll show up here.
        </div>
      )}
      {blurbs !== null &&
        blurbs.map((b) => (
          <div
            className="card blurb-card"
            key={b.id}
            onClick={() => b.targetType === "series" && onOpenSeries(b.targetId)}
          >
            <div className="blurb-head">
              <span className="blurb-label">{b.label}</span>
              <RatingStars value={b.rating} size={12} />
            </div>
            <p className="blurb-review">"{b.review}"</p>
            <div className="when">{timeAgo(b.at)}</div>
          </div>
        ))}

      {showCoverModal && (
        <CoverModal
          initial={cover ?? ""}
          onClose={() => setShowCoverModal(false)}
          onSaved={(url) => {
            setJournalCover(url || null);
            setCover(url || null);
            setShowCoverModal(false);
          }}
        />
      )}

      {editingCharacter && (
        <EditCharacterImageModal
          character={editingCharacter}
          onClose={() => setEditingCharacter(null)}
          onSaved={(imageUrl) => {
            setTopCharacters((prev) => prev.map((c) => (c.id === editingCharacter.id ? { ...c, image_url: imageUrl } : c)));
            setEditingCharacter(null);
          }}
        />
      )}

      {openCharacter && (
        <Modal title={`${openCharacter.name}'s runs`} onClose={() => setOpenCharacter(null)}>
          {characterRuns === null && <div className="empty">Loading…</div>}
          {characterRuns !== null && characterRuns.length === 0 && (
            <div className="empty">No comic runs read with {openCharacter.name} yet.</div>
          )}
          {characterRuns?.map((row) => (
            <div
              className="card series-row"
              key={row.id}
              onClick={() => {
                setOpenCharacter(null);
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
                <div className="sub">{row.series.publisher || "—"}</div>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}

function CoverModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: string;
  onClose: () => void;
  onSaved: (url: string) => void;
}) {
  const [url, setUrl] = useState(initial);
  return (
    <Modal title="Journal cover" onClose={onClose}>
      <ImageField label="Cover image" value={url} onChange={setUrl} folder="journal" />
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" onClick={() => onSaved(url.trim())}>
          Save
        </button>
      </div>
    </Modal>
  );
}
