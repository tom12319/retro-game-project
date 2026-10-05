import {
    GRID_SIZE,
    CELL_SIZE,
    CELL_GAP,
    GRID_OFFSET,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    SLIDE_DURATION,
    POP_DURATION,
    DIRECTION_TEXT,
    easeOutQuad
} from '../config.js';
import { Grid } from '../entities/Grid.js';
import { Player } from '../entities/Player.js';
import { Tile } from '../entities/Tile.js';
import { Physics } from '../systems/Physics.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { assetLoader } from '../systems/AssetLoader.js';
import { GameLoop } from './GameLoop.js';
import { InputHandler } from './InputHandler.js';
import { HUD } from '../ui/HUD.js';

/**
 * 2048 Game Engine - 核心遊戲控制器 (Facade)
 * 協調整合實體、子系統、主循環、音訊與 UI
 */
export class Game {
    /**
     * @param {HTMLCanvasElement} canvas 
     * @param {import('../systems/AssetLoader.js').AssetLoader} [loader=assetLoader]
     */
    constructor(canvas, loader = assetLoader) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.assetLoader = loader;

        // 核心子系統與實體
        this.grid = new Grid(GRID_SIZE);
        this.player = new Player();
        this.particles = new ParticleSystem();
        this.ai = new AISystem();

        // 動畫狀態
        this.isAnimating = false;
        this.animationStartTime = 0;
        this.consumedTiles = [];

        // 遊戲流程狀態
        this.gameOver = false;
        this.hintMode = false;
        this.autoMode = false;
        this.autoTimeout = null;
        this.autoPausedBySettings = false;
        this.currentHint = null; // { type: 'arrow', direction } | { type: 'skill', row, col }

        // 初始化 HUD 介面
        this.hud = new HUD({
            onColorChange: () => this.draw(),
            onSettingsToggle: (isOpen) => this.handleSettingsToggle(isOpen),
            onToggleMute: () => this.toggleMute()
        });

        // 初始化輸入處理器
        this.input = new InputHandler(this.canvas, {
            onMove: (dir) => this.requestMove(dir),
            onToggleSkill: () => this.toggleSkillMode(),
            onCancelSkill: () => this.cancelSkillMode(),
            onRestart: () => this.onRestartKey(),
            onToggleMute: () => this.toggleMute(),
            onSkillClick: (r, c) => this.executeSkill(r, c),
            onSkillHover: (cell, coords) => this.handleSkillHover(cell, coords),
            onSkillLeave: () => this.handleSkillLeave(),
            onPointerMove: (coords) => this.handlePointerMove(coords),
            onUserInteract: () => this.assetLoader.unlockAudio()
        });

        // 綁定 UI 按鈕事件
        this.initButtons();

        // 初始化主迴圈
        this.loop = new GameLoop(
            (dt) => this.update(dt),
            () => this.render()
        );
    }

    /**
     * 啟動遊戲應用
     */
    start() {
        this.initGame();
        this.loop.start();
        this.assetLoader.startBGM();
    }

    /**
     * 切換靜音狀態
     */
    toggleMute() {
        const isMuted = this.assetLoader.toggleMute();
        this.hud.updateMuteButton(isMuted);
    }

    /**
     * 綁定 DOM 頂層按鈕
     */
    initButtons() {
        const restartBtn = document.getElementById('restartBtn');
        if (restartBtn) {
            restartBtn.addEventListener('click', () => {
                this.assetLoader.unlockAudio();
                this.restart();
            });
        }

        const skillBtn = document.getElementById('skillBtn');
        if (skillBtn) {
            skillBtn.addEventListener('click', () => {
                this.assetLoader.unlockAudio();
                this.toggleSkillMode();
            });
        }

        const hintBtn = document.getElementById('hintBtn');
        if (hintBtn) {
            hintBtn.addEventListener('click', () => {
                this.assetLoader.unlockAudio();
                this.toggleHintMode();
            });
        }

        const autoBtn = document.getElementById('autoBtn');
        if (autoBtn) {
            autoBtn.addEventListener('click', () => {
                this.assetLoader.unlockAudio();
                this.toggleAutoPlay();
            });
        }
    }

    /**
     * 初始化一局全新遊戲
     */
    initGame() {
        this.grid.reset();
        this.player.reset();
        this.particles.reset();
        this.gameOver = false;
        this.isAnimating = false;
        this.consumedTiles = [];
        this.currentHint = null;

        this.input.setSkillMode(false);
        this.hud.hideGameOver();
        this.hud.updateScores(this.player.score, this.player.bestScore);
        this.hud.updateSkillButton(this.player.skillCharges, false);
        this.hud.updateMuteButton(this.assetLoader.isMuted);

        // 生成初始兩個方塊
        this.grid.addRandomTile();
        this.grid.addRandomTile();

        this.draw();
    }

    /**
     * 重新開始遊戲按鈕邏輯
     */
    restart() {
        this.stopAutoPlay();
        this.clearHint();
        this.initGame();
        if (this.hintMode) {
            this.showHint();
        }
    }

    onRestartKey() {
        if (this.gameOver) {
            this.initGame();
        }
    }

    /**
     * 請求移動（支援輸入佇列緩存）
     * @param {string} direction 
     */
    requestMove(direction) {
        if (this.autoMode || this.gameOver) return;

        if (this.isAnimating) {
            this.player.queuedDirection = direction;
        } else {
            this.move(direction);
        }
    }

    /**
     * 執行方塊滑動與合併
     * @param {string} direction 
     * @param {boolean} [isAuto=false] 
     */
    move(direction, isAuto = false) {
        if (this.gameOver || this.isAnimating) return;
        if (this.autoMode && !isAuto) return;

        const moveResult = Physics.move(this.grid, direction);

        if (moveResult.moved) {
            this.consumedTiles = moveResult.consumedTiles;

            // 產生合併粒子爆發與碰撞/跳躍音效反饋
            if (this.consumedTiles.length > 0) {
                this.assetLoader.playCollision(0.45);
                this.assetLoader.playJump(0.35);
            } else {
                this.assetLoader.playCollision(0.2);
            }

            for (const ct of this.consumedTiles) {
                const targetX = GRID_OFFSET + ct.toCol * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                const targetY = GRID_OFFSET + ct.toRow * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                const color = (this.hud.colors.cell && this.hud.colors.cell[ct.value * 2]) || '#f2b179';
                this.particles.emitMerge(targetX, targetY, color);
            }

            // 更新得分與技能
            this.player.addScore(moveResult.scoreGained);
            this.hud.updateScores(this.player.score, this.player.bestScore);
            this.hud.updateSkillButton(this.player.skillCharges, this.player.skillMode);

            // 生成新方塊
            this.grid.addRandomTile();

            // 啟動動畫過渡
            this.isAnimating = true;
            this.animationStartTime = performance.now();
        }
    }

    /**
     * 技能模式切換
     */
    toggleSkillMode() {
        if (this.player.skillCharges <= 0 || this.gameOver || this.isAnimating || this.autoMode) return;

        const active = this.player.toggleSkillMode();
        this.input.setSkillMode(active);

        if (active) {
            if (this.hintMode) {
                this.hintMode = false;
                this.hud.setHintButtonActive(false);
                this.clearHint();
            }
            this.ai.cancelPending();
        }

        this.hud.updateSkillButton(this.player.skillCharges, active);
        this.draw();
    }

    cancelSkillMode() {
        if (this.player.skillMode) {
            this.player.toggleSkillMode(false);
            this.input.setSkillMode(false);
            this.hud.updateSkillButton(this.player.skillCharges, false);
            this.draw();
        }
    }

    /**
     * 執行消除十字範圍技能
     * @param {number} row 
     * @param {number} col 
     */
    executeSkill(row, col) {
        const affected = Physics.getSkillAffectedCells(row, col);

        // 檢查是否有至少一個方塊可消除
        let hasTile = false;
        for (const { r, c } of affected) {
            if (this.grid.get(r, c)) {
                hasTile = true;
                break;
            }
        }
        if (!hasTile) return;

        // 鎖定中心座標
        const centerX = GRID_OFFSET + col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
        const centerY = GRID_OFFSET + row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
        this.player.setTargetPosition(centerX, centerY);

        // 觸發狙擊鏡開火反作用力動畫與震撼爆炸音效
        this.player.triggerFire();
        this.assetLoader.playBoom(0.85);

        // 消除方塊並觸發粒子效果
        for (const { r, c } of affected) {
            if (this.grid.get(r, c)) {
                const px = GRID_OFFSET + c * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                const py = GRID_OFFSET + r * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
                this.particles.emitSkillClear(px, py);
                this.grid.set(r, c, null);
            }
        }

        // 扣除次數並退出技能模式
        this.player.useSkillCharge();
        this.player.toggleSkillMode(false);
        this.input.setSkillMode(false);
        this.hud.updateSkillButton(this.player.skillCharges, false);

        this.ai.cancelPending();
        this.draw();

        if (Physics.isGameOver(this.grid)) {
            this.gameOver = true;
            this.hud.showGameOver(this.player.score);
        } else if (this.hintMode) {
            this.showHint();
        }
    }

    handlePointerMove(coords) {
        if (coords && this.player.skillMode) {
            this.player.setTargetPosition(coords.x, coords.y);
        }
    }

    handleSkillHover(cell, coords) {
        if (coords) {
            this.player.setTargetPosition(coords.x, coords.y);
        } else if (cell) {
            const tx = GRID_OFFSET + cell.col * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
            const ty = GRID_OFFSET + cell.row * (CELL_SIZE + CELL_GAP) + CELL_SIZE / 2;
            this.player.setTargetPosition(tx, ty);
        }

        const newHover = cell ? { row: cell.row, col: cell.col } : null;
        const prev = this.player.hoverSkillCell;
        const changed = (newHover === null) !== (prev === null) ||
            (newHover && prev && (newHover.row !== prev.row || newHover.col !== prev.col));

        if (changed) {
            this.player.hoverSkillCell = newHover;
            this.draw();
        }
    }

    handleSkillLeave() {
        if (this.player.hoverSkillCell) {
            this.player.hoverSkillCell = null;
            this.draw();
        }
    }

    /**
     * 建議模式切換
     */
    toggleHintMode() {
        this.hintMode = !this.hintMode;
        this.hud.setHintButtonActive(this.hintMode);
        if (this.hintMode) {
            this.showHint();
        } else {
            this.clearHint();
        }
    }

    showHint() {
        if (this.gameOver || this.isAnimating) return;
        this.hud.setHintText('建議：計算中…');

        this.ai.getBestMoveAsync(this.grid, (result) => {
            if (this.gameOver || this.isAnimating) {
                this.hud.setHintText(null);
                this.currentHint = null;
                return;
            }

            // 判斷是否推薦消除技能
            if (this.ai.shouldUseSkill(result, this.player.skillCharges)) {
                const r = result.skillCell.row;
                const c = result.skillCell.col;
                this.hud.setHintText(`建議：使用消除（第${r + 1}列，第${c + 1}行）`);
                this.currentHint = { type: 'skill', row: r, col: c };
                this.draw();
                return;
            }

            if (!result.direction) {
                this.hud.setHintText(null);
                this.currentHint = null;
                return;
            }

            this.hud.setHintText(`建議：${DIRECTION_TEXT[result.direction]}`);
            this.currentHint = { type: 'arrow', direction: result.direction };
            this.draw();
        });
    }

    clearHint() {
        this.hud.setHintText(null);
        this.currentHint = null;
        if (!this.isAnimating) {
            this.draw();
        }
    }

    /**
     * 自動遊玩控制
     */
    toggleAutoPlay() {
        if (this.autoMode) {
            this.stopAutoPlay();
        } else {
            this.startAutoPlay();
        }
    }

    startAutoPlay() {
        this.autoMode = true;
        this.hud.setAutoButtonActive(true);
        this.scheduleAutoMove();
    }

    stopAutoPlay() {
        this.autoMode = false;
        this.hud.setAutoButtonActive(false);
        clearTimeout(this.autoTimeout);
        this.autoTimeout = null;
    }

    scheduleAutoMove() {
        if (!this.autoMode || this.gameOver || this.isAnimating || this.autoPausedBySettings) return;

        this.ai.getBestMoveAsync(this.grid, (result) => {
            if (!this.autoMode || this.gameOver || this.isAnimating || this.autoPausedBySettings) return;

            if (this.ai.shouldUseSkill(result, this.player.skillCharges)) {
                this.executeSkill(result.skillCell.row, result.skillCell.col);
                this.autoTimeout = setTimeout(() => this.scheduleAutoMove(), 100);
            } else if (result.direction) {
                this.move(result.direction, true);
            } else {
                this.stopAutoPlay();
            }
        });
    }

    handleSettingsToggle(isOpen) {
        if (isOpen) {
            if (this.autoMode && !this.autoPausedBySettings) {
                this.autoPausedBySettings = true;
                clearTimeout(this.autoTimeout);
            }
        } else {
            if (this.autoPausedBySettings) {
                this.autoPausedBySettings = false;
                this.scheduleAutoMove();
            }
        }
    }

    /**
     * 主迴圈更新邏輯
     * @param {number} dt 
     */
    update(dt) {
        this.particles.update(dt);
        this.player.update(dt);
    }

    /**
     * 靜態繪製主畫面
     */
    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.grid.drawBackground(this.ctx, this.hud.colors, this.canvas.width, this.canvas.height);
        this.grid.drawStaticTiles(this.ctx, this.hud.colors);
        this.particles.render(this.ctx);

        if (this.player.skillMode && this.player.hoverSkillCell) {
            this.hud.drawSkillHover(this.ctx, this.player.hoverSkillCell);
        }

        // 渲染玩家狙擊鏡 Sprite 動畫幀
        this.player.render(this.ctx, this.assetLoader);

        if (this.currentHint) {
            if (this.currentHint.type === 'arrow') {
                this.hud.drawHintArrow(this.ctx, this.currentHint.direction, this.canvas.width, this.canvas.height);
            } else if (this.currentHint.type === 'skill') {
                this.hud.drawSkillHint(this.ctx, this.currentHint.row, this.currentHint.col);
            }
        }
    }

    /**
     * 動態動畫幀繪製
     * @param {number} elapsed 
     */
    drawAnimated(elapsed) {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.grid.drawBackground(this.ctx, this.hud.colors, this.canvas.width, this.canvas.height);

        const slideProgress = Math.min(elapsed / SLIDE_DURATION, 1);
        const easedSlide = easeOutQuad(slideProgress);
        const popProgress = elapsed > SLIDE_DURATION ? Math.min((elapsed - SLIDE_DURATION) / POP_DURATION, 1) : 0;
        const sliding = slideProgress < 1;

        // 1. 繪製滑動過程中的被合併方塊
        if (sliding) {
            for (const ct of this.consumedTiles) {
                const fromX = GRID_OFFSET + ct.fromCol * (CELL_SIZE + CELL_GAP);
                const fromY = GRID_OFFSET + ct.fromRow * (CELL_SIZE + CELL_GAP);
                const toX = GRID_OFFSET + ct.toCol * (CELL_SIZE + CELL_GAP);
                const toY = GRID_OFFSET + ct.toRow * (CELL_SIZE + CELL_GAP);
                const x = fromX + (toX - fromX) * easedSlide;
                const y = fromY + (toY - fromY) * easedSlide;
                Tile.drawTile(this.ctx, ct.value, x, y, 1, this.hud.colors);
            }
        }

        // 2. 繪製網格上的當前方塊
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                const tile = this.grid.get(row, col);
                if (!tile) continue;

                const finalX = GRID_OFFSET + col * (CELL_SIZE + CELL_GAP);
                const finalY = GRID_OFFSET + row * (CELL_SIZE + CELL_GAP);

                if (tile.isMerged) {
                    if (!sliding) {
                        const scale = 1 + 0.2 * Math.sin(popProgress * Math.PI);
                        Tile.drawTile(this.ctx, tile.value, finalX, finalY, scale, this.hud.colors);
                    }
                } else if (tile.isNew) {
                    if (!sliding) {
                        const scale = easeOutQuad(popProgress);
                        Tile.drawTile(this.ctx, tile.value, finalX, finalY, scale, this.hud.colors);
                    }
                } else {
                    if (sliding) {
                        const fromX = GRID_OFFSET + tile.prevCol * (CELL_SIZE + CELL_GAP);
                        const fromY = GRID_OFFSET + tile.prevRow * (CELL_SIZE + CELL_GAP);
                        const x = fromX + (finalX - fromX) * easedSlide;
                        const y = fromY + (finalY - fromY) * easedSlide;
                        Tile.drawTile(this.ctx, tile.value, x, y, 1, this.hud.colors);
                    } else {
                        Tile.drawTile(this.ctx, tile.value, finalX, finalY, 1, this.hud.colors);
                    }
                }
            }
        }

        this.particles.render(this.ctx);

        if (this.player.skillMode && this.player.hoverSkillCell) {
            this.hud.drawSkillHover(this.ctx, this.player.hoverSkillCell);
        }

        // 渲染玩家狙擊鏡 Sprite 動畫幀
        this.player.render(this.ctx, this.assetLoader);
    }

    /**
     * 主迴圈渲染入口
     */
    render() {
        if (this.isAnimating) {
            const elapsed = performance.now() - this.animationStartTime;
            const totalDuration = SLIDE_DURATION + POP_DURATION;

            if (elapsed >= totalDuration) {
                this.isAnimating = false;
                this.consumedTiles = [];
                this.grid.resetAnimationFlags();
                this.draw();

                if (Physics.isGameOver(this.grid)) {
                    this.gameOver = true;
                    this.hud.showGameOver(this.player.score);
                    return;
                }

                // 優先處理輸入佇列
                if (this.player.queuedDirection) {
                    const nextDir = this.player.queuedDirection;
                    this.player.queuedDirection = null;
                    this.move(nextDir);
                    return;
                }

                if (this.hintMode) {
                    this.showHint();
                }

                if (this.autoMode && !this.autoPausedBySettings) {
                    this.autoTimeout = setTimeout(() => this.scheduleAutoMove(), 100);
                }
                return;
            }

            this.drawAnimated(elapsed);
        } else {
            this.draw();
        }
    }
}
