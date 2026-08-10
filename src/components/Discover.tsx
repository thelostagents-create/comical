import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import {
  createCharacter,
  createShow,
  searchCharacters,
  searchShows,
  searchSeries,
} from "../lib/data";
import type { Character, Series, Show } from "../types";
import { Icon } from "./Icons";
import Modal from "./Modal";

type Mode = "comics" | "characters" | "shows";

export default function Discover({ onOpenSeries }: { onOpenSeries: (seriesId: string) => void }) {
  const [mode, setMode] = useState<Mode>("comics");
  const [query, setQuery] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    setQuery("");
  }, [mode]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (mode === "comics") setSeries(await searchSeries(query));
      else if (mode === "characters") setCharacters(await searchCharacters(query));
      else setShows(await searchShows(query));
    }, 200);
    return () => clearTimeout(t);
  }, [query, mode]);

  async function reload() {
    if (mode === "characters") setCharacters(await searchCharacters(query));
    else if (mode === "shows") setShows(await searchShows(query));
  }

  return (
    <div>
      <div className="page-title">Discover</div>

      <div className="tabs-inline">
        <button className={mode === "comics" ? "active" : ""} onClick={() => setMode("comics")}>
          Comics
        </button>
        <button className={mode === "characters" ? "active" : ""} onClick={() => setMode("characters")}>
          Characters
        </button>
        <button className={mode === "shows" ? "active" : ""} onClick={() => setMode("shows")}>
          Shows
        </button>
      </div>

      <div className="search-row">
        <div className="search-box">
          <Icon name="search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${mode}…`}
          />
        </div>
        {mode !== "comics" && (
          <button className="icon-btn" onClick={() => setShowCreate(true)} aria-label={`Add a ${mode === "characters" ? "character" : "show"}`}>
            <Icon name="plus" size={16} />
          </button>
        )}
      </div>

      {mode === "comics" &&
        (series.length === 0 ? (
          <div className="empty">No series found.</div>
        ) : (
          <div className="cover-grid">
            {series.map((s) => (
              <div className="cover-tile" key={s.id} onClick={() => onOpenSeries(s.id)}>
                {s.cover_url ? (
                  <img className="cover" src={s.cover_url} alt="" />
                ) : (
                  <div className="cover">{s.title.slice(0, 2).toUpperCase()}</div>
                )}
                <h3>{s.title}</h3>
                <div className="tile-meta">
                  <span>{s.publisher || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        ))}

      {mode === "characters" &&
        (characters.length === 0 ? (
          <div className="empty">No characters yet. Be the first to add one.</div>
        ) : (
          <div className="character-grid">
            {characters.map((c) => (
              <div className="character-tile" key={c.id}>
                {c.image_url ? (
                  <img className="avatar" src={c.image_url} alt="" />
                ) : (
                  <div className="avatar">{c.name.slice(0, 2).toUpperCase()}</div>
                )}
                <h3>{c.name}</h3>
              </div>
            ))}
          </div>
        ))}

      {mode === "shows" &&
        (shows.length === 0 ? (
          <div className="empty">No shows yet. Be the first to add one.</div>
        ) : (
          <div className="cover-grid">
            {shows.map((s) => (
              <div className="cover-tile" key={s.id}>
                {s.image_url ? (
                  <img className="cover" src={s.image_url} alt="" />
                ) : (
                  <div className="cover">{s.title.slice(0, 2).toUpperCase()}</div>
                )}
                <h3>{s.title}</h3>
                <div className="tile-meta">
                  <span>{s.network || "—"}</span>
                </div>
              </div>
            ))}
          </div>
        ))}

      {showCreate && mode === "characters" && (
        <CreateCharacterModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />
      )}
      {showCreate && mode === "shows" && (
        <CreateShowModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); reload(); }} />
      )}
    </div>
  );
}

function CreateCharacterModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [seriesQuery, setSeriesQuery] = useState("");
  const [seriesResults, setSeriesResults] = useState<Series[]>([]);
  const [selectedSeries, setSelectedSeries] = useState<Series | null>(null);

  useEffect(() => {
    if (selectedSeries) return;
    const t = setTimeout(async () => setSeriesResults(await searchSeries(seriesQuery)), 200);
    return () => clearTimeout(t);
  }, [seriesQuery, selectedSeries]);

  async function handleSubmit() {
    if (!profile || !name.trim()) return;
    setBusy(true);
    await createCharacter({
      name: name.trim(),
      description: description.trim(),
      image_url: imageUrl.trim() || null,
      series_id: selectedSeries?.id ?? null,
      created_by: profile.id,
    });
    setBusy(false);
    onCreated();
  }

  return (
    <Modal title="Add a character" onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </label>

      <div className="field">
        <span>Series (optional)</span>
        {selectedSeries ? (
          <div className="user-row" style={{ padding: 0 }}>
            <div className="name">{selectedSeries.title}</div>
            <button className="btn-secondary" onClick={() => setSelectedSeries(null)}>
              Change
            </button>
          </div>
        ) : (
          <>
            <input
              value={seriesQuery}
              onChange={(e) => setSeriesQuery(e.target.value)}
              placeholder="Search series to link…"
            />
            {seriesQuery.trim() && seriesResults.length > 0 && (
              <div className="card" style={{ marginTop: 8 }}>
                {seriesResults.slice(0, 6).map((s) => (
                  <div className="user-row" key={s.id} onClick={() => setSelectedSeries(s)}>
                    <div className="name">{s.title}</div>
                    <span className="sub">{s.publisher || "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <label className="field">
        <span>Image URL (optional)</span>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy || !name.trim()} onClick={handleSubmit}>
          Add
        </button>
      </div>
    </Modal>
  );
}

function CreateShowModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [network, setNetwork] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!profile || !title.trim()) return;
    setBusy(true);
    await createShow({
      title: title.trim(),
      network: network.trim(),
      description: description.trim(),
      image_url: imageUrl.trim() || null,
      series_id: null,
      created_by: profile.id,
    });
    setBusy(false);
    onCreated();
  }

  return (
    <Modal title="Add a show" onClose={onClose}>
      <label className="field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span>Network / platform</span>
        <input value={network} onChange={(e) => setNetwork(e.target.value)} placeholder="Netflix, HBO, Disney+…" />
      </label>
      <label className="field">
        <span>Cover image URL (optional)</span>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="modal-actions">
        <button className="btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="btn-primary" disabled={busy || !title.trim()} onClick={handleSubmit}>
          Add
        </button>
      </div>
    </Modal>
  );
}
