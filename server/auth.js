import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';
import { getUser, getUserById, createUser, getLeaderboard, getGameHistory } from './db.js';

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

function generateToken(user) {
    return jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch {
        return null;
    }
}

function authenticateHTTP(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: '未授權' });
    }
    const payload = verifyToken(authHeader.slice(7));
    if (!payload) {
        return res.status(401).json({ error: '令牌無效或已過期' });
    }
    req.user = payload;
    next();
}

export function setupAuthRoutes(app) {
    app.post('/api/register', async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: '請輸入用戶名和密碼' });
            }
            if (username.length < 2 || username.length > 20) {
                return res.status(400).json({ error: '用戶名須為 2-20 字元' });
            }
            if (!/^[a-zA-Z0-9_\u4e00-\u9fff]+$/.test(username)) {
                return res.status(400).json({ error: '用戶名只能包含字母、數字、底線或中文' });
            }
            if (password.length < 4) {
                return res.status(400).json({ error: '密碼至少需要 4 個字元' });
            }

            if (getUser(username)) {
                return res.status(409).json({ error: '此用戶名已被使用' });
            }

            const hash = await bcrypt.hash(password, SALT_ROUNDS);
            const userId = createUser(username, hash);
            const user = getUserById(userId);
            const token = generateToken(user);
            res.json({ token, user: { id: user.id, username: user.username, elo: user.elo } });
        } catch (err) {
            console.error('Register error:', err);
            res.status(500).json({ error: '伺服器錯誤' });
        }
    });

    app.post('/api/login', async (req, res) => {
        try {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: '請輸入用戶名和密碼' });
            }

            const user = getUser(username);
            if (!user) {
                return res.status(401).json({ error: '用戶名或密碼錯誤' });
            }

            const valid = await bcrypt.compare(password, user.password_hash);
            if (!valid) {
                return res.status(401).json({ error: '用戶名或密碼錯誤' });
            }

            const token = generateToken(user);
            res.json({ token, user: { id: user.id, username: user.username, elo: user.elo } });
        } catch (err) {
            console.error('Login error:', err);
            res.status(500).json({ error: '伺服器錯誤' });
        }
    });

    app.get('/api/profile', authenticateHTTP, (req, res) => {
        const user = getUserById(req.user.userId);
        if (!user) return res.status(404).json({ error: '找不到用戶' });
        res.json(user);
    });

    app.get('/api/leaderboard', (_req, res) => {
        res.json(getLeaderboard());
    });

    app.get('/api/history', authenticateHTTP, (req, res) => {
        res.json(getGameHistory(req.user.userId));
    });
}

export function authenticateSocket(socket, next) {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('未授權'));
    const payload = verifyToken(token);
    if (!payload) return next(new Error('令牌無效或已過期'));
    socket.user = payload;
    next();
}
