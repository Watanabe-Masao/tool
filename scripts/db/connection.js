/**
 * IndexedDB Connection Management
 * Database initialization, connection handling, migrations, and transaction logging
 */

import { logger } from '../core/logger.js';
import { createUserFriendlyError, isIndexedDBAvailable, generateUUID, sleep } from './utils.js';

export const DB_NAME = 'YieldCalculatorDB';
export const DB_VERSION = 5; // v5: 削除フラグ方式で管理
export const STORE_NAME = 'calculations';

/**
 * DatabaseConnectionクラス
 * データベース接続管理、トランザクション監視、マイグレーション処理を担当
 */
export class DatabaseConnection {
  constructor() {
    this.db = null;
    this.openPromise = null; // Race Condition対策用
    this.openRetryCount = 0; // リトライカウント
    this.maxRetries = 3; // 最大リトライ回数
    this.activeTransactions = 0; // アクティブなトランザクション数（Safari競合監視用）
    this.transactionLog = []; // トランザクションログ（デバッグ用）
    this.maxLogSize = 50; // ログの最大サイズ
  }

  /**
   * トランザクション開始をログ
   * Safari対応: トランザクション競合の原因調査用
   * @param {string} operation - 操作名
   */
  logTransactionStart(operation) {
    this.activeTransactions++;
    const logEntry = {
      operation,
      type: 'start',
      timestamp: new Date().toISOString(),
      activeCount: this.activeTransactions
    };
    this.transactionLog.push(logEntry);

    // ログサイズを制限
    if (this.transactionLog.length > this.maxLogSize) {
      this.transactionLog.shift();
    }

    if (this.activeTransactions > 2) {
      logger.warn(`複数トランザクション検出: ${this.activeTransactions}個同時実行中 (${operation})`);
    }
  }

  /**
   * トランザクション終了をログ
   * @param {string} operation - 操作名
   * @param {boolean} success - 成功したかどうか
   */
  logTransactionEnd(operation, success = true) {
    this.activeTransactions = Math.max(0, this.activeTransactions - 1);
    const logEntry = {
      operation,
      type: success ? 'success' : 'error',
      timestamp: new Date().toISOString(),
      activeCount: this.activeTransactions
    };
    this.transactionLog.push(logEntry);

    // ログサイズを制限
    if (this.transactionLog.length > this.maxLogSize) {
      this.transactionLog.shift();
    }
  }

  /**
   * トランザクションログを取得（デバッグ用）
   * @returns {Array} トランザクションログ
   */
  getTransactionLog() {
    return [...this.transactionLog];
  }

  /**
   * データベース環境をチェック
   * Safari対応: 接続前の状態確認
   * @returns {Object} 環境チェック結果
   */
  checkDatabaseEnvironment() {
    const checks = {
      indexedDBAvailable: Boolean(window.indexedDB),
      isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
      isPrivateMode: false,
      storageEstimate: null,
      timestamp: new Date().toISOString()
    };

    // ストレージ容量チェック（Safari対応）
    if (navigator.storage && navigator.storage.estimate) {
      navigator.storage.estimate().then(estimate => {
        checks.storageEstimate = {
          usage: estimate.usage,
          quota: estimate.quota,
          usagePercent: ((estimate.usage / estimate.quota) * 100).toFixed(2)
        };
        logger.debug('ストレージ使用状況:', checks.storageEstimate);
      }).catch(err => {
        logger.warn('ストレージ使用状況の取得に失敗:', err);
      });
    }

    logger.debug('データベース環境チェック:', checks);
    return checks;
  }

  /**
   * データベースを開く
   * Safari対応: リトライロジック付き
   * @param {number} retryCount - リトライ回数
   * @returns {Promise<IDBDatabase>}
   */
  async open(retryCount = 0) {
    // 初回接続時のみ環境チェック
    if (retryCount === 0) {
      this.checkDatabaseEnvironment();
    }

    // IndexedDBが利用可能かチェック
    if (!isIndexedDBAvailable()) {
      throw createUserFriendlyError(
        new Error('IndexedDB not available'),
        'データベースへのアクセス（ブラウザがIndexedDBをサポートしていないか、プライベートモードの可能性があります）'
      );
    }

    // 既に開いている場合は既存のDBインスタンスを返す
    if (this.db) {
      return Promise.resolve(this.db);
    }

    // 開く処理が進行中の場合は、同じPromiseを返す
    if (this.openPromise) {
      logger.debug('データベース接続処理が進行中です...');
      return this.openPromise;
    }

    // 新しい開く処理を開始
    this.openPromise = new Promise(async (resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = async () => {
        this.openPromise = null; // エラー時にリセット

        // Safari対応: データベース接続エラーをリトライ
        const {error} = request;

        // エラーの詳細情報をログ出力（Safari デバッグ用）
        logger.error('IndexedDB接続エラー詳細:', {
          name: error?.name || 'Unknown',
          message: error?.message || 'No message',
          code: error?.code || 'No code',
          retryCount,
          maxRetries: this.maxRetries,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent
        });

        // Safari対応: より広範なエラーをリトライ対象に
        // DOMExceptionはすべてリトライを試みる（プライベートモードエラー、VersionError以外）
        const isPrivateModeError = error?.message?.includes('private') ||
                                    error?.message?.includes('プライベート');

        // VersionErrorの判定を強化（名前とメッセージの両方をチェック）
        const isVersionError = error?.name === 'VersionError' ||
                                (error?.message && error.message.includes('lower version'));

        if (isVersionError) {
          // VersionErrorは致命的なエラー - リトライ絶対不可
          logger.error('VersionError: データベースバージョンの競合が発生しました');
          logger.error('このエラーはリトライできません');
          logger.error('対処方法:');
          logger.error('   1. すべてのタブを閉じる');
          logger.error('   2. ページを再読み込み (Cmd+R / Ctrl+R)');
          logger.error('   3. それでも解決しない場合、ハードリロード (Cmd+Shift+R / Ctrl+Shift+R)');
          logger.error('   4. 最終手段: データベースを削除');

          // iOS Safari対応: DBリセットボタンを表示
          const resetButton = document.getElementById('reset-db-button');
          if (resetButton) {
            resetButton.style.display = 'inline-block';
            logger.info('画面上部の「DBリセット」ボタンを押してデータベースをリセットしてください');
          }

          // 自動的にユーザーに確認ダイアログを表示
          setTimeout(async () => {
            const userChoice = confirm(
              'データベースバージョンの競合が発生しました。\n\n' +
              '【対処方法】\n' +
              '1. すべてのタブを閉じて再読み込み\n' +
              '2. 「 DBリセット」ボタンを押す（推奨）\n\n' +
              '今すぐデータベースをリセットしますか？\n' +
              '（クラウド同期を使用している場合、データは再ダウンロードできます）'
            );

            if (userChoice) {
              // データベースを削除
              try {
                this.close();
                const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

                deleteRequest.onsuccess = () => {
                  alert('データベースを削除しました。ページを再読み込みします。');
                  window.location.reload();
                };

                deleteRequest.onerror = () => {
                  alert('データベースの削除に失敗しました。ページを手動で再読み込みしてください。');
                };

                deleteRequest.onblocked = () => {
                  alert('データベース削除がブロックされました。すべてのタブを閉じてから再試行してください。');
                };
              } catch (err) {
                logger.error('データベース削除エラー:', err);
                alert('データベースの削除に失敗しました。ページを再読み込みしてください。');
              }
            } else {
              alert('画面上部の「 DBリセット」ボタンを使用するか、ページを再読み込みしてください。');
            }
          }, 100);

          // 即座にrejectして終了（リトライさせない）
          reject(createUserFriendlyError(
            error,
            'データベースを開く（バージョン競合: 他のタブを閉じてページを再読み込みしてください）'
          ));
          return; // 重要: ここで必ず終了
        }

        const isRetriableError = error && !isPrivateModeError && !isVersionError;

        if (isRetriableError && retryCount < this.maxRetries) {
          logger.warn(`データベース接続リトライ ${retryCount + 1}/${this.maxRetries}:`, error.name);
          // Safari対応: 指数バックオフの遅延を強化 (300ms, 600ms, 900ms)
          await sleep(300 * (retryCount + 1));
          try {
            const db = await this.open(retryCount + 1);
            logger.info(`リトライ成功 (試行 ${retryCount + 1})`);
            resolve(db);
          } catch (retryError) {
            logger.error(`リトライ失敗 (試行 ${retryCount + 1}):`, retryError);
            reject(retryError);
          }
        } else {
          if (!isRetriableError) {
            logger.error('リトライ不可能なエラー（プライベートモード等）');
          } else {
            logger.error(`最大リトライ回数に達しました (${this.maxRetries}回)`);
          }
          reject(createUserFriendlyError(error, 'データベースを開く'));
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.openPromise = null; // 成功時にリセット
        this.openRetryCount = 0; // リトライカウントをリセット

        // データベース接続エラーを監視
        this.db.onerror = (event) => {
          logger.error('IndexedDB error:', event.target.error);
        };

        // Safariでのバージョン競合対策
        this.db.onversionchange = () => {
          logger.warn('IndexedDB version change detected, closing connection');
          this.db.close();
          this.db = null;
        };

        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const {transaction} = event.target;
        const {oldVersion} = event;
        const {newVersion} = event;

        logger.info(`データベース更新: v${oldVersion} → v${newVersion}`);

        try {
          let store;

          // v0→v1: 初回作成
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            store = db.createObjectStore(STORE_NAME, {
              keyPath: 'id',
              autoIncrement: true
            });

            // インデックスを作成（高速検索用）
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('name', 'name', { unique: false });
            store.createIndex('mode', 'mode', { unique: false });
            store.createIndex('category', 'category', { unique: false });
            logger.info('オブジェクトストアとインデックスを作成しました');
          } else {
            // 既存のストアを取得
            store = transaction.objectStore(STORE_NAME);
          }

          // v1→v2: firestoreIdインデックス追加
          if (oldVersion < 2) {
            if (!store.indexNames.contains('firestoreId')) {
              store.createIndex('firestoreId', 'firestoreId', { unique: false });
              logger.info('firestoreIdインデックスを追加しました');
            }
          }

          // v2→v3: uuidインデックス追加（初回、unique制約で失敗している可能性あり）
          if (oldVersion < 3) {
            if (!store.indexNames.contains('uuid')) {
              // 最初はunique: trueで作成していたが、これは失敗する可能性がある
              try {
                store.createIndex('uuid', 'uuid', { unique: true });
                logger.info('uuidインデックスを追加しました（v3）');
              } catch (e) {
                logger.warn('uuidインデックス作成失敗（想定内）:', e.message);
              }
            }
          }

          // v3→v4: uuidインデックスを削除して再作成&既存データにUUID付与
          if (oldVersion < 4) {
            // 既存のuuidインデックスを削除（存在する場合）
            if (store.indexNames.contains('uuid')) {
              store.deleteIndex('uuid');
              logger.info('既存のuuidインデックスを削除しました');
            }

            // unique: falseで再作成
            store.createIndex('uuid', 'uuid', { unique: false });
            logger.info('uuidインデックスを再作成しました（unique: false）');

            // 既存データにUUIDを付与するマイグレーション
            const cursorRequest = store.openCursor();
            let migratedCount = 0;

            cursorRequest.onsuccess = (event) => {
              const cursor = event.target.result;
              if (cursor) {
                const record = cursor.value;
                // uuidがない場合は生成して付与
                if (!record.uuid) {
                  record.uuid = generateUUID();
                  cursor.update(record);
                  migratedCount++;
                }
                cursor.continue();
              } else if (migratedCount > 0) {
                  logger.info(`${migratedCount}件のデータにUUIDを付与しました`);
                }
            };

            cursorRequest.onerror = () => {
              logger.error('UUIDマイグレーションエラー:', cursorRequest.error);
            };
          }
        } catch (error) {
          logger.error('Failed to upgrade database schema:', error);
          reject(createUserFriendlyError(error, 'データベーススキーマの更新'));
        }
      };

      request.onblocked = async (event) => {
        logger.warn('IndexedDB接続がブロックされました（他のタブでDBが開かれている可能性）');
        logger.debug('ブロックイベント詳細:', {
          oldVersion: event.oldVersion,
          newVersion: event.newVersion,
          retryCount,
          timestamp: new Date().toISOString()
        });

        // Safari対応: Broadcast Channel で他のタブに接続クローズを要求
        if ('BroadcastChannel' in window) {
          try {
            const channel = new BroadcastChannel('indexeddb-control');
            channel.postMessage({ type: 'REQUEST_CLOSE_DB', dbName: DB_NAME });
            logger.info('他のタブにDB接続クローズを要求しました');
            channel.close();
          } catch (err) {
            logger.warn('BroadcastChannel送信エラー:', err);
          }
        }

        // ブロックされた場合、少し待機してからタイムアウト
        setTimeout(() => {
          if (this.openPromise) {
            logger.error('データベース接続タイムアウト（10秒）');
            this.openPromise = null;
            reject(createUserFriendlyError(
              new Error('Database connection blocked'),
              'データベースを開く（他のタブでデータベースが使用されています。他のタブを閉じてから再試行してください）'
            ));
          }
        }, 10000); // 10秒待機
      };
    });

    return this.openPromise;
  }

  /**
   * データベースを閉じる
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this.openPromise = null; // Promise状態もリセット
  }

  /**
   * データベース接続を取得
   * @returns {IDBDatabase|null}
   */
  getConnection() {
    return this.db;
  }
}
