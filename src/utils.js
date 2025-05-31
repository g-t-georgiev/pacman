import { PATH_DIRECTIONS } from './constants.js';

/**
 * Creates and returns an image element.
 * @param {string} src 
 * @returns {HTMLImageElement}
 */
export function createImage(src) {
    const image = new Image();
    image.src = src;
    return image;
}

/**
 * Compose rgba css color string value.
 * @param {number} r 
 * @param {number} g 
 * @param {number} b 
 * @param {number} a 
 * @returns {string}
 */
export function rgba(r, g, b, a) {
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/**
 * Parses hexadecimal number to CSS hexadecimal color values.
 * @param {number | string} value 
 * @param {number} alpha 
 * @returns {string}
 */
export function parseHexNumToCSSColor(value, alpha = 1) {
    if (alpha < 0 || typeof alpha !== 'number') {
        console.error('Invalid alpha parameter.');
        alpha = 1;
    }

    alpha = parseFloat(alpha.toFixed(2));
    
    if (value != null && typeof value === 'number') {
        let hex = (value | 0).toString(16);
        hex = '00000' + hex.replace(/^0x/, '');
        hex = hex.substring(hex.length - 6);

        if (alpha !== 1) {
            const bigint = parseInt(hex, 16);
            const red = (bigint >> 16) & 255;
            const green = (bigint >> 8) & 255;
            const blue = bigint & 255;
            return rgba(red, green, blue, alpha);
        }

        return '#' + hex;
    }

    return value;
}

/**
 * @param {{ velocity: { x: number, y: number }, speed: number }} obj 
 * @param {"up" | "down" | "left" | "right"} direction 
 * @returns {void}
 */
export function updateVelocity(obj, direction) {
    switch (direction) {
        case PATH_DIRECTIONS.Up:
            obj.velocity.x = 0;
            obj.velocity.y = -obj.speed;
            break;
        case PATH_DIRECTIONS.Down:
            obj.velocity.x = 0;
            obj.velocity.y = obj.speed;
            break;
        case PATH_DIRECTIONS.Left:
            obj.velocity.x = -obj.speed;
            obj.velocity.y = 0;
            break;
        case PATH_DIRECTIONS.Right:
            obj.velocity.x = obj.speed;
            obj.velocity.y = 0;
            break;
    }
}

/**
 * @param {{ x: number, y: number }} velocity 
 * @returns {"up" | "down" | "left" | "right" | null}
 */
export function getDirectionFromVelocity(velocity) {
    if (!velocity) return null;
    if (velocity.x > 0) return 'right';
    if (velocity.x < 0) return 'left';
    if (velocity.y > 0) return 'down';
    if (velocity.y < 0) return 'up';
    return null;
}

/**
 * @param {CanvasRenderingContext2D} ctx 
 * @param {number} centerX 
 * @param {number} centerY 
 * @param {number} radius 
 * @param {[number, number][]} points 
 * @param {number} originalWidth 
 * @param {number} originalHeight 
 */
export function drawPathFromPoints(ctx, centerX, centerY, radius, points, originalWidth, originalHeight) {

    const scale = (radius * 2) / originalWidth; // SVG width normalization
    const offsetX = centerX - radius;
    const offsetY = centerY - (originalHeight * scale) / 2;

    ctx.beginPath();
    let [x, y] = points[0];
    ctx.moveTo(offsetX + x * scale, offsetY + y * scale);

    for (let i = 1; i < points.length; i++) {
        [x, y] = points[i];
        ctx.lineTo(offsetX + x * scale, offsetY + y * scale);
    }

    ctx.closePath();
    ctx.fill('nonzero');

    // ctx.strokeStyle = parseHexNumToCSSColor(0xffffff);
    // ctx.stroke();
}

/**
 * Generates a cryptographically secure random number between two values.
 *
 * Depending on the `returnFloat` flag, the function returns either:
 * - a uniformly distributed **floating-point number** in the range **[min, max)**
 * - or a uniformly distributed **integer** in the inclusive range **[min, max]**
 *
 * This function uses `crypto.getRandomValues()` to ensure cryptographic security
 * and avoids modulo bias in integer generation.
 *
 * You can choose whether to include the minimum and maximum values using `includeMin` and `includeMax`.
 * By default:
 * - Integers: inclusive of both min and max.
 * - Floats: inclusive of min, exclusive of max.
 *
 * @param {number} min - The lower bound of the range.
 * @param {number} max - The upper bound of the range.
 * @param {boolean} [returnFloat=false] - If true, returns a float in the specified range; otherwise, returns an integer.
 * @param {boolean} [includeMin=true] - Whether the minimum value is included.
 * @param {boolean} [includeMax=!returnFloat] - Whether the maximum value is included (default: true for integers, false for floats).
 * @returns {number} A random number within the specified bounds.
 *
 * @throws {Error} If the computed range is less than or equal to 0 (i.e., when min === max and returnFloat is false).
 *
 * @example
 * getRandomNumber(1, 10);          // Might return 7 (integer)
 * getRandomNumber(1, 10, true);    // Might return 4.732 (float)
 * getRandomNumber(10, 1);          // Works: automatically swaps to [1, 10]
 * getRandomNumber(5, 5);           // Always returns 5 (integer mode)
 * 
 * getRandomNumber(1, 10); // Integer between 1 and 10 (inclusive)
 * getRandomNumber(1, 10, true); // Float between 1 (inclusive) and 10 (exclusive)
 * 
 * getRandomNumber(1, 10, false, true, false); // Integer [1, 9]
 * getRandomNumber(1, 10, false, false, true); // Integer [2, 10]
 * getRandomNumber(1, 10, true, false, true); // Float (1, 10] (exclusive min, inclusive max)
 */
export function getRandomNumber(min, max, returnFloat = false, includeMin = true, includeMax = !returnFloat) {

    if (min > max) [min, max] = [max, min];

    if (returnFloat) {
        const randomUint32 = new Uint32Array(1);
        crypto.getRandomValues(randomUint32);
        let fraction = randomUint32[0] / 0x100000000; // [0, 1)

        // Adjust range based on inclusivity
        let lower = includeMin ? min : min + Number.EPSILON;
        let upper = includeMax ? max + Number.EPSILON : max;

        return lower + (upper - lower) * fraction;
    }

    // Integer path
    // Adjust min/max based on inclusivity
    let adjustedMin = includeMin ? min : min + 1;
    let adjustedMax = includeMax ? max : max - 1;

    let range = adjustedMax - adjustedMin + 1;
    if (range <= 0) throw new Error('Invalid range: no integers to choose from');

    const maxUint32 = 0xFFFFFFFF;
    const maxRange = Math.floor(maxUint32 / range) * range;

    const randomBytes = new Uint32Array(1);
    let randomUint32;

    do {
        crypto.getRandomValues(randomBytes);
        randomUint32 = randomBytes[0];
    } while (randomUint32 >= maxRange);

    return adjustedMin + (randomUint32 % range);
}
