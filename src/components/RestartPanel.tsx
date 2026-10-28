/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { CLASSIC_FRUITS } from '../game/constants';
import { GameMode } from '../types/game';

export interface RestartPanelProps {
  score: number;
  highScore: number;
  level: number;
  mode: GameMode;
  isGameOver: boolean;
  onRestartRound: () => void;
  onNewGame: () => void;
  onChangeMode: () => void;
  onClose: () => void;
}

export const RestartPanel: React.FC<RestartPanelProps> = ({
  score,
  highScore,
  level,
  mode,
  isGameOver,
  onRestartRound,
  onNewGame,
  onChangeMode,
  onClose,
}) => {
  const fruitMeta = CLASSIC_FRUITS[Math.min(level - 1, CLASSIC_FRUITS.length - 1)];

  const modeName =
    mode === 'PACMAN'
      ? 'Classic Pac-Man (1980)'
      : mode === 'MS_PACMAN'
      ? 'Ms. Pac-Man'
      : mode === 'CRAZY_OTTO'
      ? 'Crazy Otto (1981)'
      : 'Procedural Cookie Man';

  return (
    <div className="w-full max-w-[420px] bg-neutral-950/95 border-2 border-red-600/80 rounded-2xl p-6 text-white shadow-2xl backdrop-blur-md font-sans flex flex-col gap-5 select-none ring-1 ring-red-500/30">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl animate-bounce">
            {isGameOver ? '💀' : '🔄'}
          </span>
          <div>
            <h2 className="text-xl font-black tracking-widest text-red-500 font-mono">
              {isGameOver ? 'GAME OVER' : 'RESTART GAME'}
            </h2>
            <span className="text-xs text-neutral-400 font-mono">
              {modeName}
            </span>
          </div>
        </div>

        {!isGameOver && (
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg hover:bg-neutral-850 text-sm"
            aria-label="Close"
          >
            ✕
          </button>
        )}
      </div>

      {/* Stats Summary Card */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 grid grid-cols-2 gap-3 text-center font-mono">
        <div className="flex flex-col items-center bg-black/40 p-2.5 rounded-lg border border-neutral-800/80">
          <span className="text-[11px] text-neutral-400">FINAL SCORE</span>
          <span className="text-2xl font-black text-yellow-400 tabular-nums">
            {score.toLocaleString()}
          </span>
          {score >= highScore && score > 0 && (
            <span className="text-[9px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-1.5 py-0.5 rounded font-bold mt-1">
              ⭐ NEW BEST!
            </span>
          )}
        </div>

        <div className="flex flex-col items-center bg-black/40 p-2.5 rounded-lg border border-neutral-800/80">
          <span className="text-[11px] text-neutral-400">HIGH SCORE</span>
          <span className="text-2xl font-black text-white tabular-nums">
            {highScore.toLocaleString()}
          </span>
          <span className="text-[10px] text-neutral-400 mt-1 flex items-center gap-1">
            Stage {level} {fruitMeta?.symbol}
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col gap-2.5 font-mono text-sm">
        <button
          onClick={onNewGame}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 font-bold text-white shadow-lg transition-transform active:scale-[0.98] flex items-center justify-center gap-2 border border-red-400/30 cursor-pointer"
        >
          <span>⚡ START NEW GAME</span>
          <span className="text-xs opacity-75">(Level 1)</span>
        </button>

        <button
          onClick={onRestartRound}
          className="w-full py-2.5 px-4 rounded-xl bg-neutral-850 hover:bg-neutral-800 border border-neutral-750 font-semibold text-neutral-200 hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🔄 Restart Current Level {level}</span>
        </button>

        <button
          onClick={onChangeMode}
          className="w-full py-2.5 px-4 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 font-medium text-neutral-300 hover:text-white transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>🎮 Change Game Mode</span>
        </button>

        {!isGameOver && (
          <button
            onClick={onClose}
            className="w-full py-2 px-4 rounded-xl bg-transparent hover:bg-neutral-900 text-neutral-400 hover:text-white transition-colors text-xs text-center cursor-pointer"
          >
            ▶️ Resume Gameplay
          </button>
        )}
      </div>

      {/* Retro cabinet footer */}
      <div className="text-center text-[10px] text-neutral-400 font-mono tracking-wider border-t border-neutral-900 pt-2">
        INSERT COIN TO CONTINUE · 1 COIN 1 PLAY
      </div>
    </div>
  );
};
