import type { GhostType, PlayState } from "../types";
import type { DiagnosticData } from "../diagnostics/DiagnosticController";

/**
 * Every UI bus event and its payload (plan A5). The shell (`GameRunner`) emits these from the
 * sim's events; React components subscribe. A wrong name or payload is a compile error.
 */
export interface GameEventMap {
  SCORE_CHANGED: { score: number; highScore: number };
  LIVES_CHANGED: number;
  LEVEL_CHANGED: number;
  /** The coarse state the UI shows, pauses included (also re-sent on UI syncs). */
  PLAY_STATE_CHANGED: PlayState;
  /** A real round change from the sim (death, READY, level clear, game over...); never a pause. */
  ROUND_STATE_CHANGED: PlayState;
  /** Final score. */
  GAME_OVER: number;
  /** The level just cleared. (No listener yet.) */
  LEVEL_CLEARED: number;
  /** (No listener yet.) */
  ENERGIZER_EATEN: { level: number };
  /** (No listener yet.) */
  GHOST_EATEN: { type: GhostType; points: number };
  /** Points scored. (No listener yet.) */
  FRUIT_EATEN: number;
  /** Diagnostics console telemetry, sent only while the console is open. */
  DIAGNOSTICS_TICK: DiagnosticData;
  /** State was changed between ticks (agent driver): panels reading the engine re-render. */
  UI_SYNC: undefined;
}

export type GameEventName = keyof GameEventMap;
export type GameEventListener<K extends GameEventName> = (
  event: CustomEvent<GameEventMap[K]>
) => void;

/** A type-safe event bus on EventTarget: names and payloads come from `GameEventMap`. */
export class EventBus {
  private target = new EventTarget();

  public on<K extends GameEventName>(eventName: K, callback: GameEventListener<K>): void {
    this.target.addEventListener(eventName, callback as EventListener);
  }

  public off<K extends GameEventName>(eventName: K, callback: GameEventListener<K>): void {
    this.target.removeEventListener(eventName, callback as EventListener);
  }

  /** Payload-less events (`UI_SYNC`) take no second argument. */
  public emit<K extends GameEventName>(
    eventName: K,
    ...detail: GameEventMap[K] extends undefined ? [] : [GameEventMap[K]]
  ): void {
    const payload = detail[0];
    const evt =
      typeof CustomEvent !== "undefined"
        ? new CustomEvent(eventName, { detail: payload })
        : ({ detail: payload } as unknown as CustomEvent<GameEventMap[K]>);
    this.target.dispatchEvent(evt);
  }
}

/** Global game events instance */
const GameEvents = new EventBus();

export default GameEvents;
