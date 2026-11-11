import React, { useEffect, useState } from "react";
import type { GameRunner } from "../game/GameRunner";
import { SIM_FPS } from "../game/constants";

interface ReplayBarProps {
  runner: GameRunner;
  onExit: () => void;
}

const SPEEDS = [0.25, 0.5, 1, 2];

function clock(frames: number): string {
  const seconds = Math.max(0, Math.round(frames / SIM_FPS));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Controls for watching a replay (plan T12), shown under the canvas while one plays: restart,
 * play/pause (Space), speed, scrub, time, and Exit (Esc) back to the live game. Refreshes a few
 * times a second, never per frame (A7).
 */
export const ReplayBar: React.FC<ReplayBarProps> = ({ runner, onExit }) => {
  const [, refresh] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => refresh((n) => n + 1), 250);
    return () => window.clearInterval(id);
  }, []);

  const viewer = runner.viewer;
  const v = viewer.state;
  if (!v.active) return null;
  const speed = runner.engine.settings.gameSpeed;
  const length = v.endTick - v.startTick;

  return (
    <div className="w-full max-w-[480px] bg-neutral-900 border border-red-900/70 border-t-0 px-3 py-2 flex flex-col gap-1.5 text-[11px] font-mono text-neutral-300">
      <div className="flex items-center gap-2">
        <span className="text-red-400 font-bold">● REPLAY</span>
        <button
          onClick={() => viewer.seek(v.startTick)}
          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700"
          title="Back to the start"
        >
          ⏮
        </button>
        <button
          onClick={() => (v.playing ? viewer.pause() : viewer.play())}
          className="px-2.5 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold"
          title="Play / pause (Space)"
        >
          {v.playing ? "⏸" : "▶"}
        </button>
        <div className="flex items-center gap-1">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => {
                runner.engine.settings.gameSpeed = s;
                refresh((n) => n + 1);
              }}
              className={`px-1.5 py-0.5 rounded ${
                speed === s ? "bg-neutral-200 text-black" : "bg-neutral-800 hover:bg-neutral-700"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        <span className="ml-auto tabular-nums">
          {clock(v.tick - v.startTick)} / {clock(length)}
        </span>
        <button
          onClick={onExit}
          className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 font-bold"
          title="Back to the live game (Esc)"
        >
          Exit
        </button>
      </div>
      <input
        type="range"
        min={v.startTick}
        max={v.endTick}
        value={v.tick}
        onChange={(e) => {
          viewer.seek(parseInt(e.target.value, 10));
          refresh((n) => n + 1);
        }}
        className="w-full accent-red-500 cursor-pointer"
      />
      {v.divergedAt !== null && (
        <span className="text-amber-400">
          This build plays the clip differently from {clock(v.divergedAt - v.startTick)} on (it was
          recorded with other game rules).
        </span>
      )}
    </div>
  );
};
