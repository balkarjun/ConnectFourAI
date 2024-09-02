# ConnectFour AI
An interactive Connect Four game with a powerful AI opponent. The AI uses a depth-limited minimax algorithm with alpha-beta pruning. It was written in C++ and compiled to WebAssembly resulting in a blazingly fast AI that can run locally on the browser. The interface was made using HTML, CSS and JavaScript.

Play the [demo here](https://balkarjun.github.io/ConnectFourAI/) and see if you can beat the AI. No installation required.

![Connect Four Game Interface](https://balkarjun.github.io/projects/connect-four-ai/connect-four.png)

### Description
I wrote a [blog post](https://balkarjun.github.io/blog/minimax-connect-four/) on the techniques that went into making this AI.

Here's how it works: The AI looks at all the moves that it and its opponent can make, upto a certain depth. It evaluates each of the resulting positions to obtain a score indicating the player that is more likely to win. The AI picks the move that maximizes its score.

Javascript was too slow for handling this logic since the AI has to evaluate millions of positions before making a move. A common solution is to write the AI in a more performant language and have it run on the server-side. But that requires setting up and managing a server.

Instead, I wrote the algorithm in C++ and compiled it to WebAssembly using Emscripten. This allows the code to run completely on the client-side, no server required! The compiled Wasm file is only 2.6KB in size and is not much slower than running C++ natively. On Google Chrome running on my Apple M1 Macbook, the AI can evaluate ~30,000 positions in 1 millisecond.

### Usage
Clone this repo, and start a server in the root folder. You can open the `index.html` file in a browser to load the user interface. It uses the `static/style.css` and `static/script.js` files for styling and interactivity. All the AI logic resides in the `main.cpp` file. It has been compiled to Wasm, and the resulting binary is stored in `static/main.wasm`. This Wasm file is loaded automatically and allows you to play against the AI.

If you want to run this project locally on your machine, you will need a C++ compiler (like [Clang](https://clang.llvm.org/)) and [Emscripten](https://emscripten.org/) (for compiling to Wasm). Simply run the `build.sh` file to get the compiled Wasm file.
