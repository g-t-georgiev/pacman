import { PATH_DIRECTIONS } from '../constants.js';
import { parseHexNumToCSSColor } from "../utils.js";
import Tile from "./tile.js";
import Boundary from "./boundary.js";
import { Pellet, PowerPellet } from "./pellet.js";

let tilemap = null;

export default class Tilemap {
    #map;
    #ctx;
    #currLvlTargetScorePts = 0;

    constructor(ctx, map, cols, rows, size) {
        this.#ctx = ctx;
        this.#map = map;
        this.cols = cols;
        this.rows = rows;
        this.size = size;

        this.drawGridLines = false;

        if (tilemap && tilemap instanceof Tilemap) {
            Object.assign(tilemap, this);
            return tilemap;
        }

        tilemap = this;
    }

    get map() {
        return this.#map;
    }

    setup(loader) {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                let i = (row * this.cols) + col;
                const tile = this.map[i];

                if (['.', 'p'].includes(tile)) {
                    const x = col * this.size + this.size / 2;
                    const y = row * this.size + this.size / 2;
                    const tileObject = tile === '.'
                    ? new Pellet(this.#ctx, { position: { x, y }, radius: 3 })
                    : new PowerPellet(this.#ctx, { position: { x, y }, radius: 7 });
                    this.map[i] = tileObject;
                    this.#currLvlTargetScorePts += tileObject.reward;
                } else {                  
                    const x = this.size * col;
                    const y = this.size * row;

                    if (tile === ' ' | tile === '') {
                        this.map[i] = new Tile(this.#ctx, { position: { x, y }, width: this.size, height: this.size });
                        continue;
                    }

                    const data = loader.assets[tile]?.data;
                    
                    if (data) {
                        this.map[i] = new Boundary(this.#ctx, { position: { x, y }, width: this.size, height: this.size, image: data, alpha: .17 });
                    }
                }
            }
        }

        return this;
    }

    draw() {
        if (this.#ctx == null) return;

        this.#ctx.save();
        this.#ctx.strokeStyle = parseHexNumToCSSColor(0x666666);
        this.#ctx.lineWidth = 1;

        this.map.forEach((tile, i) => {
            if (tile) {
                tile.draw?.();
    
                if (this.drawGridLines) {
                    const col = i % this.cols;
                    const row = Math.floor(i / this.cols);
                    this.#ctx.strokeRect(col * this.size, row * this.size, this.size, this.size);
                }
            }
        });
        this.#ctx.restore();
    }

    /**
     * Get a tile reference from the map, based on xy coordinates.
     * @param {number} x 
     * @param {number} y 
     * @returns {Tile}
     */
    getTile(x, y) {
        const row = Math.floor(y / this.size);
        const col = Math.floor(x / this.size);
        const index = row * this.cols + col;
        // console.log(x, y, row, col, index);
        const tile = this.map[index];
        // console.log(tile.constructor.name);
        return tile;
    }

    /**
     * Check for collision between pacman and a pellet and remove it from the stage.
     * @param {Readonly<{ width: number; height: number; radius: number; position: { x: number y: number }; direction: number; speed: number; }>} pacman 
     * @returns {void}
     */
    removePelletOnOverlap(pacman) {

        if (!pacman.collidable) return;
        
        let currentTile = null;
        let minDistance;
        let isColliding = false;

        if (pacman.direction === PATH_DIRECTIONS.Up) {
            currentTile = this.getTile(pacman.position.x, pacman.position.y + pacman.speed);
        } else if (pacman.direction === PATH_DIRECTIONS.Left) {
            currentTile = this.getTile(pacman.position.x + pacman.speed, pacman.position.y);
        } else if (pacman.direction === PATH_DIRECTIONS.Down) {
            currentTile = this.getTile(pacman.position.x, pacman.position.y + pacman.height - pacman.speed)
        } else if (pacman.direction === PATH_DIRECTIONS.Right) {
            currentTile = this.getTile(pacman.position.x + pacman.width - pacman.speed, pacman.position.y);
        }

        if (currentTile instanceof Pellet && currentTile.eaten === false) {
            minDistance = Math.hypot(
                pacman.center.x - currentTile.center.x,
                pacman.center.y - currentTile.center.y
            );
            isColliding = minDistance < pacman.radius + currentTile.radius - currentTile.radius;
        }

        if (isColliding) {
            currentTile.eaten = true;
            const index = this.map.findIndex(tile => tile === currentTile);
            if (index !== -1) {
                const newTile = new Tile(this.#ctx, { position: { ...currentTile.position }, width: this.size, height: this.size });
                this.map.splice(index, 1, newTile);
            }

            const detail = { score: currentTile.reward, targetScore: this.#currLvlTargetScorePts, isPowerUp: currentTile instanceof PowerPellet };
            const event = new CustomEvent('pacman:scoreup', { detail });
            this.#ctx.canvas.dispatchEvent(event);
        }
    }
}