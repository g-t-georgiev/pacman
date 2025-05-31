import { PATH_DIRECTIONS } from '../constants.js';
import { parseHexNumToCSSColor } from "../utils.js";
import { isSolidObject, checkFor2RectCollisions } from "../collisions.js";

import Hero from "./hero.js";

export const getPacmanData = (tileSize) => ({
    name: 'Pacman',
    color: 0xffff00,
    position: { x: tileSize * 5, y: tileSize * 8 },
    startTime: 1000,
});

const Controls = {
    Move: {
        Up: ['ArrowUp', 'KeyW'],
        Down: ['ArrowDown', 'KeyS'],
        Left: ['ArrowLeft', 'KeyA'],
        Right: ['ArrowRight', 'KeyD']
    }
};

const mouthGap = { idle: 0.55 };

let pacman = null;

export class Pacman extends Hero {

    #ctx;
    #map;
    #width;
    #height;
    #radius;
    #keydownHandler;
    #keyupHandler;

    startTimeout = null;
    startTime = 0;

    name = 'Pacman';
    direction = null;
    requestedDirection = null;

    constructor(ctx, map, { position, velocity, width, height, radius = 15, speed = 2, color = 0xffff00 }) {
        super();

        this.#ctx = ctx;
        this.#map = map;
        this.#width = width;
        this.#height = height;
        this.#radius = radius;
        this.position = position ?? { x: 0, y: 0 };
        this.velocity = velocity ?? { x: 0, y: 0 };
        this.speed = speed;
        this.color = parseHexNumToCSSColor(color, this.alpha);

        this.mouthGap = mouthGap.idle;
        this.chompingRate = 0.12;
        this.rotation = 0;

        this.drawCollisionBox = false;
        this.drawBoxQuadrants = false;

        if (pacman && pacman instanceof Pacman) {
            Object.assign(pacman, this);
            return pacman;
        }

        this.#keydownHandler = this.#handleKeyDown.bind(this);
        this.#keyupHandler = this.#handleKeyUp.bind(this);

        window.addEventListener('keydown', this.#keydownHandler);
        window.addEventListener('keyup', this.#keyupHandler);

        pacman = this;
    }

    get width() { return this.#width; }
    set width(value) { this.#width = value; }

    get height() { return this.#height; }
    set height(value) { this.#height = value; }

    get radius() { return this.#radius; }
    set radius(value) { this.#radius = value; }

    update({ position, velocity, width, height, radius, speed, color }) {
        if (position && typeof position === 'object') Object.assign(this.position, position);
        if (velocity && typeof velocity === 'object') Object.assign(this.velocity, velocity);
        if (typeof width === 'number') this.width = width;
        if (typeof height === 'number') this.height = height;
        if (typeof radius === 'number') this.radius = radius;
        if (typeof speed === 'number') this.speed = speed;
        if (color && (typeof color === 'string' || typeof color === 'number')) {
            this.color = parseHexNumToCSSColor(color, this.alpha);
        }
    }

    freeze() {
        super.freeze();
        this.mouthGap = mouthGap.idle;
        window.removeEventListener('keydown', this.#keydownHandler);
        window.removeEventListener('keyup', this.#keyupHandler);
    }

    render(dt) {
        if (this.requestedDirection) {
            this.#checkCollisionAndMove(this.requestedDirection);
        }

        // Update position
        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        // Remove pellet on overlap
        this.#map.removePelletOnOverlap(this);

        if (this.direction) {
            const mapSize = this.#map.size;

            // Determine tile to check collision for current direction
            let tileX = this.position.x;
            let tileY = this.position.y;

            switch (this.direction) {
                case PATH_DIRECTIONS.Right:
                    tileX = this.position.x + this.width;
                    break;
                case PATH_DIRECTIONS.Left:
                    tileX = this.position.x - this.speed;
                    break;
                case PATH_DIRECTIONS.Down:
                    tileY = this.position.y + this.height;
                    break;
                case PATH_DIRECTIONS.Up:
                    tileY = this.position.y - this.speed;
                    break;
            }

            const tile = this.#map.getTile(tileX, tileY);
            const isSolid = isSolidObject(tile);

            const playerRect = { x: this.position.x, y: this.position.y, width: this.width, height: this.height };
            const tileRect = { x: tile.position.x, y: tile.position.y, width: tile.width, height: tile.height };
            const isColliding = checkFor2RectCollisions(playerRect, tileRect);

            if (isSolid && isColliding) {
                this.velocity.x = 0;
                this.velocity.y = 0;
                // this.direction = null;
            }

            // Set rotation based on direction
            this.rotation = {
                [PATH_DIRECTIONS.Right]: 0,
                [PATH_DIRECTIONS.Left]: Math.PI,
                [PATH_DIRECTIONS.Down]: Math.PI / 2,
                [PATH_DIRECTIONS.Up]: Math.PI * 1.5,
            }[this.direction] ?? 0;

            // Animate mouth chomping
            if (this.velocity.x !== 0 || this.velocity.y !== 0) {
                if (this.mouthGap < 0 || this.mouthGap > mouthGap.idle) {
                    this.chompingRate = -this.chompingRate;
                }
                this.mouthGap += this.chompingRate * dt;
            } else {
                this.mouthGap = mouthGap.idle;
            }
        }

        this.draw();
    }

    draw() {
        const cx = this.position.x + this.#width / 2;
        const cy = this.position.y + this.#height / 2;

        this.#ctx.save();
        this.#ctx.translate(cx, cy);
        this.#ctx.rotate(this.rotation);
        this.#ctx.translate(-cx, -cy);
        this.#ctx.fillStyle = this.color;
        this.#ctx.beginPath();
        this.#ctx.arc(cx, cy, this.radius, this.mouthGap, Math.PI * 2 - this.mouthGap);
        this.#ctx.lineTo(cx, cy);
        this.#ctx.fill();
        this.#ctx.restore();

        if (this.drawCollisionBox) {
            this.#ctx.save();
            this.#ctx.strokeStyle = parseHexNumToCSSColor(0xff0000);
            this.#ctx.strokeRect(this.position.x, this.position.y, this.#width, this.#height);
            this.#ctx.restore();
        }

        if (this.drawBoxQuadrants) {
            this.#ctx.save();
            this.#ctx.lineWidth = 2;
            this.#ctx.setLineDash([4, 1]);
            this.#ctx.strokeStyle = parseHexNumToCSSColor(0xff0000);

            this.#ctx.beginPath();
            this.#ctx.moveTo(this.position.x + this.#width / 2 - 0.5, this.position.y);
            this.#ctx.lineTo(this.position.x + this.#width / 2 - 0.5, this.position.y + this.height);
            this.#ctx.moveTo(this.position.x, this.position.y + this.height / 2 - 0.5);
            this.#ctx.lineTo(this.position.x + this.width, this.position.y + this.height / 2 - 0.5);
            this.#ctx.stroke();

            this.#ctx.beginPath();
            this.#ctx.arc(this.position.x + this.width / 2, this.position.y + this.height / 2, this.radius, 0, 2 * Math.PI, true);
            this.#ctx.stroke();

            this.#ctx.restore();
        }
    }

    onLose(callback) {
        let id;
        const animationCallback = () => {
            if (this.mouthGap >= Math.PI) {
                cancelAnimationFrame(id);
                return;
            }
            callback();
            id = requestAnimationFrame(animationCallback);
        };
        id = requestAnimationFrame(animationCallback);
    }

    #handleKeyDown(event) {
        for (const [direction, codes] of Object.entries(Controls.Move)) {
            if (codes.includes(event.code)) {
                this.requestedDirection = PATH_DIRECTIONS[direction];
                break;
            }
        }
    }

    #handleKeyUp(event) {
        // Currently empty but left for future extensions if needed
    }

    #checkCollisionAndMove(direction) {
        const mapSize = this.#map.size;

        const directionVectors = {
            [PATH_DIRECTIONS.Up]:    { dx: 0, dy: -this.speed, alignAxis: 'x' },
            [PATH_DIRECTIONS.Down]:  { dx: 0, dy: this.speed, alignAxis: 'x' },
            [PATH_DIRECTIONS.Left]:  { dx: -this.speed, dy: 0, alignAxis: 'y' },
            [PATH_DIRECTIONS.Right]: { dx: this.speed, dy: 0, alignAxis: 'y' },
        };

        const { dx, dy, alignAxis } = directionVectors[direction];
        const posX = this.position.x;
        const posY = this.position.y;

        let tileX = posX;
        let tileY = posY;

        // Determine tile position to check based on direction
        switch (direction) {
            case PATH_DIRECTIONS.Up:
                tileX = posX;
                tileY = posY + dy;
                break;
            case PATH_DIRECTIONS.Down:
                tileX = posX;
                tileY = posY + this.height + dy;
                break;
            case PATH_DIRECTIONS.Left:
                tileX = posX + dx;
                tileY = posY;
                break;
            case PATH_DIRECTIONS.Right:
                tileX = posX + this.width + dx;
                tileY = posY;
                break;
        }

        const tile = this.#map.getTile(tileX, tileY);
        const isSolid = isSolidObject(tile);

        const playerRect = {
            x: posX + dx,
            y: posY + dy,
            width: this.width,
            height: this.height
        };

        const tileRect = {
            x: tile.position.x,
            y: tile.position.y,
            width: tile.width,
            height: tile.height
        };

        const isColliding = checkFor2RectCollisions(playerRect, tileRect);

        // Alignment check to allow direction change only when aligned to grid on the axis perpendicular to movement
        const isAligned = Number.isInteger(this.position[alignAxis] / mapSize);

        if (isAligned) {
            if (isSolid && isColliding) {
                // Collision: stop movement and flash tile
                if (direction === PATH_DIRECTIONS.Up || direction === PATH_DIRECTIONS.Down) {
                    this.velocity.y = 0;
                } else {
                    this.velocity.x = 0;
                }

                tile.alpha = 1;
                setTimeout(() => { tile.alpha = 0.17; }, 1000);
            } else {
                // No collision: set velocity and update direction
                this.velocity.x = dx;
                this.velocity.y = dy;
                this.direction = direction;
                this.requestedDirection = null;
            }
        }
    }
}

export default Pacman;
