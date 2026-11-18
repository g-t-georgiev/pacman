import type GameEngine from "../GameEngine";
import type { Ghost } from "../../core/Ghost";
import type { LevelSpeedConfig } from "../../types";
import { getElroyStage } from "../../controllers/GhostAiController";

/** Turbo (practice) multiplies every step; 1 without it. */
function turboOf(engine: GameEngine): number {
  return engine.rules.turbo ? engine.rules.turboSpeedMultiplier : 1.0;
}

/** One frame of Pac-Man's movement (plan M1: this lived in GameEngine). */
export function movePacman(engine: GameEngine, speeds: LevelSpeedConfig): void {
  const pacman = engine.pacman;
  const frightened = engine.frightenedGlobalTimer > 0;
  const pct = pacman.getSpeedPercentage(engine.level, frightened, speeds);
  const { x, y } = pacman;
  engine.movementController.updatePacmanMovement(
    pacman,
    engine.lifeFrame,
    pct,
    turboOf(engine),
    engine.maze
  );
  if (pacman.x !== x || pacman.y !== y) pacman.hasMoved = true;
}

/**
 * One frame of the ghosts: releases from the house, Blinky's Elroy stage, then every ghost
 * moves (in the house, or targeting and moving outside it).
 */
export function moveGhosts(engine: GameEngine, speeds: LevelSpeedConfig): void {
  engine.houseController.update(engine.ghosts, engine.level);
  engine.ghosts.BLINKY.elroyStage = getElroyStage(
    engine.level,
    engine.dotsRemaining,
    engine.houseController.state.elroySuspended
  );

  for (const g of Object.values(engine.ghosts)) {
    if (g.inHouse) {
      const pct = g.getSpeedPercentage(engine.maze, speeds);
      engine.movementController.updateHouseGhost(g, engine.lifeFrame, pct, turboOf(engine));
    } else {
      moveActiveGhost(engine, g, speeds);
    }
  }
}

/** Targeting and movement for a ghost outside the house (eyes included). */
export function moveActiveGhost(engine: GameEngine, g: Ghost, speeds: LevelSpeedConfig): void {
  const blinky = engine.ghosts.BLINKY;
  g.target = engine.ghostAiController.calculateTarget(g, engine.pacman, blinky, engine.maze);
  engine.movementController.updateGhostMovement(g, {
    blinky,
    pacman: engine.pacman,
    lifeFrame: engine.lifeFrame,
    speedPct: g.getSpeedPercentage(engine.maze, speeds),
    turboMultiplier: turboOf(engine),
    maze: engine.maze,
    ghostAi: engine.ghostAiController,
  });
}
