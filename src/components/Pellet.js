import { parseHexNumToCSSColor } from "../utils.js";

export default class Pellet {
  #ctx;

  constructor(ctx, { position, radius = 4, reward = 10, color = 0xdead8e }) {
    this.#ctx = ctx;
    this.position = position;
    this.color = parseHexNumToCSSColor(color);
    this.reward = reward;
    this.radius = radius;
    this.eaten = false;
  }

  get center() {
    return {
      x: this.position.x + this.radius,
      y: this.position.y + this.radius
    };
  }

  update({ position, radius, reward, color }) {
    if (position && typeof position === "object") Object.assign(this.position, position);
    if (radius && typeof radius === "number") this.radius = radius;
    if (reward && typeof reward === "number") this.reward = reward;
    if (color && ["string", "number"].includes(typeof (color))) this.color = parseHexNumToCSSColor(color);
  }

  draw() {
    if (!this.#ctx) return;
    this.#ctx.save();
    this.#ctx.fillStyle = this.color;
    this.#ctx.beginPath();
    this.#ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
    this.#ctx.fill();
    this.#ctx.restore();
  }
}