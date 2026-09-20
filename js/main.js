import { Game } from './core/Game.js';

/**
 * 2048 Game Engine - 應用程式啟動進入點
 */
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element #gameCanvas not found!');
        return;
    }

    const game = new Game(canvas);
    game.start();

    // 掛載至 window 方便除錯與自檢
    window.__game__ = game;
});
