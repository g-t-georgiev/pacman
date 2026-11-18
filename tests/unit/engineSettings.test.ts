import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import GameEvents from "../../src/core/EventBus";
import { setSetting } from "../../src/hooks/useEngineSettings";

describe("Panels and engine settings (O2)", () => {
  it("setSetting writes the engine's setting and tells the panels", () => {
    const engine = new GameEngine("PACMAN", 0);
    let heard = 0;
    const listener = () => heard++;
    GameEvents.on("SETTINGS_CHANGED", listener);
    try {
      setSetting(engine, "showGrid", true);
      expect(engine.settings.showGrid).toBe(true);
      expect(heard).toBe(1);
    } finally {
      GameEvents.off("SETTINGS_CHANGED", listener);
    }
  });
});
