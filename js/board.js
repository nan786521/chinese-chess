import { ROWS, COLS, PIECE_CHARS } from '../shared/constants.js';
import { BoardLogic } from '../shared/board-logic.js';

export class Board extends BoardLogic {
    constructor() {
        super();
        this.pieceElements = new Map();
        this.boardElement = null;
        this.cellElements = [];
        this.canvasElement = null;
        this.onCellClick = null;
        this.isAnimating = false;
        this._resizeHandler = null;
    }

    clone() {
        const copy = new BoardLogic();
        copy.grid = [];
        for (let r = 0; r < ROWS; r++) {
            copy.grid[r] = [];
            for (let c = 0; c < COLS; c++) {
                const piece = this.grid[r][c];
                copy.grid[r][c] = piece ? { type: piece.type, side: piece.side } : null;
            }
        }
        copy.hash = this.hash;
        copy.pieceCount = this.pieceCount;
        copy._kingPos = {
            red: this._kingPos.red ? { ...this._kingPos.red } : null,
            black: this._kingPos.black ? { ...this._kingPos.black } : null,
        };
        return copy;
    }

    // --- DOM Rendering ---

    createBoardDOM(container) {
        this.boardElement = container;
        container.innerHTML = '';

        const canvas = document.createElement('canvas');
        canvas.className = 'board-canvas';
        container.appendChild(canvas);
        this.canvasElement = canvas;

        this.cellElements = [];
        for (let r = 0; r < ROWS; r++) {
            this.cellElements[r] = [];
            for (let c = 0; c < COLS; c++) {
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

        // Don't draw immediately - board may be hidden. Draw on first refresh().
        if (this._resizeHandler) window.removeEventListener('resize', this._resizeHandler);
        this._resizeHandler = () => this.refresh();
        window.addEventListener('resize', this._resizeHandler);
    }

    // Call this whenever the board becomes visible or needs redrawing
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
        return Math.min(availW / (COLS - 1), availH / (ROWS - 1));
    }

    getPadding() {
        if (!this.boardElement) return { x: 30, y: 30 };
        const rect = this.boardElement.getBoundingClientRect();
        const cellSize = this.getCellSize();
        const boardW = cellSize * (COLS - 1);
        const boardH = cellSize * (ROWS - 1);
        return {
            x: (rect.width - boardW) / 2,
            y: (rect.height - boardH) / 2
        };
    }

    positionAllCells() {
        const cellSize = this.getCellSize();
        const pad = this.getPadding();
        const pieceSize = Math.max(cellSize * 0.9, 34);

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
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
        const bw = (COLS - 1) * cellSize + cellSize * 0.24;
        const bh = (ROWS - 1) * cellSize + cellSize * 0.24;
        ctx.strokeStyle = '#4A2A10';
        ctx.lineWidth = 3;
        ctx.strokeRect(bx, by, bw, bh);

        ctx.strokeStyle = '#5C3A1E';
        ctx.lineWidth = 1.5;

        for (let r = 0; r < ROWS; r++) {
            const y = pad.y + r * cellSize;
            ctx.beginPath();
            ctx.moveTo(pad.x, y);
            ctx.lineTo(pad.x + (COLS - 1) * cellSize, y);
            ctx.stroke();
        }

        for (let c = 0; c < COLS; c++) {
            const x = pad.x + c * cellSize;
            if (c === 0 || c === COLS - 1) {
                ctx.beginPath();
                ctx.moveTo(x, pad.y);
                ctx.lineTo(x, pad.y + (ROWS - 1) * cellSize);
                ctx.stroke();
            } else {
                ctx.beginPath();
                ctx.moveTo(x, pad.y);
                ctx.lineTo(x, pad.y + 4 * cellSize);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x, pad.y + 5 * cellSize);
                ctx.lineTo(x, pad.y + (ROWS - 1) * cellSize);
                ctx.stroke();
            }
        }

        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pad.x + 3 * cellSize, pad.y);
        ctx.lineTo(pad.x + 5 * cellSize, pad.y + 2 * cellSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad.x + 5 * cellSize, pad.y);
        ctx.lineTo(pad.x + 3 * cellSize, pad.y + 2 * cellSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad.x + 3 * cellSize, pad.y + 7 * cellSize);
        ctx.lineTo(pad.x + 5 * cellSize, pad.y + 9 * cellSize);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pad.x + 5 * cellSize, pad.y + 7 * cellSize);
        ctx.lineTo(pad.x + 3 * cellSize, pad.y + 9 * cellSize);
        ctx.stroke();

        const riverY = pad.y + 4.5 * cellSize;
        ctx.fillStyle = 'rgba(80, 50, 20, 0.12)';
        ctx.fillRect(pad.x, pad.y + 4 * cellSize + 1, (COLS - 1) * cellSize, cellSize - 2);
        ctx.fillStyle = '#5C3A1E';
        ctx.font = `bold ${cellSize * 0.48}px "Noto Serif TC", "KaiTi", serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('楚 河', pad.x + 2 * cellSize, riverY);
        ctx.fillText('漢 界', pad.x + 6 * cellSize, riverY);

        this.drawStarPoints(ctx, cellSize, pad);
    }

    drawStarPoints(ctx, cellSize, pad) {
        const starPositions = [
            { row: 2, col: 1 }, { row: 2, col: 7 },
            { row: 7, col: 1 }, { row: 7, col: 7 },
            { row: 3, col: 0 }, { row: 3, col: 2 }, { row: 3, col: 4 }, { row: 3, col: 6 }, { row: 3, col: 8 },
            { row: 6, col: 0 }, { row: 6, col: 2 }, { row: 6, col: 4 }, { row: 6, col: 6 }, { row: 6, col: 8 },
        ];

        const size = cellSize * 0.08;
        const gap = cellSize * 0.04;
        ctx.lineWidth = 1.2;

        for (const { row, col } of starPositions) {
            const x = pad.x + col * cellSize;
            const y = pad.y + row * cellSize;

            const drawL = (dx, dy) => {
                const sx = x + dx * gap;
                const sy = y + dy * gap;
                ctx.beginPath();
                ctx.moveTo(sx + dx * size, sy);
                ctx.lineTo(sx, sy);
                ctx.lineTo(sx, sy + dy * size);
                ctx.stroke();
            };

            if (col > 0) { drawL(-1, -1); drawL(-1, 1); }
            if (col < COLS - 1) { drawL(1, -1); drawL(1, 1); }
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

        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const piece = this.grid[r][c];
                if (!piece) continue;

                const el = document.createElement('div');
                el.className = `piece piece-${piece.side}`;
                el.textContent = PIECE_CHARS[piece.side][piece.type];
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

        // Remove captured piece with fade + shrink
        const capturedEl = this.pieceElements.get(toKey);
        if (capturedEl) {
            capturedEl.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
            capturedEl.style.opacity = '0';
            capturedEl.style.transform = 'scale(0.3)';
            setTimeout(() => capturedEl.remove(), 300);
            this.pieceElements.delete(toKey);
        }

        // FLIP technique: use transform for GPU-accelerated animation
        const deltaX = (fromCol - toCol) * cellSize;
        const deltaY = (fromRow - toRow) * cellSize;

        // Set final position and apply inverse transform (piece appears at old position)
        pieceEl.style.transition = 'none';
        pieceEl.style.left = (pad.x + toCol * cellSize - pieceSize / 2) + 'px';
        pieceEl.style.top = (pad.y + toRow * cellSize - pieceSize / 2) + 'px';
        pieceEl.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
        pieceEl.style.willChange = 'transform';

        // Use rAF to start animation on next frame (avoids forced reflow)
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                pieceEl.style.transition = 'transform 0.35s ease';
                pieceEl.style.transform = 'translate(0, 0)';
            });
        });

        // Clean up after animation completes
        let animDone = false;
        const onEnd = () => {
            if (animDone) return;
            animDone = true;
            clearTimeout(fallbackTimer);
            pieceEl.style.transition = '';
            pieceEl.style.transform = '';
            pieceEl.style.willChange = '';
            this.isAnimating = false;
        };
        pieceEl.addEventListener('transitionend', onEnd, { once: true });
        // Fallback in case transitionend doesn't fire
        const fallbackTimer = setTimeout(onEnd, 450);

        // Update piece map
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
                const hasPiece = this.grid[m.toRow][m.toCol] !== null;
                cell.classList.add(hasPiece ? 'capture-target' : 'valid-move');
            }
        }

        if (lastMove) {
            this.cellElements[lastMove.from.row][lastMove.from.col].classList.add('last-move');
            this.cellElements[lastMove.to.row][lastMove.to.col].classList.add('last-move');
        }
    }

    clearHighlights() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                this.cellElements[r][c].classList.remove(
                    'selected', 'valid-move', 'capture-target', 'last-move', 'check-highlight'
                );
            }
        }
    }
}
