export const PlayerControls = {
    get Move() {
        return {
            get Up() {
                return ['ArrowUp', 'KeyW'];
            },
            get Down() {
                return ['ArrowDown', 'KeyS'];
            },
            get Left() {
                return ['ArrowLeft', 'KeyA'];
            },
            get Right() {
                return ['ArrowRight', 'KeyD'];
            }
        }
    }
}

export class Player {
    static speed = 2;
    static radius = 15;

    /**
     * @param {CanvasRenderingContext2D} context 
     * @param {{ position: { x: number, y: number }, velocity: { x: number, y: number }, color?: string, radius?: number, speed?: number }} options 
     */
    constructor(context, { position, velocity, radius, color = 'yellow', speed }) {
        this.context = context;
        this.position = position;
        this.velocity = velocity;
        this.color = color;

        if (radius) {
            Player.radius = radius;
        }

        if (speed) {
            Player.speed = speed;
        }

        this.mouthGap = 0.75;
        this.chompingRate = 0.12;
        this.rotation = 0;
    }

    get radius() {
        return Player.radius;
    }

    get speed() {
        return Player.speed;
    }

    draw() {
        this.context.save();
        this.context.translate(this.position.x, this.position.y);
        this.context.rotate(this.rotation);
        this.context.translate(-this.position.x, -this.position.y);
        this.context.fillStyle = this.color;
        this.context.beginPath();
        this.context.arc(this.position.x, this.position.y, this.radius, this.mouthGap, Math.PI * 2 - this.mouthGap);
        this.context.lineTo(this.position.x, this.position.y);
        this.context.fill();
        this.context.restore();
    }

    update(dt) {
        this.position.x += this.velocity.x;
        this.position.y += this.velocity.y;

        if (this.velocity.x || this.velocity.y) {
            if (this.mouthGap < 0 || this.mouthGap > 0.75) {
                this.chompingRate = -this.chompingRate;
            }
    
            this.mouthGap += this.chompingRate;
        } else {
            this.mouthGap = 0.75;
        }

        this.draw();
    }
}