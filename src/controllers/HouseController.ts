import type { Ghost } from "../core/Ghost";
import type { GhostType } from "../types";
import { SIM_FPS } from "../game/constants";

/** Ghosts that wait in the house, in order of preference (Dossier, "Home Sweet Home"). */
export const HOUSE_GHOSTS = ["PINKY", "INKY", "CLYDE"] as const;
export type HouseGhost = (typeof HOUSE_GHOSTS)[number];

/** Personal dot limits per level: L1 0/30/60, L2 0/0/50, L3+ 0/0/0. */
export function getHouseDotLimit(ghost: HouseGhost, level: number): number {
  if (ghost === "INKY") return level === 1 ? 30 : 0;
  if (ghost === "CLYDE") return level === 1 ? 60 : level === 2 ? 50 : 0;
  return 0;
}

/** Frames without eating a dot before the preferred ghost is forced out: 4 s, or 3 s from level 5. */
export function getHouseIdleLimit(level: number): number {
  return (level < 5 ? 4 : 3) * SIM_FPS;
}

/** Global dot counter values (after a life is lost) that release Pinky and Inky, and that end it. */
export const GLOBAL_RELEASE_PINKY = 7;
export const GLOBAL_RELEASE_INKY = 17;
export const GLOBAL_COUNTER_END = 32;

/** Serializable house state (part of GameState). */
export interface HouseState {
  dotCounters: Record<HouseGhost, number>;
  globalCounterActive: boolean;
  globalCounter: number;
  idleFrames: number;
  /** After a life is lost, Cruise Elroy is suspended until Clyde starts leaving (Dossier, Blinky). */
  elroySuspended: boolean;
}

/**
 * Decides when Pinky, Inky and Clyde leave the ghost house (plan F6, Dossier "Home Sweet Home").
 *
 * - Personal dot counters: only the most-preferred ghost still inside counts dots. When it reaches
 *   its level's limit it leaves, and the next ghost's counter takes over. Counters reset at level
 *   start only.
 * - Global dot counter: after a life is lost, personal counters are suspended (not reset) and one
 *   global counter runs. It releases Pinky at 7 and Inky at 17. At 32 it switches back to the
 *   personal counters, but only if Clyde is inside at that moment; otherwise it keeps counting.
 * - Idle timer: if no dot is eaten for 4 s (3 s from level 5), the preferred ghost is forced out.
 *
 * Blinky never waits: if he is in the house (revived eyes), he leaves at once.
 * Releasing a ghost only sets its location to LEAVING; the house movement does the rest.
 */
export class HouseController {
  public state: HouseState = HouseController.initialState();

  public static initialState(): HouseState {
    return {
      dotCounters: { PINKY: 0, INKY: 0, CLYDE: 0 },
      globalCounterActive: false,
      globalCounter: 0,
      idleFrames: 0,
      elroySuspended: false,
    };
  }

  /** New level: personal counters from zero. */
  public onLevelStart(): void {
    this.state = HouseController.initialState();
  }

  /** Life lost: suspend the personal counters and start the global one. */
  public onLifeLost(): void {
    this.state.globalCounterActive = true;
    this.state.globalCounter = 0;
    this.state.idleFrames = 0;
    this.state.elroySuspended = true;
  }

  /** Pac-Man ate a dot or an energizer. */
  public onDotEaten(ghosts: Record<GhostType, Ghost>): void {
    this.state.idleFrames = 0;
    if (this.state.globalCounterActive) {
      this.state.globalCounter++;
      return;
    }
    const preferred = this.preferredWaiting(ghosts);
    if (preferred) this.state.dotCounters[preferred]++;
  }

  /** Runs once per PLAYING frame, before ghosts move. */
  public update(ghosts: Record<GhostType, Ghost>, level: number): void {
    if (ghosts.BLINKY.location === "HOUSE") this.release(ghosts.BLINKY);

    if (this.state.globalCounterActive) {
      this.updateGlobalCounter(ghosts);
    } else {
      const preferred = this.preferredWaiting(ghosts);
      if (preferred && this.state.dotCounters[preferred] >= getHouseDotLimit(preferred, level)) {
        this.release(ghosts[preferred]);
      }
    }

    this.state.idleFrames++;
    if (this.state.idleFrames >= getHouseIdleLimit(level)) {
      this.state.idleFrames = 0;
      const preferred = this.preferredWaiting(ghosts);
      if (preferred) this.release(ghosts[preferred]);
    }
  }

  private updateGlobalCounter(ghosts: Record<GhostType, Ghost>): void {
    const count = this.state.globalCounter;
    if (count === GLOBAL_RELEASE_PINKY && ghosts.PINKY.location === "HOUSE") {
      this.release(ghosts.PINKY);
    } else if (count === GLOBAL_RELEASE_INKY && ghosts.INKY.location === "HOUSE") {
      this.release(ghosts.INKY);
    } else if (count === GLOBAL_COUNTER_END && ghosts.CLYDE.location === "HOUSE") {
      this.state.globalCounterActive = false;
      this.state.globalCounter = 0;
    }
  }

  /** The most-preferred ghost still waiting inside, if any. */
  public preferredWaiting(ghosts: Record<GhostType, Ghost>): HouseGhost | undefined {
    return HOUSE_GHOSTS.find((type) => ghosts[type].location === "HOUSE");
  }

  private release(ghost: Ghost): void {
    ghost.location = "LEAVING";
    if (ghost.type === "CLYDE") this.state.elroySuspended = false;
  }
}
