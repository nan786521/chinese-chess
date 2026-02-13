import { generateDarkChessMoves } from '../../shared/dark-chess/dark-moves.js';
import { checkDarkChessGameOver } from '../../shared/dark-chess/dark-rules.js';
import { DC_PIECE_VALUES, DC_RANKS, RED, BLACK } from '../../shared/constants.js';

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

        switch (this.difficulty) {
            case 'beginner': return this.randomAction(actions);
            case 'easy': return this.greedyAction(board, actions, side);
            case 'medium': return this.evaluatedAction(board, actions, side, movesSinceCapture);
            case 'hard':
            case 'master': return this.searchAction(board, actions, side, movesSinceCapture);
            default: return this.evaluatedAction(board, actions, side, movesSinceCapture);
        }
    }

    randomAction(actions) {
        return actions[Math.floor(Math.random() * actions.length)];
    }

    greedyAction(board, actions, side) {
        let bestScore = -Infinity;
        let bestActions = [];

        for (const action of actions) {
            let score = 0;

            if (action.action === 'capture') {
                const target = board.getPiece(action.toRow, action.toCol);
                if (target) {
                    score = DC_PIECE_VALUES[target.type] || 100;
                    // Bonus if capturing with a lower-value piece
                    const attacker = board.getPiece(action.fromRow, action.fromCol);
                    if (attacker) {
                        const risk = DC_PIECE_VALUES[attacker.type] || 100;
                        score += (500 - risk) * 0.1;
                    }
                }
            } else if (action.action === 'flip') {
                score = 10 + Math.random() * 5;
            } else {
                score = 5 + Math.random() * 5;
            }

            // Add randomness
            score += Math.random() * 30;

            if (score > bestScore) {
                bestScore = score;
                bestActions = [action];
            } else if (score === bestScore) {
                bestActions.push(action);
            }
        }

        return bestActions[Math.floor(Math.random() * bestActions.length)];
    }

    evaluatedAction(board, actions, side, movesSinceCapture) {
        let bestScore = -Infinity;
        let bestAction = actions[0];

        for (const action of actions) {
            const score = this.evaluateAction(board, action, side, movesSinceCapture);
            if (score > bestScore) {
                bestScore = score;
                bestAction = action;
            }
        }

        return bestAction;
    }

    evaluateAction(board, action, side, movesSinceCapture) {
        if (action.action === 'flip') {
            return this.evaluateFlip(board, action, side);
        }

        // Simulate the move
        const clone = board.clone();
        const captured = clone.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol);
        const newMSC = captured ? 0 : movesSinceCapture + 1;

        const oppSide = side === RED ? BLACK : RED;

        // Check if this move wins
        const gameState = checkDarkChessGameOver(clone, oppSide, newMSC);
        if (gameState.over && gameState.winner === side) return 10000;
        if (gameState.over && gameState.winner === oppSide) return -10000;

        let score = this.evaluate(clone, side);

        // Capture bonus
        if (captured) {
            score += DC_PIECE_VALUES[captured.type] * 2;
        }

        // Check if our piece is now in danger
        const oppMoves = generateDarkChessMoves(clone, oppSide);
        for (const om of oppMoves) {
            if (om.action === 'capture' && om.toRow === action.toRow && om.toCol === action.toCol) {
                const attacker = board.getPiece(action.fromRow, action.fromCol);
                if (attacker) {
                    score -= DC_PIECE_VALUES[attacker.type] * 1.5;
                }
                break;
            }
        }

        return score + Math.random() * 5;
    }

    evaluateFlip(board, action, side) {
        // Estimate expected value of flipping
        // Count remaining unrevealed pieces to guess what we might get
        const remaining = this.getRemainingHidden(board);
        const totalHidden = remaining.red + remaining.black;
        if (totalHidden === 0) return -100;

        const oppSide = side === RED ? BLACK : RED;
        const friendlyChance = remaining[side] / totalHidden;
        const enemyChance = remaining[oppSide] / totalHidden;

        // Flipping is somewhat neutral: could help or hurt
        let score = 15; // base value for information

        // Slightly prefer flipping when we have fewer revealed pieces
        const myRevealed = board.countRevealedPieces(side);
        const oppRevealed = board.countRevealedPieces(oppSide);
        if (myRevealed < oppRevealed) {
            score += 10;
        }

        // Prefer flipping when friendly chance is higher
        score += (friendlyChance - enemyChance) * 20;

        // Check if nearby own pieces could be threatened by a reveal
        // (simplified: just add randomness)
        score += Math.random() * 10;

        return score;
    }

    searchAction(board, actions, side, movesSinceCapture) {
        const depth = this.difficulty === 'master' ? 3 : 2;
        let bestScore = -Infinity;
        let bestAction = actions[0];

        for (const action of actions) {
            let score;
            if (action.action === 'flip') {
                score = this.evaluateFlip(board, action, side);
            } else {
                const clone = board.clone();
                const captured = clone.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol);
                const newMSC = captured ? 0 : movesSinceCapture + 1;
                const oppSide = side === RED ? BLACK : RED;

                score = -this.negamax(clone, depth - 1, -Infinity, Infinity, oppSide, newMSC);

                if (captured) {
                    score += DC_PIECE_VALUES[captured.type];
                }
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
            if (gameState.winner === side) return 10000 + depth;
            if (gameState.winner === oppSide) return -10000 - depth;
            return 0; // draw
        }

        if (depth <= 0) {
            return this.evaluate(board, side);
        }

        const actions = generateDarkChessMoves(board, side);
        let best = -Infinity;

        for (const action of actions) {
            let score;
            if (action.action === 'flip') {
                // For search, estimate flip value without actually flipping
                score = 0;
                continue;
            }

            const clone = board.clone();
            const captured = clone.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol);
            const newMSC = captured ? 0 : movesSinceCapture + 1;
            score = -this.negamax(clone, depth - 1, -beta, -alpha, oppSide, newMSC);

            if (captured) {
                score += DC_PIECE_VALUES[captured.type] * 0.1;
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

        // Material count (only revealed pieces)
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
        const myMoves = generateDarkChessMoves(board, side)
            .filter(a => a.action !== 'flip');
        const oppMoves = generateDarkChessMoves(board, oppSide)
            .filter(a => a.action !== 'flip');
        score += (myMoves.length - oppMoves.length) * 5;

        return score;
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
