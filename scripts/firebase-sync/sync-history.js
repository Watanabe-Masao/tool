/**
 * History Synchronization Module
 *
 * This module provides:
 * - Upload/download history to/from Firestore
 * - Bidirectional synchronization
 * - Conflict resolution with timestamp comparison
 * - File import/export for IndexedDB-unavailable environments
 * - Realtime listener setup
 */

import { logger } from '../core/logger.js';
import { getCurrentUser, isSignedIn } from '../firebase-auth.js';
import { db as dbInstance } from '../db.js';
import { showToast } from '../toast.js';
import {
  getFirestore,
  getServerTimestamp,
  getTimestampFromDate,
  removeUndefinedFields
} from './firestore.js';
import {
  sleep,
  updateSyncStatus,
  getDeviceId,
  generateUUID
} from './utils.js';

let isSyncing = false;
let lastSyncTime = null;
let isFirstDownloadInSession = true; // ページ立ち上げ後の最初のダウンロードかどうか

// LocalStorageキー
const LAST_SYNC_TIME_KEY = 'yield-calculator-last-sync-time';

/**
 * 最終同期時刻をLocalStorageから読み込む
 */
function loadLastSyncTime() {
  try {
    const stored = localStorage.getItem(LAST_SYNC_TIME_KEY);
    if (stored) {
      const parsedDate = new Date(stored);
      // 有効な日付かチェック（Safari対応）
      if (!isNaN(parsedDate.getTime())) {
        lastSyncTime = parsedDate;
        logger.info('最終同期時刻を読み込み:', lastSyncTime);
      } else {
        logger.warn('無効な日付形式のため最終同期時刻をリセット:', stored);
        localStorage.removeItem(LAST_SYNC_TIME_KEY);
        lastSyncTime = null;
      }
    }
  } catch (error) {
    logger.error('最終同期時刻の読み込みエラー:', error);
    lastSyncTime = null;
  }
}

/**
 * 最終同期時刻をLocalStorageに保存
 */
function saveLastSyncTime(time) {
  try {
    lastSyncTime = time;
    localStorage.setItem(LAST_SYNC_TIME_KEY, time.toISOString());
    logger.info('最終同期時刻を保存:', lastSyncTime);
  } catch (error) {
    logger.error('最終同期時刻の保存エラー:', error);
  }
}

// 初期化時に最終同期時刻を読み込む
loadLastSyncTime();

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
      logger.error('IndexedDB接続エラー:', dbError);

      // ユーザーフレンドリーなエラーメッセージ
      let errorMessage = 'ローカルデータベースに接続できません。';

      if (dbError.message && dbError.message.includes('プライベートモード')) {
        errorMessage = 'プライベートモード/シークレットモードではデータベースが使用できません。通常モードで開いてください。';
      } else if (dbError.name === 'QuotaExceededError') {
        errorMessage = 'ストレージ容量が不足しています。不要なデータを削除してください。';
      } else {
        errorMessage = `データベースエラー: ${dbError.message || dbError.toString()}\n\n【対処方法】\n• 他のタブを閉じる\n• ブラウザを再起動する\n• プライベートモードを無効にする\n\n代替手段として、手動ダウンロード/アップロードボタンをご利用ください。`;
      }

      showToast(errorMessage, 'error');
      updateSyncStatus('error');
      isSyncing = false; // エラー時にフラグをリセット
      return false;
    }

    // IndexedDBから全履歴を取得（削除済みも含む）
    const allHistory = await getAllHistoryFromIndexedDB();

    // 差分同期: 最終同期時刻以降に更新されたデータのみをフィルタリング
    let localHistory;
    if (lastSyncTime && !isNaN(lastSyncTime.getTime())) {
      localHistory = allHistory.filter(item => {
        // updatedAtフィールドを確認
        const checkTime = item.updatedAt;
        if (!checkTime) {
          // タイムスタンプがない場合は常にアップロード
          return true;
        }
        const itemTime = new Date(checkTime);
        // 有効な日付でない場合もアップロード
        if (isNaN(itemTime.getTime())) {
          return true;
        }
        return itemTime > lastSyncTime;
      });
      logger.info(`差分同期: 全${allHistory.length}件中${localHistory.length}件をアップロード`);
    } else {
      // 初回同期: 全データをアップロード
      localHistory = allHistory;
      logger.info(`初回同期: 全${localHistory.length}件をアップロード`);
    }

    if (localHistory.length === 0) {
      showToast('アップロードするデータがありません', 'info');
      saveLastSyncTime(new Date()); // 同期時刻だけ更新
      return true;
    }

    // バッチ書き込み（最大500件ずつ）
    let batch = firestore.batch();
    let batchCount = 0;
    let totalUploaded = 0;
    const errors = [];

    for (const item of localHistory) {
      try {
        // UUIDをFirestoreドキュメントIDとして使用
        if (!item.uuid) {
          logger.error(`[エラー]  UUID未設定のアイテムをスキップ (IndexedDB ID: ${item.id})`);
          errors.push({ itemId: item.id, error: 'UUID not found' });
          continue;
        }

        const docRef = firestore
          .collection('users')
          .doc(user.uid)
          .collection('history')
          .doc(item.uuid); // UUIDをドキュメントIDとして使用

        if (totalUploaded === 0) {
          logger.info('[アップロード]  UUID方式でアップロード:', item.uuid);
        }

        // タイムスタンプを追加（idフィールドは除外）
        const { id, firestoreId, ...itemData } = item; // firestoreIdも除外（互換性のため）

        // undefinedフィールドを削除
        const cleanedItemData = removeUndefinedFields(itemData);

        const dataToUpload = {
          ...cleanedItemData,
          updatedAt: getServerTimestamp(),
          deviceId: getDeviceId(),
        };

        batch.set(docRef, dataToUpload, { merge: true });
        batchCount++;
        totalUploaded++;

        // 500件ごとにコミット
        if (batchCount >= 500) {
          await batch.commit();
          logger.info(`✅  バッチコミット成功: ${totalUploaded}件`);
          batch = firestore.batch(); // 新しいバッチを作成
          batchCount = 0;
        }
      } catch (itemError) {
        logger.error(`[エラー]  アイテムアップロードエラー (ID: ${item.id}):`, itemError);
        errors.push({ itemId: item.id, error: itemError.message });
        // エラーが発生してもバッチに追加せず、次のアイテムに進む
      }
    }

    // 残りをコミット
    if (batchCount > 0) {
      await batch.commit();
      logger.info(`✅  最終バッチコミット成功: ${totalUploaded}件`);
    }

    // エラーがあった場合は警告を表示
    if (errors.length > 0) {
      logger.warn(`[警告] ️ ${errors.length}件のアイテムでエラーが発生しました:`, errors);
      updateSyncStatus('warning');
      showToast(`${totalUploaded}件アップロード完了（${errors.length}件スキップ）`, 'warning');
      // ★重要: エラーがある場合はlastSyncTimeを更新しない（次回再試行するため）
      logger.warn('[警告] ️ 一部エラーが発生したため、同期時刻は更新しません（次回再試行します）');
    } else {
      // 全て成功の場合のみlastSyncTimeを更新
      saveLastSyncTime(new Date());
      updateSyncStatus('success');
      showToast(`${totalUploaded}件のデータをアップロードしました`, 'success');
      logger.info('✅  全て成功したため、同期時刻を更新しました');
    }

    return true;
  } catch (error) {
    logger.error('アップロードエラー:', error);
    logger.error('エラー詳細:', {
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack
    });
    updateSyncStatus('error');

    // エラーメッセージをより詳細に
    let errorMessage = 'アップロードに失敗しました';
    if (error.code === 'permission-denied') {
      errorMessage = 'アクセス権限がありません。Firestoreのセキュリティルールを確認してください。';
    } else if (error.code === 'unavailable') {
      errorMessage = 'ネットワーク接続を確認してください。';
    } else if (error.message && error.message.includes('indexOf')) {
      errorMessage = 'データ型エラーが発生しました。ページを再読み込みして再試行してください。';
      logger.error('[ヒント]  ヒント: IndexedDBとFirestoreのID型の不一致が原因の可能性があります');
    } else if (error.message) {
      errorMessage = `アップロードに失敗: ${error.message}`;
    }

    showToast(errorMessage, 'error');
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
      logger.error('IndexedDB接続エラー:', dbError);

      let errorMessage = 'ローカルデータベースに接続できません。';

      if (dbError.message && dbError.message.includes('プライベートモード')) {
        errorMessage = 'プライベートモード/シークレットモードではデータベースが使用できません。通常モードで開いてください。';
      } else if (dbError.name === 'QuotaExceededError') {
        errorMessage = 'ストレージ容量が不足しています。不要なデータを削除してください。';
      } else {
        errorMessage = `データベースエラー: ${dbError.message || dbError.toString()}\n\n【対処方法】\n• 他のタブを閉じる\n• ブラウザを再起動する\n• プライベートモードを無効にする\n\n代替手段として、手動ダウンロード/アップロードボタンをご利用ください。`;
      }

      showToast(errorMessage, 'error');
      updateSyncStatus('error');
      isSyncing = false; // エラー時にフラグをリセット
      return false;
    }

    // Firestoreから履歴を取得（セッション初回は全件、2回目以降は差分）
    let snapshot;
    let usedDifferentialSync = false;

    try {
      let query = firestore
        .collection('users')
        .doc(user.uid)
        .collection('history');

      // セッション初回は強制的に全件取得
      if (isFirstDownloadInSession) {
        logger.info(' セッション初回: 全データを取得');
        snapshot = await query.get();
        logger.info(`✅  全件取得成功: ${snapshot.size}件`);
      }
      // 2回目以降は差分同期
      else if (lastSyncTime) {
        try {
          const lastSyncTimestamp = getTimestampFromDate(lastSyncTime);
          query = query.where('updatedAt', '>', lastSyncTimestamp);
          logger.info('⚡ 差分同期を試行: 最終同期時刻以降のデータのみ取得', lastSyncTime);
          snapshot = await query.get();
          usedDifferentialSync = true;
          logger.info(`✅  差分同期成功: ${snapshot.size}件取得`);
        } catch (differentialError) {
          logger.warn('差分同期に失敗、全件取得にフォールバック:', differentialError);
          // 差分同期に失敗した場合は全件取得
          query = firestore
            .collection('users')
            .doc(user.uid)
            .collection('history');
          snapshot = await query.get();
          logger.info('✅  全件取得成功:', snapshot.size);
        }
      } else {
        logger.info(' 初回同期: 全データを取得');
        snapshot = await query.get();
      }
    } catch (error) {
      logger.error('Firestore取得エラー:', error);
      // エラー時はセッションフラグを維持（次回も全件取得を試行）
      logger.warn('[警告] ️ エラーが発生しました。次回も全件取得を試行します。');
      throw error;
    }

    if (snapshot.empty) {
      showToast('ダウンロードする新しいデータがありません', 'info');
      saveLastSyncTime(new Date()); // 同期時刻だけ更新

      // セッション初回ダウンロードが完了したらフラグを更新（データが空でも成功扱い）
      if (isFirstDownloadInSession) {
        isFirstDownloadInSession = false;
        logger.info('✅  セッション初回ダウンロード完了（データなし）。次回から差分同期を使用します');
      }

      return true;
    }

    logger.info(`${snapshot.size}件のデータをダウンロード`);

    const cloudHistory = snapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id,
    }));

    // IndexedDBに保存（競合解決あり）
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    // Safari対応: トランザクション間に遅延を入れて競合を防ぐ
    for (let i = 0; i < cloudHistory.length; i++) {
      const cloudItem = cloudHistory[i];

      try {
        const result = await mergeHistoryItem(cloudItem);
        if (result === 'imported') imported++;
        else if (result === 'updated') updated++;
        else skipped++;
      } catch (itemError) {
        // 個別アイテムのエラーをキャッチし、処理を継続
        errors++;
        const errorMsg = `ID: ${cloudItem.id}, エラー: ${itemError.message || itemError.toString()}`;
        errorDetails.push(errorMsg);
        logger.error(`[エラー]  アイテム保存エラー (${i + 1}/${cloudHistory.length}):`, errorMsg);

        // エラー内容をコンソールに詳細表示
        logger.error('エラー詳細:', itemError);
        logger.error('問題のアイテム:', cloudItem);
      }

      // 5件ごとに遅延を挿入（Safari対応: トランザクション競合を防止）
      if ((i + 1) % 5 === 0 && i < cloudHistory.length - 1) {
        await sleep(100);
      }
    }

    // 結果に応じてステータスを更新
    if (errors > 0 && imported === 0 && updated === 0) {
      // 全てエラーの場合
      updateSyncStatus('error');
      showToast(`ダウンロード失敗: ${errors}件のエラーが発生しました`, 'error');
      logger.error('エラー詳細一覧:', errorDetails);
      // ★重要: エラー発生時はlastSyncTimeを更新しない（次回も全データを再取得するため）
      logger.warn('[警告] ️ エラーが発生したため、同期時刻は更新しません');
    } else if (errors > 0) {
      // 一部エラーの場合
      updateSyncStatus('warning');
      showToast(`ダウンロード完了: 新規${imported}件、更新${updated}件、スキップ${skipped}件、エラー${errors}件`, 'warning');
      logger.warn('エラー詳細一覧:', errorDetails);
      // ★重要: 一部エラーの場合もlastSyncTimeを更新しない（失敗したデータを次回再試行するため）
      logger.warn('[警告] ️ 一部エラーが発生したため、同期時刻は更新しません（次回再試行します）');
    } else {
      // 全て成功の場合のみlastSyncTimeを更新
      saveLastSyncTime(new Date());
      updateSyncStatus('success');
      showToast(`ダウンロード完了: 新規${imported}件、更新${updated}件、スキップ${skipped}件`, 'success');
      logger.info('✅  全て成功したため、同期時刻を更新しました');

      // セッション初回ダウンロードが成功したらフラグを更新
      if (isFirstDownloadInSession) {
        isFirstDownloadInSession = false;
        logger.info('✅  セッション初回ダウンロード完了。次回から差分同期を使用します');
      }
    }

    // UIを更新
    const event = new CustomEvent('historyUpdated');
    window.dispatchEvent(event);

    return true;
  } catch (error) {
    logger.error('ダウンロードエラー:', error);
    updateSyncStatus('error');
    showToast(`ダウンロードに失敗: ${error.message}`, 'error');
    return false;
  } finally {
    isSyncing = false;
  }
}

/**
 * 双方向同期（アップロード→ダウンロード）
 *
 * 改善点：
 * - アップロードが失敗してもダウンロードを試行（ネットワーク状況で片方だけ成功する場合がある）
 * - 両方の結果を個別に評価し、部分的な成功も報告
 *
 * @returns {Promise<{uploadSuccess: boolean, downloadSuccess: boolean, overallSuccess: boolean}>}
 */
export async function syncData() {
  if (!isSignedIn()) {
    return { uploadSuccess: false, downloadSuccess: false, overallSuccess: false };
  }

  let uploadSuccess = false;
  let downloadSuccess = false;

  try {
    // アップロードを試行（失敗してもダウンロードは試行する）
    try {
      uploadSuccess = await uploadToCloud();
      if (uploadSuccess) {
        logger.info('✅  アップロード成功');
      } else {
        logger.warn('[警告] ️ アップロード失敗（ダウンロードは続行します）');
      }
    } catch (uploadError) {
      logger.error('[エラー]  アップロードエラー:', uploadError);
      logger.warn('[警告] ️ ダウンロードは続行します');
    }

    // ダウンロードを試行
    try {
      downloadSuccess = await downloadFromCloud();
      if (downloadSuccess) {
        logger.info('✅  ダウンロード成功');
      } else {
        logger.warn('[警告] ️ ダウンロード失敗');
      }
    } catch (downloadError) {
      logger.error('[エラー]  ダウンロードエラー:', downloadError);
    }

    // 結果の評価
    const overallSuccess = uploadSuccess && downloadSuccess;

    if (overallSuccess) {
      logger.info('✅  双方向同期が完全に成功しました');
    } else if (uploadSuccess || downloadSuccess) {
      logger.warn('[警告] ️ 部分的な同期成功:', {
        upload: uploadSuccess ? '成功' : '失敗',
        download: downloadSuccess ? '成功' : '失敗'
      });
    } else {
      logger.error('[エラー]  同期が完全に失敗しました');
    }

    return { uploadSuccess, downloadSuccess, overallSuccess };
  } catch (error) {
    logger.error('同期エラー:', error);
    return { uploadSuccess, downloadSuccess, overallSuccess: false };
  }
}

/**
 * IndexedDBから全履歴を取得
 */
async function getAllHistoryFromIndexedDB() {
  try {
    return await dbInstance.getAll();
  } catch (error) {
    logger.error('履歴取得エラー:', error);
    throw error;
  }
}

/**
 * 履歴アイテムをマージ（競合解決）
 * Safari対応: リトライロジック付き（強化版）
 * データ整合性: UUID検証強化、重複防止
 */
async function mergeHistoryItem(cloudItem, retryCount = 0) {
  const MAX_RETRIES = 5; // リトライ回数を増加
  const RETRY_DELAY = 200; // 基本遅延を100ms→200msに増加

  try {
    // UUIDで照合（新しい方式）
    const uuid = cloudItem.uuid;
    let localItem = null;

    if (uuid) {
      // UUIDがある場合はそれで検索
      localItem = await dbInstance.getByUuid(uuid);
    } else {
      // 互換性レイヤー: 古いデータ（firestoreIdまたは数値IDベース）の対応
      logger.warn('[警告] ️ UUID未設定のクラウドデータを検出:', cloudItem.id);

      if (cloudItem.firestoreId) {
        // firestoreIdベースの旧データ
        localItem = await dbInstance.getByFirestoreId(cloudItem.firestoreId);
        // 見つかった場合、UUIDを生成して設定
        if (localItem && !localItem.uuid) {
          const newUuid = cloudItem.id; // FirestoreドキュメントID自体がUUIDの可能性
          logger.info(` 旧データ移行: firestoreId "${cloudItem.firestoreId}" に UUID "${newUuid}" を設定`);
          await dbInstance.update(localItem.id, { uuid: newUuid });
          localItem.uuid = newUuid;
        }
      } else {
        // 数値IDベースの最も古いデータ
        const numericId = !isNaN(Number(cloudItem.id)) ? Number(cloudItem.id) : null;
        if (numericId) {
          localItem = await dbInstance.getById(numericId);
          // 見つかった場合、UUIDを生成して設定
          if (localItem && !localItem.uuid) {
            const newUuid = generateUUID();
            logger.info(` 旧データ移行: IndexedDB ID:${numericId} に新しいUUID "${newUuid}" を生成`);
            await dbInstance.update(numericId, { uuid: newUuid });
            localItem.uuid = newUuid;
            // Firestoreにも反映するためにcloudItemを更新
            cloudItem.uuid = newUuid;
          }
        }
      }
    }

    if (!localItem) {
      // 新規アイテム: IndexedDBが自動的に新しいIDを割り当てるため、idフィールドを除外
      const { id, firestoreId, ...itemWithoutId } = cloudItem;

      // データ整合性チェック: 必須フィールドの検証
      if (!itemWithoutId.uuid) {
        logger.warn('[警告] ️ UUID未設定のため新規UUIDを生成します');
        itemWithoutId.uuid = uuid || cloudItem.id || generateUUID();
      }

      const newId = await dbInstance.save(itemWithoutId);
      logger.info(` 新規インポート (UUID: ${itemWithoutId.uuid} → IndexedDB ID: ${newId})`);
      return 'imported';
    } else {
      // 競合解決：タイムスタンプで判定
      const cloudTime = cloudItem.updatedAt?.toDate?.() || new Date(cloudItem.timestamp);
      const localTime = localItem.updatedAt ? new Date(localItem.updatedAt) : new Date(localItem.timestamp);

      if (cloudTime > localTime) {
        // クラウドの方が新しい→更新
        const { id, firestoreId, ...itemWithoutId } = cloudItem;

        // データ整合性: UUIDの一致確認（Cloud-first戦略）
        if (itemWithoutId.uuid && localItem.uuid && itemWithoutId.uuid !== localItem.uuid) {
          logger.error('[エラー]  UUID不一致を検出:', {
            cloud: itemWithoutId.uuid,
            local: localItem.uuid,
            localId: localItem.id
          });

          // Cloud-first戦略: クラウドのUUIDを優先し、別アイテムとして新規追加
          logger.warn('[警告] ️ UUID不一致のため、クラウドのデータを新規アイテムとして追加します（Cloud-first戦略）');

          // ローカルアイテムはそのまま保持し、クラウドアイテムを新規追加
          const newId = await dbInstance.save(itemWithoutId);
          logger.info(` UUID不一致により新規インポート (Cloud UUID: ${itemWithoutId.uuid} → New IndexedDB ID: ${newId})`);
          logger.info(`   ローカルの既存データは保持されます (Local UUID: ${localItem.uuid}, Local ID: ${localItem.id})`);
          return 'imported';
        }

        await dbInstance.update(localItem.id, itemWithoutId);
        logger.info(` 更新 (UUID: ${localItem.uuid} → IndexedDB ID: ${localItem.id})`);
        return 'updated';
      } else {
        // ローカルの方が新しい→スキップ
        logger.info(`⏭️ スキップ (UUID: ${localItem.uuid})`);
        return 'skipped';
      }
    }
  } catch (error) {
    // Safari特有のトランザクション競合エラーをリトライ
    const isTransactionError = error.name === 'InvalidStateError' ||
                                error.name === 'TransactionInactiveError' ||
                                error.name === 'AbortError';

    if (isTransactionError && retryCount < MAX_RETRIES) {
      logger.warn(`トランザクション競合エラー、リトライ ${retryCount + 1}/${MAX_RETRIES}:`, error.name);
      await sleep(RETRY_DELAY * (retryCount + 1)); // 指数バックオフ
      return await mergeHistoryItem(cloudItem, retryCount + 1);
    }

    logger.error('アイテムマージエラー:', error);
    throw error;
  }
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

        logger.info('クラウドデータが更新されました');
        // 自動でダウンロード
        downloadFromCloud();
      },
      (error) => {
        logger.error('リアルタイムリスナーエラー:', error);
      }
    );

  return unsubscribe;
}

/**
 * Firebaseから直接JSONファイルとしてダウンロード
 * IndexedDBが使えない環境向け
 */
export async function downloadToFile() {
  if (!isSignedIn()) {
    showToast('ログインしてください', 'warning');
    return false;
  }

  try {
    const user = getCurrentUser();
    const firestore = getFirestore();

    showToast('クラウドからダウンロード中...', 'info');

    // Firestoreから全履歴を取得
    const snapshot = await firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .get();

    if (snapshot.empty) {
      showToast('クラウドにデータがありません', 'info');
      return false;
    }

    const cloudHistory = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: String(doc.id), // IDを確実に文字列として保存
        // Timestamp を文字列に変換
        updatedAt: data.updatedAt?.toDate?.().toISOString() || null,
        timestamp: data.timestamp,
      };
    });

    // JSONファイルとしてダウンロード
    const jsonString = JSON.stringify(cloudHistory, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yield-calculator-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`${cloudHistory.length}件のデータをダウンロードしました`, 'success');
    return true;
  } catch (error) {
    logger.error('ファイルダウンロードエラー:', error);
    showToast(`ダウンロードに失敗: ${error.message}`, 'error');
    return false;
  }
}

/**
 * JSONファイルからFirebaseへアップロード
 * IndexedDBが使えない環境向け
 */
export async function uploadFromFile(file) {
  if (!isSignedIn()) {
    showToast('ログインしてください', 'warning');
    return false;
  }

  try {
    const user = getCurrentUser();
    const firestore = getFirestore();

    showToast('ファイルを読み込み中...', 'info');

    // ファイルを読み込み
    const fileContent = await file.text();
    const data = JSON.parse(fileContent);

    if (!Array.isArray(data)) {
      showToast('ファイル形式が正しくありません（配列形式のJSONが必要です）', 'error');
      return false;
    }

    showToast(`${data.length}件のデータをアップロード中...`, 'info');

    // バッチ書き込み（最大500件ずつ）
    let totalUploaded = 0;
    const batchSize = 500;

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = firestore.batch();
      const chunk = data.slice(i, i + batchSize);

      chunk.forEach(item => {
        // UUIDを取得または生成（UUID v4に統一）
        const docId = (item.uuid && typeof item.uuid === 'string') ? item.uuid :
                      (item.id && typeof item.id === 'string') ? item.id :
                      generateUUID();

        const docRef = firestore
          .collection('users')
          .doc(user.uid)
          .collection('history')
          .doc(docId);

        // タイムスタンプを復元
        const cleanedItem = removeUndefinedFields(item);

        const dataToUpload = {
          ...cleanedItem,
          uuid: docId, // UUIDを確実に設定
          updatedAt: item.updatedAt ? getTimestampFromDate(new Date(item.updatedAt)) : getServerTimestamp(),
          deviceId: getDeviceId(),
        };

        batch.set(docRef, dataToUpload, { merge: true });
      });

      await batch.commit();
      totalUploaded += chunk.length;

      // 進捗表示
      if (data.length > batchSize) {
        showToast(`アップロード中... ${totalUploaded}/${data.length}件`, 'info');
      }
    }

    showToast(`${totalUploaded}件のデータをアップロードしました`, 'success');
    return true;
  } catch (error) {
    logger.error('ファイルアップロードエラー:', error);

    let errorMessage = 'アップロードに失敗しました';
    if (error instanceof SyntaxError) {
      errorMessage = 'JSONファイルの形式が正しくありません';
    } else {
      errorMessage = `アップロードに失敗: ${error.message}`;
    }

    showToast(errorMessage, 'error');
    return false;
  }
}

// グローバルイベントリスナー
window.addEventListener('requestSync', () => {
  syncData();
});
