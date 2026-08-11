import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  addToLibrary,
  fetchMyRating,
  fetchRatingSummary,
  fetchSeriesReaderCount,
  getLibraryEntry,
  getProfile,
  getSeries,
  listIssues,
  listMyReadsForSeries,
  markRead,
  markUnread,
  removeFromLibrary,
  setLibraryStarred,
  updateLibraryStatus,
  upsertRating,
} from "../lib/data";
import type { Issue, LibraryEntry, LibraryStatus, Profile, Series } from "../types";
import { LIBRARY_STATUS_LABELS } from "../types";
import { Icon } from "./Icons";
import Modal from "./Modal";
import RatingStars from "./RatingStars";
import { Toast, useToast } from "./Toast";

const STATUS_OPTIONS: LibraryStatus[] = ["plan_to_read", "reading", "completed", "dropped"];

export default function SeriesDetail({
  seriesId,
  onBack,
  onOpenProfile,
}: {
  seriesId: string;
  onBack: () => void;
  onOpenProfile: (userId?: string) => void;
}) {
  const { profile } = useAuth();
  const [series, setSeries] = useState<Series | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [entry, setEntry] = useState<LibraryEntry | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [summary, setSummary] = useState<{ average: number | null; count: number }>({ average: null, count: 0 });
  const [myRating, setMyRating] = useState(0);
  const [myReview, setMyReview] = useState("");
  const [showRate, setShowRate] = useState(false);
  const [addedBy, setAddedBy] = useState<Profile | null>(null);
  const [readerCount, setReaderCount] = useState(0);
  const { message, show } = useToast();

  async function reload() {
    if (!profile) return;
    const [s, i, e, reads, sum, mine, readerTotal] = await Promise.all([
      getSeries(seriesId),
      listIssues(seriesId),
      getLibraryEntry(profile.id, seriesId),
      listMyReadsForSeries(profile.id, seriesId),
      fetchRatingSummary("series", seriesId),
      fetchMyRating(profile.id, "series", seriesId),
      fetchSeriesReaderCount(seriesId),
    ]);
    setSeries(s);
    setIssues(i);
    setEntry(e);
    setReadIds(new Set(reads.map((r) => r.issue_id)));
    setSummary(sum);
    if (mine) {
      setMyRating(mine.rating);
      setMyReview(mine.review);
    }
    setAddedBy(s.created_by ? await getProfile(s.created_by) : null);
    setReaderCount(readerTotal);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seriesId, profile?.id]);

  async function toggleRead(issueId: string) {
    if (!profile) return;
    const isRead = readIds.has(issueId);
    const next = new Set(readIds);
    isRead ? next.delete(issueId) : next.add(issueId);
    setReadIds(next);
    if (isRead) await markUnread(profile.id, issueId);
    else await markRead(profile.id, issueId);
  }

  async function handleStatusChange(status: LibraryStatus) {
    if (!profile) return;
    if (!entry) {
      setEntry(await addToLibrary(profile.id, seriesId, status));
    } else {
      await updateLibraryStatus(entry.id, status);
      setEntry({ ...entry, status });
    }
  }

  async function handleRemove() {
    if (!entry) return;
    await removeFromLibrary(entry.id);
    setEntry(null);
  }

  async function handleToggleStar() {
    if (!entry) return;
    const starred = !entry.starred;
    setEntry({ ...entry, starred });
    await setLibraryStarred(entry.id, starred);
  }

  async function submitRating() {
    if (!profile) return;
    await upsertRating({
      user_id: profile.id,
      target_type: "series",
      target_id: seriesId,
      rating: myRating,
      review: myReview.trim(),
    });
    setShowRate(false);
    setSummary(await fetchRatingSummary("series", seriesId));
    show("Rating saved");
  }

  if (!series) return <div className="empty">Loading…</div>;

  const readCount = issues.filter((i) => readIds.has(i.id)).length;

  return (
    <div>
      <div className="detail-header">
        <button className="back" onClick={onBack}>
          <Icon name="back" />
        </button>
        <div className="page-title" style={{ margin: 0 }}>{series.title}</div>
      </div>

      <div className="card">
        <div style={{ display: "flex", gap: 14 }}>
          {series.cover_url ? (
            <img className="cover" style={{ width: 72, height: 100 }} src={series.cover_url} alt="" />
          ) : (
            <div className="cover" style={{ width: 72, height: 100 }}>
              {series.title.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sub">
              {series.publisher || "Unknown publisher"}
              {series.start_year ? ` · ${series.start_year}` : ""}
            </div>
            {series.description && <p style={{ fontSize: 13, color: "var(--text-dim)", margin: "6px 0 0" }}>{series.description}</p>}
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <RatingStars value={summary.average ? Math.round(summary.average) : 0} size={14} />
              <span className="sub">
                {summary.average ? summary.average.toFixed(1) : "—"} ({summary.count})
              </span>
            </div>
            {addedBy && (
              <button className="btn-link" style={{ padding: "6px 0 0" }} onClick={() => onOpenProfile(addedBy.id)}>
                Added by @{addedBy.username}
              </button>
            )}
          </div>
        </div>

        {readerCount > 0 && (
          <div className="sub" style={{ marginTop: 14 }}>
            {readerCount} {readerCount === 1 ? "Reader" : "Readers"}
          </div>
        )}

        <div className="tabs-inline" style={{ marginTop: 14, marginBottom: 0 }}>
          {STATUS_OPTIONS.map((s) => (
            <button key={s} className={entry?.status === s ? "active" : ""} onClick={() => handleStatusChange(s)}>
              {LIBRARY_STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn-secondary" onClick={() => setShowRate(true)}>
            <Icon name="star" size={12} /> {myRating ? `Your rating: ${myRating}` : "Rate this series"}
          </button>
          {entry && (
            <>
              <button
                className={`star-toggle ${entry.starred ? "starred" : ""}`}
                onClick={handleToggleStar}
                aria-label={entry.starred ? "Unstar this series" : "Star this series"}
                title={entry.starred ? "Starred — shows first in your library" : "Star to show first in your library"}
              >
                <Icon name="star" size={16} />
              </button>
              <button className="btn-danger" onClick={handleRemove}>
                Remove from library
              </button>
            </>
          )}
        </div>
      </div>

      <div className="section-title">
        issues {issues.length > 0 && `· ${readCount}/${issues.length} read`}
      </div>

      <div className="card">
        {issues.length === 0 && <div className="empty">No issues logged yet.</div>}
        {issues.map((issue) => (
          <div className="issue-row" key={issue.id}>
            <span className="num">#{issue.issue_number}</span>
            <span className="title">{issue.title || `Issue ${issue.issue_number}`}</span>
            <button
              className={`read-toggle ${readIds.has(issue.id) ? "read" : ""}`}
              onClick={() => toggleRead(issue.id)}
              aria-label="Toggle read"
            >
              <Icon name="check" size={16} />
            </button>
          </div>
        ))}
      </div>

      <Toast message={message} />

      {showRate && (
        <Modal title={`Rate ${series.title}`} onClose={() => setShowRate(false)}>
          <RatingStars value={myRating} onChange={setMyRating} size={30} />
          <label className="field">
            <span>Review (optional)</span>
            <textarea value={myReview} onChange={(e) => setMyReview(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setShowRate(false)}>
              Cancel
            </button>
            <button className="btn-primary" disabled={!myRating} onClick={submitRating}>
              Save
            </button>
          </div>
        </Modal>
      )}

    </div>
  );
}
