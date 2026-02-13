import { DC_ROWS, DC_COLS, DC_PIECE_COUNTS, RED, BLACK } from '../constants.js';

export class DarkBoardLogic {
    constructor() {
        this.grid = [];
        this.init();
    }

    init() {
        this.grid = [];
        for (let r = 0; r < DC_ROWS; r++) {
            this.grid[r] = new Array(DC_COLS).fill(null);
        }
    }

    setupRandomPosition() {
        this.init();
        const pieces = [];
        for (const side of [RED, BLACK]) {
            for (const [type, count] of Object.entries(DC_PIECE_COUNTS)) {
                for (let i = 0; i < count; i++) {
                    pieces.push({ type, side, revealed: false });
                }
            }
        }
        // Fisher-Yates shuffle
        for (let i = pieces.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
        }
        let idx = 0;
        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                this.grid[r][c] = pieces[idx++];
            }
        }
    }

    isInBoard(row, col) {
        return row >= 0 && row < DC_ROWS && col >= 0 && col < DC_COLS;
    }

    getPiece(row, col) {
        if (!this.isInBoard(row, col)) return null;
        return this.grid[row][col];
    }

    setPiece(row, col, piece) {
        this.grid[row][col] = piece;
    }

    removePiece(row, col) {
        this.grid[row][col] = null;
    }

    flipPiece(row, col) {
        const piece = this.grid[row][col];
        if (piece && !piece.revealed) {
            piece.revealed = true;
            return { type: piece.type, side: piece.side };
        }
        return null;
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

    undoFlip(row, col) {
        const piece = this.grid[row][col];
        if (piece) {
            piece.revealed = false;
        }
    }

    countPieces(side) {
        let count = 0;
        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                const p = this.grid[r][c];
                if (p && p.side === side) count++;
            }
        }
        return count;
    }

    countRevealedPieces(side) {
        let count = 0;
        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                const p = this.grid[r][c];
                if (p && p.side === side && p.revealed) count++;
            }
        }
        return count;
    }

    hasUnrevealedPieces() {
        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                const p = this.grid[r][c];
                if (p && !p.revealed) return true;
            }
        }
        return false;
    }

    clone() {
        const copy = new DarkBoardLogic();
        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                const p = this.grid[r][c];
                copy.grid[r][c] = p ? { type: p.type, side: p.side, revealed: p.revealed } : null;
            }
        }
        return copy;
    }

    toJSON() {
        return this.grid.map(row =>
            row.map(p => p ? { type: p.type, side: p.side, revealed: p.revealed } : null)
        );
    }

    fromJSON(data) {
        this.init();
        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                const p = data[r]?.[c];
                this.grid[r][c] = p ? { type: p.type, side: p.side, revealed: p.revealed } : null;
            }
        }
    }
}
