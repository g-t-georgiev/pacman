import type { GameSettings } from "../types";
import type GameEngine from "./GameEngine";

/**
 * Rules presets (Phase 5). Arcade keeps everything the original does; Modern drops its quirks.
 * Input buffering stays on in both (Decision 5). "Release clears the turn" is a separate,
 * per-player option, not part of either preset.
 */
export type RulesPreset = "ARCADE" | "MODERN";

type PresetSettings = Pick<GameSettings, "emulateRomQuirks" | "arcadeRefreshRate">;

export const RULES_PRESETS: Record<
  RulesPreset,
  { title: string; description: string; settings: PresetSettings }
> = {
  ARCADE: {
    title: "Arcade",
    description: "As the original: Pinky's and Inky's targeting overflow, 60.606 Hz.",
    settings: { emulateRomQuirks: true, arcadeRefreshRate: true },
  },
  MODERN: {
    title: "Modern",
    description: "Targeting without the overflow quirk, an even 60 Hz to match displays.",
    settings: { emulateRomQuirks: false, arcadeRefreshRate: false },
  },
};

/** Applies a preset to the engine's settings (the ghost AI reads them directly). */
export function applyRulesPreset(engine: GameEngine, preset: RulesPreset): void {
  Object.assign(engine.settings, RULES_PRESETS[preset].settings);
}
