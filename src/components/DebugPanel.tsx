import React, { useState } from "react";
import type GameEngine from "../game/GameEngine";
import type { GameRunner } from "../game/GameRunner";
import type { DebugLayers } from "../types";
import { DEBUG_LAYER_LABELS } from "../game/debugOverlay";
import { setSetting, settingsChanged, useEngineSettings } from "../hooks/useEngineSettings";

interface DebugPanelProps {
  engine: GameEngine;
  runner: GameRunner | undefined;
  /** Redraw and refresh the HUD after a change (the game is held while the Lab is open). */
  onChange: () => void;
  /** Clip actions shared with the Practice tab: save the last seconds for a bug report. */
  clips?: {
    copyLink: (seconds: number) => Promise<string>;
    download: (seconds: number) => void;
  };
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 flex flex-col gap-1.5">
    <span className="font-bold text-cyan-300">{title}</span>
    {children}
  </section>
);

const Button: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({
  onClick,
  children,
}) => (
  <button
    onClick={onClick}
    className="px-2 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-100"
  >
    {children}
  </button>
);

/**
 * The one Debug panel (plan M6): every debugging and measuring tool in one place. The debug
 * overlay and its layers, pause and frame stepping, the measurements (speeds against the table,
 * tick rate, input latency), the diagnostics rules (and their live console while playing), and
 * saving a clip for a bug report. The Lab holds the game while open, so live numbers are the
 * ones measured during play.
 */
export const DebugPanel: React.FC<DebugPanelProps> = ({ engine, runner, onChange, clips }) => {
  const settings = useEngineSettings(engine);
  const [, rerender] = useState(0);
  const [clipStatus, setClipStatus] = useState("");
  const update = () => {
    rerender((n) => n + 1);
    onChange();
  };

  const layers = settings.debugLayers;
  const toggleLayer = (key: keyof DebugLayers) => {
    setSetting(engine, "debugLayers", { ...layers, [key]: !layers[key] });
    onChange();
  };

  const measure = runner?.measure;
  const speeds = measure?.speedReport() ?? null;
  const latency = runner?.latency.stats ?? null;
  const tickRate = measure?.recentTickRate ?? null;
  const rules = engine.diagnosticController.rules;
  const failing = rules.filter((r) => r.failures > 0);

  const step = (frames: number, until?: () => boolean) => {
    runner?.stepWhilePaused(frames, until);
    update();
  };
  const nextModeChange = () => {
    const wave = engine.timerController.waveIndex;
    const fright = engine.frightenedGlobalTimer > 0;
    step(
      20 * 60 * 60,
      () => engine.timerController.waveIndex !== wave || engine.frightenedGlobalTimer > 0 !== fright
    );
  };

  return (
    <div className="w-full text-[11px] font-mono text-neutral-300 flex flex-col gap-2">
      <Section title="Debug overlay">
        <label className="flex items-center gap-2 cursor-pointer select-none font-bold">
          <input
            type="checkbox"
            checked={settings.debugOverlay}
            onChange={() => {
              setSetting(engine, "debugOverlay", !settings.debugOverlay);
              onChange();
            }}
            className="accent-cyan-500"
          />
          Show the overlay (F1 in dev builds)
        </label>
        <div className="grid grid-cols-2 gap-x-3 pl-1">
          {(Object.keys(DEBUG_LAYER_LABELS) as Array<keyof DebugLayers>).map((key) => (
            <label key={key} className="flex items-center gap-2 py-0.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={layers[key]}
                onChange={() => toggleLayer(key)}
                className="accent-cyan-500"
              />
              {DEBUG_LAYER_LABELS[key]}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Pause and frame stepping">
        <span className="text-neutral-400">
          Held by: {runner?.pausedBy.join(", ") || "nobody"} · tick {engine.tick} · life frame{" "}
          {engine.lifeFrame} · {engine.phase}
        </span>
        <div className="flex flex-wrap gap-1.5">
          <Button onClick={() => step(1)}>Step 1 frame</Button>
          <Button onClick={() => step(60)}>Step 1 s</Button>
          <Button onClick={nextModeChange}>Step to next mode change</Button>
        </div>
      </Section>

      <Section title="Measurements">
        <div className="flex flex-wrap items-center gap-1.5">
          {measure?.recordingSpeeds ? (
            <Button
              onClick={() => {
                measure.stopSpeeds();
                update();
              }}
            >
              Stop recording speeds
            </Button>
          ) : (
            <Button
              onClick={() => {
                measure?.startSpeeds();
                update();
              }}
            >
              Record speeds
            </Button>
          )}
          <span className="text-neutral-400">
            {measure?.recordingSpeeds
              ? "recording: close the Lab and play, then come back"
              : "measured px per frame against the level's speed table"}
          </span>
        </div>
        {speeds && speeds.rows.length > 0 && (
          <table className="w-full text-[10px]">
            <thead className="text-neutral-500">
              <tr>
                <th className="text-left">actor</th>
                <th className="text-left">source</th>
                <th className="text-right">%</th>
                <th className="text-right">frames</th>
                <th className="text-right">measured / table</th>
              </tr>
            </thead>
            <tbody>
              {speeds.rows.map((r) => (
                <tr key={`${r.actor}-${r.source}`}>
                  <td>{r.actor}</td>
                  <td>{r.source}</td>
                  <td className="text-right">{r.pct}</td>
                  <td className="text-right">{r.frames}</td>
                  <td
                    className={`text-right ${Math.abs(r.ratio - 1) > 0.03 ? "text-amber-300" : ""}`}
                  >
                    {r.ratio.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <span className="text-neutral-400">
          Tick rate while playing: {tickRate ?? "–"} /s (target {runner?.ticksPerSecond.toFixed(2)})
          · input latency:{" "}
          {latency
            ? `${latency.last.toFixed(0)} ms (avg ${latency.avg.toFixed(0)}, max ${latency.max.toFixed(0)})`
            : "press a direction while playing"}
        </span>
      </Section>

      <Section title="Diagnostics">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.showDiagnosticConsole}
            onChange={() => {
              setSetting(engine, "showDiagnosticConsole", !settings.showDiagnosticConsole);
              onChange();
            }}
            className="accent-cyan-500"
          />
          Live console while playing (rules, log, actor readout)
        </label>
        <span className="text-neutral-400">
          {rules.length} invariant rules ·{" "}
          {failing.length === 0 ? "none failed" : `${failing.length} failed`}
        </span>
        {failing.map((r) => (
          <span key={r.id} className="text-amber-300">
            {r.name}: {r.failures}× {r.lastFailureMessage ? `(${r.lastFailureMessage})` : ""}
          </span>
        ))}
        {failing.length > 0 && (
          <Button
            onClick={() => {
              for (const r of rules) {
                r.failures = 0;
                r.lastFailureMessage = undefined;
              }
              engine.diagnosticController.acknowledgeDiscrepancies();
              settingsChanged();
              update();
            }}
          >
            Clear failures
          </Button>
        )}
      </Section>

      {clips && (
        <Section title="Bug report">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              onClick={() => {
                clips.download(20);
                setClipStatus("downloaded the last 20 s");
              }}
            >
              Download last 20 s
            </Button>
            <Button
              onClick={() => {
                clips
                  .copyLink(20)
                  .then(setClipStatus)
                  .catch(() => setClipStatus("could not copy the link"));
              }}
            >
              Copy link to last 20 s
            </Button>
            <span className="text-neutral-400">{clipStatus}</span>
          </div>
        </Section>
      )}
    </div>
  );
};
