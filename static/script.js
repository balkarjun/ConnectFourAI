const boardWidth = Math.min(630, screen.width);
const boardHeight = (boardWidth * 6)/7;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

const backButton = document.getElementById('button-back');
const playButton = document.getElementById('button-play');
const resetButton = document.getElementById('button-reset');

const playerStats = [
    document.getElementById('player-one-stats'),
    document.getElementById('player-two-stats')
];

const statCurrent = [
    document.querySelector('#player-one-stats .stat-current'),
    document.querySelector('#player-two-stats .stat-current')
];

const statTotal = [
    document.querySelector('#player-one-stats .stat-total'),
    document.querySelector('#player-two-stats .stat-total')
];

const agentSelect = [
    document.querySelector('#player-one-controls .select-agent'),
    document.querySelector('#player-two-controls .select-agent')
];

const depthSelect = [
    document.querySelector('#player-one-controls .select-depth'),
    document.querySelector('#player-two-controls .select-depth')
];

function isTouchDevice() {
    return window.matchMedia('(pointer: coarse)').matches;
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

function getWinner() {
    if (moves.length == 0) return 'none';

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

// show depth-select when minimax agent is selected
for (let p = 0; p <= 1; p++) {
    agentSelect[p].addEventListener('change', function() {
        if (this.value == 'minimax') {
            depthSelect[p].removeAttribute('disabled');
        } else {
            depthSelect[p].setAttribute('disabled', true);
        }
    });
}

canvas.addEventListener('mousemove', event => {
    // ensure next move's agent is human
    if (!isPlaying || agentSelect[moves.length & 1].value != 'human') {
        nextMove = -1;
        return;
    }
    // get column index from mouse pointer location
    const rect = canvas.getBoundingClientRect();
    nextMove = Math.floor((event.clientX - rect.left) / cellWidth);
});

canvas.addEventListener('click', event => {
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

function clearStats() {
    playerStats.forEach(element => element.classList.add('hidden'));
}

function updateStats() {
    function formatText(eval, time) {
        const formatter = Intl.NumberFormat('en');
        
        const evalText = `${formatter.format(eval)} evals`;
        const timeText = (time < 1) ? '<1 ms' : `${formatter.format(Math.round(time))} ms`;

        return `${evalText} | ${timeText}`;
    }

    let evals = [[], []];
    let times = [[], []];

    if (agentSelect[0].value == 'minimax' && agentSelect[1].value == 'minimax') {
        // both players are AI
        for (let idx = 0; idx < evaluations.length; idx++) {
            evals[idx % 2].push(evaluations[idx]);
            times[idx % 2].push(elapsedTime[idx]);
        }
    } else if (agentSelect[0].value == 'minimax') {
        // red is AI
        evals[0] = evaluations;
        times[0] = elapsedTime;
    } else if (agentSelect[1].value == 'minimax') {
        // yellow is AI
        evals[1] = evaluations;
        times[1] = elapsedTime;
    }

    for (let p = 0; p <= 1; p++) {
        if (agentSelect[p].value == 'minimax') {
            playerStats[p].classList.remove('hidden');
        }
        
        const currentEval = evals[p][evals[p].length - 1];
        const currentTime = times[p][times[p].length - 1];
        statCurrent[p].innerText = formatText(currentEval, currentTime);

        const totalEval = evals[p].reduce((a, b) => a + b, 0);
        const totalTime = times[p].reduce((a, b) => a + b, 0);
        statTotal[p].innerText = formatText(totalEval, totalTime);
    }
}

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

    playButton.classList.remove('active');
    playButton.classList.remove('win-two');
    playButton.classList.remove('win-one');

    if (isPlaying) {
        playButton.innerText = (moves.length % 2 == 0) ? 'Red\'s Turn' : 'Yellow\'s Turn';
    } else {
        const winner = getWinner();

        if (winner == 'tie') {
            playButton.innerText = 'It\'s a Tie';
        } else if (winner == 'red') {
            playButton.innerText = 'Red Won';
            playButton.classList.add('win-one');
        } else if (winner == 'yellow') {
            playButton.innerText = 'Yellow Won';
            playButton.classList.add('win-two');
        } else {
            playButton.innerText = 'Play';
            playButton.classList.add('active');
        }
    }

    if (!isPlaying) return;
    if (getWinner() != 'none') {
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

function draw() {
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
            }
        }
    }
    drawGrid();

    function drawCoin(fillStyle, strokeStyle, irow, icol) {
        ctx.fillStyle = fillStyle;
        ctx.strokeStyle = strokeStyle;
        ctx.lineWidth = lineWidth;

        const coinX = (icol + 1) * cellWidth - radius + lineWidth/2;
        const coinY = (irow + 1) * cellHeight - radius + lineWidth/2;
        
        ctx.beginPath();
        ctx.arc(coinX, coinY, radius - 2 * lineWidth, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }
    
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

        // draw coins on grid
        if ((counter % 2) == 0) {
            drawCoin(coinRed, coinRedBorder, irow, icol);
        } else {
            drawCoin(coinYellow, coinYellowBorder, irow, icol);
        }

        board[irow][icol] = (counter % 2); // 0 for Red, 1 for Yellow
        hcols[icol]++;
    }

    // indicate winning token
    function drawToken(irow, icol) {
        ctx.strokeStyle = 'white';
        ctx.lineWidth = lineWidth * 2;

        const coinX = (icol + 1) * cellWidth - radius + lineWidth/2;
        const coinY = (irow + 1) * cellHeight - radius + lineWidth/2;

        ctx.beginPath();
        ctx.arc(coinX, coinY, cellWidth/4, 0, 2 * Math.PI);
        ctx.stroke();
    }

    const winner = getWinner();
    if (winner == 'red' || winner == 'yellow') {
        // horizontal
        for (let irow = 0; irow < nrows; irow++) {
            for (let icol = 0; icol < ncols - 3; icol++) {
                if ((board[irow][icol] != -1) && 
                    (board[irow][icol] == board[irow][icol + 1]) &&
                    (board[irow][icol] == board[irow][icol + 2]) &&
                    (board[irow][icol] == board[irow][icol + 3])
                ) {
                    drawToken(irow, icol);
                    drawToken(irow, icol + 1);
                    drawToken(irow, icol + 2);
                    drawToken(irow, icol + 3);
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
                    drawToken(irow, icol);
                    drawToken(irow + 1, icol);
                    drawToken(irow + 2, icol);
                    drawToken(irow + 3, icol);
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
                    drawToken(irow, icol);
                    drawToken(irow + 1, icol - 1);
                    drawToken(irow + 2, icol - 2);
                    drawToken(irow + 3, icol - 3);
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
                    drawToken(irow, icol);
                    drawToken(irow + 1, icol + 1);
                    drawToken(irow + 2, icol + 2);
                    drawToken(irow + 3, icol + 3);
                }
            }
        }
    }
}
