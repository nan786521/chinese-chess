export class RoomManager {
    constructor() {
        this.rooms = new Map();        // code -> RoomState
        this.matchQueue = [];          // [{userId, username, socketId}]
        this.userRooms = new Map();    // userId -> roomCode
    }

    generateCode() {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let code;
        do {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += chars[Math.floor(Math.random() * chars.length)];
            }
        } while (this.rooms.has(code));
        return code;
    }

    createRoom(user, hostSide = 'red') {
        // Remove user from any existing room
        this.leaveCurrentRoom(user.userId);

        const code = this.generateCode();
        const room = {
            code,
            host: { userId: user.userId, username: user.username, socketId: user.socketId },
            guest: null,
            hostSide: hostSide,
            status: 'waiting',
            spectators: new Map(),
            gameId: null,
            createdAt: new Date()
        };
        this.rooms.set(code, room);
        this.userRooms.set(user.userId, code);
        return room;
    }

    joinRoom(code, user) {
        const room = this.rooms.get(code);
        if (!room) return { error: '房間不存在' };
        if (room.status !== 'waiting') return { error: '房間已在對弈中' };
        if (room.host.userId === user.userId) return { error: '不能加入自己的房間' };
        if (room.guest) return { error: '房間已滿' };

        this.leaveCurrentRoom(user.userId);

        room.guest = { userId: user.userId, username: user.username, socketId: user.socketId };
        room.status = 'playing';
        this.userRooms.set(user.userId, code);
        return { room };
    }

    leaveRoom(code, userId) {
        const room = this.rooms.get(code);
        if (!room) return null;

        this.userRooms.delete(userId);

        if (room.host.userId === userId) {
            if (room.guest) {
                // Transfer host
                room.host = room.guest;
                room.guest = null;
                room.status = 'waiting';
                room.hostSide = room.hostSide === 'red' ? 'black' : 'red';
                return { action: 'transferred', room };
            } else {
                this.rooms.delete(code);
                return { action: 'deleted' };
            }
        } else if (room.guest?.userId === userId) {
            room.guest = null;
            if (room.status === 'playing') {
                return { action: 'forfeit', room, forfeitUserId: userId };
            }
            room.status = 'waiting';
            return { action: 'left', room };
        }

        // Spectator
        room.spectators.delete(userId);
        return { action: 'spectator-left' };
    }

    leaveCurrentRoom(userId) {
        const code = this.userRooms.get(userId);
        if (code) {
            this.leaveRoom(code, userId);
        }
    }

    addSpectator(code, user) {
        const room = this.rooms.get(code);
        if (!room) return { error: '房間不存在' };
        if (room.status !== 'playing') return { error: '尚未開始對弈' };
        room.spectators.set(user.userId, { userId: user.userId, username: user.username, socketId: user.socketId });
        return { room };
    }

    getRoomList() {
        const list = [];
        for (const room of this.rooms.values()) {
            if (room.status === 'waiting') {
                list.push({
                    code: room.code,
                    hostName: room.host.username,
                    hostSide: room.hostSide,
                    createdAt: room.createdAt
                });
            }
        }
        return list;
    }

    getRoom(code) {
        return this.rooms.get(code);
    }

    getUserRoom(userId) {
        const code = this.userRooms.get(userId);
        return code ? this.rooms.get(code) : null;
    }

    getUserRoomCode(userId) {
        return this.userRooms.get(userId);
    }

    setGameId(code, gameId) {
        const room = this.rooms.get(code);
        if (room) room.gameId = gameId;
    }

    finishRoom(code) {
        const room = this.rooms.get(code);
        if (room) {
            room.status = 'finished';
            this.userRooms.delete(room.host.userId);
            if (room.guest) this.userRooms.delete(room.guest.userId);
            // Clean up after a delay
            setTimeout(() => this.rooms.delete(code), 60000);
        }
    }

    // Update socket ID (for reconnect)
    updateSocketId(userId, newSocketId) {
        const code = this.userRooms.get(userId);
        if (!code) return;
        const room = this.rooms.get(code);
        if (!room) return;
        if (room.host.userId === userId) room.host.socketId = newSocketId;
        if (room.guest?.userId === userId) room.guest.socketId = newSocketId;
    }

    // Matchmaking
    addToQueue(user) {
        // Remove if already in queue
        this.removeFromQueue(user.userId);
        this.matchQueue.push({ userId: user.userId, username: user.username, socketId: user.socketId });
    }

    removeFromQueue(userId) {
        this.matchQueue = this.matchQueue.filter(u => u.userId !== userId);
    }

    findMatch(user) {
        // Remove self from queue first
        this.removeFromQueue(user.userId);

        if (this.matchQueue.length === 0) {
            this.addToQueue(user);
            return null; // No match found, added to queue
        }

        // Match with first person in queue
        const opponent = this.matchQueue.shift();

        // Create a room for them
        const room = this.createRoom(
            { userId: opponent.userId, username: opponent.username, socketId: opponent.socketId },
            Math.random() < 0.5 ? 'red' : 'black'
        );
        const joinResult = this.joinRoom(room.code, { userId: user.userId, username: user.username, socketId: user.socketId });

        return { room: joinResult.room, opponent };
    }
}
