import { generateDarkChessMoves } from '../../shared/dark-chess/dark-moves.js';
import { canCapture } from '../../shared/dark-chess/dark-moves.js';
import { checkDarkChessGameOver } from '../../shared/dark-chess/dark-rules.js';
import { DC_PIECE_VALUES, DC_AI_CONFIG, RED, BLACK } from '../../shared/constants.js';

const DELTAS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export class DarkChessAI {
    constructor() {
        this.difficulty = 'medium';
        this.killerMoves = [];
        this.history = new Int32Array(2 * 1024);
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

        // Reset search state
        this.killerMoves = new Array(config.depth + 6).fill(null);
        this.history = new Int32Array(2 * 1024);

        return this.searchAction(board, actions, side, movesSinceCapture, config);
    }

    searchAction(board, actions, side, movesSinceCapture, config) {
        let bestScore = -Infinity;
        let bestAction = actions[0];
        const oppSide = side === RED ? BLACK : RED;

        const oppMoves = generateDarkChessMoves(board, oppSide);
        this._orderActions(board, actions, side, oppMoves, 0);

        for (const action of actions) {
            let score;

            if (action.action === 'flip') {
                score = config.monteCarloSims > 0
                    ? this.evaluateFlipMC(board, action, side, config.monteCarloSims)
                    : this.evaluateFlipExpectimax(board, action, side, config.depth - 1);
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
                    score = -this.negamax(board, config.depth - 1, -Infinity, -bestScore, oppSide, newMSC, 1);
                }

                board.undoMove({ fromRow: action.fromRow, fromCol: action.fromCol, toRow: action.toRow, toCol: action.toCol, captured });
            }

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

    negamax(board, depth, alpha, beta, side, movesSinceCapture, ply) {
        const oppSide = side === RED ? BLACK : RED;
        const gameState = checkDarkChessGameOver(board, side, movesSinceCapture);
        if (gameState.over) {
            if (gameState.winner === side) return 50000 + depth;
            if (gameState.winner === oppSide) return -50000 - depth;
            return 0;
        }

        if (depth <= 0) {
            return this.quiesce(board, alpha, beta, side, 3);
        }

        const actions = generateDarkChessMoves(board, side);
        const oppMoves = generateDarkChessMoves(board, oppSide);
        this._orderActions(board, actions, side, oppMoves, ply);

        let best = -Infinity;
        let movesSearched = 0;

        for (const action of actions) {
            let score;

            if (action.action === 'flip') {
                // Expectimax: average over possible hidden identities
                score = this.evaluateFlipExpectimax(board, action, side, depth - 1);
            } else {
                const captured = board.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol);
                const newMSC = captured ? 0 : movesSinceCapture + 1;
                score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, newMSC, ply + 1);
                board.undoMove({ fromRow: action.fromRow, fromCol: action.fromCol, toRow: action.toRow, toCol: action.toCol, captured });

                // Store killer/history on beta cutoff
                if (score >= beta && !captured) {
                    this._storeKiller(ply, action);
                    this._storeHistory(side, action, depth);
                }
            }

            if (score > best) best = score;
            if (score > alpha) alpha = score;
            if (alpha >= beta) break;
            movesSearched++;
        }

        return best === -Infinity ? this.evaluate(board, side) : best;
    }

    // --- Quiescence Search ---

    quiesce(board, alpha, beta, side, maxDepth) {
        const standPat = this.evaluate(board, side);
        if (maxDepth <= 0) return standPat;
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        const oppSide = side === RED ? BLACK : RED;

        // Generate only capture actions
        const allActions = generateDarkChessMoves(board, side);
        const captures = [];
        for (const a of allActions) {
            if (a.action !== 'capture') continue;
            const victim = board.getPiece(a.toRow, a.toCol);
            if (!victim) continue;
            const victimVal = DC_PIECE_VALUES[victim.type] || 100;
            // Delta pruning
            if (standPat + victimVal + 100 < alpha) continue;
            captures.push(a);
        }

        if (captures.length === 0) return alpha;

        // Sort captures by MVV-LVA
        captures.sort((a, b) => {
            const va = board.getPiece(a.toRow, a.toCol);
            const vb = board.getPiece(b.toRow, b.toCol);
            const aa = board.getPiece(a.fromRow, a.fromCol);
            const ab = board.getPiece(b.fromRow, b.fromCol);
            return ((DC_PIECE_VALUES[vb?.type] || 0) - (DC_PIECE_VALUES[ab?.type] || 0)) -
                   ((DC_PIECE_VALUES[va?.type] || 0) - (DC_PIECE_VALUES[aa?.type] || 0));
        });

        for (const action of captures) {
            const captured = board.movePiece(action.fromRow, action.fromCol, action.toRow, action.toCol);
            const score = -this.quiesce(board, -beta, -alpha, oppSide, maxDepth - 1);
            board.undoMove({ fromRow: action.fromRow, fromCol: action.fromCol, toRow: action.toRow, toCol: action.toCol, captured });

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
    }

    // --- Evaluation ---

    evaluate(board, side, myMoves, oppMoves) {
        const oppSide = side === RED ? BLACK : RED;
        let score = 0;
        let myMaterial = 0, oppMaterial = 0;
        let myPieceCount = 0, oppPieceCount = 0;
        let hiddenMy = 0, hiddenOpp = 0;

        // Collect revealed piece info in single pass
        const myPieces = [];
        const oppPieces = [];

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.getPiece(r, c);
                if (!p) continue;
                if (!p.revealed) {
                    if (p.side === side) hiddenMy++; else hiddenOpp++;
                    continue;
                }
                const val = DC_PIECE_VALUES[p.type] || 100;
                const info = { type: p.type, side: p.side, row: r, col: c, val };
                if (p.side === side) {
                    myPieces.push(info);
                    myMaterial += val;
                    myPieceCount++;
                } else {
                    oppPieces.push(info);
                    oppMaterial += val;
                    oppPieceCount++;
                }
            }
        }

        // Material
        score += myMaterial - oppMaterial;

        // Center control
        for (const p of myPieces) {
            if (p.row >= 1 && p.row <= 2 && p.col >= 2 && p.col <= 5) score += 5;
        }
        for (const p of oppPieces) {
            if (p.row >= 1 && p.row <= 2 && p.col >= 2 && p.col <= 5) score -= 5;
        }

        // King-pawn awareness (critical in dark chess)
        for (const my of myPieces) {
            for (const opp of oppPieces) {
                const dist = Math.abs(my.row - opp.row) + Math.abs(my.col - opp.col);
                if (dist === 1) {
                    // My pawn adjacent to enemy king
                    if (my.type === 'pawn' && opp.type === 'king') score += 120;
                    // My king adjacent to enemy pawn (danger!)
                    if (my.type === 'king' && opp.type === 'pawn') score -= 120;
                    // General: can I capture them? (winning exchange)
                    if (my.type !== 'cannon' && canCapture(my, opp)) {
                        const net = opp.val - my.val;
                        if (net > 0) score += net * 0.2;
                    }
                }
            }
        }

        // Piece adjacency protection
        for (const p of myPieces) {
            let hasProtector = false;
            for (const [dr, dc] of DELTAS) {
                const nr = p.row + dr, nc = p.col + dc;
                const adj = board.getPiece(nr, nc);
                if (adj && adj.revealed && adj.side === side) {
                    hasProtector = true;
                    break;
                }
            }
            if (hasProtector) {
                score += 12;
            } else if (p.val >= 300) {
                score -= 15; // Isolated high-value piece
            }
        }
        for (const p of oppPieces) {
            let hasProtector = false;
            for (const [dr, dc] of DELTAS) {
                const nr = p.row + dr, nc = p.col + dc;
                const adj = board.getPiece(nr, nc);
                if (adj && adj.revealed && adj.side === oppSide) {
                    hasProtector = true;
                    break;
                }
            }
            if (hasProtector) {
                score -= 12;
            } else if (p.val >= 300) {
                score += 15;
            }
        }

        // Cannon effectiveness
        for (const p of [...myPieces, ...oppPieces]) {
            if (p.type !== 'cannon') continue;
            let screens = 0;
            for (const [dr, dc] of DELTAS) {
                let r = p.row + dr, c = p.col + dc;
                let foundScreen = false;
                while (board.isInBoard(r, c)) {
                    if (board.getPiece(r, c)) {
                        if (!foundScreen) {
                            foundScreen = true;
                        } else {
                            screens++;
                            break;
                        }
                    }
                    r += dr;
                    c += dc;
                }
            }
            const bonus = screens > 0 ? Math.min(screens, 3) * 8 : -30;
            score += p.side === side ? bonus : -bonus;
        }

        // Edge/corner vulnerability
        for (const p of myPieces) {
            let edgePenalty = 0;
            if (p.row === 0 || p.row === 3) edgePenalty += 8;
            if (p.col === 0 || p.col === 7) edgePenalty += 8;
            score -= edgePenalty;
        }
        for (const p of oppPieces) {
            let edgePenalty = 0;
            if (p.row === 0 || p.row === 3) edgePenalty += 8;
            if (p.col === 0 || p.col === 7) edgePenalty += 8;
            score += edgePenalty;
        }

        // Mobility
        if (!myMoves) myMoves = generateDarkChessMoves(board, side);
        if (!oppMoves) oppMoves = generateDarkChessMoves(board, oppSide);

        let myNonFlip = 0, oppNonFlip = 0;
        for (const a of myMoves) { if (a.action !== 'flip') myNonFlip++; }
        for (const a of oppMoves) { if (a.action !== 'flip') oppNonFlip++; }
        score += (myNonFlip - oppNonFlip) * 8;

        // Capture threats / piece safety
        const myMoveFromKeys = new Set();
        for (const m of myMoves) {
            if (m.action !== 'flip') {
                myMoveFromKeys.add((m.fromRow << 3) | m.fromCol);
            }
            if (m.action === 'capture') {
                const target = board.getPiece(m.toRow, m.toCol);
                const attacker = board.getPiece(m.fromRow, m.fromCol);
                if (target && attacker) {
                    const net = (DC_PIECE_VALUES[target.type] || 100) - (DC_PIECE_VALUES[attacker.type] || 100);
                    score += Math.max(0, net) * 0.15 + (DC_PIECE_VALUES[target.type] || 100) * 0.05;
                }
            }
        }

        for (const m of oppMoves) {
            if (m.action === 'capture') {
                const target = board.getPiece(m.toRow, m.toCol);
                if (target && target.side === side) {
                    const val = DC_PIECE_VALUES[target.type] || 100;
                    const canEscape = myMoveFromKeys.has((m.toRow << 3) | m.toCol);
                    score -= canEscape ? val * 0.1 : val * 0.3;
                }
            }
        }

        // Trade encouragement when ahead
        const materialDiff = myMaterial - oppMaterial;
        if (materialDiff > 200) {
            score += materialDiff * 0.15;
        } else if (materialDiff < -200) {
            score -= (-materialDiff) * 0.05; // Discourage trading when behind
        }

        // Endgame amplification
        const totalPieces = myPieceCount + oppPieceCount;
        if (totalPieces <= 6) {
            score += materialDiff * 0.2;
        }

        // Hidden piece count advantage
        score += (hiddenMy - hiddenOpp) * 15;

        return score;
    }

    // Lightweight evaluation for Monte Carlo simulations
    evaluateFast(board, side) {
        let score = 0;
        let myMaterial = 0, oppMaterial = 0;
        let myPieceCount = 0, oppPieceCount = 0;

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.getPiece(r, c);
                if (!p || !p.revealed) continue;
                const val = DC_PIECE_VALUES[p.type] || 100;
                if (p.side === side) {
                    score += val;
                    myMaterial += val;
                    myPieceCount++;
                    // King-pawn quick check
                    for (const [dr, dc] of DELTAS) {
                        const adj = board.getPiece(r + dr, c + dc);
                        if (adj && adj.revealed && adj.side !== side) {
                            if (p.type === 'pawn' && adj.type === 'king') score += 100;
                            if (p.type === 'king' && adj.type === 'pawn') score -= 100;
                        }
                    }
                } else {
                    score -= val;
                    oppMaterial += val;
                    oppPieceCount++;
                }
            }
        }

        if (myPieceCount + oppPieceCount <= 6) {
            score += (myMaterial - oppMaterial) * 0.2;
        }

        return score;
    }

    // --- Flip Evaluation ---

    evaluateFlip(board, action, side) {
        const remaining = this._getRemainingHidden(board);
        const totalHidden = remaining.red + remaining.black;
        if (totalHidden === 0) return -100;

        const oppSide = side === RED ? BLACK : RED;
        const friendlyChance = remaining[side] / totalHidden;
        const enemyChance = remaining[oppSide] / totalHidden;

        let score = 15;

        const myRevealed = board.countRevealedPieces(side);
        const oppRevealed = board.countRevealedPieces(oppSide);
        if (myRevealed < oppRevealed) score += 15;

        score += (friendlyChance - enemyChance) * 30;

        const { row, col } = action;
        for (const [dr, dc] of DELTAS) {
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

    // Expectimax flip evaluation: sample possible identities and average
    evaluateFlipExpectimax(board, action, side, depth) {
        const { row, col } = action;
        const piece = board.getPiece(row, col);
        if (!piece) return -100;

        // Collect unique hidden identities with counts
        const pool = {};
        let totalHidden = 0;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 8; c++) {
                const p = board.getPiece(r, c);
                if (p && !p.revealed) {
                    const key = `${p.type}_${p.side}`;
                    pool[key] = (pool[key] || { type: p.type, side: p.side, count: 0 });
                    pool[key].count++;
                    totalHidden++;
                }
            }
        }
        if (totalHidden === 0) return -100;

        const origType = piece.type;
        const origSide = piece.side;
        let totalScore = 0;

        const entries = Object.values(pool);
        const oppSide = side === RED ? BLACK : RED;

        for (const entry of entries) {
            const weight = entry.count / totalHidden;

            // Temporarily reveal with this identity
            piece.type = entry.type;
            piece.side = entry.side;
            piece.revealed = true;

            let evalScore;
            if (depth <= 0) {
                evalScore = this.evaluateFast(board, side);
            } else {
                // 1-ply search: evaluate opponent's best response
                evalScore = this.evaluateFast(board, side);
                // Only do deeper search for significant identities
                if (weight >= 0.1 && depth >= 1) {
                    const oppActions = generateDarkChessMoves(board, oppSide);
                    let bestOppScore = -Infinity;
                    for (const opp of oppActions) {
                        if (opp.action === 'flip') continue;
                        const cap = board.movePiece(opp.fromRow, opp.fromCol, opp.toRow, opp.toCol);
                        const s = this.evaluateFast(board, oppSide);
                        board.undoMove({ fromRow: opp.fromRow, fromCol: opp.fromCol, toRow: opp.toRow, toCol: opp.toCol, captured: cap });
                        if (s > bestOppScore) bestOppScore = s;
                    }
                    if (bestOppScore > -Infinity) {
                        evalScore = -bestOppScore; // Opponent plays best
                    }
                }
            }

            totalScore += evalScore * weight;

            // Restore
            piece.type = origType;
            piece.side = origSide;
            piece.revealed = false;
        }

        return totalScore;
    }

    // Monte Carlo flip evaluation with 1-ply opponent response
    evaluateFlipMC(board, action, side, numSims) {
        const { row, col } = action;
        const piece = board.getPiece(row, col);
        if (!piece) return -100;

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

        const oppSide = side === RED ? BLACK : RED;
        let totalScore = 0;

        for (let sim = 0; sim < numSims; sim++) {
            const assigned = pool[Math.floor(Math.random() * pool.length)];

            const origType = piece.type;
            const origSide = piece.side;
            piece.type = assigned.type;
            piece.side = assigned.side;
            piece.revealed = true;

            // 1-ply: opponent's best response
            let evalScore = this.evaluateFast(board, side);
            const oppActions = generateDarkChessMoves(board, oppSide);
            let bestOppScore = -Infinity;
            for (const opp of oppActions) {
                if (opp.action === 'flip') continue;
                const cap = board.movePiece(opp.fromRow, opp.fromCol, opp.toRow, opp.toCol);
                const s = this.evaluateFast(board, oppSide);
                board.undoMove({ fromRow: opp.fromRow, fromCol: opp.fromCol, toRow: opp.toRow, toCol: opp.toCol, captured: cap });
                if (s > bestOppScore) bestOppScore = s;
            }
            if (bestOppScore > -Infinity) {
                evalScore = -bestOppScore;
            }

            totalScore += evalScore;

            piece.type = origType;
            piece.side = origSide;
            piece.revealed = false;
        }

        return totalScore / numSims;
    }

    // --- Move Ordering ---

    _orderActions(board, actions, side, oppMoves, ply) {
        // Build threatened set
        let threatened = null;
        if (oppMoves) {
            threatened = new Set();
            for (const m of oppMoves) {
                if (m.action === 'capture') {
                    threatened.add((m.toRow << 3) | m.toCol);
                }
            }
        }

        const sideIdx = side === RED ? 0 : 1;
        const killers = this.killerMoves[ply] || [null, null];

        // Pre-compute scores
        const scores = new Float64Array(actions.length);
        for (let i = 0; i < actions.length; i++) {
            scores[i] = this._actionScore(board, actions[i], side, sideIdx, threatened, killers);
        }

        // Index sort
        const indices = Array.from({ length: actions.length }, (_, i) => i);
        indices.sort((a, b) => scores[b] - scores[a]);
        const sorted = indices.map(i => actions[i]);
        for (let i = 0; i < actions.length; i++) actions[i] = sorted[i];
    }

    _actionScore(board, action, side, sideIdx, threatened, killers) {
        if (action.action === 'capture') {
            const victim = board.getPiece(action.toRow, action.toCol);
            const attacker = board.getPiece(action.fromRow, action.fromCol);
            return 10000 + (DC_PIECE_VALUES[victim?.type] || 0) - (DC_PIECE_VALUES[attacker?.type] || 0);
        }
        if (action.action === 'move') {
            // Killer moves
            if (killers[0] && action.fromRow === killers[0].fromRow && action.fromCol === killers[0].fromCol &&
                action.toRow === killers[0].toRow && action.toCol === killers[0].toCol) return 8000;
            if (killers[1] && action.fromRow === killers[1].fromRow && action.fromCol === killers[1].fromCol &&
                action.toRow === killers[1].toRow && action.toCol === killers[1].toCol) return 7000;

            // Escape threatened piece
            if (threatened) {
                const fromKey = (action.fromRow << 3) | action.fromCol;
                const toKey = (action.toRow << 3) | action.toCol;
                if (threatened.has(fromKey) && !threatened.has(toKey)) {
                    const piece = board.getPiece(action.fromRow, action.fromCol);
                    return 5000 + (DC_PIECE_VALUES[piece?.type] || 0);
                }
            }

            // History heuristic
            const from = action.fromRow * 8 + action.fromCol;
            const to = action.toRow * 8 + action.toCol;
            return this.history[sideIdx * 1024 + from * 32 + to] | 0;
        }
        if (action.action === 'flip') {
            const { row, col } = action;
            let adjEnemies = 0;
            for (const [dr, dc] of DELTAS) {
                const nr = row + dr, nc = col + dc;
                if (board.isInBoard(nr, nc)) {
                    const adj = board.getPiece(nr, nc);
                    if (adj && adj.revealed && adj.side !== side) adjEnemies++;
                }
            }
            return 500 - adjEnemies * 200;
        }
        return 0;
    }

    // --- Killer / History ---

    _storeKiller(ply, action) {
        if (!this.killerMoves[ply]) this.killerMoves[ply] = [null, null];
        const k1 = this.killerMoves[ply][0];
        if (!k1 || k1.fromRow !== action.fromRow || k1.fromCol !== action.fromCol ||
            k1.toRow !== action.toRow || k1.toCol !== action.toCol) {
            this.killerMoves[ply][1] = k1;
            this.killerMoves[ply][0] = {
                fromRow: action.fromRow, fromCol: action.fromCol,
                toRow: action.toRow, toCol: action.toCol
            };
        }
    }

    _storeHistory(side, action, depth) {
        const sideIdx = side === RED ? 0 : 1;
        const from = action.fromRow * 8 + action.fromCol;
        const to = action.toRow * 8 + action.toCol;
        const key = sideIdx * 1024 + from * 32 + to;
        const val = (this.history[key] | 0) + depth * depth;
        this.history[key] = val > 500000 ? 500000 : val;
    }

    // --- Helpers ---

    _getRemainingHidden(board) {
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
