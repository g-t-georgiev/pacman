/**
 * @class
 * @abstract
 */
export class Hero {

    debug = false;

    /**
     * @throws Cannot instantiate abstract class
     * @constructor
     */
    constructor() {
        if (this.constructor.name == 'Hero') {
            throw new Error('Cannot instantiate abstract class');
        }

        this.interactive = false;
        this.collidable = true;
        this.alpha = 1;
    }

    get center() {
        return { 
            x: this.position.x + this.width * 0.5, 
            y: this.position.y + this.height * 0.5
        };
    }

    freeze() {
        if (this.velocity) {
            this.velocity.x = 0;
            this.velocity.y = 0;
        }
    }

    updateProps({ position, velocity, width, height, radius, speed, color }) {
        if (position && typeof position === 'object') Object.assign(this.position, position);
        if (velocity && typeof velocity === 'object') Object.assign(this.velocity, velocity);
        if (typeof width === 'number') this.width = width;
        if (typeof height === 'number') this.height = height;
        if (typeof radius === 'number') this.radius = radius;
        if (typeof speed === 'number') this.speed = speed;
        if (color && ['string', 'number'].includes(typeof color)) this.color = parseHexNumToCSSColor(color, this.alpha);
    }

    /**
     * Logs a set of arguments in the console,
     * only if `debug` property is set to **true**.
     * 
     * @param  {...any} data 
     * @returns {void}
     */
    log(...args) {
        if (this.debug) {
            console.log(...args);
        }
    }

}

export default Hero;