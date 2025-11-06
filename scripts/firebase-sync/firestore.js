/**
 * Firestore Core Utilities and CRUD Operations
 *
 * This module provides:
 * - Core Firestore utilities (instance, timestamps, type checking)
 * - Data cleaning and validation
 * - CRUD operations (save, update, delete, clear)
 */

import { logger } from '../core/logger.js';
import { getCurrentUser, isSignedIn } from '../firebase-auth.js';
import { db as dbInstance } from '../db.js';
import { showToast } from '../toast.js';
import { retryWithBackoff } from '../retry-utils.js';
import { generateUUID, getDeviceId } from './utils.js';

/**
 * Firestoreインスタンスを取得
 */
export function getFirestore() {
  const fb = window.firebase;
  if (!fb || !fb.apps || !fb.apps.length) {
    throw new Error('Firebaseが初期化されていません');
  }
  return fb.firestore();
}

/**
 * サーバータイムスタンプを取得
 */
export function getServerTimestamp() {
  const fb = window.firebase;
  if (!fb || !fb.apps || !fb.apps.length) {
    throw new Error('Firebaseが初期化されていません');
  }
  return fb.firestore.FieldValue.serverTimestamp();
}

/**
 * JavaScriptのDateをFirestore Timestampに変換
 */
export function getTimestampFromDate(date) {
  const fb = window.firebase;
  if (!fb || !fb.apps || !fb.apps.length) {
    throw new Error('Firebaseが初期化されていません');
  }
  return fb.firestore.Timestamp.fromDate(date);
}

/**
 * FirebaseのTimestamp型かどうかを判定
 * @param {any} obj - 判定対象
 * @returns {boolean}
 */
export function isFirebaseTimestamp(obj) {
  if (!obj) {return false;}

  try {
    const fb = window.firebase;
    if (fb && fb.firestore && fb.firestore.Timestamp) {
      return obj instanceof fb.firestore.Timestamp;
    }
  } catch (e) {
    // Firebase未初期化の場合
  }

  // フォールバック: 構造で判定（toDate, toMillis メソッドを持つ）
  return typeof obj === 'object' &&
         typeof obj.toDate === 'function' &&
         typeof obj.toMillis === 'function';
}

/**
 * FirebaseのFieldValue型かどうかを判定
 * @param {any} obj - 判定対象
 * @returns {boolean}
 */
export function isFirebaseFieldValue(obj) {
  if (!obj) {return false;}

  try {
    const fb = window.firebase;
    if (fb && fb.firestore && fb.firestore.FieldValue) {
      // FieldValueは特殊なシングルトンなので、isEqualメソッドの存在で判定
      return obj.isEqual !== undefined;
    }
  } catch (e) {
    // Firebase未初期化の場合
  }

  return false;
}

/**
 * undefinedフィールドを削除（Firestoreはundefinedを許可しない）
 * 再帰的にネストされたオブジェクトもクリーンアップ
 * @param {any} obj - クリーンアップするオブジェクト
 * @returns {any} undefinedが削除されたオブジェクト
 */
export function removeUndefinedFields(obj) {
  // null、undefined、プリミティブ型はそのまま返す
  if (obj === null || obj === undefined) {
    return obj;
  }

  // プリミティブ型
  if (typeof obj !== 'object') {
    return obj;
  }

  // Date、Firebase Timestamp、FieldValueなどの特殊なオブジェクトはそのまま返す
  if (obj instanceof Date || isFirebaseTimestamp(obj) || isFirebaseFieldValue(obj)) {
    return obj;
  }

  // 配列の場合
  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => removeUndefinedFields(item));
  }

  // オブジェクトの場合（再帰的にクリーンアップ）
  const cleaned = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined) {
      cleaned[key] = removeUndefinedFields(obj[key]);
    }
  }
  return cleaned;
}

/**
 * Firestoreに直接保存（ベストプラクティス：Firestoreを真実の源泉とする）
 * @param {Object} data - 保存するデータ
 * @returns {Promise<{id: number, uuid: string}>} IndexedDB IDとFirestore UUID
 */
export async function saveToCloud(data) {
  if (!isSignedIn()) {
    throw new Error('保存はオンライン時のみ可能です。ログインしてください。');
  }

  try {
    const user = getCurrentUser();
    const firestore = getFirestore();

    // UUIDを生成（FirestoreドキュメントIDとして使用）
    const uuid = generateUUID();

    // Firestoreに保存
    const docRef = firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .doc(uuid);

    // undefinedフィールドを削除（Firestoreはundefinedを許可しない）
    logger.info(' 保存前のデータ:', JSON.parse(JSON.stringify(data)));
    const cleanedData = removeUndefinedFields(data);
    logger.info('[クリーンアップ]  クリーンアップ後のデータ:', JSON.parse(JSON.stringify(cleanedData)));

    const dataToSave = {
      ...cleanedData,
      uuid,
      createdAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
      deviceId: getDeviceId()
    };

    logger.info(' Firestoreに送信するデータのキー:', Object.keys(dataToSave));
    logger.info(' createdAt type:', typeof dataToSave.createdAt, dataToSave.createdAt);
    logger.info(' updatedAt type:', typeof dataToSave.updatedAt, dataToSave.updatedAt);

    // リトライロジックでFirestoreに保存
    await retryWithBackoff(
      () => docRef.set(dataToSave),
      {
        maxRetries: 3,
        baseDelay: 1000,
        onRetry: (attempt, error) => {
          logger.warn(` 保存リトライ中 (${attempt}/3):`, error.message);
        }
      }
    );
    logger.info(`✅  Firestoreに保存しました (UUID: ${uuid})`);

    // IndexedDBにもキャッシュとして保存
    const localData = {
      ...cleanedData,
      uuid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    const localId = await dbInstance.save(localData);
    logger.info(`✅  IndexedDBにキャッシュしました (ID: ${localId})`);

    return { id: localId, uuid };
  } catch (error) {
    logger.error('[エラー]  クラウド保存エラー:', error);
    logger.error('エラー詳細:', {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Firestoreを直接更新（ベストプラクティス：Firestoreを真実の源泉とする）
 * @param {number} id - IndexedDB ID
 * @param {Object} updates - 更新するデータ
 * @returns {Promise<void>}
 */
export async function updateInCloud(id, updates) {
  if (!isSignedIn()) {
    throw new Error('更新はオンライン時のみ可能です。ログインしてください。');
  }

  try {
    const user = getCurrentUser();
    const firestore = getFirestore();

    // IndexedDBからUUIDを取得
    const localItem = await dbInstance.getById(id);
    if (!localItem) {
      throw new Error(`IndexedDB ID:${id} が見つかりません`);
    }

    const {uuid} = localItem;
    if (!uuid) {
      throw new Error(`IndexedDB ID:${id} にUUIDが設定されていません`);
    }

    // Firestoreを更新
    const docRef = firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .doc(uuid);

    // undefinedフィールドを削除（Firestoreはundefinedを許可しない）
    const cleanedUpdates = removeUndefinedFields(updates);

    const dataToUpdate = {
      ...cleanedUpdates,
      updatedAt: getServerTimestamp()
    };

    // リトライロジックでFirestoreを更新
    await retryWithBackoff(
      () => docRef.update(dataToUpdate),
      {
        maxRetries: 3,
        baseDelay: 1000,
        onRetry: (attempt, error) => {
          logger.warn(` 更新リトライ中 (${attempt}/3):`, error.message);
        }
      }
    );
    logger.info(`✅  Firestoreを更新しました (UUID: ${uuid})`);

    // IndexedDBキャッシュも更新
    const localUpdates = {
      ...cleanedUpdates,
      updatedAt: new Date().toISOString()
    };
    await dbInstance.update(id, localUpdates);
    logger.info(`✅  IndexedDBキャッシュを更新しました (ID: ${id})`);
  } catch (error) {
    logger.error('クラウド更新エラー:', error);
    throw error;
  }
}

/**
 * クラウドで論理削除
 * @param {number} id - IndexedDBのID
 * @returns {Promise<boolean>}
 */
export async function deleteFromCloud(id) {
  if (!isSignedIn()) {
    logger.warn('ログインしていないため、クラウド削除をスキップします');
    return false;
  }

  try {
    const user = getCurrentUser();
    const firestore = getFirestore();

    // IndexedDBからUUIDを取得
    const localItem = await dbInstance.getById(id);
    if (!localItem) {
      logger.warn(`IndexedDB ID:${id} が見つかりません`);
      return false;
    }

    const {uuid} = localItem;
    if (!uuid) {
      logger.warn(`IndexedDB ID:${id} にUUIDが設定されていません。クラウド削除をスキップします。`);
      // UUIDがない古いデータの場合、ローカル削除のみ許可
      return true;
    }

    // Firestoreで論理削除（deletedフラグを立てる）
    const docRef = firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .doc(uuid);

    const dataToUpdate = {
      deleted: true,
      deletedAt: getServerTimestamp(),
      updatedAt: getServerTimestamp()
    };

    // リトライロジックでFirestoreを更新
    await retryWithBackoff(
      () => docRef.update(dataToUpdate),
      {
        maxRetries: 3,
        baseDelay: 1000,
        onRetry: (attempt, error) => {
          logger.warn(` 論理削除リトライ中 (${attempt}/3):`, error.message);
        }
      }
    );
    logger.info(`✅  Firestoreで論理削除しました (UUID: ${uuid})`);

    return true;
  } catch (error) {
    logger.error('クラウド論理削除エラー:', error);

    // エラーメッセージを詳細化
    let errorMessage = 'クラウドでの削除に失敗しました';
    if (error.code === 'permission-denied') {
      errorMessage = 'アクセス権限がありません。Firestoreのセキュリティルールを確認してください。';
    } else if (error.code === 'unavailable') {
      errorMessage = 'ネットワーク接続を確認してください。';
    } else if (error.message) {
      errorMessage = `削除に失敗: ${error.message}`;
    }

    showToast(errorMessage, 'error');
    return false;
  }
}

/**
 * クラウドから物理削除（完全削除）
 * @param {number} id - IndexedDBのID
 * @returns {Promise<boolean>}
 */
export async function hardDeleteFromCloud(id) {
  if (!isSignedIn()) {
    logger.warn('ログインしていないため、クラウド削除をスキップします');
    return false;
  }

  try {
    const user = getCurrentUser();
    const firestore = getFirestore();

    // IndexedDBからUUIDを取得
    const localItem = await dbInstance.getById(id);
    if (!localItem) {
      logger.warn(`IndexedDB ID:${id} が見つかりません`);
      return false;
    }

    const {uuid} = localItem;
    if (!uuid) {
      logger.warn(`IndexedDB ID:${id} にUUIDが設定されていません。クラウド削除をスキップします。`);
      // UUIDがない古いデータの場合、ローカル削除のみ許可
      return true;
    }

    // Firestoreから物理削除
    const docRef = firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .doc(uuid);

    // リトライロジックでFirestoreから削除
    await retryWithBackoff(
      () => docRef.delete(),
      {
        maxRetries: 3,
        baseDelay: 1000,
        onRetry: (attempt, error) => {
          logger.warn(` 物理削除リトライ中 (${attempt}/3):`, error.message);
        }
      }
    );
    logger.info(`✅  Firestoreから物理削除しました (UUID: ${uuid})`);

    return true;
  } catch (error) {
    logger.error('クラウド物理削除エラー:', error);

    // エラーメッセージを詳細化
    let errorMessage = 'クラウドからの完全削除に失敗しました';
    if (error.code === 'permission-denied') {
      errorMessage = 'アクセス権限がありません。Firestoreのセキュリティルールを確認してください。';
    } else if (error.code === 'unavailable') {
      errorMessage = 'ネットワーク接続を確認してください。';
    } else if (error.message) {
      errorMessage = `完全削除に失敗: ${error.message}`;
    }

    showToast(errorMessage, 'error');
    return false;
  }
}

/**
 * クラウドから論理削除されたデータを取得
 * @returns {Promise<Array>}
 */
export async function getDeletedFromCloud() {
  if (!isSignedIn()) {
    showToast('ログインしてください', 'warning');
    return [];
  }

  try {
    const user = getCurrentUser();
    const firestore = getFirestore();

    // Firestoreから論理削除されたデータを取得
    const snapshot = await firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .where('deleted', '==', true)
      .get();

    if (snapshot.empty) {
      return [];
    }

    const deletedData = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    logger.info(`✅  ${deletedData.length}件の論理削除データを取得しました`);
    return deletedData;
  } catch (error) {
    logger.error('クラウドからの論理削除データ取得エラー:', error);
    showToast('論理削除されたデータの取得に失敗しました', 'error');
    return [];
  }
}

/**
 * クラウドから全データを削除
 * @returns {Promise<boolean>}
 */
export async function clearAllFromCloud() {
  if (!isSignedIn()) {
    logger.warn('ログインしていないため、クラウド全削除をスキップします');
    return false;
  }

  try {
    const user = getCurrentUser();
    const firestore = getFirestore();

    // ユーザーのすべての履歴を取得
    const snapshot = await firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .get();

    if (snapshot.empty) {
      logger.info('クラウドに削除するデータがありません');
      return true;
    }

    logger.info(`[削除]  Firestoreから${snapshot.size}件のデータを削除中...`);

    // バッチ削除（最大500件ずつ）
    let batch = firestore.batch();
    let batchCount = 0;
    let totalDeleted = 0;

    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      batchCount++;
      totalDeleted++;

      // 500件ごとにコミット
      if (batchCount >= 500) {
        await batch.commit();
        logger.info(`✅  バッチ削除完了: ${totalDeleted}件`);
        batch = firestore.batch(); // 新しいバッチを作成
        batchCount = 0;
      }
    }

    // 残りをコミット
    if (batchCount > 0) {
      await batch.commit();
      logger.info(`✅  最終バッチ削除完了: ${totalDeleted}件`);
    }

    logger.info(`✅  Firestoreから全${totalDeleted}件を削除しました`);
    return true;
  } catch (error) {
    logger.error('クラウド全削除エラー:', error);

    // エラーメッセージを詳細化
    let errorMessage = 'クラウドからの全削除に失敗しました';
    if (error.code === 'permission-denied') {
      errorMessage = 'アクセス権限がありません。Firestoreのセキュリティルールを確認してください。';
    } else if (error.code === 'unavailable') {
      errorMessage = 'ネットワーク接続を確認してください。';
    } else if (error.message) {
      errorMessage = `全削除に失敗: ${error.message}`;
    }

    showToast(errorMessage, 'error');
    return false;
  }
}
