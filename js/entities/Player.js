import { Entity } from './Entity.js';
import { SKILL_SCORE_INTERVAL, safeStorage } from '../config.js';

/**
 * 2048 Game Engine - 玩家控制實體
 * 管理得分、技能充能、選取模式與輸入狀態
 */
export class Player extends Entity {
    constructor() {
        super();
        this.score = 0;
        this.bestScore = 0;
        this.skillCharges = 0;
        this.skillEarnedMilestones = 0;
        this.skillMode = false;
        this.hoverSkillCell = null;
        this.queuedDirection = null;

        this.loadBestScore();
    }

    /**
     * 重置玩家遊戲局內狀態
     */
    reset() {
        this.score = 0;
        this.skillCharges = 0;
        this.skillEarnedMilestones = 0;
        this.skillMode = false;
        this.hoverSkillCell = null;
        this.queuedDirection = null;
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
