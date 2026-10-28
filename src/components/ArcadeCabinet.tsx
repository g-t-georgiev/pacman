/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { soundEngine } from '../audio/soundEngine';
import { uiConfig } from '../config/ui.config';
import { CANVAS_HEIGHT, CANVAS_WIDTH, CLASSIC_FRUITS } from '../game/constants';
import { GameEngine } from '../game/gameEngine';
import { GameRenderer } from '../game/renderer';
import { Direction, GameMode } from '../types/game';
import { HighScoresModal, getStoredHighScores } from './HighScoresModal';
import { HUD } from './HUD';
import { LearnModeOverlay } from './LearnModeOverlay';
import { ModeSelector } from './ModeSelector';
import { PanelTransitionWrapper } from './PanelTransitionWrapper';
import { PracticePanel } from './PracticePanel';
import { RestartPanel } from './RestartPanel';
import { VirtualDpad } from './VirtualDpad';

export const ArcadeCabinet: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Engine & Renderer instances
  const engineRef = useRef<GameEngine | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);

  // UI state for reactive HUD updates
  const [currentMode, setCurrentMode] = useState<GameMode>('PACMAN');
  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(10000);
  const [lives, setLives] = useState<number>(3);
  const [level, setLevel] = useState<number>(1);
  const [turbo, setTurbo] = useState<boolean>(false);
  const [learnMode, setLearnMode] = useState<boolean>(false);
  const [learnVisualsActive, setLearnVisualsActive] = useState<boolean>(true);
  const [practiceMode, setPracticeMode] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [crtFilter, setCrtFilter] = useState<boolean>(false);
  const [showDpad, setShowDpad] = useState<boolean>(false);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [showHighScores, setShowHighScores] = useState<boolean>(false);
  const [showRestartPanel, setShowRestartPanel] = useState<boolean>(false);
  const [isGameOverState, setIsGameOverState] = useState<boolean>(false);
  const [pendingScore, setPendingScore] = useState<{ score: number; mode: GameMode; level: number } | null>(null);
  const [, setUiTick] = useState<number>(0);

  const gameOverTimerRef = useRef<number | null>(null);

  // Initialize engine once
  useEffect(() => {
    const stored = getStoredHighScores();
    const highest = stored.length > 0 ? stored[0].score : 10000;
    setHighScore(highest);

    const engine = new GameEngine('PACMAN', highest);
    engineRef.current = engine;
    setLearnVisualsActive(engine.settings.learnVisualsEnabled ?? true);

    // Detect mobile touch capability to show D-pad automatically
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      setShowDpad(true);
    }

    engine.onStateChange = () => {
      setScore(engine.score);
      setHighScore(engine.highScore);
      setLives(engine.lives);
      setLevel(engine.level);
    };

    engine.onGameOver = (finalScore) => {
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
      if (isTop && finalScore > 0) {
        setPendingScore({
          score: finalScore,
          mode: engine.mode,
          level: engine.level,
        });
      }
    };

    engine.onNewHighScore = (newHigh) => {
      setHighScore(newHigh);
    };

    // Setup Canvas
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // High DPI setup
        const dpr = window.devicePixelRatio || 1;
        canvas.width = CANVAS_WIDTH * dpr;
        canvas.height = CANVAS_HEIGHT * dpr;
        ctx.scale(dpr, dpr);
        rendererRef.current = new GameRenderer(ctx);
      }
    }

    // Play intro sound
    soundEngine.playIntro();

    // Game loop
    let animId: number;
    const loop = () => {
      // Gamepad polling
      pollGamepads(engine);

      engine.update();

      if (rendererRef.current) {
        rendererRef.current.render(engine);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animId);
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
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          engine.setInputDirection('UP');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          engine.setInputDirection('DOWN');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          engine.setInputDirection('LEFT');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          engine.setInputDirection('RIGHT');
          break;
        case ' ':
        case 'Escape':
          if (engine.playState === 'PLAYING') {
            engine.playState = 'PAUSED';
          } else if (engine.playState === 'PAUSED') {
            engine.playState = 'PLAYING';
          }
          break;
        case 't':
        case 'T':
          handleToggleTurbo();
          break;
        case 'l':
        case 'L':
          handleToggleLearnMode();
          break;
        case 'p':
        case 'P':
          handleTogglePracticeMode();
          break;
        case 'r':
        case 'R':
          if (engine.settings.practiceMode) {
            engine.rewindSeconds(2);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
        engineRef.current?.setInputDirection(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        // Vertical swipe
        engineRef.current?.setInputDirection(dy > 0 ? 'DOWN' : 'UP');
      }
    }
    touchStartRef.current = null;
  };

  // Gamepad Polling
  const lastGamepadDirRef = useRef<Direction>('NONE');
  const pollGamepads = (engine: GameEngine) => {
    if (typeof navigator.getGamepads !== 'function') return;
    const gamepads = navigator.getGamepads();
    if (!gamepads) return;

    for (const gp of gamepads) {
      if (!gp) continue;

      let dir: Direction = 'NONE';
      // D-pad buttons: 12 (up), 13 (down), 14 (left), 15 (right)
      if (gp.buttons[12]?.pressed || gp.axes[1] < -0.4) dir = 'UP';
      else if (gp.buttons[13]?.pressed || gp.axes[1] > 0.4) dir = 'DOWN';
      else if (gp.buttons[14]?.pressed || gp.axes[0] < -0.4) dir = 'LEFT';
      else if (gp.buttons[15]?.pressed || gp.axes[0] > 0.4) dir = 'RIGHT';

      if (dir !== 'NONE' && dir !== lastGamepadDirRef.current) {
        lastGamepadDirRef.current = dir;
        engine.setInputDirection(dir);
      } else if (dir === 'NONE') {
        lastGamepadDirRef.current = 'NONE';
      }
    }
  };

  // Mode Selection
  const handleSelectMode = (mode: GameMode) => {
    setCurrentMode(mode);
    if (engineRef.current) {
      engineRef.current.initGame(mode, 1);
      setShowMenu(false);
      setShowRestartPanel(false);
      setIsGameOverState(false);
      soundEngine.playIntro();
    }
  };

  const handleToggleTurbo = () => {
    if (!engineRef.current) return;
    const nextTurbo = !engineRef.current.settings.turbo;
    engineRef.current.settings.turbo = nextTurbo;
    setTurbo(nextTurbo);
  };

  const handleToggleLearnMode = () => {
    if (!engineRef.current) return;
    const nextLearn = !learnMode;
    setLearnMode(nextLearn);
  };

  const handleTogglePracticeMode = () => {
    if (!engineRef.current) return;
    const nextPractice = !practiceMode;
    setPracticeMode(nextPractice);
    engineRef.current.settings.practiceMode = nextPractice;
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

  // Restart Actions
  const handleRestartRound = () => {
    if (!engineRef.current) return;
    if (gameOverTimerRef.current !== null) {
      window.clearTimeout(gameOverTimerRef.current);
      gameOverTimerRef.current = null;
    }
    engineRef.current.loadLevel(engineRef.current.level);
    engineRef.current.lives = 3;
    engineRef.current.playState = 'READY';
    engineRef.current.readyTimer = uiConfig.timings.readyBannerFrames;
    setLives(3);
    setShowRestartPanel(false);
    setIsGameOverState(false);
    soundEngine.playIntro();
  };

  const handleNewGame = () => {
    if (!engineRef.current) return;
    if (gameOverTimerRef.current !== null) {
      window.clearTimeout(gameOverTimerRef.current);
      gameOverTimerRef.current = null;
    }
    engineRef.current.initGame(currentMode, 1);
    setScore(0);
    setLevel(1);
    setLives(3);
    setShowRestartPanel(false);
    setIsGameOverState(false);
    soundEngine.playIntro();
  };

  const handleOpenRestartPanel = () => {
    const isOver = engineRef.current?.playState === 'GAME_OVER';
    setIsGameOverState(isOver);
    setShowRestartPanel(true);
  };

  const fruitMeta = CLASSIC_FRUITS[Math.min(level - 1, CLASSIC_FRUITS.length - 1)];

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col items-center justify-between p-2 sm:p-4 selection:bg-yellow-500 selection:text-black font-sans">
      {/* Top Navbar */}
      <header className="w-full max-w-4xl flex items-center justify-between gap-4 py-2 px-3 border-b border-neutral-800 text-xs text-neutral-400">
        <div className="flex items-center gap-2">
          <span className="text-base">🕹️</span>
          <span className="font-bold tracking-wider text-white text-sm">PAC-MAN ARCADE LAB</span>
          <span className="hidden sm:inline text-neutral-400">·</span>
          <span className="hidden sm:inline text-neutral-400">
            {currentMode === 'PACMAN'
              ? 'Classic 1980'
              : currentMode === 'MS_PACMAN'
              ? 'Ms. Pac-Man'
              : currentMode === 'CRAZY_OTTO'
              ? 'Crazy Otto 1981'
              : 'Cookie Man'}
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
          score={score}
          highScore={highScore}
          lives={lives}
          level={level}
          mode={currentMode}
          turbo={turbo}
          onToggleTurbo={handleToggleTurbo}
          learnMode={learnMode}
          onToggleLearnMode={handleToggleLearnMode}
          learnVisualsEnabled={learnVisualsActive}
          practiceMode={practiceMode}
          onTogglePracticeMode={handleTogglePracticeMode}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
          crtFilter={crtFilter}
          onToggleCrt={handleToggleCrt}
          onOpenRestart={handleOpenRestartPanel}
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
            style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
            className="block"
          />
        </div>

        {/* Bottom Arcade Rack: Lives & Level Fruit */}
        <div className="w-full max-w-[480px] bg-neutral-900 border border-neutral-800 rounded-b-xl px-4 py-2 flex items-center justify-between text-xs text-neutral-400 select-none">
          {/* Lives Display */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-neutral-400 mr-1">LIVES:</span>
            {Array.from({ length: Math.max(0, lives - 1) }).map((_, idx) => (
              <span key={idx} className="text-yellow-400 text-sm">
                🟡
              </span>
            ))}
            {lives <= 1 && <span className="text-[10px] text-red-400 font-bold">LAST LIFE!</span>}
          </div>

          {/* Fruit Indicator */}
          <div className="flex items-center gap-2">
            <span className="text-base" title={`${fruitMeta.name} (${fruitMeta.points} pts)`}>
              {fruitMeta.symbol}
            </span>
            <button
              onClick={() => setShowDpad(!showDpad)}
              className={`text-[11px] px-2 py-0.5 rounded font-mono transition-colors cursor-pointer ${
                showDpad ? 'bg-yellow-400 text-black font-bold' : 'bg-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {showDpad ? 'Hide D-Pad' : 'Show D-Pad'}
            </button>
          </div>
        </div>

        {/* On-Screen Virtual D-pad (for mobile / touch devices) */}
        {showDpad && engineRef.current && (
          <div className="mt-3">
            <VirtualDpad
              onDirection={(dir) => engineRef.current?.setInputDirection(dir)}
              currentDir={engineRef.current.pacman.dir}
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

      {/* Learn Mode AI Intelligence Lab Modal */}
      <PanelTransitionWrapper
        panelId="LEARN_PANEL"
        isOpen={learnMode}
        onClose={() => setLearnMode(false)}
      >
        {engineRef.current && (
          <LearnModeOverlay
            engine={engineRef.current}
            onClose={() => setLearnMode(false)}
            onVisualSettingsChange={() => {
              if (engineRef.current) {
                setLearnVisualsActive(engineRef.current.settings.learnVisualsEnabled);
              }
            }}
          />
        )}
      </PanelTransitionWrapper>

      {/* Practice Sandbox Panel Modal */}
      <PanelTransitionWrapper
        panelId="PRACTICE_PANEL"
        isOpen={practiceMode}
        onClose={() => {
          setPracticeMode(false);
          if (engineRef.current) {
            engineRef.current.settings.practiceMode = false;
          }
        }}
      >
        {engineRef.current && (
          <PracticePanel
            engine={engineRef.current}
            onUpdate={() => {
              if (engineRef.current) {
                setScore(engineRef.current.score);
                setUiTick((t) => t + 1);
              }
            }}
            onClose={() => {
              setPracticeMode(false);
              if (engineRef.current) {
                engineRef.current.settings.practiceMode = false;
              }
            }}
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
            currentMode={currentMode}
            onSelectMode={handleSelectMode}
            turbo={turbo}
            onToggleTurbo={handleToggleTurbo}
            onStartGame={() => setShowMenu(false)}
            highScore={highScore}
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

      {/* Footer Info */}
      <footer className="w-full max-w-4xl py-2 px-3 border-t border-neutral-900 text-center text-[11px] text-neutral-500 font-mono">
        <span>Pac-Man Arcade &copy; 1980 Namco / Midway</span>
        <span className="mx-2">·</span>
        <span>Crazy Otto prototype &copy; 1981 GCC</span>
        <span className="mx-2">·</span>
        <span>Procedural Cookie Man Lab</span>
      </footer>
    </div>
  );
};
