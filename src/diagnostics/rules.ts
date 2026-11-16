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
 * reversals on tile entry, ...) live in the tests instead.
 */
export function createDefaultDiagnosticRules(): DiagnosticRule[] {
  return [
    {
      id: "RULE_BLINKY_ELROY_SCATTER_IMMUNITY",
      name: "Blinky Cruise Elroy Scatter Immunity",
      description: "Cruise Elroy Blinky keeps targeting Pac-Man even during a SCATTER wave",
      enabled: true,
      passes: 0,
      failures: 0,
      evaluate: (engine: GameEngine) => {
        const blinky = engine.ghosts.BLINKY;
        if (blinky.elroyStage > 0 && blinky.location === "ACTIVE" && blinky.mode === "SCATTER") {
          const pac = engine.pacman.tileCoord;
          const t = blinky.target;
          if (!t || t.col !== pac.col || t.row !== pac.row) {
            return {
              pass: false,
              message: `Elroy Blinky targets (${t?.col}, ${t?.row}) in SCATTER instead of Pac-Man with ${engine.dotsRemaining} dots left!`,
            };
          }
        }
        return { pass: true };
      },
    },
    {
      id: "RULE_EATEN_EYES_DOORSTEP_ROUTING",
      name: "Eaten Eyes Front Doorstep Routing",
      description:
        "Eaten eyes outside the ghost house must target the doorway at row 14 and never cross the back wall",
      enabled: true,
      passes: 0,
      failures: 0,
      evaluate: (engine: GameEngine) => {
        for (const type of Object.keys(engine.ghosts) as Array<keyof typeof engine.ghosts>) {
          const g = engine.ghosts[type];
          const t = g.target;
          if (g.mode === "EATEN" && !g.inHouse && t) {
            const gRow = Math.floor(g.y / TILE_SIZE);
            const gCol = Math.floor(g.x / TILE_SIZE);

            // Active dedicated descent phase (approaching seam, descending door, moving to slot)
            if (g.enteringHousePhase && g.enteringHousePhase !== "NONE") {
              continue;
            }

            // Doorway / pen descent corridor (cols 13-14, rows 14-17, or house pen interior):
            // Targeting either the doorstep (row 14) or the ghost's designated pen respawn slot (row 17) is valid.
            const isEnteringHouse =
              ((gCol === 13 || gCol === 14) && gRow >= 14 && gRow <= 17) ||
              (gRow === 17 && gCol >= 10 && gCol <= 17);

            if (isEnteringHouse) {
              const targetsDoorstep = t.row === 14 && (t.col === 13 || t.col === 14);

              // Inside pen at row 17, ghosts navigate to their designated respawn slots:
              // Blinky / Pinky: col 13 or 14
              // Inky: col 11 or 12 (or 13-14 during seam descent)
              // Clyde: col 15 or 16 (or 13-14 during seam descent)
              const targetsPenSlot =
                t.row === 17 &&
                ((type === "INKY" &&
                  (t.col === 11 || t.col === 12 || t.col === 13 || t.col === 14)) ||
                  (type === "CLYDE" &&
                    (t.col === 15 || t.col === 16 || t.col === 13 || t.col === 14)) ||
                  ((type === "BLINKY" || type === "PINKY") && (t.col === 13 || t.col === 14)));

              if (!targetsDoorstep && !targetsPenSlot) {
                return {
                  pass: false,
                  message: `${type} eyes entering house (col ${gCol}, row ${gRow}) targeting (${t.col}, ${t.row}) instead of doorway/pen!`,
                };
              }
              continue;
            }

            // Outside the doorway corridor anywhere in the maze, eaten eyes must target the doorstep (col 13-14, row 14)
            const targetsDoorstep = t.row === 14 && (t.col === 13 || t.col === 14);
            if (!targetsDoorstep) {
              return {
                pass: false,
                message: `${type} eyes in maze (col ${gCol}, row ${gRow}) targeting row ${t.row} instead of doorstep row 14!`,
              };
            }
          }
        }
        return { pass: true };
      },
    },
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
            !engine.settings.invincible &&
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
