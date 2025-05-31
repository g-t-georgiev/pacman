import Loader from "./Loader.js";
import Tilemap from "./components/tilemap.js";
import Pacman, { getPacmanData } from "./components/pacman.js";
import Ghost, { GHOSTS_IDS, getGhostsData } from "./components/ghost.js";

import { parseHexNumToCSSColor, getDirectionFromVelocity, getRandomNumber } from "./utils.js";

const gameCache = sessionStorage;

const scoreBoard = document.querySelector('#score-board');
const scoreDisplay = scoreBoard.querySelector('#score');
const highScoreDisplay = scoreBoard.querySelector('#high-score');
const canvas = document.querySelector('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const cols = 11;
const rows = 13;
const tileSize = 40;
const maze = [];

/** @type import('./helpers/Loader.js').Loader */
const loader = Loader.getInstance();

let rootUrl = location.origin.includes('github.io') ? '/pacman' : '';

loader
    .add({ url: `${rootUrl}/src/mazeLayout.json`, name: 'maze' })
    .add({ url: `${rootUrl}/assets/images/pipeHorizontal.png`, name: '-' })
    .add({ url: `${rootUrl}/assets/images/pipeVertical.png`, name: '|'})
    .add({ url: `${rootUrl}/assets/images/pipeCorner1.png`, name: '1'})
    .add({ url: `${rootUrl}/assets/images/pipeCorner2.png`, name: '2'})
    .add({ url: `${rootUrl}/assets/images/pipeCorner3.png`, name: '3'})
    .add({ url: `${rootUrl}/assets/images/pipeCorner4.png`, name: '4'})
    .add({ url: `${rootUrl}/assets/images/pipeConnectorTop.png`, name: '5'})
    .add({ url: `${rootUrl}/assets/images/pipeConnectorRight.png`, name: '6'})
    .add({ url: `${rootUrl}/assets/images/pipeConnectorBottom.png`, name: '7'})
    .add({ url: `${rootUrl}/assets/images/pipeConnectorLeft.png`, name: '8'})
    .add({ url: `${rootUrl}/assets/images/block.png`, name: 'b'})
    .add({ url: `${rootUrl}/assets/images/capLeft.png`, name: '['})
    .add({ url: `${rootUrl}/assets/images/capRight.png`, name: ']'})
    .add({ url: `${rootUrl}/assets/images/capBottom.png`, name: '_'})
    .add({ url: `${rootUrl}/assets/images/capTop.png`, name: '^'})
    .add({ url: `${rootUrl}/assets/images/pipeCross.png`, name: '+'})
    .add({ url: `${rootUrl}/assets/fonts/pac-font/PacFont.ttf`, name: 'PacFont' })
    .add({ url: `${rootUrl}/assets/fonts/emulogic/Emulogic.ttf`, name: 'EmulogicFont' });


loader.onLoad.add(function (asset) {
    // console.log('Loaded', asset);
    if (asset.name === 'maze') {
        Object.assign(maze, asset.data);
    }
});

loader.load(setup);

const defaultActorData = {
    width: tileSize,
    height: tileSize,
    radius: tileSize / 3,
    speed: 2,
};

const pacmanActorData = structuredClone(getPacmanData(tileSize));
const ghostActorsData = structuredClone(getGhostsData(tileSize));

const actorStartVectors = [
    { x: 0, y: -defaultActorData.speed }, // Up
    { x: defaultActorData.speed, y: 0 }, // Right
    { x: 0, y: defaultActorData.speed }, // Down
    { x: -defaultActorData.speed, y: 0 } // Left
];

let tilemap, 
    ghosts, 
    pacman, 
    animationId, 
    fps = 1000 / 60, 
    delta,
    lastTimestamp, 
    imageData, 
    score = 0, 
    highScore = 0, 
    isGameOver = false;

function setupPacman(pacman) {
    pacman.drawCollisionBox = true;
    pacman.drawBoxQuadrants = false;
    pacman.debug = false;

    pacman.startTimeout = setTimeout(function () {
        clearTimeout(pacman.startTimeout);
        pacman.updateProps({ velocity: actorStartVectors[actorStartVectors.length - 1] });
        pacman.direction = getDirectionFromVelocity(pacman.velocity);
    }, pacman.startTime);
}

function setupGhosts(ghost) {

    ghost.drawCollisionBox = true;
    ghost.drawBoxQuadrants = false;

    switch (ghost.name) {
        case 'Blinky': {
            ghost.debug = false;
            break;
        }
        case 'Inky': {
            ghost.debug = false;
            break;
        }
        case 'Pinky': {
            ghost.debug = false;
            break;
        }
        case 'Clyde': {
            ghost.debug = false;
            break;
        }
    }

    ghost.startTimeout = setTimeout(function () {
        clearTimeout(ghost.startTimeout);
        ghost.updateProps({ velocity: actorStartVectors[getRandomNumber(0, actorStartVectors.length, false, true, false)] });
        ghost.direction = getDirectionFromVelocity(ghost.velocity);
    }, ghost.startTime);
}

function setup() {
    try {
        let highScoreCache = gameCache.getItem('highScore');

        if (highScoreCache != null && !isNaN(highScoreCache)) {
            highScore = parseInt(highScoreCache);
        }
    } catch (error) {
        console.error(error);
    }

    scoreDisplay.textContent = `${0}`.padStart(3, '0');
    highScoreDisplay.textContent = `${highScore}`.padStart(5, '0');

    // console.log('Assets finished loading.');
    tilemap = new Tilemap(ctx, maze, cols, rows, tileSize).setup(loader);
    tilemap.drawGridLines = true;

    ghosts = Array.from({ length: 4 }, function (_, i) {

        let ghostName = GHOSTS_IDS[i];

        if (!ghostName) {
            throw new Error('Invalid ghost name');
        }

        let ghostData = Object.assign(structuredClone(defaultActorData), structuredClone(ghostActorsData[ghostName]));
        let ghost = new Ghost(ctx, tilemap, ghostData);
        setupGhosts(ghost);
        return ghost;
    });

    pacman = new Pacman(ctx, tilemap, Object.assign(structuredClone(defaultActorData), structuredClone(pacmanActorData)));
    setupPacman(pacman);

    window.addEventListener('resize', resize);
    canvas.addEventListener('pacman:scoreup', function (event) {
        if (event.detail) {
            let data = event.detail;
            const isPowerUp = data.isPowerUp;
            const currentScorePts = data.score;
            const targetScorePts = data.targetScore;
            score += currentScorePts;
            scoreDisplay.textContent = `${score}`.padStart(3, '0');
            if (score > highScore) {
                highScore = score;
                highScoreDisplay.textContent = `${highScore}`.padStart(5, '0');

                try {
                    gameCache.setItem('highScore', `${highScore}`);
                } catch (error) {
                    console.error(error);
                }
            }
            if (score === targetScorePts) {
                isGameOver = true;
            } else if (isPowerUp) {
                ghosts.forEach(ghost => {
                    ghost.enterFrightenedState();
                });
            }
        }
    });
    
    resize();
    animationId = window.requestAnimationFrame(update);
}

function resize() {
    scoreBoard.style.width = cols * tileSize + 'px';
    canvas.width = cols * tileSize;
    canvas.height = rows * tileSize;

    if (imageData != null && imageData instanceof ImageData) {
        ctx.putImageData(imageData, 0, 0);
    }
}

function drawGameWinScreen() {
    ctx.save();
    ctx.fillStyle = parseHexNumToCSSColor(0xffff00);
    ctx.font = 'bold 60px Emulogic';
    ctx.shadowColor = parseHexNumToCSSColor(0xff0000);
    ctx.shadowOffsetX = 7;
    ctx.shadowOffsetY = 7;
    ctx.fillText('You', (canvas.width - ctx.measureText('You').width) / 2, 200);
    ctx.fillText('Won', (canvas.width - ctx.measureText('Won').width) / 2, 200 + ctx.measureText('M').width + 20);
    ctx.restore();
}

function drawGameLoseScreen() {
    ctx.save();
    ctx.fillStyle = parseHexNumToCSSColor(0xff0000);
    ctx.font = 'bold 60px Emulogic';
    ctx.shadowColor = parseHexNumToCSSColor(0xffffff);
    ctx.shadowOffsetX = 7;
    ctx.shadowOffsetY = 7;
    ctx.fillText('You', (canvas.width - ctx.measureText('You').width) / 2, 200);
    ctx.fillText('Lose', (canvas.width - ctx.measureText('Lose').width) / 2, 200 + ctx.measureText('M').width + 20);
    ctx.restore();
}

function setGameOverState() {
    window.cancelAnimationFrame(animationId);

    ghosts.forEach(ghost => {
        ghost.freeze();
        ghost.draw();
    });

    pacman.freeze();
    pacman.draw();
}

function setGameLoseState() {
    setGameOverState();
    pacman.onLose(() => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        pacman.mouthGap = Math.min(pacman.mouthGap + 0.05, 3.14);
        tilemap.draw();
        ghosts.forEach(ghost => ghost.draw());
        pacman.draw();
        drawGameLoseScreen();
        imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    });
    console.log('Your score', score);
}

function setGameWinState() {
    setGameOverState();
    drawGameWinScreen();
    imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
    console.log('Your score', score);
}

function update(timestamp) {
    if (lastTimestamp == null) {
        lastTimestamp = performance.now();
        return requestAnimationFrame(update);
    }

    animationId = requestAnimationFrame(update);

    delta = Math.round((timestamp - lastTimestamp) / fps);
    if (timestamp - lastTimestamp > 1000 / 30) delta = 1;
    lastTimestamp = timestamp;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    tilemap.draw();

    if (isGameOver) return setGameWinState();

    // Render ghosts
    for (const ghost of ghosts) {

        let dist = Math.hypot(
            ghost.center.x - pacman.center.x,
            ghost.center.y - pacman.center.y
        );
        let collision = dist < pacman.radius + ghost.radius;

        if (collision) {
            if (!ghost.isScared) {
                return setGameLoseState();
            }
        }
    
        ghost.render(delta);
    }

    // Render player
    pacman.render(delta);

    // Save image data
    imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);
}