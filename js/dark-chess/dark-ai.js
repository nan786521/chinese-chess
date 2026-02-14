import { generateDarkChessMoves } from '../../shared/dark-chess/dark-moves.js';
import { checkDarkChessGameOver } from '../../shared/dark-chess/dark-rules.js';
import { DC_PIECE_VALUES, DC_AI_CONFIG, RED, BLACK } from '../../shared/constants.js';

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
            return actions[Math.floor(Math.random() * actions.length)];
        }

        const config = DC_AI_CONFIG[this.difficulty] || DC_AI_CONFIG.medium;
        return this.searchAction(board, actions, side, movesSinceCapture, config);
    }

    searchAction(board, actions, side, movesSinceCapture, config) {
        let bestScore = -Infinity;
        let bestAction = actions[0];
        const oppSide = side === RED ? BLACK : RED;

        this.orderActions(board, actions, side);

        for (const action of actions) {
            let score;

            if (action.action === 'flip') {
                score = config.monteCarloSims > 0
                    ? this.evaluateFlipMC(board, action, side, config.monteCarloSims)
                    : this.evaluateFlip(board, action, side);
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
                    // Fixed: pass -bestScore as beta for proper alpha-beta pruning
                    score = -this.negamax(board, config.depth - 1, -Infinity, -bestScore, oppSide, newMSC);
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
        this.orderActions(board, actions, side);

        let best = -Infinity;

        for (const action of actions) {
            let score;

            if (action.action === 'flip') {
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

    // --- Evaluation ---

    evaluate(board, side) {
        const oppSide = side === RED ? BLACK : RED;
        let score = 0;
        let myMaterial = 0, oppMaterial = 0;
        let myPieceCount = 0, oppPieceCount = 0;

        // Material count (revealed pieces only)
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.getPiece(r, c);
                if (!p || !p.revealed) continue;
                const val = DC_PIECE_VALUES[p.type] || 100;
                if (p.side === side) {
                    score += val;
                    myMaterial += val;
                    myPieceCount++;
                } else {
                    score -= val;
                    oppMaterial += val;
                    oppPieceCount++;
                }
            }
        }

        // Mobility
        const myMoves = generateDarkChessMoves(board, side);
        const oppMoves = generateDarkChessMoves(board, oppSide);
        const myNonFlip = myMoves.filter(a => a.action !== 'flip').length;
        const oppNonFlip = oppMoves.filter(a => a.action !== 'flip').length;
        score += (myNonFlip - oppNonFlip) * 8;

        // Capture threats: bonus for winning exchanges
        for (const m of myMoves) {
            if (m.action === 'capture') {
                const target = board.getPiece(m.toRow, m.toCol);
                const attacker = board.getPiece(m.fromRow, m.fromCol);
                if (target && attacker) {
                    const net = (DC_PIECE_VALUES[target.type] || 100) - (DC_PIECE_VALUES[attacker.type] || 100);
                    score += Math.max(0, net) * 0.15 + (DC_PIECE_VALUES[target.type] || 100) * 0.05;
                }
            }
        }

        // Piece safety: penalty for pieces that can be captured
        // Pre-compute which of our pieces have escape moves
        const myMoveFromKeys = new Set();
        for (const m of myMoves) {
            if (m.action !== 'flip') {
                myMoveFromKeys.add(`${m.fromRow},${m.fromCol}`);
            }
        }

        for (const m of oppMoves) {
            if (m.action === 'capture') {
                const target = board.getPiece(m.toRow, m.toCol);
                if (target && target.side === side) {
                    const val = DC_PIECE_VALUES[target.type] || 100;
                    const canEscape = myMoveFromKeys.has(`${m.toRow},${m.toCol}`);
                    score -= canEscape ? val * 0.1 : val * 0.3;
                }
            }
        }

        // Center control bonus
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.getPiece(r, c);
                if (!p || !p.revealed) continue;
                if (r >= 1 && r <= 2 && c >= 2 && c <= 5) {
                    score += p.side === side ? 5 : -5;
                }
            }
        }

        // Endgame: amplify material advantage
        const totalPieces = myPieceCount + oppPieceCount;
        if (totalPieces <= 6) {
            score += (myMaterial - oppMaterial) * 0.2;
        }

        // Hidden piece count advantage
        const hidden = this.getRemainingHidden(board);
        score += (hidden[side] - hidden[oppSide]) * 15;

        return score;
    }

    // --- Flip Evaluation ---

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

        // Adjacent threat penalty
        const { row, col } = action;
        const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of deltas) {
            const nr = row + dr, nc = col + dc;
            if (board.isInBoard(nr, nc)) {
                const adj = board.getPiece(nr, nc);
                if (adj && adj.revealed && adj.side === oppSide) {
                    score -= 10;
                }
            }
        }

        return score;
    }

    evaluateFlipMC(board, action, side, numSims) {
        const { row, col } = action;
        const piece = board.getPiece(row, col);
        if (!piece) return -100;

        // Collect hidden piece pool (all unrevealed piece identities)
        const pool = [];
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.getPiece(r, c);
                if (p && !p.revealed) {
                    pool.push({ type: p.type, side: p.side });
                }
            }
        }
        if (pool.length === 0) return -100;

        let totalScore = 0;

        for (let sim = 0; sim < numSims; sim++) {
            // Pick random identity from pool
            const assigned = pool[Math.floor(Math.random() * pool.length)];

            // Temporarily reveal with this assignment
            const origType = piece.type;
            const origSide = piece.side;
            piece.type = assigned.type;
            piece.side = assigned.side;
            piece.revealed = true;

            totalScore += this.evaluate(board, side);

            // Restore
            piece.type = origType;
            piece.side = origSide;
            piece.revealed = false;
        }

        return totalScore / numSims;
    }

    // --- Move Ordering ---

    orderActions(board, actions, side) {
        const oppSide = side === RED ? BLACK : RED;

        // Pre-compute threatened positions
        let threatened = null;
        const needsThreatInfo = actions.some(a => a.action === 'move');
        if (needsThreatInfo) {
            threatened = new Set();
            const oppMoves = generateDarkChessMoves(board, oppSide);
            for (const m of oppMoves) {
                if (m.action === 'capture') {
                    threatened.add(`${m.toRow},${m.toCol}`);
                }
            }
        }

        actions.sort((a, b) => {
            return this.actionScore(board, b, side, threatened) -
                   this.actionScore(board, a, side, threatened);
        });
    }

    actionScore(board, action, side, threatened) {
        if (action.action === 'capture') {
            const victim = board.getPiece(action.toRow, action.toCol);
            const attacker = board.getPiece(action.fromRow, action.fromCol);
            const net = (DC_PIECE_VALUES[victim?.type] || 0) - (DC_PIECE_VALUES[attacker?.type] || 0);
            return 10000 + net;
        }
        if (action.action === 'move') {
            // Escape bonus: moving a threatened piece to safety
            if (threatened) {
                const fromKey = `${action.fromRow},${action.fromCol}`;
                const toKey = `${action.toRow},${action.toCol}`;
                if (threatened.has(fromKey) && !threatened.has(toKey)) {
                    const piece = board.getPiece(action.fromRow, action.fromCol);
                    return 5000 + (DC_PIECE_VALUES[piece?.type] || 0);
                }
            }
            return 1000;
        }
        if (action.action === 'flip') {
            // Safe flips first (fewer adjacent enemies)
            const { row, col } = action;
            const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            let adjEnemies = 0;
            for (const [dr, dc] of deltas) {
                const nr = row + dr, nc = col + dc;
                if (board.isInBoard(nr, nc)) {
                    const adj = board.getPiece(nr, nc);
                    if (adj && adj.revealed && adj.side !== side) adjEnemies++;
                }
            }
            return 500 - adjEnemies * 100;
        }
        return 0;
    }

    // --- Helpers ---

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
