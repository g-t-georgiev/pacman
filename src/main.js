import { Boundary } from "./components/boundary.js";
import { Player, PlayerControls } from "./components/player.js";
import { Ghost } from "./components/ghost.js";
import { Pellet, PowerUp } from "./components/pellet.js";
import { playerBoundaryCollision } from "./components/collisions.js";

const canvas = document.querySelector('canvas');
const scoreElem = document.querySelector('[data-score]');
const scoreBoxElem = scoreElem.parentElement;
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const bodyStyleMap = document.body.computedStyleMap();
const paddingBlock = parseFloat(bodyStyleMap.get('--padding-block').toString());
const paddingInline = parseFloat(bodyStyleMap.get('--padding-inline').toString());

const map = [
    ['1', '-', '-', '-', '-', '-', '-', '-', '-', '-', '2'],
    ['|', ' ', '.', '.', '.', '.', '.', '.', '.', '.', '|'],
    ['|', '.', 'b', '.', '[', '7', ']', '.', 'b', '.', '|'],
    ['|', '.', '.', '.', '.', '_', '.', '.', '.', '.', '|'],
    ['|', '.', '[', ']', '.', '.', '.', '[', ']', '.', '|'],
    ['|', '.', '.', '.', '.', '^', '.', '.', '.', '.', '|'],
    ['|', '.', 'b', '.', '[', '+', ']', '.', 'b', '.', '|'],
    ['|', '.', '.', '.', '.', '_', '.', '.', '.', '.', '|'],
    ['|', '.', '[', ']', '.', '.', '.', '[', ']', '.', '|'],
    ['|', '.', '.', '.', '.', '^', '.', '.', '.', '.', '|'],
    ['|', '.', 'b', '.', '[', '5', ']', '.', 'b', '.', '|'],
    ['|', '.', '.', '.', '.', '.', '.', '.', '.', 'p', '|'],
    ['4', '-', '-', '-', '-', '-', '-', '-', '-', '-', '3'],
]; 

const pellets = [];
const boundaries = [];
const controls = {};
const ghosts = Array.from({ length: 4 }, function (_, i) {
    return new Ghost(ctx, {
        position: {
            x: Boundary.width * (i == 1 ? 3 : i == 2 ? 8 : i == 3 ? 2 : 6) + Boundary.width / 2,
            y: Boundary.height * (i == 1 ? 5 : i == 2 ? 11 : i == 3 ? 9 : 1) + Boundary.height / 2
        },
        velocity: {
            x: 0,
            y: 0
        },
        ...(i == 1 ? { color: 'red' } : i == 2 ? { color: 'pink' } : i == 3 ? { color: 'cyan' } : { color: 'orange' })
    });
});

const player = new Player(ctx, { 
    position: { 
        x: Boundary.width + Boundary.width / 2, 
        y: Boundary.height + Boundary.height / 2 
    }, 
    velocity: {
        x: 0,
        y: 0
    }, 
    radius: 15
});

let animationId;
let imageData;
let score = 0;
let gameStarted = false;
let gameOver = false;
let lastPressedControl = null;

// Generate map boundaries
map.forEach(function (row, i) {
    row.forEach(function (cell, j) {
        switch (cell) {
            case '-': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeHorizontal.png')
                    })
                );
                break;
            }
            case '|': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeVertical.png')
                    })
                );
                break;  
            }
            case '1': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeCorner1.png')
                    })
                ); 
                break;
            }
            case '2': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeCorner2.png')
                    })
                );
                break;
            }
            case '3': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeCorner3.png')
                    })
                );
                break;
            }
            case '4': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeCorner4.png')
                    })
                );
                break;
            }
            case '5': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeConnectorTop.png')
                    })
                );
                break;
            }
            case '6': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeConnectorRight.png')
                    })
                );
                break;
            }
            case '7': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeConnectorBottom.png')
                    })
                );
                break;
            }
            case '8': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeConnectorLeft.png')
                    })
                );
                break;
            }
            case 'b': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/block.png')
                    })
                );
                break;
            }
            case '[': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/capLeft.png')
                    })
                );
                break;
            }
            case ']': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/capRight.png')
                    })
                );
                break;
            }
            case '_': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/capBottom.png')
                    })
                );
                break;
            }
            case '^': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/capTop.png')
                    })
                );
                break;
            }
            case '+': {
                boundaries.push(
                    new Boundary(ctx, { 
                        position: { 
                            x: Boundary.width * j, 
                            y: Boundary.height * i 
                        }, 
                        image: createImage('./images/pipeCross.png')
                    })
                );
                break;
            }
            case '.': {
                pellets.push(
                    new Pellet(ctx, {
                        position: {
                            x: j * Boundary.width + Boundary.width / 2,
                            y: i * Boundary.height + Boundary.height / 2
                        }
                    })
                );
                break;
            }
            case 'p': {
                pellets.push(
                    new PowerUp(ctx, {
                        position: {
                            x: j * Boundary.width + Boundary.width / 2,
                            y: i * Boundary.height + Boundary.height / 2
                        }, 
                        radius: 7, 
                    })
                );
                break;
            }
            default: break;
        }
    });
});

addEventListener('resize', windowResizeHandler);
addEventListener('keydown', onKeyDownHandler);
addEventListener('keyup', onKeyUpHandler);

windowResizeHandler();
update();


function createImage(src) {
    const image = new Image();
    image.src = src;
    return image;
}

function windowResizeHandler() {
    let width = isNaN(paddingInline) ? innerWidth : innerWidth - paddingInline * 2;
    let height = isNaN(paddingBlock) ? innerHeight : innerHeight - paddingBlock * 2;

    if (scoreBoxElem) {
        const scoreBoxRect = scoreBoxElem.getBoundingClientRect();
        const scoreBoxStyleMap = scoreBoxElem.computedStyleMap();
        const scoreBoxMarginBottom = parseFloat(scoreBoxStyleMap.get('margin-bottom').toString());
        height -= scoreBoxRect.height + scoreBoxMarginBottom;
    }

    canvas.width = width;
    canvas.height = height;

    if (gameOver && imageData != null && imageData instanceof ImageData) {
        ctx.putImageData(imageData, 0, 0);
    }
}

/**
 * @param {string} code 
 * @param {{ pressed: boolean }} state 
 */
function updateControlsState(code, state) {
    controls[code] = { ...state };
    if (state.pressed) lastPressedControl = code;
}

/**
 * @param {KeyboardEvent} event 
 */
function onKeyDownHandler(event) {
    event.preventDefault();
    if (PlayerControls.Move.Up.includes(event.code)) {
        updateControlsState(event.code, { pressed: true });
        if (!gameStarted) gameStarted = true;
    } else if (PlayerControls.Move.Down.includes(event.code)) {
        updateControlsState(event.code, { pressed: true });
        if (!gameStarted) gameStarted = true;
    } else if (PlayerControls.Move.Left.includes(event.code)) {
        updateControlsState(event.code, { pressed: true });
        if (!gameStarted) gameStarted = true;
    } else if (PlayerControls.Move.Right.includes(event.code)) {
        updateControlsState(event.code, { pressed: true });
        if (!gameStarted) gameStarted = true;
    }
}

/**
 * @param {KeyboardEvent} event 
 */
function onKeyUpHandler(event) {
    event.preventDefault();
    if (PlayerControls.Move.Up.includes(event.code)) {
        updateControlsState(event.code, { pressed: false });
    } else if (PlayerControls.Move.Down.includes(event.code)) {
        updateControlsState(event.code, { pressed: false });
    } else if (PlayerControls.Move.Left.includes(event.code)) {
        updateControlsState(event.code, { pressed: false });
    } else if (PlayerControls.Move.Right.includes(event.code)) {
        updateControlsState(event.code, { pressed: false });
    }
}

function pause() {
    return !gameStarted || gameOver;
}

function update(ts = performance.now()) {
    animationId = requestAnimationFrame(update);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Calculater player movements
    let playerClone = { ...player, position: { ...player.position }, velocity: { ...player.velocity }, radius: player.radius, speed: player.speed };
    if (PlayerControls.Move.Up.some(control => controls[control]?.pressed && lastPressedControl == control)) {
        playerClone.velocity.x = 0;
        playerClone.velocity.y = -player.speed;
        for (const boundary of boundaries) {
            boundary.color = 'green';
            if (
                playerBoundaryCollision(
                    playerClone, 
                    boundary
                )
            ) {
                boundary.color = 'red';
                player.velocity.y = 0;
                break;
            }

            player.velocity.y = -player.speed;
        }
        // console.log('Hit "MoveUp" key', player.velocity.y);
    } else if (PlayerControls.Move.Down.some(control => controls[control]?.pressed && lastPressedControl == control)) {
        playerClone.velocity.x = 0;
        playerClone.velocity.y = player.speed;
        for (const boundary of boundaries) {
            boundary.color = 'green';
            if (
                playerBoundaryCollision(
                    playerClone, 
                    boundary
                )
            ) {
                boundary.color = 'red';
                player.velocity.y = 0;
                break;
            }
            
            player.velocity.y = player.speed;
        }
        // console.log('Hit "MoveDown" key', player.velocity.y);
    } else if (PlayerControls.Move.Left.some(control => controls[control]?.pressed && lastPressedControl == control)) {
        playerClone.velocity.x = -player.speed;
        playerClone.velocity.y = 0;
        for (const boundary of boundaries) {
            boundary.color = 'green';
            if (
                playerBoundaryCollision(
                    playerClone, 
                    boundary
                )
            ) {
                boundary.color = 'red';
                player.velocity.x = 0;
                break;
            } 
            
            player.velocity.x = -player.speed;
        }
        // console.log('Hit "MoveLeft" key', player.velocity.x);
    } else if (PlayerControls.Move.Right.some(control => controls[control]?.pressed && lastPressedControl == control)) {
        playerClone.velocity.x = player.speed;
        playerClone.velocity.y = 0;
        for (const boundary of boundaries) {
            boundary.color = 'green';
            if (
                playerBoundaryCollision(
                    playerClone, 
                    boundary
                )
            ) {
                boundary.color = 'red';
                player.velocity.x = 0;
                break;
            }
            
            player.velocity.x = player.speed;
        }
        // console.log('Hit "MoveRight" key', player.velocity.x);
    }

    playerClone = null;

    // Draw boundaries
    boundaries.forEach(function (boundary) {
        boundary.draw();

        if (playerBoundaryCollision(player, boundary)) {
            player.velocity.x = 0;
            player.velocity.y = 0;
        }
    });

    // Player/Ghost collision detection
    for (let len = ghosts.length, i = len - 1; i >= 0; i--) {
        const ghost = ghosts[i];

        if (Math.hypot(
            ghost.position.x - player.position.x, 
            ghost.position.y - player.position.y
        ) < ghost.radius + player.radius) {
            if (ghost.scared) {
                ghosts.splice(i, 1);
            } else {
                // Redraw map setting
                pellets.forEach(function (pellet) {
                    pellet.draw();
                });

                player.velocity.x = 0;
                player.velocity.y = 0;
                player.mouthGap = 0.75;
                player.draw();

                ghosts.forEach(function (ghost) {
                    ghost.velocity.x = 0;
                    ghost.velocity.y = 0;
                    ghost.color = ghost._color;
                    ghost.draw();
                });

                ctx.fillStyle = 'white';
                ctx.font = 'bold 80px Consolas, monospace';
                ctx.shadowColor = 'purple';
                ctx.shadowOffsetX = 5;
                ctx.shadowOffsetY = 5;
                ctx.fillText('You lost', 40, 240);

                gameOver = true;
                gameStarted = false;
                imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
                return cancelAnimationFrame(animationId);
            }
        }
    }

    // Winning condition check
    if (pellets.length === 0) {
        // Redraw map setting
        player.velocity.x = 0;
        player.velocity.y = 0;
        player.mouthGap = 0.75;
        player.draw();

        ghosts.forEach(function (ghost) {
            ghost.velocity.x = 0;
            ghost.velocity.y = 0;
            ghost.color = ghost._color;
            ghost.draw();
        });

        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 80px Consolas, monospace';
        ctx.shadowColor = 'red';
        ctx.shadowOffsetX = 5;
        ctx.shadowOffsetY = 5;
        ctx.fillText('You won', 60, 240);

        gameOver = true;
        gameStarted = false;
        imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
        return cancelAnimationFrame(animationId);
    }

    // Draw pellets and power-ups
    for (let len = pellets.length, i = len - 1; i >= 0; i--) {
        const pellet = pellets[i];
        pellet.draw();

        if (Math.hypot(
            pellet.position.x - player.position.x, 
            pellet.position.y - player.position.y
        ) < pellet.radius + player.radius) {
            pellets.splice(i, 1);

            score += pellet.reward;
            scoreElem.textContent = score;

            if (pellet instanceof PowerUp) {
                ghosts.forEach(function (ghost) {
                    ghost.scared = true;
                    ghost.color = 'blue';

                    let scaredExpiresColorChangeIntervalId;
                    let scaredExpiresTimeoutId = setTimeout(function () {
                        clearTimeout(scaredExpiresTimeoutId);
                        scaredExpiresColorChangeIntervalId = setInterval(function () {
                            ghost.color = ghost.color == 'blue' ? 'white' : 'blue';
                        }, 250);
                    }, 2500);

                    let scaredTimeoutId = setTimeout(function () {
                        clearTimeout(scaredTimeoutId);
                        clearInterval(scaredExpiresColorChangeIntervalId);
                        ghost.scared = false;
                        ghost.color = ghost._color;
                    }, 5000);
                });
            }
        }
    }

    // Draw player
    player.update();

    // Draw ghosts
    for (const ghost of ghosts) {
        if (gameStarted && !ghost.moving) {
            const velocities = [-ghost.speed, ghost.speed];
            ghost.velocity.x = velocities[Math.floor(Math.random() * velocities.length)];
        }

        ghost.update(null, pause());

        if (pause()) continue;

        let ghostClone = { ...ghost, position: { ...ghost.position }, velocity: { ...ghost.velocity }, radius: ghost.radius, speed: ghost.speed };

        const collisions = [];
        boundaries.forEach(function (boundary) {
            ghostClone.velocity.x = -ghost.speed;
            ghostClone.velocity.y = 0;
            if (
                !collisions.includes('left') &&
                playerBoundaryCollision(
                    ghostClone, 
                    boundary
                )
            ) {
                collisions.push('left');
            }

            ghostClone.velocity.x = ghost.speed;
            ghostClone.velocity.y = 0;
            if (
                !collisions.includes('right') && 
                playerBoundaryCollision(
                    ghostClone, 
                    boundary
                )
            ) {
                collisions.push('right');
            }

            ghostClone.velocity.x = 0;
            ghostClone.velocity.y = -ghost.speed;
            if (
                !collisions.includes('up') && 
                playerBoundaryCollision(
                    ghostClone, 
                    boundary
                )
            ) {
                collisions.push('up');
            }

            ghostClone.velocity.x = 0;
            ghostClone.velocity.y = ghost.speed;
            if (
                !collisions.includes('down') && 
                playerBoundaryCollision(
                    ghostClone, 
                    boundary
                )
            ) {
                collisions.push('down');
            }
        });

        ghostClone = null;

        if (collisions.length > ghost.collisions.length) {
            ghost.collisions = collisions;
        }

        if (JSON.stringify(collisions) !== JSON.stringify(ghost.collisions)) {
            if (ghost.velocity.x > 0) ghost.collisions.push('right');
            else if (ghost.velocity.x < 0) ghost.collisions.push('left');
            else if (ghost.velocity.y > 0) ghost.collisions.push('down');
            else if (ghost.velocity.y < 0) ghost.collisions.push('up');
            // console.log('Current collisions', collisions);
            // console.log('Previous collisions', ghost.collisions);
            const pathways = ghost.collisions.filter(collision => !collisions.includes(collision));
            // console.log({ pathways });
            const direction = pathways[Math.floor(Math.random() * pathways.length)];
            // console.log({ direction });
            switch (direction) {
                case 'up': {
                    ghost.velocity.x = 0;
                    ghost.velocity.y = -ghost.speed;
                    break;
                }
                case 'down': {
                    ghost.velocity.x = 0;
                    ghost.velocity.y = ghost.speed;
                    break;
                }
                case 'left': {
                    ghost.velocity.x = -ghost.speed;
                    ghost.velocity.y = 0;
                    break;
                }
                case 'right': {
                    ghost.velocity.x = ghost.speed;
                    ghost.velocity.y = 0;
                    break;
                }
            }

            ghost.collisions = [];
        }
        // console.log('Current collisions', collisions);
    }

    // Chomping animation
    if (player.velocity.x > 0) player.rotation = 0;
    else if (player.velocity.x < 0) player.rotation = Math.PI;
    else if (player.velocity.y > 0) player.rotation = Math.PI / 2;
    else if (player.velocity.y < 0) player.rotation = Math.PI * 1.5;

    // Save image data
    imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
}