/**
 * IndexedDB ラッパークラス
 * 歩留まり計算ツールのデータ永続化を管理
 */

const DB_NAME = 'YieldCalculatorDB';
const DB_VERSION = 1;
const STORE_NAME = 'calculations';

export class YieldCalculatorDB {
  constructor() {
    this.db = null;
  }

  /**
   * データベースを開く
   * @returns {Promise<IDBDatabase>}
   */
  async open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

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
      };
    });
  }

  /**
   * データを保存
   * @param {Object} data - 保存するデータ
   * @returns {Promise<number>} 保存されたレコードのID
   */
  async save(data) {
    if (!this.db) await this.open();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record = {
        ...data,
        timestamp: data.timestamp || Date.now(),
        createdAt: new Date().toISOString()
      };

      const request = store.add(record);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
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

      request.onerror = () => reject(request.error);
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
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
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

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const record = getRequest.result;
        if (!record) {
          reject(new Error(`Record with id ${id} not found`));
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
        updateRequest.onerror = () => reject(updateRequest.error);
      };

      getRequest.onerror = () => reject(getRequest.error);
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
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 検索（商品名での部分一致）
   * @param {string} query
   * @returns {Promise<Array>}
   */
  async search(query) {
    const all = await this.getAll();
    const lowerQuery = query.toLowerCase();

    return all.filter(item =>
      item.name && item.name.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * すべてのデータをエクスポート（JSON）
   * @returns {Promise<string>}
   */
  async exportJSON() {
    const data = await this.getAll();
    return JSON.stringify(data, null, 2);
  }

  /**
   * JSONデータをインポート
   * @param {string} jsonString
   * @returns {Promise<number>} インポートされた件数
   */
  async importJSON(jsonString) {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) {
      throw new Error('Invalid JSON format: expected array');
    }

    let count = 0;
    for (const item of data) {
      // IDを除いて保存（新規IDが割り当てられる）
      const { id, ...itemWithoutId } = item;
      await this.save(itemWithoutId);
      count++;
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
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
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
  }
}

// シングルトンインスタンス
export const db = new YieldCalculatorDB();
