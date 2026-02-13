import { RED, BLACK, PIECE_CHARS } from '../shared/constants.js';
import { DarkChessGame } from './dark-chess/dark-game.js';
import { DarkChessAI } from './dark-chess/dark-ai.js';

export class UI {
    constructor(game, board, aiEngine, network) {
        this.game = game;
        this.board = board;
        this.aiEngine = aiEngine;
        this.network = network;
        this.el = {};
        this.aiMode = { side: RED, difficulty: 'medium' };
        this.currentUser = null;
        this.isSpectating = false;
        this.isTurnPaused = false;
        this.capturedByRed = [];   // black pieces captured by red
        this.capturedByBlack = []; // red pieces captured by black
        // Dark chess
        this.isDarkChessMode = false;
        this.darkGame = null;
        this.darkAI = new DarkChessAI();
        this.dcDifficulty = 'medium';
        // Timeout tracking
        this._turnTimeout = null;
        this._disconnectInterval = null;
    }

    clearPendingTimeouts() {
        if (this._turnTimeout) {
            clearTimeout(this._turnTimeout);
            this._turnTimeout = null;
        }
    }

    showToast(message) {
        // Use statusText area for toast-like messages
        this.el.statusText.textContent = message;
        this.el.statusText.className = 'check';
        setTimeout(() => {
            if (this.el.statusText.textContent === message) {
                this.el.statusText.textContent = '';
                this.el.statusText.className = '';
            }
        }, 3000);
    }

    init() {
        this.el = {
            // Screens
            loginScreen: document.getElementById('login-screen'),
            lobbyScreen: document.getElementById('lobby-screen'),
            menuScreen: document.getElementById('menu-screen'),
            waitingScreen: document.getElementById('waiting-screen'),
            gameScreen: document.getElementById('game-screen'),
            // Login
            authUsername: document.getElementById('auth-username'),
            authPassword: document.getElementById('auth-password'),
            authError: document.getElementById('auth-error'),
            btnLogin: document.getElementById('btn-login'),
            btnRegister: document.getElementById('btn-register'),
            btnOffline: document.getElementById('btn-offline'),
            // Lobby
            lobbyUsername: document.getElementById('lobby-username'),
            lobbyElo: document.getElementById('lobby-elo'),
            btnLogout: document.getElementById('btn-logout'),
            btnCreateRoom: document.getElementById('btn-create-room'),
            roomCodeInput: document.getElementById('room-code-input'),
            btnJoinRoom: document.getElementById('btn-join-room'),
            btnQuickMatch: document.getElementById('btn-quick-match'),
            btnOfflineMode: document.getElementById('btn-offline-mode'),
            roomList: document.getElementById('room-list'),
            btnLeaderboard: document.getElementById('btn-leaderboard'),
            btnHistory: document.getElementById('btn-history'),
            // Waiting
            waitingRoomCode: document.getElementById('waiting-room-code'),
            btnCancelWait: document.getElementById('btn-cancel-wait'),
            // Game
            chessBoard: document.getElementById('chess-board'),
            statusText: document.getElementById('game-status'),
            moveHistory: document.getElementById('move-history'),
            currentPlayer: document.getElementById('current-player'),
            playerDot: document.getElementById('player-dot'),
            moveCount: document.getElementById('move-count'),
            opponentInfo: document.getElementById('opponent-info'),
            // Game buttons
            btnUndo: document.getElementById('btn-undo'),
            btnNewGame: document.getElementById('btn-new-game'),
            btnBack: document.getElementById('btn-back'),
            btnResign: document.getElementById('btn-resign'),
            btnDrawOffer: document.getElementById('btn-draw-offer'),
            // Chat
            chatPanel: document.getElementById('chat-panel'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            btnSendChat: document.getElementById('btn-send-chat'),
            // Modals
            modal: document.getElementById('game-over-modal'),
            modalTitle: document.getElementById('modal-title'),
            modalMessage: document.getElementById('modal-message'),
            modalNewGame: document.getElementById('modal-new-game'),
            modalBack: document.getElementById('modal-back'),
            leaderboardModal: document.getElementById('leaderboard-modal'),
            leaderboardTable: document.getElementById('leaderboard-table'),
            btnCloseLeaderboard: document.getElementById('btn-close-leaderboard'),
            // Offline menu
            btnPvp: document.getElementById('btn-pvp'),
            btnPva: document.getElementById('btn-pva'),
            btnStartAi: document.getElementById('btn-start-ai'),
            sideSelector: document.getElementById('side-selector'),
            diffSelector: document.getElementById('difficulty-selector'),
            btnBackToLobby: document.getElementById('btn-back-to-lobby'),
            // Disconnect overlay
            disconnectOverlay: document.getElementById('disconnect-overlay'),
            disconnectTimer: document.getElementById('disconnect-timer'),
            // Captured panels
            capturedLeft: document.getElementById('captured-left'),
            capturedRight: document.getElementById('captured-right'),
            // Draw offer modal
            drawOfferModal: document.getElementById('draw-offer-modal'),
            btnAcceptDraw: document.getElementById('btn-accept-draw'),
            btnDeclineDraw: document.getElementById('btn-decline-draw'),
            // Dark chess menu
            btnDcPvp: document.getElementById('btn-dc-pvp'),
            btnDcPva: document.getElementById('btn-dc-pva'),
            btnDcStartAi: document.getElementById('btn-dc-start-ai'),
            dcDiffSelector: document.getElementById('dc-difficulty-selector'),
        };

        this.board.createBoardDOM(this.el.chessBoard);
        this.board.onCellClick = (row, col) => this.onCellClick(row, col);
        this.game.onSendMove = (fr, fc, tr, tc) => this.network.sendMove(fr, fc, tr, tc);

        this.bindLoginEvents();
        this.bindLobbyEvents();
        this.bindOfflineMenuEvents();
        this.bindGameEvents();
        this.bindNetworkEvents();
        this.bindChatEvents();
    }

    // === Screen Management ===

    hideAllScreens() {
        [this.el.loginScreen, this.el.lobbyScreen, this.el.menuScreen,
         this.el.waitingScreen, this.el.gameScreen].forEach(s => {
            if (s) s.style.display = 'none';
        });
        this.el.gameScreen?.classList.remove('active');
    }

    showLogin() {
        this.hideAllScreens();
        this.el.loginScreen.style.display = '';
    }

    showLobby() {
        this.hideAllScreens();
        this.el.lobbyScreen.style.display = '';
        this.network.requestRoomList();
    }

    showOfflineMenu() {
        this.hideAllScreens();
        this.el.menuScreen.style.display = '';
    }

    showWaiting(roomCode) {
        this.hideAllScreens();
        this.el.waitingScreen.style.display = '';
        this.el.waitingRoomCode.textContent = roomCode;
    }

    showGame() {
        this.hideAllScreens();
        this.el.gameScreen.style.display = '';
        this.el.gameScreen.classList.add('active');
        // Toggle dark-chess class on both game screen and app container
        const appContainer = document.getElementById('app-container');
        if (this.isDarkChessMode) {
            this.el.gameScreen.classList.add('dark-chess');
            appContainer.classList.add('dark-chess');
        } else {
            this.el.gameScreen.classList.remove('dark-chess');
            appContainer.classList.remove('dark-chess');
        }
    }

    // === Login Events ===

    bindLoginEvents() {
        this.el.btnLogin?.addEventListener('click', () => this.doAuth('login'));
        this.el.btnRegister?.addEventListener('click', () => this.doAuth('register'));
        this.el.btnOffline?.addEventListener('click', () => this.showOfflineMenu());

        // Enter key on password field
        this.el.authPassword?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.doAuth('login');
        });
    }

    async doAuth(method) {
        const username = this.el.authUsername.value.trim();
        const password = this.el.authPassword.value;
        if (!username || !password) return;
        this.el.authError.textContent = '';
        this.el.btnLogin.disabled = true;
        this.el.btnRegister.disabled = true;
        try {
            const data = await this.network[method](username, password);
            this.currentUser = data.user;
            this.network.connect(data.token);
            this.updateLobbyInfo();
            this.showLobby();
        } catch (err) {
            this.el.authError.textContent = err.message;
        } finally {
            this.el.btnLogin.disabled = false;
            this.el.btnRegister.disabled = false;
        }
    }

    updateLobbyInfo() {
        if (this.currentUser && this.el.lobbyUsername) {
            this.el.lobbyUsername.textContent = this.currentUser.username;
            this.el.lobbyElo.textContent = `ELO: ${this.currentUser.elo}`;
        }
    }

    // === Lobby Events ===

    bindLobbyEvents() {
        this.el.btnLogout?.addEventListener('click', () => {
            this.network.logout();
            this.currentUser = null;
            this.showLogin();
        });

        this.el.btnCreateRoom?.addEventListener('click', () => {
            this.network.createRoom('red');
        });

        this.el.btnJoinRoom?.addEventListener('click', () => {
            const code = this.el.roomCodeInput.value.trim();
            if (code) this.network.joinRoom(code);
        });

        this.el.roomCodeInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const code = this.el.roomCodeInput.value.trim();
                if (code) this.network.joinRoom(code);
            }
        });

        this.el.btnQuickMatch?.addEventListener('click', () => {
            this.network.findMatch();
            this.showWaiting('配對中...');
        });

        this.el.btnOfflineMode?.addEventListener('click', () => this.showOfflineMenu());

        this.el.btnLeaderboard?.addEventListener('click', () => this.showLeaderboard());
        this.el.btnHistory?.addEventListener('click', () => this.showHistory());
        this.el.btnCloseLeaderboard?.addEventListener('click', () => {
            this.el.leaderboardModal.classList.remove('show');
        });

        this.el.btnCancelWait?.addEventListener('click', () => {
            this.network.leaveRoom();
            this.network.cancelMatch();
            this.showLobby();
        });
    }

    async showLeaderboard() {
        try {
            const data = await this.network.fetchLeaderboard();
            const table = document.createElement('table');
            const thead = document.createElement('thead');
            thead.innerHTML = '<tr><th>#</th><th>玩家</th><th>ELO</th><th>勝</th><th>負</th><th>和</th></tr>';
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            for (let i = 0; i < data.length; i++) {
                const u = data[i];
                const tr = document.createElement('tr');
                for (const val of [i + 1, u.username, u.elo, u.wins, u.losses, u.draws]) {
                    const td = document.createElement('td');
                    td.textContent = val;
                    tr.appendChild(td);
                }
                tbody.appendChild(tr);
            }
            table.appendChild(tbody);
            this.el.leaderboardTable.innerHTML = '';
            this.el.leaderboardTable.appendChild(table);
            this.el.leaderboardModal.classList.add('show');
        } catch (err) {
            this.showToast(err.message);
        }
    }

    async showHistory() {
        try {
            const data = await this.network.fetchHistory();
            const container = document.createElement('div');
            const h3 = document.createElement('h3');
            h3.textContent = '對局紀錄';
            container.appendChild(h3);
            if (data.length === 0) {
                const p = document.createElement('p');
                p.textContent = '尚無對局紀錄';
                container.appendChild(p);
            } else {
                const list = document.createElement('div');
                list.className = 'history-list';
                for (const g of data) {
                    const result = g.winner_side === null ? '和棋' :
                        ((g.winner_side === 'red' && g.red_user === this.currentUser.username) ||
                         (g.winner_side === 'black' && g.black_user === this.currentUser.username)) ? '勝' : '負';
                    const cls = result === '勝' ? 'win' : result === '負' ? 'loss' : 'draw';
                    const item = document.createElement('div');
                    item.className = `history-item ${cls}`;
                    const resultSpan = document.createElement('span');
                    resultSpan.className = 'history-result';
                    resultSpan.textContent = result;
                    const playersSpan = document.createElement('span');
                    playersSpan.textContent = `${g.red_user} vs ${g.black_user}`;
                    const infoSpan = document.createElement('span');
                    infoSpan.textContent = `${g.move_count}手 · ${g.reason}`;
                    item.append(resultSpan, playersSpan, infoSpan);
                    list.appendChild(item);
                }
                container.appendChild(list);
            }
            this.el.leaderboardTable.innerHTML = '';
            this.el.leaderboardTable.appendChild(container);
            this.el.leaderboardModal.classList.add('show');
        } catch (err) {
            this.showToast(err.message);
        }
    }

    updateRoomList(rooms) {
        if (!this.el.roomList) return;
        this.el.roomList.innerHTML = '';
        if (rooms.length === 0) {
            const p = document.createElement('p');
            p.className = 'empty-list';
            p.textContent = '目前沒有可加入的房間';
            this.el.roomList.appendChild(p);
            return;
        }
        for (const r of rooms) {
            const card = document.createElement('div');
            card.className = 'room-card';
            const host = document.createElement('span');
            host.className = 'room-host';
            host.textContent = r.hostName;
            const code = document.createElement('span');
            code.className = 'room-code-display';
            code.textContent = r.code;
            const btn = document.createElement('button');
            btn.className = 'ctrl-btn room-join-btn';
            btn.textContent = '加入';
            btn.addEventListener('click', () => this.network.joinRoom(r.code));
            card.append(host, code, btn);
            this.el.roomList.appendChild(card);
        }
    }

    // === Offline Menu Events ===

    bindOfflineMenuEvents() {
        this.el.btnPvp?.addEventListener('click', () => {
            this.isSpectating = false;
            this.game.newGame('pvp', RED, 'medium');
            this.setupGameUI(false);
            this.startLocalGame();
        });

        this.el.btnPva?.addEventListener('click', () => {
            this.el.sideSelector?.classList.toggle('show');
            this.el.diffSelector?.classList.toggle('show');
            this.el.btnStartAi?.classList.toggle('show');
        });

        this.el.sideSelector?.querySelectorAll('.side-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.el.sideSelector.querySelectorAll('.side-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.aiMode.side = btn.dataset.side;
            });
        });

        this.el.diffSelector?.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.el.diffSelector.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.aiMode.difficulty = btn.dataset.diff;
            });
        });

        this.el.btnStartAi?.addEventListener('click', () => {
            this.isSpectating = false;
            this.game.newGame('pva', this.aiMode.side, this.aiMode.difficulty);
            this.aiEngine.setDifficulty(this.aiMode.difficulty);
            this.setupGameUI(false);
            this.startLocalGame();
        });

        this.el.btnBackToLobby?.addEventListener('click', () => {
            if (this.currentUser) {
                this.showLobby();
            } else {
                this.showLogin();
            }
        });

        // Dark chess menu
        this.el.btnDcPvp?.addEventListener('click', () => {
            this.startDarkChessGame('dc-pvp');
        });

        this.el.btnDcPva?.addEventListener('click', () => {
            this.el.dcDiffSelector?.classList.toggle('show');
            this.el.btnDcStartAi?.classList.toggle('show');
        });

        this.el.dcDiffSelector?.querySelectorAll('.diff-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.el.dcDiffSelector.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.dcDifficulty = btn.dataset.diff;
            });
        });

        this.el.btnDcStartAi?.addEventListener('click', () => {
            this.startDarkChessGame('dc-pva');
        });
    }

    setupGameUI(isOnline) {
        // Show/hide buttons based on mode
        if (this.el.btnUndo) this.el.btnUndo.style.display = isOnline ? 'none' : '';
        if (this.el.btnResign) this.el.btnResign.style.display = isOnline ? '' : 'none';
        if (this.el.btnDrawOffer) this.el.btnDrawOffer.style.display = isOnline ? '' : 'none';
        if (this.el.chatPanel) this.el.chatPanel.style.display = isOnline ? '' : 'none';
        if (this.el.opponentInfo) this.el.opponentInfo.style.display = isOnline ? '' : 'none';
    }

    startLocalGame() {
        this.clearPendingTimeouts();
        this.isTurnPaused = false;
        this.showGame();
        this.board.refresh();
        this.el.moveHistory.innerHTML = '';
        this.el.statusText.textContent = '';
        this.el.statusText.className = '';
        this.board.clearHighlights();
        this.clearCapturedPieces();
        this.updateTurnDisplay();

        if (this.game.isAITurn()) {
            this.triggerAIMove();
        }
    }

    // === Game Events ===

    bindGameEvents() {
        this.el.btnUndo?.addEventListener('click', () => this.onUndo());
        this.el.btnNewGame?.addEventListener('click', () => this.onNewGame());
        this.el.btnBack?.addEventListener('click', () => this.onBack());
        this.el.btnResign?.addEventListener('click', () => {
            if (confirm('確定要認輸嗎？')) this.network.resign();
        });
        this.el.btnDrawOffer?.addEventListener('click', () => {
            this.network.offerDraw();
            this.el.statusText.textContent = '已提出和棋請求...';
        });

        this.el.btnAcceptDraw?.addEventListener('click', () => {
            this.el.drawOfferModal?.classList.remove('show');
            this.network.respondDraw(true);
        });
        this.el.btnDeclineDraw?.addEventListener('click', () => {
            this.el.drawOfferModal?.classList.remove('show');
            this.network.respondDraw(false);
        });

        this.el.modalNewGame?.addEventListener('click', () => {
            this.el.modal.classList.remove('show');
            if (this.isDarkChessMode) {
                this.onNewGame();
            } else if (this.game.gameMode === 'online') {
                this.showLobby();
            } else {
                this.onNewGame();
            }
        });
        this.el.modalBack?.addEventListener('click', () => {
            this.el.modal.classList.remove('show');
            this.onBack();
        });
    }

    onCellClick(row, col) {
        if (this.isSpectating || this.isTurnPaused) return;
        const result = this.game.handleClick(row, col);
        if (!result) return;

        if (result.action === 'select') {
            this.board.clearHighlights();
            this.board.setHighlights({ row, col }, result.validMoves, null);
            if (result.validMoves.length === 0) {
                this.el.statusText.textContent = '此棋被牽制，無法移動';
                this.el.statusText.className = 'pinned';
            } else {
                this.el.statusText.textContent = '';
                this.el.statusText.className = '';
            }
        } else if (result.action === 'deselect') {
            this.board.clearHighlights();
        } else if (result.action === 'move') {
            this.handleMoveResult(result);
        } else if (result.action === 'pending') {
            // Online mode: waiting for server confirmation
            this.board.clearHighlights();
            this.el.statusText.textContent = '等待確認...';
        }
    }

    handleMoveResult(result) {
        this.isTurnPaused = true;
        this.board.clearHighlights();
        this.board.animateMove(
            result.move.fromRow, result.move.fromCol,
            result.move.toRow, result.move.toCol
        );
        this.board.setHighlights(null, [], {
            from: { row: result.move.fromRow, col: result.move.fromCol },
            to: { row: result.move.toRow, col: result.move.toCol }
        });

        // Track captured piece
        if (result.move.captured) {
            this.addCapturedPiece(result.move.captured, result.prevSide);
        }

        if (result.inCheck) {
            const kingPos = this.board.findKing(this.game.currentSide);
            if (kingPos && this.board.cellElements[kingPos.row]) {
                this.board.cellElements[kingPos.row][kingPos.col].classList.add('check-highlight');
            }
        }

        this.addMoveToHistory(result);
        this.updateTurnDisplay();

        if (result.gameOver) {
            this.showGameOver(result.winner, result.reason);
            this.isTurnPaused = false;
        } else if (result.inCheck) {
            this.el.statusText.textContent = '將軍！';
            this.el.statusText.className = 'check';
        } else {
            this.el.statusText.textContent = '';
            this.el.statusText.className = '';
        }

        // 1 second pause between turns
        if (!result.gameOver) {
            this._turnTimeout = setTimeout(() => {
                this._turnTimeout = null;
                this.isTurnPaused = false;
                if (this.game.gameMode === 'pva' && !this.game.isAIThinking && this.game.isAITurn()) {
                    this.triggerAIMove();
                }
            }, 1000);
        }
    }

    async triggerAIMove() {
        this.isTurnPaused = true;
        this.game.isAIThinking = true;
        this.el.statusText.textContent = 'AI 思考中...';
        if (this.el.btnUndo) this.el.btnUndo.disabled = true;

        await new Promise(resolve => setTimeout(resolve, 300));

        const aiMove = this.aiEngine.findBestMove(
            this.game.board.clone(),
            this.game.currentSide
        );

        if (aiMove) {
            const result = this.game.executeMove(
                aiMove.fromRow, aiMove.fromCol,
                aiMove.toRow, aiMove.toCol
            );
            // handleMoveResult will set isTurnPaused and handle the 1s delay
            this.handleMoveResult(result);
        }

        this.game.isAIThinking = false;
        if (this.el.btnUndo) this.el.btnUndo.disabled = false;
    }

    updateTurnDisplay() {
        const isRed = this.game.currentSide === RED;
        this.el.currentPlayer.textContent = isRed ? '紅方回合' : '黑方回合';
        this.el.playerDot.className = `player-dot ${isRed ? 'red' : 'black'}`;
        this.el.moveCount.textContent = this.game.moveCount;
    }

    addMoveToHistory(result, moveCount) {
        const count = moveCount !== undefined ? moveCount : this.game.moveCount;
        const entry = document.createElement('span');
        entry.className = 'move-entry';
        const num = document.createElement('span');
        num.className = 'move-num';
        num.textContent = `${count}.`;
        const text = document.createTextNode(result.notation);
        entry.appendChild(num);
        entry.appendChild(text);
        this.el.moveHistory.appendChild(entry);
        this.el.moveHistory.parentElement.scrollTop = this.el.moveHistory.parentElement.scrollHeight;
    }

    // === Captured Pieces ===

    clearCapturedPieces() {
        this.capturedByRed = [];
        this.capturedByBlack = [];
        this.renderCapturedPanels();
    }

    addCapturedPiece(captured, capturedBySide) {
        if (!captured) return;
        if (capturedBySide === RED) {
            this.capturedByRed.push(captured);
        } else {
            this.capturedByBlack.push(captured);
        }
        this.renderCapturedPanels();
    }

    removeCapturedPiece(capturedBySide) {
        if (capturedBySide === RED) {
            this.capturedByRed.pop();
        } else {
            this.capturedByBlack.pop();
        }
        this.renderCapturedPanels();
    }

    renderCapturedPanels() {
        if (this.el.capturedLeft) {
            this.el.capturedLeft.innerHTML = '';
            if (this.capturedByRed.length > 0) {
                const label = document.createElement('div');
                label.className = 'captured-label';
                label.textContent = '紅方';
                this.el.capturedLeft.appendChild(label);
                for (const p of this.capturedByRed) {
                    this.el.capturedLeft.appendChild(this.createCapturedPieceEl(p));
                }
            }
        }
        if (this.el.capturedRight) {
            this.el.capturedRight.innerHTML = '';
            if (this.capturedByBlack.length > 0) {
                const label = document.createElement('div');
                label.className = 'captured-label';
                label.textContent = '黑方';
                this.el.capturedRight.appendChild(label);
                for (const p of this.capturedByBlack) {
                    this.el.capturedRight.appendChild(this.createCapturedPieceEl(p));
                }
            }
        }
    }

    createCapturedPieceEl(piece) {
        const el = document.createElement('div');
        el.className = `captured-piece piece-${piece.side}`;
        el.textContent = PIECE_CHARS[piece.side][piece.type];
        return el;
    }

    showGameOver(winner, reason, eloChange) {
        const winnerName = winner === RED ? '紅方' : '黑方';
        const reasonMap = {
            checkmate: '將死', stalemate: '困斃', resign: '認輸',
            timeout: '超時', disconnect: '斷線', draw: '和棋',
            eliminated: '全軍覆沒', 'no-moves': '無子可動'
        };
        const reasonText = reasonMap[reason] || reason;

        if (reason === 'draw' || !winner) {
            this.el.modalTitle.textContent = '和棋！';
        } else {
            this.el.modalTitle.textContent = `${winnerName}獲勝！`;
        }

        const moveCount = this.isDarkChessMode ? this.darkGame.moveCount : this.game.moveCount;
        let msg = `${reasonText} — 共 ${moveCount} 手`;
        if (eloChange !== undefined) {
            msg += `\nELO 變化: ${eloChange >= 0 ? '+' : ''}${eloChange}`;
        }
        this.el.modalMessage.textContent = msg;
        this.el.modal.classList.add('show');
    }

    onUndo() {
        if (this.isDarkChessMode) {
            this.onDarkChessUndo();
            return;
        }
        // Grab move history before undo to check for captures
        const undoCount = this.game.gameMode === 'pva' ? 2 : 1;
        const movesToUndo = [];
        for (let i = 0; i < undoCount && i < this.game.moveHistory.length; i++) {
            movesToUndo.push(this.game.moveHistory[this.game.moveHistory.length - 1 - i]);
        }

        if (this.game.undo()) {
            this.board.renderPieces();
            this.board.clearHighlights();
            this.updateTurnDisplay();
            this.el.statusText.textContent = '';
            this.el.statusText.className = '';
            for (let i = 0; i < undoCount; i++) {
                const last = this.el.moveHistory.lastElementChild;
                if (last) last.remove();
            }
            // Remove captured pieces from panels
            for (const move of movesToUndo) {
                if (move.captured) {
                    this.removeCapturedPiece(move.piece.side);
                }
            }
        }
    }

    onNewGame() {
        if (this.isDarkChessMode) {
            this.startDarkChessGame(this.darkGame.gameMode);
            return;
        }
        if (this.game.gameMode === 'online') {
            this.showLobby();
            return;
        }
        this.game.newGame(this.game.gameMode, this.game.playerSide, this.game.aiDifficulty);
        if (this.game.gameMode === 'pva') {
            this.aiEngine.setDifficulty(this.game.aiDifficulty);
        }
        this.startLocalGame();
    }

    onBack() {
        this.clearPendingTimeouts();
        if (this.isDarkChessMode) {
            this.isDarkChessMode = false;
            this.el.gameScreen.classList.remove('dark-chess');
            document.getElementById('app-container').classList.remove('dark-chess');
            // Re-create standard board DOM
            this.board.createBoardDOM(this.el.chessBoard);
            this.board.onCellClick = (row, col) => this.onCellClick(row, col);
        }
        if (this.game.gameMode === 'online') {
            this.network.leaveRoom();
        }
        if (this.currentUser) {
            this.showLobby();
        } else {
            this.showOfflineMenu();
        }
    }

    // === Chat Events ===

    bindChatEvents() {
        this.el.btnSendChat?.addEventListener('click', () => this.sendChat());
        this.el.chatInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.sendChat();
        });
    }

    sendChat() {
        const text = this.el.chatInput?.value.trim();
        if (!text) return;
        this.network.sendChat(text);
        this.el.chatInput.value = '';
    }

    addChatMessage(from, text) {
        if (!this.el.chatMessages) return;
        const msg = document.createElement('div');
        msg.className = 'chat-msg';
        const strong = document.createElement('strong');
        strong.textContent = `${from}: `;
        msg.appendChild(strong);
        msg.appendChild(document.createTextNode(text));
        this.el.chatMessages.appendChild(msg);
        this.el.chatMessages.scrollTop = this.el.chatMessages.scrollHeight;
    }

    // === Network Events ===

    bindNetworkEvents() {
        const net = this.network;

        net.on('roomCreated', (data) => {
            this.showWaiting(data.code);
        });

        net.on('roomJoined', () => {
            // Game will start via 'gameStart' event
        });

        net.on('roomList', (rooms) => {
            this.updateRoomList(rooms);
        });

        net.on('roomError', (data) => {
            this.showToast(data.message);
        });

        net.on('matchWaiting', () => {
            this.showWaiting('配對中...');
        });

        net.on('matchFound', () => {
            // Game will start via 'gameStart' event
        });

        net.on('gameStart', (data) => {
            this.isSpectating = false;
            this.game.newGame('online', data.yourSide);
            this.game.localSide = data.yourSide;
            this.setupGameUI(true);
            this.startLocalGame();

            const oppName = data.yourSide === 'red' ? data.blackPlayer : data.redPlayer;
            if (this.el.opponentInfo) {
                this.el.opponentInfo.textContent = `對手: ${oppName}`;
            }
            if (this.el.chatMessages) {
                this.el.chatMessages.innerHTML = '';
            }
        });

        net.on('gameMoved', (data) => {
            const result = this.game.applyServerMove(
                data.fromRow, data.fromCol, data.toRow, data.toCol
            );
            this.handleMoveResult(result);
        });

        net.on('gameOver', (data) => {
            this.game.gameOver = true;
            this.game.winner = data.winner;
            const myEloChange = this.game.localSide === 'red'
                ? data.redEloChange : data.blackEloChange;
            this.showGameOver(data.winner, data.reason, myEloChange);
            if (this.currentUser) {
                this.currentUser.elo += myEloChange || 0;
            }
        });

        net.on('gameError', (data) => {
            this.el.statusText.textContent = data.message;
            setTimeout(() => {
                this.el.statusText.textContent = '';
            }, 2000);
        });

        net.on('gameState', (data) => {
            // Reconnect: restore full state
            this.game.restoreState(data.board, data.currentSide, data.moveCount);
            this.board.refresh();
            this.board.clearHighlights();
            this.updateTurnDisplay();
        });

        net.on('opponentDisconnected', (data) => {
            if (this.el.disconnectOverlay) {
                this.el.disconnectOverlay.style.display = 'flex';
                let remaining = Math.floor(data.timeout / 1000);
                this.el.disconnectTimer.textContent = remaining;
                if (this._disconnectInterval) clearInterval(this._disconnectInterval);
                this._disconnectInterval = setInterval(() => {
                    remaining--;
                    if (this.el.disconnectTimer) {
                        this.el.disconnectTimer.textContent = Math.max(0, remaining);
                    }
                    if (remaining <= 0) clearInterval(this._disconnectInterval);
                }, 1000);
            }
        });

        net.on('opponentReconnected', () => {
            if (this.el.disconnectOverlay) {
                this.el.disconnectOverlay.style.display = 'none';
            }
            clearInterval(this._disconnectInterval);
        });

        net.on('drawOffered', () => {
            if (this.el.drawOfferModal) {
                this.el.drawOfferModal.classList.add('show');
            }
        });

        net.on('drawDeclined', () => {
            this.el.statusText.textContent = '對手拒絕和棋';
            setTimeout(() => { this.el.statusText.textContent = ''; }, 2000);
        });

        net.on('chatMessage', (data) => {
            this.addChatMessage(data.from, data.text);
        });

        // Spectator events
        net.on('spectateState', (data) => {
            this.isSpectating = true;
            this.game.newGame('online', 'red');
            this.game.restoreState(data.board, data.currentSide, data.moveCount);
            this.setupGameUI(true);
            this.showGame();
            this.board.refresh();
            this.updateTurnDisplay();
            if (this.el.opponentInfo) {
                this.el.opponentInfo.textContent = `觀戰: ${data.redPlayer} vs ${data.blackPlayer}`;
            }
            if (this.el.btnResign) this.el.btnResign.style.display = 'none';
            if (this.el.btnDrawOffer) this.el.btnDrawOffer.style.display = 'none';
        });

        net.on('spectateMoved', (data) => {
            const result = this.game.applyServerMove(
                data.fromRow, data.fromCol, data.toRow, data.toCol
            );
            this.handleMoveResult(result);
        });

        net.on('spectateOver', (data) => {
            this.game.gameOver = true;
            this.showGameOver(data.winner, data.reason);
        });

        net.on('connectError', () => {
            // Token might be invalid
            this.network.logout();
            this.showLogin();
        });
    }

    // === Dark Chess Mode ===

    startDarkChessGame(mode) {
        this.clearPendingTimeouts();
        this.isDarkChessMode = true;
        this.isSpectating = false;
        this.isTurnPaused = false;

        this.darkGame = new DarkChessGame();
        this.darkGame.newGame(mode, this.dcDifficulty);
        if (mode === 'dc-pva') {
            this.darkAI.setDifficulty(this.dcDifficulty);
        }

        // Setup dark chess board DOM
        this.darkGame.board.createBoardDOM(this.el.chessBoard);
        this.darkGame.board.onCellClick = (row, col) => this.onDarkChessClick(row, col);

        this.setupGameUI(false);
        this.showGame();
        this.darkGame.board.refresh();
        this.el.moveHistory.innerHTML = '';
        this.el.statusText.textContent = '';
        this.el.statusText.className = '';
        this.clearCapturedPieces();
        this.updateDarkChessTurnDisplay();
    }

    onDarkChessClick(row, col) {
        if (this.isTurnPaused) return;
        const result = this.darkGame.handleClick(row, col);
        if (!result) return;

        if (result.action === 'flip') {
            this.handleDarkChessFlip(result);
        } else if (result.action === 'select') {
            this.darkGame.board.clearHighlights();
            this.darkGame.board.setHighlights({ row, col }, result.validMoves, null);
            if (result.validMoves.length === 0) {
                this.el.statusText.textContent = '此棋無法移動';
                this.el.statusText.className = 'pinned';
            } else {
                this.el.statusText.textContent = '';
                this.el.statusText.className = '';
            }
        } else if (result.action === 'deselect') {
            this.darkGame.board.clearHighlights();
        } else if (result.action === 'move' || result.action === 'capture') {
            this.handleDarkChessMoveResult(result);
        }
    }

    handleDarkChessFlip(result) {
        this.isTurnPaused = true;
        this.darkGame.board.clearHighlights();

        // Flip animation
        this.darkGame.board.animateFlip(result.row, result.col, result.piece, () => {
            // Highlight flipped cell briefly
            this.darkGame.board.cellElements[result.row][result.col].classList.add('flip-highlight');

            // Show color assignment on first flip
            if (result.colorAssigned && this.darkGame.moveCount === 1) {
                const sideName = result.piece.side === RED ? '紅方' : '黑方';
                if (this.darkGame.gameMode === 'dc-pva') {
                    this.el.statusText.textContent = `你是${sideName}！`;
                } else {
                    this.el.statusText.textContent = `先手是${sideName}！`;
                }
                this.el.statusText.className = result.piece.side === RED
                    ? 'dc-color-notice red-notice' : 'dc-color-notice black-notice';
            } else {
                this.el.statusText.textContent = '';
                this.el.statusText.className = '';
            }

            this.addMoveToHistory(result, this.darkGame.moveCount);
            this.updateDarkChessTurnDisplay();

            if (result.gameOver) {
                this.showGameOver(result.winner, result.reason);
                this.isTurnPaused = false;
            } else {
                this._turnTimeout = setTimeout(() => {
                    this._turnTimeout = null;
                    this.isTurnPaused = false;
                    if (this.darkGame && !this.darkGame.isAIThinking && this.darkGame.isAITurn()) {
                        this.triggerDarkChessAI();
                    }
                }, 800);
            }
        });
    }

    handleDarkChessMoveResult(result) {
        this.isTurnPaused = true;
        this.darkGame.board.clearHighlights();
        this.darkGame.board.animateMove(
            result.move.fromRow, result.move.fromCol,
            result.move.toRow, result.move.toCol
        );
        this.darkGame.board.setHighlights(null, [], {
            from: { row: result.move.fromRow, col: result.move.fromCol },
            to: { row: result.move.toRow, col: result.move.toCol }
        });

        // Track captured piece
        if (result.move.captured) {
            this.addCapturedPiece(result.move.captured, result.prevSide);
        }

        this.addMoveToHistory(result, this.darkGame.moveCount);
        this.updateDarkChessTurnDisplay();

        if (result.gameOver) {
            this.showGameOver(result.winner, result.reason);
            this.isTurnPaused = false;
        } else {
            this.el.statusText.textContent = '';
            this.el.statusText.className = '';
            this._turnTimeout = setTimeout(() => {
                this._turnTimeout = null;
                this.isTurnPaused = false;
                if (this.darkGame && !this.darkGame.isAIThinking && this.darkGame.isAITurn()) {
                    this.triggerDarkChessAI();
                }
            }, 1000);
        }
    }

    async triggerDarkChessAI() {
        this.isTurnPaused = true;
        this.darkGame.isAIThinking = true;
        this.el.statusText.textContent = 'AI 思考中...';
        if (this.el.btnUndo) this.el.btnUndo.disabled = true;

        await new Promise(resolve => setTimeout(resolve, 400));

        const aiPieceColor = this.darkGame.getActivePieceColor();
        const action = this.darkAI.findBestAction(
            this.darkGame.board,
            aiPieceColor,
            this.darkGame.movesSinceCapture
        );

        if (action) {
            if (action.action === 'flip') {
                const result = this.darkGame.flipPiece(action.row, action.col);
                if (result) {
                    this.handleDarkChessFlip(result);
                }
            } else {
                const result = this.darkGame.executeMove(
                    action.fromRow, action.fromCol, action.toRow, action.toCol
                );
                this.handleDarkChessMoveResult(result);
            }
        }

        this.darkGame.isAIThinking = false;
        if (this.el.btnUndo) this.el.btnUndo.disabled = false;
    }

    updateDarkChessTurnDisplay() {
        if (!this.darkGame) return;
        if (!this.darkGame.colorAssigned) {
            this.el.currentPlayer.textContent = '先手回合';
            this.el.playerDot.className = 'player-dot';
        } else {
            // Show whose piece color is active this turn
            const activeColor = this.darkGame.getActivePieceColor();
            const isRed = activeColor === RED;
            this.el.currentPlayer.textContent = isRed ? '紅方回合' : '黑方回合';
            this.el.playerDot.className = `player-dot ${isRed ? 'red' : 'black'}`;
        }
        this.el.moveCount.textContent = this.darkGame.moveCount;
    }

    onDarkChessUndo() {
        const undone = this.darkGame.undo();
        if (undone) {
            this.darkGame.board.renderPieces();
            this.darkGame.board.clearHighlights();
            this.updateDarkChessTurnDisplay();
            this.el.statusText.textContent = '';
            this.el.statusText.className = '';
            for (let i = 0; i < undone.length; i++) {
                const last = this.el.moveHistory.lastElementChild;
                if (last) last.remove();
            }
            // Remove captured pieces from panels
            for (const record of undone) {
                if (record.captured) {
                    this.removeCapturedPiece(record.piece.side);
                }
            }
        }
    }
}
