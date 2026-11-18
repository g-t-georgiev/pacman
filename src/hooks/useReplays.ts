import type { MutableRefObject } from "react";
import type GameEngine from "../game/GameEngine";
import type { GameRunner } from "../game/GameRunner";
import type { Replay } from "../game/replay";
import { replayLink } from "../game/replayShare";

/**
 * Watching replays in the game and the clip actions of the Practice tab (plan M3; T12). The live
 * game comes back exactly on exit, held by the player's pause.
 */
export function useReplays(
  engineRef: MutableRefObject<GameEngine | null>,
  runnerRef: MutableRefObject<GameRunner | null>,
  closeLab: () => void,
  refresh: () => void
) {
  /** Watches a replay in the game; the live game comes back on exit. */
  const watchReplay = (replay: Replay) => {
    const runner = runnerRef.current;
    if (!runner) return;
    closeLab();
    runner.setPaused("user", false);
    runner.viewer.start(replay);
    refresh();
  };

  /** Back to the live game, held by the player's pause. */
  const exitReplay = () => {
    runnerRef.current?.viewer.stop();
    if (location.hash) history.replaceState(null, "", location.pathname + location.search);
    refresh();
  };

  const clipOf = (seconds: number) => {
    const engine = engineRef.current!;
    return engine.replayLog.export(engine, seconds);
  };

  /** The Practice tab's clip actions: watch, copy a link, download a file. */
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

  return { watchReplay, exitReplay, clips };
}
