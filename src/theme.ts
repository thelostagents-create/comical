export const ACCENT_PRESETS = [
  { name: "Coral", hex: "#ff7a59" },
  { name: "Gold", hex: "#f2b134" },
  { name: "Teal", hex: "#45b0a6" },
  { name: "Blue", hex: "#5b8def" },
  { name: "Pink", hex: "#e0518c" },
  { name: "Green", hex: "#6fbf73" },
];

const STORAGE_KEY = "comical:accent";
const DEFAULT_ACCENT = ACCENT_PRESETS[0].hex;

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
    relativeLuminance(hex) > 0.42 ? "#18151c" : "#faf6f2",
  );
}

export function getStoredAccent(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function setStoredAccent(hex: string) {
  try {
    localStorage.setItem(STORAGE_KEY, hex);
  } catch {
    // ignore storage failures (private browsing, etc.)
  }
  applyAccent(hex);
}

export function initTheme() {
  applyAccent(getStoredAccent());
}
