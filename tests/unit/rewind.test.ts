import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { SimRandom } from "../../src/core/SimRandom";
import { KEYFRAME_TICKS, MAX_KEYFRAMES } from "../../src/game/replay";
import type { Direction } from "../../src/types";

/**
 * Plays `frames` frames with random input. With `withHashes`, returns each frame's tick and
 * state hash (hashing every frame is the slow part, so only the test that compares asks for it).
 */
function playRecording(
  agent: AgentDriver,
  frames: number,
  withHashes = false
): Map<number, number> {
  const rng = new SimRandom();
  rng.reset(11);
  const dirs: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  const hashes = new Map<number, number>();
  for (let f = 0; f < frames; f++) {
    if (f % 17 === 0) agent.input(dirs[rng.nextInt(4)]);
    agent.advance(1);
    if (withHashes) hashes.set(agent.engine.tick, agent.hash());
  }
  return hashes;
}

function playing(): AgentDriver {
  const agent = new AgentDriver(new GameEngine("PACMAN", 0));
  agent.engine.settings.invincible = true;
  agent.scenario({ level: 2, playState: "PLAYING" });
  agent.engine.pacman.invincible = true;
  agent.scenario({});
  return agent;
}

describe("Rewind from keyframes plus re-simulation (T7)", () => {
  it("every scrubbed frame is exactly the frame that was played", () => {
    const agent = playing();
    const e = agent.engine;
    const hashes = playRecording(agent, 900, true);
    const oldest = e.tick - e.getRewindBufferLength() + 1;

    for (const back of [1, 59, 60, 61, 333, 899]) {
      const tick = e.replayLog.headTick - back;
      e.scrubToFrame(tick - oldest);
      expect(e.tick).toBe(tick);
      expect(agent.hash(), `${back} frames back`).toBe(hashes.get(tick));
    }

    // ...and forward again, all the way to the live frame
    e.scrubToFrame(e.getRewindBufferLength() - 1);
    expect(agent.hash()).toBe(hashes.get(e.replayLog.headTick));
  });

  it("the sim holds while scrubbing, and plays on from the scrubbed frame", () => {
    const agent = playing();
    const e = agent.engine;
    playRecording(agent, 600);
    e.rewindSeconds(3);
    const scrubbed = e.tick;
    agent.step(20);
    expect(e.tick).toBe(scrubbed); // held

    e.resumeFromScrub();
    agent.step(20);
    expect(e.tick).toBe(scrubbed + 20);
    // The recording continues from there and still replays exactly
    expect(agent.verifyReplay(agent.saveReplay()).matched).toBe(true);
  });

  it("rewindSeconds steps back from the frame shown now", () => {
    const agent = playing();
    const e = agent.engine;
    playRecording(agent, 600);
    const head = e.tick;
    e.rewindSeconds(2);
    e.rewindSeconds(2);
    expect(e.tick).toBe(head - 240);
  });

  it("re-simulated frames send no events (no sounds while scrubbing)", () => {
    const agent = playing();
    const e = agent.engine;
    playRecording(agent, 600);
    agent.events();
    e.rewindSeconds(5);
    // Only the rewind itself is announced, so the UI can follow (e.g. leave a game over)
    expect(e.drainEvents()).toEqual([{ type: "REWOUND", playState: "PLAYING" }]);
  });

  it("rewinding out of a game over brings the round back", () => {
    const agent = new AgentDriver(new GameEngine("PACMAN", 0));
    agent.scenario({ level: 1, playState: "PLAYING" });
    const e = agent.engine;
    e.lives = 1;
    agent.scenario({}); // record from here
    agent.advance(200);
    const b = agent.view().ghosts.BLINKY;
    agent.scenario({ pacman: { col: b.col - 1, row: b.row, dir: "RIGHT" } });
    agent.runUntil((v) => v.playState === "GAME_OVER", 600);
    expect(e.playState).toBe("GAME_OVER");

    agent.events();
    e.rewindSeconds(6);
    const rewound = e.drainEvents().find((ev) => ev.type === "REWOUND");
    expect(rewound).toEqual({ type: "REWOUND", playState: "PLAYING" });
    e.resumeFromScrub();
    agent.advance(1);
    expect(e.lives).toBe(1);
    expect(e.phase).toBe("PLAYING");
  });

  it("reaches back about two minutes", () => {
    const agent = playing();
    playRecording(agent, 3 * 60 * 60);
    const reach = agent.engine.getRewindBufferLength();
    expect(reach).toBeGreaterThan((MAX_KEYFRAMES - 1) * KEYFRAME_TICKS);
    expect(reach).toBeLessThanOrEqual(MAX_KEYFRAMES * KEYFRAME_TICKS + 1);
  });
});
