export const PORT = process.env.PORT || 3000;
export const JWT_SECRET = process.env.JWT_SECRET || 'chinese-chess-secret-key-change-in-production';
export const DB_PATH = process.env.DB_PATH || './data/chess.db';
export const RECONNECT_TIMEOUT = 30000; // 30 seconds
export const INITIAL_ELO = 1200;
export const ELO_K_FACTOR = 32;
export const MAX_CHAT_LENGTH = 200;
