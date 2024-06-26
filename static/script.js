const boardWidth = Math.min(630, screen.width);
const boardHeight = (boardWidth * 6)/7;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

const backButton = document.getElementById('button-back');
const playButton = document.getElementById('button-play');
const resetButton = document.getElementById('button-reset');

const playerStats = [
    document.getElementById('player-one-stats'),
    document.getElementById('player-two-stats')
];

const redCurrent = document.querySelector('#player-one-stats .stat-current');
const redTotal = document.querySelector('#player-one-stats .stat-total');

const yellowCurrent = document.querySelector('#player-two-stats .stat-current');
const yellowTotal = document.querySelector('#player-two-stats .stat-total');

const agentSelect = [
    document.querySelector('#player-one-controls .select-agent'),
    document.querySelector('#player-two-controls .select-agent')
];

const depthSelect = [
    document.querySelector('#player-one-controls .select-depth'),
    document.querySelector('#player-two-controls .select-depth')
];

function isTouchDevice() {
    return window.matchMedia("(pointer: coarse)").matches;
}

function scaleCanvas() {
    // actual visual size (css)
    canvas.style.width = `${boardWidth}px`;
    canvas.style.height = `${boardHeight}px`;
    
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
    // scale canvas in memory to account for extra pixel density on HiDPI displays
    // set ratio to 1 to see what would happen normally
    const ratio = window.devicePixelRatio;
    canvas.width = Math.floor(boardWidth  * ratio);
    canvas.height = Math.floor(boardHeight * ratio);

    // normalize coordinate system to use visual size
    ctx.scale(ratio, ratio);
}
scaleCanvas();

const nrows = 6;
const ncols = 7;

const lineWidth = boardWidth * 0.007;

const cellWidth = (boardWidth - lineWidth)/ncols;
const cellHeight = (boardHeight - lineWidth)/nrows;
const radius = cellWidth/2;

const boardFg = "#3980a0";
const boardBg = "#eef7ff";

const coinRed = "#ce5454";
const coinYellow = "#dfc352";

const coinRedBorder = "#b94343";
const coinYellowBorder = "#c3a343";

const coinRedFaded = "#e9b2b2";
const coinYellowFaded = "#dbc88e";

// store indices of columns where coins were placed
let moves = [];
let heights = [0, 0, 0, 0, 0, 0, 0];
let isPlaying = false;
let nextMove = -1;
let humanMove = -1;

let evaluations = [];
let elapsedTime = [];

function rewind() {
    if (moves.length == 0) return;

    isPlaying = false;
    
    const icol = moves.pop();
    heights[icol]--;
    // if AI's move was popped
    if (agentSelect[moves.length & 1].value != 'human') {
        evaluations.pop();
        elapsedTime.pop();
    }

    updateStats();
    if (evaluations.length == 0) {
        clearStats();
    }
}

function play() {
    isPlaying = true;

    // scroll to game area
    const fontSize = parseFloat(window.getComputedStyle(document.body, null).getPropertyValue('font-size'));
    const margin = fontSize * 0.5; // the controls have a 0.5em margin
    const offset = document.getElementById('buttons').offsetTop - margin;
    
    window.scrollTo({
        top: offset,
        behavior: 'smooth'
    });
}

function reset() {
    moves = [];
    heights = [0, 0, 0, 0, 0, 0, 0];
    isPlaying = false;
    nextMove = -1;
    humanMove = -1;

    evaluations = [];
    elapsedTime = [];
    clearStats();
}

canvas.addEventListener("mousemove", event => {
    // ensure next move's agent is human
    if (!isPlaying || agentSelect[moves.length & 1].value != 'human') {
        nextMove = -1;
        return;
    }
    // get column index from mouse pointer location
    const rect = canvas.getBoundingClientRect();
    nextMove = Math.floor((event.clientX - rect.left) / cellWidth);
});

canvas.addEventListener("click", event => {
    if (!isPlaying) return;
    // get column index from click location
    const rect = canvas.getBoundingClientRect();
    humanMove = Math.floor((event.clientX - rect.left) / cellWidth);
});

function makeMove(icol) {
    // ensure the move is valid
    if (!isPlaying || heights[icol] >= nrows) return;

    moves.push(icol);
    heights[icol]++;
}

// draw the empty board
function drawGrid() {
    ctx.fillStyle = boardFg;

    ctx.fillRect(0, 0, boardWidth, boardHeight);
    
    ctx.fillStyle = boardBg;
    ctx.strokeStyle = boardFg;
    ctx.lineWidth = lineWidth;
    
    for (let irow = 0; irow < nrows; irow++) {
        const circleY = (irow + 1) * cellHeight - radius + lineWidth/2;

        for (let icol = 0; icol < ncols; icol++) {
            const circleX = (icol + 1) * cellWidth - radius + lineWidth/2;

            ctx.beginPath();
            ctx.arc(circleX, circleY, radius, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            ctx.closePath();
        }
    }
}

function drawCoin(fillStyle, strokeStyle, irow, icol) {
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;

    ctx.beginPath();
    const coinX = (icol + 1) * cellWidth - radius + lineWidth/2;
    const coinY = (irow + 1) * cellHeight - radius + lineWidth/2;

    ctx.arc(coinX, coinY, radius - 2 * lineWidth, 0, 2 * Math.PI);

    ctx.fill();
    ctx.stroke();
    ctx.closePath();
}

function drawWinToken(irow, icol) {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = lineWidth * 2;

    ctx.beginPath();
    const coinX = (icol + 1) * cellWidth - radius + lineWidth/2;
    const coinY = (irow + 1) * cellHeight - radius + lineWidth/2;

    ctx.arc(coinX, coinY, cellWidth/4, 0, 2 * Math.PI);

    ctx.stroke();
    ctx.closePath();
}

/* WASM START */
// allocate memory for moves array
let memory = new WebAssembly.Memory({
    initial: 1, // value in page sizes (1 page = 64 KiB)
    maximum: 1
});

let core;
WebAssembly.instantiateStreaming(fetch('static/main.wasm'), {
    js: { mem: memory }
}).then(results => {
    core = results.instance.exports;
    memory = results.instance.exports.memory; // update memory pointer
});

function getMinimaxMove(depth) {
    const array = new Int32Array(memory.buffer, 0, moves.length);
    array.set(moves);

    return core.getMinimaxMove(array.byteOffset, moves.length, depth);
}

function endStateReached() {
    const array = new Int32Array(memory.buffer, 0, moves.length);
    array.set(moves);

    const result = core.endStateReached(array.byteOffset, moves.length);

    return result != -1;
}

function getWinner() {
    const array = new Int32Array(memory.buffer, 0, moves.length);
    array.set(moves);

    const result = core.endStateReached(array.byteOffset, moves.length);

    if (result == 0) return 'tie';
    else if (result > 0) return 'red';
    else if (result != -1) return 'yellow';

    return 'none';
}

function getEvaluations() {
    return core.getEvaluations();
}
/* WASM END */

/* UI Controls START */

for (let p = 0; p <= 1; p++) {
    agentSelect[p].addEventListener('change', function() {
        // show depth select if minimax
        if (this.value == 'minimax') {
            depthSelect[p].removeAttribute('disabled');
        } else {
            depthSelect[p].setAttribute('disabled', true);
        }
    });
}
/* UI Controls END */

/* Game Loop */

// request the first frame
window.requestAnimationFrame(gameLoop);
function gameLoop(timeStamp) {
    update();
    draw();

    // request the next frame
    window.requestAnimationFrame(gameLoop);
}

function update() {
    if (moves.length == 0) {
        backButton.setAttribute('disabled', true);
        resetButton.setAttribute('disabled', true);
    } else {
        backButton.removeAttribute('disabled');
        resetButton.removeAttribute('disabled');
    }

    if (isPlaying) {
        playButton.classList.remove('active');
        playButton.classList.remove('win-two');
        playButton.classList.remove('win-one');

        playButton.innerText = (moves.length % 2 == 0) ? "Red's Turn" : "Yellow's Turn";
    } else {
        playButton.classList.add('active');
        playButton.classList.remove('win-two');
        playButton.classList.remove('win-one');

        playButton.innerText = "Play";

        if (moves.length > 0) {
            const winner = getWinner();

            if (winner == 'tie') {
                playButton.innerText = "It's a Tie";
            } else if (winner == 'red') {
                playButton.innerText = 'Red Won';
                playButton.classList.remove('active');
                playButton.classList.remove('win-two');
                playButton.classList.add('win-one');
            } else if (winner == 'yellow') {
                playButton.innerText = 'Yellow Won';
                playButton.classList.remove('active');
                playButton.classList.remove('win-one');
                playButton.classList.add('win-two');
            }
        }
    }

    if (!isPlaying) return;
    if (endStateReached()) {
        isPlaying = false;
        return;
    }

    const agent = agentSelect[moves.length & 1].value;
    const depth = Number(depthSelect[moves.length & 1].value);

    if (agent == 'minimax') {
        const startTime = performance.now();
        const move = getMinimaxMove(depth);
        const endTime = performance.now();

        makeMove(move);

        evaluations.push(getEvaluations());
        elapsedTime.push(endTime - startTime);

        updateStats();
    } else if (agent == 'human' && humanMove != -1) {
        makeMove(humanMove);
        humanMove = -1;
    }
}

function clearStats() {
    playerStats.forEach(element => element.classList.add('hidden'));
}

function updateStats() {
    function getCurrentText(evals, times) {
        const formatter = Intl.NumberFormat('en');

        const currentEval = evals[evals.length - 1];
        const currentTime = Math.round(times[times.length - 1]);

        if (currentTime < 1) {
            return `${formatter.format(currentEval)} evals | <1 ms`;
        }
        return `${formatter.format(currentEval)} evals | ${formatter.format(currentTime)} ms`;
    }

    function getTotalText(evals, times) {
        const formatter = Intl.NumberFormat('en');

        const totalEval = evals.reduce((a, b) => a + b, 0);
        const totalTime = Math.round(times.reduce((a, b) => a + b, 0));

        if (totalTime < 1) {
            return `${formatter.format(totalEval)} evals | <1 ms`;
        }
        return `${formatter.format(totalEval)} evals | ${formatter.format(totalTime)} ms`;
    }

    // red is AI, yellow is human
    if (agentSelect[0].value == 'minimax' && agentSelect[1].value == 'human') {
        playerStats[0].classList.remove('hidden');
        redCurrent.innerText = getCurrentText(evaluations, elapsedTime);
        redTotal.innerText = getTotalText(evaluations, elapsedTime);
    } 
    // red is human, yellow is AI
    else if (agentSelect[0].value == 'human' && agentSelect[1].value == 'minimax') {
        playerStats[1].classList.remove('hidden');
        yellowCurrent.innerText = getCurrentText(evaluations, elapsedTime);
        yellowTotal.innerHTML = getTotalText(evaluations, elapsedTime);
    }
    // both AI
    else {
        playerStats[0].classList.remove('hidden');
        playerStats[1].classList.remove('hidden');
        // elements at even indices
        const redEvals = evaluations.filter((_, idx) => (idx % 2) == 0);
        const redTimes = elapsedTime.filter((_, idx) => (idx % 2) == 0);
        redCurrent.innerText = getCurrentText(redEvals, redTimes);
        redTotal.innerText = getTotalText(redEvals, redTimes);
        // elements at odd indices
        const yellowEvals = evaluations.filter((_, idx) => (idx % 2) == 1);
        const yellowTimes = elapsedTime.filter((_, idx) => (idx % 2) == 1);
        yellowCurrent.innerText = getCurrentText(yellowEvals, yellowTimes);
        yellowTotal.innerHTML = getTotalText(yellowEvals, yellowTimes);
    }
}

function draw() {
    drawGrid();
    
    // highlight next move for non-touch devices
    if (!isTouchDevice() && isPlaying && nextMove != -1 && heights[nextMove] < nrows) {
        const strokeStyle = ((moves.length & 1) == 0) ? coinRedFaded : coinYellowFaded;
        drawCoin(boardBg, strokeStyle, nrows - heights[nextMove] - 1, nextMove);
    }

    let board = [
        [-1, -1, -1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1, -1, -1],
        [-1, -1, -1, -1, -1, -1, -1],
    ];
    let hcols = [0, 0, 0, 0, 0, 0, 0];
    for (let counter = 0; counter < moves.length; counter++) {
        const icol = moves[counter];
        const irow = nrows - hcols[icol] - 1;
        
        board[irow][icol] = (counter & 1); // 0 for Red, 1 for Yellow

        // draw coins on grid
        if (board[irow][icol] == 0) {
            drawCoin(coinRed, coinRedBorder, irow, icol);
        } else if (board[irow][icol] == 1) {
            drawCoin(coinYellow, coinYellowBorder, irow, icol);
        }

        hcols[icol]++;
    }

    // indicate winning token
    if (!isPlaying && moves.length > 0) {
        // horizontal
        for (let irow = 0; irow < nrows; irow++) {
            for (let icol = 0; icol < ncols - 3; icol++) {
                if ((board[irow][icol] != -1) && 
                    (board[irow][icol] == board[irow][icol + 1]) &&
                    (board[irow][icol] == board[irow][icol + 2]) &&
                    (board[irow][icol] == board[irow][icol + 3])
                ) {
                    drawWinToken(irow, icol);
                    drawWinToken(irow, icol + 1);
                    drawWinToken(irow, icol + 2);
                    drawWinToken(irow, icol + 3);
                }
            }
        }
        // vertical
        for (let irow = 0; irow < nrows - 3; irow++) {
            for (let icol = 0; icol < ncols; icol++) {
                if ((board[irow][icol] != -1) && 
                    (board[irow][icol] == board[irow + 1][icol]) &&
                    (board[irow][icol] == board[irow + 2][icol]) &&
                    (board[irow][icol] == board[irow + 3][icol])
                ) {
                    drawWinToken(irow, icol);
                    drawWinToken(irow + 1, icol);
                    drawWinToken(irow + 2, icol);
                    drawWinToken(irow + 3, icol);
                }
            }
        }
        // positive diagonal
        for (let irow = 0; irow < nrows - 3; irow++) {
            for (let icol = 3; icol < ncols; icol++) {
                if ((board[irow][icol] != -1) && 
                    (board[irow][icol] == board[irow + 1][icol - 1]) &&
                    (board[irow][icol] == board[irow + 2][icol - 2]) &&
                    (board[irow][icol] == board[irow + 3][icol - 3])
                ) {
                    drawWinToken(irow, icol);
                    drawWinToken(irow + 1, icol - 1);
                    drawWinToken(irow + 2, icol - 2);
                    drawWinToken(irow + 3, icol - 3);
                }
            }
        }
        // negative diagonal
        for (let irow = 0; irow < nrows - 3; irow++) {
            for (let icol = 0; icol < ncols - 3; icol++) {
                if ((board[irow][icol] != -1) && 
                    (board[irow][icol] == board[irow + 1][icol + 1]) &&
                    (board[irow][icol] == board[irow + 2][icol + 2]) &&
                    (board[irow][icol] == board[irow + 3][icol + 3])
                ) {
                    drawWinToken(irow, icol);
                    drawWinToken(irow + 1, icol + 1);
                    drawWinToken(irow + 2, icol + 2);
                    drawWinToken(irow + 3, icol + 3);
                }
            }
        }
    }
}
