/**
 * 2048 Game Engine - 全域設定與常數配置模組
 */

// CanvasRenderingContext2D roundRect polyfill
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r) {
        if (typeof r === 'undefined') r = 0;
        this.beginPath();
        this.moveTo(x + r, y);
        this.arcTo(x + w, y, x + w, y + h, r);
        this.arcTo(x + w, y + h, x, y + h, r);
        this.arcTo(x, y + h, x, y, r);
        this.arcTo(x, y, x + w, y, r);
        this.closePath();
        return this;
    };
}

// 網格與畫布尺寸配置
export const GRID_SIZE = 4;
export const CELL_SIZE = 90;
export const CELL_GAP = 10;
export const GRID_OFFSET = 5;
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 400;

// 動畫時長（毫秒）
export const SLIDE_DURATION = 50;
export const POP_DURATION = 50;

// 技能配置
export const SKILL_SCORE_INTERVAL = 500; // 每累積 500 分獲得 1 次消除技能

// 方向常數與向量定義
export const DIRECTIONS = {
    UP: 'up',
    DOWN: 'down',
    LEFT: 'left',
    RIGHT: 'right'
};

export const VECTORS = {
    [DIRECTIONS.UP]: { r: -1, c: 0 },
    [DIRECTIONS.DOWN]: { r: 1, c: 0 },
    [DIRECTIONS.LEFT]: { r: 0, c: -1 },
    [DIRECTIONS.RIGHT]: { r: 0, c: 1 }
};

export const DIRECTION_TEXT = {
    [DIRECTIONS.UP]: '向上 \u2191',
    [DIRECTIONS.DOWN]: '向下 \u2193',
    [DIRECTIONS.LEFT]: '向左 \u2190',
    [DIRECTIONS.RIGHT]: '向右 \u2192'
};

// 預設外觀色彩配置
export const DEFAULT_COLORS = {
    background: '#bbada0',
    cell: {
        0: '#cdc1b4',
        2: '#eee4da',
        4: '#ede0c8',
        8: '#f2b179',
        16: '#f59563',
        32: '#f67c5f',
        64: '#f65e3b',
        128: '#edcf72',
        256: '#edcc61',
        512: '#edc850',
        1024: '#edc53f',
        2048: '#edc22e'
    },
    text: {
        light: '#776e65',
        dark: '#f9f6f2'
    }
};

export const DEFAULT_BG_START = '#667eea';
export const DEFAULT_BG_END = '#764ba2';
export const DEFAULT_CONTAINER_BG = '#ffffff';

export const TILE_VALUES = [2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048];

// 預設主題集
export const TILE_THEMES = {
    classic: JSON.parse(JSON.stringify(DEFAULT_COLORS)),
    dark: {
        background: '#3c3a32',
        cell: {
            0: '#4a4840',
            2: '#5a5850', 4: '#6a6860', 8: '#7a6850',
            16: '#8a7840', 32: '#9a8830', 64: '#aa9820',
            128: '#bba810', 256: '#ccb800', 512: '#ddc800',
            1024: '#eed800', 2048: '#ffe800'
        },
        text: { light: '#f9f6f2', dark: '#3c3a32' }
    },
    neon: {
        background: '#1a1a2e',
        cell: {
            0: '#2a2a4e',
            2: '#0abdc6', 4: '#00ff9f', 8: '#7109aa',
            16: '#ff00a0', 32: '#ff5e00', 64: '#fffb00',
            128: '#00ff5e', 256: '#00d4ff', 512: '#9d00ff',
            1024: '#ff006e', 2048: '#ffbe0b'
        },
        text: { light: '#1a1a2e', dark: '#f9f6f2' }
    },
    pastel: {
        background: '#e8d5c4',
        cell: {
            0: '#dfd0c0',
            2: '#ffd6e0', 4: '#ffc8dd', 8: '#ffb3c1',
            16: '#ff9eb5', 32: '#ff89a9', 64: '#ff749d',
            128: '#c8e7ff', 256: '#b5e0ff', 512: '#a0d9ff',
            1024: '#8dd2ff', 2048: '#7acbff'
        },
        text: { light: '#8d6e63', dark: '#5d4037' }
    },
    ocean: {
        background: '#2c5f7c',
        cell: {
            0: '#3a7090',
            2: '#a8e6cf', 4: '#88d8b0', 8: '#7fc6bd',
            16: '#6bb3a8', 32: '#5ba099', 64: '#4a8d8a',
            128: '#3a7a7c', 256: '#2a676e', 512: '#1a5460',
            1024: '#0a4152', 2048: '#003049'
        },
        text: { light: '#003049', dark: '#f9f6f2' }
    }
};

// 緩動插值函數
export function easeOutQuad(t) {
    return t * (2 - t);
}

// 安全存儲封裝（支援 localStorage，不支援時記憶體降級）
export const safeStorage = {
    _mem: {},
    _ls: null,
    _getLS() {
        if (this._ls) return this._ls;
        try { this._ls = window['local' + 'Storage']; } catch (e) { this._ls = null; }
        return this._ls;
    },
    getItem(key) {
        const ls = this._getLS();
        try { return ls ? ls.getItem(key) : (this._mem[key] ?? null); }
        catch (e) { return this._mem[key] ?? null; }
    },
    setItem(key, val) {
        const ls = this._getLS();
        try { if (ls) ls.setItem(key, val); else this._mem[key] = val; }
        catch (e) { this._mem[key] = val; }
    }
};
