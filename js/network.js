const FETCH_TIMEOUT = 10000; // 10 seconds

function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
    return fetch(url, { ...options, signal: controller.signal })
        .finally(() => clearTimeout(id));
}

export class Network {
    constructor() {
        this.socket = null;
        this.token = null;
        this.listeners = {};
    }

    // Simple event emitter
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    }

    _emit(event, data) {
        if (this.listeners[event]) {
            for (const cb of this.listeners[event]) cb(data);
        }
    }

    // --- HTTP Auth ---

    async register(username, password) {
        const res = await fetchWithTimeout('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '註冊失敗');
        this.token = data.token;
        localStorage.setItem('chess-token', data.token);
        return data;
    }

    async login(username, password) {
        const res = await fetchWithTimeout('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '登入失敗');
        this.token = data.token;
        localStorage.setItem('chess-token', data.token);
        return data;
    }

    async fetchProfile() {
        const res = await fetchWithTimeout('/api/profile', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) throw new Error('無法取得個人資料');
        return await res.json();
    }

    async fetchLeaderboard() {
        const res = await fetchWithTimeout('/api/leaderboard');
        if (!res.ok) throw new Error('無法取得排行榜');
        return await res.json();
    }

    async fetchHistory() {
        const res = await fetchWithTimeout('/api/history', {
            headers: { 'Authorization': `Bearer ${this.token}` }
        });
        if (!res.ok) throw new Error('無法取得對局紀錄');
        return await res.json();
    }

    logout() {
        this.token = null;
        localStorage.removeItem('chess-token');
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }

    // --- Socket.IO Connection ---

    connect(token) {
        if (this.socket) this.socket.disconnect();
        this.token = token || this.token;

        // eslint-disable-next-line no-undef
        this.socket = io({
            auth: { token: this.token },
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: 5,
        });

        this.socket.on('connect', () => this._emit('connected'));
        this.socket.on('disconnect', () => this._emit('disconnected'));
        this.socket.on('connect_error', (err) => this._emit('connectError', err));

        // Room events
        this.socket.on('room:created', (d) => this._emit('roomCreated', d));
        this.socket.on('room:joined', (d) => this._emit('roomJoined', d));
        this.socket.on('room:left', (d) => this._emit('roomLeft', d));
        this.socket.on('room:list', (d) => this._emit('roomList', d));
        this.socket.on('room:error', (d) => this._emit('roomError', d));

        // Matchmaking
        this.socket.on('match:waiting', () => this._emit('matchWaiting'));
        this.socket.on('match:found', (d) => this._emit('matchFound', d));

        // Game events
        this.socket.on('game:start', (d) => this._emit('gameStart', d));
        this.socket.on('game:moved', (d) => this._emit('gameMoved', d));
        this.socket.on('game:over', (d) => this._emit('gameOver', d));
        this.socket.on('game:error', (d) => this._emit('gameError', d));
        this.socket.on('game:state', (d) => this._emit('gameState', d));
        this.socket.on('game:opponent-disconnected', (d) => this._emit('opponentDisconnected', d));
        this.socket.on('game:opponent-reconnected', () => this._emit('opponentReconnected'));
        this.socket.on('game:draw-offered', (d) => this._emit('drawOffered', d));
        this.socket.on('game:draw-declined', () => this._emit('drawDeclined'));

        // Chat
        this.socket.on('chat:message', (d) => this._emit('chatMessage', d));

        // Spectate
        this.socket.on('spectate:state', (d) => this._emit('spectateState', d));
        this.socket.on('spectate:moved', (d) => this._emit('spectateMoved', d));
        this.socket.on('spectate:over', (d) => this._emit('spectateOver', d));
    }

    // --- Outbound Socket Events ---

    createRoom(hostSide) { this.socket?.emit('room:create', { hostSide }); }
    joinRoom(code) { this.socket?.emit('room:join', { code: code.toUpperCase() }); }
    leaveRoom() { this.socket?.emit('room:leave'); }
    requestRoomList() { this.socket?.emit('room:list'); }

    findMatch() { this.socket?.emit('match:find'); }
    cancelMatch() { this.socket?.emit('match:cancel'); }

    sendMove(fromRow, fromCol, toRow, toCol) {
        this.socket?.emit('game:move', { fromRow, fromCol, toRow, toCol });
    }
    resign() { this.socket?.emit('game:resign'); }
    offerDraw() { this.socket?.emit('game:draw-offer'); }
    respondDraw(accept) { this.socket?.emit('game:draw-respond', { accept }); }

    sendChat(text) { this.socket?.emit('chat:message', { text }); }
    spectate(code) { this.socket?.emit('room:spectate', { code }); }
}
