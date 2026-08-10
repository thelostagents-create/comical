export type ThemeMode = "dark" | "light";

export const ACCENT_PRESETS = [
  { name: "Blue", hex: "#5b8def" },
  { name: "Cotton Candy", hex: "#ff9ecb" },
  { name: "Cyan", hex: "#4fc3f7" },
  { name: "Coral", hex: "#ff7a59" },
  { name: "Gold", hex: "#f2b134" },
  { name: "Lilac", hex: "#b895e0" },
  { name: "Pink", hex: "#e0518c" },
  { name: "Green", hex: "#6fbf73" },
];

const MODE_KEY = "comical:theme-mode";
const ACCENT_KEY_PREFIX = "comical:accent:";
const DEFAULT_MODE: ThemeMode = "light";

const DEFAULT_ACCENT_BY_MODE: Record<ThemeMode, string> = {
  dark: "#5b8def",
  light: "#ff9ecb",
};

function relativeLuminance(hex: string): number {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function isValidHex(hex: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(hex);
}

export function applyAccent(hex: string) {
  if (!isValidHex(hex)) return;
  document.documentElement.style.setProperty("--accent", hex);
  document.documentElement.style.setProperty(
    "--accent-ink",
    relativeLuminance(hex) > 0.42 ? "#211a1f" : "#fffdfa",
  );
}

export function getThemeMode(): ThemeMode {
  try {
    return (localStorage.getItem(MODE_KEY) as ThemeMode) || DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

export function getStoredAccent(mode: ThemeMode): string {
  try {
    return localStorage.getItem(ACCENT_KEY_PREFIX + mode) || DEFAULT_ACCENT_BY_MODE[mode];
  } catch {
    return DEFAULT_ACCENT_BY_MODE[mode];
  }
}

export function setStoredAccent(hex: string, mode: ThemeMode) {
  try {
    localStorage.setItem(ACCENT_KEY_PREFIX + mode, hex);
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
  applyAccent(hex);
}

export function applyThemeMode(mode: ThemeMode) {
  document.documentElement.dataset.theme = mode;
  applyAccent(getStoredAccent(mode));
}

export function setThemeMode(mode: ThemeMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignore storage failures
  }
  applyThemeMode(mode);
}

export function initTheme() {
  applyThemeMode(getThemeMode());
}
