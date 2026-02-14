import { generateAllLegalMoves } from '../shared/moves.js';
import { isInCheck } from '../shared/rules.js';
import { PIECE_VALUES, PST, PST_ENDGAME, PHASE_WEIGHTS, TOTAL_PHASE, AI_DIFFICULTY, ROWS, COLS } from '../shared/constants.js';
import { TranspositionTable, EXACT, ALPHA_FLAG, BETA_FLAG } from '../shared/zobrist.js';

// Futility pruning margins by depth
const FUTILITY_MARGIN = [0, 200, 450, 700];

// Time limits per difficulty (ms)
const TIME_LIMIT = {
    beginner: 1000,
    easy:     2000,
    medium:   3000,
    hard:     5000,
    master:   10000,
};

export class AIEngine {
    constructor() {
        this.nodesSearched = 0;
        this.difficulty = 'medium';
        this.maxDepth = 5;
        this.quiesceDepth = 4;
        this.randomness = 0;
        this.tt = new TranspositionTable();
        this.killerMoves = [];
        this.history = {};
        this.startTime = 0;
        this.timeLimit = 5000;
        this.aborted = false;
    }

    setDifficulty(level) {
        this.difficulty = level;
    }

    findBestMove(board, side) {
        const config = AI_DIFFICULTY[this.difficulty];
        this.maxDepth = config.depth;
        this.quiesceDepth = config.quiesceDepth;
        this.randomness = config.randomness;
        this.nodesSearched = 0;
        this.killerMoves = [];
        this.history = {};
        this.startTime = performance.now();
        this.timeLimit = TIME_LIMIT[this.difficulty] || 5000;
        this.aborted = false;
        // TT persists across moves — don't clear

        const moves = generateAllLegalMoves(board, side);
        if (moves.length === 0) return null;
        if (moves.length === 1) return moves[0];

        let bestMove = moves[0];
        let bestScore = -Infinity;
        const oppSide = side === 'red' ? 'black' : 'red';

        // Iterative deepening with aspiration windows + time management
        for (let depth = 1; depth <= this.maxDepth; depth++) {
            this.aborted = false;

            let alpha, beta;
            if (depth >= 4 && bestScore > -9000 && bestScore < 9000) {
                alpha = bestScore - 50;
                beta = bestScore + 50;
            } else {
                alpha = -Infinity;
                beta = Infinity;
            }

            let result = this.searchRoot(board, moves, side, oppSide, depth, alpha, beta);

            // Aspiration re-search
            if (!this.aborted && (result.score <= alpha || result.score >= beta)) {
                result = this.searchRoot(board, moves, side, oppSide, depth, -Infinity, Infinity);
            }

            if (!this.aborted && result.move) {
                bestMove = result.move;
                bestScore = result.score;
            }

            // Stop deepening if time is running out (>60% used)
            if (this.aborted || (performance.now() - this.startTime) > this.timeLimit * 0.6) {
                break;
            }
        }

        // Randomness for lower difficulties
        if (this.randomness > 0 && moves.length > 1) {
            this.orderMoves(board, moves, bestMove, 0, side);
            const scored = [];
            for (const move of moves) {
                const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const score = -this.negamax(board, 1, -Infinity, Infinity, oppSide, 1, false);
                board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });
                scored.push({ move, score: score + Math.floor(Math.random() * this.randomness * 2) - this.randomness });
            }
            scored.sort((a, b) => b.score - a.score);
            return scored[0].move;
        }

        return bestMove;
    }

    searchRoot(board, moves, side, oppSide, depth, alpha, beta) {
        this.orderMoves(board, moves, null, 0, side);

        // Put TT move first if available
        const ttEntry = this.tt.probe(board.hash, 0, alpha, beta);
        if (ttEntry?.bestMove) {
            this.orderMoves(board, moves, ttEntry.bestMove, 0, side);
        }

        let bestMove = moves[0];
        let bestScore = -Infinity;
        let isFirst = true;

        for (const move of moves) {
            const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            let score;

            if (isFirst) {
                // Full window search for first (best) move
                score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, 1, true);
                isFirst = false;
            } else {
                // PVS: zero-window search first
                score = -this.negamax(board, depth - 1, -alpha - 1, -alpha, oppSide, 1, true);
                if (score > alpha && score < beta) {
                    // Re-search with full window
                    score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, 1, true);
                }
            }

            board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
            if (score > alpha) alpha = score;
            if (score >= beta) break;
        }

        return { move: bestMove, score: bestScore };
    }

    negamax(board, depth, alpha, beta, side, ply, allowNull) {
        this.nodesSearched++;

        // Time check every 4096 nodes
        if ((this.nodesSearched & 4095) === 0) {
            if (performance.now() - this.startTime > this.timeLimit) {
                this.aborted = true;
                return 0;
            }
        }
        if (this.aborted) return 0;

        const alphaOrig = alpha;

        // TT probe
        const ttEntry = this.tt.probe(board.hash, depth, alpha, beta);
        if (ttEntry && ttEntry.score !== undefined) return ttEntry.score;
        const ttMove = ttEntry?.bestMove || null;

        const inCheck = isInCheck(board, side);

        // Check extension
        if (inCheck && ply < this.maxDepth + 6) depth++;

        if (depth <= 0) {
            return this.quiesce(board, alpha, beta, side, this.quiesceDepth);
        }

        const oppSide = side === 'red' ? 'black' : 'red';

        // Null move pruning
        if (allowNull && !inCheck && depth >= 3 && !this.isEndgame(board)) {
            const R = depth > 6 ? 3 : 2;
            const nullScore = -this.negamax(board, depth - 1 - R, -beta, -beta + 1, oppSide, ply + 1, false);
            if (nullScore >= beta) return beta;
        }

        const moves = generateAllLegalMoves(board, side);
        if (moves.length === 0) return -PIECE_VALUES.king - depth;

        this.orderMoves(board, moves, ttMove, ply, side);

        // Futility pruning: static eval for shallow depths
        let staticEval = null;
        const canFutility = !inCheck && depth <= 3;
        if (canFutility) {
            staticEval = this.evaluate(board, side);
        }

        let bestMove = moves[0];
        let bestScore = -Infinity;
        let movesSearched = 0;

        for (let i = 0; i < moves.length; i++) {
            const move = moves[i];
            const captured = board.getPiece(move.toRow, move.toCol);

            // Futility pruning: skip quiet moves at shallow depth if eval + margin < alpha
            if (canFutility && !captured && movesSearched > 0 && !inCheck) {
                if (staticEval + FUTILITY_MARGIN[depth] <= alpha) {
                    movesSearched++;
                    continue;
                }
            }

            const cap = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const givesCheck = isInCheck(board, oppSide);
            let score;

            // LMR: Late Move Reductions
            let reduction = 0;
            if (depth >= 3 && movesSearched >= 3 && !cap && !inCheck && !givesCheck) {
                // Reduce more for moves searched later
                reduction = 1;
                if (movesSearched >= 6) reduction = 2;
                if (depth <= 4) reduction = Math.min(reduction, 1);
            }

            if (movesSearched === 0) {
                // First move: full window
                score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, ply + 1, true);
            } else if (reduction > 0) {
                // LMR: reduced depth, zero-window
                score = -this.negamax(board, depth - 1 - reduction, -alpha - 1, -alpha, oppSide, ply + 1, true);
                if (score > alpha) {
                    // Failed high: re-search at full depth, zero-window
                    score = -this.negamax(board, depth - 1, -alpha - 1, -alpha, oppSide, ply + 1, true);
                    if (score > alpha && score < beta) {
                        // PVS re-search with full window
                        score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, ply + 1, true);
                    }
                }
            } else {
                // PVS: zero-window
                score = -this.negamax(board, depth - 1, -alpha - 1, -alpha, oppSide, ply + 1, true);
                if (score > alpha && score < beta) {
                    score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, ply + 1, true);
                }
            }

            board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured: cap });
            movesSearched++;

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }

            if (score >= beta) {
                if (!cap) {
                    this.storeKiller(ply, move);
                    this.storeHistory(side, move, depth);
                }
                this.tt.store(board.hash, depth, beta, BETA_FLAG, move);
                return beta;
            }
            if (score > alpha) alpha = score;
        }

        const flag = alpha <= alphaOrig ? ALPHA_FLAG : EXACT;
        this.tt.store(board.hash, depth, alpha, flag, bestMove);
        return alpha;
    }

    quiesce(board, alpha, beta, side, maxDepth) {
        const standPat = this.evaluate(board, side);
        if (maxDepth <= 0) return standPat;
        if (standPat >= beta) return beta;

        const DELTA = PIECE_VALUES.rook + 200;
        if (standPat + DELTA < alpha) return alpha;

        if (standPat > alpha) alpha = standPat;

        const inCheck = isInCheck(board, side);
        const moves = generateAllLegalMoves(board, side);

        let candidates;
        if (inCheck) {
            candidates = moves;
        } else {
            candidates = [];
            for (const m of moves) {
                const victim = board.getPiece(m.toRow, m.toCol);
                if (victim && standPat + PIECE_VALUES[victim.type] + 200 > alpha) {
                    candidates.push(m);
                }
            }
        }

        if (candidates.length === 0) return alpha;

        candidates.sort((a, b) => {
            const captA = board.getPiece(a.toRow, a.toCol);
            const captB = board.getPiece(b.toRow, b.toCol);
            return (captB ? PIECE_VALUES[captB.type] : 0) - (captA ? PIECE_VALUES[captA.type] : 0);
        });

        const oppSide = side === 'red' ? 'black' : 'red';

        for (const move of candidates) {
            const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = -this.quiesce(board, -beta, -alpha, oppSide, maxDepth - 1);
            board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
    }

    // === Evaluation ===

    evaluate(board, side) {
        let score = 0;
        const oppSide = side === 'red' ? 'black' : 'red';
        const ownPieces = board.getPieces(side);
        const oppPieces = board.getPieces(oppSide);

        const phase = this.calcPhase(ownPieces, oppPieces);
        const totalPieces = ownPieces.length + oppPieces.length;

        // Material + Tapered PST
        for (const p of ownPieces) {
            score += PIECE_VALUES[p.type];
            score += this.taperedPST(p, side, phase);
        }
        for (const p of oppPieces) {
            score -= PIECE_VALUES[p.type];
            score -= this.taperedPST(p, oppSide, phase);
        }

        // Check bonus
        if (isInCheck(board, oppSide)) score += 200;

        // King safety (phase-weighted)
        const kingSafety = this.evalKingSafety(board, ownPieces, side, oppPieces) -
                           this.evalKingSafety(board, oppPieces, oppSide, ownPieces);
        score += (kingSafety * phase) >> 8;

        // Piece activity
        score += this.evalActivity(ownPieces, side) - this.evalActivity(oppPieces, oppSide);

        // King tropism
        const oppKing = board.findKing(oppSide);
        const ownKing = board.findKing(side);
        if (oppKing) score += this.evalKingTropism(ownPieces, oppKing);
        if (ownKing) score -= this.evalKingTropism(oppPieces, ownKing);

        // Connected pawns
        score += this.evalPawnStructure(ownPieces) - this.evalPawnStructure(oppPieces);

        // Rook on open file
        score += this.evalRookFiles(board, ownPieces, side) - this.evalRookFiles(board, oppPieces, oppSide);

        // Cannon screen evaluation (more pieces = cannon stronger)
        score += this.evalCannon(board, ownPieces, totalPieces) - this.evalCannon(board, oppPieces, totalPieces);

        // Horse leg blocking
        score += this.evalHorseMobility(board, ownPieces) - this.evalHorseMobility(board, oppPieces);

        // King exposure on file
        if (ownKing) score -= this.evalKingExposure(board, ownKing, side);
        if (oppKing) score += this.evalKingExposure(board, oppKing, oppSide);

        // Randomness
        if (this.randomness > 0) {
            score += Math.floor(Math.random() * this.randomness * 2) - this.randomness;
        }

        return score;
    }

    calcPhase(ownPieces, oppPieces) {
        let current = 0;
        for (const p of ownPieces) current += PHASE_WEIGHTS[p.type] || 0;
        for (const p of oppPieces) current += PHASE_WEIGHTS[p.type] || 0;
        return Math.min(256, Math.floor((current / TOTAL_PHASE) * 256));
    }

    taperedPST(piece, side, phase) {
        const row = side === 'red' ? piece.row : (9 - piece.row);
        const mgVal = PST[piece.type]?.[row]?.[piece.col] || 0;
        const egVal = PST_ENDGAME[piece.type]?.[row]?.[piece.col] || 0;
        return ((mgVal * phase) + (egVal * (256 - phase))) >> 8;
    }

    evalKingSafety(board, pieces, side, enemyPieces) {
        let safety = 0;
        let advisors = 0, elephants = 0;
        for (const p of pieces) {
            if (p.type === 'advisor') { safety += 20; advisors++; }
            if (p.type === 'elephant') { safety += 12; elephants++; }
        }
        // Completeness bonus: having both advisors + both elephants = strong defense
        if (advisors === 2) safety += 25;
        if (elephants === 2) safety += 15;
        // Missing defenders penalty: enemy has heavy pieces but we lack defenders
        const enemyHeavy = enemyPieces.filter(p => p.type === 'rook' || p.type === 'cannon').length;
        if (advisors === 0 && enemyHeavy > 0) safety -= 40;
        if (elephants === 0 && enemyHeavy > 0) safety -= 25;
        return safety;
    }

    evalActivity(pieces, side) {
        let activity = 0;
        for (const p of pieces) {
            const crossed = side === 'red' ? p.row <= 4 : p.row >= 5;
            if (crossed) {
                if (p.type === 'rook') activity += 30;
                else if (p.type === 'horse') activity += 20;
                else if (p.type === 'cannon') activity += 15;
            }
        }
        return activity;
    }

    evalKingTropism(pieces, enemyKing) {
        let tropism = 0;
        for (const p of pieces) {
            if (p.type === 'rook' || p.type === 'cannon' || p.type === 'horse') {
                const dist = Math.abs(p.row - enemyKing.row) + Math.abs(p.col - enemyKing.col);
                tropism += Math.max(0, 14 - dist) * 2;
            }
        }
        return tropism;
    }

    evalPawnStructure(pieces) {
        let bonus = 0;
        const pawns = [];
        for (const p of pieces) {
            if (p.type === 'pawn') pawns.push(p);
        }
        for (let i = 0; i < pawns.length; i++) {
            for (let j = i + 1; j < pawns.length; j++) {
                if (pawns[i].row === pawns[j].row && Math.abs(pawns[i].col - pawns[j].col) === 1) {
                    bonus += 15;
                }
            }
        }
        return bonus;
    }

    evalRookFiles(board, pieces, side) {
        let bonus = 0;
        for (const p of pieces) {
            if (p.type !== 'rook') continue;
            let ownPawnsOnFile = 0;
            for (let r = 0; r < ROWS; r++) {
                const piece = board.getPiece(r, p.col);
                if (piece && piece.type === 'pawn' && piece.side === side) ownPawnsOnFile++;
            }
            if (ownPawnsOnFile === 0) bonus += 20;
        }
        return bonus;
    }

    // Cannon needs "screens" (pieces to jump over) — stronger with more pieces on board
    evalCannon(board, pieces, totalPieces) {
        let score = 0;
        for (const p of pieces) {
            if (p.type !== 'cannon') continue;
            // Cannon bonus scales with piece count: 32 pieces = +30, 10 pieces = -15
            score += Math.floor((totalPieces - 16) * 2);

            // Count available screens on cannon's rank and file
            let screens = 0;
            for (let r = 0; r < ROWS; r++) {
                if (r !== p.row && board.getPiece(r, p.col)) screens++;
            }
            for (let c = 0; c < COLS; c++) {
                if (c !== p.col && board.getPiece(p.row, c)) screens++;
            }
            score += Math.min(screens, 4) * 5; // up to +20 for screens
        }
        return score;
    }

    // Horse mobility: penalize blocked legs
    evalHorseMobility(board, pieces) {
        let score = 0;
        const legDeltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const p of pieces) {
            if (p.type !== 'horse') continue;
            let blocked = 0;
            for (const [dr, dc] of legDeltas) {
                const lr = p.row + dr, lc = p.col + dc;
                if (board.isInBoard(lr, lc) && board.getPiece(lr, lc)) blocked++;
            }
            // 0 blocked = +12, 1 = +6, 2 = 0, 3 = -8, 4 = -20
            score += 12 - blocked * 8;
        }
        return score;
    }

    // King exposure: penalty if king is on a file facing enemy rook/cannon with no blocker
    evalKingExposure(board, kingPos, side) {
        let penalty = 0;
        const oppSide = side === 'red' ? 'black' : 'red';

        // Check king's column for enemy rooks/cannons
        const col = kingPos.col;
        const forward = side === 'red' ? -1 : 1;
        let blockers = 0;
        let r = kingPos.row + forward;
        while (r >= 0 && r < ROWS) {
            const p = board.getPiece(r, col);
            if (p) {
                if (p.side === oppSide) {
                    if (p.type === 'rook' && blockers === 0) penalty += 40;
                    if (p.type === 'cannon' && blockers === 1) penalty += 35;
                }
                blockers++;
                if (blockers >= 2) break;
            }
            r += forward;
        }

        return penalty;
    }

    // === Move Ordering ===

    orderMoves(board, moves, priorityMove, ply, side) {
        const killers = this.killerMoves[ply] || [null, null];
        moves.sort((a, b) => {
            return this.moveScore(board, b, priorityMove, killers, side) -
                   this.moveScore(board, a, priorityMove, killers, side);
        });
    }

    moveScore(board, move, priorityMove, killers, side) {
        if (priorityMove && this.movesEqual(move, priorityMove)) return 100000;

        const victim = board.getPiece(move.toRow, move.toCol);
        const attacker = board.getPiece(move.fromRow, move.fromCol);

        if (victim) {
            return 50000 + (PIECE_VALUES[victim.type] || 0) * 10 - (PIECE_VALUES[attacker?.type] || 0);
        }

        if (this.movesEqual(move, killers[0])) return 40000;
        if (this.movesEqual(move, killers[1])) return 39000;

        return this.getHistory(side, move);
    }

    // === Killer Moves ===

    storeKiller(ply, move) {
        if (!this.killerMoves[ply]) this.killerMoves[ply] = [null, null];
        const [k1] = this.killerMoves[ply];
        if (!this.movesEqual(k1, move)) {
            this.killerMoves[ply][1] = k1;
            this.killerMoves[ply][0] = { fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol };
        }
    }

    // === History Heuristic ===

    storeHistory(side, move, depth) {
        const key = `${side}_${move.fromRow}_${move.fromCol}_${move.toRow}_${move.toCol}`;
        this.history[key] = (this.history[key] || 0) + depth * depth;
    }

    getHistory(side, move) {
        return this.history[`${side}_${move.fromRow}_${move.fromCol}_${move.toRow}_${move.toCol}`] || 0;
    }

    // === Helpers ===

    movesEqual(a, b) {
        if (!a || !b) return false;
        return a.fromRow === b.fromRow && a.fromCol === b.fromCol &&
               a.toRow === b.toRow && a.toCol === b.toCol;
    }

    isEndgame(board) {
        let total = 0;
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                if (board.getPiece(r, c)) total++;
            }
        }
        return total <= 10;
    }
}
