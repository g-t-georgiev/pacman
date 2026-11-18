import React from "react";

/** Color sets for a switched-on card. Full class names, so Tailwind finds them. */
const TONES = {
  amber: {
    on: "bg-amber-500 text-black shadow-md shadow-amber-500/20 ring-1 ring-amber-300",
    badge: "bg-black/20 text-black",
    hint: "text-black/80",
  },
  cyan: {
    on: "bg-cyan-600 text-white shadow-md shadow-cyan-600/20 ring-1 ring-cyan-400",
    badge: "bg-cyan-900 text-cyan-100",
    hint: "text-cyan-100/90",
  },
  purple: {
    on: "bg-purple-600 text-white shadow-md shadow-purple-600/20 ring-1 ring-purple-400",
    badge: "bg-purple-900 text-purple-100",
    hint: "text-purple-100/90",
  },
  blue: {
    on: "bg-blue-600 text-white shadow-md shadow-blue-600/20 ring-1 ring-blue-400",
    badge: "bg-blue-900 text-blue-100",
    hint: "text-blue-100/90",
  },
  teal: {
    on: "bg-teal-600 text-white shadow-md shadow-teal-600/20 ring-1 ring-teal-300",
    badge: "bg-teal-900 text-teal-100",
    hint: "text-teal-100/90",
  },
} as const;

export type ToggleTone = keyof typeof TONES;

interface ToggleCardProps {
  icon: string;
  label: string;
  /** One line under the label saying what the switch does. */
  hint: string;
  on: boolean;
  onClick: () => void;
  tone: ToggleTone;
}

/** An on/off switch drawn as a card (plan M4: one component for the Lab's toggles). */
export const ToggleCard: React.FC<ToggleCardProps> = ({ icon, label, hint, on, onClick, tone }) => {
  const t = TONES[tone];
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`p-2.5 rounded-lg flex flex-col gap-1 text-left font-semibold transition-all cursor-pointer ${
        on ? t.on : "bg-neutral-900 border border-neutral-800 text-neutral-300 hover:bg-neutral-800"
      }`}
    >
      <div className="flex items-center justify-between w-full">
        <span className="flex items-center gap-1.5">
          <span>{icon}</span>
          <span>{label}</span>
        </span>
        <span
          className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${on ? t.badge : "bg-neutral-800 text-neutral-400"}`}
        >
          {on ? "ON" : "OFF"}
        </span>
      </div>
      <span className={`text-[9px] font-normal leading-tight ${on ? t.hint : "text-neutral-400"}`}>
        {hint}
      </span>
    </button>
  );
};
