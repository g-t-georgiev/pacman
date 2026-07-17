import { parseHexNumToCSSColor } from "../utils.js";
import Pellet from "./Pellet.js";

export default class PowerPellet extends Pellet {
  constructor(ctx, { position, radius = 10, reward = 50, color = 0xdead8e }) {
    super(ctx, { position, radius, reward, color });
    this.colors = [0xffffff, 0xffff00, 0xdead8e];
    this.pulsingTime = 10;
  }

  draw() {
    this.pulsingTime--;
    if (this.pulsingTime <= 0) {
      this.pulsingTime = 10;

      let currentColorIndex = this.colors.findIndex(color => parseHexNumToCSSColor(color) === this.color);
      if (currentColorIndex !== -1) {
        currentColorIndex = (currentColorIndex + 1) % this.colors.length;
        this.color = parseHexNumToCSSColor(this.colors[currentColorIndex]);
      }
    }
    super.draw();
  }
}