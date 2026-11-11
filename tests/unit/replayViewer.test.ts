import { describe, expect, it } from "vite-plus/test";
import GameEngine from "../../src/game/GameEngine";
import { GameRunner } from "../../src/game/GameRunner";
import { AgentDriver } from "../../src/agent/AgentDriver";
import { SimRandom } from "../../src/core/SimRandom";
import { hashGameState } from "../../src/game/gameState";
import {
  decodeReplay,
  encodeReplay,
  replayCodeFromHash,
  replayLink,
} from "../../src/game/replayShare";
import type { Direction } from "../../src/types";

/** A live game with a runner, played for `frames` with random input, invincible. */
function played(frames: number) {
  const engine = new GameEngine("PACMAN", 0);
  const runner = new GameRunner(engine);
  const agent = new AgentDriver(engine, runner);
  engine.settings.invincible = true;
  agent.scenario({ level: 2, playState: "PLAYING" });
  engine.pacman.invincible = true;
  agent.scenario({});
  const rng = new SimRandom();
  rng.reset(3);
  const dirs: Direction[] = ["UP", "DOWN", "LEFT", "RIGHT"];
  for (let f = 0; f < frames; f++) {
    if (f % 25 === 0) agent.input(dirs[rng.nextInt(4)]);
    runner.tick();
  }
  return { engine, runner, agent };
}

describe("Replay viewer (T12)", () => {
  it("plays a clip in real-time ticks, exactly as recorded, then holds at its end", () => {
    const { engine, runner, agent } = played(900);
    const replay = agent.saveReplay(10);
    const endHash = replay.checkpoints.at(-1)![1];

    runner.viewer.start(replay);
    expect(engine.watchingReplay).toBe(true);
    expect(engine.tick).toBe(replay.start.tick);
    for (let i = 0; i < replay.endTick - replay.start.tick + 30; i++) runner.tick();

    expect(engine.tick).toBe(replay.endTick); // held at the end
    expect(hashGameState(engine.getState())).toBe(endHash);
    expect(runner.viewer.state).toMatchObject({ active: true, playing: false, divergedAt: null });
  });

  it("locks out the player's input while watching", () => {
    const { engine, runner, agent } = played(600);
    const replay = agent.saveReplay(5);
    runner.viewer.start(replay);
    const ticks = replay.endTick - replay.start.tick;
    for (let i = 0; i < ticks; i++) {
      engine.setInputDirection(i % 2 ? "UP" : "LEFT"); // ignored
      runner.tick();
    }
    expect(hashGameState(engine.getState())).toBe(replay.checkpoints.at(-1)![1]);
  });

  it("seeking shows the exact recorded frame, backwards and forwards", () => {
    const { engine, runner, agent } = played(900);
    const replay = agent.saveReplay(10);
    runner.viewer.start(replay);
    const [mid, midHash] = replay.checkpoints[Math.floor(replay.checkpoints.length / 2)];
    runner.viewer.seek(replay.endTick);
    runner.viewer.seek(mid);
    expect(engine.tick).toBe(mid);
    expect(hashGameState(engine.getState())).toBe(midHash);
  });

  it("exit puts the live game back exactly, recording included, paused by the player", () => {
    const { engine, runner, agent } = played(900);
    const liveHash = agent.hash();
    const liveLog = engine.replayLog;
    runner.viewer.start(agent.saveReplay(10));
    for (let i = 0; i < 120; i++) runner.tick();

    runner.viewer.stop();
    expect(agent.hash()).toBe(liveHash);
    expect(engine.replayLog).toBe(liveLog);
    expect(engine.watchingReplay).toBe(false);
    expect(runner.pausedBy).toEqual(["user"]);
    expect(agent.verifyReplay(agent.saveReplay()).matched).toBe(true); // rewind history intact
  });

  it("reports where a clip diverges on a build with other rules", () => {
    const { engine, runner, agent } = played(900);
    const replay = agent.saveReplay(10);
    replay.checkpoints = replay.checkpoints.map(([t, h], i) => [t, i === 3 ? h ^ 1 : h]);
    runner.viewer.start(replay);
    for (let i = 0; i < replay.endTick - replay.start.tick; i++) runner.tick();
    expect(runner.viewer.state.divergedAt).toBe(replay.checkpoints[3][0]);
    expect(engine.tick).toBe(replay.endTick);
  });
});

describe("Shareable replay links (T12)", () => {
  it("a clip survives the link round trip, and the link stays small", async () => {
    const { agent } = played(1500);
    const replay = agent.saveReplay(20);
    const code = await encodeReplay(replay);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(12_000);
    expect(await decodeReplay(code)).toEqual(replay);

    const link = await replayLink(replay, "http://localhost:3000/?x=1#old");
    expect(link.startsWith("http://localhost:3000/?x=1#replay=")).toBe(true);
    expect(replayCodeFromHash(new URL(link).hash)).toBe(code);
  });

  it("rejects what is not a replay link", async () => {
    expect(replayCodeFromHash("#something=else")).toBeNull();
    await expect(decodeReplay("not-a-replay")).rejects.toThrow();
  });
});
