// Web Worker for AI computation — keeps the main thread responsive
import { AIEngine } from './ai.js';
import { BoardLogic } from '../shared/board-logic.js';
import { DarkChessAI } from './dark-chess/dark-ai.js';
import { DarkBoardLogic } from '../shared/dark-chess/dark-board-logic.js';

const aiEngine = new AIEngine();
const darkAI = new DarkChessAI();

self.onmessage = function (e) {
    const { type, data } = e.data;

    if (type === 'findBestMove') {
        const board = new BoardLogic();
        board.fromJSON(data.grid);
        aiEngine.setDifficulty(data.difficulty);
        const move = aiEngine.findBestMove(board, data.side);
        self.postMessage({ type: 'bestMove', move });
    } else if (type === 'findDarkChessAction') {
        const board = new DarkBoardLogic();
        board.fromJSON(data.grid);
        darkAI.setDifficulty(data.difficulty);
        const action = darkAI.findBestAction(board, data.side, data.movesSinceCapture);
        self.postMessage({ type: 'darkChessAction', action });
    }
};
