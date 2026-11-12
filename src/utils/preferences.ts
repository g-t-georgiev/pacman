/**
 * Per-player preferences kept in this browser (rules preset, joystick feel). Storage can be
 * missing or blocked (private windows, previews): every read and write is guarded, and the game
 * falls back to its defaults.
 */
export const PREF_PRESET = "pacman.rulesPreset";
export const PREF_RELEASE = "pacman.releaseClearsBuffer";
export const PREF_REDUCED_FLASH = "pacman.reducedFlash";
export const PREF_COLORBLIND = "pacman.colorblindPalette";

export function loadPreference<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

export function savePreference(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: the choice lasts until the page is closed
  }
}
