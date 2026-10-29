import React from "react";
import type { Direction } from "../types";

interface VirtualDpadProps {
  onDirection: (dir: Direction) => void;
  currentDir: Direction;
}

export const VirtualDpad: React.FC<VirtualDpadProps> = ({ onDirection, currentDir }) => {
  const triggerDir = (dir: Direction) => {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      try {
        navigator.vibrate(12);
      } catch {
        // ignore
      }
    }
    onDirection(dir);
  };

  return (
    <div className="flex flex-col items-center justify-center p-2 select-none touch-none">
      {/* Up Button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          triggerDir("UP");
        }}
        className={`w-14 h-12 rounded-t-xl bg-neutral-800 border-t-2 border-x-2 border-neutral-700 flex items-center justify-center text-lg active:bg-yellow-500 active:text-black active:scale-95 transition-all ${
          currentDir === "UP" ? "bg-yellow-400 text-black border-yellow-300" : "text-neutral-300"
        }`}
        aria-label="Move Up"
      >
        ▲
      </button>

      {/* Middle Row: Left, Center, Right */}
      <div className="flex items-center">
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            triggerDir("LEFT");
          }}
          className={`w-14 h-12 rounded-l-xl bg-neutral-800 border-l-2 border-y-2 border-neutral-700 flex items-center justify-center text-lg active:bg-yellow-500 active:text-black active:scale-95 transition-all ${
            currentDir === "LEFT" ? "bg-yellow-400 text-black border-yellow-300" : "text-neutral-300"
          }`}
          aria-label="Move Left"
        >
          ◀
        </button>

        {/* Center Pivot */}
        <div className="w-12 h-12 bg-neutral-900 border border-neutral-800 flex items-center justify-center">
          <div className="w-3.5 h-3.5 rounded-full bg-neutral-700"></div>
        </div>

        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            triggerDir("RIGHT");
          }}
          className={`w-14 h-12 rounded-r-xl bg-neutral-800 border-r-2 border-y-2 border-neutral-700 flex items-center justify-center text-lg active:bg-yellow-500 active:text-black active:scale-95 transition-all ${
            currentDir === "RIGHT" ? "bg-yellow-400 text-black border-yellow-300" : "text-neutral-300"
          }`}
          aria-label="Move Right"
        >
          ▶
        </button>
      </div>

      {/* Down Button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          triggerDir("DOWN");
        }}
        className={`w-14 h-12 rounded-b-xl bg-neutral-800 border-b-2 border-x-2 border-neutral-700 flex items-center justify-center text-lg active:bg-yellow-500 active:text-black active:scale-95 transition-all ${
          currentDir === "DOWN" ? "bg-yellow-400 text-black border-yellow-300" : "text-neutral-300"
        }`}
        aria-label="Move Down"
      >
        ▼
      </button>
    </div>
  );
};
