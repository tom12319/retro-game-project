import { Entity } from './Entity.js';
import { SKILL_SCORE_INTERVAL, safeStorage } from '../config.js';

/**
 * 2048 Game Engine - 玩家控制實體
 * 管理得分、技能充能、選取模式、動態狙擊鏡動畫幀與速度狀態機
 */
export class Player extends Entity {
    constructor() {
        super(200, 200, 64, 64);

        // 分數與技能
        this.score = 0;
        this.bestScore = 0;
        this.skillCharges = 0;
        this.skillEarnedMilestones = 0;
        this.skillMode = false;
        this.hoverSkillCell = null;
        this.queuedDirection = null;

        // 物理與空間狀態
        this.targetX = 200;
        this.targetY = 200;
        this.vx = 0;
        this.vy = 0;
        this.speed = 0;

        // Sprite 動畫狀態機 ('idle' | 'moving' | 'aiming' | 'firing')
        this.state = 'idle';
        this.animTimer = 0;
        this.frameIndex = 0;
        this.fireTimer = 0;
        this.scale = 1.0;
        this.rotation = 0;

        // 64x64 Sprite Sheet 剪裁幀定義 (sx, sy, sw, sh)
        this.spriteFrames = {
            idle: [
                { sx: 0, sy: 0, sw: 64, sh: 64 },
                { sx: 0, sy: 0, sw: 64, sh: 64 }
            ],
            moving: [
                { sx: 0, sy: 0, sw: 64, sh: 64 },
                { sx: 0, sy: 0, sw: 64, sh: 64 }
            ],
            aiming: [
                { sx: 0, sy: 0, sw: 64, sh: 64 },
                { sx: 0, sy: 0, sw: 64, sh: 64 }
            ],
            firing: [
                { sx: 0, sy: 0, sw: 64, sh: 64 },
                { sx: 0, sy: 0, sw: 64, sh: 64 }
            ]
        };

        this.loadBestScore();
    }

    /**
     * 重置玩家局內狀態
     */
    reset() {
        this.score = 0;
        this.skillCharges = 0;
        this.skillEarnedMilestones = 0;
        this.skillMode = false;
        this.hoverSkillCell = null;
        this.queuedDirection = null;

        this.x = 200;
        this.y = 200;
        this.targetX = 200;
        this.targetY = 200;
        this.vx = 0;
        this.vy = 0;
        this.speed = 0;
        this.state = 'idle';
        this.fireTimer = 0;
    }

    /**
     * 設置準心瞄準目標像素座標
     * @param {number} tx 
     * @param {number} ty 
     */
    setTargetPosition(tx, ty) {
        this.targetX = tx;
        this.targetY = ty;
    }

    /**
     * 觸發消除技能發射反作用力動畫
     */
    triggerFire() {
        this.fireTimer = 300;
        this.state = 'firing';
    }

    /**
     * 更新玩家物理位移與 Sprite 狀態機
     * @param {number} dt Delta time in ms
     */
    update(dt) {
        const timeStep = dt || 16;

        // 平滑漸進追蹤目標座標 (Lerp)
        const dx = this.targetX - this.x;
        const dy = this.targetY - this.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0.5) {
            this.x += dx * 0.28;
            this.y += dy * 0.28;
        } else {
            this.x = this.targetX;
            this.y = this.targetY;
        }

        this.vx = dx / timeStep;
        this.vy = dy / timeStep;
        this.speed = dist;

        // 依據速度與開火狀態切換狀態機
        if (this.fireTimer > 0) {
            this.fireTimer -= timeStep;
            this.state = 'firing';
            this.scale = 1.0 + 0.45 * (this.fireTimer / 300);
            this.rotation = (Math.random() - 0.5) * 0.2;
        } else if (this.speed > 3) {
            this.state = 'moving';
            this.scale = 1.0 + Math.min(this.speed * 0.005, 0.2);
            this.rotation = Math.atan2(dy, dx) * 0.15;
        } else if (this.skillMode) {
            this.state = 'aiming';
            this.scale = 1.0 + 0.06 * Math.sin(performance.now() * 0.006);
            this.rotation = 0;
        } else {
            this.state = 'idle';
            this.scale = 1.0;
            this.rotation = 0;
        }

        // 動畫幀計時切換
        this.animTimer += timeStep;
        const currentFrames = this.spriteFrames[this.state] || this.spriteFrames.idle;
        if (this.animTimer > 100) {
            this.frameIndex = (this.frameIndex + 1) % currentFrames.length;
            this.animTimer = 0;
        }
    }

    /**
     * 渲染玩家狙擊鏡 Sprite（全面使用 context.drawImage 依狀態切換與裁切）
     * @param {CanvasRenderingContext2D} ctx 
     * @param {import('../systems/AssetLoader.js').AssetLoader} assetLoader 
     */
    render(ctx, assetLoader) {
        if (!this.skillMode && this.state !== 'firing') return;

        const crosshairImg = assetLoader ? assetLoader.getImage('crosshair') : null;
        if (!crosshairImg) return;

        const frames = this.spriteFrames[this.state] || this.spriteFrames.idle;
        const frame = frames[this.frameIndex % frames.length];

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);

        // 狙擊鏡外圍動態光環（開火時呈現紅色爆破光芒，瞄準時呈現紫色雷射光環）
        ctx.beginPath();
        ctx.arc(0, 0, 36, 0, Math.PI * 2);
        if (this.state === 'firing') {
            ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
            ctx.lineWidth = 3;
        } else {
            ctx.strokeStyle = 'rgba(155, 89, 182, 0.6)';
            ctx.lineWidth = 2;
        }
        ctx.stroke();

        // 裁切並繪製 Sprite Sheet 動畫幀: drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)
        const dw = 52;
        const dh = 52;
        ctx.drawImage(
            crosshairImg,
            frame.sx, frame.sy, frame.sw, frame.sh,
            -dw / 2, -dh / 2, dw, dh
        );

        ctx.restore();
    }

    /**
     * 載入歷史最高分
     */
    loadBestScore() {
        const saved = safeStorage.getItem('bestScore');
        if (saved) {
            this.bestScore = parseInt(saved, 10);
            return this.bestScore;
        }
        const old = safeStorage.getItem('2048_bestScore');
        if (old) {
            this.bestScore = parseInt(old, 10);
            return this.bestScore;
        }
        this.bestScore = 0;
        return 0;
    }

    /**
     * 增加分數並更新最高分與技能累積次數
     * @param {number} points 
     * @returns {{ earnedSkill: boolean }}
     */
    addScore(points) {
        this.score += points;
        if (this.score > this.bestScore) {
            this.bestScore = this.score;
            safeStorage.setItem('bestScore', this.bestScore.toString());
        }

        let earnedSkill = false;
        const milestones = Math.floor(this.score / SKILL_SCORE_INTERVAL);
        if (milestones > this.skillEarnedMilestones) {
            this.skillCharges += (milestones - this.skillEarnedMilestones);
            this.skillEarnedMilestones = milestones;
            earnedSkill = true;
        }

        return { earnedSkill };
    }

    /**
     * 消耗一次消除技能次數
     * @returns {boolean}
     */
    useSkillCharge() {
        if (this.skillCharges > 0) {
            this.skillCharges--;
            return true;
        }
        return false;
    }

    /**
     * 切換技能選取模式
     * @param {boolean} [forcedState]
     * @returns {boolean} 當前技能模式狀態
     */
    toggleSkillMode(forcedState) {
        if (typeof forcedState === 'boolean') {
            this.skillMode = forcedState;
        } else {
            this.skillMode = !this.skillMode;
        }
        if (!this.skillMode) {
            this.hoverSkillCell = null;
        }
        return this.skillMode;
    }
}
