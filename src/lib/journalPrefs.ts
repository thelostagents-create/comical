const COVER_KEY = "comical:journal-cover";

export function getJournalCover(): string | null {
  try {
    return localStorage.getItem(COVER_KEY);
  } catch {
    return null;
  }
}

export function setJournalCover(url: string | null) {
  try {
    if (url) localStorage.setItem(COVER_KEY, url);
    else localStorage.removeItem(COVER_KEY);
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
}
