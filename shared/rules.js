import { generateAllLegalMoves } from './moves.js';
import { isUnderAttack } from './moves.js';

export function isInCheck(board, side) {
    return isUnderAttack(board, side);
}

export function checkGameOver(board, currentSide) {
    const legalMoves = generateAllLegalMoves(board, currentSide);
    if (legalMoves.length === 0) {
        const winner = currentSide === 'red' ? 'black' : 'red';
        const inCheck = isInCheck(board, currentSide);
        return {
            over: true,
            winner,
            reason: inCheck ? 'checkmate' : 'stalemate'
        };
    }
    return { over: false, winner: null, reason: null };
}
