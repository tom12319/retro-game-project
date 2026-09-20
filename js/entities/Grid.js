import { GRID_SIZE, CELL_SIZE, CELL_GAP, GRID_OFFSET } from '../config.js';
import { Tile } from './Tile.js';

/**
 * 2048 Game Engine - 網格管理器
 */
export class Grid {
    constructor(size = GRID_SIZE) {
        this.size = size;
        this.cells = [];
        this.reset();
    }

    /**
     * 重設網格為空
     */
    reset() {
        this.cells = Array(this.size).fill(null).map(() => Array(this.size).fill(null));
    }

    /**
     * 獲取指定位置的方塊
     * @param {number} row 
     * @param {number} col 
     * @returns {Tile|null}
     */
    get(row, col) {
        if (row < 0 || row >= this.size || col < 0 || col >= this.size) return null;
        return this.cells[row][col];
    }

    /**
     * 設定指定位置的方塊
     * @param {number} row 
     * @param {number} col 
     * @param {Tile|null} tile 
     */
    set(row, col, tile) {
        this.cells[row][col] = tile;
        if (tile) {
            tile.row = row;
            tile.col = col;
        }
    }

    /**
     * 獲取所有空格
     * @returns {Array<{row: number, col: number}>}
     */
    getEmptyCells() {
        const empty = [];
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.cells[r][c] === null) {
                    empty.push({ row: r, col: c });
                }
            }
        }
        return empty;
    }

    /**
     * 隨機生成新方塊（90% 為 2，10% 為 4）
     * @returns {Tile|null}
     */
    addRandomTile() {
        const emptyCells = this.getEmptyCells();
        if (emptyCells.length === 0) return null;
        const { row, col } = emptyCells[Math.floor(Math.random() * emptyCells.length)];
        const value = Math.random() < 0.9 ? 2 : 4;
        const tile = new Tile(value, row, col);
        this.cells[row][col] = tile;
        return tile;
    }

    /**
     * 遍歷所有非空格
     * @param {(tile: Tile, row: number, col: number) => void} callback 
     */
    eachTile(callback) {
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                if (this.cells[r][c]) {
                    callback(this.cells[r][c], r, c);
                }
            }
        }
    }

    /**
     * 重設所有方塊的動畫狀態旗標
     */
    resetAnimationFlags() {
        this.eachTile(tile => {
            tile.isNew = false;
            tile.isMerged = false;
            tile.prevRow = tile.row;
            tile.prevCol = tile.col;
        });
    }

    /**
     * 轉為 1D 數值陣列（長度 16，供 AI Web Worker 使用）
     * @returns {number[]}
     */
    to1DArray() {
        const board = new Array(this.size * this.size);
        for (let r = 0; r < this.size; r++) {
            for (let c = 0; c < this.size; c++) {
                board[r * this.size + c] = this.cells[r][c] ? this.cells[r][c].value : 0;
            }
        }
        return board;
    }

    /**
     * 轉為 2D 數值陣列（4x4，供同步 AI 使用）
     * @returns {number[][]}
     */
    to2DArray() {
        return this.cells.map(row => row.map(tile => tile ? tile.value : 0));
    }

    /**
     * 繪製網格背景底色與空格
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} colors 
     * @param {number} width 
     * @param {number} height 
     */
    drawBackground(ctx, colors, width, height) {
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);

        for (let row = 0; row < this.size; row++) {
            for (let col = 0; col < this.size; col++) {
                const x = GRID_OFFSET + col * (CELL_SIZE + CELL_GAP);
                const y = GRID_OFFSET + row * (CELL_SIZE + CELL_GAP);
                ctx.fillStyle = (colors.cell && colors.cell[0]) || '#cdc1b4';
                ctx.beginPath();
                ctx.roundRect(x, y, CELL_SIZE, CELL_SIZE, 6);
                ctx.fill();
            }
        }
    }

    /**
     * 繪製靜態方塊
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Object} colors 
     */
    drawStaticTiles(ctx, colors) {
        this.eachTile(tile => {
            const x = GRID_OFFSET + tile.col * (CELL_SIZE + CELL_GAP);
            const y = GRID_OFFSET + tile.row * (CELL_SIZE + CELL_GAP);
            tile.renderAt(ctx, x, y, colors, 1);
        });
    }
}
