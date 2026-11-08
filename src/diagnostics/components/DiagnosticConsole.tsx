import React, { useEffect, useRef, useState } from "react";
import type GameEngine from "@/src/game/GameEngine";
import type { GhostType } from "@/src/types";
import type { DiagnosticData } from "@/src/diagnostics/DiagnosticController";
import GameEvents from "@/src/core/EventBus";
import { useGameEvent } from "@/src/hooks/useGameEvent";
import { SIM_FPS } from "@/src/game/constants";

interface DiagnosticConsoleProps {
  engine: GameEngine;
  onClose?: () => void;
}

export const DiagnosticConsole: React.FC<DiagnosticConsoleProps> = ({ engine, onClose }) => {
  const [isCollapsed, setIsCollapsed] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"INSPECTOR" | "RULES" | "LOGS">("INSPECTOR");
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number }>({
    startX: 0,
    startY: 0,
    origX: 20,
    origY: 80,
  });

  // Subscribe to live DIAGNOSTICS_TICK game events instead of polling
  const ghostStats = useGameEvent<DiagnosticData>(GameEvents, "DIAGNOSTICS_TICK", () =>
    engine.getActorsDiagnostics()
  );

  // Mouse dragging handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.startX;
      const dy = e.clientY - dragStartRef.current.startY;
      setPos({
        x: Math.max(10, Math.min(window.innerWidth - 380, dragStartRef.current.origX + dx)),
        y: Math.max(10, Math.min(window.innerHeight - 200, dragStartRef.current.origY + dy)),
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, pos]);

  const diag = engine.diagnosticController;
  const hasDiscrepancy = diag?.hasDiscrepancy;

  const handleToggleCollapse = () => {
    if (isCollapsed && diag) {
      diag.acknowledgeDiscrepancies();
    }
    setIsCollapsed(!isCollapsed);
  };

  if (isCollapsed) {
    return (
      <div style={{ left: `${pos.x}px`, top: `${pos.y}px` }} className="fixed z-50 select-none">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-bold shadow-2xl backdrop-blur-md transition-all border ${
            hasDiscrepancy
              ? "bg-red-950/95 border-red-500 text-red-200 animate-pulse ring-2 ring-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.8)]"
              : "bg-neutral-900/90 border-cyan-500/50 text-cyan-300 hover:border-cyan-400"
          }`}
        >
          <div className="flex items-center gap-2 cursor-pointer" onClick={handleToggleCollapse}>
            <span>{hasDiscrepancy ? "⚠️" : "🛠️"}</span>
            <span>DIAGNOSTICS</span>
            {hasDiscrepancy && (
              <span className="bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                {diag?.unreadDiscrepancies}
              </span>
            )}
            <span className="text-[10px] text-neutral-400">▼</span>
          </div>
          {onClose && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="ml-1 w-4 h-4 flex items-center justify-center rounded-full hover:bg-neutral-800 text-neutral-400 hover:text-red-300 text-[10px] transition-colors"
              title="Close"
              aria-label="Close diagnostics console"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  const ghostList: GhostType[] = ["BLINKY", "PINKY", "INKY", "CLYDE"];

  return (
    <div
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      className="fixed z-50 w-[420px] max-w-[calc(100vw-30px)] bg-neutral-950/95 border-2 border-cyan-600/80 rounded-xl shadow-2xl backdrop-blur-md text-xs font-mono text-neutral-200 flex flex-col select-none ring-1 ring-cyan-500/20 overflow-hidden"
    >
      {/* Draggable Header */}
      <div
        onMouseDown={handleMouseDown}
        className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-cyan-950 to-neutral-900 border-b border-cyan-800/60 cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-2">
          <span className="text-cyan-400">🛠️</span>
          <span className="font-bold tracking-wider text-cyan-300">DIAGNOSTIC CONSOLE</span>
          {hasDiscrepancy && (
            <span className="bg-red-600 text-white text-[9px] font-bold px-1.5 rounded animate-pulse">
              ALERT
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              handleToggleCollapse();
            }}
            className="w-5 h-5 flex items-center justify-center rounded hover:bg-neutral-800 text-neutral-400 hover:text-white"
            title="Collapse"
            aria-label="Collapse diagnostics console"
          >
            _
          </button>
          {onClose && (
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-red-900/60 text-neutral-400 hover:text-red-300"
              title="Close"
              aria-label="Close diagnostics console"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-800 bg-neutral-900/50 text-[11px]">
        <button
          type="button"
          onClick={() => setActiveTab("INSPECTOR")}
          className={`flex-1 py-1.5 text-center font-bold transition-colors ${
            activeTab === "INSPECTOR"
              ? "text-cyan-300 border-b-2 border-cyan-400 bg-cyan-950/30"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Inspector
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("RULES")}
          className={`flex-1 py-1.5 text-center font-bold transition-colors flex items-center justify-center gap-1 ${
            activeTab === "RULES"
              ? "text-cyan-300 border-b-2 border-cyan-400 bg-cyan-950/30"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Rules
          {diag?.rules.some((r) => r.failures > 0) && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("LOGS")}
          className={`flex-1 py-1.5 text-center font-bold transition-colors ${
            activeTab === "LOGS"
              ? "text-cyan-300 border-b-2 border-cyan-400 bg-cyan-950/30"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Logs ({diag?.logs.length || 0})
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-3 max-h-[360px] overflow-y-auto space-y-2.5">
        {/* Tab 1: Inspector */}
        {activeTab === "INSPECTOR" && (
          <div className="space-y-2">
            {/* Quick Metrics */}
            <div className="grid grid-cols-4 gap-1.5 bg-neutral-900/80 p-2 rounded-lg border border-neutral-800 text-[10px]">
              <div>
                <span className="text-neutral-400 block">Level / Frame:</span>
                <span className="text-white font-bold">
                  L{ghostStats.level} / #{ghostStats.frame ?? 0}
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Wave / Timer:</span>
                <span className="text-yellow-400 font-bold">
                  {ghostStats.wave} ({(ghostStats.waveTimer / SIM_FPS).toFixed(1)}s)
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Fright Timer:</span>
                <span
                  className={
                    ghostStats.frightenedTimer > 0
                      ? "text-blue-400 font-bold animate-pulse"
                      : "text-neutral-500 font-bold"
                  }
                >
                  {ghostStats.frightenedTimer.toFixed(1)}s
                </span>
              </div>
              <div>
                <span className="text-neutral-400 block">Eat Freeze:</span>
                <span
                  className={
                    (ghostStats.pacman.eatingFreezeFrames ?? 0) > 0
                      ? "text-amber-400 font-bold animate-pulse"
                      : "text-neutral-500 font-bold"
                  }
                >
                  {(ghostStats.pacman.eatingFreezeFrames ?? 0) > 0
                    ? `${ghostStats.pacman.eatingFreezeFrames} frame`
                    : "0f"}
                </span>
              </div>
            </div>

            {/* Actor Details Table with Integer Tile Occupancy & Seam Descent */}
            <div className="border border-neutral-800 rounded-lg overflow-hidden bg-neutral-900/40 text-[10px]">
              <div className="grid grid-cols-6 bg-neutral-900 p-1.5 font-bold text-neutral-400 border-b border-neutral-800 text-center">
                <span>Actor</span>
                <span>Px (X,Y)</span>
                <span>Tile</span>
                <span>Dir</span>
                <span>Speed</span>
                <span>Target / State</span>
              </div>
              {/* Pacman */}
              <div className="grid grid-cols-6 p-1.5 border-b border-neutral-800/60 items-center text-center text-yellow-300">
                <span className="font-bold">PACMAN</span>
                <span>
                  {Math.floor(ghostStats.pacman.x)}, {Math.floor(ghostStats.pacman.y)}
                </span>
                <span className="text-yellow-400 font-mono">
                  [{ghostStats.pacman.tileCol},{ghostStats.pacman.tileRow}]
                </span>
                <span>{ghostStats.pacman.dir}</span>
                <span>{ghostStats.pacman.speed}px</span>
                <span>
                  {(ghostStats.pacman.eatingFreezeFrames ?? 0) > 0 ? (
                    <span className="bg-amber-900/80 text-amber-300 px-1 py-0.5 rounded text-[9px] font-bold">
                      FREEZE {ghostStats.pacman.eatingFreezeFrames}f
                    </span>
                  ) : (
                    <span className="text-emerald-400">ACTIVE</span>
                  )}
                </span>
              </div>
              {/* Ghosts */}
              {ghostList.map((type) => {
                const ghost = ghostStats[type.toLowerCase() as Lowercase<GhostType>];

                if (!ghost) return null;

                const isEatenDescent =
                  ghost.aiMode === "EATEN" &&
                  ghost.enteringHousePhase &&
                  ghost.enteringHousePhase !== "NONE";

                return (
                  <div
                    key={type}
                    className="grid grid-cols-6 p-1.5 border-b border-neutral-800/40 items-center text-center"
                  >
                    <span className="font-bold text-neutral-300">{type}</span>
                    <span className="text-neutral-400">
                      {Math.floor(ghost.x)}, {Math.floor(ghost.y)}
                    </span>
                    <span className="text-cyan-300 font-mono">
                      [{ghost.tileCol},{ghost.tileRow}]
                    </span>
                    <span className="text-cyan-400">{ghost.dir}</span>
                    <span className="text-amber-400">{ghost.speed}px</span>
                    <span className="text-neutral-300 truncate px-0.5">
                      {ghost.inHouse ? (
                        <span className="text-pink-400 font-semibold">HOUSE</span>
                      ) : isEatenDescent ? (
                        <span className="text-cyan-300 font-bold bg-cyan-950 px-1 py-0.5 rounded text-[8.5px]">
                          {ghost.enteringHousePhase === "APPROACH_SEAM"
                            ? "TO SEAM"
                            : ghost.enteringHousePhase === "DESCENDING_DOOR"
                              ? "DOOR DOWN"
                              : "TO SLOT"}
                        </span>
                      ) : ghost.aiMode === "EATEN" ? (
                        <span className="text-cyan-400 font-semibold">
                          DOOR [{ghost.targetTile.col},{ghost.targetTile.row}]
                        </span>
                      ) : (
                        <span>
                          [{ghost.targetTile.col},{ghost.targetTile.row}]
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 2: Rules (Live Invariants) */}
        {activeTab === "RULES" && (
          <div className="space-y-2">
            <div className="text-[10px] text-neutral-400 mb-1">
              Toggle live invariant assertions checked during gameplay:
            </div>
            {diag?.rules.map((rule) => (
              <div
                key={rule.id}
                className={`p-2 rounded-lg border flex flex-col gap-1 transition-colors ${
                  rule.failures > 0
                    ? "bg-red-950/40 border-red-700/60"
                    : "bg-neutral-900/60 border-neutral-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-[11px] text-white">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={() => diag.toggleRule(rule.id)}
                      className="rounded accent-cyan-500"
                    />
                    <span>{rule.name}</span>
                  </label>
                  <div className="flex items-center gap-1.5 text-[9px]">
                    <span className="text-emerald-400 font-bold">✓ {rule.passes}</span>
                    {rule.failures > 0 && (
                      <span className="text-red-400 font-bold bg-red-950 px-1 rounded">
                        ✗ {rule.failures}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[9px] text-neutral-400 pl-5">{rule.description}</p>
                {rule.lastFailureMessage && (
                  <div className="text-[9px] text-red-300 bg-red-950/80 p-1 rounded border border-red-800/40 mt-0.5">
                    Last failure: {rule.lastFailureMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Event Logs */}
        {activeTab === "LOGS" && (
          <div className="space-y-1.5">
            <div className="flex justify-between items-center pb-1 border-b border-neutral-800">
              <span className="text-[10px] text-neutral-400">Recent telemetry events:</span>
              <button
                type="button"
                onClick={() => diag?.clearLogs()}
                className="px-2 py-0.5 bg-neutral-800 hover:bg-neutral-700 rounded text-[9px] text-neutral-300"
              >
                Clear
              </button>
            </div>
            {diag?.logs.length === 0 ? (
              <div className="text-center py-4 text-neutral-500 text-[10px]">
                No events logged yet
              </div>
            ) : (
              diag?.logs.slice(0, 50).map((log) => (
                <div
                  key={log.id}
                  className={`p-1.5 rounded text-[9px] border leading-tight ${
                    log.type === "ASSERTION_FAIL"
                      ? "bg-red-950/50 border-red-700/60 text-red-200"
                      : log.type === "WARN"
                        ? "bg-amber-950/30 border-amber-800/40 text-amber-200"
                        : "bg-neutral-900/60 border-neutral-800 text-neutral-300"
                  }`}
                >
                  <div className="flex justify-between text-[8px] opacity-70 mb-0.5">
                    <span>{log.timestamp}</span>
                    <span>Frame #{log.frame}</span>
                  </div>
                  <div>{log.message}</div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};
