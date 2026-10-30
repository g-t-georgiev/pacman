import React, { useState } from "react";
import type { GameEngine } from "../game/gameEngine";

interface PracticePanelProps {
  engine: GameEngine;
  onUpdate: () => void;
  onClose: () => void;
}

export const PracticePanel: React.FC<PracticePanelProps> = ({ engine, onUpdate, onClose }) => {
  const [speed, setSpeed] = useState<number>(engine.settings.gameSpeed);
  const [invincible, setInvincible] = useState<boolean>(engine.settings.invincible);
  const [showGhostPaths, setShowGhostPaths] = useState<boolean>(engine.settings.showGhostPaths);
  const [showTargetLines, setShowTargetLines] = useState<boolean>(engine.settings.showTargetLines);
  const [showGrid, setShowGrid] = useState<boolean>(engine.settings.showGrid);
  const [isPaused, setIsPaused] = useState<boolean>(
    engine.playState === "PAUSED" || engine.rewindIndex !== -1
  );

  const bufferLen = engine.getRewindBufferLength();
  const currentScrubIdx = engine.rewindIndex !== -1 ? engine.rewindIndex : bufferLen - 1;

  const handleSpeedChange = (val: number) => {
    setSpeed(val);
    engine.settings.gameSpeed = val;
    onUpdate();
  };

  const handleToggleInvincible = () => {
    engine.toggleInvincible();
    setInvincible(engine.settings.invincible);
    onUpdate();
  };

  const handleToggleGhostPaths = () => {
    const nextVal = !engine.settings.showGhostPaths;
    engine.settings.showGhostPaths = nextVal;
    setShowGhostPaths(nextVal);
    onUpdate();
  };

  const handleToggleTargetLines = () => {
    const nextVal = !engine.settings.showTargetLines;
    engine.settings.showTargetLines = nextVal;
    setShowTargetLines(nextVal);
    onUpdate();
  };

  const handleToggleGrid = () => {
    const nextVal = !engine.settings.showGrid;
    engine.settings.showGrid = nextVal;
    setShowGrid(nextVal);
    onUpdate();
  };

  const handleRewindSeconds = (secs: number) => {
    engine.rewindSeconds(secs);
    setIsPaused(true);
    onUpdate();
  };

  const handleScrub = (idx: number) => {
    engine.scrubToFrame(idx);
    setIsPaused(true);
    onUpdate();
  };

  const handleResume = () => {
    engine.resumeFromScrub();
    setIsPaused(engine.playState === "PAUSED");
    onUpdate();
  };

  const togglePause = () => {
    if (engine.playState === "PAUSED") {
      engine.playState = "PLAYING";
    } else if (engine.playState === "PLAYING") {
      engine.playState = "PAUSED";
    }
    setIsPaused(engine.playState === "PAUSED" || engine.rewindIndex !== -1);
    onUpdate();
  };

  return (
    <div className="w-full max-w-[480px] bg-neutral-950/95 border border-emerald-800/80 rounded-xl p-4 text-xs font-mono text-neutral-300 shadow-2xl backdrop-blur-md flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-800/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-sm tracking-wider">
            🛠️ PRACTICE & REWIND SANDBOX
          </span>
          <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-1.5 py-0.5 rounded">
            PRACTICE
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white px-2 py-0.5 rounded hover:bg-neutral-800"
        >
          ✕
        </button>
      </div>

      {/* Playback & Speed Controls */}
      <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-neutral-300 font-semibold">GAME SPEED & SLOW-MO</span>
          <span className="text-emerald-400 font-bold tabular-nums">{speed.toFixed(2)}x</span>
        </div>

        <input
          type="range"
          min="0.1"
          max="2.0"
          step="0.05"
          value={speed}
          onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
          className="w-full accent-emerald-500 cursor-pointer"
        />

        <div className="flex items-center justify-between gap-1 text-[10px]">
          <button
            onClick={() => handleSpeedChange(0.25)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 0.25 ? "bg-emerald-600 text-white" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            0.25x Slow
          </button>
          <button
            onClick={() => handleSpeedChange(0.5)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 0.5 ? "bg-emerald-600 text-white" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            0.50x
          </button>
          <button
            onClick={() => handleSpeedChange(1.0)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 1.0 ? "bg-emerald-600 text-white" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            1.0x Normal
          </button>
          <button
            onClick={() => handleSpeedChange(1.5)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 1.5 ? "bg-emerald-600 text-white" : "bg-neutral-800 hover:bg-neutral-700"
            }`}
          >
            1.5x Fast
          </button>
        </div>
      </div>

      {/* Rewind Scrubber */}
      <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-neutral-300 font-semibold">REWIND BUFFER</span>
            <span className="text-[10px] text-neutral-400">
              ({(bufferLen / 60).toFixed(1)}s recorded)
            </span>
          </div>
          {engine.rewindIndex !== -1 && (
            <button
              onClick={handleResume}
              className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shadow"
            >
              ▶ Resume from Here
            </button>
          )}
        </div>

        {/* Scrub Slider */}
        <input
          type="range"
          min="0"
          max={Math.max(0, bufferLen - 1)}
          value={currentScrubIdx}
          disabled={bufferLen <= 1}
          onChange={(e) => handleScrub(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-500 cursor-pointer disabled:opacity-50"
        />

        <div className="flex items-center justify-between gap-1 text-[10px]">
          <div className="flex items-center gap-1">
            <button
              onClick={togglePause}
              className={`px-2.5 py-1 rounded font-bold transition-colors ${
                isPaused
                  ? "bg-amber-500 text-black"
                  : "bg-neutral-800 hover:bg-neutral-700 text-white"
              }`}
            >
              {isPaused ? "▶ PLAY" : "⏸ PAUSE"}
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleRewindSeconds(2)}
              disabled={bufferLen < 120}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
              title="Rewind 2 seconds"
            >
              ⏪ -2s
            </button>
            <button
              onClick={() => handleRewindSeconds(5)}
              disabled={bufferLen < 300}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
              title="Rewind 5 seconds"
            >
              ⏪ -5s
            </button>
            <button
              onClick={() => handleRewindSeconds(10)}
              disabled={bufferLen < 600}
              className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40"
              title="Rewind 10 seconds"
            >
              ⏪ -10s
            </button>
          </div>
        </div>
      </div>

      {/* Visualizers & Cheats Toggles */}
      <div className="grid grid-cols-2 gap-2 text-[11px]">
        {/* Invincibility Toggle */}
        <button
          onClick={handleToggleInvincible}
          className={`p-2.5 rounded-lg flex flex-col gap-1 text-left font-semibold transition-all cursor-pointer ${
            invincible
              ? "bg-amber-500 text-black shadow-md shadow-amber-500/20 ring-1 ring-amber-300"
              : "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5">
              <span>🛡️</span>
              <span>Invincibility</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${invincible ? "bg-black/20 text-black" : "bg-neutral-800 text-neutral-400"}`}
            >
              {invincible ? "ON" : "OFF"}
            </span>
          </div>
          <span
            className={`text-[9px] font-normal leading-tight ${invincible ? "text-black/80" : "text-neutral-400"}`}
          >
            Pac-Man impervious to ghost contact
          </span>
        </button>

        {/* Ghost Paths Toggle */}
        <button
          onClick={handleToggleGhostPaths}
          className={`p-2.5 rounded-lg flex flex-col gap-1 text-left font-semibold transition-all cursor-pointer ${
            showGhostPaths
              ? "bg-cyan-600 text-white shadow-md shadow-cyan-600/20 ring-1 ring-cyan-400"
              : "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5">
              <span>🧭</span>
              <span>Ghost Paths</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${showGhostPaths ? "bg-cyan-900 text-cyan-100" : "bg-neutral-800 text-neutral-400"}`}
            >
              {showGhostPaths ? "ON" : "OFF"}
            </span>
          </div>
          <span
            className={`text-[9px] font-normal leading-tight ${showGhostPaths ? "text-cyan-100/90" : "text-neutral-400"}`}
          >
            Multi-step corridor lookahead & turn arrows
          </span>
        </button>

        {/* Target Lines Toggle */}
        <button
          onClick={handleToggleTargetLines}
          className={`p-2.5 rounded-lg flex flex-col gap-1 text-left font-semibold transition-all cursor-pointer ${
            showTargetLines
              ? "bg-purple-600 text-white shadow-md shadow-purple-600/20 ring-1 ring-purple-400"
              : "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5">
              <span>📏</span>
              <span>Target Radar</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${showTargetLines ? "bg-purple-900 text-purple-100" : "bg-neutral-800 text-neutral-400"}`}
            >
              {showTargetLines ? "ON" : "OFF"}
            </span>
          </div>
          <span
            className={`text-[9px] font-normal leading-tight ${showTargetLines ? "text-purple-100/90" : "text-neutral-400"}`}
          >
            Laser vector, tile distance & proximity alert
          </span>
        </button>

        {/* Show Grid Toggle */}
        <button
          onClick={handleToggleGrid}
          className={`p-2.5 rounded-lg flex flex-col gap-1 text-left font-semibold transition-all cursor-pointer ${
            showGrid
              ? "bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-1 ring-blue-400"
              : "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800"
          }`}
        >
          <div className="flex items-center justify-between w-full">
            <span className="flex items-center gap-1.5">
              <span>📐</span>
              <span>Tile Grid</span>
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${showGrid ? "bg-blue-900 text-blue-100" : "bg-neutral-800 text-neutral-400"}`}
            >
              {showGrid ? "ON" : "OFF"}
            </span>
          </div>
          <span
            className={`text-[9px] font-normal leading-tight ${showGrid ? "text-blue-100/90" : "text-neutral-400"}`}
          >
            Maze tile grid & decision intersections
          </span>
        </button>
      </div>

      {/* Instant Action Triggers */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-neutral-800 text-[10px]">
        <button
          onClick={() => {
            engine.triggerFrightenedMode();
            onUpdate();
          }}
          className="flex-1 px-2 py-1.5 rounded bg-blue-900/60 border border-blue-700/60 hover:bg-blue-800/80 text-blue-200 font-semibold text-center"
        >
          ⚡ Frighten Ghosts
        </button>

        <button
          onClick={() => {
            engine.spawnFruit();
            onUpdate();
          }}
          className="flex-1 px-2 py-1.5 rounded bg-amber-900/60 border border-amber-700/60 hover:bg-amber-800/80 text-amber-200 font-semibold text-center"
        >
          🍒 Spawn Fruit
        </button>

        <button
          onClick={() => {
            engine.resetGhostsToHouse();
            onUpdate();
          }}
          className="flex-1 px-2 py-1.5 rounded bg-red-900/60 border border-red-700/60 hover:bg-red-800/80 text-red-200 font-semibold text-center"
        >
          🏠 Reset Ghosts
        </button>

        {engine.mode === "COOKIE_MAN" && (
          <button
            onClick={() => {
              engine.loadLevel(engine.level);
              onUpdate();
            }}
            className="w-full px-2 py-1.5 mt-1 rounded bg-orange-900/60 border border-orange-700/60 hover:bg-orange-800/80 text-orange-200 font-semibold text-center"
          >
            🎲 Regenerate Procedural Maze
          </button>
        )}
      </div>
    </div>
  );
};
