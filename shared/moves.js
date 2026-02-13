import { ROWS, COLS, PALACE, RIVER } from './constants.js';

export function generatePieceMoves(board, row, col) {
    const piece = board.getPiece(row, col);
    if (!piece) return [];

    switch (piece.type) {
        case 'king':     return kingMoves(board, row, col, piece.side);
        case 'advisor':  return advisorMoves(board, row, col, piece.side);
        case 'elephant': return elephantMoves(board, row, col, piece.side);
        case 'rook':     return rookMoves(board, row, col, piece.side);
        case 'horse':    return horseMoves(board, row, col, piece.side);
        case 'cannon':   return cannonMoves(board, row, col, piece.side);
        case 'pawn':     return pawnMoves(board, row, col, piece.side);
        default: return [];
    }
}

export function generateAllLegalMoves(board, side) {
    const moves = [];
    const pieces = board.getPieces(side);

    for (const p of pieces) {
        const pieceMoves = generatePieceMoves(board, p.row, p.col);
        for (const m of pieceMoves) {
            if (!wouldLeaveInCheck(board, p.row, p.col, m.toRow, m.toCol, side)) {
                moves.push({
                    fromRow: p.row,
                    fromCol: p.col,
                    toRow: m.toRow,
                    toCol: m.toCol
                });
            }
        }
    }

    return moves;
}

function wouldLeaveInCheck(board, fromRow, fromCol, toRow, toCol, side) {
    const clone = board.clone();
    clone.movePiece(fromRow, fromCol, toRow, toCol);
    if (kingsAreFacing(clone)) return true;
    return isUnderAttack(clone, side);
}

function isUnderAttack(board, side) {
    const kingPos = board.findKing(side);
    if (!kingPos) return true;

    const opponentSide = side === 'red' ? 'black' : 'red';
    const oppPieces = board.getPieces(opponentSide);

    for (const p of oppPieces) {
        const moves = generatePieceMoves(board, p.row, p.col);
        for (const m of moves) {
            if (m.toRow === kingPos.row && m.toCol === kingPos.col) {
                return true;
            }
        }
    }
    return false;
}

function kingsAreFacing(board) {
    const redKing = board.findKing('red');
    const blackKing = board.findKing('black');
    if (!redKing || !blackKing) return false;
    if (redKing.col !== blackKing.col) return false;

    const minRow = Math.min(redKing.row, blackKing.row);
    const maxRow = Math.max(redKing.row, blackKing.row);
    for (let r = minRow + 1; r < maxRow; r++) {
        if (board.getPiece(r, redKing.col)) return false;
    }
    return true;
}

export { isUnderAttack, kingsAreFacing };

function canMoveTo(board, row, col, side) {
    if (!board.isInBoard(row, col)) return false;
    const target = board.getPiece(row, col);
    return !target || target.side !== side;
}

function kingMoves(board, row, col, side) {
    const moves = [];
    const palace = PALACE[side];
    const deltas = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of deltas) {
        const nr = row + dr, nc = col + dc;
        if (nr >= palace.rowMin && nr <= palace.rowMax &&
            nc >= palace.colMin && nc <= palace.colMax &&
            canMoveTo(board, nr, nc, side)) {
            moves.push({ toRow: nr, toCol: nc });
        }
    }
    return moves;
}

function advisorMoves(board, row, col, side) {
    const moves = [];
    const palace = PALACE[side];
    const deltas = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of deltas) {
        const nr = row + dr, nc = col + dc;
        if (nr >= palace.rowMin && nr <= palace.rowMax &&
            nc >= palace.colMin && nc <= palace.colMax &&
            canMoveTo(board, nr, nc, side)) {
            moves.push({ toRow: nr, toCol: nc });
        }
    }
    return moves;
}

function elephantMoves(board, row, col, side) {
    const moves = [];
    const deltas = [[-2, -2], [-2, 2], [2, -2], [2, 2]];
    const eyes   = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (let i = 0; i < 4; i++) {
        const nr = row + deltas[i][0], nc = col + deltas[i][1];
        const er = row + eyes[i][0],   ec = col + eyes[i][1];
        if (!board.isInBoard(nr, nc)) continue;
        if (side === 'red' && nr < RIVER.redMin) continue;
        if (side === 'black' && nr > RIVER.blackMax) continue;
        if (board.getPiece(er, ec)) continue;
        if (canMoveTo(board, nr, nc, side)) {
            moves.push({ toRow: nr, toCol: nc });
        }
    }
    return moves;
}

function horseMoves(board, row, col, side) {
    const moves = [];
    const moveDeltas = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2],  [1, 2],  [2, -1],  [2, 1]
    ];
    const legDeltas = [
        [-1, 0], [-1, 0], [0, -1], [0, 1],
        [0, -1], [0, 1],  [1, 0],  [1, 0]
    ];
    for (let i = 0; i < 8; i++) {
        const nr = row + moveDeltas[i][0], nc = col + moveDeltas[i][1];
        const lr = row + legDeltas[i][0],  lc = col + legDeltas[i][1];
        if (!board.isInBoard(nr, nc)) continue;
        if (board.getPiece(lr, lc)) continue;
        if (canMoveTo(board, nr, nc, side)) {
            moves.push({ toRow: nr, toCol: nc });
        }
    }
    return moves;
}

function rookMoves(board, row, col, side) {
    const moves = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
        let nr = row + dr, nc = col + dc;
        while (board.isInBoard(nr, nc)) {
            const target = board.getPiece(nr, nc);
            if (!target) {
                moves.push({ toRow: nr, toCol: nc });
            } else {
                if (target.side !== side) {
                    moves.push({ toRow: nr, toCol: nc });
                }
                break;
            }
            nr += dr;
            nc += dc;
        }
    }
    return moves;
}

function cannonMoves(board, row, col, side) {
    const moves = [];
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (const [dr, dc] of directions) {
        let nr = row + dr, nc = col + dc;
        let jumped = false;
        while (board.isInBoard(nr, nc)) {
            const target = board.getPiece(nr, nc);
            if (!jumped) {
                if (!target) {
                    moves.push({ toRow: nr, toCol: nc });
                } else {
                    jumped = true;
                }
            } else {
                if (target) {
                    if (target.side !== side) {
                        moves.push({ toRow: nr, toCol: nc });
                    }
                    break;
                }
            }
            nr += dr;
            nc += dc;
        }
    }
    return moves;
}

function pawnMoves(board, row, col, side) {
    const moves = [];
    const forward = side === 'red' ? -1 : 1;
    const crossed = board.hasCrossedRiver(row, side);
    const nr = row + forward;
    if (board.isInBoard(nr, col) && canMoveTo(board, nr, col, side)) {
        moves.push({ toRow: nr, toCol: col });
    }
    if (crossed) {
        for (const dc of [-1, 1]) {
            const nc = col + dc;
            if (board.isInBoard(row, nc) && canMoveTo(board, row, nc, side)) {
                moves.push({ toRow: row, toCol: nc });
            }
        }
    }
    return moves;
}
