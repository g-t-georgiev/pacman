import GameEngine from "../../src/game/GameEngine";
import { SimRandom } from "../../src/core/SimRandom";
import { type Replay, recordReplay } from "../../src/game/replay";
import type { Direction, GameMode } from "../../src/types";
import { AgentDriver } from "../../src/agent/AgentDriver";

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

/**
 * Level 2, energizer just eaten, four blue ghosts coming down Pac-Man's corridor: he eats two
 * (the eat pause, score chain and eyes going home), then random play to game over.
 */
function eatGhosts(mode: GameMode): Replay {
  const agent = new AgentDriver(new GameEngine(mode, 0));
  agent.scenario({
    level: 2,
    playState: "PLAYING",
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

export const GOLDEN_SCENARIOS: GoldenScenario[] = [
  {
    name: "l1-random-play",
    description: "Level 1 from READY, random input: dots, energizers, deaths, game over.",
    record: () => recordReplay(newGame(1, false), 4800, randomInput(1, 30)),
  },
  {
    name: "l5-invincible",
    description:
      "Level 5, invincible (no collisions at all): long chases, frightened periods, Elroy.",
    record: () => recordReplay(newGame(5, true), 6000, randomInput(5, 24)),
  },
  {
    name: "l2-eat-ghosts",
    description:
      "Level 2: two blue ghosts eaten (eat pause, score chain, eyes home), deaths, game over.",
    record: () => eatGhosts("PACMAN"),
  },
  {
    name: "ms-l2-eat-ghosts",
    description: "Ms. Pac-Man's maze and tunnels, the same setup: ghosts eaten, deaths, game over.",
    record: () => eatGhosts("MS_PACMAN"),
  },
];
