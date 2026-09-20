import { GRID_SIZE, DIRECTIONS, VECTORS } from '../config.js';
import { Physics } from './Physics.js';

const AI_WORKER_CODE = `
    const DIRS = ['up', 'down', 'left', 'right'];
    const VECTORS = { up: [-1,0], down: [1,0], left: [0,-1], right: [0,1] };

    function getTraversals(direction) {
        const rows = [0,1,2,3], cols = [0,1,2,3];
        const v = VECTORS[direction];
        if (v[0] === 1) rows.reverse();
        if (v[1] === 1) cols.reverse();
        return { rows, cols };
    }

    function simulateMove1D(board, direction) {
        let moved = false;
        const merged = new Array(16).fill(false);
        const { rows, cols } = getTraversals(direction);
        const [dr, dc] = VECTORS[direction];
        for (const row of rows) {
            for (const col of cols) {
                const idx = row * 4 + col;
                if (board[idx] === 0) continue;
                let r = row, c = col, pr, pc;
                do {
                    pr = r; pc = c;
                    r += dr; c += dc;
                } while (r >= 0 && r < 4 && c >= 0 && c < 4 && board[r * 4 + c] === 0);
                if (r >= 0 && r < 4 && c >= 0 && c < 4 && board[r * 4 + c] === board[idx] && !merged[r * 4 + c]) {
                    board[r * 4 + c] *= 2; board[idx] = 0;
                    merged[r * 4 + c] = true; moved = true;
                } else if (pr !== row || pc !== col) {
                    board[pr * 4 + pc] = board[idx]; board[idx] = 0; moved = true;
                }
            }
        }
        return moved;
    }

    function evaluateBoard1D(board) {
        let emptyCount = 0, maxTile = 0, maxIdx = 0;
        for (let i = 0; i < 16; i++) {
            if (board[i] === 0) emptyCount++;
            else if (board[i] > maxTile) { maxTile = board[i]; maxIdx = i; }
        }
        const maxR = Math.floor(maxIdx / 4), maxC = maxIdx % 4;
        let score = emptyCount * 270;
        // 單調性
        const totals = [0,0,0,0];
        for (let r = 0; r < 4; r++) {
            let cur = 0, nxt = 1;
            while (nxt < 4) {
                while (nxt < 4 && board[r*4+nxt] === 0) nxt++;
                if (nxt >= 4) break;
                const cv = board[r*4+cur] !== 0 ? Math.log2(board[r*4+cur]) : 0;
                const nv = board[r*4+nxt] !== 0 ? Math.log2(board[r*4+nxt]) : 0;
                if (cv > nv) totals[0] += nv - cv;
                else if (nv > cv) totals[1] += cv - nv;
                cur = nxt; nxt++;
            }
        }
        for (let c = 0; c < 4; c++) {
            let cur = 0, nxt = 1;
            while (nxt < 4) {
                while (nxt < 4 && board[nxt*4+c] === 0) nxt++;
                if (nxt >= 4) break;
                const cv = board[cur*4+c] !== 0 ? Math.log2(board[cur*4+c]) : 0;
                const nv = board[nxt*4+c] !== 0 ? Math.log2(board[nxt*4+c]) : 0;
                if (cv > nv) totals[2] += nv - cv;
                else if (nv > cv) totals[3] += cv - nv;
                cur = nxt; nxt++;
            }
        }
        score += (Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3])) * 47;
        // 平滑度
        let smooth = 0;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const idx = r*4+c;
                if (board[idx] === 0) continue;
                const v = Math.log2(board[idx]);
                if (c+1 < 4 && board[r*4+c+1] !== 0) smooth -= Math.abs(v - Math.log2(board[r*4+c+1]));
                if (r+1 < 4 && board[(r+1)*4+c] !== 0) smooth -= Math.abs(v - Math.log2(board[(r+1)*4+c]));
            }
        }
        score += smooth * 0.1;
        // 角落加分
        if ((maxR === 0 || maxR === 3) && (maxC === 0 || maxC === 3))
            score += maxTile * 10;
        return score;
    }

    function expectimax1D(board, depth, isMaxNode) {
        if (depth === 0) return evaluateBoard1D(board);
        if (isMaxNode) {
            let best = -Infinity;
            for (const dir of DIRS) {
                const snap = new Int32Array(board);
                if (simulateMove1D(board, dir)) {
                    const s = expectimax1D(board, depth - 1, false);
                    if (s > best) best = s;
                }
                for (let i = 0; i < 16; i++) board[i] = snap[i];
            }
            return best === -Infinity ? evaluateBoard1D(board) : best;
        } else {
            const empty = [];
            for (let i = 0; i < 16; i++) if (board[i] === 0) empty.push(i);
            if (empty.length === 0) return evaluateBoard1D(board);
            let total = 0;
            for (const idx of empty) {
                board[idx] = 2;
                total += 0.9 * expectimax1D(board, depth - 1, true);
                board[idx] = 4;
                total += 0.1 * expectimax1D(board, depth - 1, true);
                board[idx] = 0;
            }
            return total / empty.length;
        }
    }

    self.onmessage = function(e) {
        const { board, requestId } = e.data;
        const work = new Int32Array(board);

        // 計算空格數
        let emptyBefore = 0;
        for (let i = 0; i < 16; i++) if (work[i] === 0) emptyBefore++;

        // 最佳移動
        let bestDir = null, bestMoveScore = -Infinity;
        for (const dir of DIRS) {
            const snap = new Int32Array(work);
            if (simulateMove1D(work, dir)) {
                const s = expectimax1D(work, 2, false);
                if (s > bestMoveScore) { bestMoveScore = s; bestDir = dir; }
            }
            for (let i = 0; i < 16; i++) work[i] = snap[i];
        }

        // 最佳消除格子
        let bestSkillCell = null, bestSkillScore = -Infinity;
        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 4; c++) {
                const affected = [
                    r * 4 + c,
                    r > 0 ? (r-1)*4+c : -1,
                    r < 3 ? (r+1)*4+c : -1,
                    c > 0 ? r*4+(c-1) : -1,
                    c < 3 ? r*4+(c+1) : -1
                ].filter(i => i >= 0 && work[i] !== 0);

                if (affected.length === 0) continue;

                let removedLogSum = 0;
                for (const i of affected) {
                    removedLogSum += Math.log2(work[i]);
                }

                const snap = new Int32Array(work);
                for (const i of affected) work[i] = 0;
                const s = expectimax1D(work, 2, true) - removedLogSum * 160;
                for (let i = 0; i < 16; i++) work[i] = snap[i];

                if (s > bestSkillScore) {
                    bestSkillScore = s;
                    bestSkillCell = { row: r, col: c, removedCount: affected.length, score: s };
                }
            }
        }

        self.postMessage({
            direction: bestDir,
            moveScore: bestMoveScore,
            skillCell: bestSkillCell,
            skillScore: bestSkillScore,
            emptyBefore: emptyBefore,
            requestId: requestId
        });
    };
`;

/**
 * 2048 Game Engine - AI 決策系統
 */
export class AISystem {
    constructor() {
        this.worker = null;
        this.requestId = 0;
        this.pendingCallback = null;
        this.initWorker();
    }

    /**
     * 初始化 Web Worker
     */
    initWorker() {
        if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
            this.worker = null;
            return;
        }

        try {
            const blob = new Blob([AI_WORKER_CODE], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            this.worker = new Worker(url);
            URL.revokeObjectURL(url);

            this.worker.onmessage = (e) => {
                if (e.data.requestId !== this.requestId) return; // 忽略過期請求
                const cb = this.pendingCallback;
                this.pendingCallback = null;
                if (cb) cb(e.data);
            };
        } catch (err) {
            this.worker = null;
        }
    }

    /**
     * 取消目前掛起的 AI 請求
     */
    cancelPending() {
        this.requestId++;
        this.pendingCallback = null;
    }

    /**
     * 異步獲取最佳走法與技能建議
     * @param {import('../entities/Grid.js').Grid} grid 
     * @param {Function} callback 
     */
    getBestMoveAsync(grid, callback) {
        if (!this.worker) {
            callback(this.getBestMoveAndSkillSync(grid));
            return;
        }
        this.requestId++;
        this.pendingCallback = callback;
        this.worker.postMessage({
            board: grid.to1DArray(),
            requestId: this.requestId
        });
    }

    /**
     * 判斷是否應該使用消除技能
     * @param {Object} result 
     * @param {number} skillCharges 
     * @returns {boolean}
     */
    shouldUseSkill(result, skillCharges) {
        return skillCharges > 0 &&
            result.skillCell &&
            (!result.direction ||
             (result.emptyBefore <= 4 && result.skillScore >= result.moveScore + 300));
    }

    // ===== 同步退回（Sync Fallback）計算邏輯 =====

    simulateMoveSync(board, direction) {
        const size = GRID_SIZE;
        const newBoard = board.map(row => [...row]);
        const merged = Array(size).fill(null).map(() => Array(size).fill(false));
        let moved = false;
        const vector = VECTORS[direction];
        const traversals = Physics.getTraversals(direction);

        for (const row of traversals.rows) {
            for (const col of traversals.cols) {
                if (newBoard[row][col] === 0) continue;
                let r = row, c = col, prevR, prevC;
                do {
                    prevR = r; prevC = c;
                    r += vector.r; c += vector.c;
                } while (r >= 0 && r < size && c >= 0 && c < size && newBoard[r][c] === 0);
                const inBounds = r >= 0 && r < size && c >= 0 && c < size;
                if (inBounds && newBoard[r][c] === newBoard[row][col] && !merged[r][c]) {
                    newBoard[r][c] *= 2; newBoard[row][col] = 0;
                    merged[r][c] = true; moved = true;
                } else if (prevR !== row || prevC !== col) {
                    newBoard[prevR][prevC] = newBoard[row][col];
                    newBoard[row][col] = 0; moved = true;
                }
            }
        }
        return { board: newBoard, moved: moved };
    }

    monotonicitySync(board) {
        const size = GRID_SIZE;
        const totals = [0, 0, 0, 0];
        for (let r = 0; r < size; r++) {
            let cur = 0, nxt = 1;
            while (nxt < size) {
                while (nxt < size && board[r][nxt] === 0) nxt++;
                if (nxt >= size) break;
                const cv = board[r][cur] !== 0 ? Math.log2(board[r][cur]) : 0;
                const nv = board[r][nxt] !== 0 ? Math.log2(board[r][nxt]) : 0;
                if (cv > nv) totals[0] += nv - cv;
                else if (nv > cv) totals[1] += cv - nv;
                cur = nxt; nxt++;
            }
        }
        for (let c = 0; c < size; c++) {
            let cur = 0, nxt = 1;
            while (nxt < size) {
                while (nxt < size && board[nxt][c] === 0) nxt++;
                if (nxt >= size) break;
                const cv = board[cur][c] !== 0 ? Math.log2(board[cur][c]) : 0;
                const nv = board[nxt][c] !== 0 ? Math.log2(board[nxt][c]) : 0;
                if (cv > nv) totals[2] += nv - cv;
                else if (nv > cv) totals[3] += cv - nv;
                cur = nxt; nxt++;
            }
        }
        return Math.max(totals[0], totals[1]) + Math.max(totals[2], totals[3]);
    }

    smoothnessSync(board) {
        const size = GRID_SIZE;
        let s = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === 0) continue;
                const v = Math.log2(board[r][c]);
                if (c + 1 < size && board[r][c + 1] !== 0)
                    s -= Math.abs(v - Math.log2(board[r][c + 1]));
                if (r + 1 < size && board[r + 1][c] !== 0)
                    s -= Math.abs(v - Math.log2(board[r + 1][c]));
            }
        }
        return s;
    }

    evaluateBoardSync(board) {
        const size = GRID_SIZE;
        let emptyCount = 0, maxTile = 0, maxR = 0, maxC = 0;
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (board[r][c] === 0) emptyCount++;
                else if (board[r][c] > maxTile) {
                    maxTile = board[r][c]; maxR = r; maxC = c;
                }
            }
        }
        let score = emptyCount * 270;
        score += this.monotonicitySync(board) * 47;
        score += this.smoothnessSync(board) * 0.1;
        if ((maxR === 0 || maxR === size - 1) && (maxC === 0 || maxC === size - 1))
            score += maxTile * 10;
        return score;
    }

    expectimaxSync(board, depth, isMaxNode) {
        if (depth === 0) return this.evaluateBoardSync(board);
        if (isMaxNode) {
            let best = -Infinity;
            for (const dir of [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT]) {
                const result = this.simulateMoveSync(board, dir);
                if (result.moved) {
                    const s = this.expectimaxSync(result.board, depth - 1, false);
                    if (s > best) best = s;
                }
            }
            return best === -Infinity ? this.evaluateBoardSync(board) : best;
        } else {
            const emptyCells = [];
            for (let r = 0; r < GRID_SIZE; r++)
                for (let c = 0; c < GRID_SIZE; c++)
                    if (board[r][c] === 0) emptyCells.push({ r, c });
            if (emptyCells.length === 0) return this.evaluateBoardSync(board);
            let total = 0;
            for (const cell of emptyCells) {
                board[cell.r][cell.c] = 2;
                total += 0.9 * this.expectimaxSync(board, depth - 1, true);
                board[cell.r][cell.c] = 4;
                total += 0.1 * this.expectimaxSync(board, depth - 1, true);
                board[cell.r][cell.c] = 0;
            }
            return total / emptyCells.length;
        }
    }

    getBestMoveAndSkillSync(grid) {
        const board2D = grid.to2DArray();

        let emptyBefore = 0;
        for (let r = 0; r < GRID_SIZE; r++)
            for (let c = 0; c < GRID_SIZE; c++)
                if (board2D[r][c] === 0) emptyBefore++;

        // 最佳移動
        let bestDir = null, bestMoveScore = -Infinity;
        for (const dir of [DIRECTIONS.UP, DIRECTIONS.DOWN, DIRECTIONS.LEFT, DIRECTIONS.RIGHT]) {
            const result = this.simulateMoveSync(board2D, dir);
            if (result.moved) {
                const s = this.expectimaxSync(result.board, 2, false);
                if (s > bestMoveScore) { bestMoveScore = s; bestDir = dir; }
            }
        }

        // 最佳消除格子
        let bestSkillCell = null, bestSkillScore = -Infinity;
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const affected = Physics.getSkillAffectedCells(r, c);
                let hasTile = false;
                let removedLogSum = 0;
                for (const { r: ar, c: ac } of affected) {
                    if (board2D[ar][ac] !== 0) {
                        hasTile = true;
                        removedLogSum += Math.log2(board2D[ar][ac]);
                    }
                }
                if (!hasTile) continue;

                const newBoard = board2D.map(row => [...row]);
                for (const { r: ar, c: ac } of affected) newBoard[ar][ac] = 0;
                const s = this.expectimaxSync(newBoard, 2, true) - removedLogSum * 160;
                if (s > bestSkillScore) {
                    bestSkillScore = s;
                    bestSkillCell = { row: r, col: c, score: s };
                }
            }
        }

        return {
            direction: bestDir,
            moveScore: bestMoveScore,
            skillCell: bestSkillCell,
            skillScore: bestSkillScore,
            emptyBefore: emptyBefore
        };
    }
}
