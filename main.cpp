#include <stdio.h>
#include <stdint.h>
#include <time.h>

typedef uint64_t u64;
/*
  6 13 20 27 34 41 48   55 62
 ---------------------
| 5 12 19 26 33 40 47 | 54 61
| 4 11 18 25 32 39 46 | 53 60
| 3 10 17 24 31 38 45 | 52 59
| 2  9 16 23 30 37 44 | 51 58
| 1  8 15 22 29 36 43 | 50 57
| 0  7 14 21 28 35 42 | 49 56 63
 ---------------------
Bitboard Representation
*/

const int nrows = 6;
const int ncols = 7;
// bit indices for the top padding row
const int pad_top[ncols] = {6, 13, 20, 27, 34, 41, 48};
// simple heuristic, where a position's value is the number of possible 4-in-a-rows from that position
const int scoremap[] = {
    3, 4,  5,  5, 4, 3, 0,
    4, 6,  8,  8, 6, 4, 0,
    5, 8, 11, 11, 8, 5, 0,
    7, 9, 13, 13, 9, 7, 0,
    5, 8, 11, 11, 8, 5, 0,
    4, 6,  8,  8, 6, 4, 0,
    3, 4,  5,  5, 4, 3, 0
};

struct GameState {
    u64 bitboards[2] = {0, 0};
    // number of moves made
    int counter = 0;
    // bit indices where next move should be made
    int heights[ncols] = {0,  7, 14, 21, 28, 35, 42};

    bool move_is_valid(int icol) {
        return heights[icol] < pad_top[icol];
    }

    // @Note: assumes that the move is valid
    void make_move(int icol) {
        // flip the appropriate bit (0 -> 1)
        bitboards[counter & 1] ^= ((u64)1 << heights[icol]);

        counter++;
        heights[icol]++;
    }

    // @Note: assumes it is called right after a move is made
    void undo_move(int icol) {
        counter--;
        heights[icol]--;

        // flip the appropriate bit (1 -> 0)
        bitboards[counter & 1] ^= ((u64)1 << heights[icol]);
    }

    int check_win() {
        for (int idx = 0; idx <= 1; idx++) {
            u64 board = bitboards[idx];
            
            if ((board & (board >> 7) & (board >> 14) & (board >> 21)) != 0) return idx; // horizontal
            if ((board & (board >> 1) & (board >>  2) & (board >>  3)) != 0) return idx; // vertical
            if ((board & (board >> 8) & (board >> 16) & (board >> 24)) != 0) return idx; // positive diagonal
            if ((board & (board >> 6) & (board >> 12) & (board >> 18)) != 0) return idx; // negative diagonal
        }

        return -1;
    }

    // returns -1 if not in an end state, or an appropriate score
    int end_state_reached() {
        int winner = check_win();
        if (winner == 0) return  100000; // white won
        if (winner == 1) return -100000; // black won
        
        if (counter >= 42) return 0;     // tie

        return -1;
    }

    // outputs a score based on the current state of the board
    // assumes that the board is not in an end state
    int evaluate() {
        // for each cell, add score for white and subtract score for black
        int score = 0;
        for (int idx = 0; idx <= 47; idx++) {
            score += scoremap[idx] * ((bitboards[0] >> idx) & 1);
            score -= scoremap[idx] * ((bitboards[1] >> idx) & 1);
        }
        
        return score;
    }

    void display() {
        for (int irow = nrows - 1; irow >= 0; irow--) {
            printf("\n ");
            for (int icol = 0; icol < ncols; icol++) {
                int idx = irow + 7 * icol;
                
                if ((bitboards[0] >> idx) & 1) printf("● ");
                else if ((bitboards[1] >> idx) & 1) printf("○ ");
                else printf("· ");
            }
        }
        printf("\n 1 2 3 4 5 6 7\n\n");
    }
};

int minimax(GameState &board, int alpha, int beta, int depth) {
    int score = board.end_state_reached();
    if (score != -1) return score;
    if (depth ==  0) return board.evaluate();

    int sign = 1 - 2 * (board.counter & 1); // 1 if white, -1 if black

    for (int icol = 0; icol < ncols; icol++) {
        // skip filled columns
        if (!board.move_is_valid(icol)) continue;

        board.make_move(icol);
        int score = minimax(board, beta, alpha, depth - 1);
        board.undo_move(icol);
        
        if (sign * score > sign * alpha) alpha = score;
        if (sign * alpha >= sign * beta) break;
    }

    return alpha;
}

int get_minimax_move(GameState &board, int depth) {
    // +inf for black (1), -inf for white (0)
    int alpha = (board.counter & 1) ? 1000000 : -1000000;
    int beta  = -alpha;

    int best_move = 0;
    int sign = 1 - 2 * (board.counter & 1); // 1 if white, -1 if black

    for (int icol = 0; icol < ncols; icol++) {
        // skip filled columns
        if (!board.move_is_valid(icol)) continue;

        board.make_move(icol);
        int score = minimax(board, beta, alpha, depth - 1);
        board.undo_move(icol);

        if (sign * score > sign * alpha) {
            alpha = score;
            best_move  = icol;
        }

        if (sign * alpha >= sign * beta) break;
    }

    return best_move;
}

int main() {
    GameState board;
    int depths[2] = {8, 8};

    int end_score = -1;
    float total_time = 0;
    while (end_score == -1) {
        // board.display();
        clock_t start = clock();

        int move = get_minimax_move(board, depths[board.counter & 1]);
        
        clock_t end = clock();
        float seconds = (float)(end - start) / CLOCKS_PER_SEC;
        total_time += seconds;

        printf("%d, %.4fs\n", move + 1, seconds);
        board.make_move(move);

        end_score = board.end_state_reached();
    }

    board.display();
    printf("Total Time: %.3fs\n\n", total_time);

    if (end_score == 0) {
        printf("It's a Tie\n");
    } else if (end_score > 0) {
        printf("White (●) Won!\n");
    } else {
        printf("Black (○) Won!\n");
    }
}
