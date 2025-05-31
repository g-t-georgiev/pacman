import { PATH_DIRECTIONS, PATH_DIRECTIONS_LIST } from '../constants.js';
import { parseHexNumToCSSColor, updateVelocity, drawPathFromPoints } from "../utils.js";
import { isSolidObject, checkFor2RectCollisions } from "../collisions.js";

import Hero from "./hero.js";

const SVG_WIDTH = 140;
const SVG_HEIGHT = 140;

const BODY_COLOR_FRIGHTENED1 = parseHexNumToCSSColor(0x1e1ce9);
const BODY_COLOR_FRIGHTENED2 = parseHexNumToCSSColor(0xffffff);
const FACE_COLOR_FRIGHTENED1 = parseHexNumToCSSColor(0xf7b8b1);
const FACE_COLOR_FRIGHTENED2 = parseHexNumToCSSColor(0xea1d26);

export const GHOSTS_IDS = {
    0: 'Blinky',
    1: 'Inky',
    2: 'Pinky',
    3: 'Clyde'
};

export const getGhostsData = (tileSize) => ({
    Blinky: {
        name: 'Blinky',
        color: 0xe90402,
        position: { x: tileSize * 8, y: tileSize },
        startTime: 1200,
    },
    Inky: {
        name: 'Inky',
        color: 0x09b4df,
        position: { x: tileSize, y: tileSize * 7 },
        startTime: 2000,
    },
    Pinky: {
        name: 'Pinky',
        color: 0xde91b8,
        position: { x: tileSize * 9, y: tileSize * 5 },
        startTime: 2300,
    },
    Clyde: {
        name: 'Clyde',
        color: 0xe09101,
        position: { x: tileSize * 5, y: tileSize * 11 },
        startTime: 5000,
    }
});

export default class Ghost extends Hero {

    #ctx = null;
    #map = null;
    #width = 40;
    #height = 40;
    #radius = 15;

    #fringeToggle = false;
    #fringeShiftTime = 0;
    #fringeShiftInterval = 30;

    #scared = false;
    #frightenedStateTime = 0;
    #frightenedStateTimeStep = 15;
    #frightenedStateInterval = 5000;

    #bodyColor;
    #faceColor;
    #isFlashingWhite = false;

    direction = null;
    requestedDirection = null;

    startTimeout = null;
    startTime = 0;

    constructor(ctx, map, { position, velocity, width, height, radius = 15, speed = 1, color = 0xe90402, name, startTime = 0 }) {
        
        super();

        this.name = name;
        this.position = position ?? { x: 0, y: 0 };
        this.velocity = velocity ?? { x: 0, y: 0 };
        this.speed = speed;
        this.color = parseHexNumToCSSColor(color, this.alpha);

        this.#ctx = ctx;
        this.#map = map;
        this.#width = width;
        this.#height = height;
        this.#radius = radius;
        this.#bodyColor = this.color;

        this.startTime = startTime;

        this.collisions = [];

        this.drawCollisionBox = false;
        this.drawBoxQuadrants = false;
    }

    get width() {
        return this.#width;
    }

    set width(value) {
        this.#width = value;
    }

    get height() {
        return this.#height;
    }

    set height(value) {
        this.#height = value;
    }

    get radius() {
        return this.#radius;
    }

    set radius(value) {
        this.#radius = value;
    }

    get centerX() {
        return this.position.x + this.width * 0.5;
    }

    get centerY() {
        return this.position.y + this.height * 0.5;
    }

    /** @private */
    get eyeBallRadiusX() {
        return this.radius / 3;
    }

    /** @private */
    get eyeBallRadiusY() {
        return this.radius / 2.3;
    }

    /** @private */
    get eyeSocketRadiusX() {
        return this.radius / 6;
    }

    /** @private */
    get eyeSocketRadiusY() {
        return this.radius / 6;
    }

    /** @private */
    get bodyColor() {
        return this.#bodyColor;
    }

    /** @private */
    get faceColor() {
        return this.#faceColor;
    }

    get isScared() {
        return this.#scared;
    }

    update({ position, velocity, width, height, radius, speed, color }) {
        if (position && typeof position === 'object') Object.assign(this.position, position);
        if (velocity && typeof velocity === 'object') Object.assign(this.velocity, velocity);
        if (typeof width === 'number') this.width = width;
        if (typeof height === 'number') this.height = height;
        if (typeof radius === 'number') this.radius = radius;
        if (typeof speed === 'number') this.speed = speed;
        if (color && ['string', 'number'].includes(typeof color)) this.color = parseHexNumToCSSColor(color, this.alpha);
    }

    draw() {
        this.#ctx.save();

        (this.#fringeToggle 
            ? drawGhostBodyState1 
            : drawGhostBodyState2
        )(
            this.#ctx,
            this.centerX,
            this.centerY, 
            this.radius,
            this.bodyColor
        );

        // draw body outline
        // this.#ctx.strokeStyle = parseHexNumToCSSColor(0xffffff);
        // this.#ctx.stroke();

        (this.#scared ? drawScaredGhostFace : drawGhostEyes)(this.#ctx, this);

        this.#ctx.restore();

        if (this.drawCollisionBox) {
            this.#ctx.save();
            this.#ctx.strokeStyle = parseHexNumToCSSColor(0xff0000);
            this.#ctx.strokeRect(this.position.x, this.position.y, this.width, this.height);
            this.#ctx.restore();
        }

        if (this.drawBoxQuadrants) {
            this.#ctx.save();

            this.#ctx.fillStyle = parseHexNumToCSSColor(0xffffff, 0.5);
            this.#ctx.fillRect(this.position.x, this.position.y, this.#width, this.height);

            this.#ctx.lineWidth = 2;
            this.#ctx.setLineDash([4, 1]);
            this.#ctx.strokeStyle = parseHexNumToCSSColor(0x000000);
            this.#ctx.beginPath();
            this.#ctx.moveTo(this.centerX - 0.5, this.position.y);
            this.#ctx.lineTo(this.centerX - 0.5, this.position.y + this.height);
            this.#ctx.moveTo(this.position.x, this.centerY - 0.5);
            this.#ctx.lineTo(this.position.x + this.width, this.centerY - 0.5);
            this.#ctx.stroke();

            this.#ctx.beginPath();
            this.#ctx.arc(this.centerX, this.centerY, this.radius, 0, 2 * Math.PI, true);
            this.#ctx.stroke();

            this.#ctx.restore();
        }
    }

    render(dt) {

        if (this.#scared) {
            this.#updateFrightenedState(dt * this.#frightenedStateTimeStep);
        }

        this.#updateRequestedDirection();
        const currentCollisions = this.#detectCollisions();

        if (currentCollisions.length > this.collisions.length) {
            this.collisions = currentCollisions;
        }

        if (!this.#arraysEqual(currentCollisions, this.collisions)) {
            this.#handleCollisionChanges(currentCollisions);
        } else {
            this.#handleNoCollisionChange(currentCollisions);
        }

        this.position.x += this.velocity.x * dt;
        this.position.y += this.velocity.y * dt;

        this.#fringeShiftTime += dt;
        if (this.#fringeShiftTime >= this.#fringeShiftInterval) {
            this.#fringeShiftTime %= this.#fringeShiftInterval;
            this.#fringeToggle = !this.#fringeToggle;
        }

        this.draw();
    }

    enterFrightenedState() {
        if (this.#scared) return;
        this.#scared = true;
        this.#bodyColor = BODY_COLOR_FRIGHTENED1;
        this.#faceColor = FACE_COLOR_FRIGHTENED1;
    }

    #exitFrightenedState() {
        if (!this.#scared) return;
        this.#scared = false;
        this.#isFlashingWhite = false;
        this.#bodyColor = this.color;
        this.#frightenedStateTime = 0;
    }

    #updateFrightenedState(timestep) {
        if (!this.#scared) return;

        this.#frightenedStateTime += timestep;
        const remainingTime = this.#frightenedStateInterval - this.#frightenedStateTime;

        if (remainingTime <= 0) {
            this.#exitFrightenedState();
            return;
        }

        if (remainingTime <= this.#frightenedStateInterval / 3) {
            const flashInterval = 250;
            const flashCycle = Math.floor(this.#frightenedStateTime / flashInterval);
            this.#isFlashingWhite = flashCycle % 2 === 0;
            this.#bodyColor = this.#isFlashingWhite ? BODY_COLOR_FRIGHTENED2 : BODY_COLOR_FRIGHTENED1;
            this.#faceColor = this.#isFlashingWhite ? FACE_COLOR_FRIGHTENED2 : FACE_COLOR_FRIGHTENED1;
        } else {
            this.#bodyColor = BODY_COLOR_FRIGHTENED1;
        }
    }

    #updateRequestedDirection() {
        if (this.velocity.x < 0) this.requestedDirection = PATH_DIRECTIONS.Left;
        else if (this.velocity.x > 0) this.requestedDirection = PATH_DIRECTIONS.Right;
        else if (this.velocity.y < 0) this.requestedDirection = PATH_DIRECTIONS.Up;
        else if (this.velocity.y > 0) this.requestedDirection = PATH_DIRECTIONS.Down;
    }

    #detectCollisions() {
        const collisions = [];
        // Up
        this.#checkSide(0, -this.speed, PATH_DIRECTIONS.Up, true, collisions);
        // Down
        this.#checkSide(0, this.height + this.speed, PATH_DIRECTIONS.Down, true, collisions);
        // Left
        this.#checkSide(-this.speed, 0, PATH_DIRECTIONS.Left, false, collisions);
        // Right
        this.#checkSide(this.width + this.speed, 0, PATH_DIRECTIONS.Right, false, collisions);
        return collisions;
    }

    #checkSide(dx, dy, direction, checkAlignByX, collisionsListRef) {
        const pos = { x: this.position.x + dx, y: this.position.y + dy, width: this.width, height: this.height };
        const tile = this.#map.getTile(pos.x, pos.y);
        const solid = isSolidObject(tile);
        const colliding = tile && checkFor2RectCollisions(pos, { ...tile.position, width: tile.width, height: tile.height });
        const aligned = checkAlignByX ? Number.isInteger(this.position.x / this.#map.size) : Number.isInteger(this.position.y / this.#map.size);

        if (aligned) {
            if (solid && colliding) collisionsListRef.push(direction);
        } else {
            collisionsListRef.push(direction);
        }
    };

    #handleCollisionChanges(currentCollisions) {
        if (this.requestedDirection) this.collisions.push(this.requestedDirection);

        let pathways = this.collisions.filter(c => !currentCollisions.includes(c));

        pathways = this.#removeOppositeDirections(pathways);

        const direction = pathways[Math.floor(Math.random() * pathways.length)];
        if (direction) {
            this.direction = direction;
            updateVelocity(this, direction);
        }
        this.collisions.length = 0;
    }

    #handleNoCollisionChange(currentCollisions) {
        if (currentCollisions.includes(this.requestedDirection)) {
            let pathways = PATH_DIRECTIONS_LIST.filter(p => !currentCollisions.includes(p));
            pathways = this.#removeOppositeDirections(pathways);
            const direction = pathways[Math.floor(Math.random() * pathways.length)];
            if (direction) {
                this.direction = direction;
                updateVelocity(this, direction);
                this.collisions.length = 0;
            }
        }
    }

    #removeOppositeDirections(pathways) {
        switch (this.direction) {
            case PATH_DIRECTIONS.Up:
                return pathways.filter(p => p !== PATH_DIRECTIONS.Down);
            case PATH_DIRECTIONS.Down:
                return pathways.filter(p => p !== PATH_DIRECTIONS.Up);
            case PATH_DIRECTIONS.Left:
                return pathways.filter(p => p !== PATH_DIRECTIONS.Right);
            case PATH_DIRECTIONS.Right:
                return pathways.filter(p => p !== PATH_DIRECTIONS.Left);
            default:
                return pathways;
        }
    }

    #arraysEqual(arr1, arr2) {
        if (arr1.length !== arr2.length) return false;
        const sorted1 = [...arr1].sort();
        const sorted2 = [...arr2].sort();
        return sorted1.every((val, idx) => val === sorted2[idx]);
    }
}

/**
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} centerX 
 * @param {number} centerY 
 * @param {number} radius 
 * @param {number} radius 
 * @param {string} color 
 */
function drawGhostBodyState1(ctx, centerX, centerY, radius, color) {
    ctx.fillStyle = color;
    drawPathFromPoints(ctx, centerX, centerY, radius, [
        [51, 1], [51, 11], [31, 11], [31, 21], [21, 21], [21, 31],
        [11, 31], [11, 61], [1, 61], [1, 131], [11, 131], [11, 141],
        [31, 141], [31, 131], [41, 131], [41, 121], [51, 121], [51, 131],
        [61, 131], [61, 141], [81, 141], [81, 131], [91, 131], [91, 121],
        [101, 121], [101, 131], [111, 131], [111, 141], [131, 141], [131, 131],
        [141, 131], [141, 61], [131, 61], [131, 31], [121, 31], [131, 31],
        [121, 31], [121, 21], [111, 21], [111, 11], [91, 11], [91, 1], [51, 1]
    ], SVG_WIDTH, SVG_HEIGHT);
}

/**
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} centerX 
 * @param {number} centerY 
 * @param {number} radius 
 * @param {number} radius 
 * @param {string} color 
 */
function drawGhostBodyState2(ctx, centerX, centerY, radius, color) {
    ctx.fillStyle = color;
    drawPathFromPoints(ctx, centerX, centerY, radius, [
        [51, 1], [51, 11], [31, 11], [31, 21], [21, 21], [21, 31],
        [11, 31], [11, 51], [1, 51], [1, 141], [11, 141], [11, 131],
        [21, 131], [21, 121], [31, 121], [31, 131], [41, 131], [41, 141],
        [61, 141], [61, 121], [81, 121], [81, 141], [101, 141], [101, 131],
        [111, 131], [111, 121], [121, 121], [121, 131], [131, 131], [131, 141],
        [141, 141], [141, 51], [131, 51], [131, 31], [121, 31], [121, 21],
        [111, 21], [111, 11], [91, 11], [91, 1], [51, 1]
    ], SVG_WIDTH, SVG_HEIGHT);
}

/**
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Ghost} ghost 
 */
function drawGhostEyes(ctx, ghost) {
    const {
        eyeBallRadiusX,
        eyeBallRadiusY,
        eyeSocketRadiusX,
        eyeSocketRadiusY,
        centerX,
        centerY,
        radius,
        direction
    } = ghost;

    // Draw eyeballs
    ctx.fillStyle = parseHexNumToCSSColor(0xffffff);
    ctx.beginPath();
    ctx.ellipse(centerX - radius / 2.5, centerY, eyeBallRadiusX, eyeBallRadiusY, 0, 0, 2 * Math.PI);
    ctx.ellipse(centerX + radius / 2.5, centerY, eyeBallRadiusX, eyeBallRadiusY, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Calculate retina direction offset
    const offset = {
        x: 0,
        y: 0
    };

    const offsetAmount = eyeBallRadiusX * 0.5;

    switch (direction) {
        case PATH_DIRECTIONS.Left:
            offset.x = -offsetAmount;
            break;
        case PATH_DIRECTIONS.Right:
            offset.x = offsetAmount;
            break;
        case PATH_DIRECTIONS.Up:
            offset.y = -offsetAmount;
            break;
        case PATH_DIRECTIONS.Down:
            offset.y = offsetAmount;
            break;
    }

    // Draw pupils
    ctx.fillStyle = parseHexNumToCSSColor(0x0000ff);
    ctx.beginPath();
    ctx.ellipse(centerX - radius / 2.5 + offset.x, centerY + offset.y, eyeSocketRadiusX, eyeSocketRadiusY, 0, 0, 2 * Math.PI);
    ctx.ellipse(centerX + radius / 2.5 + offset.x, centerY + offset.y, eyeSocketRadiusX, eyeSocketRadiusY, 0, 0, 2 * Math.PI);
    ctx.fill();
}

/**
 * @param {CanvasRenderingContext2D} ctx 
 * @param {Ghost} ghost 
 */
function drawScaredGhostFace(ctx, ghost) {

    const {
        eyeSocketRadiusX,
        eyeSocketRadiusY,
        centerX,
        centerY,
        radius,
        faceColor
    } = ghost;

    // Draw pupils
    ctx.fillStyle = faceColor;
    ctx.beginPath();
    ctx.ellipse(centerX - radius / 2.5, centerY - radius * 0.25, eyeSocketRadiusX, eyeSocketRadiusY, 0, 0, 2 * Math.PI);
    ctx.ellipse(centerX + radius / 2.5, centerY - radius * 0.25, eyeSocketRadiusX, eyeSocketRadiusY, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Draw mouth
    drawPathFromPoints(ctx, centerX, centerY, radius, [
        [11, 101], [21, 101], [21, 91], [41, 91], [41, 101], [61, 101], 
        [61, 91], [81, 91], [81, 101], [101, 101], [101, 91], [121, 91], 
        [121, 101], [131, 101], [131, 91], [121, 91], [121, 81], [101, 81], 
        [101, 91], [81, 91], [81, 81], [61, 81], [61, 91], [41, 91], 
        [41, 81], [21, 81], [21, 91], [11, 91], [11, 101]
    ], SVG_WIDTH, SVG_HEIGHT);
}
