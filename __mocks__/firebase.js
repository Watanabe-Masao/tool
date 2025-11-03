// Firebase Mock for testing

const mockFirestoreData = new Map();
let mockCurrentUser = null;
let mockIsSignedIn = false;

// Mock Firestore Document Reference
class MockDocumentReference {
  constructor(path) {
    this.path = path;
    this.id = path.split('/').pop();
  }

  async set(data, options = {}) {
    const key = this.path;
    if (options.merge && mockFirestoreData.has(key)) {
      const existing = mockFirestoreData.get(key);
      mockFirestoreData.set(key, { ...existing, ...data });
    } else {
      mockFirestoreData.set(key, { ...data });
    }
    return Promise.resolve();
  }

  async get() {
    const data = mockFirestoreData.get(this.path);
    return {
      exists: !!data,
      data: () => data,
      id: this.id
    };
  }

  async update(data) {
    const key = this.path;
    if (!mockFirestoreData.has(key)) {
      throw new Error('Document does not exist');
    }
    const existing = mockFirestoreData.get(key);
    mockFirestoreData.set(key, { ...existing, ...data });
    return Promise.resolve();
  }

  async delete() {
    mockFirestoreData.delete(this.path);
    return Promise.resolve();
  }
}

// Mock Collection Reference
class MockCollectionReference {
  constructor(path) {
    this.path = path;
  }

  doc(id) {
    return new MockDocumentReference(`${this.path}/${id}`);
  }

  async get() {
    const docs = [];
    for (const [path, data] of mockFirestoreData.entries()) {
      if (path.startsWith(this.path + '/')) {
        const id = path.split('/').pop();
        docs.push({
          id,
          data: () => data,
          ref: new MockDocumentReference(path)
        });
      }
    }
    return {
      empty: docs.length === 0,
      size: docs.length,
      docs
    };
  }

  where(field, operator, value) {
    // Simple where implementation
    return this;
  }
}

// Mock Firestore
class MockFirestore {
  collection(path) {
    return new MockCollectionReference(path);
  }
}

// Mock Firebase
const firebase = {
  apps: [{}],
  firestore: () => new MockFirestore(),
  auth: () => ({
    currentUser: mockCurrentUser
  })
};

// Mock FieldValue
firebase.firestore.FieldValue = {
  serverTimestamp: () => new Date().toISOString()
};

// Mock Timestamp
firebase.firestore.Timestamp = {
  fromDate: (date) => ({
    toDate: () => date
  })
};

// Helper functions to control mock state
export function __setMockUser(user) {
  mockCurrentUser = user;
  mockIsSignedIn = !!user;
}

export function __setMockSignedIn(signedIn) {
  mockIsSignedIn = signedIn;
}

export function __clearMockFirestore() {
  mockFirestoreData.clear();
}

export function __getMockFirestoreData() {
  return mockFirestoreData;
}

export function __setMockFirestoreData(path, data) {
  mockFirestoreData.set(path, data);
}

export default firebase;
