/**
 * ブラウザコンソールから実行するデータクリーンアップスクリプト
 *
 * 使用方法:
 * 1. index.htmlを開く
 * 2. ブラウザの開発者ツールを開く (F12)
 * 3. コンソールタブを開く
 * 4. 以下のコマンドを実行:
 *
 * // すべて削除（Firestore + IndexedDB + LocalStorage）
 * await cleanupAll()
 *
 * // IndexedDBのみ削除
 * await cleanupIndexedDB()
 *
 * // Firestoreのみ削除
 * await cleanupFirestore()
 *
 * // LocalStorageのみ削除
 * cleanupLocalStorage()
 *
 * // 状態確認
 * await checkDataStatus()
 */

import { logger } from './core/logger.js';

/**
 * すべてのデータを削除
 */
window.cleanupAll = async function() {
  logger.info('[警告] ️ すべてのデータを削除します...');

  const confirmed = confirm(
    '[警告] ️ 本当にすべてのデータを削除しますか？\n\n' +
    'この操作は取り消せません！\n\n' +
    '削除されるデータ:\n' +
    '- Firestore（クラウド）\n' +
    '- IndexedDB（端末）\n' +
    '- LocalStorage設定'
  );

  if (!confirmed) {
    logger.info('[エラー]  キャンセルされました');
    return;
  }

  try {
    // 動的にモジュールをインポート
    const { clearAllHistory } = await import('./storage.js');

    logger.info('[削除]  Firestore & IndexedDB を削除中...');
    await clearAllHistory();
    logger.info('✅  Firestore & IndexedDB 削除完了');

    logger.info('[削除]  LocalStorage を削除中...');
    localStorage.clear();
    logger.info('✅  LocalStorage 削除完了');

    logger.info('🎉 すべてのデータを削除しました！');

    // 状態確認
    await checkDataStatus();

  } catch (error) {
    logger.error('[エラー]  エラー:', error);
    throw error;
  }
};

/**
 * IndexedDBのみ削除
 */
window.cleanupIndexedDB = async function() {
  logger.info('[警告] ️ IndexedDBを削除します...');

  try {
    const { db } = await import('./db.js');

    await db.open();
    await db.clear();

    logger.info('✅  IndexedDB削除完了');

    // 状態確認
    await checkDataStatus();

  } catch (error) {
    logger.error('[エラー]  エラー:', error);
    throw error;
  }
};

/**
 * Firestoreのみ削除
 */
window.cleanupFirestore = async function() {
  logger.info('[警告] ️ Firestoreを削除します...');

  try {
    const { clearAllFromCloud } = await import('./firebase-sync.js');
    const { isSignedIn } = await import('./firebase-auth.js');

    if (!isSignedIn()) {
      logger.warn('[警告] ️ ログインしていません。Firestoreの削除にはログインが必要です。');
      return;
    }

    await clearAllFromCloud();

    logger.info('✅  Firestore削除完了');

    // 状態確認
    await checkDataStatus();

  } catch (error) {
    logger.error('[エラー]  エラー:', error);
    throw error;
  }
};

/**
 * LocalStorageのみ削除
 */
window.cleanupLocalStorage = function() {
  logger.info('[警告] ️ LocalStorageを削除します...');

  try {
    const keys = Object.keys(localStorage);
    logger.info(`削除前: ${keys.length} 件`);
    logger.info('キー:', keys);

    localStorage.clear();

    logger.info('✅  LocalStorage削除完了');
    logger.info(`削除後: ${Object.keys(localStorage).length} 件`);

  } catch (error) {
    logger.error('[エラー]  エラー:', error);
    throw error;
  }
};

/**
 * データ状態を確認
 */
window.checkDataStatus = async function() {
  logger.info(' データ状態を確認中...');
  logger.info('─'.repeat(50));

  try {
    // ログイン状態
    const { isSignedIn, getCurrentUser } = await import('./firebase-auth.js');
    if (isSignedIn()) {
      const user = getCurrentUser();
      logger.info('✅  ログイン状態: ログイン中');
      logger.info('   ユーザー:', user.email);
      logger.info('   UID:', user.uid);
    } else {
      logger.info('[エラー]  ログイン状態: ログアウト');
    }

    // IndexedDB
    const { db } = await import('./db.js');
    await db.open();
    const localData = await db.getAll();
    logger.info(` IndexedDB: ${localData.length} 件`);
    if (localData.length > 0) {
      logger.info('   最初の3件:', localData.slice(0, 3).map(item => ({
        id: item.id,
        name: item.name,
        uuid: item.uuid
      })));
    }

    // Firestore
    if (isSignedIn()) {
      const user = getCurrentUser();
      const firestore = firebase.firestore();
      const snapshot = await firestore
        .collection('users')
        .doc(user.uid)
        .collection('history')
        .get();
      logger.info(` Firestore: ${snapshot.size} 件`);
      if (snapshot.size > 0) {
        logger.info('   最初の3件:', snapshot.docs.slice(0, 3).map(doc => ({
          id: doc.id,
          name: doc.data().name,
          uuid: doc.data().uuid
        })));
      }
    } else {
      logger.info(' Firestore: ログインが必要');
    }

    // LocalStorage
    const keys = Object.keys(localStorage);
    logger.info(` LocalStorage: ${keys.length} 件`);
    if (keys.length > 0) {
      logger.info('   キー:', keys);
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        logger.info(`   - ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      });
    }

    logger.info('─'.repeat(50));
    logger.info('✅  状態確認完了');

  } catch (error) {
    logger.error('[エラー]  エラー:', error);
    throw error;
  }
};

// 初回実行時にヘルプを表示
logger.info(`
╔════════════════════════════════════════════════════════════╗
║           データクリーンアップコマンド                      ║
╚════════════════════════════════════════════════════════════╝

以下のコマンドが使用可能です:

 状態確認:
  await checkDataStatus()

[削除]  削除コマンド:
  await cleanupAll()          // すべて削除
  await cleanupIndexedDB()    // IndexedDBのみ
  await cleanupFirestore()    // Firestoreのみ
  cleanupLocalStorage()       // LocalStorageのみ

 使用例:
  // 1. まず状態確認
  await checkDataStatus()

  // 2. すべて削除
  await cleanupAll()

  // 3. もう一度確認
  await checkDataStatus()

[警告] ️ 注意: すべての削除操作は取り消せません！

🌐 GUIで削除したい場合は:
  cleanup.html を開いてください
`);

// 初回状態確認を実行
(async () => {
  try {
    await checkDataStatus();
  } catch (error) {
    logger.warn('初回状態確認をスキップしました:', error.message);
  }
})();
