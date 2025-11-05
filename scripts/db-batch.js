/**
 * IndexedDB バッチ処理ユーティリティ
 * 複数のレコードを1つのトランザクションで処理してパフォーマンスを向上
 */

import { logger } from './core/logger.js';
import { dbInstance } from './db.js';

/**
 * 複数レコードをバッチで追加
 * @param {string} storeName - ストア名
 * @param {Array} records - 追加するレコードの配列
 * @param {Object} options - オプション
 * @param {boolean} options.safariMode - Safari互換モード（順次処理、デフォルト: false）
 * @param {number} options.batchSize - バッチサイズ（デフォルト: 100）
 * @returns {Promise<Object>} 結果 {success: number, failed: number, errors: Array}
 */
export async function batchAdd(storeName, records, options = {}) {
  const { safariMode = false, batchSize = 100 } = options;

  if (!Array.isArray(records) || records.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  // Safari互換モード: 1件ずつ処理（トランザクション競合回避）
  if (safariMode) {
    return await sequentialAdd(storeName, records);
  }

  // 通常モード: バッチ処理
  return await batchAddOptimized(storeName, records, batchSize);
}

/**
 * 複数レコードをバッチで更新
 * @param {string} storeName - ストア名
 * @param {Array} records - 更新するレコードの配列
 * @param {Object} options - オプション
 * @returns {Promise<Object>} 結果 {success: number, failed: number, errors: Array}
 */
export async function batchUpdate(storeName, records, options = {}) {
  const { safariMode = false, batchSize = 100 } = options;

  if (!Array.isArray(records) || records.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  if (safariMode) {
    return await sequentialUpdate(storeName, records);
  }

  return await batchUpdateOptimized(storeName, records, batchSize);
}

/**
 * 複数レコードをバッチで削除
 * @param {string} storeName - ストア名
 * @param {Array} ids - 削除するIDの配列
 * @param {Object} options - オプション
 * @returns {Promise<Object>} 結果 {success: number, failed: number, errors: Array}
 */
export async function batchDelete(storeName, ids, options = {}) {
  const { safariMode = false, batchSize = 100 } = options;

  if (!Array.isArray(ids) || ids.length === 0) {
    return { success: 0, failed: 0, errors: [] };
  }

  if (safariMode) {
    return await sequentialDelete(storeName, ids);
  }

  return await batchDeleteOptimized(storeName, ids, batchSize);
}

// ========== 内部実装: 最適化版（バッチ処理） ==========

/**
 * 最適化されたバッチ追加（1トランザクションで複数レコード処理）
 */
async function batchAddOptimized(storeName, records, batchSize) {
  const results = { success: 0, failed: 0, errors: [] };

  // レコードをバッチサイズごとに分割
  const batches = [];
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      await dbInstance.open();
      const db = await dbInstance.getDB();

      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        let completed = 0;
        let errors = 0;

        batch.forEach(record => {
          const request = store.add(record);

          request.onsuccess = () => {
            completed++;
            results.success++;
            if (completed + errors === batch.length) {
              resolve();
            }
          };

          request.onerror = (event) => {
            errors++;
            results.failed++;
            results.errors.push({
              record,
              error: event.target.error
            });
            if (completed + errors === batch.length) {
              resolve(); // エラーでも継続
            }
          };
        });

        transaction.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (error) {
      logger.error('Batch add failed:', error);
      // バッチ全体が失敗した場合
      results.failed += batch.length;
      results.errors.push({ batch, error });
    }
  }

  return results;
}

/**
 * 最適化されたバッチ更新
 */
async function batchUpdateOptimized(storeName, records, batchSize) {
  const results = { success: 0, failed: 0, errors: [] };

  const batches = [];
  for (let i = 0; i < records.length; i += batchSize) {
    batches.push(records.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      await dbInstance.open();
      const db = await dbInstance.getDB();

      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        let completed = 0;
        let errors = 0;

        batch.forEach(record => {
          const request = store.put(record);

          request.onsuccess = () => {
            completed++;
            results.success++;
            if (completed + errors === batch.length) {
              resolve();
            }
          };

          request.onerror = (event) => {
            errors++;
            results.failed++;
            results.errors.push({
              record,
              error: event.target.error
            });
            if (completed + errors === batch.length) {
              resolve();
            }
          };
        });

        transaction.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (error) {
      logger.error('Batch update failed:', error);
      results.failed += batch.length;
      results.errors.push({ batch, error });
    }
  }

  return results;
}

/**
 * 最適化されたバッチ削除
 */
async function batchDeleteOptimized(storeName, ids, batchSize) {
  const results = { success: 0, failed: 0, errors: [] };

  const batches = [];
  for (let i = 0; i < ids.length; i += batchSize) {
    batches.push(ids.slice(i, i + batchSize));
  }

  for (const batch of batches) {
    try {
      await dbInstance.open();
      const db = await dbInstance.getDB();

      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        let completed = 0;
        let errors = 0;

        batch.forEach(id => {
          const request = store.delete(id);

          request.onsuccess = () => {
            completed++;
            results.success++;
            if (completed + errors === batch.length) {
              resolve();
            }
          };

          request.onerror = (event) => {
            errors++;
            results.failed++;
            results.errors.push({
              id,
              error: event.target.error
            });
            if (completed + errors === batch.length) {
              resolve();
            }
          };
        });

        transaction.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (error) {
      logger.error('Batch delete failed:', error);
      results.failed += batch.length;
      results.errors.push({ batch, error });
    }
  }

  return results;
}

// ========== 内部実装: Safari互換モード（順次処理） ==========

/**
 * Safari互換モード: 順次追加
 */
async function sequentialAdd(storeName, records) {
  const results = { success: 0, failed: 0, errors: [] };

  for (const record of records) {
    try {
      await dbInstance.open();
      const db = await dbInstance.getDB();

      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(record);

        request.onsuccess = () => {
          results.success++;
          resolve();
        };

        request.onerror = (event) => {
          results.failed++;
          results.errors.push({ record, error: event.target.error });
          resolve(); // エラーでも継続
        };

        transaction.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (error) {
      results.failed++;
      results.errors.push({ record, error });
    }
  }

  return results;
}

/**
 * Safari互換モード: 順次更新
 */
async function sequentialUpdate(storeName, records) {
  const results = { success: 0, failed: 0, errors: [] };

  for (const record of records) {
    try {
      await dbInstance.open();
      const db = await dbInstance.getDB();

      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(record);

        request.onsuccess = () => {
          results.success++;
          resolve();
        };

        request.onerror = (event) => {
          results.failed++;
          results.errors.push({ record, error: event.target.error });
          resolve();
        };

        transaction.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (error) {
      results.failed++;
      results.errors.push({ record, error });
    }
  }

  return results;
}

/**
 * Safari互換モード: 順次削除
 */
async function sequentialDelete(storeName, ids) {
  const results = { success: 0, failed: 0, errors: [] };

  for (const id of ids) {
    try {
      await dbInstance.open();
      const db = await dbInstance.getDB();

      await new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => {
          results.success++;
          resolve();
        };

        request.onerror = (event) => {
          results.failed++;
          results.errors.push({ id, error: event.target.error });
          resolve();
        };

        transaction.onerror = (event) => {
          reject(event.target.error);
        };
      });
    } catch (error) {
      results.failed++;
      results.errors.push({ id, error });
    }
  }

  return results;
}

/**
 * ブラウザがSafariかどうかを検出
 * @returns {boolean}
 */
export function isSafari() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

/**
 * 環境に応じた最適なバッチオプションを取得
 * @returns {Object} オプション {safariMode: boolean, batchSize: number}
 */
export function getOptimalBatchOptions() {
  const safariMode = isSafari();
  return {
    safariMode,
    batchSize: safariMode ? 1 : 100  // Safari: 1件ずつ, それ以外: 100件バッチ
  };
}
