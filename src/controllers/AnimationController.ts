import type { Ghost } from "../core/Ghost";
import { FRIGHTENED_FLASH_TOGGLE_FRAMES } from "../game/constants";
import { getFrightenedFlashCount } from "../game/levelTable";

/**
 * Animation Controller responsible for managing visual sprite cycles:
 * - Ghost feet wavy scallop animation
 * - Frightened ending warning flashes (14-frame toggle periods)
 * - Level clear maze flashing
 */
export class AnimationController {
  /**
   * Updates feet animations and computes the warning flash state (white vs. blue) for frightened
   * ghosts in the final frames before expiration.
   *
   * @param frightenedFramesLeft Frames of frightened mode remaining.
   */
  public updateGhostVisuals(
    ghosts: Record<string, Ghost>,
    level: number,
    frightenedFramesLeft: number
  ): void {
    const flashCount = getFrightenedFlashCount(level);

    Object.values(ghosts).forEach((ghost) => {
      ghost.updateFeetAnimation();

      if (ghost.mode === "FRIGHTENED" && frightenedFramesLeft > 0 && flashCount > 0) {
        const halfCyclesLeft = Math.floor(frightenedFramesLeft / FRIGHTENED_FLASH_TOGGLE_FRAMES);
        // Odd half-cycles (1, 3, 5, 7, 9...) display WHITE, even half-cycles display BLUE
        ghost.flashState = halfCyclesLeft < 2 * flashCount && halfCyclesLeft % 2 === 1;
      } else {
        ghost.flashState = false;
      }
    });
  }

  /**
   * Calculates whether maze walls flash during LEVEL_CLEAR sequence.
   */
  public isLevelClearFlashing(levelClearTimer: number): boolean {
    return Math.floor(levelClearTimer / 10) % 2 === 0;
  }
}
