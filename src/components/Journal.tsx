import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  fetchLibrary,
  fetchMyBlurbs,
  getCharactersBySeriesIds,
  profileStats,
  type Blurb,
} from "../lib/data";
import { getJournalCover, setJournalCover } from "../lib/journalPrefs";
import { timeAgo } from "../lib/format";
import type { Character } from "../types";
import { Icon } from "./Icons";
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
  const [topCharacters, setTopCharacters] = useState<(Character & { issuesRead: number; seriesTitle: string })[]>([]);
  const [blurbs, setBlurbs] = useState<Blurb[] | null>(null);
  const [showCoverModal, setShowCoverModal] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [stats, library, myBlurbs] = await Promise.all([
        profileStats(profile.id),
        fetchLibrary(profile.id),
        fetchMyBlurbs(profile.id),
      ]);
      setReadCount(stats.readCount);
      setSeriesCount(stats.seriesCount);
      setBlurbs(myBlurbs);

      const topRows = library
        .filter((row) => row.readCount > 0)
        .sort((a, b) => b.readCount - a.readCount)
        .slice(0, 5);
      const seriesStatsById = new Map(
        topRows.map((row) => [row.series_id, { readCount: row.readCount, title: row.series.title }]),
      );
      const chars = await getCharactersBySeriesIds(topRows.map((row) => row.series_id));
      const charsWithStats = chars
        .map((c) => {
          const stats = c.series_id ? seriesStatsById.get(c.series_id) : undefined;
          return { ...c, issuesRead: stats?.readCount ?? 0, seriesTitle: stats?.title ?? "" };
        })
        .sort((a, b) => b.issuesRead - a.issuesRead);
      setTopCharacters(charsWithStats);
    })();
  }, [profile]);

  return (
    <div>
      <div className="detail-header">
        <button className="back" onClick={onBack}>
          <Icon name="back" />
        </button>
        <div className="page-title" style={{ margin: 0 }}>My Journal</div>
      </div>

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

      <div className="stats-row">
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

      {topCharacters.length > 0 && (
        <>
          <div className="section-title">most-read characters</div>
          <div className="character-grid">
            {topCharacters.map((c) => (
              <div className="character-tile" key={c.id}>
                {c.image_url ? (
                  <img className="avatar" src={c.image_url} alt="" />
                ) : (
                  <div className="avatar">{c.name.slice(0, 2).toUpperCase()}</div>
                )}
                <h3>{c.name}</h3>
                <div className="character-meta">
                  <Icon name="book" size={9} />
                  {c.issuesRead} {c.issuesRead === 1 ? "issue" : "issues"}
                </div>
              </div>
            ))}
          </div>
        </>
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
      <label className="field">
        <span>Image URL</span>
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" autoFocus />
      </label>
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
