/**
 * IndexedDB History Operations
 * CRUD operations for calculations history data
 */

import { logger } from '../core/logger.js';
import { createUserFriendlyError, generateUUID } from './utils.js';
import { STORE_NAME } from './connection.js';

/**
 * HistoryOperationsクラス
 * 計算履歴データのCRUD操作を提供
 */
export class HistoryOperations {
  /**
   * @param {DatabaseConnection} connection - データベース接続インスタンス
   */
  constructor(connection) {
    this.connection = connection;
  }

  /**
   * データを保存
   * @param {Object} data - 保存するデータ
   * @returns {Promise<number>} 保存されたレコードのID
   */
  async save(data) {
    const db = await this.connection.open();
    this.connection.logTransactionStart('save');

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => {
          this.connection.logTransactionEnd('save', false);
          logger.error('トランザクションエラー [save]:', {
            error: transaction.error,
            activeTransactions: this.connection.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(transaction.error, 'データを保存'));
        };

        transaction.oncomplete = () => {
          this.connection.logTransactionEnd('save', true);
        };

        const store = transaction.objectStore(STORE_NAME);

        // UUIDが設定されていない場合は自動生成
        const uuid = data.uuid || generateUUID();

        const record = {
          ...data,
          uuid,
          timestamp: data.timestamp || Date.now(),
          createdAt: new Date().toISOString()
        };

        const request = store.add(record);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
          this.connection.logTransactionEnd('save', false);
          logger.error('リクエストエラー [save]:', {
            error: request.error,
            activeTransactions: this.connection.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(request.error, 'データを保存'));
        };
      } catch (error) {
        this.connection.logTransactionEnd('save', false);
        logger.error('例外エラー [save]:', {
          error,
          activeTransactions: this.connection.activeTransactions,
          timestamp: new Date().toISOString()
        });
        reject(createUserFriendlyError(error, 'データを保存'));
      }
    });
  }

  /**
   * すべてのデータを取得（デフォルトで論理削除されたデータは除外）
   * @param {Object} options - ソート・フィルタオプション
   * @param {boolean} options.includeDeleted - 論理削除されたデータも含める（デフォルト: false）
   * @param {string} options.sortBy - ソート基準（'timestamp' | 'name'）
   * @param {string} options.order - ソート順（'asc' | 'desc'）
   * @returns {Promise<Array>}
   */
  async getAll(options = {}) {
    const db = await this.connection.open();
    const includeDeleted = options.includeDeleted || false;

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
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
            const record = cursor.value;
            // 論理削除されたデータをフィルタリング
            if (includeDeleted || !record.deleted) {
              results.push(record);
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
   * 論理削除されたデータのみを取得
   * @param {Object} options - ソート・フィルタオプション
   * @param {string} options.sortBy - ソート基準（'timestamp' | 'name'）
   * @param {string} options.order - ソート順（'asc' | 'desc'）
   * @returns {Promise<Array>}
   */
  async getDeleted(options = {}) {
    const db = await this.connection.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        transaction.onerror = () => reject(createUserFriendlyError(transaction.error, '削除済みデータを取得'));

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
            const record = cursor.value;
            // 論理削除されたデータのみを抽出
            if (record.deleted === true) {
              results.push(record);
            }
            cursor.continue();
          } else {
            resolve(results);
          }
        };

        request.onerror = () => reject(createUserFriendlyError(request.error, '削除済みデータを取得'));
      } catch (error) {
        reject(createUserFriendlyError(error, '削除済みデータを取得'));
      }
    });
  }

  /**
   * IDでデータを取得
   * @param {number} id - データID
   * @returns {Promise<Object>}
   */
  async getById(id) {
    const db = await this.connection.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
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
   * UUIDでデータを検索
   * @param {string} uuid - UUID
   * @returns {Promise<Object|undefined>} 見つかったデータ、または undefined
   */
  async getByUuid(uuid) {
    const db = await this.connection.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
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
    const db = await this.connection.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
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
   * @param {number} id - データID
   * @param {Object} data - 更新するデータ
   * @returns {Promise<void>}
   */
  async update(id, data) {
    const db = await this.connection.open();
    this.connection.logTransactionStart('update');

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => {
          this.connection.logTransactionEnd('update', false);
          logger.error('トランザクションエラー [update]:', {
            error: transaction.error,
            activeTransactions: this.connection.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(transaction.error, 'データを更新'));
        };

        transaction.oncomplete = () => {
          this.connection.logTransactionEnd('update', true);
        };

        const store = transaction.objectStore(STORE_NAME);

        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const record = getRequest.result;
          if (!record) {
            this.connection.logTransactionEnd('update', false);
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
            this.connection.logTransactionEnd('update', false);
            logger.error('リクエストエラー [update]:', {
              error: updateRequest.error,
              activeTransactions: this.connection.activeTransactions,
              timestamp: new Date().toISOString()
            });
            reject(createUserFriendlyError(updateRequest.error, 'データを更新'));
          };
        };

        getRequest.onerror = () => {
          this.connection.logTransactionEnd('update', false);
          logger.error('リクエストエラー [update/get]:', {
            error: getRequest.error,
            activeTransactions: this.connection.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(getRequest.error, 'データを更新'));
        };
      } catch (error) {
        this.connection.logTransactionEnd('update', false);
        logger.error('例外エラー [update]:', {
          error,
          activeTransactions: this.connection.activeTransactions,
          timestamp: new Date().toISOString()
        });
        reject(createUserFriendlyError(error, 'データを更新'));
      }
    });
  }

  /**
   * データを論理削除
   * @param {number} id - データID
   * @returns {Promise<void>}
   */
  async delete(id) {
    const db = await this.connection.open();
    this.connection.logTransactionStart('softDelete');

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => {
          this.connection.logTransactionEnd('softDelete', false);
          logger.error('トランザクションエラー [softDelete]:', {
            error: transaction.error,
            activeTransactions: this.connection.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(transaction.error, 'データを削除'));
        };

        transaction.oncomplete = () => {
          this.connection.logTransactionEnd('softDelete', true);
        };

        const store = transaction.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const record = getRequest.result;
          if (!record) {
            this.connection.logTransactionEnd('softDelete', false);
            reject(createUserFriendlyError(
              new Error(`Record with id ${id} not found`),
              'データを削除（レコードが見つかりません）'
            ));
            return;
          }

          // deleted フラグを立てる
          const updatedRecord = {
            ...record,
            deleted: true,
            deletedAt: new Date().toISOString()
          };

          const updateRequest = store.put(updatedRecord);
          updateRequest.onsuccess = () => resolve();
          updateRequest.onerror = () => {
            this.connection.logTransactionEnd('softDelete', false);
            logger.error('リクエストエラー [softDelete]:', {
              error: updateRequest.error,
              activeTransactions: this.connection.activeTransactions,
              timestamp: new Date().toISOString()
            });
            reject(createUserFriendlyError(updateRequest.error, 'データを削除'));
          };
        };

        getRequest.onerror = () => {
          this.connection.logTransactionEnd('softDelete', false);
          logger.error('リクエストエラー [softDelete/get]:', {
            error: getRequest.error,
            activeTransactions: this.connection.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(getRequest.error, 'データを削除'));
        };
      } catch (error) {
        this.connection.logTransactionEnd('softDelete', false);
        logger.error('例外エラー [softDelete]:', {
          error,
          activeTransactions: this.connection.activeTransactions,
          timestamp: new Date().toISOString()
        });
        reject(createUserFriendlyError(error, 'データを削除'));
      }
    });
  }

  /**
   * データを物理削除（完全削除）
   * @param {number} id - データID
   * @returns {Promise<void>}
   */
  async hardDelete(id) {
    const db = await this.connection.open();
    this.connection.logTransactionStart('hardDelete');

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        transaction.onerror = () => {
          this.connection.logTransactionEnd('hardDelete', false);
          logger.error('トランザクションエラー [hardDelete]:', {
            error: transaction.error,
            activeTransactions: this.connection.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(transaction.error, 'データを完全削除'));
        };

        transaction.oncomplete = () => {
          this.connection.logTransactionEnd('hardDelete', true);
        };

        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => {
          this.connection.logTransactionEnd('hardDelete', false);
          logger.error('リクエストエラー [hardDelete]:', {
            error: request.error,
            activeTransactions: this.connection.activeTransactions,
            timestamp: new Date().toISOString()
          });
          reject(createUserFriendlyError(request.error, 'データを完全削除'));
        };
      } catch (error) {
        this.connection.logTransactionEnd('hardDelete', false);
        logger.error('例外エラー [hardDelete]:', {
          error,
          activeTransactions: this.connection.activeTransactions,
          timestamp: new Date().toISOString()
        });
        reject(createUserFriendlyError(error, 'データを完全削除'));
      }
    });
  }

  /**
   * 検索（商品名での部分一致）
   * @param {string} query - 検索クエリ
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
   * @param {string} jsonString - インポートするJSON文字列
   * @returns {Promise<{count: number, errors: Array<{item: any, error: string}>}>} インポート結果
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
        logger.error('Failed to import item:', item, error);
      }
    }

    if (errors.length > 0) {
      logger.warn(`Imported ${count} items with ${errors.length} errors`);
    }

    return { count, errors };
  }

  /**
   * すべてのデータを削除
   * @returns {Promise<void>}
   */
  async clear() {
    const db = await this.connection.open();

    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
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
}
