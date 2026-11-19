import GameEngine from "../../src/game/GameEngine";
import { SimRandom } from "../../src/core/SimRandom";
import { type Replay, recordReplay } from "../../src/game/replay";
import type { Direction, GameMode } from "../../src/types";
import { getElroyDotThresholds } from "../../src/game/levelTable";
import type { Coverage } from "./coverage";
import { playing } from "../helpers";

/**
 * Golden replay scenarios (plan T5, coverage T1). Each one is recorded into
 * `tests/golden/<name>.json` by `vp run golden:update` and replayed by `goldenReplays.test.ts`,
 * which fails at the first second whose state hash differs. `covers` lists what the recording
 * exercises; the golden test checks it by playing the replay (`coverage.ts`).
 *
 * Most start from a set-up moment (a replay records whatever state it starts from), then play
 * on with seeded random input, so each one reliably reaches its subject.
 */
export interface GoldenScenario {
  name: string;
  description: string;
  covers: Coverage[];
  record: () => Replay;
}

/** Random joystick input every `every` ticks, the same on every run. */
function randomInput(seed: number, every: number): (tick: number) => Direction | null {
  const rng = new SimRandom();
  rng.reset(seed);
  const dirs: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  return (tick) => (tick % every === 0 ? dirs[rng.nextInt(4)] : null);
}

function newGame(level: number, invincible: boolean): GameEngine {
  const engine = new GameEngine("PACMAN", 0);
  engine.initGame("PACMAN", level);
  engine.rules.invincible = invincible;
  engine.pacman.invincible = invincible;
  return engine;
}

/**
 * Level 2, energizer just eaten, four blue ghosts coming down Pac-Man's corridor: he eats two
 * (the eat pause, score chain and eyes going home), then random play to game over.
 */
function eatGhosts(mode: GameMode): Replay {
  const agent = playing(2, mode);
  agent.scenario({
    frightened: true,
    pacman: { col: 12, row: 8, dir: "LEFT" },
    ghosts: {
      BLINKY: { col: 9, row: 8, dir: "RIGHT" },
      PINKY: { col: 7, row: 8, dir: "RIGHT" },
      INKY: { col: 5, row: 8, dir: "RIGHT", location: "ACTIVE" },
      CLYDE: { col: 3, row: 8, dir: "RIGHT", location: "ACTIVE" },
    },
  });
  const later = randomInput(9, 20);
  return recordReplay(agent.engine, 4800, (tick) => (tick <= 60 ? null : later(tick)));
}

/** Level 17: Pac-Man walks up into the top-left energizer; it only reverses the ghosts. */
function energizerNoBlue(): Replay {
  const agent = playing(17);
  agent.scenario({ pacman: { col: 1, row: 7, dir: "UP" } }); // the energizer is at (1, 6)
  const later = randomInput(17, 22);
  return recordReplay(agent.engine, 3600, (tick) => (tick < 30 ? "UP" : later(tick)));
}

/** Level 3: a fruit on screen and Pac-Man on its row, heading for it. */
function fruitEaten(): Replay {
  const agent = playing(3);
  agent.scenario({ pacman: { col: 10, row: 20, dir: "RIGHT" } });
  agent.engine.spawnFruit();
  const later = randomInput(3, 24);
  return recordReplay(agent.engine, 3600, (tick) => (tick < 60 ? null : later(tick)));
}

/** Level 1 with one dot left, Pac-Man on it: the clear, the maze flash, then level 2. */
function levelClear(): Replay {
  const agent = playing(1);
  agent.scenario({ dotsRemaining: 1 });
  const e = agent.engine;
  let last = { col: 0, row: 0 };
  e.maze.tiles.forEach((row, r) =>
    row.forEach((t, c) => {
      if (t === "DOT" || t === "ENERGIZER") last = { col: c, row: r };
    })
  );
  agent.scenario({ pacman: last });
  return recordReplay(e, 3600, randomInput(2, 28));
}

/** Level 5 with Elroy 2 already on and collisions on: deaths suspend him, Clyde frees him. */
function elroyChase(): Replay {
  const agent = playing(5);
  agent.scenario({ dotsRemaining: getElroyDotThresholds(5).elroy2 + 3 });
  // The seed is one whose play reaches Elroy resuming (Clyde out after a death); a change to the
  // round's timing can take that away, and the golden test then says so (seed 5 until rules 4)
  return recordReplay(agent.engine, 4800, randomInput(3, 18));
}

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    name: "l1-random-play",
    description: "Level 1 from READY, random input: dots, deaths, game over.",
    covers: ["PACMAN_DIED", "GAME_OVER"],
    record: () => recordReplay(newGame(1, false), 4800, randomInput(1, 30)),
  },
  {
    name: "l5-invincible",
    description: "Level 5, invincible (no collisions at all): long chases and frightened periods.",
    covers: ["ENERGIZER_EATEN", "FRIGHTENED"],
    record: () => recordReplay(newGame(5, true), 6000, randomInput(5, 24)),
  },
  {
    name: "l2-eat-ghosts",
    description:
      "Level 2: two blue ghosts eaten (eat pause, score chain, eyes home), deaths, game over.",
    covers: ["GHOST_EATEN", "FRIGHTENED", "PACMAN_DIED", "GAME_OVER"],
    record: () => eatGhosts("PACMAN"),
  },
  {
    name: "ms-l2-eat-ghosts",
    description: "Ms. Pac-Man's maze and tunnels, the same setup: ghosts eaten, deaths, game over.",
    covers: ["MS_PACMAN", "GHOST_EATEN", "FRIGHTENED", "PACMAN_DIED", "GAME_OVER"],
    record: () => eatGhosts("MS_PACMAN"),
  },
  {
    name: "l17-energizer-no-blue",
    description: "Level 17: energizers only reverse the ghosts (no frightened time), game over.",
    covers: ["ENERGIZER_NO_BLUE", "PACMAN_DIED", "GAME_OVER"],
    record: energizerNoBlue,
  },
  {
    name: "l21-random-play",
    description: "Level 21: Pac-Man 90%, ghosts 95% (they gain on him), deaths, game over.",
    covers: ["PACMAN_DIED", "GAME_OVER"],
    record: () => recordReplay(newGame(21, false), 4800, randomInput(21, 26)),
  },
  {
    name: "l3-fruit-eaten",
    description: "Level 3: the bonus fruit eaten (points, popup), then random play to game over.",
    covers: ["FRUIT_EATEN", "PACMAN_DIED", "GAME_OVER"],
    record: fruitEaten,
  },
  {
    name: "l1-clear-to-l2",
    description: "Level 1's last dot: the clear and maze flash, then level 2 from READY.",
    covers: ["LEVEL_CLEARED", "PACMAN_DIED", "GAME_OVER"],
    record: levelClear,
  },
  {
    name: "l5-elroy-collisions",
    description: "Level 5, Elroy 2 with collisions on: deaths suspend him until Clyde leaves.",
    covers: ["ELROY_2", "ELROY_RESUMED", "PACMAN_DIED", "GAME_OVER"],
    record: elroyChase,
  },
];
