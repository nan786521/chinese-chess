import { DC_ROWS, DC_COLS, PIECE_CHARS } from '../../shared/constants.js';
import { DarkBoardLogic } from '../../shared/dark-chess/dark-board-logic.js';

export class DarkBoard extends DarkBoardLogic {
    constructor() {
        super();
        this.pieceElements = new Map();
        this.boardElement = null;
        this.cellElements = [];
        this.canvasElement = null;
        this.onCellClick = null;
        this.isAnimating = false;
    }

    createBoardDOM(container) {
        this.boardElement = container;
        container.innerHTML = '';

        const canvas = document.createElement('canvas');
        canvas.className = 'board-canvas';
        container.appendChild(canvas);
        this.canvasElement = canvas;

        this.cellElements = [];
        for (let r = 0; r < DC_ROWS; r++) {
            this.cellElements[r] = [];
            for (let c = 0; c < DC_COLS; c++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                cell.addEventListener('click', () => {
                    if (this.onCellClick) this.onCellClick(r, c);
                });
                container.appendChild(cell);
                this.cellElements[r][c] = cell;
            }
        }

        window.addEventListener('resize', () => this.refresh());
    }

    refresh() {
        if (!this.boardElement || !this.canvasElement) return;
        if (this.isAnimating) return;
        this.drawBoardLines(this.canvasElement);
        this.positionAllCells();
        this.renderPieces();
    }

    getCellSize() {
        if (!this.boardElement) return 60;
        const rect = this.boardElement.getBoundingClientRect();
        const padding = 30;
        const availW = rect.width - padding * 2;
        const availH = rect.height - padding * 2;
        return Math.min(availW / (DC_COLS - 1), availH / (DC_ROWS - 1));
    }

    getPadding() {
        if (!this.boardElement) return { x: 30, y: 30 };
        const rect = this.boardElement.getBoundingClientRect();
        const cellSize = this.getCellSize();
        const boardW = cellSize * (DC_COLS - 1);
        const boardH = cellSize * (DC_ROWS - 1);
        return {
            x: (rect.width - boardW) / 2,
            y: (rect.height - boardH) / 2
        };
    }

    positionAllCells() {
        const cellSize = this.getCellSize();
        const pad = this.getPadding();
        const pieceSize = Math.max(cellSize * 0.9, 34);

        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                const cell = this.cellElements[r][c];
                cell.style.width = pieceSize + 'px';
                cell.style.height = pieceSize + 'px';
                cell.style.left = (pad.x + c * cellSize - pieceSize / 2) + 'px';
                cell.style.top = (pad.y + r * cellSize - pieceSize / 2) + 'px';
            }
        }
    }

    drawBoardLines(canvas) {
        const container = this.boardElement;
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        const cellSize = this.getCellSize();
        const pad = this.getPadding();
        const ctx = canvas.getContext('2d');

        // Wood-grain background
        const bgGrad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        bgGrad.addColorStop(0, '#EEDCAA');
        bgGrad.addColorStop(0.3, '#F2E0B0');
        bgGrad.addColorStop(0.6, '#E8D4A0');
        bgGrad.addColorStop(1, '#F0D8A8');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Outer border
        const bx = pad.x - cellSize * 0.12;
        const by = pad.y - cellSize * 0.12;
        const bw = (DC_COLS - 1) * cellSize + cellSize * 0.24;
        const bh = (DC_ROWS - 1) * cellSize + cellSize * 0.24;
        ctx.strokeStyle = '#4A2A10';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, by, bw, bh);

        // Grid lines
        ctx.strokeStyle = '#5C3A1E';
        ctx.lineWidth = 1.5;

        // Horizontal lines
        for (let r = 0; r < DC_ROWS; r++) {
            const y = pad.y + r * cellSize;
            ctx.beginPath();
            ctx.moveTo(pad.x, y);
            ctx.lineTo(pad.x + (DC_COLS - 1) * cellSize, y);
            ctx.stroke();
        }

        // Vertical lines
        for (let c = 0; c < DC_COLS; c++) {
            const x = pad.x + c * cellSize;
            ctx.beginPath();
            ctx.moveTo(x, pad.y);
            ctx.lineTo(x, pad.y + (DC_ROWS - 1) * cellSize);
            ctx.stroke();
        }
    }

    renderPieces() {
        for (const el of this.pieceElements.values()) {
            el.remove();
        }
        this.pieceElements.clear();

        const cellSize = this.getCellSize();
        const pad = this.getPadding();
        const pieceSize = Math.max(cellSize * 0.88, 32);

        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                const piece = this.grid[r][c];
                if (!piece) continue;

                const el = document.createElement('div');

                if (piece.revealed) {
                    el.className = `piece piece-${piece.side}`;
                    el.textContent = PIECE_CHARS[piece.side][piece.type];
                } else {
                    el.className = 'piece piece-hidden';
                    el.textContent = '';
                }

                el.style.width = pieceSize + 'px';
                el.style.height = pieceSize + 'px';
                el.style.lineHeight = pieceSize + 'px';
                el.style.fontSize = (pieceSize * 0.62) + 'px';
                el.style.left = (pad.x + c * cellSize - pieceSize / 2) + 'px';
                el.style.top = (pad.y + r * cellSize - pieceSize / 2) + 'px';
                el.style.pointerEvents = 'none';

                this.boardElement.appendChild(el);
                this.pieceElements.set(`${r},${c}`, el);
            }
        }
    }

    animateFlip(row, col, piece, callback) {
        const key = `${row},${col}`;
        const el = this.pieceElements.get(key);
        if (!el) {
            this.renderPieces();
            if (callback) callback();
            return;
        }

        this.isAnimating = true;
        el.style.transition = 'transform 0.25s ease-in';
        el.style.transform = 'rotateY(90deg)';

        setTimeout(() => {
            // Swap appearance at midpoint
            el.className = `piece piece-${piece.side}`;
            el.textContent = PIECE_CHARS[piece.side][piece.type];
            el.style.transition = 'transform 0.25s ease-out';
            el.style.transform = 'rotateY(0deg)';

            setTimeout(() => {
                el.style.transition = '';
                el.style.transform = '';
                this.isAnimating = false;
                if (callback) callback();
            }, 280);
        }, 280);
    }

    animateMove(fromRow, fromCol, toRow, toCol) {
        const cellSize = this.getCellSize();
        const pad = this.getPadding();
        const pieceSize = Math.max(cellSize * 0.88, 32);

        const fromKey = `${fromRow},${fromCol}`;
        const toKey = `${toRow},${toCol}`;
        const pieceEl = this.pieceElements.get(fromKey);
        if (!pieceEl) {
            this.renderPieces();
            return;
        }

        this.isAnimating = true;

        // Remove captured piece with fade
        const capturedEl = this.pieceElements.get(toKey);
        if (capturedEl) {
            capturedEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            capturedEl.style.opacity = '0';
            capturedEl.style.transform = 'scale(0.3)';
            setTimeout(() => capturedEl.remove(), 300);
            this.pieceElements.delete(toKey);
        }

        // FLIP animation technique
        const deltaX = (fromCol - toCol) * cellSize;
        const deltaY = (fromRow - toRow) * cellSize;

        pieceEl.style.transition = 'none';
        pieceEl.style.left = (pad.x + toCol * cellSize - pieceSize / 2) + 'px';
        pieceEl.style.top = (pad.y + toRow * cellSize - pieceSize / 2) + 'px';
        pieceEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        pieceEl.style.willChange = 'transform';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                pieceEl.style.transition = 'transform 0.35s ease';
                pieceEl.style.transform = 'translate(0, 0)';
            });
        });

        const onEnd = () => {
            pieceEl.style.transition = '';
            pieceEl.style.transform = '';
            pieceEl.style.willChange = '';
            this.isAnimating = false;
        };
        pieceEl.addEventListener('transitionend', onEnd, { once: true });
        setTimeout(onEnd, 450);

        this.pieceElements.delete(fromKey);
        this.pieceElements.set(toKey, pieceEl);
    }

    setHighlights(selected, validMoves, lastMove) {
        this.clearHighlights();

        if (selected) {
            this.cellElements[selected.row][selected.col].classList.add('selected');
        }

        if (validMoves) {
            for (const m of validMoves) {
                const cell = this.cellElements[m.toRow][m.toCol];
                cell.classList.add(m.isCapture ? 'capture-target' : 'valid-move');
            }
        }

        if (lastMove) {
            this.cellElements[lastMove.from.row][lastMove.from.col].classList.add('last-move');
            this.cellElements[lastMove.to.row][lastMove.to.col].classList.add('last-move');
        }
    }

    clearHighlights() {
        for (let r = 0; r < DC_ROWS; r++) {
            for (let c = 0; c < DC_COLS; c++) {
                this.cellElements[r][c].classList.remove(
                    'selected', 'valid-move', 'capture-target', 'last-move', 'flip-highlight'
                );
            }
        }
    }
}
