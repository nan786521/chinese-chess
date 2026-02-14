import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { DB_PATH, INITIAL_ELO } from './config.js';

let db;
let saveTimer = null;

function saveToDisk() {
    if (!db) return;
    const data = db.export();
    const buffer = Buffer.from(data);
    writeFileSync(DB_PATH, buffer);
}

function scheduleSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
        saveToDisk();
        saveTimer = null;
    }, 1000);
}

export async function initDB() {
    const SQL = await initSqlJs();
    mkdirSync(dirname(DB_PATH), { recursive: true });

    if (existsSync(DB_PATH)) {
        const fileBuffer = readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            elo INTEGER DEFAULT ${INITIAL_ELO},
            wins INTEGER DEFAULT 0,
            losses INTEGER DEFAULT 0,
            draws INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS games (
            id TEXT PRIMARY KEY,
            red_user_id INTEGER NOT NULL,
            black_user_id INTEGER NOT NULL,
            winner_side TEXT,
            reason TEXT NOT NULL,
            move_count INTEGER NOT NULL,
            move_history TEXT NOT NULL,
            red_elo_change INTEGER DEFAULT 0,
            black_elo_change INTEGER DEFAULT 0,
            started_at DATETIME NOT NULL,
            finished_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Indexes for game history queries
    db.run('CREATE INDEX IF NOT EXISTS idx_games_red ON games(red_user_id)');
    db.run('CREATE INDEX IF NOT EXISTS idx_games_black ON games(black_user_id)');

    saveToDisk();

    // Save on exit
    process.on('exit', saveToDisk);
    process.on('SIGINT', () => { saveToDisk(); process.exit(); });
    process.on('SIGTERM', () => { saveToDisk(); process.exit(); });

    return db;
}

export function getDB() { return db; }

function getOne(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    if (stmt.step()) {
        const cols = stmt.getColumnNames();
        const values = stmt.get();
        stmt.free();
        const row = {};
        cols.forEach((col, i) => { row[col] = values[i]; });
        return row;
    }
    stmt.free();
    return null;
}

function getAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    const cols = stmt.getColumnNames();
    while (stmt.step()) {
        const values = stmt.get();
        const row = {};
        cols.forEach((col, i) => { row[col] = values[i]; });
        rows.push(row);
    }
    stmt.free();
    return rows;
}

export function getUser(username) {
    return getOne('SELECT * FROM users WHERE username = ?', [username]);
}

export function getUserById(id) {
    return getOne('SELECT id, username, elo, wins, losses, draws, created_at FROM users WHERE id = ?', [id]);
}

export function createUser(username, passwordHash) {
    db.run('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, passwordHash]);
    const row = getOne('SELECT last_insert_rowid() as id');
    scheduleSave();
    return row.id;
}

export function updateUserStats(userId, eloChange, result) {
    const field = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';
    db.run(`UPDATE users SET elo = MAX(0, elo + ?), ${field} = ${field} + 1 WHERE id = ?`, [eloChange, userId]);
    scheduleSave();
}

export function saveGame(game) {
    db.run(
        `INSERT INTO games (id, red_user_id, black_user_id, winner_side, reason, move_count, move_history, red_elo_change, black_elo_change, started_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [game.id, game.redUserId, game.blackUserId, game.winnerSide, game.reason, game.moveCount, JSON.stringify(game.moveHistory), game.redEloChange, game.blackEloChange, game.startedAt]
    );
    scheduleSave();
}

export function getGameHistory(userId, limit = 20) {
    return getAll(
        `SELECT g.*, ru.username as red_user, bu.username as black_user
         FROM games g
         JOIN users ru ON g.red_user_id = ru.id
         JOIN users bu ON g.black_user_id = bu.id
         WHERE g.red_user_id = ? OR g.black_user_id = ?
         ORDER BY g.finished_at DESC
         LIMIT ?`,
        [userId, userId, limit]
    );
}

export function getLeaderboard(limit = 50) {
    return getAll(
        'SELECT username, elo, wins, losses, draws FROM users ORDER BY elo DESC LIMIT ?',
        [limit]
    );
}
