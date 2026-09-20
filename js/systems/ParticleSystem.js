/**
 * 2048 Game Engine - 粒子特效系統
 * 用於方塊合併打擊感與消除技能之視覺反饋爆破效果
 */
export class Particle {
    constructor(x, y, vx, vy, color, size, life = 500) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.maxLife = life;
        this.life = life;
        this.alpha = 1;
    }

    update(dt) {
        this.life -= dt;
        this.x += this.vx * (dt / 16);
        this.y += this.vy * (dt / 16);
        this.vx *= 0.95; // 阻尼
        this.vy *= 0.95;
        this.alpha = Math.max(0, this.life / this.maxLife);
    }

    render(ctx) {
        if (this.alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

export class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    /**
     * 重置所有粒子
     */
    reset() {
        this.particles = [];
    }

    /**
     * 方塊合併爆發特效
     * @param {number} x 
     * @param {number} y 
     * @param {string} color 
     * @param {number} [count=12] 
     */
    emitMerge(x, y, color = '#f2b179', count = 10) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = 2 + Math.random() * 3;
            const life = 300 + Math.random() * 200;
            this.particles.push(new Particle(x, y, vx, vy, color, size, life));
        }
    }

    /**
     * 消除技能爆炸特效
     * @param {number} x 
     * @param {number} y 
     * @param {string} [color='#9b59b6'] 
     * @param {number} [count=16] 
     */
    emitSkillClear(x, y, color = '#ab6dc4', count = 16) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 2 + Math.random() * 4;
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = 3 + Math.random() * 3;
            const life = 400 + Math.random() * 250;
            this.particles.push(new Particle(x, y, vx, vy, color, size, life));
        }
    }

    /**
     * 更新粒子狀態
     * @param {number} dt Delta time in ms
     */
    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(dt);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
    }

    /**
     * 渲染所有粒子
     * @param {CanvasRenderingContext2D} ctx 
     */
    render(ctx) {
        for (const p of this.particles) {
            p.render(ctx);
        }
    }
}
