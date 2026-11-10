import type GameEngine from "../game/GameEngine";
import type { Direction, GhostBehavior, GhostsToHousePhase, GhostType, TileCoord } from "../types";
import { createDefaultDiagnosticRules, type DiagnosticRule } from "./rules";

export interface DiagnosticLogEvent {
  id: string;
  timestamp: string;
  frame: number;
  type: "INFO" | "WARN" | "ERROR" | "ASSERTION_FAIL";
  message: string;
}

export type ActorDiagnosticDataBase = {
  x: number;
  y: number;
  tileCol: number;
  tileRow: number;
  dir: Direction;
  speed: number;
};

export type GhostDiagnosticData = {
  [K in Lowercase<GhostType>]: {
    aiMode: GhostBehavior;
    /** null while frightened */
    targetTile: TileCoord | null;
    inHouse: boolean;
    enteringHousePhase?: GhostsToHousePhase;
  } & ActorDiagnosticDataBase;
};

export type ActorsDiagnosticData = {
  pacman: ActorDiagnosticDataBase & {
    eatingFreezeFrames: number;
  };
} & GhostDiagnosticData;

export type DiagnosticData = ActorsDiagnosticData & {
  level: number;
  frame: number;
  wave: Extract<GhostBehavior, "CHASE" | "SCATTER">;
  waveTimer: number;
  frightenedTimer: number;
  score: number;
  highScore: number;
  lives: number;
};

/**
 * Controller managing live in-game diagnostics, rule evaluations,
 * and telemetry stream for the Diagnostic HUD.
 */
export class DiagnosticController {
  public rules: DiagnosticRule[] = [];
  public logs: DiagnosticLogEvent[] = [];
  public hasDiscrepancy: boolean = false;
  public unreadDiscrepancies: number = 0;
  private evalSampleRate: number = 5; // evaluate rules every 5 frames
  private frameCounter: number = 0;

  constructor() {
    this.rules = createDefaultDiagnosticRules();
  }

  /**
   * Toggles a rule on or off.
   */
  public toggleRule(ruleId: string): void {
    const r = this.rules.find((rule) => rule.id === ruleId);
    if (r) {
      r.enabled = !r.enabled;
    }
  }

  /**
   * Logs a diagnostic event.
   */
  public log(
    type: "INFO" | "WARN" | "ERROR" | "ASSERTION_FAIL",
    message: string,
    frame: number = 0
  ): void {
    const event: DiagnosticLogEvent = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toLocaleTimeString(),
      frame,
      type,
      message,
    };
    this.logs.unshift(event);
    if (this.logs.length > 100) {
      this.logs.pop();
    }
    if (type === "ERROR" || type === "ASSERTION_FAIL") {
      this.hasDiscrepancy = true;
      this.unreadDiscrepancies++;
    }
  }

  /**
   * Evaluates active rules against current game engine state.
   */
  public evaluateRules(engine: GameEngine, currLevelFrame: number): void {
    this.frameCounter++;
    if (this.frameCounter % this.evalSampleRate !== 0) return;

    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      const result = rule.evaluate(engine);
      if (result.pass) {
        rule.passes++;
      } else {
        rule.failures++;
        rule.lastFailureMessage = result.message;
        this.log(
          "ASSERTION_FAIL",
          `[${rule.name}] ${result.message || "Rule violated"}`,
          currLevelFrame
        );
      }
    }
  }

  /**
   * Acknowledges discrepancies (stops collapsed flashing).
   */
  public acknowledgeDiscrepancies(): void {
    this.hasDiscrepancy = false;
    this.unreadDiscrepancies = 0;
  }

  /**
   * Clears the event log.
   */
  public clearLogs(): void {
    this.logs = [];
    this.hasDiscrepancy = false;
    this.unreadDiscrepancies = 0;
  }
}
