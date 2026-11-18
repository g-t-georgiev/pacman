import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";
import GameEvents, { EventBus } from "../../src/core/EventBus";
import { SoundEngine } from "../../src/audio/SoundEngine";

describe("A runner's own event bus and sound engine (M5)", () => {
  it("a runner given its own bus emits there, never on the app's", () => {
    const engine = new GameEngine("PACMAN", 0);
    const events = new EventBus();
    const sound = new SoundEngine();
    const runner = new GameRunner(engine, { events, sound });
    expect(runner.events).toBe(events);
    expect(runner.sound).toBe(sound);

    let own = 0;
    let app = 0;
    const onOwn = () => own++;
    const onApp = () => app++;
    events.on("SCORE_CHANGED", onOwn);
    GameEvents.on("SCORE_CHANGED", onApp);
    try {
      engine.drainEvents(); // the new game queued its own score event
      runner.syncUi(); // emits the score, lives, level and play state
      expect(own).toBe(1);
      expect(app).toBe(0);
    } finally {
      events.off("SCORE_CHANGED", onOwn);
      GameEvents.off("SCORE_CHANGED", onApp);
    }
  });

  it("without options it uses the app's instances (what the UI listens to)", () => {
    const runner = new GameRunner(new GameEngine("PACMAN", 0));
    expect(runner.events).toBe(GameEvents);
  });
});
