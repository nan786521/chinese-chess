import { Board } from './board.js';
import { generateAllLegalMoves } from '../shared/moves.js';
import { isInCheck, checkGameOver } from '../shared/rules.js';
import { RED, BLACK, PIECE_CHARS } from '../shared/constants.js';

export class Game {
    constructor() {
        this.board = new Board();
        this.currentSide = RED;
        this.moveHistory = [];
        this.gameMode = 'pvp';       // 'pvp' | 'pva' | 'online'
        this.playerSide = RED;
        this.localSide = RED;        // For online mode
        this.aiDifficulty = 'medium';
        this.gameOver = false;
        this.winner = null;
        this.moveCount = 0;
        this.selectedPiece = null;
        this.validMoves = [];
        this.isAIThinking = false;
        this.onSendMove = null;      // Callback for online mode
    }

    newGame(mode, playerSide, difficulty) {
        this.board.setupInitialPosition();
        this.currentSide = RED;
        this.moveHistory = [];
        this.gameMode = mode;
        this.playerSide = playerSide || RED;
        this.localSide = playerSide || RED;
        this.aiDifficulty = difficulty || 'medium';
        this.gameOver = false;
        this.winner = null;
        this.moveCount = 0;
        this.selectedPiece = null;
        this.validMoves = [];
        this.isAIThinking = false;
    }

    handleClick(row, col) {
        if (this.gameOver || this.isAIThinking) return null;

        // Block clicks when not player's turn
        if (this.gameMode === 'pva' && this.currentSide !== this.playerSide) return null;
        if (this.gameMode === 'online' && this.currentSide !== this.localSide) return null;

        const clickedPiece = this.board.getPiece(row, col);

        if (!this.selectedPiece) {
            if (clickedPiece && clickedPiece.side === this.currentSide) {
                return this.selectPiece(row, col);
            }
            return null;
        }

        if (clickedPiece && clickedPiece.side === this.currentSide) {
            return this.selectPiece(row, col);
        }

        return this.tryMove(this.selectedPiece.row, this.selectedPiece.col, row, col);
    }

    selectPiece(row, col) {
        this.selectedPiece = { row, col };
        const allMoves = generateAllLegalMoves(this.board, this.currentSide);
        this.validMoves = allMoves
            .filter(m => m.fromRow === row && m.fromCol === col)
            .map(m => ({ toRow: m.toRow, toCol: m.toCol }));
        return { action: 'select', row, col, validMoves: this.validMoves };
    }

    tryMove(fromRow, fromCol, toRow, toCol) {
        const isValid = this.validMoves.some(m => m.toRow === toRow && m.toCol === toCol);
        if (!isValid) {
            this.selectedPiece = null;
            this.validMoves = [];
            return { action: 'deselect' };
        }

        // Online mode: send move to server, don't execute locally yet
        if (this.gameMode === 'online') {
            this.selectedPiece = null;
            this.validMoves = [];
            if (this.onSendMove) {
                this.onSendMove(fromRow, fromCol, toRow, toCol);
            }
            return { action: 'pending' };
        }

        return this.executeMove(fromRow, fromCol, toRow, toCol);
    }

    // Called locally or when server confirms a move
    executeMove(fromRow, fromCol, toRow, toCol) {
        const piece = this.board.getPiece(fromRow, fromCol);
        const captured = this.board.movePiece(fromRow, fromCol, toRow, toCol);

        const moveRecord = {
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

        const inCheck = isInCheck(this.board, this.currentSide);
        const gameState = checkGameOver(this.board, this.currentSide);

        if (gameState.over) {
            this.gameOver = true;
            this.winner = gameState.winner;
        }

        return {
            action: 'move',
            move: moveRecord,
            prevSide,
            inCheck,
            gameOver: this.gameOver,
            winner: this.winner,
            reason: gameState.reason,
            notation: this.getMoveNotation(moveRecord)
        };
    }

    // Apply a move confirmed by the server (for online mode)
    applyServerMove(fromRow, fromCol, toRow, toCol) {
        return this.executeMove(fromRow, fromCol, toRow, toCol);
    }

    // Restore full board state from server (for reconnect/spectator)
    restoreState(gridData, currentSide, moveCount) {
        this.board.fromJSON(gridData);
        this.currentSide = currentSide;
        this.moveCount = moveCount;
        this.gameOver = false;
        this.winner = null;
        this.selectedPiece = null;
        this.validMoves = [];
    }

    undo() {
        if (this.moveHistory.length === 0 || this.isAIThinking) return false;
        if (this.gameMode === 'online') return false; // No undo in online

        const undoCount = (this.gameMode === 'pva' && this.moveHistory.length >= 2) ? 2 : 1;
        for (let i = 0; i < undoCount && this.moveHistory.length > 0; i++) {
            const move = this.moveHistory.pop();
            this.board.undoMove(move);
            this.currentSide = this.currentSide === RED ? BLACK : RED;
            this.moveCount--;
        }

        this.gameOver = false;
        this.winner = null;
        this.selectedPiece = null;
        this.validMoves = [];
        return true;
    }

    isAITurn() {
        return this.gameMode === 'pva' &&
               this.currentSide !== this.playerSide &&
               !this.gameOver;
    }

    getMoveNotation(moveRecord) {
        const { piece, fromRow, fromCol, toRow, toCol, captured } = moveRecord;
        const charName = PIECE_CHARS[piece.side][piece.type];
        const fromStr = `(${fromCol},${fromRow})`;
        const toStr = `(${toCol},${toRow})`;
        const captureStr = captured ? '吃' : '→';
        return `${charName}${fromStr}${captureStr}${toStr}`;
    }
}
