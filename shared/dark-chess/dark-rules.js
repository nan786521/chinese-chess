import { generateDarkChessMoves } from './dark-moves.js';
import { DC_DRAW_MOVE_LIMIT, RED, BLACK } from '../constants.js';

export function checkDarkChessGameOver(board, currentSide, movesSinceCapture) {
    const oppSide = currentSide === RED ? BLACK : RED;

    // Check if opponent has no pieces at all (current player eliminated them)
    const oppCount = board.countPieces(oppSide);
    if (oppCount === 0) {
        return { over: true, winner: currentSide, reason: 'eliminated' };
    }

    // Check if current side has no pieces
    const myCount = board.countPieces(currentSide);
    if (myCount === 0) {
        return { over: true, winner: oppSide, reason: 'eliminated' };
    }

    // Check if current player has any legal moves
    const legalMoves = generateDarkChessMoves(board, currentSide);
    // Filter to only non-flip moves for the current side
    const sideActions = legalMoves.filter(m =>
        m.action === 'flip' || m.action === 'move' || m.action === 'capture'
    );
    if (sideActions.length === 0) {
        return { over: true, winner: oppSide, reason: 'no-moves' };
    }

    // Draw: too many moves without capture
    if (movesSinceCapture >= DC_DRAW_MOVE_LIMIT) {
        return { over: true, winner: null, reason: 'draw' };
    }

    return { over: false, winner: null, reason: null };
}
