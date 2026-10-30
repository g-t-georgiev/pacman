export type PanelId =
  | "RESTART_PANEL"
  | "LEARN_PANEL"
  | "PRACTICE_PANEL"
  | "MODE_SELECTOR"
  | "HIGH_SCORES";

export type TransitionEffect =
  | "fade-slide-up"
  | "scale-fade"
  | "fade-drop"
  | "slide-in-right"
  | "subtle-fade";

export type PanelPosition = "center-viewport" | "top-viewport" | "bottom-viewport";

export interface PanelTransitionConfig {
  effect: TransitionEffect;
  durationMs: number;
  easing: string;
  backdropBlur: boolean;
  backdropColor: string;
  position: PanelPosition;
  closeOnBackdropClick: boolean;
}

export interface UIConfig {
  timings: {
    /** Delay in milliseconds after GAME OVER text is displayed before showing the Restart Panel */
    gameOverRestartDelayMs: number;
    /** Duration in frames for READY! banner before gameplay commences */
    readyBannerFrames: number;
    /** Duration in frames for LEVEL CLEAR flashing before loading next level */
    levelClearFrames: number;
    /** Notification / score popup duration in frames */
    scorePopupLifetimeFrames: number;
  };
  panels: Record<PanelId, PanelTransitionConfig>;
}

export const uiConfig: UIConfig = {
  timings: {
    gameOverRestartDelayMs: 1200, // 1.2 seconds so player can comprehend game over
    readyBannerFrames: 120, // 2 seconds
    levelClearFrames: 120, // 2 seconds
    scorePopupLifetimeFrames: 45,
  },
  panels: {
    RESTART_PANEL: {
      effect: "fade-slide-up",
      durationMs: 300,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      backdropBlur: true,
      backdropColor: "rgba(0, 0, 0, 0.75)",
      position: "center-viewport",
      closeOnBackdropClick: false, // Prevent accidental dismissal on game over
    },
    LEARN_PANEL: {
      effect: "fade-slide-up",
      durationMs: 250,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      backdropBlur: true,
      backdropColor: "rgba(0, 0, 0, 0.7)",
      position: "center-viewport",
      closeOnBackdropClick: true,
    },
    PRACTICE_PANEL: {
      effect: "scale-fade",
      durationMs: 250,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      backdropBlur: true,
      backdropColor: "rgba(0, 0, 0, 0.7)",
      position: "center-viewport",
      closeOnBackdropClick: true,
    },
    MODE_SELECTOR: {
      effect: "scale-fade",
      durationMs: 280,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      backdropBlur: true,
      backdropColor: "rgba(0, 0, 0, 0.8)",
      position: "center-viewport",
      closeOnBackdropClick: true,
    },
    HIGH_SCORES: {
      effect: "fade-drop",
      durationMs: 260,
      easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      backdropBlur: true,
      backdropColor: "rgba(0, 0, 0, 0.8)",
      position: "center-viewport",
      closeOnBackdropClick: true,
    },
  },
};

export const DEFAULT_UI_CONFIG = {
  effect: "fade-slide-up",
  durationMs: 250,
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  backdropBlur: true,
  backdropColor: "rgba(0, 0, 0, 0.7)",
  position: "center-viewport",
  closeOnBackdropClick: true,
};

export function getPanelConfig(panelId: PanelId): PanelTransitionConfig {
  return uiConfig.panels[panelId] || DEFAULT_UI_CONFIG;
}
