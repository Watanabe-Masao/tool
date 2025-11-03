/**
 * データ保存・履歴管理ロジック
 */

import { db } from './db.js';
import { qs } from './dom-utils.js';
import { saveToCloud, updateInCloud, deleteFromCloud, clearAllFromCloud } from './firebase-sync.js';
import { isSignedIn } from './firebase-auth.js';

/**
 * 現在の計算データを保存（オンライン時のみ）
 * ベストプラクティス：Firestoreに直接保存 → IndexedDBにキャッシュ
 *
 * キャッシュ整合性保証:
 * - 新規保存のため、競合は発生しない
 * - Firestoreに保存後、IndexedDBにキャッシュ
 *
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
    console.log('💾 新規データを保存中...');

    // Firestoreに直接保存（IndexedDBにもキャッシュ）
    const result = await saveToCloud(data);

    console.log(`✅ 保存完了 (ID: ${result.id}, UUID: ${result.uuid})`);
    return result.id; // IndexedDB IDを返す
  } catch (error) {
    console.error('Failed to save calculation:', error);
    throw error;
  }
}

/**
 * 保存済みのデータから入力値を復元
 *
 * キャッシュ整合性保証:
 * - 履歴モーダル表示時に既にFirestoreと同期済み（ensureFreshDataBeforeDisplay）
 * - そのため、ここで読み込むIndexedDBデータは最新であることが保証されている
 *
 * @param {number} id - レコードID
 * @returns {Promise<Object>} { mode, input, result }
 */
export async function loadCalculation(id) {
  try {
    const data = await db.getById(id);
    if (!data) {
      // データが見つからない場合は、他のデバイスで削除された可能性がある
      console.error(`❌ レコードが見つかりません (ID: ${id})`);
      console.error('💡 他のデバイスで削除された可能性があります');
      throw new Error(`Record with ID ${id} not found. It may have been deleted on another device.`);
    }

    // データが存在する場合は、最新データとして返す
    console.log(`✅ データ読み込み成功 (ID: ${id}, UUID: ${data.uuid || 'N/A'})`);

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
 * 履歴を削除（オンライン時のみ）
 * ベストプラクティス：Firestoreから物理削除 → IndexedDBキャッシュからも削除
 *
 * 削除順序の理由（Firestore-first）：
 * 1. Firestoreを先に削除することで、真実の源泉（master）を即座にクリーン化
 * 2. Firestore削除が失敗した場合、ローカルデータは保持され再試行可能
 * 3. Firestore削除が成功してローカル削除が失敗しても、次回同期で整合性が回復
 *
 * 削除の保証：
 * - Firestore削除が失敗した場合、処理を中断してエラーを投げる
 * - ローカル削除が失敗した場合、警告を出すが処理は継続（次回同期で整合性回復）
 *
 * @param {number} id - レコードID
 * @returns {Promise<void>}
 */
export async function deleteHistory(id) {
  // オンラインチェック
  if (!isSignedIn()) {
    throw new Error('削除はオンライン時のみ可能です。ログインしてください。');
  }

  let cloudDeleteSuccess = false;
  let localDeleteSuccess = false;

  try {
    // 1. Firestoreから物理削除（UUIDを読み取るためにdeleteFromCloudに渡す）
    cloudDeleteSuccess = await deleteFromCloud(id);

    if (!cloudDeleteSuccess) {
      throw new Error('クラウドからの削除に失敗しました。処理を中断します。');
    }
    console.log(`✅ Firestoreから削除しました (ID: ${id})`);

    // 2. ローカル（IndexedDB）キャッシュからも物理削除
    try {
      await db.delete(id);
      localDeleteSuccess = true;
      console.log(`✅ ローカルキャッシュからも削除しました (ID: ${id})`);
    } catch (localError) {
      // ローカル削除が失敗しても、クラウドは削除済みなので処理は継続
      console.warn(`⚠️ ローカルキャッシュの削除に失敗しましたが、クラウドからは削除されています (ID: ${id})`, localError);
      console.warn('⚠️ 次回の同期時に整合性が自動的に回復されます');
    }

    console.log(`✅ データを完全に削除しました (ID: ${id})`);
  } catch (error) {
    console.error('Failed to delete calculation:', error);

    // エラー情報を詳細化
    if (!cloudDeleteSuccess) {
      // クラウド削除が失敗した場合は致命的
      throw new Error(`削除に失敗しました: ${error.message || error}`);
    } else if (!localDeleteSuccess) {
      // ローカル削除のみ失敗の場合は警告のみ（次回同期で回復）
      console.warn('⚠️ ローカルキャッシュの削除に失敗しましたが、データはクラウドから削除されています');
    } else {
      // その他のエラー
      throw error;
    }
  }
}

/**
 * 既存の計算データを更新（上書き保存）（オンライン時のみ）
 * ベストプラクティス：Firestoreを直接更新 → IndexedDBキャッシュも更新
 *
 * キャッシュ整合性保証:
 * - 更新前にFirestoreと同期して最新データを確認
 * - 他の端末での変更があった場合は警告を表示
 * - Last Write Wins (最後の書き込みが優先) 戦略
 *
 * @param {number} id - 更新するレコードのID
 * @param {string} name - 商品名
 * @param {string} mode - 計算モード (fixed/weight)
 * @param {Object} inputData - 入力データ
 * @param {Object} resultData - 計算結果データ
 * @param {string} category - カテゴリ（オプション）
 * @param {Object} productData - 商品化データ（オプション）
 * @returns {Promise<void>}
 */
export async function updateCalculation(id, name, mode, inputData, resultData, category = null, productData = null) {
  const updates = {
    name,
    mode,
    category,
    input: inputData,
    result: resultData,
    product: productData,
    timestamp: Date.now()
  };

  try {
    console.log('🔄 データ更新前に最新データを確認中...');

    // 1. 更新前に現在のローカルデータを取得
    const currentLocal = await db.getById(id);
    if (!currentLocal) {
      throw new Error(`レコードが見つかりません (ID: ${id}). 他のデバイスで削除された可能性があります。`);
    }

    // 2. オンラインの場合、Firestoreから最新データを取得して競合チェック
    if (isSignedIn()) {
      const { downloadFromCloud } = await import('./firebase-sync.js');

      try {
        // 最新データを取得
        await downloadFromCloud();

        // 再度ローカルデータを確認（同期後に変更があったか）
        const currentLocalAfterSync = await db.getById(id);
        if (!currentLocalAfterSync) {
          throw new Error(`レコードが見つかりません (ID: ${id}). 他のデバイスで削除された可能性があります。`);
        }

        // updatedAtを比較して、他のデバイスで更新されていないか確認
        const localUpdatedAt = currentLocal.updatedAt ? new Date(currentLocal.updatedAt) : null;
        const syncedUpdatedAt = currentLocalAfterSync.updatedAt ? new Date(currentLocalAfterSync.updatedAt) : null;

        if (localUpdatedAt && syncedUpdatedAt && syncedUpdatedAt > localUpdatedAt) {
          console.warn('⚠️ 他のデバイスで更新されたデータを上書きします (Last Write Wins)');
          console.warn(`   ローカル: ${localUpdatedAt.toISOString()}`);
          console.warn(`   最新: ${syncedUpdatedAt.toISOString()}`);
          // ユーザーには警告を表示するが、更新は続行（Last Write Wins戦略）
        }
      } catch (syncError) {
        console.warn('⚠️ 同期に失敗しましたが、更新を続行します:', syncError);
      }
    }

    // 3. Firestoreを直接更新（IndexedDBキャッシュも更新）
    console.log('💾 データを更新中...');
    await updateInCloud(id, updates);

    console.log(`✅ 更新完了 (ID: ${id})`);
  } catch (error) {
    console.error('Failed to update calculation:', error);
    throw error;
  }
}

/**
 * 商品名を更新（オンライン時のみ）
 * ベストプラクティス：Firestoreを直接更新 → IndexedDBキャッシュも更新
 *
 * キャッシュ整合性保証:
 * - 軽量な更新（名前とカテゴリのみ）のため、簡易的な存在チェック
 * - 削除された場合はエラーを投げる
 *
 * @param {number} id - レコードID
 * @param {string} name - 新しい商品名
 * @param {string} category - 新しいカテゴリ（オプション）
 * @returns {Promise<void>}
 */
export async function updateCalculationName(id, name, category = null) {
  try {
    // データ存在チェック
    const currentData = await db.getById(id);
    if (!currentData) {
      throw new Error(`レコードが見つかりません (ID: ${id}). 他のデバイスで削除された可能性があります。`);
    }

    const updates = { name };
    // データ整合性: null と undefined を区別（!= で両方をチェック）
    if (category != null) {
      updates.category = category;
    }

    console.log(`🔄 商品名を更新中... (ID: ${id})`);

    // Firestoreを直接更新（IndexedDBキャッシュも更新）
    await updateInCloud(id, updates);

    console.log(`✅ 商品名更新完了 (ID: ${id})`);
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
  } catch (error) {
    console.error('Failed to export data:', error);
    throw error;
  }
}

/**
 * データをインポート（JSONファイルをアップロード）
 * @param {File} file - JSONファイル
 * @returns {Promise<{count: number, errors: Array}>} インポート結果
 */
export async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const jsonString = event.target.result;

        // JSON形式の検証
        let parsedData;
        try {
          parsedData = JSON.parse(jsonString);
        } catch (parseError) {
          throw new Error('Invalid JSON format: ' + parseError.message);
        }

        // データ形式の検証
        if (!Array.isArray(parsedData)) {
          throw new Error('Invalid data format: expected array');
        }

        const result = await db.importJSON(jsonString);
        resolve(result);
      } catch (error) {
        console.error('Failed to import data:', error);
        reject(error);
      }
    };

    reader.onerror = () => {
      const error = reader.error || new Error('Failed to read file');
      console.error('File reader error:', error);
      reject(error);
    };

    reader.readAsText(file);
  });
}

/**
 * すべての履歴をクリア（ローカル＋クラウド）
 * @returns {Promise<void>}
 */
export async function clearAllHistory() {
  try {
    // クラウド（Firestore）から全削除（ログイン中の場合のみ）
    // clearAllFromCloud内でログインチェックとエラーハンドリングが行われる
    await clearAllFromCloud();

    // ローカル（IndexedDB）から全削除
    await db.clear();

    console.log('✅ すべてのデータを削除しました');
  } catch (error) {
    console.error('Failed to clear history:', error);
    throw error;
  }
}

/**
 * ユニークな商品名一覧を取得（プリセット用）
 * @returns {Promise<Array<string>>} 商品名の配列
 */
export async function getUniqueProductNames(category = null) {
  try {
    const history = await db.getAll({ sortBy: 'name', order: 'asc' });
    const names = new Set();
    history.forEach(item => {
      if (item.name && item.name.trim() !== '') {
        // カテゴリーが指定されている場合はフィルタリング
        if (category && item.category !== category) {
          return;
        }
        names.add(item.name.trim());
      }
    });
    return Array.from(names);
  } catch (error) {
    console.error('Failed to get unique product names:', error);
    return [];
  }
}
