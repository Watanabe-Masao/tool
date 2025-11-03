// Test setup and global mocks

import { __clearMockFirestore, __setMockUser, __setMockSignedIn } from '../__mocks__/firebase.js';

// Mock IndexedDB
class MockIDBDatabase {
  constructor() {
    this.objectStores = new Map();
  }

  createObjectStore(name, options) {
    const store = new MockObjectStore(name);
    this.objectStores.set(name, store);
    return store;
  }

  transaction(storeNames, mode) {
    return new MockTransaction(this, storeNames, mode);
  }
}

class MockObjectStore {
  constructor(name) {
    this.name = name;
    this.data = new Map();
    this.autoIncrement = 0;
    this.indexes = new Map();
  }

  createIndex(name, keyPath, options) {
    this.indexes.set(name, { name, keyPath, options });
  }

  add(value) {
    const key = ++this.autoIncrement;
    this.data.set(key, { ...value, id: key });
    return new MockRequest(key);
  }

  put(value) {
    const key = value.id || ++this.autoIncrement;
    this.data.set(key, { ...value, id: key });
    return new MockRequest(key);
  }

  get(key) {
    const value = this.data.get(key);
    return new MockRequest(value);
  }

  delete(key) {
    this.data.delete(key);
    return new MockRequest(undefined);
  }

  clear() {
    this.data.clear();
    return new MockRequest(undefined);
  }

  getAll() {
    return new MockRequest(Array.from(this.data.values()));
  }

  index(name) {
    return {
      get: (value) => {
        const indexInfo = this.indexes.get(name);
        for (const item of this.data.values()) {
          if (item[indexInfo.keyPath] === value) {
            return new MockRequest(item);
          }
        }
        return new MockRequest(undefined);
      }
    };
  }
}

class MockTransaction {
  constructor(db, storeNames, mode) {
    this.db = db;
    this.storeNames = Array.isArray(storeNames) ? storeNames : [storeNames];
    this.mode = mode;
    this.error = null;
  }

  objectStore(name) {
    return this.db.objectStores.get(name);
  }

  addEventListener(event, callback) {
    if (event === 'complete') {
      // Simulate async completion
      setTimeout(() => callback(), 0);
    }
  }
}

class MockRequest {
  constructor(result) {
    this.result = result;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;

    // Simulate async behavior
    setTimeout(() => {
      if (this.onsuccess) {
        this.onsuccess({ target: this });
      }
    }, 0);
  }

  addEventListener(event, callback) {
    if (event === 'success') {
      this.onsuccess = callback;
    } else if (event === 'error') {
      this.onerror = callback;
    }
  }
}

class MockIDBFactory {
  constructor() {
    this.databases = new Map();
  }

  open(name, version) {
    let db = this.databases.get(name);
    if (!db) {
      db = new MockIDBDatabase();
      this.databases.set(name, db);
    }

    const request = new MockRequest(db);
    request.onupgradeneeded = null;

    // Simulate upgrade if needed
    setTimeout(() => {
      if (request.onupgradeneeded) {
        request.onupgradeneeded({ target: { result: db } });
      }
    }, 0);

    return request;
  }

  deleteDatabase(name) {
    this.databases.delete(name);
    return new MockRequest(undefined);
  }
}

// Set up global mocks
global.indexedDB = new MockIDBFactory();

// Set up default mock user
beforeEach(() => {
  __clearMockFirestore();
  __setMockUser({
    uid: 'test-user-123',
    email: 'test@example.com'
  });
  __setMockSignedIn(true);

  // Clear IndexedDB
  global.indexedDB = new MockIDBFactory();
});

// Mock localStorage
global.localStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  },
  clear() {
    this.data = {};
  }
};

// Mock crypto.randomUUID for UUID generation
global.crypto = {
  randomUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};
