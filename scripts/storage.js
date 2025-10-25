/**
 * データ保存・履歴管理ロジック
 */

import { db } from './db.js';
import { qs } from './dom-utils.js';

/**
 * 現在の計算データを保存
 * @param {string} name - 商品名
 * @param {string} mode - 計算モード (fixed/weight)
 * @param {Object} inputData - 入力データ
 * @param {Object} resultData - 計算結果データ
 * @param {string} category - カテゴリ（オプション）
 * @param {Object} productData - 商品化データ（オプション）
 * @returns {Promise<number>} 保存されたレコードのID
 */
export async function saveCalculation(name, mode, inputData, resultData, category = null, productData = null) {
  const data = {
    name,
    mode,
    category,
    input: inputData,
    result: resultData,
    product: productData,
    timestamp: Date.now()
  };

  try {
    const id = await db.save(data);
    console.log(`Saved calculation with ID: ${id}`);
    return id;
  } catch (error) {
    console.error('Failed to save calculation:', error);
    throw error;
  }
}

/**
 * 保存済みのデータから入力値を復元
 * @param {number} id - レコードID
 * @returns {Promise<Object>} { mode, input, result }
 */
export async function loadCalculation(id) {
  try {
    const data = await db.getById(id);
    if (!data) {
      throw new Error(`Record with ID ${id} not found`);
    }
    return {
      mode: data.mode,
      input: data.input,
      result: data.result,
      name: data.name,
      category: data.category
    };
  } catch (error) {
    console.error('Failed to load calculation:', error);
    throw error;
  }
}

/**
 * 入力フィールドに値を設定
 * @param {string} mode - 計算モード
 * @param {Object} input - 入力データ
 */
export function restoreInputFields(mode, input) {
  // モードに応じて入力フィールドに値を設定
  for (const [key, value] of Object.entries(input)) {
    const el = qs(`#${key}`);
    if (el) {
      el.value = value;
    }
  }
}

/**
 * 履歴一覧を取得
 * @param {Object} options - { sortBy: 'timestamp'|'name', order: 'asc'|'desc' }
 * @returns {Promise<Array>}
 */
export async function getHistory(options = { sortBy: 'timestamp', order: 'desc' }) {
  try {
    return await db.getAll(options);
  } catch (error) {
    console.error('Failed to get history:', error);
    return [];
  }
}

/**
 * 履歴を検索
 * @param {string} query - 検索クエリ
 * @returns {Promise<Array>}
 */
export async function searchHistory(query) {
  try {
    return await db.search(query);
  } catch (error) {
    console.error('Failed to search history:', error);
    return [];
  }
}

/**
 * 履歴を削除
 * @param {number} id - レコードID
 * @returns {Promise<void>}
 */
export async function deleteHistory(id) {
  try {
    await db.delete(id);
    console.log(`Deleted calculation with ID: ${id}`);
  } catch (error) {
    console.error('Failed to delete calculation:', error);
    throw error;
  }
}

/**
 * 商品名を更新
 * @param {number} id - レコードID
 * @param {string} name - 新しい商品名
 * @param {string} category - 新しいカテゴリ（オプション）
 * @returns {Promise<void>}
 */
export async function updateCalculationName(id, name, category = null) {
  try {
    const updates = { name };
    if (category !== null) {
      updates.category = category;
    }
    await db.update(id, updates);
    console.log(`Updated calculation ${id} with name: ${name}`);
  } catch (error) {
    console.error('Failed to update calculation name:', error);
    throw error;
  }
}

/**
 * データをエクスポート（JSON形式でダウンロード）
 * @returns {Promise<void>}
 */
export async function exportData() {
  try {
    const jsonString = await db.exportJSON();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `yield-calculator-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();

    URL.revokeObjectURL(url);
    console.log('Data exported successfully');
  } catch (error) {
    console.error('Failed to export data:', error);
    throw error;
  }
}

/**
 * データをインポート（JSONファイルをアップロード）
 * @param {File} file - JSONファイル
 * @returns {Promise<number>} インポートされた件数
 */
export async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const jsonString = event.target.result;
        const count = await db.importJSON(jsonString);
        console.log(`Imported ${count} calculations`);
        resolve(count);
      } catch (error) {
        console.error('Failed to import data:', error);
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * すべての履歴をクリア
 * @returns {Promise<void>}
 */
export async function clearAllHistory() {
  try {
    await db.clear();
    console.log('All history cleared');
  } catch (error) {
    console.error('Failed to clear history:', error);
    throw error;
  }
}

/**
 * ユニークな商品名一覧を取得（プリセット用）
 * @returns {Promise<Array<string>>} 商品名の配列
 */
export async function getUniqueProductNames() {
  try {
    const history = await db.getAll({ sortBy: 'name', order: 'asc' });
    const names = new Set();
    history.forEach(item => {
      if (item.name && item.name.trim() !== '') {
        names.add(item.name.trim());
      }
    });
    return Array.from(names);
  } catch (error) {
    console.error('Failed to get unique product names:', error);
    return [];
  }
}
