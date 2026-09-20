/**
 * 2048 Game Engine - 遊戲主迴圈
 * 負責計算 Delta Time 與調度更新 / 渲染生命週期
 */
export class GameLoop {
    /**
     * @param {Function} updateFn (dt: number) => void
     * @param {Function} renderFn (dt: number) => void
     */
    constructor(updateFn, renderFn) {
        this.updateFn = updateFn;
        this.renderFn = renderFn;
        this.isRunning = false;
        this.isPaused = false;
        this.lastTime = 0;
        this.animationFrameId = null;

        this.loop = this.loop.bind(this);
    }

    start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    stop() {
        this.isRunning = false;
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    pause() {
        this.isPaused = true;
    }

    resume() {
        if (!this.isPaused) return;
        this.isPaused = false;
        this.lastTime = performance.now();
    }

    loop(currentTime) {
        if (!this.isRunning) return;

        let dt = currentTime - this.lastTime;
        this.lastTime = currentTime;

        // 避免分頁切換時累積過大的 Delta Time
        if (dt > 100) dt = 100;

        if (!this.isPaused) {
            if (this.updateFn) this.updateFn(dt);
            if (this.renderFn) this.renderFn(dt);
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }
}
