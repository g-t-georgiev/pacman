import type { Ghost } from "../core/Ghost";
import type { Pacman } from "../core/Pacman";
import { FRIGHTENED_FLASH_TOGGLE_DURATION } from "../game/constants";
import { getFrightenedFlashCount } from "../utils";

/**
 * Animation Controller responsible for managing visual sprite cycles:
 * - Pac-Man mouth chomp oscillation
 * - Ghost feet wavy scallop animation
 * - Frightened ending warning flashes (14-frame toggle periods)
 * - Level clear maze flashing
 */
export class AnimationController {
  /**
   * Updates Pac-Man mouth chomp animation.
   */
  public updatePacmanAnimation(pacman: Pacman, gameSpeed: number): void {
    if (pacman.isDying) return;
    pacman.updateMouthAnimation(gameSpeed);
  }

  /**
   * Updates feet animations and computes the authentic warning flash state
   * (White vs. Blue) for frightened ghosts in the final moments before expiration.
   */
  public updateGhostVisuals(
    ghosts: Record<string, Ghost>,
    level: number,
    frightenedTimer: number,
    gameSpeed: number
  ): void {
    const flashCount = getFrightenedFlashCount(level);

    Object.values(ghosts).forEach((ghost) => {
      ghost.updateFeetAnimation(gameSpeed);

      if (ghost.mode === "FRIGHTENED" && frightenedTimer > 0 && flashCount > 0) {
        const halfCyclesLeft = Math.floor(frightenedTimer / FRIGHTENED_FLASH_TOGGLE_DURATION);
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
