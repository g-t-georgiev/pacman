import { type MutableRefObject, useEffect, useRef, useState } from "react";
import GameEvents from "../core/EventBus";
import type GameEngine from "../game/GameEngine";
import type { GameRunner } from "../game/GameRunner";
import type { LabTab } from "../components/LabPanel";
import type { PlayState } from "../types";

/**
 * Which panel is open, and what panels do to the game (plan M3; T11): an open panel holds the
 * game, panels close on live game events (a death, READY, a level clear, game over), and Space /
 * the pause button close what is open and play on.
 */
export function usePanels(
  engineRef: MutableRefObject<GameEngine | null>,
  runnerRef: MutableRefObject<GameRunner | null>,
  refresh: () => void
) {
  /** The Lab panel (Learn / Practice / Debug tabs), or null when closed. */
  const [lab, setLab] = useState<LabTab | null>(null);
  const [showRestartPanel, setShowRestartPanel] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showHighScores, setShowHighScores] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const anyPanelOpen =
    lab !== null || showRestartPanel || showMenu || showHighScores || showOptions;
  // The keyboard handler is registered once: it reads these through refs
  const anyPanelOpenRef = useRef(anyPanelOpen);
  anyPanelOpenRef.current = anyPanelOpen;
  const labRef = useRef(lab);
  labRef.current = lab;

  useEffect(() => {
    runnerRef.current?.setPaused("panel", anyPanelOpen);
  }, [anyPanelOpen, runnerRef]);

  /** Closes the Lab. A rewound game plays on from the frame shown, never stays held. */
  const closeLab = () => {
    engineRef.current?.timeline.resume();
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
    refresh();
  };

  // Panels close on live game events: these come from the sim itself, never from a pause or a
  // UI sync. The handler is read through a ref so it always closes the current panels.
  const closeAllRef = useRef(closeAllPanels);
  closeAllRef.current = closeAllPanels;
  useEffect(() => {
    const onRoundChange = (e: CustomEvent<PlayState>) => {
      if (["DYING", "READY", "LEVEL_CLEAR", "GAME_OVER"].includes(e.detail)) closeAllRef.current();
    };
    GameEvents.on("ROUND_STATE_CHANGED", onRoundChange);
    return () => GameEvents.off("ROUND_STATE_CHANGED", onRoundChange);
  }, []);

  return {
    lab,
    setLab,
    showRestartPanel,
    setShowRestartPanel,
    showMenu,
    setShowMenu,
    showHighScores,
    setShowHighScores,
    showOptions,
    setShowOptions,
    anyPanelOpenRef,
    labRef,
    closeLab,
    closeAllPanels,
    toggleLab,
    togglePause,
  };
}
