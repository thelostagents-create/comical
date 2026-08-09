import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { addToLibrary, createSeries, fetchLibrary, searchSeries, type LibraryRow } from "../lib/data";
import type { LibraryStatus, Series } from "../types";
import { LIBRARY_STATUS_LABELS } from "../types";
import { Icon } from "./Icons";
import Modal from "./Modal";
import { Toast, useToast } from "./Toast";

const FILTERS: Array<LibraryStatus | "all"> = ["all", "reading", "plan_to_read", "completed", "dropped"];

export default function Library({ onOpenSeries }: { onOpenSeries: (seriesId: string) => void }) {
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
      <div className="page-title">your library</div>

      <div className="tabs-inline">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? "active" : ""} onClick={() => setFilter(f)}>
            {f === "all" ? "all" : LIBRARY_STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {rows === null && <div className="empty">loading…</div>}
      {rows !== null && visible.length === 0 && (
        <div className="empty">
          nothing here yet.
          <br />
          tap + to add a comic you're reading.
        </div>
      )}

      <div className="cover-grid">
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
                <Icon name="book" size={12} />
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
            show("added to your library");
          }}
        />
      )}
    </div>
  );
}

function AddSeriesModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { profile } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Series[]>([]);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [publisher, setPublisher] = useState("");
  const [description, setDescription] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(async () => setResults(await searchSeries(query)), 200);
    return () => clearTimeout(t);
  }, [query]);

  async function pick(series: Series) {
    if (!profile) return;
    setBusy(true);
    await addToLibrary(profile.id, series.id);
    setBusy(false);
    onAdded();
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
    await addToLibrary(profile.id, series.id);
    setBusy(false);
    onAdded();
  }

  return (
    <Modal title="add a comic" onClose={onClose}>
      {!creating && (
        <>
          <div className="field">
            <span>search the catalog</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="saga, batman, monstress…"
            />
          </div>
          <div>
            {results.map((s) => (
              <div className="card series-row" key={s.id} onClick={() => !busy && pick(s)}>
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
              <div className="empty">no matches. add it as a new series below.</div>
            )}
          </div>
          <button className="btn-secondary" onClick={() => { setCreating(true); setTitle(query); }}>
            <Icon name="plus" size={13} /> create new series
          </button>
        </>
      )}

      {creating && (
        <>
          <label className="field">
            <span>title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus required />
          </label>
          <label className="field">
            <span>publisher</span>
            <input value={publisher} onChange={(e) => setPublisher(e.target.value)} placeholder="image, marvel, dc…" />
          </label>
          <label className="field">
            <span>cover image url (optional)</span>
            <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" />
          </label>
          <label className="field">
            <span>description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <div className="modal-actions">
            <button className="btn-secondary" onClick={() => setCreating(false)}>
              back
            </button>
            <button className="btn-primary" disabled={busy || !title.trim()} onClick={handleCreate}>
              add to library
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
