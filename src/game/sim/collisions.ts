import type GameEngine from "../GameEngine";
import type { GhostType } from "../../types";
import { TILE_SIZE } from "../constants";
import { getFrightenedDuration } from "../levelTable";
import { checkFruitSpawn } from "./fruit";

/**
 * What Pac-Man runs into each play frame (plan M1: this lived in GameEngine): dots and
 * energizers, the ghosts (eat or be caught), and the fruit; and the level clear.
 */
export function checkCollisions(engine: GameEngine): void {
  const halfTile = TILE_SIZE / 2;
  const pacCol = Math.floor(engine.pacman.x / TILE_SIZE);
  const pacRow = Math.floor(engine.pacman.y / TILE_SIZE);

  // 1. Dots and energizers
  if (pacRow >= 0 && pacRow < engine.maze.height && pacCol >= 0 && pacCol < engine.maze.width) {
    const tile = engine.maze.tiles[pacRow][pacCol];

    if (tile === "DOT") {
      engine.maze.tiles[pacRow][pacCol] = "EMPTY";
      engine.addScore(10);
      engine.dotsRemaining--;
      engine.dotsEatenThisLevel++;
      engine.pacman.eatingFreezeFrames = 1; // Pac-Man stops 1 frame per dot
      engine.houseController.onDotEaten(engine.ghosts);
      engine.emit({ type: "DOT_EATEN" });
      checkFruitSpawn(engine);
      checkLevelClear(engine);
    } else if (tile === "ENERGIZER") {
      engine.maze.tiles[pacRow][pacCol] = "EMPTY";
      engine.addScore(50);
      engine.dotsRemaining--;
      engine.dotsEatenThisLevel++;
      engine.pacman.eatingFreezeFrames = 3; // and 3 per energizer
      engine.houseController.onDotEaten(engine.ghosts);
      engine.eatenGhostsInEnergizer = 0;
      triggerFrightenedMode(engine);
      checkFruitSpawn(engine);
      checkLevelClear(engine);
      engine.emit({ type: "ENERGIZER_EATEN", level: engine.level });
    }
  }

  // 2. Ghosts (same tile). A cleared level ends the frame first. Only one ghost is eaten per
  // frame: the pause starts, and a second ghost on the tile is caught after it.
  const pacTile = engine.pacman.tileCoord;

  for (const g of Object.values(engine.ghosts)) {
    if (engine.sequencer.phase !== "PLAYING") break;
    if (g.location !== "ACTIVE") continue;

    const ghostTile = g.tileCoord;
    if (pacTile.col !== ghostTile.col || pacTile.row !== ghostTile.row) continue;

    if (g.frightened) {
      g.location = "EYES";
      g.frightened = false;
      g.reversalPrimed = false; // being eaten neither reverses nor keeps a latched reversal
      g.lastDecisionTile = undefined; // re-plan towards the house at once
      g.target = engine.ghostAiController.calculateTarget(
        g,
        engine.pacman,
        engine.ghosts.BLINKY,
        engine.maze
      );
      engine.eatenGhostsInEnergizer++;
      const points = 200 * Math.pow(2, Math.min(3, engine.eatenGhostsInEnergizer - 1));
      engine.addScore(points);
      // The action stops while the score is shown where the ghost was (F20).
      engine.enterPhase("GHOST_EATEN_PAUSE");
      engine.sequencer.state.eatenGhost = g.type;
      engine.sequencer.state.eatenPoints = points;
      engine.emit({ type: "GHOST_EATEN", ghost: g.type, points });
    } else if (!engine.rules.invincible && !engine.pacman.invincible) {
      // Everything freezes with the ghosts visible, then the death animation starts (F21). A
      // fruit on the board stays, its time running, until the death is over (GameEngine).
      engine.enterPhase("DEATH_FREEZE");
    }
  }

  // 3. The fruit (Pac-Man's center on one of its tiles)
  if (engine.fruit && engine.fruit.active) {
    const fruitRow = engine.fruit.row;
    const fruitCol = engine.fruit.col;
    const isFruitTile =
      pacTile.row === fruitRow &&
      (pacTile.col === fruitCol || pacTile.col === 13 || pacTile.col === 14);

    if (isFruitTile) {
      engine.addScore(engine.fruit.points);
      engine.fruit.active = false;
      const x = fruitCol * TILE_SIZE + halfTile;
      const y = fruitRow * TILE_SIZE + halfTile;
      engine.emit({ type: "FRUIT_EATEN", points: engine.fruit.points, x, y });
    }
  }
}

/** An energizer: every ghost latches a reversal and (unless the level has none) turns blue. */
export function triggerFrightenedMode(engine: GameEngine): void {
  const duration = getFrightenedDuration(engine.level);
  engine.timerController.triggerFrightened(duration);

  (Object.keys(engine.ghosts) as GhostType[]).forEach((type) => {
    const g = engine.ghosts[type];
    // Eyes on their way home are immune. Every other ghost, inside the house too, latches a
    // reversal and (unless this level has no frightened time) turns blue.
    if (g.isEyes) return;
    g.primeReversal();
    if (duration <= 0) return;
    g.frightened = true;
  });
}

function checkLevelClear(engine: GameEngine): void {
  if (engine.dotsRemaining <= 0) {
    engine.fruit = null;
    engine.enterPhase("LEVEL_CLEAR_FREEZE");
    engine.emit({ type: "LEVEL_CLEARED", level: engine.level });
  }
}
