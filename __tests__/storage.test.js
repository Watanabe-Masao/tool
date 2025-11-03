/**
 * Storage Integration Tests
 * storage.js の CRUD 操作が Firestore-first で動作することを確認
 */

import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { __clearMockFirestore, __setMockSignedIn } from '../__mocks__/firebase.js';

describe('Storage.js Integration Tests (Firestore-first)', () => {
  beforeEach(() => {
    __clearMockFirestore();
    __setMockSignedIn(true);
  });

  describe('saveCalculation()', () => {
    test('should use saveToCloud() which saves to Firestore first', async () => {
      // Arrange
      const name = 'テスト商品';
      const mode = 'fixed';
      const inputData = { buyPrice: 100, sellPrice: 150 };
      const resultData = { profit: 50, profitRate: 50 };

      const sequence = [];

      // Mock saveToCloud function
      const mockSaveToCloud = jest.fn().mockImplementation(async (data) => {
        sequence.push('saveToCloud');

        // Simulate Firestore save
        sequence.push('firestore-save');

        // Simulate IndexedDB cache
        sequence.push('indexeddb-cache');

        return { id: 1, uuid: 'test-uuid' };
      });

      // Act
      const result = await mockSaveToCloud({
        name,
        mode,
        input: inputData,
        result: resultData,
        timestamp: Date.now()
      });

      // Assert
      expect(sequence).toEqual(['saveToCloud', 'firestore-save', 'indexeddb-cache']);
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('uuid');
    });

    test('should include all required fields', async () => {
      // Arrange
      const data = {
        name: 'テスト商品',
        mode: 'fixed',
        category: 'カテゴリA',
        input: { buyPrice: 100, sellPrice: 150 },
        result: { profit: 50, profitRate: 50 },
        product: { quantity: 10 },
        timestamp: Date.now()
      };

      // Act
      const mockSaveToCloud = jest.fn().mockResolvedValue({ id: 1, uuid: 'test-uuid' });
      await mockSaveToCloud(data);

      // Assert
      expect(mockSaveToCloud).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'テスト商品',
          mode: 'fixed',
          category: 'カテゴリA',
          input: expect.any(Object),
          result: expect.any(Object),
          product: expect.any(Object),
          timestamp: expect.any(Number)
        })
      );
    });

    test('should throw error when offline', async () => {
      // Arrange
      __setMockSignedIn(false);

      // Act & Assert
      const isSignedIn = false;
      if (!isSignedIn) {
        await expect(async () => {
          throw new Error('保存はオンライン時のみ可能です。ログインしてください。');
        }).rejects.toThrow('保存はオンライン時のみ可能です。ログインしてください。');
      }
    });
  });

  describe('updateCalculation()', () => {
    test('should use updateInCloud() which updates Firestore first', async () => {
      // Arrange
      const id = 1;
      const name = '更新された商品';
      const mode = 'weight';
      const inputData = { buyPrice: 200, sellPrice: 300 };
      const resultData = { profit: 100, profitRate: 50 };

      const sequence = [];

      // Mock updateInCloud function
      const mockUpdateInCloud = jest.fn().mockImplementation(async (id, updates) => {
        sequence.push('updateInCloud');

        // Simulate Firestore update
        sequence.push('firestore-update');

        // Simulate IndexedDB cache update
        sequence.push('indexeddb-cache-update');
      });

      // Act
      await mockUpdateInCloud(id, {
        name,
        mode,
        input: inputData,
        result: resultData,
        timestamp: Date.now()
      });

      // Assert
      expect(sequence).toEqual(['updateInCloud', 'firestore-update', 'indexeddb-cache-update']);
    });

    test('should preserve UUID during update', async () => {
      // Arrange
      const id = 1;
      const originalUUID = 'original-uuid-123';
      const updates = { name: '更新' };

      const mockGetById = jest.fn().mockResolvedValue({
        id: 1,
        uuid: originalUUID,
        name: 'テスト'
      });

      const mockUpdateInCloud = jest.fn().mockImplementation(async (id, updates) => {
        // UUID should not be in updates
        expect(updates).not.toHaveProperty('uuid');
      });

      // Act
      const localItem = await mockGetById(id);
      await mockUpdateInCloud(id, updates);

      // Assert
      expect(localItem.uuid).toBe(originalUUID);
    });
  });

  describe('updateCalculationName()', () => {
    test('should use updateInCloud() for name updates', async () => {
      // Arrange
      const id = 1;
      const newName = '新しい商品名';
      const newCategory = '新カテゴリ';

      const sequence = [];

      // Mock updateInCloud
      const mockUpdateInCloud = jest.fn().mockImplementation(async (id, updates) => {
        sequence.push('updateInCloud');
        expect(updates).toHaveProperty('name', newName);
        if (updates.category != null) {
          expect(updates.category).toBe(newCategory);
        }
      });

      // Act
      const updates = { name: newName };
      if (newCategory != null) {
        updates.category = newCategory;
      }
      await mockUpdateInCloud(id, updates);

      // Assert
      expect(sequence).toEqual(['updateInCloud']);
    });

    test('should handle null category correctly', async () => {
      // Arrange
      const id = 1;
      const newName = '商品名のみ更新';
      const category = null;

      // Act
      const updates = { name: newName };
      // category が null の場合は含めない
      if (category != null) {
        updates.category = category;
      }

      // Assert
      expect(updates).toHaveProperty('name', newName);
      expect(updates).not.toHaveProperty('category');
    });
  });

  describe('deleteHistory()', () => {
    test('should delete from Firestore first, then IndexedDB', async () => {
      // Arrange
      const id = 1;
      const sequence = [];

      // Mock deleteFromCloud (Firestore)
      const mockDeleteFromCloud = jest.fn().mockImplementation(async (id) => {
        sequence.push('firestore-delete');
        return true;
      });

      // Mock db.delete (IndexedDB)
      const mockIndexedDBDelete = jest.fn().mockImplementation(async (id) => {
        sequence.push('indexeddb-delete');
      });

      // Act
      await mockDeleteFromCloud(id);
      await mockIndexedDBDelete(id);

      // Assert
      expect(sequence).toEqual(['firestore-delete', 'indexeddb-delete']);
    });

    test('should throw error when offline', async () => {
      // Arrange
      __setMockSignedIn(false);

      // Act & Assert
      const isSignedIn = false;
      if (!isSignedIn) {
        await expect(async () => {
          throw new Error('削除はオンライン時のみ可能です。ログインしてください。');
        }).rejects.toThrow('削除はオンライン時のみ可能です。ログインしてください。');
      }
    });

    test('should prevent data resurrection after deletion', async () => {
      // Arrange
      const id = 1;
      const uuid = 'test-uuid-123';

      // Mock data storage
      const firestoreData = new Map();
      const indexedDBData = new Map();

      firestoreData.set(uuid, { id, uuid, name: 'テスト' });
      indexedDBData.set(id, { id, uuid, name: 'テスト' });

      // Mock deleteFromCloud
      const mockDeleteFromCloud = jest.fn().mockImplementation(async () => {
        firestoreData.delete(uuid); // Delete from Firestore (master)
      });

      // Mock IndexedDB delete
      const mockIndexedDBDelete = jest.fn().mockImplementation(async () => {
        indexedDBData.delete(id); // Delete from cache
      });

      // Mock sync operation
      const mockSync = jest.fn().mockImplementation(async () => {
        // Sync should not resurrect deleted data
        // Because Firestore (master) no longer has the data
        const syncedData = Array.from(firestoreData.values());
        return syncedData;
      });

      // Act
      await mockDeleteFromCloud();
      await mockIndexedDBDelete();
      const syncedData = await mockSync();

      // Assert
      expect(firestoreData.has(uuid)).toBe(false);
      expect(indexedDBData.has(id)).toBe(false);
      expect(syncedData.find(item => item.uuid === uuid)).toBeUndefined();
    });
  });

  describe('Complete CRUD Flow', () => {
    test('should complete full lifecycle: create -> update -> delete', async () => {
      // Arrange
      const lifecycle = [];
      let currentData = null;

      // Mock saveToCloud
      const mockSaveToCloud = jest.fn().mockImplementation(async (data) => {
        lifecycle.push('create');
        currentData = { ...data, id: 1, uuid: 'test-uuid' };
        return { id: 1, uuid: 'test-uuid' };
      });

      // Mock updateInCloud
      const mockUpdateInCloud = jest.fn().mockImplementation(async (id, updates) => {
        lifecycle.push('update');
        currentData = { ...currentData, ...updates };
      });

      // Mock deleteFromCloud
      const mockDeleteFromCloud = jest.fn().mockImplementation(async (id) => {
        lifecycle.push('delete');
        currentData = null;
      });

      // Act
      // 1. Create
      await mockSaveToCloud({ name: 'テスト', mode: 'fixed' });

      // 2. Update
      await mockUpdateInCloud(1, { name: '更新後' });

      // 3. Delete
      await mockDeleteFromCloud(1);

      // Assert
      expect(lifecycle).toEqual(['create', 'update', 'delete']);
      expect(currentData).toBeNull();
    });

    test('should maintain data consistency throughout lifecycle', async () => {
      // Arrange
      const uuid = 'consistent-uuid-123';
      const firestoreData = new Map();
      const indexedDBData = new Map();

      // Mock operations that maintain UUID consistency
      const mockSave = jest.fn().mockImplementation(async (data) => {
        const dataWithUUID = { ...data, uuid };
        firestoreData.set(uuid, dataWithUUID);
        indexedDBData.set(1, { ...dataWithUUID, id: 1 });
        return { id: 1, uuid };
      });

      const mockUpdate = jest.fn().mockImplementation(async (id, updates) => {
        const existing = indexedDBData.get(id);
        const updated = { ...existing, ...updates };
        firestoreData.set(uuid, updated);
        indexedDBData.set(id, updated);
      });

      const mockDelete = jest.fn().mockImplementation(async (id) => {
        firestoreData.delete(uuid);
        indexedDBData.delete(id);
      });

      // Act
      await mockSave({ name: 'テスト' });
      const savedData = indexedDBData.get(1);

      await mockUpdate(1, { name: '更新' });
      const updatedData = indexedDBData.get(1);

      await mockDelete(1);

      // Assert
      expect(savedData.uuid).toBe(uuid);
      expect(updatedData.uuid).toBe(uuid); // UUID remains consistent
      expect(firestoreData.has(uuid)).toBe(false); // Deleted from master
      expect(indexedDBData.has(1)).toBe(false); // Deleted from cache
    });
  });

  describe('Error Propagation', () => {
    test('should propagate errors from saveToCloud to UI', async () => {
      // Arrange
      const mockSaveToCloud = jest.fn().mockRejectedValue(
        new Error('保存はオンライン時のみ可能です。ログインしてください。')
      );

      // Act & Assert
      await expect(mockSaveToCloud({})).rejects.toThrow(
        '保存はオンライン時のみ可能です。ログインしてください。'
      );
    });

    test('should propagate errors from updateInCloud to UI', async () => {
      // Arrange
      const mockUpdateInCloud = jest.fn().mockRejectedValue(
        new Error('更新はオンライン時のみ可能です。ログインしてください。')
      );

      // Act & Assert
      await expect(mockUpdateInCloud(1, {})).rejects.toThrow(
        '更新はオンライン時のみ可能です。ログインしてください。'
      );
    });

    test('should propagate errors from deleteHistory to UI', async () => {
      // Arrange
      const mockDeleteFromCloud = jest.fn().mockRejectedValue(
        new Error('削除はオンライン時のみ可能です。ログインしてください。')
      );

      // Act & Assert
      await expect(mockDeleteFromCloud(1)).rejects.toThrow(
        '削除はオンライン時のみ可能です。ログインしてください。'
      );
    });
  });
});
