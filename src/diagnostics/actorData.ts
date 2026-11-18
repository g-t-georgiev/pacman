import type GameEngine from "../game/GameEngine";
import type { GhostType } from "../types";
import { TILE_SIZE } from "../game/constants";
import type { DiagnosticData } from "./DiagnosticController";

/** One ghost's readout for the diagnostics console (plan M1: this lived in GameEngine). */
function ghostData(engine: GameEngine, type: GhostType) {
  const g = engine.ghosts?.[type];
  const x = g ? g.x : 0;
  const y = g ? g.y : 0;
  return {
    aiMode: g ? g.mode : "SCATTER",
    targetTile: g ? g.target : { col: 0, row: 0 },
    x,
    y,
    tileCol: Math.floor(x / TILE_SIZE),
    tileRow: Math.floor(y / TILE_SIZE),
    dir: g ? g.dir : "NONE",
    speed: g ? g.speed : 0,
    inHouse: g ? g.inHouse : false,
    enteringHousePhase: g?.enteringHousePhase ?? "NONE",
  };
}

/** Every actor and the round, for the diagnostics console and its telemetry. */
export function actorsDiagnostics(engine: GameEngine): DiagnosticData {
  const px = engine.pacman ? engine.pacman.x : 0;
  const py = engine.pacman ? engine.pacman.y : 0;
  return {
    blinky: ghostData(engine, "BLINKY"),
    pinky: ghostData(engine, "PINKY"),
    inky: ghostData(engine, "INKY"),
    clyde: ghostData(engine, "CLYDE"),
    pacman: {
      x: px,
      y: py,
      tileCol: Math.floor(px / TILE_SIZE),
      tileRow: Math.floor(py / TILE_SIZE),
      dir: engine.pacman ? engine.pacman.dir : "NONE",
      speed: engine.pacman ? engine.pacman.speed : 0,
      eatingFreezeFrames: engine.pacman ? engine.pacman.eatingFreezeFrames : 0,
    },
    level: engine.level,
    frame: engine.lifeFrame,
    wave: engine.timerController.currentWave?.mode ?? "CHASE",
    waveTimer: engine.waveTimer,
    frightenedTimer: engine.frightenedGlobalTimer,
    score: engine.score,
    highScore: engine.highScore,
    lives: engine.lives,
  };
}
