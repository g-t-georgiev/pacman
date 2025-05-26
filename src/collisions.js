/**
 * Checks for a collision between two rectangular objects.
 * @param {{ x: number, y: number, width: number, height: number }} rect1 
 * @param {{ x: number, y: number, width: number, height: number }} rect2 
 * @returns {boolean}
 */
export function checkFor2RectCollisions(rect1, rect2) {
    return (
        rect1.y <= rect2.y + rect2.height &&
        rect1.x + rect1.width >= rect2.x &&
        rect1.y + rect1.height >= rect2.y &&
        rect1.x <= rect2.x + rect2.width
    );
}

/**
 * Calculates the distance between the center points of 
 * two circles and if that distance is less or equal 
 * to the sum between their radii, collision has occured.
 * @param {{ x: number: y: number; radius: number }} circle1 
 * @param {{ x: number: y: number; radius: number }} circle2 
 * @returns {boolean}
 */
export function checkFor2CircleCollisions(circle1, circle2) {
    let dx = circle1.x - circle2.x;
    let dy = circle1.y - circle2.y;
    let distance = Math.sqrt(dx ** 2 + dy ** 2);
    return distance <= circle1.radius + circle2.radius;
}

/**
 * Checks for `solid` property existence and its value on an object.
 * @param {{ solid?: boolean }} obj 
 * @returns {boolean}
 */
export function isSolidObject(obj) {
    return (
        obj != null && typeof(obj) == 'object' && 
        Object.prototype.hasOwnProperty.call(obj, 'solid') && 
        obj.solid
    );
}