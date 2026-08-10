import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  addToLibrary,
  createIssue,
  fetchMyRating,
  fetchRatingSummary,
  fetchSeriesReaderCount,
  fetchSeriesReaders,
  getLibraryEntry,
  getProfile,
  getSeries,
  listIssues,
  listMyReadsForSeries,
  markRead,
  markUnread,
  removeFromLibrary,
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
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [addedBy, setAddedBy] = useState<Profile | null>(null);
  const [readers, setReaders] = useState<Profile[]>([]);
  const [readerCount, setReaderCount] = useState(0);
  const { message, show } = useToast();

  async function reload() {
    if (!profile) return;
    const [s, i, e, reads, sum, mine, readerList, readerTotal] = await Promise.all([
      getSeries(seriesId),
      listIssues(seriesId),
      getLibraryEntry(profile.id, seriesId),
      listMyReadsForSeries(profile.id, seriesId),
      fetchRatingSummary("series", seriesId),
      fetchMyRating(profile.id, "series", seriesId),
      fetchSeriesReaders(seriesId),
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
    setReaders(readerList);
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
            <div className="sub">{series.publisher || "Unknown publisher"}</div>
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
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
            <div className="avatar-stack">
              {readers.slice(0, 4).map((r) => (
                <div key={r.id} className="avatar" onClick={() => onOpenProfile(r.id)}>
                  {r.username.slice(0, 2).toUpperCase()}
                </div>
              ))}
              {readerCount > 4 && <div className="avatar-more">+{readerCount - 4}</div>}
            </div>
            <span className="sub">
              {readerCount} {readerCount === 1 ? "Reader" : "Readers"}
            </span>
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
            <button className="btn-danger" onClick={handleRemove}>
              Remove from library
            </button>
          )}
        </div>
      </div>

      <div className="section-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>
          issues {issues.length > 0 && `· ${readCount}/${issues.length} read`}
        </span>
        <button className="btn-link" onClick={() => setShowAddIssue(true)}>
          + Add issue
        </button>
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

      {showAddIssue && (
        <AddIssueModal
          seriesId={seriesId}
          nextNumber={String(issues.length + 1)}
          onClose={() => setShowAddIssue(false)}
          onAdded={() => {
            setShowAddIssue(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function AddIssueModal({
  seriesId,
  nextNumber,
  onClose,
  onAdded,
}: {
  seriesId: string;
  nextNumber: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { profile } = useAuth();
  const [issueNumber, setIssueNumber] = useState(nextNumber);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!profile || !issueNumber.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createIssue({
        series_id: seriesId,
        issue_number: issueNumber.trim(),
        title: title.trim(),
        cover_url: null,
        created_by: profile.id,
      });
      onAdded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that issue.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add issue" onClose={onClose}>
      <label className="field">
        <span>Issue number</span>
        <input value={issueNumber} onChange={(e) => setIssueNumber(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span>Title (optional)</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      {error && <div className="auth-error">{error}</div>}
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy || !issueNumber.trim()} onClick={handleSubmit}>
          Add
        </button>
      </div>
    </Modal>
  );
}
