import {
    DEFAULT_COLORS,
    DEFAULT_BG_START,
    DEFAULT_BG_END,
    DEFAULT_CONTAINER_BG,
    TILE_THEMES,
    TILE_VALUES,
    GRID_OFFSET,
    CELL_SIZE,
    CELL_GAP
} from '../config.js';
import { Physics } from '../systems/Physics.js';

/**
 * 2048 Game Engine - 抬頭顯示器與使用者介面管理器 (HUD)
 */
export class HUD {
    /**
     * @param {Object} options
     * @param {Function} options.onColorChange 回呼：顏色配置更新時通知重繪
     * @param {Function} options.onSettingsToggle 回呼：設定面板開啟/關閉時通知（用於暫停/恢復自動遊玩）
     */
    constructor(options = {}) {
        this.onColorChange = options.onColorChange || (() => {});
        this.onSettingsToggle = options.onSettingsToggle || (() => {});

        // 當前使用之色彩配置（深拷貝預設）
        this.colors = JSON.parse(JSON.stringify(DEFAULT_COLORS));

        // 快取常用 DOM 節點
        this.scoreEl = document.getElementById('score');
        this.bestScoreEl = document.getElementById('best-score');
        this.skillBtn = document.getElementById('skillBtn');
        this.hintBtn = document.getElementById('hintBtn');
        this.autoBtn = document.getElementById('autoBtn');
        this.hintDisplay = document.getElementById('hintDisplay');
        this.skillModeHint = document.getElementById('skillModeHint');
        this.gameOverOverlay = document.getElementById('gameOverOverlay');
        this.finalScoreEl = document.getElementById('finalScore');
        this.gameContainer = document.querySelector('.game-container');

        // 設定面板節點
        this.settingsPanel = document.getElementById('settingsPanel');
        this.settingsOverlay = document.getElementById('settingsOverlay');
        this.bgStartInput = document.getElementById('bgStart');
        this.bgStartHex = document.getElementById('bgStartHex');
        this.bgEndInput = document.getElementById('bgEnd');
        this.bgEndHex = document.getElementById('bgEndHex');
        this.containerBgInput = document.getElementById('containerBg');
        this.containerBgHex = document.getElementById('containerBgHex');
        this.tileThemeSelect = document.getElementById('tileTheme');
        this.tileColorGrid = document.getElementById('tileColorGrid');
        this.resetColorsBtn = document.getElementById('resetColorsBtn');

        this.initSettingsPanel();
    }

    /**
     * 更新即時分數與最高分
     * @param {number} score 
     * @param {number} bestScore 
     */
    updateScores(score, bestScore) {
        if (this.scoreEl) this.scoreEl.textContent = score;
        if (this.bestScoreEl) this.bestScoreEl.textContent = bestScore;
    }

    /**
     * 更新消除技能按鈕與狀態提示
     * @param {number} charges 
     * @param {boolean} isSkillMode 
     */
    updateSkillButton(charges, isSkillMode) {
        if (!this.skillBtn) return;
        this.skillBtn.textContent = `消除 (${charges})`;
        this.skillBtn.disabled = charges <= 0;
        if (isSkillMode) {
            this.skillBtn.classList.add('active');
            if (this.skillModeHint) this.skillModeHint.classList.add('show');
        } else {
            this.skillBtn.classList.remove('active');
            if (this.skillModeHint) this.skillModeHint.classList.remove('show');
        }
    }

    /**
     * 顯示 Game Over 面板
     * @param {number} score 
     */
    showGameOver(score) {
        if (this.finalScoreEl) this.finalScoreEl.textContent = score;
        if (this.gameOverOverlay) this.gameOverOverlay.style.display = 'flex';
    }

    /**
     * 隱藏 Game Over 面板
     */
    hideGameOver() {
        if (this.gameOverOverlay) this.gameOverOverlay.style.display = 'none';
    }

    /**
     * 設置建議文字與狀態
     * @param {string|null} text 
     */
    setHintText(text) {
        if (!this.hintDisplay) return;
        if (text) {
            this.hintDisplay.textContent = text;
            this.hintDisplay.classList.add('show');
        } else {
            this.hintDisplay.classList.remove('show');
        }
    }

    /**
     * 更新建議按鈕啟用樣式
     * @param {boolean} active 
     */
    setHintButtonActive(active) {
        if (!this.hintBtn) return;
        if (active) this.hintBtn.classList.add('active');
        else this.hintBtn.classList.remove('active');
    }

    /**
     * 更新自動遊玩按鈕啟用樣式
     * @param {boolean} active 
     */
    setAutoButtonActive(active) {
        if (!this.autoBtn) return;
        if (active) this.autoBtn.classList.add('active');
        else this.autoBtn.classList.remove('active');
    }

    /**
     * 在畫布上繪製方向箭頭提示
     * @param {CanvasRenderingContext2D} ctx 
     * @param {string} direction 
     * @param {number} width 
     * @param {number} height 
     */
    drawHintArrow(ctx, direction, width, height) {
        const cx = width / 2;
        const cy = height / 2;
        const size = 50;

        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#776e65';
        ctx.beginPath();

        if (direction === 'up') {
            ctx.moveTo(cx, cy - size);
            ctx.lineTo(cx - size * 0.6, cy + size * 0.3);
            ctx.lineTo(cx + size * 0.6, cy + size * 0.3);
        } else if (direction === 'down') {
            ctx.moveTo(cx, cy + size);
            ctx.lineTo(cx - size * 0.6, cy - size * 0.3);
            ctx.lineTo(cx + size * 0.6, cy - size * 0.3);
        } else if (direction === 'left') {
            ctx.moveTo(cx - size, cy);
            ctx.lineTo(cx + size * 0.3, cy - size * 0.6);
            ctx.lineTo(cx + size * 0.3, cy + size * 0.6);
        } else if (direction === 'right') {
            ctx.moveTo(cx + size, cy);
            ctx.lineTo(cx - size * 0.3, cy - size * 0.6);
            ctx.lineTo(cx - size * 0.3, cy + size * 0.6);
        }

        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    /**
     * 繪製技能滑鼠懸停十字高亮
     * @param {CanvasRenderingContext2D} ctx 
     * @param {{ row: number, col: number }} cell 
     */
    drawSkillHover(ctx, cell) {
        if (!cell) return;
        const affected = Physics.getSkillAffectedCells(cell.row, cell.col);
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#9b59b6';
        for (const { r, c } of affected) {
            const x = GRID_OFFSET + c * (CELL_SIZE + CELL_GAP);
            const y = GRID_OFFSET + r * (CELL_SIZE + CELL_GAP);
            ctx.beginPath();
            ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 6);
            ctx.fill();
        }
        ctx.restore();
    }

    /**
     * 繪製 AI 推薦使用消除技能時的高亮格子
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} row 
     * @param {number} col 
     */
    drawSkillHint(ctx, row, col) {
        const affected = Physics.getSkillAffectedCells(row, col);
        ctx.save();
        ctx.globalAlpha = 0.3;
        ctx.fillStyle = '#9b59b6';
        for (const { r, c } of affected) {
            const x = GRID_OFFSET + c * (CELL_SIZE + CELL_GAP);
            const y = GRID_OFFSET + r * (CELL_SIZE + CELL_GAP);
            ctx.beginPath();
            ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 6);
            ctx.fill();
        }
        ctx.restore();
    }

    // ===== 色彩與主題設定面板控制 =====

    initSettingsPanel() {
        // 開關面板事件
        const settingsBtn = document.getElementById('settingsBtn');
        const closeBtn = document.getElementById('settingsCloseBtn');

        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => this.openSettings());
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeSettings());
        }
        if (this.settingsOverlay) {
            this.settingsOverlay.addEventListener('click', () => this.closeSettings());
        }

        // 背板漸層色更換
        if (this.bgStartInput && this.bgEndInput) {
            this.bgStartInput.addEventListener('input', () => this.updateBackdrop());
            this.bgEndInput.addEventListener('input', () => this.updateBackdrop());
        }

        // 容器背景更換
        if (this.containerBgInput) {
            this.containerBgInput.addEventListener('input', () => this.updateContainerBg());
        }

        // 方塊主題更換
        if (this.tileThemeSelect) {
            this.tileThemeSelect.addEventListener('change', (e) => this.applyTileTheme(e.target.value));
        }

        // 恢復預設色
        if (this.resetColorsBtn) {
            this.resetColorsBtn.addEventListener('click', () => this.resetAllColors());
        }

        this.buildTileColorGrid();
    }

    openSettings() {
        if (this.settingsPanel) this.settingsPanel.classList.add('open');
        if (this.settingsOverlay) this.settingsOverlay.classList.add('show');
        this.onSettingsToggle(true);
    }

    closeSettings() {
        if (this.settingsPanel) this.settingsPanel.classList.remove('open');
        if (this.settingsOverlay) this.settingsOverlay.classList.remove('show');
        this.onSettingsToggle(false);
    }

    updateBackdrop() {
        if (!this.bgStartInput || !this.bgEndInput) return;
        const start = this.bgStartInput.value;
        const end = this.bgEndInput.value;
        document.body.style.background = `linear-gradient(135deg, ${start} 0%, ${end} 100%)`;
        if (this.bgStartHex) this.bgStartHex.textContent = start;
        if (this.bgEndHex) this.bgEndHex.textContent = end;
    }

    updateContainerBg() {
        if (!this.containerBgInput || !this.gameContainer) return;
        const color = this.containerBgInput.value;
        this.gameContainer.style.background = color;
        if (this.containerBgHex) this.containerBgHex.textContent = color;
    }

    applyTileTheme(themeName) {
        const theme = TILE_THEMES[themeName];
        if (!theme) return;
        this.colors = JSON.parse(JSON.stringify(theme));
        this.updateTileColorInputs();
        this.onColorChange();
    }

    buildTileColorGrid() {
        if (!this.tileColorGrid) return;
        this.tileColorGrid.innerHTML = '';
        for (const val of TILE_VALUES) {
            const item = document.createElement('div');
            item.className = 'tile-color-item';

            const label = document.createElement('label');
            label.textContent = val;

            const input = document.createElement('input');
            input.type = 'color';
            input.id = 'tileColor_' + val;
            input.value = this.colors.cell[val] || '#000000';
            input.addEventListener('input', () => {
                this.colors.cell[val] = input.value;
                this.onColorChange();
            });

            item.appendChild(label);
            item.appendChild(input);
            this.tileColorGrid.appendChild(item);
        }
    }

    updateTileColorInputs() {
        for (const val of TILE_VALUES) {
            const input = document.getElementById('tileColor_' + val);
            if (input) input.value = this.colors.cell[val] || '#000000';
        }
    }

    resetAllColors() {
        this.colors = JSON.parse(JSON.stringify(DEFAULT_COLORS));
        if (this.bgStartInput) this.bgStartInput.value = DEFAULT_BG_START;
        if (this.bgEndInput) this.bgEndInput.value = DEFAULT_BG_END;
        if (this.containerBgInput) this.containerBgInput.value = DEFAULT_CONTAINER_BG;
        if (this.tileThemeSelect) this.tileThemeSelect.value = 'classic';
        this.updateBackdrop();
        this.updateContainerBg();
        this.updateTileColorInputs();
        this.onColorChange();
    }
}
