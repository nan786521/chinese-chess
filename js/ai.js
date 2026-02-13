import { generateAllLegalMoves } from '../shared/moves.js';
import { isInCheck } from '../shared/rules.js';
import { PIECE_VALUES, PST, AI_DIFFICULTY } from '../shared/constants.js';

export class AIEngine {
    constructor() {
        this.nodesSearched = 0;
        this.difficulty = 'medium';
    }

    setDifficulty(level) {
        this.difficulty = level;
    }

    findBestMove(board, side) {
        const config = AI_DIFFICULTY[this.difficulty];
        const depth = config.depth;
        this.quiesceDepth = config.quiesceDepth;
        this.randomness = config.randomness;
        this.nodesSearched = 0;

        const moves = generateAllLegalMoves(board, side);
        if (moves.length === 0) return null;

        this.shuffleMoves(moves);
        this.orderMoves(board, moves);

        let bestMove = null;
        let bestScore = -Infinity;

        for (const move of moves) {
            const clone = board.clone();
            clone.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const oppSide = side === 'red' ? 'black' : 'red';
            const score = -this.negamax(clone, depth - 1, -Infinity, -bestScore, oppSide);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        return bestMove;
    }

    negamax(board, depth, alpha, beta, side) {
        this.nodesSearched++;

        if (depth === 0) {
            return this.quiesce(board, alpha, beta, side, this.quiesceDepth);
        }

        const moves = generateAllLegalMoves(board, side);

        if (moves.length === 0) {
            return -PIECE_VALUES.king - depth;
        }

        this.orderMoves(board, moves);

        for (const move of moves) {
            const clone = board.clone();
            clone.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const oppSide = side === 'red' ? 'black' : 'red';
            const score = -this.negamax(clone, depth - 1, -beta, -alpha, oppSide);

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

        for (const move of captures) {
            const clone = board.clone();
            clone.movePiece(move.fromRow, move.fromCol, move.toRow, move.toCol);
            const oppSide = side === 'red' ? 'black' : 'red';
            const score = -this.quiesce(clone, -beta, -alpha, oppSide, maxDepth - 1);

            if (score >= beta) return beta;
            if (score > alpha) alpha = score;
        }

        return alpha;
    }

    evaluate(board, side) {
        let score = 0;
        const oppSide = side === 'red' ? 'black' : 'red';

        const ownPieces = board.getPieces(side);
        for (const p of ownPieces) {
            score += PIECE_VALUES[p.type];
            score += this.getPositionalValue(p, side);
        }

        const oppPieces = board.getPieces(oppSide);
        for (const p of oppPieces) {
            score -= PIECE_VALUES[p.type];
            score -= this.getPositionalValue(p, oppSide);
        }

        if (isInCheck(board, oppSide)) {
            score += 40;
        }

        // Add randomness for lower difficulties
        if (this.randomness > 0) {
            score += Math.floor(Math.random() * this.randomness * 2) - this.randomness;
        }

        return score;
    }

    getPositionalValue(piece, side) {
        const pst = PST[piece.type];
        if (!pst) return 0;
        const row = side === 'red' ? piece.row : (9 - piece.row);
        return pst[row][piece.col];
    }

    orderMoves(board, moves) {
        moves.sort((a, b) => {
            const captA = board.getPiece(a.toRow, a.toCol);
            const captB = board.getPiece(b.toRow, b.toCol);
            const scoreA = captA ? PIECE_VALUES[captA.type] : 0;
            const scoreB = captB ? PIECE_VALUES[captB.type] : 0;
            return scoreB - scoreA;
        });
    }

    shuffleMoves(moves) {
        for (let i = moves.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [moves[i], moves[j]] = [moves[j], moves[i]];
        }
    }
}
