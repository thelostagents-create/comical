import { useEffect, useState } from "react";
import { useAuth } from "../auth";
import { fetchLibrary, fetchMyBlurbs, profileStats, searchCharacters, type Blurb } from "../lib/data";
import { getJournalCover, setJournalCover } from "../lib/journalPrefs";
import { timeAgo } from "../lib/format";
import type { Character } from "../types";
import { Icon } from "./Icons";
import ImageField from "./ImageField";
import Modal from "./Modal";
import RatingStars from "./RatingStars";

// A character "belongs" to a series either by explicit link, or by name —
// e.g. a character named "Batman" auto-matches series titled "Batman" or
// "Batman: Year One", so most-read characters works with no hand-linking.
// The same relation also merges different books about the same character
// (e.g. two separate "Batman" books, or "Legion" and "Legion Of X") into a
// single combined entry.
function titleKey(title: string): string {
  return title.trim().toLowerCase().split(/[:\-–—]|\bof\b/i)[0].trim();
}

function titlesRelated(a: string, b: string): boolean {
  const ka = titleKey(a);
  const kb = titleKey(b);
  return ka.length > 0 && ka === kb;
}

// Two same-named heroes from different publishers (e.g. Marvel's and DC's
// takes on a name) should never be blended into one entry. An unset
// publisher on either side is treated as a wildcard — only an explicit
// mismatch blocks the match.
function publishersCompatible(a: string | undefined, b: string | undefined): boolean {
  const pa = (a ?? "").trim().toLowerCase();
  const pb = (b ?? "").trim().toLowerCase();
  return !pa || !pb || pa === pb;
}

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

      const readRows = library.filter((row) => row.readCount > 0);
      const seriesStatsById = new Map(
        readRows.map((row) => [
          row.series_id,
          {
            readCount: row.readCount,
            title: row.series.title,
            coverUrl: row.series.cover_url,
            publisher: row.series.publisher,
          },
        ]),
      );

      const claimedSeriesIds = new Set<string>();
      const allCharacters = await searchCharacters("");
      const catalogChars = allCharacters
        .map((c) => {
          const linked = c.series_id ? seriesStatsById.get(c.series_id) : undefined;
          if (linked && c.series_id) claimedSeriesIds.add(c.series_id);

          let issuesRead = linked ? linked.readCount : 0;
          let seriesTitle = linked ? linked.title : "";
          for (const [seriesId, stat] of seriesStatsById) {
            if (seriesId === c.series_id) continue;
            if (titlesRelated(c.name, stat.title) && publishersCompatible(c.publisher, stat.publisher)) {
              issuesRead += stat.readCount;
              seriesTitle = seriesTitle || stat.title;
              claimedSeriesIds.add(seriesId);
            }
          }
          return { ...c, issuesRead, seriesTitle };
        })
        .filter((c) => c.issuesRead > 0);

      // Any read series with no matching character in the catalog still
      // shows up here, standing in as its own "character" — so this section
      // works with zero setup, no need to add characters by hand. Different
      // books about the same character (e.g. two "Batman" series) merge into
      // one entry instead of showing up separately — unless their publishers
      // differ, e.g. a Marvel and a DC series that happen to share a name.
      const unclaimed = [...seriesStatsById].filter(([seriesId]) => !claimedSeriesIds.has(seriesId));
      const grouped = new Set<string>();
      const impliedChars: (Character & { issuesRead: number; seriesTitle: string })[] = [];
      for (const [seriesId, stat] of unclaimed) {
        if (grouped.has(seriesId)) continue;
        const cluster = [[seriesId, stat] as const];
        grouped.add(seriesId);
        let growing = true;
        while (growing) {
          growing = false;
          for (const [otherId, otherStat] of unclaimed) {
            if (grouped.has(otherId)) continue;
            if (
              cluster.some(
                ([, s]) => titlesRelated(s.title, otherStat.title) && publishersCompatible(s.publisher, otherStat.publisher),
              )
            ) {
              cluster.push([otherId, otherStat]);
              grouped.add(otherId);
              growing = true;
            }
          }
        }
        const repTitle = cluster.reduce((shortest, [, s]) => (s.title.length < shortest.length ? s.title : shortest), cluster[0][1].title);
        const repCover = cluster.find(([, s]) => s.coverUrl)?.[1].coverUrl ?? null;
        const repPublisher = cluster.find(([, s]) => s.publisher)?.[1].publisher ?? "";
        impliedChars.push({
          id: `series:${cluster[0][0]}`,
          name: repTitle,
          description: "",
          image_url: repCover,
          publisher: repPublisher,
          series_id: cluster[0][0],
          created_by: null,
          created_at: "",
          issuesRead: cluster.reduce((sum, [, s]) => sum + s.readCount, 0),
          seriesTitle: repTitle,
        });
      }

      const charsWithStats = [...catalogChars, ...impliedChars]
        .sort((a, b) => b.issuesRead - a.issuesRead)
        .slice(0, 6);
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
