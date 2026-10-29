import React from "react";
import type { GameMode } from "../types";

interface ModeSelectorProps {
  currentMode: GameMode;
  onSelectMode: (mode: GameMode) => void;
  turbo: boolean;
  onToggleTurbo: () => void;
  onStartGame: () => void;
  highScore: number;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  currentMode,
  onSelectMode,
  turbo,
  onToggleTurbo,
  onStartGame,
  highScore,
}) => {
  const modes: Array<{
    id: GameMode;
    title: string;
    subtitle: string;
    badge: string;
    icon: string;
    accent: string;
    description: string;
  }> = [
    {
      id: "PACMAN",
      title: "Pac-Man",
      subtitle: "Original 1980 Arcade Classic",
      badge: "CLASSIC",
      icon: "🟡",
      accent: "border-yellow-500/60 text-yellow-400",
      description: "The iconic arcade maze, original Blinky/Pinky/Inky/Clyde AI, and authentic siren tones.",
    },
    {
      id: "MS_PACMAN",
      title: "Ms. Pac-Man",
      subtitle: "1982 Midway Sequel",
      badge: "DUAL TUNNELS",
      icon: "🎀",
      accent: "border-pink-500/60 text-pink-400",
      description: "Pink bow, lipstick, beauty mark, 2 pairs of warp tunnels, salmon maze, and bouncing fruits.",
    },
    {
      id: "CRAZY_OTTO",
      title: "Crazy Otto",
      subtitle: "1981 GCC Historical Prototype",
      badge: "PROTOTYPE",
      icon: "👟",
      accent: "border-cyan-500/60 text-cyan-400",
      description: "The legendary precursor to Ms. Pac-Man! Animated running legs, red antenna hat, and big eyes.",
    },
    {
      id: "COOKIE_MAN",
      title: "Cookie Man",
      subtitle: "Procedural Solvable Mazes",
      badge: "INFINITE MAZES",
      icon: "🍪",
      accent: "border-amber-600/60 text-amber-400",
      description: "Randomly generated symmetric solvable mazes, chocolate chip pellets, milk glass treats & baker hat.",
    },
  ];

  return (
    <div className="w-full max-w-[480px] bg-neutral-950 border border-neutral-800 rounded-2xl p-5 shadow-2xl flex flex-col gap-4 text-white font-mono">
      {/* Title */}
      <div className="text-center flex flex-col items-center gap-1">
        <h2 className="text-xl sm:text-2xl font-bold tracking-widest text-yellow-400 drop-shadow">
          ARCADE ARCIVE
        </h2>
        <p className="text-xs text-neutral-400">
          SELECT GAME EDITION & SPEED
        </p>
      </div>

      {/* Mode List */}
      <div className="flex flex-col gap-2.5">
        {modes.map((m) => {
          const isSelected = currentMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => onSelectMode(m.id)}
              className={`p-3 rounded-xl border text-left transition-all duration-150 flex items-start gap-3.5 ${
                isSelected
                  ? `bg-neutral-900 shadow-md ${m.accent} ring-2 ring-yellow-400/40`
                  : "bg-neutral-900/60 border-neutral-800 hover:bg-neutral-900 hover:border-neutral-700 text-neutral-300"
              }`}
            >
              <div className="text-2xl p-2 rounded-lg bg-black/40 shrink-0 border border-neutral-800/80">
                {m.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm tracking-wide text-white">{m.title}</span>
                    <span className="text-[10px] text-neutral-400">({m.subtitle})</span>
                  </div>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                    {m.badge}
                  </span>
                </div>
                <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
                  {m.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Turbo Speed Option */}
      <div className="p-3 rounded-xl bg-neutral-900 border border-neutral-800 flex items-center justify-between">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-amber-400">⚡ TURBO SPEED CHIP</span>
            <span className="text-[9px] px-1 rounded bg-neutral-800 text-neutral-400">ARCADE MOD</span>
          </div>
          <span className="text-[11px] text-neutral-400 mt-0.5">
            Boosts player & ghost pace to 1.6x speed
          </span>
        </div>
        <button
          onClick={onToggleTurbo}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
            turbo
              ? "bg-amber-500 text-black shadow-md ring-2 ring-amber-300"
              : "bg-neutral-800 text-neutral-400 hover:text-white"
          }`}
        >
          {turbo ? "TURBO ON" : "NORMAL 1.0x"}
        </button>
      </div>

      {/* Start Button */}
      <button
        onClick={onStartGame}
        className="w-full py-3.5 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-black font-bold text-base tracking-widest uppercase transition-all shadow-lg hover:shadow-yellow-400/20 active:scale-[0.99] cursor-pointer"
      >
        START GAME
      </button>

      {/* Controls Hint */}
      <div className="text-[11px] text-neutral-400 text-center leading-relaxed border-t border-neutral-800/80 pt-2.5">
        <span>⌨️ Arrows / WASD</span>
        <span className="mx-2">·</span>
        <span>📱 Swipe or On-Screen D-Pad</span>
        <span className="mx-2">·</span>
        <span>🎮 Gamepad Supported</span>
      </div>
    </div>
  );
};
