import { GRID_SIZE, DIRECTIONS, VECTORS } from '../config.js';
import { Tile } from '../entities/Tile.js';

/**
 * 2048 Game Engine - 物理與移動合併判定系統
 */
export class Physics {
    /**
     * 獲取移動方向之列/欄遍歷順序
     * @param {string} direction 
     * @returns {{ rows: number[], cols: number[] }}
     */
    static getTraversals(direction) {
        const rows = [0, 1, 2, 3];
        const cols = [0, 1, 2, 3];
        const vector = VECTORS[direction];
        if (vector.r === 1) rows.reverse();
        if (vector.c === 1) cols.reverse();
        return { rows, cols };
    }

    /**
     * 尋找方塊沿向量移動的最遠空格座標及下一格位置
     * @param {import('../entities/Grid.js').Grid} grid 
     * @param {number} row 
     * @param {number} col 
     * @param {{ r: number, c: number }} vector 
     * @returns {{ farthestRow: number, farthestCol: number, nextRow: number, nextCol: number }}
     */
    static findFarthestPosition(grid, row, col, vector) {
        let prevRow, prevCol;
        let r = row, c = col;
        do {
            prevRow = r;
            prevCol = c;
            r += vector.r;
            c += vector.c;
        } while (r >= 0 && r < GRID_SIZE && c >= 0 && c < GRID_SIZE && grid.get(r, c) === null);

        return { farthestRow: prevRow, farthestCol: prevCol, nextRow: r, nextCol: c };
    }

    /**
     * 執行一次滑動操作
     * @param {import('../entities/Grid.js').Grid} grid 
     * @param {string} direction 
     * @returns {{ moved: boolean, scoreGained: number, consumedTiles: Array }}
     */
    static move(grid, direction) {
        // 重置動畫狀態，記錄移動前位置
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const tile = grid.get(r, c);
                if (tile) {
                    tile.prevRow = r;
                    tile.prevCol = c;
                    tile.isNew = false;
                    tile.isMerged = false;
                }
            }
        }

        const consumedTiles = [];
        let moved = false;
        let scoreGained = 0;
        const vector = VECTORS[direction];
        if (!vector) return { moved: false, scoreGained: 0, consumedTiles: [] };

        const traversals = this.getTraversals(direction);

        for (const row of traversals.rows) {
            for (const col of traversals.cols) {
                const tile = grid.get(row, col);
                if (!tile) continue;

                const { farthestRow, farthestCol, nextRow, nextCol } = this.findFarthestPosition(grid, row, col, vector);

                const inBounds = nextRow >= 0 && nextRow < GRID_SIZE && nextCol >= 0 && nextCol < GRID_SIZE;
                const nextTile = inBounds ? grid.get(nextRow, nextCol) : null;

                if (nextTile && nextTile.value === tile.value && !nextTile.isMerged) {
                    // 合併
                    const mergedValue = tile.value * 2;
                    const mergedTile = new Tile(mergedValue, nextRow, nextCol);
                    mergedTile.isNew = false;
                    mergedTile.isMerged = true;
                    mergedTile.prevRow = nextRow;
                    mergedTile.prevCol = nextCol;

                    // 記錄被合併的方塊（用於滑動動畫繪製）
                    consumedTiles.push({
                        value: nextTile.value,
                        fromRow: nextTile.prevRow,
                        fromCol: nextTile.prevCol,
                        toRow: nextRow,
                        toCol: nextCol
                    });
                    consumedTiles.push({
                        value: tile.value,
                        fromRow: row,
                        fromCol: col,
                        toRow: nextRow,
                        toCol: nextCol
                    });

                    grid.set(nextRow, nextCol, mergedTile);
                    grid.set(row, col, null);
                    scoreGained += mergedValue;
                    moved = true;
                } else if (farthestRow !== row || farthestCol !== col) {
                    // 移動
                    grid.set(farthestRow, farthestCol, tile);
                    tile.row = farthestRow;
                    tile.col = farthestCol;
                    grid.set(row, col, null);
                    moved = true;
                }
            }
        }

        return { moved, scoreGained, consumedTiles };
    }

    /**
     * 檢查遊戲是否無步可走 (Game Over)
     * @param {import('../entities/Grid.js').Grid} grid 
     * @returns {boolean}
     */
    static isGameOver(grid) {
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                if (grid.get(row, col) === null) return false;
            }
        }

        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                const tile = grid.get(row, col);
                if (!tile) continue;

                const rightTile = grid.get(row, col + 1);
                if (col < GRID_SIZE - 1 && rightTile && tile.value === rightTile.value) {
                    return false;
                }

                const bottomTile = grid.get(row + 1, col);
                if (row < GRID_SIZE - 1 && bottomTile && tile.value === bottomTile.value) {
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * 獲取受消除技能影響的格子座標（十字範圍）
     * @param {number} row 
     * @param {number} col 
     * @returns {Array<{r: number, c: number}>}
     */
    static getSkillAffectedCells(row, col) {
        return [
            { r: row, c: col },
            { r: row - 1, c: col },
            { r: row + 1, c: col },
            { r: row, c: col - 1 },
            { r: row, c: col + 1 }
        ].filter(cell => cell.r >= 0 && cell.r < GRID_SIZE && cell.c >= 0 && cell.c < GRID_SIZE);
    }
}
