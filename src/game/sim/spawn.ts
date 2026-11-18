import type GameEngine from "../GameEngine";
import type { GhostType } from "../../types";
import { Pacman } from "../../core/Pacman";
import { Ghost } from "../../core/Ghost";
import { getSpeedConfigForLevel } from "../levelTable";
import { seamPx } from "../mazes";

/**
 * New actors on their spawn points for a level start or a new life (plan M1: this lived in
 * GameEngine). A fruit on screen disappears and does not come back (the arcade counts it as used).
 */
export function spawnActors(engine: GameEngine): void {
  if (engine.fruit) {
    engine.fruit.active = false;
    engine.fruit = null;
  }

  const speeds = getSpeedConfigForLevel(engine.level);
  const maze = engine.maze;

  // Every actor starts on the seam between its two spawn tiles (F9)
  const pac = seamPx(maze.pacmanSpawn.candidates);
  engine.pacman = new Pacman(pac.x, pac.y, maze.pacmanSpawn.dir);
  engine.pacman.speed = speeds.pacmanNormal;
  engine.pacman.invincible = engine.rules.invincible;

  const spawn = (type: GhostType) => {
    const s = maze.ghostSpawns[type];
    const at = seamPx(s.candidates);
    return new Ghost(type, at.x, at.y, s.initialDir, s.inHouse);
  };
  engine.ghosts = {
    BLINKY: spawn("BLINKY"),
    PINKY: spawn("PINKY"),
    INKY: spawn("INKY"),
    CLYDE: spawn("CLYDE"),
  };

  const wave = engine.timerController.currentWave?.mode ?? "CHASE";
  (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
    const g = engine.ghosts[type];
    g.wave = wave;
    g.target = maze.scatterTargets[type];
    g.speed = speeds.ghostNormal;
  });
}
