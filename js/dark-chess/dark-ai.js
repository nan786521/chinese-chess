import { generateDarkChessMoves } from '../../shared/dark-chess/dark-moves.js';
import { checkDarkChessGameOver } from '../../shared/dark-chess/dark-rules.js';
import { DC_PIECE_VALUES, DC_RANKS, RED, BLACK } from '../../shared/constants.js';

const DC_AI_CONFIG = {
    beginner: { depth: 1, randomness: 80 },
    easy:     { depth: 2, randomness: 30 },
    medium:   { depth: 3, randomness: 0 },
    hard:     { depth: 4, randomness: 0 },
};

export class DarkChessAI {
    constructor() {
        this.difficulty = 'medium';
    }

    setDifficulty(level) {
        this.difficulty = level;
    }

    findBestAction(board, side, movesSinceCapture) {
        const actions = generateDarkChessMoves(board, side);
        if (actions.length === 0) return null;

        if (this.difficulty === 'beginner') {
            return this.randomAction(actions);
        }

        const config = DC_AI_CONFIG[this.difficulty] || DC_AI_CONFIG.medium;
        return this.searchAction(board, actions, side, movesSinceCapture, config);
    }

    randomAction(actions) {
        return actions[Math.floor(Math.random() * actions.length)];
    }

    searchAction(board, actions, side, movesSinceCapture, config) {
        let bestScore = -Infinity;
        let bestAction = actions[0];
        const oppSide = side === RED ? BLACK : RED;

        // Order: captures first (by value), then moves, then flips
        this.orderActions(board, actions);

        for (const action of actions) {
            let score;

            if (action.action === 'flip') {
                score = this.evaluateFlip(board, action, side);
            } else {
                const captured = board.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol);
                const newMSC = captured ? 0 : movesSinceCapture + 1;

                const gameState = checkDarkChessGameOver(board, oppSide, newMSC);
                if (gameState.over && gameState.winner === side) {
                    score = 50000;
                } else if (gameState.over && gameState.winner === oppSide) {
                    score = -50000;
                } else if (gameState.over) {
                    score = 0;
                } else {
                    score = -this.negamax(board, config.depth - 1, -Infinity, Infinity, oppSide, newMSC);
                }

                board.undoMove({ fromRow: action.fromRow, fromCol: action.fromCol, toRow: action.toRow, toCol: action.toCol, captured });
            }

            // Add randomness for lower difficulties
            if (config.randomness > 0) {
                score += Math.floor(Math.random() * config.randomness * 2) - config.randomness;
            }

            if (score > bestScore) {
                bestScore = score;
                bestAction = action;
            }
        }

        return bestAction;
    }

    negamax(board, depth, alpha, beta, side, movesSinceCapture) {
        const oppSide = side === RED ? BLACK : RED;
        const gameState = checkDarkChessGameOver(board, side, movesSinceCapture);
        if (gameState.over) {
            if (gameState.winner === side) return 50000 + depth;
            if (gameState.winner === oppSide) return -50000 - depth;
            return 0;
        }

        if (depth <= 0) {
            return this.evaluate(board, side);
        }

        const actions = generateDarkChessMoves(board, side);
        this.orderActions(board, actions);

        let best = -Infinity;

        for (const action of actions) {
            let score;

            if (action.action === 'flip') {
                // Estimate flip value without modifying board
                score = this.evaluateFlip(board, action, side) * 0.5;
            } else {
                const captured = board.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol);
                const newMSC = captured ? 0 : movesSinceCapture + 1;
                score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, newMSC);
                board.undoMove({ fromRow: action.fromRow, fromCol: action.fromCol, toRow: action.toRow, toCol: action.toCol, captured });
            }

            if (score > best) best = score;
            if (score > alpha) alpha = score;
            if (alpha >= beta) break;
        }

        return best === -Infinity ? this.evaluate(board, side) : best;
    }

    evaluate(board, side) {
        const oppSide = side === RED ? BLACK : RED;
        let score = 0;

        // Material count (revealed pieces)
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.getPiece(r, c);
                if (!p || !p.revealed) continue;
                const val = DC_PIECE_VALUES[p.type] || 100;
                if (p.side === side) {
                    score += val;
                } else {
                    score -= val;
                }
            }
        }

        // Mobility bonus
        const myMoves = generateDarkChessMoves(board, side);
        const oppMoves = generateDarkChessMoves(board, oppSide);
        const myNonFlip = myMoves.filter(a => a.action !== 'flip').length;
        const oppNonFlip = oppMoves.filter(a => a.action !== 'flip').length;
        score += (myNonFlip - oppNonFlip) * 8;

        // Capture threat: bonus if we can capture something
        for (const m of myMoves) {
            if (m.action === 'capture') {
                const target = board.getPiece(m.toRow, m.toCol);
                if (target) score += (DC_PIECE_VALUES[target.type] || 100) * 0.1;
            }
        }

        // Safety: penalty if opponent can capture our pieces
        for (const m of oppMoves) {
            if (m.action === 'capture') {
                const target = board.getPiece(m.toRow, m.toCol);
                if (target) score -= (DC_PIECE_VALUES[target.type] || 100) * 0.15;
            }
        }

        return score;
    }

    evaluateFlip(board, action, side) {
        const remaining = this.getRemainingHidden(board);
        const totalHidden = remaining.red + remaining.black;
        if (totalHidden === 0) return -100;

        const oppSide = side === RED ? BLACK : RED;
        const friendlyChance = remaining[side] / totalHidden;
        const enemyChance = remaining[oppSide] / totalHidden;

        let score = 15;

        // Prefer flipping when we have fewer revealed pieces
        const myRevealed = board.countRevealedPieces(side);
        const oppRevealed = board.countRevealedPieces(oppSide);
        if (myRevealed < oppRevealed) score += 15;

        // Prefer flipping when friendly chance is higher
        score += (friendlyChance - enemyChance) * 30;

        // Check adjacent threats: avoid flipping next to enemy pieces
        const { row, col } = action;
        const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        let adjacentEnemies = 0;
        for (const [dr, dc] of deltas) {
            const nr = row + dr, nc = col + dc;
            if (board.isInBoard(nr, nc)) {
                const adj = board.getPiece(nr, nc);
                if (adj && adj.revealed && adj.side === oppSide) {
                    adjacentEnemies++;
                }
            }
        }
        score -= adjacentEnemies * 10;

        return score;
    }

    orderActions(board, actions) {
        actions.sort((a, b) => {
            // Captures first (by victim value descending)
            if (a.action === 'capture' && b.action !== 'capture') return -1;
            if (a.action !== 'capture' && b.action === 'capture') return 1;
            if (a.action === 'capture' && b.action === 'capture') {
                const va = DC_PIECE_VALUES[board.getPiece(a.toRow, a.toCol)?.type] || 0;
                const vb = DC_PIECE_VALUES[board.getPiece(b.toRow, b.toCol)?.type] || 0;
                return vb - va;
            }
            // Moves before flips
            if (a.action === 'move' && b.action === 'flip') return -1;
            if (a.action === 'flip' && b.action === 'move') return 1;
            return 0;
        });
    }

    getRemainingHidden(board) {
        let red = 0, black = 0;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.getPiece(r, c);
                if (p && !p.revealed) {
                    if (p.side === RED) red++;
                    else black++;
                }
            }
        }
        return { red, black };
    }
}
