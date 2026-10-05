import { Game } from './core/Game.js';
import { assetLoader } from './systems/AssetLoader.js';

/**
 * 2048 Game Engine - 應用程式啟動進入點
 */
window.addEventListener('DOMContentLoaded', async () => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas element #gameCanvas not found!');
        return;
    }

    // 異步預加載所有 2D 圖片與音訊資源，確認資源加載完成後才啟動遊戲循環
    await assetLoader.loadAll();

    const game = new Game(canvas, assetLoader);
    game.start();

    // 掛載至 window 方便除錯與自檢
    window.__game__ = game;
    window.__assetLoader__ = assetLoader;
});
