import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  addToLibrary,
  createIssue,
  createSeries,
  fetchLibrary,
  fetchRecentSeries,
  findOrCreateComicVineCharacter,
  getComicVineVolume,
  linkIssueCharacters,
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
// Fetching a character's photo costs its own Comic Vine request — cap how
// many *new* characters a single import will fetch one for, so a run with a
// huge cast can't blow through the rate limit by itself. Characters beyond
// this just import without a photo (still gets backfilled on a later import
// that references them, per findOrCreateComicVineCharacter).
const MAX_NEW_CHARACTER_IMAGE_FETCHES = 15;

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
              <div className="stamp" aria-label="Read">
                <Icon name="check" size={11} />
              </div>
            )}
            {row.starred && (
              <div className="pinned-star" aria-label="Starred">
                <Icon name="star" size={11} />
              </div>
            )}
            {row.series.cover_url ? (
              <img className="cover" src={row.series.cover_url} alt="" loading="lazy" />
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

type Step = "search" | "cvsearch" | "rate";

function AddSeriesModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const { profile } = useAuth();
  const [step, setStep] = useState<Step>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Series[]>([]);
  const [chosen, setChosen] = useState<Series | null>(null);
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [cvQuery, setCvQuery] = useState("");
  const [cvYear, setCvYear] = useState("");
  const [cvResults, setCvResults] = useState<ComicVineVolume[]>([]);
  const [cvSearching, setCvSearching] = useState(false);
  const [cvImportingId, setCvImportingId] = useState<string | null>(null);
  const [cvError, setCvError] = useState<string | null>(null);
  const [cvWarning, setCvWarning] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(
      async () => setResults(query.trim() ? await searchSeries(query) : await fetchRecentSeries()),
      200,
    );
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

  // Comic Vine's search often returns the same title from several different
  // years/runs — filtering the already-fetched results client-side costs no
  // extra requests, unlike re-searching with the year baked into the query.
  const visibleCvResults = cvYear.trim() ? cvResults.filter((v) => v.startYear === cvYear.trim()) : cvResults;

  async function importFromComicVine(volume: ComicVineVolume) {
    if (!profile) return;
    setCvImportingId(volume.id);
    setCvError(null);
    setCvWarning(null);
    try {
      const { issues, characterFetchWarning } = await getComicVineVolume(volume.id);
      setCvWarning(characterFetchWarning);
      const series = await createSeries({
        title: volume.name,
        publisher: volume.publisher,
        description: volume.description,
        cover_url: volume.imageUrl,
        created_by: profile.id,
      });
      const characterCache = new Map<string, string>(); // comicvineId -> character id
      let newCharacterImageFetches = 0;
      for (const issue of issues.slice(0, MAX_IMPORTED_ISSUES)) {
        const createdIssue = await createIssue({
          series_id: series.id,
          issue_number: issue.issueNumber,
          title: issue.title,
          cover_url: null,
          created_by: profile.id,
        });
        if (issue.characters.length > 0) {
          const characterIds = await Promise.all(
            issue.characters.map(async (c) => {
              let characterId = characterCache.get(c.comicvineId);
              if (!characterId) {
                const fetchImage = newCharacterImageFetches < MAX_NEW_CHARACTER_IMAGE_FETCHES;
                if (fetchImage) newCharacterImageFetches += 1;
                const character = await findOrCreateComicVineCharacter({
                  comicvineId: c.comicvineId,
                  name: c.name,
                  publisher: volume.publisher,
                  created_by: profile.id,
                  fetchImage,
                });
                characterId = character.id;
                characterCache.set(c.comicvineId, characterId);
              }
              return characterId;
            }),
          );
          await linkIssueCharacters(createdIssue.id, characterIds);
        }
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
            {!query.trim() && results.length > 0 && (
              <div className="sub" style={{ margin: "0 0 6px" }}>Recently added — search to see the rest of the catalog</div>
            )}
            {results.map((s) => (
              <div className="card series-row" key={s.id} onClick={() => pick(s)}>
                {s.cover_url ? (
                  <img className="cover" src={s.cover_url} alt="" loading="lazy" />
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
              <div className="empty">
                Not yet imported to our catalog.
                <br />
                <button
                  type="button"
                  className="btn-link"
                  onClick={() => { setStep("cvsearch"); setCvQuery(query); }}
                >
                  Import from Comic Vine
                </button>
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn-secondary" onClick={() => { setStep("cvsearch"); setCvQuery(query); }}>
              <Icon name="search" size={13} /> Search Comic Vine
            </button>
          </div>
        </>
      )}

      {step === "cvsearch" && (
        <>
          <div style={{ display: "flex", gap: 8 }}>
            <div className="field" style={{ flex: 1 }}>
              <span>Search Comic Vine</span>
              <input
                autoFocus
                value={cvQuery}
                onChange={(e) => setCvQuery(e.target.value)}
                placeholder="Saga, Batman, Monstress…"
              />
            </div>
            <div className="field" style={{ width: 90 }}>
              <span>Year</span>
              <input
                value={cvYear}
                onChange={(e) => setCvYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="e.g. 2016"
                inputMode="numeric"
              />
            </div>
          </div>
          {cvError && <div className="auth-error">{cvError}</div>}
          <div>
            {visibleCvResults.map((v) => (
              <div className="card series-row" key={v.id} onClick={() => !cvImportingId && importFromComicVine(v)}>
                {v.imageUrl ? (
                  <img className="cover" src={v.imageUrl} alt="" loading="lazy" />
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
            {!cvSearching && !cvError && cvQuery.trim() && visibleCvResults.length === 0 && (
              <div className="empty">
                {cvYear.trim() ? `No ${cvYear.trim()} matches on Comic Vine.` : "No matches on Comic Vine."}
              </div>
            )}
          </div>
          <button className="btn-secondary" onClick={() => setStep("search")}>
            <Icon name="back" size={13} /> Back
          </button>
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
          {cvWarning && (
            <div className="auth-error">
              Imported, but character data may be incomplete: {cvWarning}
            </div>
          )}
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
