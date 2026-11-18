import GameEngine from "../../src/game/GameEngine";
import { type Replay, playReplay } from "../../src/game/replay";

/**
 * What a golden replay exercises, observed by playing it (T1). Each scenario lists what it
 * covers, and the golden test checks the list against this, so a golden can't silently stop
 * covering its subject (as `l5-invincible` claimed eaten ghosts that never happened).
 */
export type Coverage =
  | "PACMAN_DIED"
  | "GAME_OVER"
  | "ENERGIZER_EATEN"
  | "FRIGHTENED"
  | "ENERGIZER_NO_BLUE"
  | "GHOST_EATEN"
  | "FRUIT_EATEN"
  | "LEVEL_CLEARED"
  | "ELROY_2"
  | "ELROY_RESUMED"
  | "MS_PACMAN";

export function coverageOf(replay: Replay): Set<Coverage> {
  const engine = new GameEngine(replay.start.mode, 0);
  const seen = new Set<Coverage>();
  let wasSuspended = false;
  playReplay(engine, replay, () => {
    for (const event of engine.drainEvents()) {
      if (event.type === "PACMAN_DIED") seen.add("PACMAN_DIED");
      if (event.type === "GAME_OVER") seen.add("GAME_OVER");
      if (event.type === "ENERGIZER_EATEN") seen.add("ENERGIZER_EATEN");
      if (event.type === "GHOST_EATEN") seen.add("GHOST_EATEN");
      if (event.type === "FRUIT_EATEN") seen.add("FRUIT_EATEN");
      if (event.type === "LEVEL_CLEARED") seen.add("LEVEL_CLEARED");
    }
    if (Object.values(engine.ghosts).some((g) => g.mode === "FRIGHTENED")) seen.add("FRIGHTENED");
    if (engine.ghosts.BLINKY.elroyStage === 2) seen.add("ELROY_2");
    const suspended = engine.houseController.state.elroySuspended;
    if (suspended) wasSuspended = true;
    else if (wasSuspended) seen.add("ELROY_RESUMED");
  });
  if (seen.has("ENERGIZER_EATEN") && !seen.has("FRIGHTENED")) seen.add("ENERGIZER_NO_BLUE");
  if (replay.start.mode === "MS_PACMAN") seen.add("MS_PACMAN");
  return seen;
}
