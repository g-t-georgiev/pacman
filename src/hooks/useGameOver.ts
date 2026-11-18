import { type MutableRefObject, useEffect, useRef, useState } from "react";
import GameEvents from "../core/EventBus";
import { uiConfig } from "../config/ui.config";
import type GameEngine from "../game/GameEngine";
import type { GameRunner } from "../game/GameRunner";
import { getStoredHighScores } from "../components/HighScoresModal";
import type { GameMode, PlayState } from "../types";

export interface PendingScore {
  score: number;
  mode: GameMode;
  level: number;
}

/**
 * Game over in the UI (plan M3): the Restart panel opens after a short delay so the player sees
 * the board, a score good enough for the table is offered to it, and a rewind out of a game over
 * undoes all of that.
 */
export function useGameOver(
  engineRef: MutableRefObject<GameEngine | null>,
  runnerRef: MutableRefObject<GameRunner | null>,
  setShowRestartPanel: (open: boolean) => void
) {
  const [isGameOver, setIsGameOver] = useState(false);
  const [pendingScore, setPendingScore] = useState<PendingScore | null>(null);
  const timerRef = useRef<number | null>(null);

  /** Cancels a Restart panel that is still waiting to open. */
  const cancelDelayedPanel = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    const onGameOver = (e: CustomEvent<number>) => {
      const finalScore = e.detail;
      setIsGameOver(true);
      cancelDelayedPanel();
      timerRef.current = window.setTimeout(() => {
        setShowRestartPanel(true);
      }, uiConfig.timings.gameOverRestartDelayMs);

      // A score that makes the table is offered to it
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

    // A rewind out of a game over brings the round back: drop the game-over UI (and a delayed
    // Restart panel that has not opened yet), so nothing covers the board while you play on.
    const onRewound = (e: CustomEvent<PlayState>) => {
      if (e.detail !== "GAME_OVER") {
        cancelDelayedPanel();
        setShowRestartPanel(false);
        setIsGameOver(false);
        setPendingScore(null);
      }
      runnerRef.current?.syncUi(); // score, lives, level and play state of the rewound frame
    };

    GameEvents.on("GAME_OVER", onGameOver);
    GameEvents.on("REWOUND", onRewound);
    return () => {
      GameEvents.off("GAME_OVER", onGameOver);
      GameEvents.off("REWOUND", onRewound);
      cancelDelayedPanel();
    };
    // The refs and the setter are stable for the component's life
  }, [engineRef, runnerRef, setShowRestartPanel]);

  return { isGameOver, setIsGameOver, pendingScore, setPendingScore, cancelDelayedPanel };
}
