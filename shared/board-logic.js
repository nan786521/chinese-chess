import { ROWS, COLS, INITIAL_POSITIONS } from './constants.js';
import { pieceKeys, sideKey } from './zobrist.js';

export class BoardLogic {
    constructor() {
        this.grid = [];
        this.hash = 0;
        this.pieceCount = 0;
        this._kingPos = { red: null, black: null };
    }

    init() {
        this.grid = [];
        for (let r = 0; r < ROWS; r++) {
            this.grid[r] = new Array(COLS).fill(null);
        }
        this.hash = 0;
        this.pieceCount = 0;
        this._kingPos = { red: null, black: null };
    }

    setupInitialPosition() {
        this.init();
        for (const p of INITIAL_POSITIONS) {
            this.grid[p.row][p.col] = { type: p.type, side: p.side };
            this.pieceCount++;
            if (p.type === 'king') this._kingPos[p.side] = { row: p.row, col: p.col };
        }
        this.computeHash();
    }

    computeHash() {
        this.hash = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.grid[r][c];
                if (p) {
                    this.hash = (this.hash ^ pieceKeys[p.type][p.side][r][c]) >>> 0;
                }
            }
        }
    }

    _rebuildMeta() {
        this.pieceCount = 0;
        this._kingPos = { red: null, black: null };
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const p = this.grid[r][c];
                if (p) {
                    this.pieceCount++;
                    if (p.type === 'king') this._kingPos[p.side] = { row: r, col: c };
                }
            }
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
        copy.hash = this.hash;
        copy.pieceCount = this.pieceCount;
        copy._kingPos = {
            red: this._kingPos.red ? { ...this._kingPos.red } : null,
            black: this._kingPos.black ? { ...this._kingPos.black } : null,
        };
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
        this.computeHash();
        this._rebuildMeta();
    }

    getPiece(row, col) {
        if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return null;
        return this.grid[row][col];
    }

    setPiece(row, col, piece) {
        // Update hash: remove old piece if any
        const old = this.grid[row][col];
        if (old) {
            this.hash = (this.hash ^ pieceKeys[old.type][old.side][row][col]) >>> 0;
            this.pieceCount--;
            if (old.type === 'king') this._kingPos[old.side] = null;
        }
        // Add new piece
        if (piece) {
            this.hash = (this.hash ^ pieceKeys[piece.type][piece.side][row][col]) >>> 0;
            this.pieceCount++;
            if (piece.type === 'king') this._kingPos[piece.side] = { row, col };
        }
        this.grid[row][col] = piece;
    }

    removePiece(row, col) {
        const old = this.grid[row][col];
        if (old) {
            this.hash = (this.hash ^ pieceKeys[old.type][old.side][row][col]) >>> 0;
            this.pieceCount--;
            if (old.type === 'king') this._kingPos[old.side] = null;
        }
        this.grid[row][col] = null;
    }

    movePiece(fromRow, fromCol, toRow, toCol) {
        const moving = this.grid[fromRow][fromCol];
        const captured = this.grid[toRow][toCol];

        // Incremental hash update
        if (moving) {
            this.hash = (this.hash ^ pieceKeys[moving.type][moving.side][fromRow][fromCol]) >>> 0;
            this.hash = (this.hash ^ pieceKeys[moving.type][moving.side][toRow][toCol]) >>> 0;
        }
        if (captured) {
            this.hash = (this.hash ^ pieceKeys[captured.type][captured.side][toRow][toCol]) >>> 0;
            this.pieceCount--;
            if (captured.type === 'king') this._kingPos[captured.side] = null;
        }
        this.hash = (this.hash ^ sideKey) >>> 0;

        // Update king position cache
        if (moving && moving.type === 'king') {
            this._kingPos[moving.side] = { row: toRow, col: toCol };
        }

        this.grid[toRow][toCol] = this.grid[fromRow][fromCol];
        this.grid[fromRow][fromCol] = null;
        return captured;
    }

    undoMove(moveRecord) {
        const { fromRow, fromCol, toRow, toCol, captured } = moveRecord;
        const moving = this.grid[toRow][toCol];

        // Reverse hash update (XOR is self-inverse)
        this.hash = (this.hash ^ sideKey) >>> 0;
        if (captured) {
            this.hash = (this.hash ^ pieceKeys[captured.type][captured.side][toRow][toCol]) >>> 0;
            this.pieceCount++;
            if (captured.type === 'king') this._kingPos[captured.side] = { row: toRow, col: toCol };
        }
        if (moving) {
            this.hash = (this.hash ^ pieceKeys[moving.type][moving.side][toRow][toCol]) >>> 0;
            this.hash = (this.hash ^ pieceKeys[moving.type][moving.side][fromRow][fromCol]) >>> 0;
            // Restore king position
            if (moving.type === 'king') {
                this._kingPos[moving.side] = { row: fromRow, col: fromCol };
            }
        }

        this.grid[fromRow][fromCol] = this.grid[toRow][toCol];
        this.grid[toRow][toCol] = captured || null;
    }

    findKing(side) {
        return this._kingPos[side] || null;
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
