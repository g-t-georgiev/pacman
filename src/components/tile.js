import { parseHexNumToCSSColor } from "../utils.js";

export default class Tile {
    #ctx;
    #width;
    #height;

    constructor(ctx, { position, width, height, color = 0x000000 }) {
        this.#ctx = ctx;
        this.position = position;
        this.#width = width;
        this.#height = height;
        this.color = parseHexNumToCSSColor(color);
    }

    get width() {
        return this.#width;
    }

    get height() {
        return this.#height;
    }

    update({ position, width, height, color }) {
        if (position && typeof position === 'object') Object.assign(this.position, position);
        if (width && typeof width === 'number') this.width = width;
        if (height && typeof height === 'number') this.height = height;
        if (color && ['string', 'number'].includes(typeof(color))) this.color = parseHexNumToCSSColor(color);
    }

    draw() {
        this.#ctx.save();
        this.#ctx.beginPath();
        this.#ctx.fillStyle = this.color;
        this.#ctx.rect(this.position.x, this.position.y, this.width, this.height);
        this.#ctx.fill();
        this.#ctx.restore();
    }
}