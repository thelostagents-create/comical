import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  addToLibrary,
  createIssue,
  createSeries,
  fetchLibrary,
  getComicVineVolume,
  searchComicVine,
  searchSeries,
  upsertRating,
  type ComicVineVolume,
  type LibraryRow,
} from "../lib/data";
import { getJournalCover } from "../lib/journalPrefs";
import type { LibraryStatus, Series } from "../types";
import { LIBRARY_STATUS_LABELS } from "../types";
import { Icon } from "./Icons";
import Modal from "./Modal";
import RatingStars from "./RatingStars";
import { Toast, useToast } from "./Toast";

const MAX_IMPORTED_ISSUES = 60;

const FILTERS: Array<LibraryStatus | "all"> = ["all", "reading", "plan_to_read", "completed", "dropped"];

export default function Library({
  onOpenSeries,
  onOpenJournal,
}: {
  onOpenSeries: (seriesId: string) => void;
  onOpenJournal: () => void;
}) {
  const { profile } = useAuth();
  const [rows, setRows] = useState<LibraryRow[] | null>(null);
  const [filter, setFilter] = useState<LibraryStatus | "all">("all");
  const [showAdd, setShowAdd] = useState(false);
  const { message, show } = useToast();

  async function reload() {
    if (!profile) return;
    setRows(await fetchLibrary(profile.id));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  const visible = rows?.filter((r) => filter === "all" || r.status === filter) ?? [];

  return (
    <div>
      <div className="page-title">Your Library</div>

      <div className="tabs-inline">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
            {f === "all" ? "all" : LIBRARY_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {rows === null && <div className="empty">Loading…</div>}
      {rows !== null && visible.length === 0 && (
        <div className="empty">
          Nothing here yet.
          <br />
          Tap + to add a comic you're reading.
        </div>
      )}

      <div className="cover-grid">
        <div className="cover-tile journal-tile" onClick={onOpenJournal}>
          {getJournalCover() ? (
            <img className="cover" src={getJournalCover()!} alt="" />
          ) : (
            <div className="cover">
              <Icon name="sparkle" size={18} />
            </div>
          )}
          <h3>My Journal</h3>
          <div className="tile-meta">
            <span>your blurbs</span>
          </div>
        </div>
        {visible.map((row) => (
          <div className="cover-tile" key={row.id} onClick={() => onOpenSeries(row.series_id)}>
            {row.status === "completed" && (
              <div className="stamp">
                read
                <br />★
              </div>
            )}
            {row.series.cover_url ? (
              <img className="cover" src={row.series.cover_url} alt="" />
            ) : (
              <div className="cover">{row.series.title.slice(0, 2).toUpperCase()}</div>
            )}
            <h3>{row.series.title}</h3>
            <div className="tile-meta">
              <span>
                <Icon name="book" size={9} />
                {row.readCount}/{row.issueCount || "–"}
              </span>
              <span>{LIBRARY_STATUS_LABELS[row.status]}</span>
            </div>
            {row.issueCount > 0 && (
              <div className="progress-bar">
                <div style={{ width: `${Math.round((row.readCount / row.issueCount) * 100)}%` }} />
              </div>
            )}
          </div>
        ))}
      </div>

      <button className="fab" onClick={() => setShowAdd(true)} aria-label="Add series">
        <Icon name="plus" />
      </button>

      <Toast message={message} />

      {showAdd && (
        <AddSeriesModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            reload();
            show("Added to your library");
          }}
        />
      )}
    </div>
  );
}

type Step = "search" | "create" | "cvsearch" | "rate";

function AddSeriesModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Series[]>([]);
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [chosen, setChosen] = useState<Series | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [cvQuery, setCvQuery] = useState("");
  const [cvResults, setCvResults] = useState<ComicVineVolume[]>([]);
  const [cvSearching, setCvSearching] = useState(false);
  const [cvImportingId, setCvImportingId] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(async () => setResults(await searchSeries(query)), 200);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (step !== "cvsearch") return;
    setCvError(null);
    const t = setTimeout(async () => {
      setCvSearching(true);
      try {
        setCvResults(await searchComicVine(cvQuery));
      } catch (e) {
        setCvError(e instanceof Error ? e.message : "Couldn't reach Comic Vine.");
        setCvResults([]);
      } finally {
        setCvSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [cvQuery, step]);

  function pick(series: Series) {
    setChosen(series);
    setStep("rate");
  }

  async function handleCreate() {
    if (!profile || !title.trim()) return;
    setBusy(true);
    const series = await createSeries({
      title: title.trim(),
      publisher: publisher.trim(),
      description: description.trim(),
      cover_url: coverUrl.trim() || null,
      created_by: profile.id,
    });
    setBusy(false);
    setChosen(series);
    setStep("rate");
  }

  async function importFromComicVine(volume: ComicVineVolume) {
    if (!profile) return;
    setCvImportingId(volume.id);
    setCvError(null);
    try {
      const { issues } = await getComicVineVolume(volume.id);
      const series = await createSeries({
        title: volume.name,
        publisher: volume.publisher,
        description: volume.description,
        cover_url: volume.imageUrl,
        created_by: profile.id,
      });
      for (const issue of issues.slice(0, MAX_IMPORTED_ISSUES)) {
        await createIssue({
          series_id: series.id,
          issue_number: issue.issueNumber,
          title: issue.title,
          cover_url: null,
          created_by: profile.id,
        });
      }
      setChosen(series);
      setStep("rate");
    } catch (e) {
      setCvError(e instanceof Error ? e.message : "Couldn't import that series from Comic Vine.");
    } finally {
      setCvImportingId(null);
    }
  }

  async function finalize() {
    if (!profile || !chosen) return;
    setBusy(true);
    await addToLibrary(profile.id, chosen.id);
    if (rating > 0) {
      await upsertRating({
        user_id: profile.id,
        target_type: "series",
        target_id: chosen.id,
        rating,
        review: notes.trim(),
      });
    }
    setBusy(false);
    onAdded();
  }

  return (
    <Modal
      title={
        step === "rate"
          ? `Rate ${chosen?.title ?? ""}`
          : step === "cvsearch"
            ? "Search Comic Vine"
            : "Add a comic"
      }
      onClose={onClose}
    >
      {step === "search" && (
        <>
          <div className="field">
            <span>Search the catalog</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Saga, Batman, Monstress…"
            />
          </div>
          <div>
            {results.map((s) => (
              <div className="card series-row" key={s.id} onClick={() => pick(s)}>
                {s.cover_url ? (
                  <img className="cover" src={s.cover_url} alt="" />
                ) : (
                  <div className="cover">{s.title.slice(0, 2).toUpperCase()}</div>
                )}
                <div className="meta">
                  <h3>{s.title}</h3>
                  <div className="sub">{s.publisher || "—"}</div>
                </div>
              </div>
            ))}
            {query.trim() && results.length === 0 && (
              <div className="empty">No matches in your catalog.</div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={() => { setStep("cvsearch"); setCvQuery(query); }}>
              <Icon name="search" size={13} /> Search Comic Vine
            </button>
            <button className="btn-secondary" onClick={() => { setStep("create"); setTitle(query); }}>
              <Icon name="plus" size={13} /> Create new series
            </button>
          </div>
        </>
      )}

      {step === "cvsearch" && (
        <>
          <div className="field">
            <span>Search Comic Vine</span>
            <input
              autoFocus
              value={cvQuery}
              onChange={(e) => setCvQuery(e.target.value)}
              placeholder="Saga, Batman, Monstress…"
            />
          </div>
          {cvError && <div className="auth-error">{cvError}</div>}
          <div>
            {cvResults.map((v) => (
              <div className="card series-row" key={v.id} onClick={() => !cvImportingId && importFromComicVine(v)}>
                {v.imageUrl ? (
                  <img className="cover" src={v.imageUrl} alt="" />
                ) : (
                  <div className="cover">{v.name.slice(0, 2).toUpperCase()}</div>
                )}
                <div className="meta">
                  <h3>{v.name}</h3>
                  <div className="sub">
                    {v.publisher || "—"}
                    {v.startYear ? ` · ${v.startYear}` : ""}
                    {v.issueCount ? ` · ${v.issueCount} issues` : ""}
                  </div>
                </div>
                {cvImportingId === v.id && <span className="sub">Importing…</span>}
              </div>
            ))}
            {!cvSearching && !cvError && cvQuery.trim() && cvResults.length === 0 && (
              <div className="empty">No matches on Comic Vine.</div>
            )}
          </div>
          <button className="btn-secondary" onClick={() => setStep("search")}>
            <Icon name="back" size={13} /> Back
          </button>
        </>
      )}

      {step === "create" && (
        <>
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </label>
          <label className="field">
            <span>Publisher</span>
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="Image, Marvel, DC…" />
          </label>
          <label className="field">
            <span>Cover image URL (optional)</span>
            <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
          </label>
          <label className="field">
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setStep("search")}>
              Back
            </button>
            <button className="btn-primary" disabled={busy || !title.trim()} onClick={handleCreate}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === "rate" && chosen && (
        <>
          <div className="card series-row">
            {chosen.cover_url ? (
              <img className="cover" src={chosen.cover_url} alt="" />
            ) : (
              <div className="cover">{chosen.title.slice(0, 2).toUpperCase()}</div>
            )}
            <div className="meta">
              <h3>{chosen.title}</h3>
              <div className="sub">{chosen.publisher || "—"}</div>
            </div>
          </div>
          <label className="field">
            <span>Your rating (optional)</span>
            <RatingStars value={rating} onChange={setRating} size={28} />
          </label>
          <label className="field">
            <span>Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What did you think so far?"
            />
          </label>
          <div className="modal-actions">
            <button className="btn-primary" disabled={busy} onClick={finalize}>
              Add to library
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
