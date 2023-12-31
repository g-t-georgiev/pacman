export class Ghost {
    static speed = 2;
    static radius = 15;

    /**
     * @param {CanvasRenderingContext2D} context 
     * @param {{ position: { x: number, y: number }, velocity: { x: number, y: number }, color: string, radius?: number, speed?: number }} options 
     */
    constructor(context, { position, velocity, color = 'red', radius, speed }) {
        this.context = context;
        this.position = position;
        this.velocity = velocity;
        this.color = color;
        this._color = color;
        this.moving = false;
        this.scared = false;
        this.collisions = [];

        if (radius) {
            Ghost.radius = radius;
        }
        if (speed) {
            Ghost.speed = speed;
        }
    }

    get radius() {
        return Ghost.radius;
    }

    get speed() {
        return Ghost.speed;
    }

    draw() {    
        this.context.fillStyle = this.scared ? 'blue' : this.color;
        this.context.beginPath();
        this.context.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
        this.context.fill();
    }

    update(dt, move) {
        if (move) {
            if (!this.moving) this.moving = true;
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
        }

        this.draw();
    }
}