export class Pellet {
    static radius = 3;

    /**
     * @param {CanvasRenderingContext2D} context 
     * @param {{ position: { x: number, y: number }, radius?: number, reward?: number, color?: string }} options 
     */
    constructor(context, { position, radius, reward = 10, color = 'white' }) {
        this.context = context;
        this.position = position;
        this.color = color;
        this.reward = reward;
        
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
     * @param {{ position: { x: number, y: number }, radius?: number, color?: string, reward?: number }} options 
     */
    constructor(context, { position, radius, reward = 20, color = 'yellow' }) {
        super(context, { position, radius, reward, color });
        this.colors = ['white', 'yellow', 'pink'];
        this.pulsingTime = 10;
    }

    draw() {
        this.pulsingTime--;
        if (this.pulsingTime <= 0) {
            this.pulsingTime = 10;

            let currentColorIndex = this.colors.findIndex(color => color === this.color);
            if (currentColorIndex !== -1) {
                currentColorIndex = (currentColorIndex + 1) % this.colors.length;
                this.color = this.colors[currentColorIndex];
            }
        }
        super.draw();
    }
}