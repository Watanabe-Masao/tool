/**
 * Firebaseデータ同期モジュール
 * IndexedDBとFirestore間でデータを同期
 */

import { getCurrentUser, isSignedIn } from './firebase-auth.js';
import { db as dbInstance } from './db.js';
import { showToast } from './toast.js';

let isSyncing = false;
let lastSyncTime = null;

/**
 * Firestoreインスタンスを取得
 */
function getFirestore() {
  if (typeof firebase === 'undefined' || !firebase.apps.length) {
    throw new Error('Firebaseが初期化されていません');
  }
  return firebase.firestore();
}

/**
 * データをクラウドにアップロード
 */
export async function uploadToCloud() {
  if (!isSignedIn()) {
    showToast('ログインしてください', 'warning');
    return false;
  }

  if (isSyncing) {
    showToast('同期中です...', 'info');
    return false;
  }

  try {
    isSyncing = true;
    updateSyncStatus('uploading');

    const user = getCurrentUser();
    const firestore = getFirestore();

    // IndexedDBを開く（エラーハンドリング強化）
    try {
      await dbInstance.open();
    } catch (dbError) {
      console.error('IndexedDB接続エラー:', dbError);

      // ユーザーフレンドリーなエラーメッセージ
      let errorMessage = 'ローカルデータベースに接続できません。';

      if (dbError.message && dbError.message.includes('プライベートモード')) {
        errorMessage = 'プライベートモード/シークレットモードではデータベースが使用できません。通常モードで開いてください。';
      } else if (dbError.name === 'QuotaExceededError') {
        errorMessage = 'ストレージ容量が不足しています。不要なデータを削除してください。';
      } else {
        errorMessage = `データベースエラー: ${dbError.message}\n\n【対処方法】\n• 他のタブを閉じる\n• ブラウザを再起動する\n• プライベートモードを無効にする`;
      }

      showToast(errorMessage, 'error');
      updateSyncStatus('error');
      return false;
    }

    // IndexedDBから全履歴を取得
    const localHistory = await getAllHistoryFromIndexedDB();

    if (localHistory.length === 0) {
      showToast('アップロードするデータがありません', 'info');
      return true;
    }

    // バッチ書き込み（最大500件ずつ）
    const batch = firestore.batch();
    let batchCount = 0;
    let totalUploaded = 0;

    for (const item of localHistory) {
      const docRef = firestore
        .collection('users')
        .doc(user.uid)
        .collection('history')
        .doc(item.id || generateId());

      // タイムスタンプを追加
      const dataToUpload = {
        ...item,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        deviceId: getDeviceId(),
      };

      batch.set(docRef, dataToUpload, { merge: true });
      batchCount++;
      totalUploaded++;

      // 500件ごとにコミット
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // 残りをコミット
    if (batchCount > 0) {
      await batch.commit();
    }

    lastSyncTime = new Date();
    updateSyncStatus('success');
    showToast(`${totalUploaded}件のデータをアップロードしました`, 'success');

    return true;
  } catch (error) {
    console.error('アップロードエラー:', error);
    updateSyncStatus('error');
    showToast(`アップロードに失敗: ${error.message}`, 'error');
    return false;
  } finally {
    isSyncing = false;
  }
}

/**
 * データをクラウドからダウンロード
 */
export async function downloadFromCloud() {
  if (!isSignedIn()) {
    showToast('ログインしてください', 'warning');
    return false;
  }

  if (isSyncing) {
    showToast('同期中です...', 'info');
    return false;
  }

  try {
    isSyncing = true;
    updateSyncStatus('downloading');

    const user = getCurrentUser();
    const firestore = getFirestore();

    // IndexedDBを開く（エラーハンドリング強化）
    try {
      await dbInstance.open();
    } catch (dbError) {
      console.error('IndexedDB接続エラー:', dbError);

      let errorMessage = 'ローカルデータベースに接続できません。';

      if (dbError.message && dbError.message.includes('プライベートモード')) {
        errorMessage = 'プライベートモード/シークレットモードではデータベースが使用できません。通常モードで開いてください。';
      } else if (dbError.name === 'QuotaExceededError') {
        errorMessage = 'ストレージ容量が不足しています。不要なデータを削除してください。';
      } else {
        errorMessage = `データベースエラー: ${dbError.message}\n\n【対処方法】\n• 他のタブを閉じる\n• ブラウザを再起動する\n• プライベートモードを無効にする`;
      }

      showToast(errorMessage, 'error');
      updateSyncStatus('error');
      return false;
    }

    // Firestoreから全履歴を取得
    const snapshot = await firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .get();

    if (snapshot.empty) {
      showToast('クラウドにデータがありません', 'info');
      return true;
    }

    const cloudHistory = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    // IndexedDBに保存（競合解決あり）
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const cloudItem of cloudHistory) {
      const result = await mergeHistoryItem(cloudItem);
      if (result === 'imported') imported++;
      else if (result === 'updated') updated++;
      else skipped++;
    }

    lastSyncTime = new Date();
    updateSyncStatus('success');
    showToast(`ダウンロード完了: 新規${imported}件、更新${updated}件、スキップ${skipped}件`, 'success');

    // UIを更新
    const event = new CustomEvent('historyUpdated');
    window.dispatchEvent(event);

    return true;
  } catch (error) {
    console.error('ダウンロードエラー:', error);
    updateSyncStatus('error');
    showToast(`ダウンロードに失敗: ${error.message}`, 'error');
    return false;
  } finally {
    isSyncing = false;
  }
}

/**
 * 双方向同期（アップロード→ダウンロード）
 */
export async function syncData() {
  if (!isSignedIn()) {
    return false;
  }

  try {
    // アップロードしてからダウンロード
    const uploadSuccess = await uploadToCloud();
    if (!uploadSuccess) {
      return false;
    }

    const downloadSuccess = await downloadFromCloud();
    return downloadSuccess;
  } catch (error) {
    console.error('同期エラー:', error);
    return false;
  }
}

/**
 * IndexedDBから全履歴を取得
 */
async function getAllHistoryFromIndexedDB() {
  try {
    return await dbInstance.getAll();
  } catch (error) {
    console.error('履歴取得エラー:', error);
    throw error;
  }
}

/**
 * 履歴アイテムをマージ（競合解決）
 */
async function mergeHistoryItem(cloudItem) {
  try {
    // 既存のアイテムを確認
    const localItem = await dbInstance.getById(cloudItem.id);

    if (!localItem) {
      // 新規アイテム
      await dbInstance.save(cloudItem);
      return 'imported';
    } else {
      // 競合解決：タイムスタンプで判定
      const cloudTime = cloudItem.updatedAt?.toDate?.() || new Date(cloudItem.timestamp);
      const localTime = localItem.updatedAt?.toDate?.() || new Date(localItem.timestamp);

      if (cloudTime > localTime) {
        // クラウドの方が新しい→更新
        await dbInstance.update(cloudItem.id, cloudItem);
        return 'updated';
      } else {
        // ローカルの方が新しい→スキップ
        return 'skipped';
      }
    }
  } catch (error) {
    console.error('アイテムマージエラー:', error);
    throw error;
  }
}

/**
 * 同期ステータスを更新
 */
function updateSyncStatus(status) {
  const event = new CustomEvent('syncStatusChanged', {
    detail: { status, lastSyncTime }
  });
  window.dispatchEvent(event);
}

/**
 * デバイスIDを取得（またはと生成）
 */
function getDeviceId() {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * IDを生成
 */
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 最終同期時刻を取得
 */
export function getLastSyncTime() {
  return lastSyncTime;
}

/**
 * 同期中かどうか
 */
export function getIsSyncing() {
  return isSyncing;
}

/**
 * リアルタイムリスナーを設定（オプション）
 */
export function setupRealtimeListener() {
  if (!isSignedIn()) {
    return null;
  }

  const user = getCurrentUser();
  const firestore = getFirestore();

  // Firestoreの変更を監視
  const unsubscribe = firestore
    .collection('users')
    .doc(user.uid)
    .collection('history')
    .onSnapshot(
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites) {
          // 自分の書き込み中はスキップ
          return;
        }

        console.log('クラウドデータが更新されました');
        // 自動でダウンロード
        downloadFromCloud();
      },
      (error) => {
        console.error('リアルタイムリスナーエラー:', error);
      }
    );

  return unsubscribe;
}

// グローバルイベントリスナー
window.addEventListener('requestSync', () => {
  syncData();
});
