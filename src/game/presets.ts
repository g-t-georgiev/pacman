import type { GameSettings, RuleSettings } from "../types";
import type GameEngine from "./GameEngine";

/**
 * Rules presets (Phase 5). Arcade keeps everything the original does; Modern drops its quirks.
 * Input buffering stays on in both (Decision 5). "Release clears the turn" is a separate,
 * per-player option, not part of either preset.
 */
export type RulesPreset = "ARCADE" | "MODERN";

/** A preset sets one rule (recorded in replays) and the loop's refresh rate (not a rule). */
type PresetSettings = {
  rules: Pick<RuleSettings, "emulateRomQuirks">;
  settings: Pick<GameSettings, "arcadeRefreshRate">;
};

export const RULES_PRESETS: Record<
  RulesPreset,
  { title: string; description: string; settings: PresetSettings }
> = {
  ARCADE: {
    title: "Arcade",
    description: "As the original: Pinky's and Inky's targeting overflow, 60.606 Hz.",
    settings: { rules: { emulateRomQuirks: true }, settings: { arcadeRefreshRate: true } },
  },
  MODERN: {
    title: "Modern",
    description: "Targeting without the overflow quirk, an even 60 Hz to match displays.",
    settings: { rules: { emulateRomQuirks: false }, settings: { arcadeRefreshRate: false } },
  },
};

/** Applies a preset to the engine (the ghost AI reads its rules directly). */
export function applyRulesPreset(engine: GameEngine, preset: RulesPreset): void {
  Object.assign(engine.rules, RULES_PRESETS[preset].settings.rules);
  Object.assign(engine.settings, RULES_PRESETS[preset].settings.settings);
}
