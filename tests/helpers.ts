import GameEngine from "../src/game/GameEngine";
import { AgentDriver } from "../src/agent/AgentDriver";
import { SimRandom } from "../src/core/SimRandom";
import type { Direction, GameMode } from "../src/types";

/**
 * Shared test setup (plan O5; the regression suite uses it first, the older suites move to it
 * during the clean-up).
 */

/** A game in play on `level` (READY skipped), events drained. */
export function playing(level = 1, mode: GameMode = "PACMAN"): AgentDriver {
  const agent = new AgentDriver(new GameEngine(mode, 0));
  agent.scenario({ level, playState: "PLAYING" });
  agent.events();
  return agent;
}

/** Puts Pac-Man one tile left of Blinky, facing him: they meet on the next frame. */
export function faceBlinky(agent: AgentDriver): void {
  const b = agent.view().ghosts.BLINKY;
  agent.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } });
}

/** Seeded random joystick input every `every` ticks, the same on every run. */
export function randomInput(seed: number, every: number): (tick: number) => Direction | null {
  const rng = new SimRandom();
  rng.reset(seed);
  const dirs: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  return (tick) => (tick % every === 0 ? dirs[rng.nextInt(4)] : null);
}

/** Runs `frames` frames with `input`, returning the state hash after every frame. */
export function playHashes(
  agent: AgentDriver,
  frames: number,
  input: (tick: number) => Direction | null
): number[] {
  const e = agent.engine;
  const out: number[] = [];
  for (let i = 0; i < frames; i++) {
    const dir = input(e.tick + 1);
    if (dir) e.setInputDirection(dir);
    e.update();
    out.push(agent.hash());
  }
  return out;
}
