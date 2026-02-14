// Board dimensions
export const COLS = 9;
export const ROWS = 10;

// Sides
export const RED = 'red';
export const BLACK = 'black';

// Piece types
export const KING = 'king';
export const ADVISOR = 'advisor';
export const ELEPHANT = 'elephant';
export const ROOK = 'rook';
export const HORSE = 'horse';
export const CANNON = 'cannon';
export const PAWN = 'pawn';

// Display characters
export const PIECE_CHARS = {
    red: {
        king: '帥', advisor: '仕', elephant: '相',
        rook: '俥', horse: '傌', cannon: '炮', pawn: '兵'
    },
    black: {
        king: '將', advisor: '士', elephant: '象',
        rook: '車', horse: '馬', cannon: '砲', pawn: '卒'
    }
};

// Palace boundaries
export const PALACE = {
    red:   { rowMin: 7, rowMax: 9, colMin: 3, colMax: 5 },
    black: { rowMin: 0, rowMax: 2, colMin: 3, colMax: 5 }
};

// River boundary
export const RIVER = { redMin: 5, blackMax: 4 };

// Initial piece positions
// Row 0 = top (Black back rank), Row 9 = bottom (Red back rank)
export const INITIAL_POSITIONS = [
    // Black pieces (top)
    { type: ROOK,     side: BLACK, row: 0, col: 0 },
    { type: HORSE,    side: BLACK, row: 0, col: 1 },
    { type: ELEPHANT, side: BLACK, row: 0, col: 2 },
    { type: ADVISOR,  side: BLACK, row: 0, col: 3 },
    { type: KING,     side: BLACK, row: 0, col: 4 },
    { type: ADVISOR,  side: BLACK, row: 0, col: 5 },
    { type: ELEPHANT, side: BLACK, row: 0, col: 6 },
    { type: HORSE,    side: BLACK, row: 0, col: 7 },
    { type: ROOK,     side: BLACK, row: 0, col: 8 },
    { type: CANNON,   side: BLACK, row: 2, col: 1 },
    { type: CANNON,   side: BLACK, row: 2, col: 7 },
    { type: PAWN,     side: BLACK, row: 3, col: 0 },
    { type: PAWN,     side: BLACK, row: 3, col: 2 },
    { type: PAWN,     side: BLACK, row: 3, col: 4 },
    { type: PAWN,     side: BLACK, row: 3, col: 6 },
    { type: PAWN,     side: BLACK, row: 3, col: 8 },
    // Red pieces (bottom)
    { type: ROOK,     side: RED, row: 9, col: 0 },
    { type: HORSE,    side: RED, row: 9, col: 1 },
    { type: ELEPHANT, side: RED, row: 9, col: 2 },
    { type: ADVISOR,  side: RED, row: 9, col: 3 },
    { type: KING,     side: RED, row: 9, col: 4 },
    { type: ADVISOR,  side: RED, row: 9, col: 5 },
    { type: ELEPHANT, side: RED, row: 9, col: 6 },
    { type: HORSE,    side: RED, row: 9, col: 7 },
    { type: ROOK,     side: RED, row: 9, col: 8 },
    { type: CANNON,   side: RED, row: 7, col: 1 },
    { type: CANNON,   side: RED, row: 7, col: 7 },
    { type: PAWN,     side: RED, row: 6, col: 0 },
    { type: PAWN,     side: RED, row: 6, col: 2 },
    { type: PAWN,     side: RED, row: 6, col: 4 },
    { type: PAWN,     side: RED, row: 6, col: 6 },
    { type: PAWN,     side: RED, row: 6, col: 8 },
];

// Material values for AI evaluation
export const PIECE_VALUES = {
    king:     10000,
    rook:     900,
    cannon:   450,
    horse:    450,
    elephant: 200,
    advisor:  200,
    pawn:     100
};

// Piece-Square Tables (from Red's perspective, row 9 = Red's back rank)
// For Black, mirror vertically: use row (9 - r)
export const PST = {
    king: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 1, 5, 1, 0, 0, 0],
        [0, 0, 0, 2, 8, 2, 0, 0, 0],
        [0, 0, 0,11,15,11, 0, 0, 0],
    ],
    advisor: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0,20, 0,20, 0, 0, 0],
        [0, 0, 0, 0,23, 0, 0, 0, 0],
        [0, 0, 0,20, 0,20, 0, 0, 0],
    ],
    elephant: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0,20, 0, 0, 0,20, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [18, 0, 0, 0,23, 0, 0, 0,18],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0,20, 0, 0, 0,20, 0, 0],
    ],
    rook: [
        [194,206,204,212,200,212,204,206,194],
        [200,208,206,212,200,212,206,208,200],
        [198,208,204,212,200,212,204,208,198],
        [204,209,204,212,200,212,204,209,204],
        [208,212,212,214,208,214,212,212,208],
        [208,212,212,214,208,214,212,212,208],
        [204,209,204,212,200,212,204,209,204],
        [198,208,204,212,200,212,204,208,198],
        [200,208,206,212,200,212,206,208,200],
        [194,206,204,212,200,212,204,206,194],
    ],
    horse: [
        [88, 85, 90, 88, 90, 88, 90, 85, 88],
        [85, 90, 92, 93, 78, 93, 92, 90, 85],
        [93, 92, 94, 95, 92, 95, 94, 92, 93],
        [92, 94, 98,100, 96,100, 98, 94, 92],
        [90, 98,101,102,103,102,101, 98, 90],
        [90, 98,101,102,103,102,101, 98, 90],
        [92, 94, 98,100, 96,100, 98, 94, 92],
        [93, 92, 94, 95, 92, 95, 94, 92, 93],
        [85, 90, 92, 93, 78, 93, 92, 90, 85],
        [88, 85, 90, 88, 90, 88, 90, 85, 88],
    ],
    cannon: [
        [100,100, 98, 95, 94, 95, 98,100,100],
        [100,102,100, 98, 96, 98,100,102,100],
        [ 98,100,100, 98,100, 98,100,100, 98],
        [ 98,102,102,104,106,104,102,102, 98],
        [ 98,100,100,102,106,102,100,100, 98],
        [ 96, 98,100, 98,104, 98,100, 98, 96],
        [ 96, 96, 98, 98,100, 98, 98, 96, 96],
        [ 97, 96,100, 99,101, 99,100, 96, 97],
        [ 96, 97, 98, 98, 98, 98, 98, 97, 96],
        [ 96, 96, 97, 99, 99, 99, 97, 96, 96],
    ],
    pawn: [
        [ 9,  9,  9, 11, 13, 11,  9,  9,  9],
        [19, 24, 34, 42, 44, 42, 34, 24, 19],
        [19, 24, 32, 37, 37, 37, 32, 24, 19],
        [19, 23, 27, 29, 30, 29, 27, 23, 19],
        [14, 18, 20, 27, 29, 27, 20, 18, 14],
        [14, 18, 20, 27, 29, 27, 20, 18, 14],
        [10,  0, 13,  0, 18,  0, 13,  0, 10],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    ],
};

// Endgame Piece-Square Tables (from Red's perspective)
// In endgame: king stays safe, pawns much more valuable when advanced,
// rooks dominate, cannons lose value without screen pieces
export const PST_ENDGAME = {
    king: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 5, 8, 5, 0, 0, 0],
        [0, 0, 0, 8,12, 8, 0, 0, 0],
        [0, 0, 0, 5, 8, 5, 0, 0, 0],
    ],
    advisor: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0,25, 0,25, 0, 0, 0],
        [0, 0, 0, 0,30, 0, 0, 0, 0],
        [0, 0, 0,25, 0,25, 0, 0, 0],
    ],
    elephant: [
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0,22, 0, 0, 0,22, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [20, 0, 0, 0,25, 0, 0, 0,20],
        [0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0,22, 0, 0, 0,22, 0, 0],
    ],
    rook: [
        [200,210,208,216,206,216,208,210,200],
        [206,214,212,218,206,218,212,214,206],
        [204,214,210,218,206,218,210,214,204],
        [210,215,210,218,206,218,210,215,210],
        [214,218,218,220,214,220,218,218,214],
        [214,218,218,220,214,220,218,218,214],
        [210,215,210,218,206,218,210,215,210],
        [204,214,210,218,206,218,210,214,204],
        [206,214,212,218,206,218,212,214,206],
        [200,210,208,216,206,216,208,210,200],
    ],
    horse: [
        [85, 82, 87, 85, 87, 85, 87, 82, 85],
        [82, 87, 90, 92, 76, 92, 90, 87, 82],
        [90, 90, 92, 94, 90, 94, 92, 90, 90],
        [90, 92, 97, 99, 95, 99, 97, 92, 90],
        [88, 97,100,102,103,102,100, 97, 88],
        [88, 97,100,102,103,102,100, 97, 88],
        [90, 92, 97, 99, 95, 99, 97, 92, 90],
        [90, 90, 92, 94, 90, 94, 92, 90, 90],
        [82, 87, 90, 92, 76, 92, 90, 87, 82],
        [85, 82, 87, 85, 87, 85, 87, 82, 85],
    ],
    cannon: [
        [90, 90, 88, 85, 84, 85, 88, 90, 90],
        [90, 92, 90, 88, 86, 88, 90, 92, 90],
        [88, 90, 90, 88, 90, 88, 90, 90, 88],
        [88, 92, 92, 94, 96, 94, 92, 92, 88],
        [88, 90, 90, 92, 96, 92, 90, 90, 88],
        [86, 88, 90, 88, 94, 88, 90, 88, 86],
        [86, 86, 88, 88, 90, 88, 88, 86, 86],
        [87, 86, 90, 89, 91, 89, 90, 86, 87],
        [86, 87, 88, 88, 88, 88, 88, 87, 86],
        [86, 86, 87, 89, 89, 89, 87, 86, 86],
    ],
    pawn: [
        [12, 12, 12, 15, 18, 15, 12, 12, 12],
        [25, 30, 42, 52, 55, 52, 42, 30, 25],
        [25, 30, 40, 46, 46, 46, 40, 30, 25],
        [24, 28, 34, 36, 38, 36, 34, 28, 24],
        [18, 22, 25, 32, 35, 32, 25, 22, 18],
        [18, 22, 25, 32, 35, 32, 25, 22, 18],
        [12,  0, 15,  0, 20,  0, 15,  0, 12],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
        [ 0,  0,  0,  0,  0,  0,  0,  0,  0],
    ],
};

// Phase weights for tapered evaluation (higher = more middlegame weight)
export const PHASE_WEIGHTS = {
    king: 0, advisor: 1, elephant: 1,
    rook: 5, horse: 3, cannon: 3, pawn: 0
};
export const TOTAL_PHASE = 28; // 2*(5+5+3+3+3+3+1+1+1+1) per side max=28

// AI difficulty settings (depths increased due to better pruning)
export const AI_DIFFICULTY = {
    beginner: { depth: 3, quiesceDepth: 2, randomness: 150, label: '入門' },
    easy:     { depth: 4, quiesceDepth: 3, randomness: 30,  label: '初級' },
    medium:   { depth: 5, quiesceDepth: 4, randomness: 0,   label: '中級' },
    hard:     { depth: 6, quiesceDepth: 5, randomness: 0,   label: '高級' },
    master:   { depth: 8, quiesceDepth: 6, randomness: 0,   label: '大師' }
};

// === Dark Chess (暗棋) Constants ===

export const DC_ROWS = 4;
export const DC_COLS = 8;

// Rank hierarchy: lower number = higher rank
export const DC_RANKS = {
    king: 1,
    advisor: 2,
    elephant: 3,
    rook: 4,
    horse: 5,
    cannon: 6,
    pawn: 7
};

// Piece counts per side (total 16 per side, 32 total)
export const DC_PIECE_COUNTS = {
    king: 1, advisor: 2, elephant: 2,
    rook: 2, horse: 2, cannon: 2, pawn: 5
};

// Draw if no captures in this many moves
export const DC_DRAW_MOVE_LIMIT = 50;

// Material values for dark chess AI
export const DC_PIECE_VALUES = {
    king: 600, advisor: 250, elephant: 250,
    rook: 500, horse: 300, cannon: 300, pawn: 100
};

// Dark chess AI difficulty settings (depths increased due to fixed alpha-beta)
export const DC_AI_CONFIG = {
    beginner: { depth: 1, randomness: 80, monteCarloSims: 0 },
    easy:     { depth: 3, randomness: 30, monteCarloSims: 0 },
    medium:   { depth: 4, randomness: 0,  monteCarloSims: 30 },
    hard:     { depth: 5, randomness: 0,  monteCarloSims: 80 },
};
