export class Boundary {
    static width = 40;
    static height = 40;

    /**
     * @param {CanvasRenderingContext2D} context 
     * @param {{ position: { x: number, y: number }, image: HTMLImagElement, width?: number, height?: number }} options 
     */
    constructor(context, { position, image, width, height, color = 'green' }) {
        this.context = context;
        this.position = position;
        this.color = color;
        this.image = image;

        if (width) {
            Boundary.width = width;
        }

        if (height) {
            Boundary.height = height;
        }
    }

    get width() {
        return Boundary.width;
    }

    get height() {
        return Boundary.height;
    }

    draw() {
        // this.context.fillStyle = this.color;
        // drawRoundRect(this.context, this.position.x, this.position.y, this.width, this.height, 10);

        this.context.drawImage(this.image, this.position.x, this.position.y);
    }
}

function drawRoundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x, y + radius);
    ctx.arcTo(x, y + height, x + radius, y + height, radius);
    ctx.arcTo(x + width, y + height, x + width, y + height - radius, radius);
    ctx.arcTo(x + width, y, x + width - radius, y, radius);
    ctx.arcTo(x, y, x, y + radius, radius);
    ctx.fill();
}