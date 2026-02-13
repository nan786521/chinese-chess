import { v4 as uuidv4 } from 'uuid';
import { BoardLogic } from '../shared/board-logic.js';
import { generateAllLegalMoves } from '../shared/moves.js';
import { isInCheck, checkGameOver } from '../shared/rules.js';
import { PIECE_CHARS } from '../shared/constants.js';
import { RECONNECT_TIMEOUT } from './config.js';

export class GameManager {
    constructor() {
        this.games = new Map(); // gameId -> GameState
        this.disconnectTimers = new Map(); // gameId:userId -> timerId
    }

    createGame(roomCode, redPlayer, blackPlayer) {
        const board = new BoardLogic();
        board.setupInitialPosition();

        const game = {
            id: uuidv4(),
            roomCode,
            redPlayer: { userId: redPlayer.userId, username: redPlayer.username },
            blackPlayer: { userId: blackPlayer.userId, username: blackPlayer.username },
            board,
            currentSide: 'red',
            moveHistory: [],
            moveCount: 0,
            status: 'active',
            winner: null,
            reason: null,
            startedAt: new Date().toISOString()
        };

        this.games.set(game.id, game);
        return game;
    }

    getGame(gameId) {
        return this.games.get(gameId);
    }

    getGameByUser(userId) {
        for (const game of this.games.values()) {
            if (game.status === 'active' &&
                (game.redPlayer.userId === userId || game.blackPlayer.userId === userId)) {
                return game;
            }
        }
        return null;
    }

    processMove(gameId, userId, fromRow, fromCol, toRow, toCol) {
        const game = this.games.get(gameId);
        if (!game) return { error: '遊戲不存在' };
        if (game.status !== 'active') return { error: '遊戲已結束' };

        // Verify it's this player's turn
        const playerSide = game.redPlayer.userId === userId ? 'red' : 'black';
        if (playerSide !== game.currentSide) {
            return { error: '還沒有輪到你' };
        }

        // Validate move using shared logic
        const legalMoves = generateAllLegalMoves(game.board, game.currentSide);
        const isLegal = legalMoves.some(m =>
            m.fromRow === fromRow && m.fromCol === fromCol &&
            m.toRow === toRow && m.toCol === toCol
        );

        if (!isLegal) {
            return { error: '不合法的走步' };
        }

        // Execute move
        const piece = game.board.getPiece(fromRow, fromCol);
        const captured = game.board.movePiece(fromRow, fromCol, toRow, toCol);

        const moveRecord = { fromRow, fromCol, toRow, toCol };
        game.moveHistory.push(moveRecord);
        game.moveCount++;

        const prevSide = game.currentSide;
        game.currentSide = game.currentSide === 'red' ? 'black' : 'red';

        const inCheck = isInCheck(game.board, game.currentSide);
        const gameState = checkGameOver(game.board, game.currentSide);

        if (gameState.over) {
            game.status = 'finished';
            game.winner = gameState.winner;
            game.reason = gameState.reason;
        }

        // Build notation
        const charName = PIECE_CHARS[prevSide][piece.type];
        const captureStr = captured ? '吃' : '→';
        const notation = `${charName}(${fromCol},${fromRow})${captureStr}(${toCol},${toRow})`;

        return {
            success: true,
            fromRow, fromCol, toRow, toCol,
            currentSide: game.currentSide,
            inCheck,
            gameOver: gameState.over,
            winner: game.winner,
            reason: game.reason,
            notation,
            moveCount: game.moveCount
        };
    }

    handleResign(gameId, userId) {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'active') return null;

        const resignSide = game.redPlayer.userId === userId ? 'red' : 'black';
        game.status = 'finished';
        game.winner = resignSide === 'red' ? 'black' : 'red';
        game.reason = 'resign';

        return { winner: game.winner, reason: game.reason };
    }

    handleDraw(gameId) {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'active') return null;

        game.status = 'finished';
        game.winner = null;
        game.reason = 'draw';

        return { winner: null, reason: 'draw' };
    }

    handleDisconnect(gameId, userId) {
        const game = this.games.get(gameId);
        if (!game || game.status !== 'active') return;

        const key = `${gameId}:${userId}`;

        // Start timeout
        const timerId = setTimeout(() => {
            this.handleTimeout(gameId, userId);
        }, RECONNECT_TIMEOUT);

        this.disconnectTimers.set(key, timerId);
        return RECONNECT_TIMEOUT;
    }

    handleReconnect(gameId, userId) {
        const key = `${gameId}:${userId}`;
        const timerId = this.disconnectTimers.get(key);
        if (timerId) {
            clearTimeout(timerId);
            this.disconnectTimers.delete(key);
        }
        return this.games.get(gameId);
    }

    handleTimeout(gameId, userId) {
        const key = `${gameId}:${userId}`;
        this.disconnectTimers.delete(key);

        const game = this.games.get(gameId);
        if (!game || game.status !== 'active') return null;

        const disconnectedSide = game.redPlayer.userId === userId ? 'red' : 'black';
        game.status = 'finished';
        game.winner = disconnectedSide === 'red' ? 'black' : 'red';
        game.reason = 'disconnect';

        return { winner: game.winner, reason: game.reason, gameId };
    }

    getGameState(gameId) {
        const game = this.games.get(gameId);
        if (!game) return null;

        return {
            board: game.board.toJSON(),
            currentSide: game.currentSide,
            moveCount: game.moveCount,
            redPlayer: game.redPlayer.username,
            blackPlayer: game.blackPlayer.username,
            status: game.status
        };
    }

    cleanupGame(gameId) {
        // Keep for a while for history, then remove from memory
        setTimeout(() => {
            this.games.delete(gameId);
        }, 300000); // 5 minutes
    }
}
