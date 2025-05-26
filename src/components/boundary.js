import { parseHexNumToCSSColor } from "../utils.js";

export default class Boundary {
    #ctx;
    #width;
    #height;

    constructor(ctx, { position, image, width, height, color = 0x3c32c3, alpha = 1, solid = true }) {
        this.#ctx = ctx;
        this.#width = width;
        this.#height = height;
        this.position = position;
        this.color = parseHexNumToCSSColor(color);
        this.alpha = alpha;
        this.solid = solid;
        this.image = image;
    }

    get width() {
        return this.#width;
    }

    get height() {
        return this.#height;
    }

    update({ position, image, width, height, color, alpha, solid }) {
        if (position && typeof position === 'object') Object.assign(this.position, position);
        if (image && typeof image === HTMLImageElement) this.image = image;
        if (width && typeof width === 'number') this.width = width;
        if (height && typeof height) this.height = height;
        if (color && ['string', 'number'].includes(typeof(color))) this.color = parseHexNumToCSSColor(color);
        if (alpha && typeof alpha === 'number') this.alpha = alpha;
        if (solid && typeof solid === 'boolean') this.solid = solid; 
    }

    draw() {
        if (!this.#ctx) return;

        this.#ctx.save();
        this.#ctx.drawImage(this.image, this.position.x, this.position.y, this.width, this.height);
        this.#ctx.restore();

        this.#ctx.save();
        this.#ctx.globalAlpha = this.alpha;
        this.#ctx.fillStyle = this.color;
        roundRect(this.#ctx, this.position.x, this.position.y, this.width, this.height, 10);
        this.#ctx.restore();
    }
}

function roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.arcTo(x, y + height, x + radius, y + height, radius);
    ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius);
    ctx.arcTo(x + width, y, x + width - radius, y, radius);
    ctx.arcTo(x, y, x, y + radius, radius);
    ctx.fill();
}