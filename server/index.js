import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { PORT } from './config.js';
import { initDB } from './db.js';
import { setupAuthRoutes, authenticateSocket } from './auth.js';
import { RoomManager } from './room-manager.js';
import { GameManager } from './game-manager.js';
import { setupSocketHandlers } from './socket-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const DIST_DIR = join(ROOT_DIR, 'dist');

async function start() {
    // Initialize database
    await initDB();

    // Express app
    const app = express();
    const server = createServer(app);

    // Middleware
    app.use(express.json());

    // Static files: serve from dist/ if built, otherwise from root
    const staticDir = existsSync(DIST_DIR) ? DIST_DIR : ROOT_DIR;
    app.use(express.static(staticDir));

    // Health check (for Koyeb / cloud platforms)
    app.get('/health', (_req, res) => res.json({ status: 'ok' }));

    // Auth routes
    setupAuthRoutes(app);

    // Socket.IO
    const io = new Server(server, {
        cors: { origin: '*' }
    });

    io.use(authenticateSocket);

    const roomManager = new RoomManager();
    const gameManager = new GameManager();

    io.on('connection', (socket) => {
        setupSocketHandlers(io, socket, roomManager, gameManager);
    });

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`中國象棋伺服器已啟動: http://localhost:${PORT}`);
    });
}

start().catch(err => {
    console.error('啟動失敗:', err);
    process.exit(1);
});
