import { ROWS, COLS, INITIAL_POSITIONS } from './constants.js';

export class BoardLogic {
    constructor() {
        this.grid = [];
    }

    init() {
        this.grid = [];
        for (let r = 0; r < ROWS; r++) {
            this.grid[r] = new Array(COLS).fill(null);
        }
    }

    setupInitialPosition() {
        this.init();
        for (const p of INITIAL_POSITIONS) {
            this.grid[p.row][p.col] = { type: p.type, side: p.side };
        }
    }

    clone() {
        const copy = new BoardLogic();
        copy.grid = [];
        for (let r = 0; r < ROWS; r++) {
            copy.grid[r] = [];
            for (let c = 0; c < COLS; c++) {
                const piece = this.grid[r][c];
                copy.grid[r][c] = piece ? { type: piece.type, side: piece.side } : null;
            }
        }
        return copy;
    }

    // Serialize grid to plain array (for network transmission)
    toJSON() {
        return this.grid.map(row => row.map(cell =>
            cell ? { type: cell.type, side: cell.side } : null
        ));
    }

    // Restore grid from serialized data
    fromJSON(data) {
        this.grid = data.map(row => row.map(cell =>
            cell ? { type: cell.type, side: cell.side } : null
        ));
    }

    getPiece(row, col) {
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
        return this.grid[row][col];
    }

    setPiece(row, col, piece) {
        this.grid[row][col] = piece;
    }

    removePiece(row, col) {
        this.grid[row][col] = null;
    }

    movePiece(fromRow, fromCol, toRow, toCol) {
        const captured = this.grid[toRow][toCol];
        this.grid[toRow][toCol] = this.grid[fromRow][fromCol];
        this.grid[fromRow][fromCol] = null;
        return captured;
    }

    undoMove(moveRecord) {
        const { fromRow, fromCol, toRow, toCol, captured } = moveRecord;
        this.grid[fromRow][fromCol] = this.grid[toRow][toCol];
        this.grid[toRow][toCol] = captured || null;
    }

    findKing(side) {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.grid[r][c];
                if (p && p.type === 'king' && p.side === side) {
                    return { row: r, col: c };
                }
            }
        }
        return null;
    }

    getPieces(side) {
        const pieces = [];
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.grid[r][c];
                if (p && p.side === side) {
                    pieces.push({ ...p, row: r, col: c });
                }
            }
        }
        return pieces;
    }

    isInBoard(row, col) {
        return row >= 0 && row < ROWS && col >= 0 && col < COLS;
    }

    isInPalace(row, col, side) {
        if (side === 'red') {
            return row >= 7 && row <= 9 && col >= 3 && col <= 5;
        }
        return row >= 0 && row <= 2 && col >= 3 && col <= 5;
    }

    hasCrossedRiver(row, side) {
        return side === 'red' ? row <= 4 : row >= 5;
    }
}
