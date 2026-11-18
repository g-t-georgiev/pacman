import type { Direction, GameMode } from "../types";
import React, { useEffect, useRef, useState } from "react";
import soundEngine from "../audio/SoundEngine";
import { CANVAS_HEIGHT, CANVAS_WIDTH, arcadeFont } from "../game/constants";
import GameEvents from "../core/EventBus";
import GameEngine from "../game/GameEngine";
import { GameRunner } from "../game/GameRunner";
import { AgentDriver } from "../agent/AgentDriver";
import GameRenderer from "../game/GameRenderer";
import { HighScoresModal, getStoredHighScores } from "./HighScoresModal";
import { HUD } from "./HUD";
import { ModeSelector } from "./ModeSelector";
import { PanelTransitionWrapper } from "./PanelTransitionWrapper";
import { LabPanel } from "./LabPanel";
import { ReplayBar } from "./ReplayBar";
import { decodeReplay, replayCodeFromHash } from "../game/replayShare";
import { RULESETS } from "../game/rulesets";
import { type RulesPreset, applyRulesPreset } from "../game/presets";
import {
  PREF_COLORBLIND,
  PREF_PRESET,
  PREF_REDUCED_FLASH,
  PREF_RELEASE,
  loadPreference,
  savePreference,
} from "../utils/preferences";
import { type KeyBindings, loadBindings, saveBindings } from "../utils/keyBindings";
import { OptionsPanel } from "./OptionsPanel";
import { RestartPanel } from "./RestartPanel";
import { VirtualDpad } from "./VirtualDpad";
import { DiagnosticConsole } from "../diagnostics/components/DiagnosticConsole";
import { DocsPage, openDocs } from "./DocsPage";
import { CHAPTERS, parseDocsHash, type DocsRoute } from "../docs/manual";
import { useGameEvent } from "../hooks/useGameEvent";
import { setSetting, settingsChanged, useSettingsVersion } from "../hooks/useEngineSettings";
import { usePanels } from "../hooks/usePanels";
import { useGameOver } from "../hooks/useGameOver";
import { useReplays } from "../hooks/useReplays";
import { useGameInput } from "../hooks/useGameInput";

/**
 * The game screen (plan M3): creates the session (engine, runner, renderer) and wires the hooks
 * (panels, game over, replays, input) to the markup. Settings are read from the engine itself.
 */
export const ArcadeCabinet: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const runnerRef = useRef<GameRunner | null>(null);

  const scoreData = useGameEvent(GameEvents, "SCORE_CHANGED", () => {
    const stored = getStoredHighScores();
    const highest = stored.length > 0 ? stored[0].score : 10000;
    return { score: 0, highScore: highest };
  });
  const level = useGameEvent(GameEvents, "LEVEL_CHANGED", () => 1);
  const playState = useGameEvent(GameEvents, "PLAY_STATE_CHANGED", () => "READY");

  const [, setUiTick] = useState(0);
  const refresh = () => setUiTick((t) => t + 1);

  // UI-only state; everything that is a game setting is read from the engine below (O2)
  const [currentMode, setCurrentMode] = useState<GameMode>("PACMAN");
  const [rulesPreset, setRulesPreset] = useState<RulesPreset>(
    () => loadPreference<RulesPreset>(PREF_PRESET) ?? "ARCADE"
  );
  const [showDpad, setShowDpad] = useState(false);
  const [bindings, setBindings] = useState<KeyBindings>(() => loadBindings());
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  useSettingsVersion(); // re-render when a setting changes
  const engine = engineRef.current;
  const turbo = engine?.rules.turbo ?? false;
  const soundEnabled = engine?.settings.soundEnabled ?? true;
  const crtFilter = engine?.settings.crtFilter ?? false;
  const learnVisualsActive = engine?.settings.learnVisualsEnabled ?? false;
  const showDiagnostics = engine?.settings.showDiagnosticConsole ?? false;
  const releaseClears = engine?.settings.releaseClearsBuffer ?? false;
  const reducedFlash = engine?.settings.reducedFlash ?? false;
  const colorblindPalette = engine?.settings.colorblindPalette ?? false;

  const panels = usePanels(engineRef, runnerRef, refresh);
  const gameOver = useGameOver(engineRef, runnerRef, panels.setShowRestartPanel);
  const replays = useReplays(engineRef, runnerRef, panels.closeLab, refresh);

  const handleToggleTurbo = () => {
    const e = engineRef.current;
    if (!e) return;
    e.rules.turbo = !e.rules.turbo;
    settingsChanged();
  };

  // The manual (DOC1): open while the URL is a docs link (#docs/...), holding the game
  const [docsRoute, setDocsRoute] = useState<DocsRoute | null>(() => parseDocsHash(location.hash));
  const docsOpenRef = useRef(docsRoute !== null);
  docsOpenRef.current = docsRoute !== null;
  useEffect(() => {
    const onHash = () => setDocsRoute(parseDocsHash(location.hash));
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    runnerRef.current?.setPaused("docs", docsRoute !== null);
    refresh();
  }, [docsRoute]);
  const closeDocs = () => {
    history.replaceState(null, "", location.pathname + location.search);
    setDocsRoute(null);
  };

  const input = useGameInput(engineRef, runnerRef, bindingsRef, {
    docsOpen: () => docsOpenRef.current,
    anyPanelOpen: () => panels.anyPanelOpenRef.current,
    labOpen: () => panels.labRef.current !== null,
    togglePause: panels.togglePause,
    closeAllPanels: panels.closeAllPanels,
    toggleLab: panels.toggleLab,
    toggleTurbo: handleToggleTurbo,
    exitReplay: replays.exitReplay,
    refresh,
  });

  // The agent driver edits state between ticks: re-render what reads the engine directly
  useEffect(() => {
    const onUiSync = () => refresh();
    GameEvents.on("UI_SYNC", onUiSync);
    return () => GameEvents.off("UI_SYNC", onUiSync);
  }, []);

  // The session: engine, runner and renderer, created once on mount
  useEffect(() => {
    const stored = getStoredHighScores();
    const highest = stored.length > 0 ? stored[0].score : 10000;

    const engine = new GameEngine("PACMAN", highest);
    engineRef.current = engine;
    // The player's remembered rules preset, joystick feel and display options
    const preset = loadPreference<RulesPreset>(PREF_PRESET);
    if (preset === "ARCADE" || preset === "MODERN") applyRulesPreset(engine, preset);
    engine.settings.releaseClearsBuffer = loadPreference<boolean>(PREF_RELEASE) === true;
    engine.settings.reducedFlash = loadPreference<boolean>(PREF_REDUCED_FLASH) === true;
    engine.settings.colorblindPalette = loadPreference<boolean>(PREF_COLORBLIND) === true;
    engine.replayLog.reset(engine); // the recording starts with these settings
    const runner = new GameRunner(engine);
    runnerRef.current = runner;
    if (docsOpenRef.current) runner.setPaused("docs", true); // opened on a docs link

    // Touch devices get the on-screen D-pad
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) setShowDpad(true);

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) {
      // High DPI
      const dpr = window.devicePixelRatio || 1;
      canvas.width = CANVAS_WIDTH * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
      ctx.scale(dpr, dpr);
      const renderer = new GameRenderer(ctx);
      rendererRef.current = renderer;
      runner.renderer = renderer;
      renderer.practice = runner.practice;
      renderer.latency = runner.latency;
      renderer.popups = runner.popups;
    }

    // Gamepads are polled before every tick
    runner.onPreUpdate = () => input.pollGamepads(engine);

    // Load the canvas pixel font now (canvas text alone does not trigger @font-face loading)
    void document.fonts?.load(arcadeFont(16));

    runner.start();

    // A new engine (first load, or a dev-server reload) starts with every panel closed
    panels.setLab(null);
    panels.setShowRestartPanel(false);
    panels.setShowMenu(false);
    panels.setShowHighScores(false);
    settingsChanged(); // the settings above now come from the engine

    // A replay link (#replay=...) opens the viewer (T12)
    const code = replayCodeFromHash(location.hash);
    if (code) {
      decodeReplay(code)
        .then((replay) => {
          runner.viewer.start(replay);
          refresh();
        })
        .catch((error: unknown) => console.warn("Could not open the replay link:", error));
    }

    // Dev builds: the agent driver for automated play-testing from the console or tools
    if (import.meta.env.DEV) window.pacmanAgent = new AgentDriver(engine, runner);

    return () => {
      runner.stop();
      if (import.meta.env.DEV) delete window.pacmanAgent;
      soundEngine.stopSiren();
    };
    // Once per mount: the hooks' functions read refs, so the first ones stay valid
  }, []);

  // --- Actions ---

  const handleSelectMode = (mode: GameMode) => {
    setCurrentMode(mode);
    if (!engineRef.current) return;
    soundEngine.stopSiren();
    engineRef.current.initGame(mode, 1);
    runnerRef.current?.setPaused("user", false); // a new game starts running
    panels.setShowMenu(false);
    panels.setShowRestartPanel(false);
    gameOver.setIsGameOver(false);
  };

  /** Redraws the (held) game so a display option shows at once behind the panel. */
  const redraw = () => {
    const runner = runnerRef.current;
    if (runner && engineRef.current) runner.renderer?.render(engineRef.current);
  };

  // Rules preset and joystick feel (Phase 5), remembered in this browser
  const handleSelectPreset = (preset: RulesPreset) => {
    const e = engineRef.current;
    if (!e) return;
    applyRulesPreset(e, preset);
    setRulesPreset(preset);
    savePreference(PREF_PRESET, preset);
    settingsChanged();
  };

  const handleToggleReleaseClears = () => {
    const e = engineRef.current;
    if (!e) return;
    setSetting(e, "releaseClearsBuffer", !e.settings.releaseClearsBuffer);
    savePreference(PREF_RELEASE, e.settings.releaseClearsBuffer);
  };

  const handleToggleSound = () => {
    const e = engineRef.current;
    if (!e) return;
    setSetting(e, "soundEnabled", !e.settings.soundEnabled);
    soundEngine.setEnabled(e.settings.soundEnabled);
  };

  const handleToggleCrt = () => {
    const e = engineRef.current;
    if (e) setSetting(e, "crtFilter", !e.settings.crtFilter);
  };

  const toggleDisplayOption = (key: "reducedFlash" | "colorblindPalette", pref: string) => {
    const e = engineRef.current;
    if (!e) return;
    setSetting(e, key, !e.settings[key]);
    savePreference(pref, e.settings[key]);
    redraw();
  };

  const handleRestartLevel = () => {
    if (!engineRef.current) return;
    gameOver.cancelDelayedPanel();
    engineRef.current.restartLevel(engineRef.current.level);
    runnerRef.current?.setPaused("user", false);
    panels.setShowRestartPanel(false);
    gameOver.setIsGameOver(false);
  };

  const handleNewGame = () => {
    if (!engineRef.current) return;
    gameOver.cancelDelayedPanel();
    engineRef.current.initGame(currentMode, 1);
    runnerRef.current?.setPaused("user", false);
    panels.setShowRestartPanel(false);
    gameOver.setIsGameOver(false);
  };

  const handleOpenRestartPanel = () => {
    const isOver = gameOver.isGameOver || engineRef.current?.playState === "GAME_OVER";
    gameOver.setIsGameOver(isOver);
    panels.setShowRestartPanel(true);
  };

  const { lab } = panels;

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-between p-2 sm:p-4 selection:bg-yellow-500 selection:text-black font-sans">
      {/* Top Navbar */}
      <header className="w-full max-w-4xl flex items-center justify-between gap-4 py-2 px-3 border-b border-neutral-800 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="text-base">🕹️</span>
          <span className="font-bold tracking-wider text-white text-sm">PAC-MAN ARCADE LAB</span>
          <span className="hidden sm:inline text-neutral-400">·</span>
          <span className="hidden sm:inline text-neutral-400">
            {RULESETS[currentMode].shortTitle}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => openDocs({ chapter: CHAPTERS[0]?.slug ?? "", anchor: null })}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
            title="The manual: how to play, how it works, tools and API (the game waits)"
          >
            <span>📖 Manual</span>
          </button>
          <button
            onClick={() => panels.setShowMenu(true)}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>🎮 Game Modes</span>
          </button>
          <button
            onClick={() => panels.setShowOptions(true)}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>⚙️ Options</span>
          </button>
          <button
            onClick={() => panels.setShowHighScores(true)}
            className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>🏆 Scores</span>
          </button>
        </div>
      </header>

      {/* Main Arcade Frame */}
      <main className="w-full flex-1 flex flex-col items-center justify-center my-2 max-w-2xl">
        <HUD
          turbo={turbo}
          onToggleTurbo={handleToggleTurbo}
          labOpen={lab !== null}
          onToggleLab={() => panels.toggleLab(panels.labRef.current ?? "LEARN")}
          learnVisualsEnabled={learnVisualsActive}
          paused={playState === "PAUSED"}
          pausedBy={runnerRef.current?.pausedBy ?? []}
          onTogglePause={panels.togglePause}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          crtFilter={crtFilter}
          onToggleCrt={handleToggleCrt}
          onOpenRestart={handleOpenRestartPanel}
          restartPanelOpen={panels.showRestartPanel}
          isGameOver={gameOver.isGameOver}
        />

        {/* Canvas Screen Container */}
        <div
          ref={containerRef}
          onTouchStart={input.onTouchStart}
          onTouchEnd={input.onTouchEnd}
          className="relative w-full max-w-[480px] aspect-[28/36] bg-black border-x border-neutral-800 flex items-center justify-center overflow-hidden shadow-2xl"
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
            className="block"
          />
        </div>

        {runnerRef.current?.viewer.state.active && (
          <ReplayBar runner={runnerRef.current} onExit={replays.exitReplay} />
        )}

        {/* Below the screen: lives and fruit are drawn in the maze's bottom rows now (T13) */}
        <div className="w-full max-w-[480px] bg-neutral-900 border border-neutral-800 rounded-b-xl px-4 py-2 flex items-center justify-end text-xs text-neutral-400 select-none">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDpad(!showDpad)}
              className={`text-[11px] px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                showDpad
                  ? "bg-yellow-400 text-black font-bold"
                  : "bg-neutral-800 text-neutral-400 hover:text-white"
              }`}
            >
              {showDpad ? "Hide D-Pad" : "Show D-Pad"}
            </button>
          </div>
        </div>

        {/* On-Screen Virtual D-pad (for mobile / touch devices) */}
        {showDpad && engineRef.current && (
          <div className="mt-3">
            <VirtualDpad
              onDirection={(dir: Direction) => engineRef.current?.setInputDirection(dir)}
              currentDir={engineRef.current.pacman.dir}
            />
          </div>
        )}
      </main>

      {/* Restart Game Panel Modal */}
      <PanelTransitionWrapper
        panelId="RESTART_PANEL"
        isOpen={panels.showRestartPanel}
        onClose={() => panels.setShowRestartPanel(false)}
      >
        <RestartPanel
          score={scoreData.score}
          highScore={scoreData.highScore}
          level={level}
          mode={currentMode}
          isGameOver={gameOver.isGameOver}
          onRestartLevel={handleRestartLevel}
          onNewGame={handleNewGame}
          onChangeMode={() => {
            panels.setShowRestartPanel(false);
            panels.setShowMenu(true);
          }}
          onClose={() => panels.setShowRestartPanel(false)}
        />
      </PanelTransitionWrapper>

      {/* Lab: Learn, Practice and (dev) Debug tabs in one panel (T11) */}
      <PanelTransitionWrapper panelId="LAB_PANEL" isOpen={lab !== null} onClose={panels.closeLab}>
        {engineRef.current && lab && (
          <LabPanel
            engine={engineRef.current}
            tab={lab}
            onTab={panels.setLab}
            onClose={panels.closeLab}
            onUpdate={() => {
              const e = engineRef.current;
              if (!e) return;
              GameEvents.emit("SCORE_CHANGED", { score: e.score, highScore: e.highScore });
              runnerRef.current?.renderer?.render(e);
              refresh();
            }}
            onVisualSettingsChange={settingsChanged}
            practice={runnerRef.current?.practice}
            runner={runnerRef.current ?? undefined}
            clips={replays.clips}
          />
        )}
      </PanelTransitionWrapper>

      {/* Mode Selector Modal */}
      <PanelTransitionWrapper
        panelId="MODE_SELECTOR"
        isOpen={panels.showMenu}
        onClose={() => panels.setShowMenu(false)}
      >
        <div className="relative">
          <ModeSelector
            rulesPreset={rulesPreset}
            onSelectPreset={handleSelectPreset}
            releaseClears={releaseClears}
            onToggleReleaseClears={handleToggleReleaseClears}
            currentMode={currentMode}
            onSelectMode={handleSelectMode}
            turbo={turbo}
            onToggleTurbo={handleToggleTurbo}
            onStartGame={() => {
              panels.setShowMenu(false);
              if (gameOver.isGameOver) handleNewGame();
            }}
          />
          <button
            onClick={() => panels.setShowMenu(false)}
            className="absolute top-4 right-4 text-neutral-400 hover:text-white p-2 text-sm font-bold cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      </PanelTransitionWrapper>

      {/* Options (Phase 5: keys, reduced flashing, colorblind-safe colors) */}
      <PanelTransitionWrapper
        panelId="OPTIONS"
        isOpen={panels.showOptions}
        onClose={() => panels.setShowOptions(false)}
      >
        <OptionsPanel
          bindings={bindings}
          onChangeBindings={(next) => {
            setBindings(next);
            saveBindings(next);
          }}
          reducedFlash={reducedFlash}
          onToggleReducedFlash={() => toggleDisplayOption("reducedFlash", PREF_REDUCED_FLASH)}
          colorblindPalette={colorblindPalette}
          onToggleColorblindPalette={() =>
            toggleDisplayOption("colorblindPalette", PREF_COLORBLIND)
          }
          onClose={() => panels.setShowOptions(false)}
        />
      </PanelTransitionWrapper>

      {/* High Scores Modal */}
      <PanelTransitionWrapper
        panelId="HIGH_SCORES"
        isOpen={panels.showHighScores}
        onClose={() => {
          panels.setShowHighScores(false);
          gameOver.setPendingScore(null);
        }}
      >
        <HighScoresModal
          pendingNewScore={gameOver.pendingScore}
          onScoreSubmitted={() => gameOver.setPendingScore(null)}
          onClose={() => {
            panels.setShowHighScores(false);
            gameOver.setPendingScore(null);
          }}
        />
      </PanelTransitionWrapper>

      {/* Floating Interactive Diagnostic & Invariants Console HUD */}
      {engineRef.current && showDiagnostics && (
        <DiagnosticConsole
          engine={engineRef.current}
          onClose={() => {
            const e = engineRef.current;
            if (e) setSetting(e, "showDiagnosticConsole", false);
          }}
        />
      )}

      {/* The manual, over everything; the game waits behind it */}
      {docsRoute && <DocsPage route={docsRoute} onClose={closeDocs} />}

      {/* Footer Info */}
      <footer className="w-full max-w-4xl py-2 px-3 border-t border-neutral-900 text-center text-[11px] text-neutral-500 font-mono">
        <span>Pac-Man Arcade &copy; 1980 Namco / Midway</span>
      </footer>
    </div>
  );
};
