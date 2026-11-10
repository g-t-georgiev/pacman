import React from "react";

interface HUDProps {
  score: number;
  highScore: number;
  level: number;
  turbo: boolean;
  onToggleTurbo: () => void;
  /** The Lab panel (Learn / Practice / Debug) is open. */
  labOpen: boolean;
  onToggleLab: () => void;
  learnVisualsEnabled?: boolean;
  /** The game is held, and by whom (T11). */
  paused: boolean;
  pausedBy: string[];
  onTogglePause: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  crtFilter: boolean;
  onToggleCrt: () => void;
  onOpenRestart: () => void;
  restartPanelOpen: boolean;
  isGameOver?: boolean;
  showDiagnostics?: boolean;
  onToggleDiagnostics?: () => void;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  highScore,
  level,
  turbo,
  onToggleTurbo,
  labOpen,
  onToggleLab,
  learnVisualsEnabled = true,
  paused,
  pausedBy,
  onTogglePause,
  soundEnabled,
  onToggleSound,
  crtFilter,
  onToggleCrt,
  onOpenRestart,
  restartPanelOpen,
  isGameOver = false,
  showDiagnostics = false,
  onToggleDiagnostics,
}) => {
  return (
    <div className="w-full max-w-[480px] bg-neutral-900 border border-neutral-800 rounded-t-xl px-3 sm:px-4 py-2.5 flex flex-col gap-2 select-none text-white">
      {/* Top Arcade Scoreboard */}
      <div className="grid grid-cols-3 text-center tracking-widest font-mono text-xs sm:text-sm">
        <div className="flex flex-col items-start">
          <span className="text-red-500 font-bold">1UP</span>
          <span className="text-white text-base sm:text-lg font-bold tabular-nums">
            {score.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-yellow-400 font-bold">HIGH SCORE</span>
          <span className="text-white text-base sm:text-lg font-bold tabular-nums">
            {highScore.toString().padStart(2, "0")}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-cyan-400 font-bold">LEVEL</span>
          <span className="text-white text-base sm:text-lg font-bold tabular-nums">{level}</span>
        </div>
      </div>

      {/* Control Quick Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1 pt-1 border-t border-neutral-800/80 text-[11px]">
        {/* Restart Panel Button */}
        <button
          onClick={onOpenRestart}
          className={`px-2 py-1 rounded font-mono font-semibold transition-all border flex items-center gap-1 cursor-pointer ${
            restartPanelOpen
              ? "bg-red-900 border-red-700 text-white"
              : isGameOver
                ? "bg-red-600 border-red-400 text-white animate-pulse shadow-lg shadow-red-500/60 ring-2 ring-red-400 font-bold"
                : "bg-neutral-800 border-transparent text-neutral-400 hover:text-white"
          }`}
          title={isGameOver ? "Game Over - Click to Restart" : "Restart Game / Level / Mode"}
        >
          <span>🔄 RESTART</span>
        </button>

        {/* Turbo Toggle */}
        <button
          onClick={onToggleTurbo}
          className={`px-2 py-1 rounded font-mono font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
            turbo
              ? "bg-amber-500 text-black shadow-sm ring-1 ring-amber-300"
              : "bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
          title="Toggle Turbo Speed (1.6x fast arcade chip)"
        >
          <span>⚡ TURBO</span>
          {turbo && <span className="text-[9px] bg-black/20 px-1 rounded">ON</span>}
        </button>

        {/* Lab: Learn, Practice and Debug tabs */}
        <button
          onClick={onToggleLab}
          className={`px-2 py-1 rounded font-mono font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
            labOpen
              ? "bg-cyan-500 text-black shadow-sm ring-1 ring-cyan-300"
              : learnVisualsEnabled
                ? "bg-cyan-950/80 border border-cyan-800 text-cyan-300 hover:text-white"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
          title="Lab: ghost AI (L), practice & rewind (P), debug overlay (F1)"
        >
          <span>🧪 LAB</span>
          {learnVisualsEnabled && !labOpen && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"
              title="Visual cues active on maze"
            />
          )}
        </button>

        {/* Diagnostics Console Toggle */}
        {onToggleDiagnostics && (
          <button
            onClick={onToggleDiagnostics}
            className={`px-2 py-1 rounded font-mono font-semibold transition-colors flex items-center gap-1 cursor-pointer ${
              showDiagnostics
                ? "bg-cyan-600 text-white shadow-sm ring-1 ring-cyan-300"
                : "bg-neutral-800 text-neutral-400 hover:text-white"
            }`}
            title="In-Game Diagnostics & Telemetry HUD"
          >
            <span>🔬 DIAG</span>
          </button>
        )}

        {/* CRT Scanlines Toggle */}
        <button
          onClick={onToggleCrt}
          className={`px-2 py-1 rounded font-mono font-semibold transition-colors cursor-pointer ${
            crtFilter
              ? "bg-purple-600 text-white shadow-sm"
              : "bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
          title="Toggle Arcade CRT Scanlines & Bloom"
        >
          CRT
        </button>

        {/* Pause / resume (dev builds; Space works everywhere). Shows who holds the game. */}
        {import.meta.env.DEV && (
          <button
            onClick={onTogglePause}
            className={`px-2 py-1 rounded font-mono font-semibold transition-colors cursor-pointer ${
              paused
                ? "bg-amber-500 text-black"
                : "bg-neutral-800 text-neutral-300 hover:text-white"
            }`}
            title={
              paused
                ? `Paused by: ${pausedBy.join(", ") || "game"} (Space to play)`
                : "Pause (Space)"
            }
          >
            {paused ? "▶" : "⏸"}
          </button>
        )}

        {/* Audio Toggle */}
        <button
          onClick={onToggleSound}
          className={`px-2 py-1 rounded font-mono font-semibold transition-colors cursor-pointer ${
            soundEnabled
              ? "bg-neutral-800 text-yellow-400 hover:text-yellow-300"
              : "bg-neutral-800 text-neutral-500 hover:text-neutral-400"
          }`}
          title={soundEnabled ? "Mute Audio" : "Unmute Audio"}
        >
          {soundEnabled ? "🔊" : "🔇"}
        </button>
      </div>
    </div>
  );
};
