import type { GameSettings, RuleSettings } from "../types";

/**
 * The defaults for a new engine (plan M1: these lived in GameEngine). Rules change what a tick
 * does and are recorded in replays; settings are everything else (plan P1).
 */
export function defaultRules(): RuleSettings {
  return {
    emulateRomQuirks: true,
    invincible: false,
    turbo: false,
    turboSpeedMultiplier: 1.6,
  };
}

export function defaultSettings(): GameSettings {
  return {
    learnVisualsEnabled: false,
    activeGhostVisuals: {
      BLINKY: true,
      PINKY: true,
      INKY: true,
      CLYDE: true,
    },
    showGrid: false,
    showGhostPaths: false,
    showTargetLines: false,
    gameSpeed: 1.0,
    arcadeRefreshRate: true,
    releaseClearsBuffer: false,
    reducedFlash: false,
    colorblindPalette: false,
    soundEnabled: true,
    crtFilter: false,
    showDiagnosticConsole: false,
    debugOverlay: false,
    debugLayers: {
      grid: true,
      occupiedTiles: true,
      targets: true,
      decisions: true,
      zones: false,
      intersections: false,
      cornerWindow: true,
      readout: false,
      timeline: true,
    },
  };
}
