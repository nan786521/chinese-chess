import { ELO_K_FACTOR } from './config.js';
import { updateUserStats, getUserById, saveGame } from './db.js';

export function calculateEloChange(playerElo, opponentElo, actualScore) {
    // actualScore: 1 = win, 0 = loss, 0.5 = draw
    const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
    return Math.round(ELO_K_FACTOR * (actualScore - expectedScore));
}

export function finishGame(game) {
    const redUser = getUserById(game.redPlayer.userId);
    const blackUser = getUserById(game.blackPlayer.userId);
    if (!redUser || !blackUser) return null;

    let redEloChange = 0;
    let blackEloChange = 0;

    if (game.reason === 'draw') {
        redEloChange = calculateEloChange(redUser.elo, blackUser.elo, 0.5);
        blackEloChange = calculateEloChange(blackUser.elo, redUser.elo, 0.5);
        updateUserStats(redUser.id, redEloChange, 'draw');
        updateUserStats(blackUser.id, blackEloChange, 'draw');
    } else if (game.winner === 'red') {
        redEloChange = calculateEloChange(redUser.elo, blackUser.elo, 1);
        blackEloChange = calculateEloChange(blackUser.elo, redUser.elo, 0);
        updateUserStats(redUser.id, redEloChange, 'win');
        updateUserStats(blackUser.id, blackEloChange, 'loss');
    } else if (game.winner === 'black') {
        redEloChange = calculateEloChange(redUser.elo, blackUser.elo, 0);
        blackEloChange = calculateEloChange(blackUser.elo, redUser.elo, 1);
        updateUserStats(redUser.id, redEloChange, 'loss');
        updateUserStats(blackUser.id, blackEloChange, 'win');
    }

    // Save game record
    saveGame({
        id: game.id,
        redUserId: game.redPlayer.userId,
        blackUserId: game.blackPlayer.userId,
        winnerSide: game.winner,
        reason: game.reason,
        moveCount: game.moveCount,
        moveHistory: game.moveHistory,
        redEloChange,
        blackEloChange,
        startedAt: game.startedAt
    });

    return { redEloChange, blackEloChange };
}
