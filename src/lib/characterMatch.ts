import type { Character } from "../types";
import type { LibraryRow } from "./data";

// A character "belongs" to a series either by explicit link, or by name —
// e.g. a character named "Batman" auto-matches series titled "Batman" or
// "Batman: Year One", so most-read characters works with no hand-linking.
// The same relation also merges different books about the same character
// (e.g. two separate "Batman" books, or "Legion" and "Legion Of X") into a
// single combined entry.
export function titleKey(title: string): string {
  return title.trim().toLowerCase().split(/[:\-–—]|\bof\b/i)[0].trim();
}

export function titlesRelated(a: string, b: string): boolean {
  const ka = titleKey(a);
  const kb = titleKey(b);
  return ka.length > 0 && ka === kb;
}

// Two same-named heroes from different publishers (e.g. Marvel's and DC's
// takes on a name) should never be blended into one entry. An unset
// publisher on either side is treated as a wildcard — only an explicit
// mismatch blocks the match.
export function publishersCompatible(a: string | undefined, b: string | undefined): boolean {
  const pa = (a ?? "").trim().toLowerCase();
  const pb = (b ?? "").trim().toLowerCase();
  return !pa || !pb || pa === pb;
}

// Every library row (comic run) that counts as "this character appears
// here" — either the series the character is explicitly linked to, or any
// other series whose title relates by name and whose publisher isn't a
// mismatch.
export function matchingLibraryRows(character: Character, library: LibraryRow[]): LibraryRow[] {
  return library.filter((row) => {
    if (character.series_id && row.series_id === character.series_id) return true;
    return titlesRelated(character.name, row.series.title) && publishersCompatible(character.publisher, row.series.publisher);
  });
}
