import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { SimRandom } from "../../src/core/SimRandom";
import { FRUIT_EXTRA_FRAMES, FRUIT_MIN_FRAMES } from "../../src/game/constants";
import type { Direction, FruitItem } from "../../src/types";

/**
 * Long random games (with deaths, and invincible across several levels): a bonus fruit appears
 * only when the dots eaten this level reach 70 or 170, at most twice per level, and its timer is
 * 9-10 s. Guards against the counter or the fruit being reset or re-triggered by another path.
 */
describe("Bonus fruit in long play", () => {
  it.each([
    [true, 1],
    [false, 3], // reaches 70 dots before dying out
  ])("invincible=%s seed=%i", (invincible, seed) => {
    const engine = new GameEngine("PACMAN", 0);
    const agent = new AgentDriver(engine);
    engine.settings.invincible = invincible;
    agent.scenario({ level: 1, playState: "PLAYING" });
    engine.pacman.invincible = invincible;
    const rng = new SimRandom();
    rng.reset(seed);
    const dirs: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];

    const perLevel = new Map<number, number>();
    let last: FruitItem | null = null;
    let appearances = 0;
    for (let f = 0; f < 50_000 && engine.phase !== "GAME_OVER"; f++) {
      if (f % 23 === 0) agent.input(dirs[rng.nextInt(4)]);
      agent.advance(1);
      const visible = engine.fruit?.active ? engine.fruit : null;
      if (visible && visible !== last) {
        appearances++;
        const where = `level ${engine.level}, tick ${engine.tick}`;
        expect([70, 170], where).toContain(engine.dotsEatenThisRound);
        expect(visible.duration, where).toBeGreaterThanOrEqual(FRUIT_MIN_FRAMES - 1);
        expect(visible.duration, where).toBeLessThan(FRUIT_MIN_FRAMES + FRUIT_EXTRA_FRAMES);
        perLevel.set(engine.level, (perLevel.get(engine.level) ?? 0) + 1);
        expect(perLevel.get(engine.level), where).toBeLessThanOrEqual(2);
      }
      last = visible;
    }
    expect(appearances).toBeGreaterThanOrEqual(1); // the check really ran
  });
});
