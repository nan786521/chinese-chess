// Zobrist Hashing + Transposition Table for Chinese Chess AI

import { ROWS, COLS, RED, BLACK } from './constants.js';

const PIECE_TYPES = ['king', 'advisor', 'elephant', 'rook', 'horse', 'cannon', 'pawn'];
const SIDES = [RED, BLACK];

// Seeded PRNG (Mulberry32) for deterministic keys across sessions
function mulberry32(seed) {
    return function () {
        seed |= 0; seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0);
    };
}

const rng = mulberry32(0xDEADBEEF);

// pieceKeys[type][side][row][col] = 32-bit integer
const pieceKeys = {};
for (const type of PIECE_TYPES) {
    pieceKeys[type] = {};
    for (const side of SIDES) {
        pieceKeys[type][side] = [];
        for (let r = 0; r < ROWS; r++) {
            pieceKeys[type][side][r] = [];
            for (let c = 0; c < COLS; c++) {
                pieceKeys[type][side][r][c] = rng();
            }
        }
    }
}

const sideKey = rng();

export { pieceKeys, sideKey };

// --- Transposition Table ---

export const EXACT = 0;
export const ALPHA_FLAG = 1;
export const BETA_FLAG = 2;

const TT_SIZE = 1 << 20; // ~1M entries
const TT_MASK = TT_SIZE - 1;

export class TranspositionTable {
    constructor() {
        this.entries = new Array(TT_SIZE);
        this.age = 0;
    }

    clear() {
        this.entries = new Array(TT_SIZE);
    }

    newSearch() {
        this.age++;
    }

    probe(hash, depth, alpha, beta) {
        const entry = this.entries[hash & TT_MASK];
        if (!entry || entry.hash !== hash) return null;

        const result = { bestMove: entry.bestMove };

        // Only use score if searched to sufficient depth
        if (entry.depth >= depth) {
            if (entry.flag === EXACT) {
                result.score = entry.score;
            } else if (entry.flag === ALPHA_FLAG && entry.score <= alpha) {
                result.score = alpha;
            } else if (entry.flag === BETA_FLAG && entry.score >= beta) {
                result.score = beta;
            }
        }

        return result;
    }

    store(hash, depth, score, flag, bestMove) {
        const idx = hash & TT_MASK;
        const existing = this.entries[idx];
        // Replace if: empty, same position, stale entry from older search, or deeper
        if (!existing || existing.hash === hash ||
            existing.age !== this.age || existing.depth <= depth) {
            this.entries[idx] = { hash, depth, score, flag, bestMove, age: this.age };
        }
    }
}
