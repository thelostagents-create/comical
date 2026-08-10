import { useEffect, useState } from "react";
import { getCharacterImageOverride } from "../lib/characterImagePrefs";
import {
  fetchCharacterSpotlights,
  fetchRecentCharacters,
  fetchRecentSeries,
  searchCharacters,
  searchSeries,
  type CharacterSpotlight,
} from "../lib/data";
import type { Character, Series } from "../types";
import EditCharacterImageModal from "./EditCharacterImageModal";
import { Icon } from "./Icons";
import Modal from "./Modal";

type Mode = "comics" | "characters";

export default function Discover({ onOpenSeries }: { onOpenSeries: (seriesId: string) => void }) {
  const [mode, setMode] = useState<Mode>("comics");
  const [query, setQuery] = useState("");
  const [series, setSeries] = useState<Series[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);
  const [spotlightCharacter, setSpotlightCharacter] = useState<Character | null>(null);
  const [spotlights, setSpotlights] = useState<CharacterSpotlight[] | null>(null);

  useEffect(() => {
    setQuery("");
  }, [mode]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const trimmed = query.trim();
      if (mode === "comics") setSeries(trimmed ? await searchSeries(query) : await fetchRecentSeries(12));
      else setCharacters(trimmed ? await searchCharacters(query) : await fetchRecentCharacters());
    }, 200);
    return () => clearTimeout(t);
  }, [query, mode]);

  async function openSpotlights(c: Character) {
    setSpotlightCharacter(c);
    setSpotlights(null);
    setSpotlights(await fetchCharacterSpotlights(c.id, 3));
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
      </div>

      {mode === "comics" &&
        (series.length === 0 ? (
          <div className="empty">No series found.</div>
        ) : (
          <div className="cover-grid">
            {!query.trim() && (
              <div className="sub" style={{ gridColumn: "1 / -1", margin: "-4px 0 2px" }}>
                Recently added — search to see the rest of the catalog
              </div>
            )}
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
          <div className="empty">No characters yet.</div>
        ) : (
          <div className="character-grid">
            {!query.trim() && (
              <div className="sub" style={{ gridColumn: "1 / -1", margin: "-4px 0 2px" }}>
                Recently added — search to see the rest of the catalog
              </div>
            )}
            {characters.map((c) => {
              const displayImage = getCharacterImageOverride(c.id) ?? c.image_url;
              return (
                <div className="character-tile" key={c.id} onClick={() => openSpotlights(c)}>
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
                  {c.publisher && <div className="character-meta">{c.publisher}</div>}
                </div>
              );
            })}
          </div>
        ))}

      {editingCharacter && (
        <EditCharacterImageModal
          character={editingCharacter}
          onClose={() => setEditingCharacter(null)}
          onSaved={(imageUrl) => {
            setCharacters((prev) => prev.map((c) => (c.id === editingCharacter.id ? { ...c, image_url: imageUrl } : c)));
            setEditingCharacter(null);
          }}
        />
      )}

      {spotlightCharacter && (
        <Modal title={`${spotlightCharacter.name} — Comic Spotlights`} onClose={() => setSpotlightCharacter(null)}>
          {spotlights === null && <div className="empty">Loading…</div>}
          {spotlights !== null && spotlights.length === 0 && (
            <div className="empty">
              No comics in the catalog are linked to {spotlightCharacter.name} yet — this only
              covers series imported from Comic Vine with real issue data.
            </div>
          )}
          {spotlights?.map(({ series: s, issueCount }) => (
            <div
              className="card series-row"
              key={s.id}
              onClick={() => {
                setSpotlightCharacter(null);
                onOpenSeries(s.id);
              }}
            >
              {s.cover_url ? (
                <img className="cover" src={s.cover_url} alt="" />
              ) : (
                <div className="cover">{s.title.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="meta">
                <h3>{s.title}</h3>
                <div className="sub">
                  {s.publisher || "—"} · {issueCount} {issueCount === 1 ? "issue" : "issues"}
                </div>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  );
}
