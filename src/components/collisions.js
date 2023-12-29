/**
 * @param {{ position: { x: number, y: number }, velocity: { x: number, y: number }, radius: number }} player 
 * @param {{ position: { x: number, y: number }, width: number, height: number }} boundary 
 * @returns {boolean}
 */
export function playerBoundaryCollision(player, boundary) {
    const paddingInline = (boundary.width / 2) - player.radius - player.speed;
    const paddingBlock = (boundary.height / 2) - player.radius - player.speed;

    const playerTopEdge = player.position.y - player.radius + player.velocity.y;
    const playerRightEdge = player.position.x + player.radius + player.velocity.x;
    const playerBottomEdge = player.position.y + player.radius + player.velocity.y;
    const playerLeftEdge = player.position.x - player.radius + player.velocity.x;

    const boundaryTopEdge = boundary.position.y - paddingBlock;
    const boundaryRightEdge = boundary.position.x + boundary.width + paddingInline;
    const boundaryBottomEdge = boundary.position.y + boundary.height + paddingBlock;
    const boundaryLeftEdge = boundary.position.x - paddingInline;

    return (
        playerTopEdge <= boundaryBottomEdge &&
        playerRightEdge >= boundaryLeftEdge &&
        playerBottomEdge >= boundaryTopEdge &&
        playerLeftEdge <= boundaryRightEdge
    );
}