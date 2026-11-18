import type GameEngine from "../GameEngine";
import { FRUIT_EXTRA_FRAMES, FRUIT_MIN_FRAMES } from "../constants";
import { getFruitDataPerLevel } from "../levelTable";

/** The bonus fruit (plan M1: this lived in GameEngine). It appears after 70 and 170 dots. */
export function checkFruitSpawn(engine: GameEngine): void {
  if (engine.dotsEatenThisLevel === 70 || engine.dotsEatenThisLevel === 170) spawnFruit(engine);
}

/** Puts this level's fruit below the house for 9-10 s (the time from the sim's own stream). */
export function spawnFruit(engine: GameEngine): void {
  const fruitMeta = getFruitDataPerLevel(engine.level);
  engine.fruit = {
    name: fruitMeta.name,
    points: fruitMeta.points,
    col: 13,
    row: 20,
    active: true,
    duration: FRUIT_MIN_FRAMES + engine.simRandom.nextInt(FRUIT_EXTRA_FRAMES),
    color: fruitMeta.color,
    symbol: fruitMeta.symbol,
    bouncing: engine.ruleset.fruitBounces,
    bounceY: 0,
    bounceDir: 1,
  };
}

/** One play frame of the fruit: its time runs out (Ms. Pac-Man's bounces in place). */
export function updateFruit(engine: GameEngine): void {
  const fruit = engine.fruit;
  if (!fruit || !fruit.active) return;
  fruit.duration--;
  if (fruit.bouncing) fruit.bounceY = Math.sin(fruit.duration / 9) * 2;
  if (fruit.duration <= 0) fruit.active = false;
}
