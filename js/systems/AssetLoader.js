import { safeStorage } from '../config.js';

/**
 * 2048 Game Engine - 資源與音訊管理系統 (AssetLoader)
 * 負責異步預載入圖片與音效資產、Web Audio 混音、碰撞/跳躍音效合成與 BGM 循環播放
 */
export class AssetLoader {
    constructor() {
        this.images = {};
        this.audioBuffers = {};
        this.audioElements = {};
        this.audioCtx = null;
        this.masterGain = null;
        this.bgmGain = null;
        this.sfxGain = null;

        // BGM 相關狀態
        this.bgmAudio = null;
        this.bgmInterval = null;
        this.bgmStep = 0;
        this.isBGMPlaying = false;
        this.hasCustomBGM = false;

        // 靜音機制（由 safeStorage 記憶偏好）
        this.isMuted = safeStorage.getItem('game_muted') === '1';

        this.loaded = false;
    }

    /**
     * 初始化 Web Audio API Context
     */
    initAudioContext() {
        if (this.audioCtx) return;
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
            this.audioCtx = new AudioCtxClass();
            this.masterGain = this.audioCtx.createGain();
            this.bgmGain = this.audioCtx.createGain();
            this.sfxGain = this.audioCtx.createGain();

            this.bgmGain.gain.value = 0.25;
            this.sfxGain.gain.value = 0.6;
            this.masterGain.gain.value = this.isMuted ? 0 : 1;

            this.bgmGain.connect(this.masterGain);
            this.sfxGain.connect(this.masterGain);
            this.masterGain.connect(this.audioCtx.destination);
        }
    }

    /**
     * 喚醒瀏覽器被限制的音訊環境（解除 Autoplay 限制）
     */
    unlockAudio() {
        this.initAudioContext();
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        if (!this.isMuted && !this.isBGMPlaying) {
            this.startBGM();
        }
    }

    /**
     * 異步預加載所有資源
     * @returns {Promise<void>}
     */
    async loadAll() {
        const imageManifest = [
            { key: 'crosshair', src: 'assets/images/crosshair-029.png' }
        ];

        const audioManifest = [
            { key: 'boom', src: 'assets/audio/350978__cabled_mess__boom_c_05.wav' },
            { key: 'bgm', src: 'assets/audio/bgm.mp3', optional: true }
        ];

        // 1. 預載入圖片
        const imagePromises = imageManifest.map(({ key, src }) => {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    this.images[key] = img;
                    resolve({ key, status: 'ok' });
                };
                img.onerror = () => {
                    console.warn(`[AssetLoader] 無法加載圖片: ${src}`);
                    resolve({ key, status: 'fail' });
                };
                img.src = src;
            });
        });

        // 2. 預載入音效
        const audioPromises = audioManifest.map(({ key, src, optional }) => {
            return this.preloadAudio(key, src, optional);
        });

        await Promise.all([...imagePromises, ...audioPromises]);
        this.loaded = true;
    }

    /**
     * 載入單一音效檔案（支援 fetch ArrayBuffer 解碼與 Audio 標籤降級備援）
     */
    async preloadAudio(key, src, optional = false) {
        try {
            const resp = await fetch(src);
            if (!resp.ok) {
                if (!optional) console.warn(`[AssetLoader] 音訊檔案不存在 (HTTP ${resp.status}): ${src}`);
                return;
            }
            const arrayBuffer = await resp.arrayBuffer();

            this.initAudioContext();
            if (this.audioCtx) {
                const decodedBuffer = await this.audioCtx.decodeAudioData(arrayBuffer);
                this.audioBuffers[key] = decodedBuffer;
                if (key === 'bgm') this.hasCustomBGM = true;
            } else {
                const audioEl = new Audio(src);
                audioEl.preload = 'auto';
                this.audioElements[key] = audioEl;
                if (key === 'bgm') this.hasCustomBGM = true;
            }
        } catch (err) {
            if (!optional) console.warn(`[AssetLoader] 載入音訊 ${src} 發生錯誤:`, err);
        }
    }

    /**
     * 獲取已預加載之圖片
     * @param {string} key 
     * @returns {HTMLImageElement|null}
     */
    getImage(key) {
        return this.images[key] || null;
    }

    /**
     * 播放爆炸音效（消除技能觸發）
     */
    playBoom(volume = 0.7) {
        if (this.isMuted) return;
        this.initAudioContext();

        // 優先透過 AudioBuffer 播放（低延遲、支援多音軌同時播放）
        if (this.audioCtx && this.audioBuffers['boom']) {
            if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
            const source = this.audioCtx.createBufferSource();
            source.buffer = this.audioBuffers['boom'];
            const gain = this.audioCtx.createGain();
            gain.gain.value = volume;
            source.connect(gain);
            gain.connect(this.sfxGain || this.audioCtx.destination);
            source.start(0);
            return;
        }

        // 降級透過 Audio 元素播放
        const audioEl = this.audioElements['boom'] || new Audio('assets/audio/350978__cabled_mess__boom_c_05.wav');
        audioEl.currentTime = 0;
        audioEl.volume = Math.min(1, volume);
        audioEl.play().catch(() => {});
    }

    /**
     * 播放方塊碰撞與合併音效（以 Web Audio 合成具打擊感的低頻重擊）
     */
    playCollision(volume = 0.4) {
        if (this.isMuted) return;
        this.initAudioContext();
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(140, now);
        osc.frequency.exponentialRampToValueAtTime(35, now + 0.09);

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

        osc.connect(gain);
        gain.connect(this.sfxGain || this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.09);
    }

    /**
     * 播放方塊跳躍/合併彈跳音效（以 Web Audio 合成清脆彈跳音）
     */
    playJump(volume = 0.3) {
        if (this.isMuted) return;
        this.initAudioContext();
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(260, now);
        osc.frequency.exponentialRampToValueAtTime(560, now + 0.12);

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

        osc.connect(gain);
        gain.connect(this.sfxGain || this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + 0.12);
    }

    /**
     * 啟動背景音樂循環播放 (BGM)
     */
    startBGM() {
        if (this.isMuted || this.isBGMPlaying) return;
        this.initAudioContext();
        this.isBGMPlaying = true;

        // 若有實體 bgm.mp3 檔案，優先播放實體檔案
        if (this.hasCustomBGM) {
            if (this.audioCtx && this.audioBuffers['bgm']) {
                const playLoopBuffer = () => {
                    if (!this.isBGMPlaying) return;
                    const source = this.audioCtx.createBufferSource();
                    source.buffer = this.audioBuffers['bgm'];
                    source.loop = true;
                    source.connect(this.bgmGain);
                    source.start(0);
                    this._bgmSource = source;
                };
                playLoopBuffer();
                return;
            }

            if (this.audioElements['bgm']) {
                this.audioElements['bgm'].loop = true;
                this.audioElements['bgm'].volume = 0.3;
                this.audioElements['bgm'].play().catch(() => {});
                return;
            }
        }

        // 若無實體 bgm.mp3，啟動精緻的 8-bit / Lofi 輕快旋律合成器
        this.startProceduralBGM();
    }

    /**
     * 程序化合成背景音樂（五度音階輕快休閒旋律循環）
     */
    startProceduralBGM() {
        if (!this.audioCtx || this.bgmInterval) return;

        // 溫馨輕快的五聲音階頻率序列 (C Major Pentatonic: C4, D4, E4, G4, A4, C5)
        const notes = [
            261.63, 329.63, 392.00, 523.25,
            329.63, 392.00, 440.00, 392.00,
            293.66, 329.63, 392.00, 440.00,
            523.25, 440.00, 392.00, 329.63
        ];
        const bassNotes = [130.81, 164.81, 146.83, 196.00];

        this.bgmStep = 0;
        const tempoMs = 280; // 約 107 BPM

        const tick = () => {
            if (!this.isBGMPlaying || this.isMuted || !this.audioCtx) return;
            if (this.audioCtx.state === 'suspended') return;

            const now = this.audioCtx.currentTime;

            // 旋律音軌
            const freq = notes[this.bgmStep % notes.length];
            const osc = this.audioCtx.createOscillator();
            const gain = this.audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);

            gain.gain.setValueAtTime(0.04, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

            osc.connect(gain);
            gain.connect(this.bgmGain || this.audioCtx.destination);

            osc.start(now);
            osc.stop(now + 0.23);

            // 低音和弦音軌（每 4 拍切換一次）
            if (this.bgmStep % 4 === 0) {
                const bassFreq = bassNotes[(this.bgmStep / 4) % bassNotes.length];
                const bassOsc = this.audioCtx.createOscillator();
                const bassGain = this.audioCtx.createGain();

                bassOsc.type = 'triangle';
                bassOsc.frequency.setValueAtTime(bassFreq, now);

                bassGain.gain.setValueAtTime(0.05, now);
                bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

                bassOsc.connect(bassGain);
                bassGain.connect(this.bgmGain || this.audioCtx.destination);

                bassOsc.start(now);
                bassOsc.stop(now + 0.82);
            }

            this.bgmStep++;
        };

        this.bgmInterval = setInterval(tick, tempoMs);
    }

    /**
     * 暫停/停止背景音樂
     */
    stopBGM() {
        this.isBGMPlaying = false;
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
        if (this._bgmSource) {
            try { this._bgmSource.stop(); } catch(e) {}
            this._bgmSource = null;
        }
        if (this.audioElements['bgm']) {
            this.audioElements['bgm'].pause();
        }
    }

    /**
     * 切換靜音開關
     * @returns {boolean} 新的靜音狀態
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        safeStorage.setItem('game_muted', this.isMuted ? '1' : '0');

        if (this.masterGain && this.audioCtx) {
            this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.audioCtx.currentTime);
        }

        if (this.isMuted) {
            this.stopBGM();
        } else {
            this.startBGM();
        }

        return this.isMuted;
    }
}

// 導出單例
export const assetLoader = new AssetLoader();
