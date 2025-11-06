/**
 * IndexedDB Utility Functions
 * UUID generation, error handling, and data validation utilities
 */

/**
 * IndexedDBエラーをユーザーフレンドリーなメッセージに変換
 * @param {Error} error - エラーオブジェクト
 * @param {string} operation - 実行していた操作
 * @returns {Error} 変換されたエラー
 */
export function createUserFriendlyError(error, operation) {
  let message = `データベース操作に失敗しました: ${operation}`;

  if (error.name === 'QuotaExceededError') {
    message = 'ストレージの容量が不足しています。不要なデータを削除してください。';
  } else if (error.name === 'VersionError') {
    message = 'データベースのバージョンが競合しています。ページを再読み込みしてください。';
  } else if (error.name === 'InvalidStateError') {
    message = 'データベースが無効な状態です。ページを再読み込みしてください。';
  } else if (error.name === 'DataError') {
    message = 'データの形式が正しくありません。';
  } else if (error.name === 'AbortError') {
    message = 'データベース操作が中断されました。';
  }

  const userError = new Error(message);
  userError.originalError = error;
  userError.operation = operation;
  return userError;
}

/**
 * IndexedDBが利用可能かチェック
 * @returns {boolean}
 */
export function isIndexedDBAvailable() {
  if (!window.indexedDB) {
    return false;
  }

  // プライベートモードなどでIndexedDBが無効な場合をチェック
  try {
    const test = indexedDB.open('test');
    test.onerror = () => test.result && test.result.close();
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * UUID v4を生成
 * @returns {string} UUID (例: "550e8400-e29b-41d4-a916-446655440000")
 */
export function generateUUID() {
  // 最新ブラウザではcrypto.randomUUID()を使用
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // フォールバック: UUID v4の形式で生成
  // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 指定時間待機
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
