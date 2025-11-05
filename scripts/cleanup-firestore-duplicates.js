/**
import { logger } from './core/logger.js';
 * Firestore重複データクリーンアップスクリプト
 *
 * 実行方法:
 * 1. ブラウザのコンソールでこのスクリプトをコピー&ペースト
 * 2. cleanupFirestoreDuplicates() を実行
 *
 * 処理内容:
 * - 同じname・category・timestampのデータを検出
 * - 各グループで最新のupdatedAtを持つデータのみを残す
 * - UUID形式のデータを優先
 * - 古い重複データを削除
 */

async function cleanupFirestoreDuplicates() {
  logger.info('[クリーンアップ]  Firestoreクリーンアップを開始します...');

  // 認証チェック
  if (!firebase.auth().currentUser) {
    logger.error('[エラー]  ログインしてください');
    return;
  }

  const user = firebase.auth().currentUser;
  const firestore = firebase.firestore();

  try {
    // 全データを取得
    const snapshot = await firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .get();

    logger.info(` 取得したデータ: ${snapshot.size}件`);

    if (snapshot.empty) {
      logger.info('✅  クリーンアップするデータがありません');
      return;
    }

    // データをグループ化（name, category, timestampが同じものを重複とみなす）
    const dataMap = new Map();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const key = `${data.name || 'unknown'}_${data.category || 'unknown'}_${data.timestamp || 0}`;

      if (!dataMap.has(key)) {
        dataMap.set(key, []);
      }

      dataMap.get(key).push({
        docId: doc.id,
        data: data,
        hasUuid: !!data.uuid,
        hasFirestoreId: !!data.firestoreId,
        updatedAt: data.updatedAt?.toDate?.() || new Date(0)
      });
    });

    logger.info(` ユニークなデータグループ: ${dataMap.size}個`);

    // 重複を検出して削除リストを作成
    const toDelete = [];
    const toKeep = [];

    dataMap.forEach((items, key) => {
      if (items.length === 1) {
        // 重複なし
        toKeep.push(items[0]);
        logger.info(`✅  [${key}] 重複なし`);
      } else {
        // 重複あり: 最適なデータを選択
        logger.info(`[警告] ️ [${key}] ${items.length}件の重複を検出`);

        // ソート優先順位:
        // 1. UUID形式のデータを優先
        // 2. 最新のupdatedAtを優先
        items.sort((a, b) => {
          // UUIDの有無で比較
          if (a.hasUuid && !b.hasUuid) return -1;
          if (!a.hasUuid && b.hasUuid) return 1;

          // firestoreIdの有無で比較
          if (a.hasFirestoreId && !b.hasFirestoreId) return -1;
          if (!a.hasFirestoreId && b.hasFirestoreId) return 1;

          // updatedAtで比較（新しい方を優先）
          return b.updatedAt - a.updatedAt;
        });

        // 最初の1件を保持、残りを削除
        toKeep.push(items[0]);
        logger.info(`  ✅  保持: ${items[0].docId} (uuid: ${items[0].hasUuid}, updated: ${items[0].updatedAt.toISOString()})`);

        for (let i = 1; i < items.length; i++) {
          toDelete.push(items[i]);
          logger.info(`  [削除]  削除予定: ${items[i].docId} (uuid: ${items[i].hasUuid}, updated: ${items[i].updatedAt.toISOString()})`);
        }
      }
    });

    logger.info('\n クリーンアップサマリー:');
    logger.info(`  保持: ${toKeep.length}件`);
    logger.info(`  削除: ${toDelete.length}件`);

    if (toDelete.length === 0) {
      logger.info('✅  削除するデータがありません');
      return;
    }

    // 確認ダイアログ
    const confirmed = confirm(
      `Firestoreから${toDelete.length}件の重複データを削除します。\n\n` +
      `削除するデータ:\n${toDelete.slice(0, 5).map(item => `- ${item.docId} (${item.data.name})`).join('\n')}` +
      (toDelete.length > 5 ? `\n...他${toDelete.length - 5}件` : '') +
      `\n\n実行しますか？`
    );

    if (!confirmed) {
      logger.info('[エラー]  クリーンアップをキャンセルしました');
      return;
    }

    // バッチ削除（500件ずつ）
    let deletedCount = 0;
    const batchSize = 500;

    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = firestore.batch();
      const chunk = toDelete.slice(i, i + batchSize);

      chunk.forEach(item => {
        const docRef = firestore
          .collection('users')
          .doc(user.uid)
          .collection('history')
          .doc(item.docId);
        batch.delete(docRef);
      });

      await batch.commit();
      deletedCount += chunk.length;
      logger.info(`[削除]  削除完了: ${deletedCount}/${toDelete.length}件`);
    }

    logger.info('\n✅  クリーンアップ完了!');
    logger.info(`  元のデータ: ${snapshot.size}件`);
    logger.info(`  削除: ${deletedCount}件`);
    logger.info(`  残り: ${toKeep.length}件`);

    // UIを更新
    alert(`クリーンアップ完了!\n\n削除: ${deletedCount}件\n残り: ${toKeep.length}件\n\nダウンロードボタンを押してデータを再同期してください。`);

  } catch (error) {
    logger.error('[エラー]  クリーンアップエラー:', error);
    alert(`エラーが発生しました: ${error.message}`);
  }
}

// 実行方法をコンソールに表示
logger.info('[ヒント]  使い方: cleanupFirestoreDuplicates() を実行してください');
