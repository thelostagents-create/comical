// Per-device overrides for how a character's photo looks *to you* — never
// written to the shared catalog, so changing one never affects what other
// users see for that character.
const KEY = "comical:character-image-overrides";

function readAll(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getCharacterImageOverride(characterId: string): string | null {
  return readAll()[characterId] ?? null;
}

export function setCharacterImageOverride(characterId: string, url: string | null) {
  try {
    const all = readAll();
    if (url) all[characterId] = url;
    else delete all[characterId];
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
}
