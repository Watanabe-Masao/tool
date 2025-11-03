/**
 * IndexedDB ラッパークラス
 * 歩留まり計算ツールのデータ永続化を管理
 */

const DB_NAME = 'YieldCalculatorDB';
const DB_VERSION = 5; // v5: 削除フラグ方式で管理
const STORE_NAME = 'calculations';

/**
 * IndexedDBエラーをユーザーフレンドリーなメッセージに変換
 * @param {Error} error - エラーオブジェクト
 * @param {string} operation - 実行していた操作
 * @returns {Error} 変換されたエラー
 */
function createUserFriendlyError(error, operation) {
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
function isIndexedDBAvailable() {
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

export class YieldCalculatorDB {
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
   * UUID v4を生成
   * @returns {string} UUID (例: "550e8400-e29b-41d4-a916-446655440000")
   */
  generateUUID() {
    // 最新ブラウザではcrypto.randomUUID()を使用
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }

    // フォールバック: UUID v4の形式で生成
    // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  /**
   * トランザクション開始をログ
   * Safari対応: トランザクション競合の原因調査用
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
      console.warn(`⚠️ 複数トランザクション検出: ${this.activeTransactions}個同時実行中 (${operation})`);
    }
  }

  /**
   * トランザクション終了をログ
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
   */
  getTransactionLog() {
    return [...this.transactionLog];
  }

  /**
   * 指定時間待機
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * データベース環境をチェック
   * Safari対応: 接続前の状態確認
   */
  checkDatabaseEnvironment() {
    const checks = {
      indexedDBAvailable: !!window.indexedDB,
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
        console.log('💾 ストレージ使用状況:', checks.storageEstimate);
      }).catch(err => {
        console.warn('ストレージ使用状況の取得に失敗:', err);
      });
    }

    console.log('🔍 データベース環境チェック:', checks);
    return checks;
  }

  /**
   * データベースを開く
   * Safari対応: リトライロジック付き
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
      console.log('⏳ データベース接続処理が進行中です...');
      return this.openPromise;
    }

    // 新しい開く処理を開始
    this.openPromise = new Promise(async (resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = async () => {
        this.openPromise = null; // エラー時にリセット

        // Safari対応: データベース接続エラーをリトライ
        const error = request.error;

        // エラーの詳細情報をログ出力（Safari デバッグ用）
        console.error('❌ IndexedDB接続エラー詳細:', {
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
          console.error('⛔ VersionError: データベースバージョンの競合が発生しました');
          console.error('⚠️ このエラーはリトライできません');
          console.error('💡 対処方法:');
          console.error('   1. すべてのタブを閉じる');
          console.error('   2. ページを再読み込み (Cmd+R / Ctrl+R)');
          console.error('   3. それでも解決しない場合、ハードリロード (Cmd+Shift+R / Ctrl+Shift+R)');
          console.error('   4. 最終手段: データベースを削除');

          // iOS Safari対応: DBリセットボタンを表示
          const resetButton = document.getElementById('reset-db-button');
          if (resetButton) {
            resetButton.style.display = 'inline-block';
            console.log('💡 画面上部の「🔧 DBリセット」ボタンを押してデータベースをリセットしてください');
          }

          // 自動的にユーザーに確認ダイアログを表示
          setTimeout(async () => {
            const userChoice = confirm(
              'データベースバージョンの競合が発生しました。\n\n' +
              '【対処方法】\n' +
              '1. すべてのタブを閉じて再読み込み\n' +
              '2. 「🔧 DBリセット」ボタンを押す（推奨）\n\n' +
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
                console.error('データベース削除エラー:', err);
                alert('データベースの削除に失敗しました。ページを再読み込みしてください。');
              }
            } else {
              alert('画面上部の「🔧 DBリセット」ボタンを使用するか、ページを再読み込みしてください。');
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
          console.warn(`🔄 データベース接続リトライ ${retryCount + 1}/${this.maxRetries}:`, error.name);
          // Safari対応: 指数バックオフの遅延を強化 (300ms, 600ms, 900ms)
          await this.sleep(300 * (retryCount + 1));
          try {
            const db = await this.open(retryCount + 1);
            console.log(`✅ リトライ成功 (試行 ${retryCount + 1})`);
            resolve(db);
          } catch (retryError) {
            console.error(`❌ リトライ失敗 (試行 ${retryCount + 1}):`, retryError);
            reject(retryError);
          }
        } else {
          if (!isRetriableError) {
            console.error('⛔ リトライ不可能なエラー（プライベートモード等）');
          } else {
            console.error(`⛔ 最大リトライ回数に達しました (${this.maxRetries}回)`);
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
          console.error('IndexedDB error:', event.target.error);
        };

        // Safariでのバージョン競合対策
        this.db.onversionchange = () => {
          console.warn('IndexedDB version change detected, closing connection');
          this.db.close();
          this.db = null;
        };

        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;
        const oldVersion = event.oldVersion;
        const newVersion = event.newVersion;

        console.log(`📊 データベース更新: v${oldVersion} → v${newVersion}`);

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
            console.log('✅ オブジェクトストアとインデックスを作成しました');
          } else {
            // 既存のストアを取得
            store = transaction.objectStore(STORE_NAME);
          }

          // v1→v2: firestoreIdインデックス追加
          if (oldVersion < 2) {
            if (!store.indexNames.contains('firestoreId')) {
              store.createIndex('firestoreId', 'firestoreId', { unique: false });
              console.log('✅ firestoreIdインデックスを追加しました');
            }
          }

          // v2→v3: uuidインデックス追加（初回、unique制約で失敗している可能性あり）
          if (oldVersion < 3) {
            if (!store.indexNames.contains('uuid')) {
              // 最初はunique: trueで作成していたが、これは失敗する可能性がある
              try {
                store.createIndex('uuid', 'uuid', { unique: true });
                console.log('✅ uuidインデックスを追加しました（v3）');
              } catch (e) {
                console.warn('⚠️ uuidインデックス作成失敗（想定内）:', e.message);
              }
            }
          }

          // v3→v4: uuidインデックスを削除して再作成&既存データにUUID付与
          if (oldVersion < 4) {
            // UUID生成関数（インライン定義）
            const generateUUID = () => {
              if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                return crypto.randomUUID();
              }
              return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                const r = Math.random() * 16 | 0;
                const v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
              });
            };

            // 既存のuuidインデックスを削除（存在する場合）
            if (store.indexNames.contains('uuid')) {
              store.deleteIndex('uuid');
              console.log('🗑️ 既存のuuidインデックスを削除しました');
            }

            // unique: falseで再作成
            store.createIndex('uuid', 'uuid', { unique: false });
            console.log('✅ uuidインデックスを再作成しました（unique: false）');

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
              } else {
                if (migratedCount > 0) {
                  console.log(`✅ ${migratedCount}件のデータにUUIDを付与しました`);
                }
              }
            };

            cursorRequest.onerror = () => {
              console.error('❌ UUIDマイグレーションエラー:', cursorRequest.error);
            };
          }
        } catch (error) {
          console.error('Failed to upgrade database schema:', error);
          reject(createUserFriendlyError(error, 'データベーススキーマの更新'));
        }
      };

      request.onblocked = async (event) => {
        console.warn('⚠️ IndexedDB接続がブロックされました（他のタブでDBが開かれている可能性）');
        console.log('ブロックイベント詳細:', {
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
            console.log('📢 他のタブにDB接続クローズを要求しました');
            channel.close();
          } catch (err) {
            console.warn('BroadcastChannel送信エラー:', err);
          }
        }

        // ブロックされた場合、少し待機してからタイムアウト
        setTimeout(() => {
          if (this.openPromise) {
            console.error('⏱️ データベース接続タイムアウト（10秒）');
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
   * データを保存
   * @param {Object} data - 保存するデータ
   * @returns {Promise<number>} 保存されたレコードのID
   */
  async save(data) {
    if (!this.db) await this.open();

    this.logTransactionStart('save');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => {
          this.logTransactionEnd('save', false);
          console.error('トランザクションエラー [save]:', {
            error: transaction.error,
            activeTransactions: this.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(transaction.error, 'データを保存'));
        };

        transaction.oncomplete = () => {
          this.logTransactionEnd('save', true);
        };

        const store = transaction.objectStore(STORE_NAME);

        // UUIDが設定されていない場合は自動生成
        const uuid = data.uuid || this.generateUUID();

        const record = {
          ...data,
          uuid: uuid,
          timestamp: data.timestamp || Date.now(),
          createdAt: new Date().toISOString()
        };

        const request = store.add(record);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          this.logTransactionEnd('save', false);
          console.error('リクエストエラー [save]:', {
            error: request.error,
            activeTransactions: this.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(request.error, 'データを保存'));
        };
      } catch (error) {
        this.logTransactionEnd('save', false);
        console.error('例外エラー [save]:', {
          error,
          activeTransactions: this.activeTransactions,
          timestamp: new Date().toISOString()
        });
        reject(createUserFriendlyError(error, 'データを保存'));
      }
    });
  }

  /**
   * すべてのデータを取得
   * @param {Object} options - ソート・フィルタオプション
   * @param {boolean} options.includeDeleted - 削除済みデータも含めるか（デフォルト: false）
   * @returns {Promise<Array>}
   */
  async getAll(options = {}) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        transaction.onerror = () => reject(createUserFriendlyError(transaction.error, 'データを取得'));

        const store = transaction.objectStore(STORE_NAME);

        let request;

        // インデックスを使用した検索
        if (options.sortBy === 'timestamp') {
          const index = store.index('timestamp');
          request = index.openCursor(null, options.order === 'asc' ? 'next' : 'prev');
        } else if (options.sortBy === 'name') {
          const index = store.index('name');
          request = index.openCursor(null, options.order === 'asc' ? 'next' : 'prev');
        } else {
          request = store.openCursor();
        }

        const results = [];

        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (cursor) {
            const item = cursor.value;
            // 削除済みデータをフィルタリング（includeDeletedがtrueの場合は除外しない）
            if (options.includeDeleted || !item.deleted) {
              results.push(item);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(createUserFriendlyError(request.error, 'データを取得'));
      } catch (error) {
        reject(createUserFriendlyError(error, 'データを取得'));
      }
    });
  }

  /**
   * IDでデータを取得
   * @param {number} id
   * @param {Object} options - オプション
   * @param {boolean} options.includeDeleted - 削除済みデータも取得するか（デフォルト: true。削除操作のため）
   * @returns {Promise<Object>}
   */
  async getById(id, options = { includeDeleted: true }) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        transaction.onerror = () => reject(createUserFriendlyError(transaction.error, 'データを取得'));

        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = () => {
          const item = request.result;
          // 削除済みデータのフィルタリング（includeDeletedがfalseかつ削除済みの場合）
          if (item && !options.includeDeleted && item.deleted) {
            resolve(undefined);
          } else {
            resolve(item);
          }
        };
        request.onerror = () => reject(createUserFriendlyError(request.error, 'データを取得'));
      } catch (error) {
        reject(createUserFriendlyError(error, 'データを取得'));
      }
    });
  }

  /**
   * UUIDでデータを検索
   * @param {string} uuid - UUID
   * @returns {Promise<Object|undefined>} 見つかったデータ、または undefined
   */
  async getByUuid(uuid) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        transaction.onerror = () => reject(createUserFriendlyError(transaction.error, 'データを取得'));

        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('uuid');
        const request = index.get(uuid);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(createUserFriendlyError(request.error, 'データを取得'));
      } catch (error) {
        reject(createUserFriendlyError(error, 'データを取得'));
      }
    });
  }

  /**
   * FirestoreIDでデータを検索（後方互換性のため残す）
   * @param {string} firestoreId - Firestore ドキュメントID
   * @returns {Promise<Object|undefined>} 見つかったデータ、または undefined
   */
  async getByFirestoreId(firestoreId) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        transaction.onerror = () => reject(createUserFriendlyError(transaction.error, 'データを取得'));

        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('firestoreId');
        const request = index.get(firestoreId);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(createUserFriendlyError(request.error, 'データを取得'));
      } catch (error) {
        reject(createUserFriendlyError(error, 'データを取得'));
      }
    });
  }

  /**
   * データを更新
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<void>}
   */
  async update(id, data) {
    if (!this.db) await this.open();

    this.logTransactionStart('update');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => {
          this.logTransactionEnd('update', false);
          console.error('トランザクションエラー [update]:', {
            error: transaction.error,
            activeTransactions: this.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(transaction.error, 'データを更新'));
        };

        transaction.oncomplete = () => {
          this.logTransactionEnd('update', true);
        };

        const store = transaction.objectStore(STORE_NAME);

        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const record = getRequest.result;
          if (!record) {
            this.logTransactionEnd('update', false);
            reject(createUserFriendlyError(
              new Error(`Record with id ${id} not found`),
              'データを更新（レコードが見つかりません）'
            ));
            return;
          }

          // 不変フィールドを除外（データ整合性保護）
          const { id: _, uuid: __, firestoreId: ___, createdAt: ____, ...dataToUpdate } = data;

          const updatedRecord = {
            ...record,
            ...dataToUpdate,
            id, // IDは保持（自動インクリメント）
            uuid: record.uuid, // UUIDは不変
            firestoreId: record.firestoreId, // firestoreIdも不変（後方互換性）
            createdAt: record.createdAt, // 作成日時は不変
            updatedAt: new Date().toISOString()
          };

          const updateRequest = store.put(updatedRecord);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => {
            this.logTransactionEnd('update', false);
            console.error('リクエストエラー [update]:', {
              error: updateRequest.error,
              activeTransactions: this.activeTransactions,
              timestamp: new Date().toISOString()
            });
            reject(createUserFriendlyError(updateRequest.error, 'データを更新'));
          };
        };

        getRequest.onerror = () => {
          this.logTransactionEnd('update', false);
          console.error('リクエストエラー [update/get]:', {
            error: getRequest.error,
            activeTransactions: this.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(getRequest.error, 'データを更新'));
        };
      } catch (error) {
        this.logTransactionEnd('update', false);
        console.error('例外エラー [update]:', {
          error,
          activeTransactions: this.activeTransactions,
          timestamp: new Date().toISOString()
        });
        reject(createUserFriendlyError(error, 'データを更新'));
      }
    });
  }

  /**
   * データを論理削除（Soft Delete）
   * マルチデバイス環境での削除を追跡するため、削除フラグを設定
   * @param {number} id
   * @returns {Promise<void>}
   */
  async softDelete(id) {
    if (!this.db) await this.open();

    this.logTransactionStart('softDelete');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => {
          this.logTransactionEnd('softDelete', false);
          console.error('トランザクションエラー [softDelete]:', {
            error: transaction.error,
            activeTransactions: this.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(transaction.error, 'データを削除'));
        };

        transaction.oncomplete = () => {
          this.logTransactionEnd('softDelete', true);
        };

        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const record = getRequest.result;
          if (!record) {
            this.logTransactionEnd('softDelete', false);
            reject(createUserFriendlyError(
              new Error(`Record with id ${id} not found`),
              'データを削除（レコードが見つかりません）'
            ));
            return;
          }

          // 削除フラグを設定
          const deletedRecord = {
            ...record,
            deleted: true,
            deletedAt: new Date().toISOString()
          };

          const updateRequest = store.put(deletedRecord);
          updateRequest.onsuccess = () => {
            console.log(`🗑️ 論理削除完了 (ID: ${id}, UUID: ${record.uuid})`);
            resolve();
          };
          updateRequest.onerror = () => {
            this.logTransactionEnd('softDelete', false);
            console.error('リクエストエラー [softDelete]:', {
              error: updateRequest.error,
              activeTransactions: this.activeTransactions,
              timestamp: new Date().toISOString()
            });
            reject(createUserFriendlyError(updateRequest.error, 'データを削除'));
          };
        };

        getRequest.onerror = () => {
          this.logTransactionEnd('softDelete', false);
          console.error('リクエストエラー [softDelete/get]:', {
            error: getRequest.error,
            activeTransactions: this.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(getRequest.error, 'データを削除'));
        };
      } catch (error) {
        this.logTransactionEnd('softDelete', false);
        console.error('例外エラー [softDelete]:', {
          error,
          activeTransactions: this.activeTransactions,
          timestamp: new Date().toISOString()
        });
        reject(createUserFriendlyError(error, 'データを削除'));
      }
    });
  }

  /**
   * データを物理削除
   * @param {number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (!this.db) await this.open();

    this.logTransactionStart('delete');

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => {
          this.logTransactionEnd('delete', false);
          console.error('トランザクションエラー [delete]:', {
            error: transaction.error,
            activeTransactions: this.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(transaction.error, 'データを削除'));
        };

        transaction.oncomplete = () => {
          this.logTransactionEnd('delete', true);
        };

        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          this.logTransactionEnd('delete', false);
          console.error('リクエストエラー [delete]:', {
            error: request.error,
            activeTransactions: this.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(request.error, 'データを削除'));
        };
      } catch (error) {
        this.logTransactionEnd('delete', false);
        console.error('例外エラー [delete]:', {
          error,
          activeTransactions: this.activeTransactions,
          timestamp: new Date().toISOString()
        });
        reject(createUserFriendlyError(error, 'データを削除'));
      }
    });
  }

  /**
   * 検索（商品名での部分一致）
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    try {
      const all = await this.getAll();
      const lowerQuery = query.toLowerCase();

      return all.filter(item =>
        item.name && item.name.toLowerCase().includes(lowerQuery)
      );
    } catch (error) {
      throw createUserFriendlyError(error, 'データを検索');
    }
  }

  /**
   * すべてのデータをエクスポート（JSON）
   * @returns {Promise<string>}
   */
  async exportJSON() {
    try {
      const data = await this.getAll();
      return JSON.stringify(data, null, 2);
    } catch (error) {
      throw createUserFriendlyError(error, 'データをエクスポート');
    }
  }

  /**
   * JSONデータをインポート
   * @param {string} jsonString
   * @returns {Promise<number>} インポートされた件数
   */
  async importJSON(jsonString) {
    let data;
    try {
      data = JSON.parse(jsonString);
    } catch (parseError) {
      throw createUserFriendlyError(
        parseError,
        'データをインポート（JSONの形式が正しくありません）'
      );
    }

    if (!Array.isArray(data)) {
      throw createUserFriendlyError(
        new Error('Invalid JSON format: expected array'),
        'データをインポート（配列形式のJSONが必要です）'
      );
    }

    let count = 0;
    const errors = [];

    for (const item of data) {
      try {
        // IDを除いて保存（新規IDが割り当てられる）
        const { id, ...itemWithoutId } = item;
        await this.save(itemWithoutId);
        count++;
      } catch (error) {
        errors.push({ item, error: error.message });
        console.error('Failed to import item:', item, error);
      }
    }

    if (errors.length > 0) {
      console.warn(`Imported ${count} items with ${errors.length} errors`);
    }

    return count;
  }

  /**
   * すべてのデータを削除
   * @returns {Promise<void>}
   */
  async clear() {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => reject(createUserFriendlyError(transaction.error, 'すべてのデータを削除'));

        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => resolve();
        request.onerror = () => reject(createUserFriendlyError(request.error, 'すべてのデータを削除'));
      } catch (error) {
        reject(createUserFriendlyError(error, 'すべてのデータを削除'));
      }
    });
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
      console.log('ページ離脱: IndexedDB接続をクローズ');
      db.close();
    }
  });

  // ページがフリーズされる前にクローズ（モバイルSafari bfcache対応）
  window.addEventListener('pagehide', () => {
    if (db.db) {
      console.log('ページ隠蔽: IndexedDB接続をクローズ');
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
          console.log('📨 他のタブからDB接続クローズ要求を受信');
          if (db.db) {
            console.log('🔒 DB接続をクローズします');
            db.close();
          }
        }
      });
    } catch (err) {
      console.warn('BroadcastChannel初期化エラー:', err);
    }
  }

  // グローバルデバッグヘルパー関数（コンソールから実行可能）
  window.debugIndexedDB = {
    /**
     * データベース状態を表示
     */
    getStatus: () => {
      console.log('📊 IndexedDB 状態:', {
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
      console.log('📜 トランザクションログ (最新50件):', log);
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
      console.log('🔒 データベースを強制クローズします...');
      db.close();
      console.log('✅ クローズ完了');
    },

    /**
     * データベースを強制的に再接続
     */
    forceReconnect: async () => {
      console.log('🔄 データベースを再接続します...');
      db.close();
      try {
        await db.open();
        console.log('✅ 再接続成功');
      } catch (err) {
        console.error('❌ 再接続失敗:', err);
      }
    },

    /**
     * データベースを完全に削除（VersionError対策）
     */
    deleteDatabase: async () => {
      console.warn('⚠️ データベースを完全に削除します。すべてのデータが失われます！');
      const confirmed = confirm(
        'IndexedDBデータベースを削除しますか？\n\n' +
        'この操作により、すべてのローカルデータが削除されます。\n' +
        'クラウド同期を使用している場合は、再度ダウンロードできます。\n\n' +
        '続行しますか？'
      );

      if (!confirmed) {
        console.log('❌ キャンセルされました');
        return;
      }

      try {
        // DB接続を閉じる
        db.close();
        console.log('🔒 DB接続をクローズしました');

        // DBを削除
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

        deleteRequest.onsuccess = () => {
          console.log('✅ データベースを削除しました');
          console.log('💡 ページを再読み込みしてください');
          alert('データベースを削除しました。ページを再読み込みしてください。');
        };

        deleteRequest.onerror = (event) => {
          console.error('❌ データベース削除エラー:', event.target.error);
          alert('データベースの削除に失敗しました。');
        };

        deleteRequest.onblocked = () => {
          console.warn('⚠️ データベース削除がブロックされました。すべてのタブを閉じてください。');
          alert('データベース削除がブロックされました。すべてのタブを閉じてから再試行してください。');
        };
      } catch (err) {
        console.error('❌ データベース削除に失敗:', err);
      }
    },

    /**
     * 全てのデバッグ情報を表示
     */
    showAll: () => {
      console.log('=== IndexedDB デバッグ情報 ===');
      window.debugIndexedDB.getStatus();
      window.debugIndexedDB.checkEnvironment();
      window.debugIndexedDB.getTransactionLog();
    }
  };

  console.log('🛠️ デバッグヘルパー関数が利用可能です: window.debugIndexedDB');
  console.log('   - debugIndexedDB.getStatus() - データベース状態を表示');
  console.log('   - debugIndexedDB.getTransactionLog() - トランザクションログを表示');
  console.log('   - debugIndexedDB.checkEnvironment() - 環境情報を表示');
  console.log('   - debugIndexedDB.deleteDatabase() - データベースを削除（VersionError対策）');
  console.log('   - debugIndexedDB.showAll() - 全情報を表示');
}
