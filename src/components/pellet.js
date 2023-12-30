export class Pellet {
    static radius = 3;

    /**
     * @param {CanvasRenderingContext2D} context 
     * @param {{ position: { x: number, y: number }, radius?: number, color?: string }} options 
     */
    constructor(context, { position, radius, color = 'white' }) {
        this.context = context;
        this.position = position;
        this.color = color;
        
        if (radius) {
            Pellet.radius = radius;
        }

        this.radius = Pellet.radius;
    }

    draw() {
        this.context.fillStyle = this.color;
        this.context.beginPath();
        this.context.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        this.context.fill();
    }
}

export class PowerUp extends Pellet {
    /**
     * @param {CanvasRenderingContext2D} context 
     * @param {{ position: { x: number, y: number }, radius?: number }} options 
     */
    constructor(context, { position, radius }) {
        super(context, { position, radius });
    }
}