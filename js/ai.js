import { generateAllLegalMoves } from '../shared/moves.js';
import { isInCheck } from '../shared/rules.js';
import { PIECE_VALUES, PST, AI_DIFFICULTY } from '../shared/constants.js';

export class AIEngine {
    constructor() {
        this.nodesSearched = 0;
        this.difficulty = 'medium';
        this.maxDepth = 4;
        this.quiesceDepth = 4;
        this.randomness = 0;
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

        const moves = generateAllLegalMoves(board, side);
        if (moves.length === 0) return null;

        this.orderMoves(board, moves);

        let bestMove = null;
        let bestScore = -Infinity;
        const oppSide = side === 'red' ? 'black' : 'red';

        for (const move of moves) {
            const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = -this.negamax(board, config.depth - 1, -Infinity, -bestScore, oppSide, 1);
            board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    negamax(board, depth, alpha, beta, side, ply) {
        this.nodesSearched++;

        const inCheck = isInCheck(board, side);

        // Check extension: search deeper when in check
        if (inCheck && ply < this.maxDepth + 6) {
            depth++;
        }

        if (depth <= 0) {
            return this.quiesce(board, alpha, beta, side, this.quiesceDepth);
        }

        const moves = generateAllLegalMoves(board, side);

        if (moves.length === 0) {
            // Checkmate or stalemate — both are losses in Chinese chess
            return -PIECE_VALUES.king - depth;
        }

        this.orderMoves(board, moves);
        const oppSide = side === 'red' ? 'black' : 'red';

        for (const move of moves) {
            const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = -this.negamax(board, depth - 1, -beta, -alpha, oppSide, ply + 1);
            board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });

            if (score >= beta) {
                return beta;
            }
            if (score > alpha) {
                alpha = score;
            }
        }

        return alpha;
    }

    quiesce(board, alpha, beta, side, maxDepth) {
        const standPat = this.evaluate(board, side);

        if (maxDepth <= 0) return standPat;
        if (standPat >= beta) return beta;
        if (standPat > alpha) alpha = standPat;

        const moves = generateAllLegalMoves(board, side);
        const captures = moves.filter(m => board.getPiece(m.toRow, m.toCol) !== null);

        this.orderMoves(board, captures);
        const oppSide = side === 'red' ? 'black' : 'red';

        for (const move of captures) {
            const captured = board.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const score = -this.quiesce(board, -beta, -alpha, oppSide, maxDepth - 1);
            board.undoMove({ fromRow: move.fromRow, fromCol: move.fromCol, toRow: move.toRow, toCol: move.toCol, captured });

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
    }

    evaluate(board, side) {
        let score = 0;
        const oppSide = side === 'red' ? 'black' : 'red';

        const ownPieces = board.getPieces(side);
        const oppPieces = board.getPieces(oppSide);

        // Material + Positional
        for (const p of ownPieces) {
            score += PIECE_VALUES[p.type];
            score += this.getPositionalValue(p, side);
        }
        for (const p of oppPieces) {
            score -= PIECE_VALUES[p.type];
            score -= this.getPositionalValue(p, oppSide);
        }

        // Check bonus (significant)
        if (isInCheck(board, oppSide)) {
            score += 200;
        }

        // King safety
        score += this.evaluateKingSafety(ownPieces);
        score -= this.evaluateKingSafety(oppPieces);

        // Piece activity: bonus for pieces past the river
        score += this.evaluateActivity(ownPieces, side);
        score -= this.evaluateActivity(oppPieces, oppSide);

        // Randomness for lower difficulties
        if (this.randomness > 0) {
            score += Math.floor(Math.random() * this.randomness * 2) - this.randomness;
        }

        return score;
    }

    evaluateKingSafety(pieces) {
        let safety = 0;
        for (const p of pieces) {
            if (p.type === 'advisor') safety += 20;
            if (p.type === 'elephant') safety += 12;
        }
        return safety;
    }

    evaluateActivity(pieces, side) {
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

    getPositionalValue(piece, side) {
        const pst = PST[piece.type];
        if (!pst) return 0;
        const row = side === 'red' ? piece.row : (9 - piece.row);
        return pst[row][piece.col];
    }

    // MVV-LVA move ordering: captures sorted by (victim value * 10 - attacker value)
    orderMoves(board, moves) {
        moves.sort((a, b) => {
            const captA = board.getPiece(a.toRow, a.toCol);
            const captB = board.getPiece(b.toRow, b.toCol);
            const atkA = board.getPiece(a.fromRow, a.fromCol);
            const atkB = board.getPiece(b.fromRow, b.fromCol);
            const scoreA = captA ? (PIECE_VALUES[captA.type] * 10 - (atkA ? PIECE_VALUES[atkA.type] : 0)) : 0;
            const scoreB = captB ? (PIECE_VALUES[captB.type] * 10 - (atkB ? PIECE_VALUES[atkB.type] : 0)) : 0;
            return scoreB - scoreA;
        });
    }
}
