/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { GHOST_COLORS, SCATTER_CHASE_SCHEDULE } from "../game/constants";
import { GameEngine } from "../game/gameEngine";
import { GhostType } from "../types/game";

interface LearnModeOverlayProps {
  engine: GameEngine;
  onClose: () => void;
  onVisualSettingsChange?: () => void;
}

// Mini SVG Arcade Ghost Avatar
const GhostAvatar: React.FC<{ type: GhostType; size?: number; active: boolean }> = ({
  type,
  size = 24,
  active,
}) => {
  const color = GHOST_COLORS[type].body;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={`transition-transform ${active ? "scale-100 opacity-100 drop-shadow-[0_0_6px_rgba(255,255,255,0.4)]" : "scale-90 opacity-40 grayscale"}`}
    >
      {/* Ghost Dome & Tentacles Body */}
      <path
        d="M 3 12 C 3 6.5 7 2 12 2 C 17 2 21 6.5 21 12 L 21 21 L 18 18.5 L 15 21 L 12 18.5 L 9 21 L 6 18.5 L 3 21 Z"
        fill={color}
      />
      {/* Sclera (White eyes) */}
      <ellipse cx="8.5" cy="10" rx="2.5" ry="3.5" fill="#ffffff" />
      <ellipse cx="15.5" cy="10" rx="2.5" ry="3.5" fill="#ffffff" />
      {/* Pupils (Blue) */}
      <circle cx="7.5" cy="10" r="1.5" fill="#0000dd" />
      <circle cx="14.5" cy="10" r="1.5" fill="#0000dd" />
    </svg>
  );
};

export const LearnModeOverlay: React.FC<LearnModeOverlayProps> = ({
  engine,
  onClose,
  onVisualSettingsChange,
}) => {
  const [visualsEnabled, setVisualsEnabled] = useState<boolean>(
    engine.settings.learnVisualsEnabled ?? true
  );
  const [ghostFilters, setGhostFilters] = useState<Record<GhostType, boolean>>({
    BLINKY: engine.settings.activeGhostVisuals?.BLINKY ?? true,
    PINKY: engine.settings.activeGhostVisuals?.PINKY ?? true,
    INKY: engine.settings.activeGhostVisuals?.INKY ?? true,
    CLYDE: engine.settings.activeGhostVisuals?.CLYDE ?? true,
  });

  const wave = SCATTER_CHASE_SCHEDULE[engine.waveIndex];
  const isFrightened = engine.frightenedGlobalTimer > 0;
  const dotsRemaining = engine.dotsRemaining;
  const isElroy1 = dotsRemaining <= 20 && dotsRemaining > 10;
  const isElroy2 = dotsRemaining <= 10;

  const handleToggleMasterVisuals = () => {
    const nextVal = !visualsEnabled;
    setVisualsEnabled(nextVal);
    engine.settings.learnVisualsEnabled = nextVal;
    if (onVisualSettingsChange) onVisualSettingsChange();
  };

  const handleToggleGhost = (type: GhostType) => {
    const nextVal = !ghostFilters[type];
    const nextFilters = { ...ghostFilters, [type]: nextVal };
    setGhostFilters(nextFilters);
    engine.settings.activeGhostVisuals = nextFilters;
    if (onVisualSettingsChange) onVisualSettingsChange();
  };

  const handleSetAllGhosts = (enabled: boolean) => {
    const nextFilters: Record<GhostType, boolean> = {
      BLINKY: enabled,
      PINKY: enabled,
      INKY: enabled,
      CLYDE: enabled,
    };
    setGhostFilters(nextFilters);
    engine.settings.activeGhostVisuals = nextFilters;
    if (onVisualSettingsChange) onVisualSettingsChange();
  };

  const ghostList: GhostType[] = ["BLINKY", "PINKY", "INKY", "CLYDE"];
  const allActive = ghostList.every((g) => ghostFilters[g]);
  const noneActive = ghostList.every((g) => !ghostFilters[g]);

  return (
    <div className="w-full max-w-[500px] bg-neutral-950/95 border-2 border-cyan-700/80 rounded-2xl p-4 sm:p-5 text-xs font-mono text-neutral-300 shadow-2xl backdrop-blur-md flex flex-col gap-3.5 select-none ring-1 ring-cyan-500/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-cyan-800/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <h2 className="text-cyan-400 font-bold text-sm sm:text-base tracking-wider">
              GHOST AI INTELLIGENCE LAB
            </h2>
            <span className="text-[10px] text-neutral-400">
              Interactive Targeting & Path Visualization
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-neutral-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-neutral-800 transition-colors text-sm font-bold border border-neutral-800"
          title="Close lab and return to game"
        >
          ✕
        </button>
      </div>

      {/* Persistent Visual Cues & Ghost Checkboxes Section */}
      <div className="p-3 rounded-xl bg-neutral-900/90 border border-cyan-900/50 flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-white font-bold text-[11px] tracking-wide">
              👁️ PERSIST VISUAL CUES ON MAZE
            </span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                visualsEnabled
                  ? "bg-cyan-950 text-cyan-300 border border-cyan-800"
                  : "bg-neutral-800 text-neutral-400 border border-neutral-700"
              }`}
            >
              {visualsEnabled ? "ENABLED" : "PAUSED"}
            </span>
          </div>
          <button
            onClick={handleToggleMasterVisuals}
            className={`px-3 py-1 rounded-lg font-bold text-[10px] transition-colors cursor-pointer ${
              visualsEnabled
                ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-md"
                : "bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
            }`}
          >
            {visualsEnabled ? "Visible On Maze" : "Hidden On Maze"}
          </button>
        </div>

        <p className="text-[10px] text-neutral-400 leading-tight">
          Keep target reticles, lines, and Clyde distance radius active on the game screen while playing, even when this panel is closed!
        </p>

        {/* Ghost Avatar Selection Row */}
        <div className="border-t border-neutral-800/80 pt-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] text-neutral-400">
            <span>TOGGLE INDIVIDUAL GHOST PATHS:</span>
            <div className="flex gap-2">
              <button
                onClick={() => handleSetAllGhosts(true)}
                disabled={allActive}
                className="hover:text-cyan-300 disabled:opacity-40 underline cursor-pointer"
              >
                All On
              </button>
              <span>·</span>
              <button
                onClick={() => handleSetAllGhosts(false)}
                disabled={noneActive}
                className="hover:text-red-300 disabled:opacity-40 underline cursor-pointer"
              >
                All Off
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ghostList.map((ghostKey) => {
              const active = ghostFilters[ghostKey];
              const info = GHOST_COLORS[ghostKey];

              return (
                <button
                  key={ghostKey}
                  onClick={() => handleToggleGhost(ghostKey)}
                  className={`p-2 rounded-xl flex items-center gap-2 border transition-all cursor-pointer ${
                    active
                      ? "bg-neutral-850 border-neutral-650 shadow-sm"
                      : "bg-neutral-900/60 border-neutral-800/60 opacity-60"
                  }`}
                  style={{
                    borderColor: active ? info.body : undefined,
                  }}
                  title={`Toggle visual cues for ${info.name}`}
                >
                  <GhostAvatar type={ghostKey} size={22} active={active} />
                  <div className="flex flex-col text-left overflow-hidden">
                    <span className="font-bold text-[11px] leading-tight" style={{ color: active ? info.body : "#999" }}>
                      {info.name}
                    </span>
                    <span className="text-[9px] text-neutral-400">
                      {active ? "☑ Active" : "☐ Muted"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Global Wave Status */}
      <div className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between">
        <div>
          <span className="text-neutral-400 text-[10px] block">GLOBAL AI WAVE CYCLE:</span>
          {isFrightened ? (
            <span className="text-blue-400 font-bold text-xs sm:text-sm animate-pulse">
              FRIGHTENED ({engine.frightenedGlobalTimer.toFixed(1)}s left)
            </span>
          ) : (
            <span className="text-white font-bold text-xs sm:text-sm">
              {wave?.mode === "SCATTER" ? "🛡️ SCATTER MODE" : "⚔️ CHASE MODE"}{" "}
              {wave?.duration !== Infinity ? `(${Math.max(0, Math.ceil(wave.duration - engine.waveTimer))}s left)` : "(Permanent)"}
            </span>
          )}
        </div>
        <div className="text-right text-[11px]">
          <span className="text-neutral-400 block text-[10px]">Dots Left:</span>
          <span className="text-yellow-400 font-bold tabular-nums text-sm">{engine.dotsRemaining}</span>
        </div>
      </div>

      {/* 4 Ghost Personalities Breakdown */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[190px] overflow-y-auto pr-1">
        {/* Blinky */}
        <div
          className={`p-2 rounded-lg bg-neutral-900/80 border flex flex-col gap-1 transition-opacity ${
            ghostFilters.BLINKY ? "border-red-900/80" : "border-neutral-800 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-red-400 font-bold text-[11px]">BLINKY (Red / Shadow)</span>
            {isElroy2 ? (
              <span className="text-[9px] bg-red-600 text-white font-bold px-1 rounded animate-pulse">ELROY 2</span>
            ) : isElroy1 ? (
              <span className="text-[9px] bg-orange-600 text-white font-bold px-1 rounded">ELROY 1</span>
            ) : (
              <span className="text-[9px] text-neutral-400">Normal</span>
            )}
          </div>
          <p className="text-[10px] text-neutral-400 leading-tight">
            Direct pursuer. Targets Pac-Man"s exact tile. Speeds up when dots &le; 20 (Cruise Elroy) and ignores scatter!
          </p>
          <div className="text-[10px] text-red-300">
            Target: ({engine.ghosts.BLINKY.target.col}, {engine.ghosts.BLINKY.target.row})
          </div>
        </div>

        {/* Pinky */}
        <div
          className={`p-2 rounded-lg bg-neutral-900/80 border flex flex-col gap-1 transition-opacity ${
            ghostFilters.PINKY ? "border-pink-900/80" : "border-neutral-800 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-pink-400 font-bold text-[11px]">PINKY (Pink / Speedy)</span>
            <span className="text-[9px] text-pink-300">Ambush</span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-tight">
            Flanker. Targets 4 tiles ahead of Pac-Man. When Pac-Man faces UP, targets 4 up + 4 left (arcade overflow bug)!
          </p>
          <div className="text-[10px] text-pink-300">
            Target: ({engine.ghosts.PINKY.target.col}, {engine.ghosts.PINKY.target.row})
          </div>
        </div>

        {/* Inky */}
        <div
          className={`p-2 rounded-lg bg-neutral-900/80 border flex flex-col gap-1 transition-opacity ${
            ghostFilters.INKY ? "border-cyan-900/80" : "border-neutral-800 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-cyan-400 font-bold text-[11px]">INKY (Cyan / Bashful)</span>
            <span className="text-[9px] text-cyan-300">Pincer Vector</span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-tight">
            Takes 2 tiles ahead of Pac-Man, draws vector from Blinky to that point, and doubles it to trap player!
          </p>
          <div className="text-[10px] text-cyan-300">
            Target: ({engine.ghosts.INKY.target.col}, {engine.ghosts.INKY.target.row})
          </div>
        </div>

        {/* Clyde */}
        <div
          className={`p-2 rounded-lg bg-neutral-900/80 border flex flex-col gap-1 transition-opacity ${
            ghostFilters.CLYDE ? "border-amber-900/80" : "border-neutral-800 opacity-60"
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-amber-400 font-bold text-[11px]">CLYDE (Orange / Pokey)</span>
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                engine.ghosts.CLYDE.clydeWanderState === "CHASE"
                  ? "bg-emerald-900 text-emerald-300"
                  : "bg-amber-900 text-amber-300"
              }`}
            >
              {engine.ghosts.CLYDE.clydeWanderState === "CHASE" ? "CHASING" : "FLEEING"}
            </span>
          </div>
          <p className="text-[10px] text-neutral-400 leading-tight">
            When far (&ge; 8 tiles), switches between chasing and fleeing. When within 8 tiles, always retreats to bottom-left!
          </p>
          <div className="text-[10px] text-amber-300">
            Target: ({engine.ghosts.CLYDE.target.col}, {engine.ghosts.CLYDE.target.row})
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-cyan-950 pt-2 text-[10px] text-neutral-400">
        <span>💡 Close panel anytime: cues remain visible on map while enabled</span>
        <button
          onClick={onClose}
          className="text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
        >
          Return to Game &rarr;
        </button>
      </div>
    </div>
  );
};
