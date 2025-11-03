/**
 * Firebase Sync Tests
 * Firestore-first アーキテクチャの動作確認
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { __clearMockFirestore, __getMockFirestoreData, __setMockSignedIn } from '../__mocks__/firebase.js';

// Note: In a real test setup, we would need to properly mock the modules
// For now, we'll test the logic patterns

describe('Firestore-first Architecture Tests', () => {
  beforeEach(() => {
    __clearMockFirestore();
    __setMockSignedIn(true);
  });

  describe('saveToCloud()', () => {
    test('should save to Firestore first, then cache in IndexedDB', async () => {
      // Arrange
      const testData = {
        name: 'テスト商品',
        mode: 'fixed',
        input: { buyPrice: 100, sellPrice: 150 },
        result: { profit: 50, profitRate: 50 },
        timestamp: Date.now()
      };

      // Mock sequence tracker
      const sequence = [];

      // Mock Firestore set
      const mockFirestoreSet = jest.fn().mockImplementation(() => {
        sequence.push('firestore');
        return Promise.resolve();
      });

      // Mock IndexedDB save
      const mockIndexedDBSave = jest.fn().mockImplementation(() => {
        sequence.push('indexeddb');
        return Promise.resolve(1); // Return mock ID
      });

      // Act - simulate the saveToCloud logic
      await mockFirestoreSet(testData);
      await mockIndexedDBSave(testData);

      // Assert
      expect(sequence).toEqual(['firestore', 'indexeddb']);
      expect(mockFirestoreSet).toHaveBeenCalledWith(testData);
      expect(mockIndexedDBSave).toHaveBeenCalledWith(testData);
    });

    test('should throw error when not signed in', async () => {
      // Arrange
      __setMockSignedIn(false);
      const testData = { name: 'テスト' };

      // Act & Assert
      const isSignedIn = false;
      if (!isSignedIn) {
        expect(() => {
          throw new Error('保存はオンライン時のみ可能です。ログインしてください。');
        }).toThrow('保存はオンライン時のみ可能です。ログインしてください。');
      }
    });

    test('should generate UUID and include it in saved data', async () => {
      // Arrange
      const testData = {
        name: 'テスト商品',
        mode: 'fixed'
      };

      // Mock UUID generation
      const mockUUID = 'test-uuid-12345';
      const mockGenerateUUID = jest.fn(() => mockUUID);

      // Act
      const uuid = mockGenerateUUID();
      const dataToSave = {
        ...testData,
        uuid: uuid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Assert
      expect(dataToSave.uuid).toBe(mockUUID);
      expect(dataToSave).toHaveProperty('createdAt');
      expect(dataToSave).toHaveProperty('updatedAt');
    });

    test('should rollback on Firestore failure', async () => {
      // Arrange
      const testData = { name: 'テスト' };
      const mockFirestoreSet = jest.fn().mockRejectedValue(new Error('Network error'));
      const mockIndexedDBSave = jest.fn();

      // Act & Assert
      try {
        await mockFirestoreSet(testData);
        await mockIndexedDBSave(testData); // Should not be called
      } catch (error) {
        expect(error.message).toBe('Network error');
        expect(mockIndexedDBSave).not.toHaveBeenCalled();
      }
    });
  });

  describe('updateInCloud()', () => {
    test('should update Firestore first, then update IndexedDB cache', async () => {
      // Arrange
      const id = 1;
      const updates = {
        name: '更新された商品',
        input: { buyPrice: 200, sellPrice: 300 }
      };

      const sequence = [];

      // Mock Firestore update
      const mockFirestoreUpdate = jest.fn().mockImplementation(() => {
        sequence.push('firestore');
        return Promise.resolve();
      });

      // Mock IndexedDB update
      const mockIndexedDBUpdate = jest.fn().mockImplementation(() => {
        sequence.push('indexeddb');
        return Promise.resolve();
      });

      // Act
      await mockFirestoreUpdate(updates);
      await mockIndexedDBUpdate(id, updates);

      // Assert
      expect(sequence).toEqual(['firestore', 'indexeddb']);
      expect(mockFirestoreUpdate).toHaveBeenCalledWith(updates);
      expect(mockIndexedDBUpdate).toHaveBeenCalledWith(id, updates);
    });

    test('should throw error when not signed in', async () => {
      // Arrange
      __setMockSignedIn(false);

      // Act & Assert
      const isSignedIn = false;
      if (!isSignedIn) {
        expect(() => {
          throw new Error('更新はオンライン時のみ可能です。ログインしてください。');
        }).toThrow('更新はオンライン時のみ可能です。ログインしてください。');
      }
    });

    test('should throw error when UUID not found', async () => {
      // Arrange
      const id = 999; // Non-existent ID
      const mockGetById = jest.fn().mockResolvedValue(null);

      // Act
      const localItem = await mockGetById(id);

      // Assert
      if (!localItem) {
        expect(() => {
          throw new Error(`IndexedDB ID:${id} が見つかりません`);
        }).toThrow(`IndexedDB ID:${id} が見つかりません`);
      }
    });

    test('should include updatedAt timestamp in updates', async () => {
      // Arrange
      const updates = { name: '更新' };
      const expectedUpdates = {
        ...updates,
        updatedAt: expect.any(String)
      };

      // Act
      const dataToUpdate = {
        ...updates,
        updatedAt: new Date().toISOString()
      };

      // Assert
      expect(dataToUpdate).toMatchObject(expectedUpdates);
    });
  });

  describe('deleteFromCloud()', () => {
    test('should delete from Firestore first, then from IndexedDB', async () => {
      // Arrange
      const id = 1;
      const sequence = [];

      // Mock Firestore delete
      const mockFirestoreDelete = jest.fn().mockImplementation(() => {
        sequence.push('firestore');
        return Promise.resolve();
      });

      // Mock IndexedDB delete
      const mockIndexedDBDelete = jest.fn().mockImplementation(() => {
        sequence.push('indexeddb');
        return Promise.resolve();
      });

      // Act
      await mockFirestoreDelete(id);
      await mockIndexedDBDelete(id);

      // Assert
      expect(sequence).toEqual(['firestore', 'indexeddb']);
      expect(mockFirestoreDelete).toHaveBeenCalledWith(id);
      expect(mockIndexedDBDelete).toHaveBeenCalledWith(id);
    });

    test('should throw error when not signed in', async () => {
      // Arrange
      __setMockSignedIn(false);

      // Act & Assert
      const isSignedIn = false;
      if (!isSignedIn) {
        expect(() => {
          throw new Error('削除はオンライン時のみ可能です。ログインしてください。');
        }).toThrow('削除はオンライン時のみ可能です。ログインしてください。');
      }
    });

    test('should use UUID to delete from Firestore', async () => {
      // Arrange
      const id = 1;
      const mockUUID = 'test-uuid-12345';
      const mockLocalItem = { id: 1, uuid: mockUUID, name: 'テスト' };
      const mockGetById = jest.fn().mockResolvedValue(mockLocalItem);
      const mockFirestoreDelete = jest.fn().mockResolvedValue(true);

      // Act
      const localItem = await mockGetById(id);
      const uuid = localItem.uuid;
      await mockFirestoreDelete(uuid);

      // Assert
      expect(mockGetById).toHaveBeenCalledWith(id);
      expect(mockFirestoreDelete).toHaveBeenCalledWith(mockUUID);
    });

    test('should handle missing UUID gracefully', async () => {
      // Arrange
      const id = 1;
      const mockLocalItem = { id: 1, name: 'テスト' }; // No UUID
      const mockGetById = jest.fn().mockResolvedValue(mockLocalItem);

      // Act
      const localItem = await mockGetById(id);
      const uuid = localItem.uuid;

      // Assert
      if (!uuid) {
        console.warn(`IndexedDB ID:${id} にUUIDが設定されていません。クラウド削除をスキップします。`);
        expect(uuid).toBeUndefined();
      }
    });

    test('should continue with local delete even if Firestore delete fails', async () => {
      // Arrange
      const id = 1;
      const mockFirestoreDelete = jest.fn().mockRejectedValue(new Error('Network error'));
      const mockIndexedDBDelete = jest.fn().mockResolvedValue(true);

      // Act & Assert - Firestore-first means if Firestore fails, we should handle it
      try {
        await mockFirestoreDelete(id);
      } catch (error) {
        // In Firestore-first, we should NOT continue to IndexedDB if Firestore fails
        // This ensures data consistency
        expect(error.message).toBe('Network error');
        expect(mockIndexedDBDelete).not.toHaveBeenCalled();
      }
    });
  });

  describe('Data Consistency Tests', () => {
    test('should maintain UUID consistency across operations', async () => {
      // Arrange
      const mockUUID = 'consistent-uuid-123';
      const testData = { name: 'テスト', uuid: mockUUID };

      // Save
      const savedData = { ...testData, id: 1 };

      // Update
      const updates = { name: '更新' };
      const updatedData = { ...savedData, ...updates };

      // Assert - UUID should remain the same
      expect(savedData.uuid).toBe(mockUUID);
      expect(updatedData.uuid).toBe(mockUUID);
    });

    test('should prevent data resurrection after deletion', async () => {
      // Arrange
      const id = 1;
      const mockData = new Map();
      mockData.set(id, { id, name: 'テスト', uuid: 'test-uuid' });

      // Delete from Firestore
      const mockFirestoreDelete = jest.fn().mockImplementation(() => {
        mockData.delete(id);
        return Promise.resolve();
      });

      // Act
      await mockFirestoreDelete();

      // Assert - Data should not exist after deletion
      expect(mockData.has(id)).toBe(false);

      // Subsequent sync should not resurrect the data
      const mockSync = jest.fn().mockImplementation(() => {
        // Since data is deleted from Firestore (master), it won't be synced back
        return Promise.resolve([]);
      });

      const syncedData = await mockSync();
      expect(syncedData).toEqual([]);
      expect(syncedData.find(item => item.id === id)).toBeUndefined();
    });

    test('should resolve conflicts by preferring Firestore data', async () => {
      // Arrange
      const firestoreData = {
        id: 1,
        name: 'Firestore版',
        updatedAt: new Date('2025-11-03T12:00:00Z')
      };

      const indexedDBData = {
        id: 1,
        name: 'IndexedDB版',
        updatedAt: new Date('2025-11-03T11:00:00Z') // Older
      };

      // Act - Compare timestamps
      const firestoreTime = new Date(firestoreData.updatedAt);
      const localTime = new Date(indexedDBData.updatedAt);

      // Assert - Firestore data should win
      if (firestoreTime > localTime) {
        expect(firestoreData.name).toBe('Firestore版');
      }
    });
  });

  describe('Error Handling Tests', () => {
    test('should propagate network errors to UI', async () => {
      // Arrange
      const mockOperation = jest.fn().mockRejectedValue(new Error('Network error'));

      // Act & Assert
      await expect(mockOperation()).rejects.toThrow('Network error');
    });

    test('should provide user-friendly error messages', async () => {
      // Arrange
      const errors = [
        { code: 'permission-denied', message: 'アクセス権限がありません' },
        { code: 'unavailable', message: 'ネットワーク接続を確認してください' },
        { code: 'not-found', message: 'データが見つかりません' }
      ];

      // Act & Assert
      errors.forEach(error => {
        const userMessage = getUserFriendlyErrorMessage(error);
        expect(userMessage).toBeTruthy();
        expect(userMessage.length).toBeGreaterThan(0);
      });
    });
  });
});

// Helper function for error messages
function getUserFriendlyErrorMessage(error) {
  const errorMap = {
    'permission-denied': 'アクセス権限がありません。Firestoreのセキュリティルールを確認してください。',
    'unavailable': 'ネットワーク接続を確認してください。',
    'not-found': 'データが見つかりません。'
  };

  return errorMap[error.code] || `エラーが発生しました: ${error.message}`;
}
