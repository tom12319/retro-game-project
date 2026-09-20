import { GRID_SIZE, CELL_SIZE, CELL_GAP, GRID_OFFSET, DIRECTIONS } from '../config.js';

/**
 * 2048 Game Engine - 輸入處理管理器
 * 集中監聽鍵盤、滑鼠點擊、觸控滑動、懸停事件
 */
export class InputHandler {
    /**
     * @param {HTMLCanvasElement} canvas 
     * @param {Object} callbacks 回呼介面
     */
    constructor(canvas, callbacks = {}) {
        this.canvas = canvas;
        this.callbacks = Object.assign({
            onMove: () => {},
            onToggleSkill: () => {},
            onCancelSkill: () => {},
            onRestart: () => {},
            onSkillClick: () => {},
            onSkillHover: () => {},
            onSkillLeave: () => {}
        }, callbacks);

        this.touchStartX = 0;
        this.touchStartY = 0;
        this.minSwipeDistance = 30;
        this.isSkillMode = false;

        this.init();
    }

    setSkillMode(active) {
        this.isSkillMode = active;
        this.canvas.style.cursor = active ? 'pointer' : '';
    }

    init() {
        this.initKeyboard();
        this.initPointer();
        this.initTouch();
    }

    initKeyboard() {
        const keyMap = {
            'ArrowUp': DIRECTIONS.UP,
            'ArrowDown': DIRECTIONS.DOWN,
            'ArrowLeft': DIRECTIONS.LEFT,
            'ArrowRight': DIRECTIONS.RIGHT,
            'w': DIRECTIONS.UP,
            'W': DIRECTIONS.UP,
            's': DIRECTIONS.DOWN,
            'S': DIRECTIONS.DOWN,
            'a': DIRECTIONS.LEFT,
            'A': DIRECTIONS.LEFT,
            'd': DIRECTIONS.RIGHT,
            'D': DIRECTIONS.RIGHT
        };

        window.addEventListener('keydown', (e) => {
            if (keyMap[e.key]) {
                e.preventDefault();
                this.callbacks.onMove(keyMap[e.key]);
                return;
            }

            // E 鍵切換消除技能
            if (e.key === 'e' || e.key === 'E') {
                e.preventDefault();
                this.callbacks.onToggleSkill();
                return;
            }

            // Esc 取消技能模式
            if (e.key === 'Escape' && this.isSkillMode) {
                e.preventDefault();
                this.callbacks.onCancelSkill();
                return;
            }

            // Space 鍵重新開始
            if (e.code === 'Space') {
                e.preventDefault();
                this.callbacks.onRestart();
                return;
            }
        });
    }

    initPointer() {
        this.canvas.addEventListener('mousedown', (e) => {
            this.touchStartX = e.clientX;
            this.touchStartY = e.clientY;
        });

        this.canvas.addEventListener('mouseup', (e) => {
            this.handleSwipe(e.clientX, e.clientY);
        });

        this.canvas.addEventListener('click', (e) => {
            if (!this.isSkillMode) return;
            const cell = this.getCellFromMouse(e.clientX, e.clientY);
            if (cell) {
                this.callbacks.onSkillClick(cell.row, cell.col);
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isSkillMode) return;
            const cell = this.getCellFromMouse(e.clientX, e.clientY);
            this.callbacks.onSkillHover(cell);
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (!this.isSkillMode) return;
            this.callbacks.onSkillLeave();
        });
    }

    initTouch() {
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                this.touchStartX = e.touches[0].clientX;
                this.touchStartY = e.touches[0].clientY;
            }
            e.preventDefault();
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            if (e.changedTouches.length > 0) {
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                this.handleSwipe(endX, endY);
            }
            e.preventDefault();
        }, { passive: false });
    }

    handleSwipe(endX, endY) {
        if (this.isSkillMode) return; // 技能模式下停用滑動手勢

        const deltaX = endX - this.touchStartX;
        const deltaY = endY - this.touchStartY;

        if (Math.abs(deltaX) < this.minSwipeDistance && Math.abs(deltaY) < this.minSwipeDistance) {
            return;
        }

        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            if (deltaX > 0) {
                this.callbacks.onMove(DIRECTIONS.RIGHT);
            } else {
                this.callbacks.onMove(DIRECTIONS.LEFT);
            }
        } else {
            if (deltaY > 0) {
                this.callbacks.onMove(DIRECTIONS.DOWN);
            } else {
                this.callbacks.onMove(DIRECTIONS.UP);
            }
        }
    }

    /**
     * 將視窗滑鼠座標轉換為畫布網格座標
     * @param {number} clientX 
     * @param {number} clientY 
     * @returns {{ row: number, col: number } | null}
     */
    getCellFromMouse(clientX, clientY) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        const col = Math.floor((x - GRID_OFFSET) / (CELL_SIZE + CELL_GAP));
        const row = Math.floor((y - GRID_OFFSET) / (CELL_SIZE + CELL_GAP));

        if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;

        // 確認點擊在格子本體內（非邊界與間距）
        const cellX = GRID_OFFSET + col * (CELL_SIZE + CELL_GAP);
        const cellY = GRID_OFFSET + row * (CELL_SIZE + CELL_GAP);
        if (x < cellX || x > cellX + CELL_SIZE || y < cellY || y > cellY + CELL_SIZE) return null;

        return { row, col };
    }
}
