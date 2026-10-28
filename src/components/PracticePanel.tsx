/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { GameEngine } from '../game/gameEngine';

interface PracticePanelProps {
  engine: GameEngine;
  onUpdate: () => void;
  onClose: () => void;
}

export const PracticePanel: React.FC<PracticePanelProps> = ({ engine, onUpdate, onClose }) => {
  const [speed, setSpeed] = useState<number>(engine.settings.gameSpeed);
  const bufferLen = engine.getRewindBufferLength();
  const currentScrubIdx = engine.rewindIndex !== -1 ? engine.rewindIndex : bufferLen - 1;

  const handleSpeedChange = (val: number) => {
    setSpeed(val);
    engine.settings.gameSpeed = val;
    onUpdate();
  };

  const handleRewindSeconds = (secs: number) => {
    engine.rewindSeconds(secs);
    onUpdate();
  };

  const handleScrub = (idx: number) => {
    engine.scrubToFrame(idx);
    onUpdate();
  };

  const handleResume = () => {
    engine.resumeFromScrub();
    onUpdate();
  };

  const togglePause = () => {
    if (engine.playState === 'PAUSED') {
      engine.playState = 'PLAYING';
    } else if (engine.playState === 'PLAYING') {
      engine.playState = 'PAUSED';
    }
    onUpdate();
  };

  const isPaused = engine.playState === 'PAUSED' || engine.rewindIndex !== -1;

  return (
    <div className="w-full max-w-[480px] bg-neutral-950/95 border border-emerald-800/80 rounded-xl p-4 text-xs font-mono text-neutral-300 shadow-2xl backdrop-blur-md flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-emerald-800/50 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-emerald-400 font-bold text-sm tracking-wider">🛠️ PRACTICE & REWIND SANDBOX</span>
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
              speed === 0.25 ? 'bg-emerald-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700'
            }`}
          >
            0.25x Slow
          </button>
          <button
            onClick={() => handleSpeedChange(0.5)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 0.5 ? 'bg-emerald-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700'
            }`}
          >
            0.50x
          </button>
          <button
            onClick={() => handleSpeedChange(1.0)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 1.0 ? 'bg-emerald-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700'
            }`}
          >
            1.0x Normal
          </button>
          <button
            onClick={() => handleSpeedChange(1.5)}
            className={`px-2 py-1 rounded transition-colors ${
              speed === 1.5 ? 'bg-emerald-600 text-white' : 'bg-neutral-800 hover:bg-neutral-700'
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
                isPaused ? 'bg-amber-500 text-black' : 'bg-neutral-800 hover:bg-neutral-700 text-white'
              }`}
            >
              {isPaused ? '▶ PLAY' : '⏸ PAUSE'}
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
          onClick={() => {
            engine.toggleInvincible();
            onUpdate();
          }}
          className={`p-2 rounded flex items-center justify-between font-semibold transition-colors ${
            engine.settings.invincible
              ? 'bg-amber-500 text-black ring-1 ring-amber-300'
              : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          <span>🛡️ Invincibility</span>
          <span>{engine.settings.invincible ? 'ON' : 'OFF'}</span>
        </button>

        {/* Ghost Paths Toggle */}
        <button
          onClick={() => {
            engine.settings.showGhostPaths = !engine.settings.showGhostPaths;
            onUpdate();
          }}
          className={`p-2 rounded flex items-center justify-between font-semibold transition-colors ${
            engine.settings.showGhostPaths
              ? 'bg-cyan-600 text-white'
              : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          <span>🧭 Ghost Paths</span>
          <span>{engine.settings.showGhostPaths ? 'ON' : 'OFF'}</span>
        </button>

        {/* Target Lines Toggle */}
        <button
          onClick={() => {
            engine.settings.showTargetLines = !engine.settings.showTargetLines;
            onUpdate();
          }}
          className={`p-2 rounded flex items-center justify-between font-semibold transition-colors ${
            engine.settings.showTargetLines
              ? 'bg-purple-600 text-white'
              : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          <span>📏 Target Lines</span>
          <span>{engine.settings.showTargetLines ? 'ON' : 'OFF'}</span>
        </button>

        {/* Show Grid Toggle */}
        <button
          onClick={() => {
            engine.settings.showGrid = !engine.settings.showGrid;
            onUpdate();
          }}
          className={`p-2 rounded flex items-center justify-between font-semibold transition-colors ${
            engine.settings.showGrid
              ? 'bg-blue-600 text-white'
              : 'bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800'
          }`}
        >
          <span>📐 Tile Grid</span>
          <span>{engine.settings.showGrid ? 'ON' : 'OFF'}</span>
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

        {engine.mode === 'COOKIE_MAN' && (
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
