import React from "react";

/** Colors per ghost card. Full class names, so Tailwind finds them. */
const LOOKS = {
  BLINKY: { title: "text-red-400", border: "border-red-900/80", target: "text-red-300" },
  PINKY: { title: "text-pink-400", border: "border-pink-900/80", target: "text-pink-300" },
  INKY: { title: "text-cyan-400", border: "border-cyan-900/80", target: "text-cyan-300" },
  CLYDE: { title: "text-amber-400", border: "border-amber-900/80", target: "text-amber-300" },
} as const;

interface GhostCardProps {
  ghost: keyof typeof LOOKS;
  title: string;
  /** Shown at the top right (a mode badge, a label). */
  badge: React.ReactNode;
  /** How this ghost picks its target. */
  children: React.ReactNode;
  /** The ghost's target tile, as text. */
  target: string;
  /** The ghost's cues are drawn on the maze. */
  active: boolean;
}

/** One ghost's card in the Learn tab (plan M4: the four cards were copies). */
export const GhostCard: React.FC<GhostCardProps> = ({
  ghost,
  title,
  badge,
  children,
  target,
  active,
}) => {
  const look = LOOKS[ghost];
  return (
    <div
      className={`p-2 rounded-lg bg-neutral-900/80 border flex flex-col gap-1 transition-opacity ${
        active ? look.border : "border-neutral-800 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between">
        <span className={`${look.title} font-bold text-[11px]`}>{title}</span>
        {badge}
      </div>
      <p className="text-[10px] text-neutral-400 leading-tight">{children}</p>
      <div className={`text-[10px] ${look.target}`}>Target: {target}</div>
    </div>
  );
};
