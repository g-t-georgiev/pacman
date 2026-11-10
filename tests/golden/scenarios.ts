import GameEngine from "../../src/game/GameEngine";
import { SimRandom } from "../../src/core/SimRandom";
import { type Replay, recordReplay } from "../../src/game/replay";
import type { Direction } from "../../src/types";

/**
 * Golden replay scenarios (plan T5). Each one is recorded into `tests/golden/<name>.json` by
 * `vpx ./scripts/update-golden.ts` and replayed by `goldenReplays.test.ts`, which fails at the
 * first second whose state hash differs. Re-record after an intentional mechanics change.
 */
export interface GoldenScenario {
  name: string;
  description: string;
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
  engine.settings.invincible = invincible;
  engine.pacman.invincible = invincible;
  return engine;
}

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    name: "l1-random-play",
    description: "Level 1 from READY, random input: dots, energizers, deaths, game over.",
    record: () => recordReplay(newGame(1, false), 4800, randomInput(1, 30)),
  },
  {
    name: "l5-invincible",
    description: "Level 5, invincible: long chases, frightened periods, eaten ghosts, Elroy.",
    record: () => recordReplay(newGame(5, true), 6000, randomInput(5, 24)),
  },
];
