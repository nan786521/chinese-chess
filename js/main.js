import { Game } from './game.js';
import { Board } from './board.js';
import { AIEngine } from './ai.js';
import { UI } from './ui.js';
import { Network } from './network.js';

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    const board = game.board;
    const aiEngine = new AIEngine();
    const network = new Network();
    const ui = new UI(game, board, aiEngine, network);
    ui.init();

    // Check for existing token
    const token = localStorage.getItem('chess-token');
    if (token) {
        network.token = token;
        // Try to connect and show lobby
        network.connect(token);
        // Fetch profile to validate token
        network.fetchProfile().then(data => {
            ui.currentUser = data;
            ui.updateLobbyInfo();
            ui.showLobby();
        }).catch(() => {
            // Token invalid, show login
            network.logout();
            ui.showLogin();
        });
    } else {
        ui.showLogin();
    }
});
