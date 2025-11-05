/**
import { logger } from './core/logger.js';
 * リトライユーティリティ
 * 失敗した操作を自動的に再試行する機能を提供
 */

import { isRetryableError } from './errors.js';

/**
 * ユーティリティ：指定時間待機
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * エクスポネンシャルバックオフでリトライ
 *
 * @param {Function} fn - 実行する非同期関数
 * @param {Object} options - オプション設定
 * @param {number} options.maxRetries - 最大リトライ回数（デフォルト: 3）
 * @param {number} options.baseDelay - 基本遅延時間（ミリ秒）（デフォルト: 1000）
 * @param {number} options.maxDelay - 最大遅延時間（ミリ秒）（デフォルト: 10000）
 * @param {Function} options.shouldRetry - リトライすべきかを判定する関数
 * @param {Function} options.onRetry - リトライ時のコールバック
 * @returns {Promise<any>} 関数の実行結果
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    shouldRetry = isRetryableError,
    onRetry = null
  } = options;

  let lastError;
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // 関数を実行
      return await fn();
    } catch (error) {
      lastError = error;
      attempt++;

      // 最後の試行、またはリトライすべきでないエラーの場合は例外をスロー
      if (attempt > maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // エクスポネンシャルバックオフで遅延時間を計算
      // ジッター（ランダム性）を追加して、同時リトライの衝突を避ける
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30%のランダム性
      const delay = Math.floor(exponentialDelay + jitter);

      logger.warn(
        `[警告] ️ リトライ ${attempt}/${maxRetries}: ${delay}ms後に再試行`,
        { error: error.message, code: error.code, name: error.name }
      );

      // リトライコールバックを実行
      if (onRetry) {
        try {
          await onRetry(attempt, error, delay);
        } catch (callbackError) {
          logger.error('リトライコールバックでエラー:', callbackError);
        }
      }

      // 待機
      await sleep(delay);
    }
  }

  // 全てのリトライが失敗した場合
  throw lastError;
}

/**
 * リトライ可能な関数を作成
 *
 * @param {Function} fn - ラップする関数
 * @param {Object} options - リトライオプション
 * @returns {Function} リトライ機能を持つ関数
 */
export function createRetryableFunction(fn, options = {}) {
  return async function(...args) {
    return await retryWithBackoff(
      () => fn.apply(this, args),
      options
    );
  };
}

/**
 * 複数の非同期操作を並列実行し、失敗したものだけリトライ
 *
 * @param {Array<Function>} tasks - 実行するタスクの配列
 * @param {Object} options - リトライオプション
 * @returns {Promise<Array>} 結果の配列
 */
export async function retryFailedTasks(tasks, options = {}) {
  const results = [];
  const errors = [];

  for (let i = 0; i < tasks.length; i++) {
    try {
      const result = await retryWithBackoff(tasks[i], options);
      results.push({ index: i, success: true, data: result });
    } catch (error) {
      logger.error(`タスク ${i + 1}/${tasks.length} が全てのリトライ後に失敗:`, error);
      results.push({ index: i, success: false, error });
      errors.push({ index: i, error });
    }
  }

  return {
    results,
    errors,
    successCount: results.filter(r => r.success).length,
    failureCount: errors.length,
    allSucceeded: errors.length === 0
  };
}

/**
 * タイムアウト付きリトライ
 *
 * @param {Function} fn - 実行する関数
 * @param {number} timeoutMs - タイムアウト時間（ミリ秒）
 * @param {Object} retryOptions - リトライオプション
 * @returns {Promise<any>}
 */
export async function retryWithTimeout(fn, timeoutMs, retryOptions = {}) {
  return Promise.race([
    retryWithBackoff(fn, retryOptions),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]);
}

/**
 * 条件付きリトライ（特定のエラーコードのみリトライ）
 *
 * @param {Function} fn - 実行する関数
 * @param {Array<string>} retryableCodes - リトライ対象のエラーコード
 * @param {Object} options - その他のオプション
 * @returns {Promise<any>}
 */
export async function retryOnCodes(fn, retryableCodes, options = {}) {
  return retryWithBackoff(fn, {
    ...options,
    shouldRetry: (error) => {
      // カスタムエラーのretryableプロパティをチェック
      if (error.retryable !== undefined) {
        return error.retryable;
      }
      // エラーコードをチェック
      return error.code && retryableCodes.includes(error.code);
    }
  });
}

/**
 * リトライ統計情報
 */
export class RetryStats {
  constructor() {
    this.attempts = 0;
    this.successes = 0;
    this.failures = 0;
    this.totalRetries = 0;
  }

  recordAttempt() {
    this.attempts++;
  }

  recordSuccess(retriesUsed = 0) {
    this.successes++;
    this.totalRetries += retriesUsed;
  }

  recordFailure(retriesUsed = 0) {
    this.failures++;
    this.totalRetries += retriesUsed;
  }

  getStats() {
    return {
      attempts: this.attempts,
      successes: this.successes,
      failures: this.failures,
      successRate: this.attempts > 0 ? (this.successes / this.attempts * 100).toFixed(2) + '%' : '0%',
      averageRetries: this.attempts > 0 ? (this.totalRetries / this.attempts).toFixed(2) : '0'
    };
  }

  reset() {
    this.attempts = 0;
    this.successes = 0;
    this.failures = 0;
    this.totalRetries = 0;
  }
}
