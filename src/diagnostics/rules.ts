import type GameEngine from "../game/GameEngine";
import { TILE_SIZE } from "../game/constants";

export interface DiagnosticRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  passes: number;
  failures: number;
  lastFailureMessage?: string;
  evaluate: (engine: GameEngine) => { pass: boolean; message?: string };
}

/**
 * Runtime invariants: states that must never happen, checked every frame in dev builds or with
 * the diagnostics console open (T8). Behavior specs (wave timer paused while frightened,
 * reversals on tile entry, Elroy's target in scatter, the eyes' route home, ...) live in the
 * tests instead (plan T2: `tests/integration/ghostSoak.test.ts` checks the last two every frame).
 */
export function createDefaultDiagnosticRules(): DiagnosticRule[] {
  return [
    {
      id: "RULE_INTEGER_TILE_COLLISION",
      name: "Single-Point Anchor Integer Tile Collision",
      description:
        "Pac-Man and ghosts only collide when sharing the exact same integer tile coordinate",
      enabled: true,
      passes: 0,
      failures: 0,
      evaluate: (engine: GameEngine) => {
        if (engine.pacman.isDying) return { pass: true };
        const pacTile = {
          col: Math.floor(engine.pacman.x / TILE_SIZE),
          row: Math.floor(engine.pacman.y / TILE_SIZE),
        };
        for (const type of Object.keys(engine.ghosts) as Array<keyof typeof engine.ghosts>) {
          const g = engine.ghosts[type];
          if (g.inHouse || g.mode === "EATEN") continue;
          const gTile = {
            col: Math.floor(g.x / TILE_SIZE),
            row: Math.floor(g.y / TILE_SIZE),
          };
          if (
            (g.mode === "CHASE" || g.mode === "SCATTER") &&
            !engine.rules.invincible &&
            !engine.pacman.invincible
          ) {
            if (pacTile.col === gTile.col && pacTile.row === gTile.row) {
              if (!engine.pacman.isDying && engine.playState === "PLAYING") {
                return {
                  pass: false,
                  message: `Pac-Man and ${type} share integer tile (${pacTile.col}, ${pacTile.row}) without collision triggered!`,
                };
              }
            }
          }
        }
        return { pass: true };
      },
    },
    {
      id: "RULE_EATEN_DESCENT_SEAM_ALIGNMENT",
      name: "Eaten Eyes Door Seam Alignment",
      description:
        "Eaten eyes descending through the door must align with the door seam between cols 13 and 14 (x = 14 tiles)",
      enabled: true,
      passes: 0,
      failures: 0,
      evaluate: (engine: GameEngine) => {
        for (const type of Object.keys(engine.ghosts) as Array<keyof typeof engine.ghosts>) {
          const g = engine.ghosts[type];
          if (g.mode === "EATEN" && g.enteringHousePhase === "DESCENDING_DOOR") {
            const seamX = 14 * TILE_SIZE;
            if (Math.abs(g.x - seamX) > 1) {
              return {
                pass: false,
                message: `${type} descending door at x=${g.x.toFixed(1)} instead of seam x=${seamX}!`,
              };
            }
          }
        }
        return { pass: true };
      },
    },
    {
      id: "RULE_PACMAN_EATING_FREEZE",
      name: "Pac-Man Eating Freeze Frames",
      description:
        "Pac-Man eating freeze counter must never exceed authentic arcade limit (3 frames)",
      enabled: true,
      passes: 0,
      failures: 0,
      evaluate: (engine: GameEngine) => {
        const freeze = engine.pacman?.eatingFreezeFrames ?? 0;
        if (freeze > 3 || freeze < 0) {
          return {
            pass: false,
            message: `Pac-Man eatingFreezeFrames (${freeze}) is outside valid arcade range [0, 3]!`,
          };
        }
        return { pass: true };
      },
    },
    {
      id: "RULE_PACMAN_COORDINATE_BOUNDS",
      name: "Pac-Man Stays Within Maze Boundaries",
      description:
        "Pac-Man's coordinates must always stay within valid maze bounds or warp tunnels",
      enabled: true,
      passes: 0,
      failures: 0,
      evaluate: (engine: GameEngine) => {
        const p = engine.pacman;
        const curRow = Math.floor(p.y / TILE_SIZE);
        const inTunnel = engine.maze.tunnels.some((t) => t.y === curRow);
        if (!inTunnel) {
          if (
            p.x < 0 ||
            p.x > engine.maze.width * TILE_SIZE ||
            p.y < 0 ||
            p.y > engine.maze.height * TILE_SIZE
          ) {
            return {
              pass: false,
              message: `Pac-Man coordinates (${p.x.toFixed(1)}, ${p.y.toFixed(1)}) out of maze bounds!`,
            };
          }
        }
        return { pass: true };
      },
    },
  ];
}
