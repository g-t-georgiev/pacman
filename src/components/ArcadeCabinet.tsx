import type { Direction, GameMode, PlayState } from "../types";
import React, { useEffect, useRef, useState } from "react";
import soundEngine from "../audio/SoundEngine";
import { uiConfig } from "../config/ui.config";
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
import { LabPanel, type LabTab } from "./LabPanel";
import { ReplayBar } from "./ReplayBar";
import type { Replay } from "../game/replay";
import { decodeReplay, replayCodeFromHash, replayLink } from "../game/replayShare";
import { RULESETS } from "../game/rulesets";
import { type RulesPreset, applyRulesPreset, rulesPresetOf } from "../game/presets";
import {
  PREF_COLORBLIND,
  PREF_PRESET,
  PREF_REDUCED_FLASH,
  PREF_RELEASE,
  loadPreference,
  savePreference,
} from "../utils/preferences";
import {
  type KeyBindings,
  directionForKey,
  loadBindings,
  saveBindings,
} from "../utils/keyBindings";
import { OptionsPanel } from "./OptionsPanel";
import { RestartPanel } from "./RestartPanel";
import { VirtualDpad } from "./VirtualDpad";
import { DiagnosticConsole } from "../diagnostics/components/DiagnosticConsole";
import { useGameEvent } from "../hooks/useGameEvent";

export const ArcadeCabinet: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Engine & Renderer instances
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const runnerRef = useRef<GameRunner | null>(null);

  // Decoupled reactive state subscriptions via EventBus
  const scoreData = useGameEvent(GameEvents, "SCORE_CHANGED", () => {
    const stored = getStoredHighScores();
    const highest = stored.length > 0 ? stored[0].score : 10000;
    return { score: 0, highScore: highest };
  });
  const level = useGameEvent(GameEvents, "LEVEL_CHANGED", () => 1);

  const score = scoreData.score;
  const highScore = scoreData.highScore;

  // UI state for reactive modals and controls
  const [currentMode, setCurrentMode] = useState<GameMode>("PACMAN");
  const [turbo, setTurbo] = useState<boolean>(false);
  const [rulesPreset, setRulesPreset] = useState<RulesPreset | "CUSTOM">(
    () => loadPreference<RulesPreset>(PREF_PRESET) ?? "ARCADE"
  );
  const [releaseClears, setReleaseClears] = useState<boolean>(
    () => loadPreference<boolean>(PREF_RELEASE) ?? false
  );
  /** The Lab panel (Learn / Practice / Debug tabs), or null when closed (plan T11). */
  const [lab, setLab] = useState<LabTab | null>(null);
  const [learnVisualsActive, setLearnVisualsActive] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [crtFilter, setCrtFilter] = useState<boolean>(false);
  const [showDpad, setShowDpad] = useState<boolean>(false);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showHighScores, setShowHighScores] = useState<boolean>(false);
  const [showOptions, setShowOptions] = useState<boolean>(false);
  const [bindings, setBindings] = useState<KeyBindings>(() => loadBindings());
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;
  const [reducedFlash, setReducedFlash] = useState<boolean>(
    () => loadPreference<boolean>(PREF_REDUCED_FLASH) === true
  );
  const [colorblindPalette, setColorblindPalette] = useState<boolean>(
    () => loadPreference<boolean>(PREF_COLORBLIND) === true
  );
  const [showRestartPanel, setShowRestartPanel] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [isGameOverState, setIsGameOverState] = useState<boolean>(false);
  const [pendingScore, setPendingScore] = useState<{
    score: number;
    mode: GameMode;
    level: number;
  } | null>(null);
  const [, setUiTick] = useState<number>(0);
  const playState = useGameEvent(GameEvents, "PLAY_STATE_CHANGED", () => "READY");

  // Panels hold the game while open (T11). The keyboard handler reads these through refs.
  const anyPanelOpen =
    lab !== null || showRestartPanel || showMenu || showHighScores || showOptions;
  const anyPanelOpenRef = useRef(anyPanelOpen);
  anyPanelOpenRef.current = anyPanelOpen;
  const labRef = useRef(lab);
  labRef.current = lab;

  useEffect(() => {
    runnerRef.current?.setPaused("panel", anyPanelOpen);
  }, [anyPanelOpen]);

  /** Closes the Lab. A rewound game plays on from the frame shown, never stays held. */
  const closeLab = () => {
    engineRef.current?.resumeFromScrub();
    setLab(null);
  };

  /** Closes every panel (Escape, Space, and live game events). */
  const closeAllPanels = () => {
    closeLab();
    setShowRestartPanel(false);
    setShowMenu(false);
    setShowHighScores(false);
    setShowOptions(false);
  };

  // --- Replays (T12) ---

  /** Watches a replay in the game; the live game comes back on exit. */
  const watchReplay = (replay: Replay) => {
    const runner = runnerRef.current;
    if (!runner) return;
    closeLab();
    runner.setPaused("user", false);
    runner.viewer.start(replay);
    setUiTick((t) => t + 1);
  };

  /** Back to the live game, held by the player's pause. */
  const exitReplay = () => {
    runnerRef.current?.viewer.stop();
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    setUiTick((t) => t + 1);
  };

  const clipOf = (seconds: number) => {
    const engine = engineRef.current!;
    return engine.replayLog.export(engine, seconds);
  };

  const clips = {
    watch: (seconds: number) => watchReplay(clipOf(seconds)),
    copyLink: async (seconds: number) => {
      const link = await replayLink(clipOf(seconds), location.href);
      await navigator.clipboard.writeText(link);
      return `link copied (${(link.length / 1024).toFixed(1)} KB)`;
    },
    download: (seconds: number) => {
      const replay = clipOf(seconds);
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(replay)], { type: "application/json" })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `pacman-replay-L${replay.start.level}-t${replay.endTick}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  };

  /** Opens the Lab on a tab, or closes it when it is already open on that tab. */
  const toggleLab = (tab: LabTab) => {
    if (labRef.current === tab) closeLab();
    else setLab(tab);
  };

  /** Space and the HUD pause button: with a panel open, close it and play on; else toggle. */
  const togglePause = () => {
    const runner = runnerRef.current;
    if (!runner) return;
    if (anyPanelOpenRef.current) {
      closeAllPanels();
      runner.setPaused("user", false);
    } else {
      runner.setPaused("user", !runner.pausedBy.includes("user"));
    }
    setUiTick((t) => t + 1);
  };

  // Panels close on live game events (T11): a death, a respawn or new level/game (READY), a level
  // clear or game over. These come from the sim itself, never from a pause or a UI sync.
  useEffect(() => {
    const onRoundChange = (e: CustomEvent<PlayState>) => {
      if (["DYING", "READY", "LEVEL_CLEAR", "GAME_OVER"].includes(e.detail)) closeAllPanels();
    };
    GameEvents.on("ROUND_STATE_CHANGED", onRoundChange);
    return () => GameEvents.off("ROUND_STATE_CHANGED", onRoundChange);
  }, []);

  const gameOverTimerRef = useRef<number | null>(null);

  // Initialize engine once
  useEffect(() => {
    const handleGameOver = (e: CustomEvent<number>) => {
      const finalScore = e.detail;
      setIsGameOverState(true);

      // Trigger Restart Panel with configurable delay so player comprehends game over
      if (gameOverTimerRef.current !== null) {
        window.clearTimeout(gameOverTimerRef.current);
      }

      gameOverTimerRef.current = window.setTimeout(() => {
        setShowRestartPanel(true);
      }, uiConfig.timings.gameOverRestartDelayMs);

      // Check if qualifies for leaderboard
      const scores = getStoredHighScores();
      const isTop = scores.length < 10 || finalScore > scores[scores.length - 1].score;

      if (isTop && finalScore > 0 && engineRef.current) {
        setPendingScore({
          score: finalScore,
          mode: engineRef.current.mode,
          level: engineRef.current.level,
        });
      }
    };

    // The agent driver edits state between ticks; re-render panels that read the engine directly
    const handleUiSync = () => setUiTick((t) => t + 1);

    // A rewind out of a game over brings the round back: drop the game-over UI (and a delayed
    // Restart panel that has not opened yet), so nothing covers the board while you play on.
    const handleRewound = (e: CustomEvent<PlayState>) => {
      if (e.detail !== "GAME_OVER") {
        if (gameOverTimerRef.current !== null) {
          window.clearTimeout(gameOverTimerRef.current);
          gameOverTimerRef.current = null;
        }
        setShowRestartPanel(false);
        setIsGameOverState(false);
        setPendingScore(null);
      }
      runnerRef.current?.syncUi(); // score, lives, level and play state of the rewound frame
    };

    GameEvents.on("GAME_OVER", handleGameOver);
    GameEvents.on("UI_SYNC", handleUiSync);
    GameEvents.on("REWOUND", handleRewound);
    return () => {
      GameEvents.off("GAME_OVER", handleGameOver);
      GameEvents.off("UI_SYNC", handleUiSync);
      GameEvents.off("REWOUND", handleRewound);
    };
  }, []);

  // Initialize engine & GameLoopController once on mount
  useEffect(() => {
    const stored = getStoredHighScores();
    const highest = stored.length > 0 ? stored[0].score : 10000;

    const engine = new GameEngine("PACMAN", highest);
    engineRef.current = engine;
    // The player's remembered rules preset and joystick feel
    const preset = loadPreference<RulesPreset>(PREF_PRESET);
    if (preset === "ARCADE" || preset === "MODERN") applyRulesPreset(engine, preset);
    engine.settings.releaseClearsBuffer = loadPreference<boolean>(PREF_RELEASE) === true;
    engine.settings.reducedFlash = loadPreference<boolean>(PREF_REDUCED_FLASH) === true;
    engine.settings.colorblindPalette = loadPreference<boolean>(PREF_COLORBLIND) === true;
    engine.replayLog.reset(engine); // the recording starts with these settings
    const runner = new GameRunner(engine);
    runnerRef.current = runner;
    setLearnVisualsActive(engine.settings.learnVisualsEnabled ?? true);

    // Detect mobile touch capability to show D-pad automatically
    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      setShowDpad(true);
    }

    // Setup Canvas & Renderer
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // High DPI setup
        const dpr = window.devicePixelRatio || 1;
        canvas.width = CANVAS_WIDTH * dpr;
        canvas.height = CANVAS_HEIGHT * dpr;
        ctx.scale(dpr, dpr);
        const renderer = new GameRenderer(ctx);
        rendererRef.current = renderer;
        runner.renderer = renderer;
        renderer.practice = runner.practice;
      }
    }

    // Connect gamepad polling to engine's pre-update tick
    runner.onPreUpdate = () => {
      pollGamepads(engine);
    };

    // Load the canvas pixel font now (canvas text alone does not trigger @font-face loading)
    void document.fonts?.load(arcadeFont(16));

    // Start deterministic game loop via GameLoopController
    runner.start();

    // A new engine (first load, or a dev-server reload) starts with every panel closed
    setLab(null);
    setShowRestartPanel(false);
    setShowMenu(false);
    setShowHighScores(false);

    // A replay link (#replay=...) opens the viewer (T12)
    const code = replayCodeFromHash(location.hash);
    if (code) {
      decodeReplay(code)
        .then((replay) => {
          runner.viewer.start(replay);
          setUiTick((t) => t + 1);
        })
        .catch((error: unknown) => console.warn("Could not open the replay link:", error));
    }

    // Dev builds: expose the agent driver for automated play-testing from the console or tools
    if (import.meta.env.DEV) window.pacmanAgent = new AgentDriver(engine, runner);

    return () => {
      runner.stop();
      if (import.meta.env.DEV) delete window.pacmanAgent;
      soundEngine.stopSiren();
      if (gameOverTimerRef.current !== null) {
        window.clearTimeout(gameOverTimerRef.current);
      }
    };
  }, []);

  // Keyboard navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;

      // Prevent scrolling on arrow keys or space
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) {
        e.preventDefault();
      }

      // Watching a replay: Space plays/pauses it, Escape leaves (or closes an open panel first)
      const viewer = runnerRef.current?.viewer;
      if (
        viewer?.state.active &&
        !anyPanelOpenRef.current &&
        (e.key === " " || e.key === "Escape")
      ) {
        if (e.key === " ") {
          if (viewer.state.playing) viewer.pause();
          else viewer.play();
        } else {
          exitReplay();
        }
        setUiTick((t) => t + 1);
        return;
      }

      // Dev builds: debug overlay (F1) and frame stepping while paused (plan T1, T3)
      if (import.meta.env.DEV) {
        const runner = runnerRef.current;
        if (e.key === "F1") {
          e.preventDefault(); // not the browser's help page
          engine.settings.debugOverlay = !engine.settings.debugOverlay;
          runner?.renderer?.render(engine);
          setUiTick((t) => t + 1);
          return;
        }
        if (runner && (e.key === "." || e.key === ">")) {
          if (e.key === ".") {
            runner.stepWhilePaused(1);
          } else {
            // Next mode change: a scatter/chase switch, or frightened starting or ending
            const wave = engine.timerController.waveIndex;
            const fright = engine.frightenedGlobalTimer > 0;
            runner.stepWhilePaused(
              20 * 60 * 60,
              () =>
                engine.timerController.waveIndex !== wave ||
                engine.frightenedGlobalTimer > 0 !== fright
            );
          }
          setUiTick((t) => t + 1);
          return;
        }
      }

      // Movement keys (remappable, Options panel) come before the letter shortcuts
      const moveDir = directionForKey(bindingsRef.current, e.key);
      if (moveDir) {
        e.preventDefault();
        engine.setInputDirection(moveDir);
        return;
      }

      switch (e.key) {
        case " ":
          togglePause();
          break;
        case "Escape":
          // Close what is open; with nothing open, pause or resume
          if (anyPanelOpenRef.current) closeAllPanels();
          else togglePause();
          break;
        case "t":
        case "T":
          handleToggleTurbo();
          break;
        case "l":
        case "L":
          toggleLab("LEARN");
          break;
        case "p":
        case "P":
          toggleLab("PRACTICE");
          break;
        case "r":
        case "R":
          if (labRef.current !== null) {
            // In the Lab: scrub back 2 s; "Resume from Here" (or closing the Lab) plays on
            engine.rewindSeconds(2);
            setUiTick((t) => t + 1);
          } else if (anyPanelOpenRef.current) {
            // E.g. the Restart panel after a game over: back to 2 s before the fatal collision,
            // then hold there (your pause) with the board in view; press Space when ready
            // The round phase, not playState: an open panel makes playState read "PAUSED"
            if (engine.phase === "GAME_OVER" || engine.phase.startsWith("DEATH_")) {
              engine.rewindBeforeDeath(2);
            } else {
              engine.rewindSeconds(2);
            }
            engine.resumeFromScrub();
            runnerRef.current?.setPaused("user", true);
            setUiTick((t) => t + 1);
          }
          break;
      }
    };

    // Letting go of a direction (only matters with "release clears the turn")
    const handleKeyUp = (e: KeyboardEvent) => {
      const dir = directionForKey(bindingsRef.current, e.key);
      if (dir) engineRef.current?.releaseInputDirection(dir);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Touch Swipe Gesture Detection
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.changedTouches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    const threshold = 18; // minimum swipe distance

    if (Math.max(absX, absY) > threshold) {
      if (absX > absY) {
        // Horizontal swipe
        engineRef.current?.setInputDirection(dx > 0 ? "RIGHT" : "LEFT");
      } else {
        // Vertical swipe
        engineRef.current?.setInputDirection(dy > 0 ? "DOWN" : "UP");
      }
    }
    touchStartRef.current = null;
  };

  // Gamepad Polling
  const lastGamepadDirRef = useRef<Direction>("NONE");
  const pollGamepads = (engine: GameEngine) => {
    if (typeof navigator.getGamepads !== "function") return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    for (const gp of gamepads) {
      if (!gp) continue;

      let dir: Direction = "NONE";
      // D-pad buttons: 12 (up), 13 (down), 14 (left), 15 (right)
      if (gp.buttons[12]?.pressed || gp.axes[1] < -0.4) dir = "UP";
      else if (gp.buttons[13]?.pressed || gp.axes[1] > 0.4) dir = "DOWN";
      else if (gp.buttons[14]?.pressed || gp.axes[0] < -0.4) dir = "LEFT";
      else if (gp.buttons[15]?.pressed || gp.axes[0] > 0.4) dir = "RIGHT";

      if (dir !== "NONE" && dir !== lastGamepadDirRef.current) {
        lastGamepadDirRef.current = dir;
        engine.setInputDirection(dir);
      } else if (dir === "NONE" && lastGamepadDirRef.current !== "NONE") {
        engine.releaseInputDirection(lastGamepadDirRef.current);
        lastGamepadDirRef.current = "NONE";
      }
    }
  };

  // Mode Selection
  const handleSelectMode = (mode: GameMode) => {
    setCurrentMode(mode);
    if (engineRef.current) {
      soundEngine.stopSiren();
      engineRef.current.initGame(mode, 1);
      runnerRef.current?.setPaused("user", false); // a new game starts running
      setShowMenu(false);
      setShowRestartPanel(false);
      setIsGameOverState(false);
    }
  };

  /** Redraws the (held) game so a display option shows at once behind the panel. */
  const redraw = () => {
    const runner = runnerRef.current;
    if (runner && engineRef.current) runner.renderer?.render(engineRef.current);
  };

  // Rules preset and joystick feel (Phase 5), remembered in this browser
  const handleSelectPreset = (preset: RulesPreset) => {
    const engine = engineRef.current;
    if (!engine) return;
    applyRulesPreset(engine, preset);
    setRulesPreset(preset);
    savePreference(PREF_PRESET, preset);
  };

  const handleToggleReleaseClears = () => {
    const engine = engineRef.current;
    if (!engine) return;
    const next = !engine.settings.releaseClearsBuffer;
    engine.settings.releaseClearsBuffer = next;
    setReleaseClears(next);
    savePreference(PREF_RELEASE, next);
  };

  const handleToggleTurbo = () => {
    if (!engineRef.current) return;
    const nextTurbo = !engineRef.current.settings.turbo;
    engineRef.current.settings.turbo = nextTurbo;
    setTurbo(nextTurbo);
  };

  const handleToggleSound = () => {
    const nextSound = !soundEnabled;
    soundEngine.setEnabled(nextSound);
    setSoundEnabled(nextSound);
    if (engineRef.current) {
      engineRef.current.settings.soundEnabled = nextSound;
    }
  };

  const handleToggleCrt = () => {
    if (!engineRef.current) return;
    const nextCrt = !engineRef.current.settings.crtFilter;
    engineRef.current.settings.crtFilter = nextCrt;
    setCrtFilter(nextCrt);
  };

  const handleToggleDiagnostics = () => {
    if (!engineRef.current) return;
    const nextVal = !showDiagnostics;
    setShowDiagnostics(nextVal);
    engineRef.current.settings.showDiagnosticConsole = nextVal;
  };

  // Restart Actions
  const handleRestartRound = () => {
    if (!engineRef.current) return;
    if (gameOverTimerRef.current !== null) {
      window.clearTimeout(gameOverTimerRef.current);
      gameOverTimerRef.current = null;
    }
    engineRef.current.restartLevel(engineRef.current.level);
    runnerRef.current?.setPaused("user", false);
    setShowRestartPanel(false);
    setIsGameOverState(false);
  };

  const handleNewGame = () => {
    if (!engineRef.current) return;
    if (gameOverTimerRef.current !== null) {
      window.clearTimeout(gameOverTimerRef.current);
      gameOverTimerRef.current = null;
    }
    engineRef.current.initGame(currentMode, 1);
    runnerRef.current?.setPaused("user", false);
    setShowRestartPanel(false);
    setIsGameOverState(false);
  };

  const handleOpenRestartPanel = () => {
    const isOver = isGameOverState || engineRef.current?.playState === "GAME_OVER";
    setIsGameOverState(isOver);
    setShowRestartPanel(true);
  };

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
            onClick={() => setShowMenu(true)}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>🎮 Game Modes</span>
          </button>
          <button
            onClick={() => setShowOptions(true)}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>⚙️ Options</span>
          </button>
          <button
            onClick={() => setShowHighScores(true)}
            className="px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20 font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <span>🏆 Scores</span>
          </button>
        </div>
      </header>

      {/* Main Arcade Frame */}
      <main className="w-full flex-1 flex flex-col items-center justify-center my-2 max-w-2xl">
        {/* HUD Scoreboard */}
        <HUD
          turbo={turbo}
          onToggleTurbo={handleToggleTurbo}
          labOpen={lab !== null}
          onToggleLab={() => toggleLab(labRef.current ?? "LEARN")}
          learnVisualsEnabled={learnVisualsActive}
          paused={playState === "PAUSED"}
          pausedBy={runnerRef.current?.pausedBy ?? []}
          onTogglePause={togglePause}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          crtFilter={crtFilter}
          onToggleCrt={handleToggleCrt}
          onOpenRestart={handleOpenRestartPanel}
          restartPanelOpen={showRestartPanel}
          isGameOver={isGameOverState}
          showDiagnostics={showDiagnostics || engineRef.current?.settings.showDiagnosticConsole}
          onToggleDiagnostics={handleToggleDiagnostics}
        />

        {/* Canvas Screen Container */}
        <div
          ref={containerRef}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative w-full max-w-[480px] aspect-[28/36] bg-black border-x border-neutral-800 flex items-center justify-center overflow-hidden shadow-2xl"
        >
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "100%", imageRendering: "pixelated" }}
            className="block"
          />
        </div>

        {runnerRef.current?.viewer.state.active && (
          <ReplayBar runner={runnerRef.current} onExit={exitReplay} />
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
              currentDir={engineRef.current.pacmanState.dir}
            />
          </div>
        )}
      </main>

      {/* Restart Game Panel Modal */}
      <PanelTransitionWrapper
        panelId="RESTART_PANEL"
        isOpen={showRestartPanel}
        onClose={() => setShowRestartPanel(false)}
      >
        <RestartPanel
          score={score}
          highScore={highScore}
          level={level}
          mode={currentMode}
          isGameOver={isGameOverState}
          onRestartRound={handleRestartRound}
          onNewGame={handleNewGame}
          onChangeMode={() => {
            setShowRestartPanel(false);
            setShowMenu(true);
          }}
          onClose={() => setShowRestartPanel(false)}
        />
      </PanelTransitionWrapper>

      {/* Lab: Learn, Practice and (dev) Debug tabs in one panel (T11) */}
      <PanelTransitionWrapper panelId="LAB_PANEL" isOpen={lab !== null} onClose={closeLab}>
        {engineRef.current && lab && (
          <LabPanel
            engine={engineRef.current}
            tab={lab}
            onTab={setLab}
            onClose={closeLab}
            onUpdate={() => {
              const engine = engineRef.current;
              if (!engine) return;
              GameEvents.emit("SCORE_CHANGED", {
                score: engine.score,
                highScore: engine.highScore,
              });
              runnerRef.current?.renderer?.render(engine);
              setUiTick((t) => t + 1);
            }}
            onVisualSettingsChange={() => {
              if (engineRef.current) {
                setLearnVisualsActive(engineRef.current.settings.learnVisualsEnabled);
              }
            }}
            practice={runnerRef.current?.practice}
            clips={clips}
          />
        )}
      </PanelTransitionWrapper>

      {/* Mode Selector Modal */}
      <PanelTransitionWrapper
        panelId="MODE_SELECTOR"
        isOpen={showMenu}
        onClose={() => setShowMenu(false)}
      >
        <div className="relative">
          <ModeSelector
            rulesPreset={
              engineRef.current ? rulesPresetOf(engineRef.current.settings) : rulesPreset
            }
            onSelectPreset={handleSelectPreset}
            releaseClears={releaseClears}
            onToggleReleaseClears={handleToggleReleaseClears}
            currentMode={currentMode}
            onSelectMode={handleSelectMode}
            turbo={turbo}
            onToggleTurbo={handleToggleTurbo}
            onStartGame={() => {
              setShowMenu(false);
              if (isGameOverState) handleNewGame();
            }}
          />
          <button
            onClick={() => setShowMenu(false)}
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
        isOpen={showOptions}
        onClose={() => setShowOptions(false)}
      >
        <OptionsPanel
          bindings={bindings}
          onChangeBindings={(next) => {
            setBindings(next);
            saveBindings(next);
          }}
          reducedFlash={reducedFlash}
          onToggleReducedFlash={() => {
            const next = !reducedFlash;
            setReducedFlash(next);
            savePreference(PREF_REDUCED_FLASH, next);
            if (engineRef.current) engineRef.current.settings.reducedFlash = next;
            redraw();
          }}
          colorblindPalette={colorblindPalette}
          onToggleColorblindPalette={() => {
            const next = !colorblindPalette;
            setColorblindPalette(next);
            savePreference(PREF_COLORBLIND, next);
            if (engineRef.current) engineRef.current.settings.colorblindPalette = next;
            redraw();
          }}
          onClose={() => setShowOptions(false)}
        />
      </PanelTransitionWrapper>

      {/* High Scores Modal */}
      <PanelTransitionWrapper
        panelId="HIGH_SCORES"
        isOpen={showHighScores}
        onClose={() => {
          setShowHighScores(false);
          setPendingScore(null);
        }}
      >
        <HighScoresModal
          pendingNewScore={pendingScore}
          onScoreSubmitted={() => setPendingScore(null)}
          onClose={() => {
            setShowHighScores(false);
            setPendingScore(null);
          }}
        />
      </PanelTransitionWrapper>

      {/* Floating Interactive Diagnostic & Invariants Console HUD */}
      {engineRef.current &&
        (showDiagnostics || engineRef.current.settings.showDiagnosticConsole) && (
          <DiagnosticConsole
            engine={engineRef.current}
            onClose={() => {
              setShowDiagnostics(false);
              if (engineRef.current) {
                engineRef.current.settings.showDiagnosticConsole = false;
              }
              setUiTick((t) => t + 1);
            }}
          />
        )}

      {/* Footer Info */}
      <footer className="w-full max-w-4xl py-2 px-3 border-t border-neutral-900 text-center text-[11px] text-neutral-500 font-mono">
        <span>Pac-Man Arcade &copy; 1980 Namco / Midway</span>
      </footer>
    </div>
  );
};
