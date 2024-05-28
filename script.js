const boardWidth  = 560;
const boardHeight = 480;

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
// https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio
// actual visual size (css)
canvas.style.width = `${boardWidth}px`;
canvas.style.height = `${boardHeight}px`;

// scale canvas in memory to account for extra pixel density on HiDPI displays
// set scale to 1 to see what would happen normally
const scale = window.devicePixelRatio;
canvas.width = Math.floor(boardWidth * scale);
canvas.height = Math.floor(boardHeight * scale);

// normalize coordinate system to use visual size
ctx.scale(scale, scale);

const nrows = 6;
const ncols = 7;

const lineWidth = 4;

const cellWidth = (boardWidth - lineWidth)/ncols;
const cellHeight = (boardHeight - lineWidth)/nrows;

const boardFg = "#3980a0";
const boardBg = "#eef7ff";

const coinRed = "#ce5454";
const coinYellow = "#dfc352";

const coinRedSubtle = "#e6a9a9";
const coinYellowSubtle = "#efe1a8";

const coinRedBorder = "#b94343";
const coinYellowBorder = "#c3a343";

const coinRedBorderSubtle = "#d79191";
const coinYellowBorderSubtle = "#dbc88e";
const radius = cellWidth/2;

// store indices of columns where coins were placed
let moves = [];
let nextColIndex = -1;
let heights = [0, 0, 0, 0, 0, 0, 0];
let isPlaying = false;
let humanMoveMade = false;

function reset() {
    moves = [];
    nextColIndex = -1;
    heights = [0, 0, 0, 0, 0, 0, 0];
    isPlaying = false;
    humanMoveMade = false;
}

function play() {
    isPlaying = true;
}

canvas.addEventListener("mousemove", (event) => {
    if (!isPlaying) return;
    const rect = canvas.getBoundingClientRect();
    nextColIndex = Math.floor((event.clientX - rect.left) / cellWidth);
});

canvas.addEventListener("click", function() {
    humanMoveMade = true;
});

function makeMove(icol) {
    // ensure the move is valid
    if (!isPlaying || heights[icol] >= nrows) return;

    moves.push(icol);
    heights[icol]++;
}

function drawGrid() {
    ctx.fillStyle = boardFg;

    ctx.fillRect(0, 0, boardWidth, boardHeight);
    
    ctx.fillStyle = boardBg;
    ctx.strokeStyle = boardFg;
    ctx.lineWidth = lineWidth;
    
    for (let irow = 0; irow < nrows; irow++) {
        const circleY = (irow + 1)* cellHeight - radius + lineWidth/2;

        for (let icol = 0; icol < ncols; icol++) {
            const circleX = (icol + 1)* cellWidth - radius + lineWidth/2;

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
    const coinX = (icol + 1)* cellWidth - radius + lineWidth/2;
    const coinY = (irow + 1)* cellHeight - radius + lineWidth/2;

    ctx.arc(coinX, coinY, radius - 2*lineWidth, 0, 2 * Math.PI);

    ctx.fill();
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
    const array = new Uint32Array(memory.buffer);
    for (let i = 0; i < moves.length; i++) {
        array[i] = moves[i];
    }
    
    return core.getMinimaxMove(0, moves.length, depth);
}

function endStateReached() {
    const array = new Uint32Array(memory.buffer);
    for (let i = 0; i < moves.length; i++) {
        array[i] = moves[i];
    }

    const result = core.endStateReached(0, moves.length);

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
    document.getElementById('player-one-select'),
    document.getElementById('player-two-select')
];

const depthInput = [
    document.getElementById('player-one-depth-input'),
    document.getElementById('player-two-depth-input')
];

const depthLabel = [
    document.getElementById('player-one-depth-label'),
    document.getElementById('player-two-depth-label')
];

for (let p = 0; p <= 1; p++) {
    agentSelect[p].addEventListener('change', function() {
        // show depth picker if minimax
        if (this.value == 'minimax') {
            depthInput[p].classList.remove('hidden');
            depthLabel[p].innerText = depthInput[p].value;
        } else {
            depthInput[p].classList.add('hidden');
            depthLabel[p].innerText = '';
        }
    });

    // update the depth picker's label as its value changes
    depthInput[p].oninput = function() {
        depthLabel[p].innerText = depthInput[p].value;
    }
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
        nextColIndex = -1;
        return;
    }

    const agent = agentSelect[moves.length & 1].value;
    const depth = Number(depthInput[moves.length & 1].value);
    if (agent == 'minimax') {
        nextColIndex = getMinimaxMove(depth);
        makeMove(nextColIndex);
    } else if (agent == 'human' && humanMoveMade) {
        makeMove(nextColIndex);
        humanMoveMade = false;
    }
}

function draw() {
    drawGrid();

    // draw current state of board
    let hcols = [0, 0, 0, 0, 0, 0, 0];
    for (let counter = 0; counter < moves.length; counter++) {
        const icol = moves[counter];

        const fillColor = (counter % 2 == 0) ? coinRed : coinYellow;
        const strokeColor = (counter % 2 == 0) ? coinRedBorder : coinYellowBorder;

        drawCoin(fillColor, strokeColor, nrows - hcols[icol] - 1, icol);
        hcols[icol]++;
    }

    // highlight next move
    const strokeColor = (moves.length % 2 == 0) ? coinRedBorderSubtle : coinYellowBorderSubtle;
    if (nextColIndex != -1) drawCoin(boardBg, strokeColor, nrows - heights[nextColIndex] - 1, nextColIndex);
}
