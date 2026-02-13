import { DC_ROWS, DC_COLS, DC_RANKS } from '../constants.js';

// Check if attacker can capture defender based on rank
export function canCapture(attacker, defender) {
    // Cannon captures are handled via cannonCanCapture (jump mechanic)
    if (attacker.type === 'cannon') return false;

    const attackRank = DC_RANKS[attacker.type];
    const defendRank = DC_RANKS[defender.type];

    // Pawn can capture King
    if (attacker.type === 'pawn' && defender.type === 'king') return true;
    // King cannot capture Pawn
    if (attacker.type === 'king' && defender.type === 'pawn') return false;

    // Higher or equal rank can capture (lower number = higher rank)
    return attackRank <= defendRank;
}

// Check if cannon at (fromRow,fromCol) can jump-capture target at (toRow,toCol)
export function cannonCanCapture(board, fromRow, fromCol, toRow, toCol) {
    // Must be in a straight line
    if (fromRow !== toRow && fromCol !== toCol) return false;
    // Must not be the same cell
    if (fromRow === toRow && fromCol === toCol) return false;

    let count = 0;
    if (fromRow === toRow) {
        const minC = Math.min(fromCol, toCol);
        const maxC = Math.max(fromCol, toCol);
        if (maxC - minC < 2) return false; // need at least 1 cell between
        for (let c = minC + 1; c < maxC; c++) {
            if (board.getPiece(fromRow, c)) count++;
        }
    } else {
        const minR = Math.min(fromRow, toRow);
        const maxR = Math.max(fromRow, toRow);
        if (maxR - minR < 2) return false; // need at least 1 cell between
        for (let r = minR + 1; r < maxR; r++) {
            if (board.getPiece(r, fromCol)) count++;
        }
    }
    return count === 1;
}

// Generate all legal actions for the current player
export function generateDarkChessMoves(board, side) {
    const actions = [];

    for (let r = 0; r < DC_ROWS; r++) {
        for (let c = 0; c < DC_COLS; c++) {
            const piece = board.getPiece(r, c);
            if (!piece) continue;

            // Flip any unrevealed piece
            if (!piece.revealed) {
                actions.push({ action: 'flip', row: r, col: c });
                continue;
            }

            // Only move/capture own revealed pieces
            if (piece.side !== side) continue;

            const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dr, dc] of deltas) {
                const nr = r + dr, nc = c + dc;
                if (!board.isInBoard(nr, nc)) continue;
                const target = board.getPiece(nr, nc);

                if (!target) {
                    // Empty cell: move
                    actions.push({ action: 'move', fromRow: r, fromCol: c, toRow: nr, toCol: nc });
                } else if (target.revealed && target.side !== side) {
                    // Adjacent revealed enemy: rank-based capture (non-cannon)
                    if (piece.type !== 'cannon' && canCapture(piece, target)) {
                        actions.push({ action: 'capture', fromRow: r, fromCol: c, toRow: nr, toCol: nc });
                    }
                }
                // Cannot move onto unrevealed pieces or own pieces
            }

            // Cannon jump-capture: any distance in straight line with exactly 1 piece between
            if (piece.type === 'cannon') {
                // Check all cells in 4 directions
                for (const [dr, dc] of deltas) {
                    let jumped = 0;
                    let nr = r + dr, nc = c + dc;
                    while (board.isInBoard(nr, nc)) {
                        const target = board.getPiece(nr, nc);
                        if (target) {
                            if (jumped === 0) {
                                // First piece encountered: this is the jump piece
                                jumped = 1;
                            } else {
                                // Second piece encountered: can capture if enemy and revealed
                                if (target.revealed && target.side !== side) {
                                    actions.push({ action: 'capture', fromRow: r, fromCol: c, toRow: nr, toCol: nc });
                                }
                                break; // Stop scanning this direction
                            }
                        }
                        nr += dr;
                        nc += dc;
                    }
                }
            }
        }
    }

    return actions;
}

// Generate moves/captures only for a specific piece (used by UI for highlights)
export function generatePieceMoves(board, row, col) {
    const piece = board.getPiece(row, col);
    if (!piece || !piece.revealed) return [];

    const side = piece.side;
    const moves = [];
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];

    for (const [dr, dc] of deltas) {
        const nr = row + dr, nc = col + dc;
        if (!board.isInBoard(nr, nc)) continue;
        const target = board.getPiece(nr, nc);

        if (!target) {
            moves.push({ toRow: nr, toCol: nc, isCapture: false });
        } else if (target.revealed && target.side !== side) {
            if (piece.type !== 'cannon' && canCapture(piece, target)) {
                moves.push({ toRow: nr, toCol: nc, isCapture: true });
            }
        }
    }

    // Cannon jump-capture
    if (piece.type === 'cannon') {
        for (const [dr, dc] of deltas) {
            let jumped = 0;
            let nr = row + dr, nc = col + dc;
            while (board.isInBoard(nr, nc)) {
                const target = board.getPiece(nr, nc);
                if (target) {
                    if (jumped === 0) {
                        jumped = 1;
                    } else {
                        if (target.revealed && target.side !== side) {
                            moves.push({ toRow: nr, toCol: nc, isCapture: true });
                        }
                        break;
                    }
                }
                nr += dr;
                nc += dc;
            }
        }
    }

    return moves;
}
