/**
 * IndexedDB ラッパークラス
 * 歩留まり計算ツールのデータ永続化を管理
 */

const DB_NAME = 'YieldCalculatorDB';
const DB_VERSION = 1;
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
   * データベースを開く
   * Safari対応: リトライロジック付き
   * @returns {Promise<IDBDatabase>}
   */
  async open(retryCount = 0) {
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
      return this.openPromise;
    }

    // 新しい開く処理を開始
    this.openPromise = new Promise(async (resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = async () => {
        this.openPromise = null; // エラー時にリセット

        // Safari対応: データベース接続エラーをリトライ
        const error = request.error;
        const isRetriableError = error && (
          error.name === 'UnknownError' ||
          error.name === 'InvalidStateError' ||
          error.name === 'AbortError'
        );

        if (isRetriableError && retryCount < this.maxRetries) {
          console.warn(`データベース接続エラー、リトライ ${retryCount + 1}/${this.maxRetries}:`, error.name);
          // Safari対応: 指数バックオフの遅延を強化 (300ms, 600ms, 900ms)
          await this.sleep(300 * (retryCount + 1));
          try {
            const db = await this.open(retryCount + 1);
            resolve(db);
          } catch (retryError) {
            reject(retryError);
          }
        } else {
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

        try {
          // calculations ストアを作成
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, {
              keyPath: 'id',
              autoIncrement: true
            });

            // インデックスを作成（高速検索用）
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('name', 'name', { unique: false });
            store.createIndex('mode', 'mode', { unique: false });
            store.createIndex('category', 'category', { unique: false });
          }
        } catch (error) {
          console.error('Failed to create object store:', error);
          reject(createUserFriendlyError(error, 'データベーススキーマの作成'));
        }
      };

      request.onblocked = () => {
        console.warn('IndexedDB open blocked, waiting...');
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

        const record = {
          ...data,
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
            results.push(cursor.value);
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
   * @returns {Promise<Object>}
   */
  async getById(id) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readonly');
        transaction.onerror = () => reject(createUserFriendlyError(transaction.error, 'データを取得'));

        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

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

          const updatedRecord = {
            ...record,
            ...data,
            id, // IDは保持
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
   * データを削除
   * @param {number} id
   * @returns {Promise<void>}
   */
  async delete(id) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = this.db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => reject(createUserFriendlyError(transaction.error, 'データを削除'));

        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(createUserFriendlyError(request.error, 'データを削除'));
      } catch (error) {
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
 * Safari対応: ページ離脱時やタブ非アクティブ時にDB接続をクローズして競合を防止
 */
if (typeof window !== 'undefined') {
  // ページを離れる前にDB接続をクローズ
  window.addEventListener('beforeunload', () => {
    if (db.db) {
      console.log('ページ離脱: IndexedDB接続をクローズ');
      db.close();
    }
  });

  // タブが非アクティブになったらDB接続をクローズ（Safari対応）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && db.db) {
      console.log('タブ非アクティブ: IndexedDB接続をクローズ');
      db.close();
    }
  });

  // ページがフリーズされる前にクローズ（モバイルSafari対応）
  window.addEventListener('pagehide', () => {
    if (db.db) {
      console.log('ページ隠蔽: IndexedDB接続をクローズ');
      db.close();
    }
  });
}
