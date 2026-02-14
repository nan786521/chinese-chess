import { generateAllLegalMoves } from '../shared/moves.js';
import { isInCheck } from '../shared/rules.js';
import { PIECE_VALUES, PST, PST_ENDGAME, PHASE_WEIGHTS, TOTAL_PHASE, AI_DIFFICULTY } from '../shared/constants.js';
import { TranspositionTable, EXACT, ALPHA_FLAG, BETA_FLAG } from '../shared/zobrist.js';

export class AIEngine {
    constructor() {
        this.nodesSearched = 0;
        this.difficulty = 'medium';
        this.maxDepth = 5;
        this.quiesceDepth = 4;
        this.randomness = 0;
        this.tt = new TranspositionTable();
        this.killerMoves = [];   // killerMoves[ply] = [move1, move2]
        this.history = {};       // history[key] = score
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

        const moves = generateAllLegalMoves(board, side);
        if (moves.length === 0) return null;
        if (moves.length === 1) return moves[0];

        let bestMove = moves[0];
        const oppSide = side === 'red' ? 'black' : 'red';

        // Iterative deepening: search from depth 1 up to maxDepth
        for (let depth = 1; depth <= this.maxDepth; depth++) {
            let alpha = -Infinity;
            let iterBest = null;
            let iterBestScore = -Infinity;

            // Order: put previous iteration's best move first
            this.orderMoves(board, moves, bestMove, 0, side);

            for (const move of moves) {
                const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const score = -this.negamax(board, depth - 1, -Infinity, -alpha, oppSide, 1);
                board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });

                if (score > iterBestScore) {
                    iterBestScore = score;
                    iterBest = move;
                }
                if (score > alpha) alpha = score;
            }

            if (iterBest) bestMove = iterBest;
        }

        // Add randomness for lower difficulties — pick from top moves
        if (this.randomness > 0 && moves.length > 1) {
            this.orderMoves(board, moves, bestMove, 0, side);
            const scored = [];
            for (const move of moves) {
                const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
                const score = -this.negamax(board, 1, -Infinity, Infinity, oppSide, 1);
                board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });
                scored.push({ move, score: score + Math.floor(Math.random() * this.randomness * 2) - this.randomness });
            }
            scored.sort((a, b) => b.score - a.score);
            return scored[0].move;
        }

        return bestMove;
    }

    negamax(board, depth, alpha, beta, side, ply) {
        this.nodesSearched++;
        const alphaOrig = alpha;

        // Transposition table probe
        const ttEntry = this.tt.probe(board.hash, depth, alpha, beta);
        if (ttEntry) {
            if (ttEntry.score !== undefined) return ttEntry.score;
        }
        const ttMove = ttEntry?.bestMove || null;

        const inCheck = isInCheck(board, side);

        // Check extension
        if (inCheck && ply < this.maxDepth + 6) depth++;

        if (depth <= 0) {
            return this.quiesce(board, alpha, beta, side, this.quiesceDepth);
        }

        const moves = generateAllLegalMoves(board, side);
        if (moves.length === 0) {
            return -PIECE_VALUES.king - depth;
        }

        const oppSide = side === 'red' ? 'black' : 'red';

        // Null move pruning: skip when in check or endgame
        if (!inCheck && depth >= 3 && !this.isEndgame(board)) {
            const R = depth > 6 ? 3 : 2;
            const nullScore = -this.negamax(board, depth - 1 - R, -beta, -beta + 1, oppSide, ply + 1);
            if (nullScore >= beta) {
                return beta;
            }
        }

        this.orderMoves(board, moves, ttMove, ply, side);

        let bestMove = moves[0];
        let bestScore = -Infinity;

        for (const move of moves) {
            const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, ply + 1);
            board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }

            if (score >= beta) {
                // Store killer & history for non-captures
                if (!captured) {
                    this.storeKiller(ply, move);
                    this.storeHistory(side, move, depth);
                }
                this.tt.store(board.hash, depth, beta, BETA_FLAG, move);
                return beta;
            }
            if (score > alpha) {
                alpha = score;
            }
        }

        // Store TT entry
        const flag = alpha <= alphaOrig ? ALPHA_FLAG : EXACT;
        this.tt.store(board.hash, depth, alpha, flag, bestMove);
        return alpha;
    }

    quiesce(board, alpha, beta, side, maxDepth) {
        const standPat = this.evaluate(board, side);
        if (maxDepth <= 0) return standPat;
        if (standPat >= beta) return beta;

        // Delta pruning: if even best capture can't raise alpha
        const DELTA = PIECE_VALUES.rook + 200;
        if (standPat + DELTA < alpha) return alpha;

        if (standPat > alpha) alpha = standPat;

        const inCheck = isInCheck(board, side);
        const moves = generateAllLegalMoves(board, side);

        let candidates;
        if (inCheck) {
            // Search all moves when in check (evasions)
            candidates = moves;
        } else {
            // Only captures, with delta pruning per move
            candidates = [];
            for (const m of moves) {
                const victim = board.getPiece(m.toRow, m.toCol);
                if (victim && standPat + PIECE_VALUES[victim.type] + 200 > alpha) {
                    candidates.push(m);
                }
            }
        }

        if (candidates.length === 0) return alpha;

        // Simple MVV-LVA ordering for captures
        candidates.sort((a, b) => {
            const captA = board.getPiece(a.toRow, a.toCol);
            const captB = board.getPiece(b.toRow, b.toCol);
            const scoreA = captA ? PIECE_VALUES[captA.type] * 10 : 0;
            const scoreB = captB ? PIECE_VALUES[captB.type] * 10 : 0;
            return scoreB - scoreA;
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

    // --- Evaluation ---

    evaluate(board, side) {
        let score = 0;
        const oppSide = side === 'red' ? 'black' : 'red';
        const ownPieces = board.getPieces(side);
        const oppPieces = board.getPieces(oppSide);

        // Game phase (256 = full middlegame, 0 = pure endgame)
        const phase = this.calcPhase(ownPieces, oppPieces);

        // Material + Tapered positional evaluation
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

        // King safety (weighted by phase — less important in endgame)
        const kingSafety = this.evalKingSafety(ownPieces) - this.evalKingSafety(oppPieces);
        score += (kingSafety * phase) >> 8;

        // Piece activity (crossing river)
        score += this.evalActivity(ownPieces, side) - this.evalActivity(oppPieces, oppSide);

        // King tropism: attacking pieces near enemy king
        const oppKing = board.findKing(oppSide);
        const ownKing = board.findKing(side);
        if (oppKing) score += this.evalKingTropism(ownPieces, oppKing);
        if (ownKing) score -= this.evalKingTropism(oppPieces, ownKing);

        // Connected pawns
        score += this.evalPawnStructure(ownPieces) - this.evalPawnStructure(oppPieces);

        // Rook on open file
        score += this.evalRookFiles(board, ownPieces, side) - this.evalRookFiles(board, oppPieces, oppSide);

        // Randomness for lower difficulties
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

    evalKingSafety(pieces) {
        let safety = 0;
        for (const p of pieces) {
            if (p.type === 'advisor') safety += 20;
            if (p.type === 'elephant') safety += 12;
        }
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
            for (let r = 0; r < 10; r++) {
                const piece = board.getPiece(r, p.col);
                if (piece && piece.type === 'pawn' && piece.side === side) ownPawnsOnFile++;
            }
            if (ownPawnsOnFile === 0) bonus += 20;
        }
        return bonus;
    }

    // --- Move Ordering ---

    orderMoves(board, moves, priorityMove, ply, side) {
        const killers = this.killerMoves[ply] || [null, null];

        moves.sort((a, b) => {
            const scoreA = this.moveScore(board, a, priorityMove, killers, side);
            const scoreB = this.moveScore(board, b, priorityMove, killers, side);
            return scoreB - scoreA;
        });
    }

    moveScore(board, move, priorityMove, killers, side) {
        // 1. TT / previous best move
        if (priorityMove && this.movesEqual(move, priorityMove)) return 100000;

        const victim = board.getPiece(move.toRow, move.toCol);
        const attacker = board.getPiece(move.fromRow, move.fromCol);

        // 2. Captures by MVV-LVA
        if (victim) {
            return 50000 + (PIECE_VALUES[victim.type] || 0) * 10 - (PIECE_VALUES[attacker?.type] || 0);
        }

        // 3. Killer moves
        if (this.movesEqual(move, killers[0])) return 40000;
        if (this.movesEqual(move, killers[1])) return 39000;

        // 4. History heuristic
        return this.getHistory(side, move);
    }

    // --- Killer Moves ---

    storeKiller(ply, move) {
        if (!this.killerMoves[ply]) this.killerMoves[ply] = [null, null];
        const [k1] = this.killerMoves[ply];
        if (!this.movesEqual(k1, move)) {
            this.killerMoves[ply][1] = k1;
            this.killerMoves[ply][0] = { fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol };
        }
    }

    // --- History Heuristic ---

    storeHistory(side, move, depth) {
        const key = `${side}_${move.fromRow}_${move.fromCol}_${move.toRow}_${move.toCol}`;
        this.history[key] = (this.history[key] || 0) + depth * depth;
    }

    getHistory(side, move) {
        const key = `${side}_${move.fromRow}_${move.fromCol}_${move.toRow}_${move.toCol}`;
        return this.history[key] || 0;
    }

    // --- Helpers ---

    movesEqual(a, b) {
        if (!a || !b) return false;
        return a.fromRow === b.fromRow && a.fromCol === b.fromCol &&
               a.toRow === b.toRow && a.toCol === b.toCol;
    }

    isEndgame(board) {
        let total = 0;
        for (let r = 0; r < 10; r++) {
            for (let c = 0; c < 9; c++) {
                if (board.getPiece(r, c)) total++;
            }
        }
        return total <= 10;
    }
}
