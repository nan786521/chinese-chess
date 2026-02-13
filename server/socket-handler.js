import { MAX_CHAT_LENGTH } from './config.js';
import { finishGame } from './leaderboard.js';

export function setupSocketHandlers(io, socket, roomManager, gameManager) {
    const user = {
        userId: socket.user.userId,
        username: socket.user.username,
        socketId: socket.id
    };

    console.log(`Connected: ${user.username} (${socket.id})`);

    // Check for active game (reconnect)
    const activeGame = gameManager.getGameByUser(user.userId);
    if (activeGame) {
        const roomCode = activeGame.roomCode;
        const room = roomManager.getRoom(roomCode);
        if (room) {
            socket.join(roomCode);
            roomManager.updateSocketId(user.userId, socket.id);
            const reconnected = gameManager.handleReconnect(activeGame.id, user.userId);
            if (reconnected) {
                const state = gameManager.getGameState(activeGame.id);
                const mySide = activeGame.redPlayer.userId === user.userId ? 'red' : 'black';
                socket.emit('game:start', {
                    gameId: activeGame.id,
                    redPlayer: activeGame.redPlayer.username,
                    blackPlayer: activeGame.blackPlayer.username,
                    yourSide: mySide
                });
                socket.emit('game:state', state);
                socket.to(roomCode).emit('game:opponent-reconnected');
            }
        }
    }

    // === Room Events ===

    socket.on('room:create', ({ hostSide }) => {
        const room = roomManager.createRoom(user, hostSide || 'red');
        socket.join(room.code);
        socket.emit('room:created', { code: room.code, hostSide: room.hostSide });
    });

    socket.on('room:join', ({ code }) => {
        const result = roomManager.joinRoom(code, user);
        if (result.error) {
            socket.emit('room:error', { message: result.error });
            return;
        }

        const room = result.room;
        socket.join(code);
        io.to(code).emit('room:joined', {
            code,
            host: room.host.username,
            guest: room.guest.username,
            hostSide: room.hostSide
        });

        // Start game
        startGame(io, room, roomManager, gameManager);
    });

    socket.on('room:leave', () => {
        const code = roomManager.getUserRoomCode(user.userId);
        if (!code) return;

        const room = roomManager.getRoom(code);
        const result = roomManager.leaveRoom(code, user.userId);
        if (!result) return;

        socket.leave(code);

        if (result.action === 'forfeit' && room?.gameId) {
            const game = gameManager.getGame(room.gameId);
            if (game && game.status === 'active') {
                const resignResult = gameManager.handleResign(room.gameId, user.userId);
                if (resignResult) {
                    const eloChanges = finishGame(game);
                    io.to(code).emit('game:over', {
                        winner: resignResult.winner,
                        reason: 'disconnect',
                        redEloChange: eloChanges?.redEloChange || 0,
                        blackEloChange: eloChanges?.blackEloChange || 0
                    });
                    roomManager.finishRoom(code);
                    gameManager.cleanupGame(room.gameId);
                }
            }
        }

        io.to(code).emit('room:left', { userId: user.userId, username: user.username });
    });

    socket.on('room:list', () => {
        socket.emit('room:list', roomManager.getRoomList());
    });

    socket.on('room:spectate', ({ code }) => {
        const result = roomManager.addSpectator(code, user);
        if (result.error) {
            socket.emit('room:error', { message: result.error });
            return;
        }

        socket.join(code);
        const room = result.room;
        if (room.gameId) {
            const state = gameManager.getGameState(room.gameId);
            if (state) {
                socket.emit('spectate:state', state);
            }
        }
    });

    // === Matchmaking ===

    socket.on('match:find', () => {
        const result = roomManager.findMatch(user);
        if (!result) {
            socket.emit('match:waiting');
            return;
        }

        const { room, opponent } = result;
        socket.join(room.code);

        // Notify opponent
        const oppSocket = io.sockets.sockets.get(opponent.socketId);
        if (oppSocket) {
            oppSocket.join(room.code);
        }

        io.to(room.code).emit('match:found', { code: room.code });
        startGame(io, room, roomManager, gameManager);
    });

    socket.on('match:cancel', () => {
        roomManager.removeFromQueue(user.userId);
    });

    // === Game Events ===

    socket.on('game:move', ({ fromRow, fromCol, toRow, toCol }) => {
        const room = roomManager.getUserRoom(user.userId);
        if (!room || !room.gameId) {
            socket.emit('game:error', { message: '不在遊戲中' });
            return;
        }

        const result = gameManager.processMove(room.gameId, user.userId, fromRow, fromCol, toRow, toCol);
        if (result.error) {
            socket.emit('game:error', { message: result.error });
            return;
        }

        // Broadcast to all in room (players + spectators)
        io.to(room.code).emit('game:moved', result);

        // Also emit spectate event
        io.to(room.code).emit('spectate:moved', result);

        if (result.gameOver) {
            const game = gameManager.getGame(room.gameId);
            const eloChanges = finishGame(game);
            io.to(room.code).emit('game:over', {
                winner: result.winner,
                reason: result.reason,
                redEloChange: eloChanges?.redEloChange || 0,
                blackEloChange: eloChanges?.blackEloChange || 0
            });
            io.to(room.code).emit('spectate:over', {
                winner: result.winner,
                reason: result.reason
            });
            roomManager.finishRoom(room.code);
            gameManager.cleanupGame(room.gameId);
        }
    });

    socket.on('game:resign', () => {
        const room = roomManager.getUserRoom(user.userId);
        if (!room || !room.gameId) return;

        const result = gameManager.handleResign(room.gameId, user.userId);
        if (!result) return;

        const game = gameManager.getGame(room.gameId);
        const eloChanges = finishGame(game);

        io.to(room.code).emit('game:over', {
            winner: result.winner,
            reason: result.reason,
            redEloChange: eloChanges?.redEloChange || 0,
            blackEloChange: eloChanges?.blackEloChange || 0
        });
        roomManager.finishRoom(room.code);
        gameManager.cleanupGame(room.gameId);
    });

    // Draw offer tracking per room
    socket.on('game:draw-offer', () => {
        const room = roomManager.getUserRoom(user.userId);
        if (!room || !room.gameId) return;
        socket.to(room.code).emit('game:draw-offered', { from: user.username });
    });

    socket.on('game:draw-respond', ({ accept }) => {
        const room = roomManager.getUserRoom(user.userId);
        if (!room || !room.gameId) return;

        if (accept) {
            const result = gameManager.handleDraw(room.gameId);
            if (!result) return;

            const game = gameManager.getGame(room.gameId);
            const eloChanges = finishGame(game);

            io.to(room.code).emit('game:over', {
                winner: null,
                reason: 'draw',
                redEloChange: eloChanges?.redEloChange || 0,
                blackEloChange: eloChanges?.blackEloChange || 0
            });
            roomManager.finishRoom(room.code);
            gameManager.cleanupGame(room.gameId);
        } else {
            socket.to(room.code).emit('game:draw-declined');
        }
    });

    // === Chat ===

    socket.on('chat:message', ({ text }) => {
        if (!text || text.length > MAX_CHAT_LENGTH) return;
        const room = roomManager.getUserRoom(user.userId);
        if (!room) return;

        io.to(room.code).emit('chat:message', {
            from: user.username,
            text: text.trim(),
            timestamp: Date.now()
        });
    });

    // === Disconnect ===

    socket.on('disconnect', () => {
        console.log(`Disconnected: ${user.username} (${socket.id})`);

        // Remove from matchmaking queue
        roomManager.removeFromQueue(user.userId);

        // Handle active game disconnect
        const room = roomManager.getUserRoom(user.userId);
        if (room && room.gameId) {
            const game = gameManager.getGame(room.gameId);
            if (game && game.status === 'active') {
                const timeout = gameManager.handleDisconnect(room.gameId, user.userId);
                socket.to(room.code).emit('game:opponent-disconnected', { timeout });

                // Set up callback for timeout
                // The timeout handler in gameManager will be called automatically
                const checkTimeout = setInterval(() => {
                    const g = gameManager.getGame(room.gameId);
                    if (!g || g.status === 'finished') {
                        clearInterval(checkTimeout);
                        if (g && g.reason === 'disconnect') {
                            const eloChanges = finishGame(g);
                            io.to(room.code).emit('game:over', {
                                winner: g.winner,
                                reason: 'disconnect',
                                redEloChange: eloChanges?.redEloChange || 0,
                                blackEloChange: eloChanges?.blackEloChange || 0
                            });
                            roomManager.finishRoom(room.code);
                            gameManager.cleanupGame(room.gameId);
                        }
                    }
                }, 1000);

                // Clean up the interval after reconnect timeout + buffer
                setTimeout(() => clearInterval(checkTimeout), 35000);
            }
        }
    });
}

function startGame(io, room, roomManager, gameManager) {
    // Determine who is red and black
    const redPlayer = room.hostSide === 'red' ? room.host : room.guest;
    const blackPlayer = room.hostSide === 'red' ? room.guest : room.host;

    const game = gameManager.createGame(room.code, redPlayer, blackPlayer);
    roomManager.setGameId(room.code, game.id);

    // Notify each player of their side
    const hostSocket = io.sockets.sockets.get(room.host.socketId);
    const guestSocket = io.sockets.sockets.get(room.guest.socketId);

    const gameData = {
        gameId: game.id,
        redPlayer: redPlayer.username,
        blackPlayer: blackPlayer.username
    };

    if (hostSocket) {
        hostSocket.emit('game:start', { ...gameData, yourSide: room.hostSide });
    }
    if (guestSocket) {
        guestSocket.emit('game:start', {
            ...gameData,
            yourSide: room.hostSide === 'red' ? 'black' : 'red'
        });
    }
}
