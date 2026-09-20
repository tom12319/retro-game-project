import { Entity } from './Entity.js';
import { CELL_SIZE } from '../config.js';

/**
 * 2048 Game Engine - 數字方塊實體
 */
export class Tile extends Entity {
    /**
     * @param {number} value 方塊數值 (2, 4, 8, ...)
     * @param {number} row 目前所在列 (0~3)
     * @param {number} col 目前所在欄 (0~3)
     */
    constructor(value, row, col) {
        super(0, 0, CELL_SIZE, CELL_SIZE);
        this.value = value;
        this.row = row;
        this.col = col;
        this.prevRow = row;
        this.prevCol = col;
        this.isNew = true;
        this.isMerged = false;
        this.scale = 1;
    }

    /**
     * 靜態渲染方法：繪製方塊
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} value 
     * @param {number} x 
     * @param {number} y 
     * @param {number} scale 
     * @param {Object} colors 當前主題調色盤
     */
    static drawTile(ctx, value, x, y, scale = 1, colors) {
        const size = CELL_SIZE * scale;
        const offset = (CELL_SIZE - size) / 2;

        ctx.fillStyle = (colors.cell && colors.cell[value]) || (colors.cell && colors.cell[0]) || '#cdc1b4';
        ctx.beginPath();
        ctx.roundRect(x + offset, y + offset, size, size, 6);
        ctx.fill();

        if (value !== 0) {
            ctx.fillStyle = value <= 4 ? colors.text.light : colors.text.dark;
            const baseFontSize = value < 100 ? 36 : value < 1000 ? 32 : 28;
            ctx.font = `bold ${Math.round(baseFontSize * scale)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(value.toString(), x + CELL_SIZE / 2, y + CELL_SIZE / 2);
        }
    }

    /**
     * 實例渲染
     * @param {CanvasRenderingContext2D} ctx 
     * @param {number} x 
     * @param {number} y 
     * @param {Object} colors 
     * @param {number} scale 
     */
    renderAt(ctx, x, y, colors, scale = 1) {
        Tile.drawTile(ctx, this.value, x, y, scale, colors);
    }
}
