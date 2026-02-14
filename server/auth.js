import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from './config.js';
import { getUser, getUserById, createUser, getLeaderboard, getGameHistory } from './db.js';

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d';

// Simple in-memory rate limiter for auth endpoints
const rateLimitMap = new Map(); // ip -> { count, resetTime }
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const RATE_LIMIT_MAX = 10; // max attempts per window

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return next();
    }

    entry.count++;
    if (entry.count > RATE_LIMIT_MAX) {
        return res.status(429).json({ error: '請求過於頻繁，請稍後再試' });
    }
    next();
}

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetTime) rateLimitMap.delete(ip);
    }
}, 300000);

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
    app.post('/api/register', rateLimit, async (req, res) => {
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
            if (password.length < 8) {
                return res.status(400).json({ error: '密碼至少需要 8 個字元' });
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

    app.post('/api/login', rateLimit, async (req, res) => {
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
