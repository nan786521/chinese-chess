import { DarkBoard } from './dark-board.js';
import { generatePieceMoves } from '../../shared/dark-chess/dark-moves.js';
import { checkDarkChessGameOver } from '../../shared/dark-chess/dark-rules.js';
import { RED, BLACK, PIECE_CHARS } from '../../shared/constants.js';

export class DarkChessGame {
    constructor() {
        this.board = new DarkBoard();
        this.currentSide = RED;        // Red always goes first
        this.moveHistory = [];
        this.gameMode = 'dc-pvp';      // 'dc-pvp' | 'dc-pva'
        this.playerSide = null;        // null until first flip
        this.aiDifficulty = 'medium';
        this.gameOver = false;
        this.winner = null;
        this.moveCount = 0;
        this.movesSinceCapture = 0;
        this.selectedPiece = null;
        this.validMoves = [];
        this.isAIThinking = false;
        this.colorAssigned = false;
    }

    newGame(mode, difficulty) {
        this.board.setupRandomPosition();
        this.currentSide = RED;
        this.moveHistory = [];
        this.gameMode = mode;
        this.aiDifficulty = difficulty || 'medium';
        this.gameOver = false;
        this.winner = null;
        this.moveCount = 0;
        this.movesSinceCapture = 0;
        this.selectedPiece = null;
        this.validMoves = [];
        this.isAIThinking = false;
        this.colorAssigned = false;
        this.playerSide = null;
    }

    // Get the piece color controlled by the current turn's player
    // RED turns = 先手, BLACK turns = 後手
    getActivePieceColor() {
        if (!this.colorAssigned) return null;
        // 先手 (RED turns) controls playerSide color
        // 後手 (BLACK turns) controls the opposite color
        if (this.currentSide === RED) {
            return this.playerSide;
        } else {
            return this.playerSide === RED ? BLACK : RED;
        }
    }

    handleClick(row, col) {
        if (this.gameOver || this.isAIThinking) return null;

        // In PvA, block clicks when AI's turn (AI = 後手 = BLACK turns)
        if (this.gameMode === 'dc-pva' && this.currentSide === BLACK) {
            return null;
        }

        const piece = this.board.getPiece(row, col);
        const myColor = this.getActivePieceColor();

        // No piece selected yet
        if (!this.selectedPiece) {
            // Click unrevealed piece -> flip
            if (piece && !piece.revealed) {
                return this.flipPiece(row, col);
            }
            // Click own revealed piece -> select
            if (piece && piece.revealed && myColor && piece.side === myColor) {
                return this.selectPiece(row, col);
            }
            return null;
        }

        // Piece is selected
        // Click on unrevealed piece -> deselect and flip instead
        if (piece && !piece.revealed) {
            this.selectedPiece = null;
            this.validMoves = [];
            return this.flipPiece(row, col);
        }

        // Click on own revealed piece -> reselect
        if (piece && piece.revealed && myColor && piece.side === myColor) {
            return this.selectPiece(row, col);
        }

        // Try to move/capture
        return this.tryMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
    }

    flipPiece(row, col) {
        const revealed = this.board.flipPiece(row, col);
        if (!revealed) return null;

        // First flip determines color (先手 gets the flipped piece's color)
        if (!this.colorAssigned) {
            this.colorAssigned = true;
            this.playerSide = revealed.side; // 先手's piece color
        }

        const record = {
            action: 'flip',
            row, col,
            piece: { type: revealed.type, side: revealed.side }
        };
        this.moveHistory.push(record);
        this.moveCount++;
        this.movesSinceCapture++;

        const prevSide = this.currentSide;
        this.currentSide = this.currentSide === RED ? BLACK : RED;
        this.selectedPiece = null;
        this.validMoves = [];

        const nextPieceColor = this.getActivePieceColor();
        const gameState = checkDarkChessGameOver(
            this.board, nextPieceColor || this.currentSide, this.movesSinceCapture
        );
        if (gameState.over) {
            this.gameOver = true;
            this.winner = gameState.winner;
        }

        return {
            action: 'flip',
            row, col,
            piece: revealed,
            prevSide,
            colorAssigned: this.colorAssigned,
            playerSide: this.playerSide,
            gameOver: this.gameOver,
            winner: this.winner,
            reason: gameState.reason,
            notation: `翻 ${PIECE_CHARS[revealed.side][revealed.type]}`
        };
    }

    selectPiece(row, col) {
        this.selectedPiece = { row, col };
        this.validMoves = generatePieceMoves(this.board, row, col);
        return { action: 'select', row, col, validMoves: this.validMoves };
    }

    tryMove(fromRow, fromCol, toRow, toCol) {
        const isValid = this.validMoves.some(m => m.toRow === toRow && m.toCol === toCol);
        if (!isValid) {
            this.selectedPiece = null;
            this.validMoves = [];
            return { action: 'deselect' };
        }
        return this.executeMove(fromRow, fromCol, toRow, toCol);
    }

    executeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board.getPiece(fromRow, fromCol);
        const captured = this.board.movePiece(fromRow, fromCol, toRow, toCol);

        if (captured) {
            this.movesSinceCapture = 0;
        } else {
            this.movesSinceCapture++;
        }

        const moveRecord = {
            action: captured ? 'capture' : 'move',
            fromRow, fromCol, toRow, toCol,
            captured,
            piece: { type: piece.type, side: piece.side }
        };
        this.moveHistory.push(moveRecord);
        this.moveCount++;

        const prevSide = this.currentSide;
        this.currentSide = this.currentSide === RED ? BLACK : RED;
        this.selectedPiece = null;
        this.validMoves = [];

        const nextPieceColor = this.getActivePieceColor();
        const gameState = checkDarkChessGameOver(
            this.board, nextPieceColor || this.currentSide, this.movesSinceCapture
        );
        if (gameState.over) {
            this.gameOver = true;
            this.winner = gameState.winner;
        }

        return {
            action: captured ? 'capture' : 'move',
            move: moveRecord,
            prevSide,
            gameOver: this.gameOver,
            winner: this.winner,
            reason: gameState.reason,
            notation: this.getMoveNotation(moveRecord)
        };
    }

    undo() {
        if (this.moveHistory.length === 0 || this.isAIThinking) return false;

        const undoCount = (this.gameMode === 'dc-pva' && this.moveHistory.length >= 2) ? 2 : 1;
        const undone = [];

        for (let i = 0; i < undoCount && this.moveHistory.length > 0; i++) {
            const record = this.moveHistory.pop();
            undone.push(record);

            if (record.action === 'flip') {
                this.board.undoFlip(record.row, record.col);
            } else {
                this.board.undoMove(record);
                if (record.captured) {
                    this.movesSinceCapture = this.recalcMovesSinceCapture();
                }
            }

            this.moveCount--;
            this.currentSide = this.currentSide === RED ? BLACK : RED;
        }

        // Check if we need to unassign color (all flips undone)
        if (this.moveHistory.length === 0) {
            this.colorAssigned = false;
            this.playerSide = null;
        }

        this.gameOver = false;
        this.winner = null;
        this.selectedPiece = null;
        this.validMoves = [];
        return undone;
    }

    recalcMovesSinceCapture() {
        let count = 0;
        for (let i = this.moveHistory.length - 1; i >= 0; i--) {
            if (this.moveHistory[i].captured) break;
            count++;
        }
        return count;
    }

    isAITurn() {
        // AI is always 後手 (second player), which plays on BLACK turns
        return this.gameMode === 'dc-pva' &&
               this.currentSide === BLACK &&
               !this.gameOver;
    }

    getMoveNotation(moveRecord) {
        const { piece, fromCol, fromRow, toCol, toRow, captured } = moveRecord;
        const charName = PIECE_CHARS[piece.side][piece.type];
        const actionStr = captured ? '吃' : '→';
        return `${charName}(${fromCol},${fromRow})${actionStr}(${toCol},${toRow})`;
    }
}
