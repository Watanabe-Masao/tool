/**
 * IndexedDB ラッパークラス - Backward Compatibility Layer
 * 歩留まり計算ツールのデータ永続化を管理
 *
 * このファイルは後方互換性を保つためのラッパーです。
 * 実際の実装は以下のモジュールに分割されています：
 * - db/connection.js - データベース接続管理とマイグレーション
 * - db/history.js - 履歴データのCRUD操作
 * - db/utils.js - ユーティリティ関数
 */

import { logger } from './core/logger.js';
import { DatabaseConnection, DB_NAME } from './db/connection.js';
import { HistoryOperations } from './db/history.js';
import { generateUUID } from './db/utils.js';

/**
 * IndexedDBラッパークラス - 統合インターフェース
 * 既存コードとの互換性を保つため、すべてのメソッドをこのクラスに集約
 */
export class YieldCalculatorDB {
  constructor() {
    // コンポーネントの初期化
    this.connection = new DatabaseConnection();
    this.history = new HistoryOperations(this.connection);
  }

  // =====================================================
  // Connection Management Methods
  // =====================================================

  /**
   * データベースを開く
   * @param {number} retryCount - リトライ回数
   * @returns {Promise<IDBDatabase>}
   */
  async open(retryCount = 0) {
    return this.connection.open(retryCount);
  }

  /**
   * データベースを閉じる
   */
  close() {
    this.connection.close();
  }

  /**
   * データベース接続を取得
   * @returns {IDBDatabase|null}
   */
  get db() {
    return this.connection.getConnection();
  }

  /**
   * トランザクションログを取得（デバッグ用）
   * @returns {Array}
   */
  getTransactionLog() {
    return this.connection.getTransactionLog();
  }

  /**
   * データベース環境をチェック
   * @returns {Object}
   */
  checkDatabaseEnvironment() {
    return this.connection.checkDatabaseEnvironment();
  }

  /**
   * アクティブなトランザクション数を取得
   * @returns {number}
   */
  get activeTransactions() {
    return this.connection.activeTransactions;
  }

  /**
   * 開く処理が進行中かどうかを取得
   * @returns {Promise|null}
   */
  get openPromise() {
    return this.connection.openPromise;
  }

  /**
   * リトライカウントを取得
   * @returns {number}
   */
  get openRetryCount() {
    return this.connection.openRetryCount;
  }

  /**
   * 最大リトライ回数を取得
   * @returns {number}
   */
  get maxRetries() {
    return this.connection.maxRetries;
  }

  // =====================================================
  // UUID Generation
  // =====================================================

  /**
   * UUID v4を生成
   * @returns {string} UUID
   */
  generateUUID() {
    return generateUUID();
  }

  // =====================================================
  // History CRUD Operations
  // =====================================================

  /**
   * データを保存
   * @param {Object} data - 保存するデータ
   * @returns {Promise<number>} 保存されたレコードのID
   */
  async save(data) {
    return this.history.save(data);
  }

  /**
   * すべてのデータを取得（デフォルトで論理削除されたデータは除外）
   * @param {Object} options - ソート・フィルタオプション
   * @returns {Promise<Array>}
   */
  async getAll(options = {}) {
    return this.history.getAll(options);
  }

  /**
   * 論理削除されたデータのみを取得
   * @param {Object} options - ソート・フィルタオプション
   * @returns {Promise<Array>}
   */
  async getDeleted(options = {}) {
    return this.history.getDeleted(options);
  }

  /**
   * IDでデータを取得
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async getById(id) {
    return this.history.getById(id);
  }

  /**
   * UUIDでデータを検索
   * @param {string} uuid - UUID
   * @returns {Promise<Object|undefined>}
   */
  async getByUuid(uuid) {
    return this.history.getByUuid(uuid);
  }

  /**
   * FirestoreIDでデータを検索（後方互換性のため残す）
   * @param {string} firestoreId - Firestore ドキュメントID
   * @returns {Promise<Object|undefined>}
   */
  async getByFirestoreId(firestoreId) {
    return this.history.getByFirestoreId(firestoreId);
  }

  /**
   * データを更新
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async update(id, data) {
    return this.history.update(id, data);
  }

  /**
   * データを論理削除
   * @param {number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    return this.history.delete(id);
  }

  /**
   * データを物理削除（完全削除）
   * @param {number} id
   * @returns {Promise<void>}
   */
  async hardDelete(id) {
    return this.history.hardDelete(id);
  }

  /**
   * 検索（商品名での部分一致）
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    return this.history.search(query);
  }

  /**
   * すべてのデータをエクスポート（JSON）
   * @returns {Promise<string>}
   */
  async exportJSON() {
    return this.history.exportJSON();
  }

  /**
   * JSONデータをインポート
   * @param {string} jsonString
   * @returns {Promise<{count: number, errors: Array}>}
   */
  async importJSON(jsonString) {
    return this.history.importJSON(jsonString);
  }

  /**
   * すべてのデータを削除
   * @returns {Promise<void>}
   */
  async clear() {
    return this.history.clear();
  }
}

// シングルトンインスタンス
export const db = new YieldCalculatorDB();

/**
 * ページライフサイクルイベントハンドラ
 * Safari対応: ページ完全離脱時にDB接続をクローズして競合を防止
 *
 * 注意: visibilitychangeでのクローズは削除しました
 * 理由: タブ切り替えのたびにFirestore接続も切断されてしまうため
 * 単なるタブ切り替えではDBをクローズせず、接続を維持します
 */
if (typeof window !== 'undefined') {
  // ページを離れる前にDB接続をクローズ（リロード、別ページへの移動）
  window.addEventListener('beforeunload', () => {
    if (db.db) {
      logger.debug('ページ離脱: IndexedDB接続をクローズ');
      db.close();
    }
  });

  // ページがフリーズされる前にクローズ（モバイルSafari bfcache対応）
  window.addEventListener('pagehide', () => {
    if (db.db) {
      logger.debug('ページ隠蔽: IndexedDB接続をクローズ');
      db.close();
    }
  });

  // Safari対応: Broadcast Channel でタブ間通信
  // 他のタブから接続クローズ要求を受け取る
  if ('BroadcastChannel' in window) {
    try {
      const dbControlChannel = new BroadcastChannel('indexeddb-control');
      dbControlChannel.addEventListener('message', (event) => {
        if (event.data.type === 'REQUEST_CLOSE_DB' && event.data.dbName === DB_NAME) {
          logger.debug('他のタブからDB接続クローズ要求を受信');
          if (db.db) {
            logger.debug('DB接続をクローズします');
            db.close();
          }
        }
      });
    } catch (err) {
      logger.warn('BroadcastChannel初期化エラー:', err);
    }
  }

  // グローバルデバッグヘルパー関数（コンソールから実行可能）
  window.debugIndexedDB = {
    /**
     * データベース状態を表示
     */
    getStatus: () => {
      logger.info('IndexedDB 状態:', {
        isOpen: !!db.db,
        activeTransactions: db.activeTransactions,
        openPromise: !!db.openPromise,
        retryCount: db.openRetryCount,
        maxRetries: db.maxRetries
      });
    },

    /**
     * トランザクションログを表示
     */
    getTransactionLog: () => {
      const log = db.getTransactionLog();
      logger.info('トランザクションログ (最新50件):', log);
      return log;
    },

    /**
     * 環境情報を表示
     */
    checkEnvironment: () => {
      return db.checkDatabaseEnvironment();
    },

    /**
     * データベースを強制的にクローズ
     */
    forceClose: () => {
      logger.info('データベースを強制クローズします...');
      db.close();
      logger.info('クローズ完了');
    },

    /**
     * データベースを強制的に再接続
     */
    forceReconnect: async () => {
      logger.info('データベースを再接続します...');
      db.close();
      try {
        await db.open();
        logger.info('再接続成功');
      } catch (err) {
        logger.error('再接続失敗:', err);
      }
    },

    /**
     * データベースを完全に削除（VersionError対策）
     */
    deleteDatabase: async () => {
      logger.warn('データベースを完全に削除します。すべてのデータが失われます！');
      const confirmed = confirm(
        'IndexedDBデータベースを削除しますか？\n\n' +
        'この操作により、すべてのローカルデータが削除されます。\n' +
        'クラウド同期を使用している場合は、再度ダウンロードできます。\n\n' +
        '続行しますか？'
      );

      if (!confirmed) {
        logger.info('キャンセルされました');
        return;
      }

      try {
        // DB接続を閉じる
        db.close();
        logger.info('DB接続をクローズしました');

        // DBを削除
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

        deleteRequest.onsuccess = () => {
          logger.info('データベースを削除しました');
          logger.info('ページを再読み込みしてください');
          alert('データベースを削除しました。ページを再読み込みしてください。');
        };

        deleteRequest.onerror = (event) => {
          logger.error('データベース削除エラー:', event.target.error);
          alert('データベースの削除に失敗しました。');
        };

        deleteRequest.onblocked = () => {
          logger.warn('データベース削除がブロックされました。すべてのタブを閉じてください。');
          alert('データベース削除がブロックされました。すべてのタブを閉じてから再試行してください。');
        };
      } catch (err) {
        logger.error('データベース削除に失敗:', err);
      }
    },

    /**
     * 全てのデバッグ情報を表示
     */
    showAll: () => {
      logger.info('=== IndexedDB デバッグ情報 ===');
      window.debugIndexedDB.getStatus();
      window.debugIndexedDB.checkEnvironment();
      window.debugIndexedDB.getTransactionLog();
    }
  };

  // デバッグヘルパー関数の利用可能通知（開発環境のみ表示）
  logger.debug('デバッグヘルパー関数が利用可能です: window.debugIndexedDB');
  logger.debug('   - debugIndexedDB.getStatus() - データベース状態を表示');
  logger.debug('   - debugIndexedDB.getTransactionLog() - トランザクションログを表示');
  logger.debug('   - debugIndexedDB.checkEnvironment() - 環境情報を表示');
  logger.debug('   - debugIndexedDB.deleteDatabase() - データベースを削除（VersionError対策）');
  logger.debug('   - debugIndexedDB.showAll() - 全情報を表示');
}
