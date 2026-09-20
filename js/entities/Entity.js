/**
 * 2048 Game Engine - 實體基類
 */
export class Entity {
    /**
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.active = true;
    }

    /**
     * 更新實體邏輯
     * @param {number} dt Delta time in milliseconds
     */
    update(dt) {
        // 由衍生類別實現
    }

    /**
     * 渲染實體
     * @param {CanvasRenderingContext2D} ctx
     */
    render(ctx) {
        // 由衍生類別實現
    }
}
