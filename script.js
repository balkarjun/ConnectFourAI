const boardWidth = 630;
const boardHeight = 540;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

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

const lineWidth = 4;

const cellWidth = (boardWidth - lineWidth)/ncols;
const cellHeight = (boardHeight - lineWidth)/nrows;
const radius = cellWidth/2;

const boardFg = "#3980a0";
const boardBg = "#eef7ff";

const coinRed = "#ce5454";
const coinYellow = "#dfc352";

const coinRedBorder = "#b94343";
const coinYellowBorder = "#c3a343";

// store indices of columns where coins were placed
let moves = [];
let heights = [0, 0, 0, 0, 0, 0, 0];
let isPlaying = false;
let humanMove = -1;

let evaluations = [];
let elapsedTime = [];

function reset() {
    moves = [];
    heights = [0, 0, 0, 0, 0, 0, 0];
    isPlaying = false;
    humanMove = -1;

    evaluations = [];
    elapsedTime = [];
    clearStatTable();
}

function play() {
    isPlaying = true;

    // hide the stat table in human vs human games
    if (agentSelect[0].value == 'human' && agentSelect[1].value == 'human') {
        document.getElementById('stat-table').classList.add('hidden');
    } else {
        document.getElementById('stat-table').classList.remove('hidden');
    }
}

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
WebAssembly.instantiateStreaming(fetch('main.wasm'), {
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

    if (result == 0) {
        console.log('Tie');
    } else if (result > 0) {
        console.log('Red Won');
    } else if (result != -1) {
        console.log('Yellow Won');
    }
    return result != -1;
}

function getEvaluations() {
    return core.getEvaluations();
}
/* WASM END */

/* UI Controls START */
const agentSelect = [
    document.getElementById('player-one-agent-select'),
    document.getElementById('player-two-agent-select')
];

const depthSelect = [
    document.getElementById('player-one-depth-select'),
    document.getElementById('player-two-depth-select')
];

for (let p = 0; p <= 1; p++) {
    agentSelect[p].addEventListener('change', function() {
        // show depth select if minimax
        if (this.value == 'minimax') {
            depthSelect[p].classList.remove('hidden');
        } else {
            depthSelect[p].classList.add('hidden');
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
    if (!isPlaying) return;
    if (endStateReached()) {
        isPlaying = false;
        return;
    }

    const agent = agentSelect[moves.length & 1].value;
    const depth = Number(depthSelect[moves.length & 1].value);
    console.log(depth);
    if (agent == 'minimax') {
        const startTime = performance.now();
        const move = getMinimaxMove(depth);
        const endTime = performance.now();

        makeMove(move);

        evaluations.push(getEvaluations());
        elapsedTime.push(endTime - startTime);

        updateStatTable();
    } else if (agent == 'human' && humanMove != -1) {
        makeMove(humanMove);
        humanMove = -1;
    }
}

function updateStatTable() {
    const formatter = Intl.NumberFormat('en');
    
    // current
    const currentEval = evaluations[evaluations.length - 1];  
    const currentTime = elapsedTime[elapsedTime.length - 1];
    const currentRate = (currentTime < 1) ? currentEval : (currentEval / currentTime);

    const current = document.querySelectorAll('#stat-current td');
    current[0].innerText = formatter.format(Math.round(currentEval));
    current[1].innerText = formatter.format(Math.round(currentTime));
    current[2].innerText = formatter.format(Math.round(currentRate));

    // total
    const totalEval = evaluations.reduce((a, b) => a + b, 0);
    const totalTime = elapsedTime.reduce((a, b) => a + b, 0);
    const totalRate = (totalTime < 1) ? totalEval : (totalEval / totalTime);

    const total = document.querySelectorAll('#stat-total td');
    total[0].innerText = formatter.format(Math.round(totalEval));
    total[1].innerText = formatter.format(Math.round(totalTime));
    total[2].innerText = formatter.format(Math.round(totalRate));

    // average
    const avgEval = totalEval / evaluations.length;
    const avgTime = totalTime / elapsedTime.length;
    const avgRate = (avgTime < 1) ? avgEval : (avgEval / avgTime);

    const average = document.querySelectorAll('#stat-average td');
    average[0].innerText = formatter.format(Math.round(avgEval));
    average[1].innerText = formatter.format(Math.round(avgTime));
    average[2].innerText = formatter.format(Math.round(avgRate));
}

function clearStatTable() {
    document.querySelectorAll('tbody td').forEach(item => {
        item.innerText = '';
    });
}

function draw() {
    drawGrid();

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
