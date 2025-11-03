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

/**
 * すべてのデータを削除
 */
window.cleanupAll = async function() {
  console.log('⚠️ すべてのデータを削除します...');

  const confirmed = confirm(
    '⚠️ 本当にすべてのデータを削除しますか？\n\n' +
    'この操作は取り消せません！\n\n' +
    '削除されるデータ:\n' +
    '- Firestore（クラウド）\n' +
    '- IndexedDB（端末）\n' +
    '- LocalStorage設定'
  );

  if (!confirmed) {
    console.log('❌ キャンセルされました');
    return;
  }

  try {
    // 動的にモジュールをインポート
    const { clearAllHistory } = await import('./storage.js');

    console.log('🗑️ Firestore & IndexedDB を削除中...');
    await clearAllHistory();
    console.log('✅ Firestore & IndexedDB 削除完了');

    console.log('🗑️ LocalStorage を削除中...');
    localStorage.clear();
    console.log('✅ LocalStorage 削除完了');

    console.log('🎉 すべてのデータを削除しました！');

    // 状態確認
    await checkDataStatus();

  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  }
};

/**
 * IndexedDBのみ削除
 */
window.cleanupIndexedDB = async function() {
  console.log('⚠️ IndexedDBを削除します...');

  try {
    const { db } = await import('./db.js');

    await db.open();
    await db.clear();

    console.log('✅ IndexedDB削除完了');

    // 状態確認
    await checkDataStatus();

  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  }
};

/**
 * Firestoreのみ削除
 */
window.cleanupFirestore = async function() {
  console.log('⚠️ Firestoreを削除します...');

  try {
    const { clearAllFromCloud } = await import('./firebase-sync.js');
    const { isSignedIn } = await import('./firebase-auth.js');

    if (!isSignedIn()) {
      console.warn('⚠️ ログインしていません。Firestoreの削除にはログインが必要です。');
      return;
    }

    await clearAllFromCloud();

    console.log('✅ Firestore削除完了');

    // 状態確認
    await checkDataStatus();

  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  }
};

/**
 * LocalStorageのみ削除
 */
window.cleanupLocalStorage = function() {
  console.log('⚠️ LocalStorageを削除します...');

  try {
    const keys = Object.keys(localStorage);
    console.log(`削除前: ${keys.length} 件`);
    console.log('キー:', keys);

    localStorage.clear();

    console.log('✅ LocalStorage削除完了');
    console.log(`削除後: ${Object.keys(localStorage).length} 件`);

  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  }
};

/**
 * データ状態を確認
 */
window.checkDataStatus = async function() {
  console.log('📊 データ状態を確認中...');
  console.log('─'.repeat(50));

  try {
    // ログイン状態
    const { isSignedIn, getCurrentUser } = await import('./firebase-auth.js');
    if (isSignedIn()) {
      const user = getCurrentUser();
      console.log('✅ ログイン状態: ログイン中');
      console.log('   ユーザー:', user.email);
      console.log('   UID:', user.uid);
    } else {
      console.log('❌ ログイン状態: ログアウト');
    }

    // IndexedDB
    const { db } = await import('./db.js');
    await db.open();
    const localData = await db.getAll();
    console.log(`📦 IndexedDB: ${localData.length} 件`);
    if (localData.length > 0) {
      console.log('   最初の3件:', localData.slice(0, 3).map(item => ({
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
      console.log(`☁️ Firestore: ${snapshot.size} 件`);
      if (snapshot.size > 0) {
        console.log('   最初の3件:', snapshot.docs.slice(0, 3).map(doc => ({
          id: doc.id,
          name: doc.data().name,
          uuid: doc.data().uuid
        })));
      }
    } else {
      console.log('☁️ Firestore: ログインが必要');
    }

    // LocalStorage
    const keys = Object.keys(localStorage);
    console.log(`💾 LocalStorage: ${keys.length} 件`);
    if (keys.length > 0) {
      console.log('   キー:', keys);
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        console.log(`   - ${key}: ${value.substring(0, 50)}${value.length > 50 ? '...' : ''}`);
      });
    }

    console.log('─'.repeat(50));
    console.log('✅ 状態確認完了');

  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  }
};

// 初回実行時にヘルプを表示
console.log(`
╔════════════════════════════════════════════════════════════╗
║           データクリーンアップコマンド                      ║
╚════════════════════════════════════════════════════════════╝

以下のコマンドが使用可能です:

📊 状態確認:
  await checkDataStatus()

🗑️ 削除コマンド:
  await cleanupAll()          // すべて削除
  await cleanupIndexedDB()    // IndexedDBのみ
  await cleanupFirestore()    // Firestoreのみ
  cleanupLocalStorage()       // LocalStorageのみ

📝 使用例:
  // 1. まず状態確認
  await checkDataStatus()

  // 2. すべて削除
  await cleanupAll()

  // 3. もう一度確認
  await checkDataStatus()

⚠️ 注意: すべての削除操作は取り消せません！

🌐 GUIで削除したい場合は:
  cleanup.html を開いてください
`);

// 初回状態確認を実行
(async () => {
  try {
    await checkDataStatus();
  } catch (error) {
    console.warn('初回状態確認をスキップしました:', error.message);
  }
})();
