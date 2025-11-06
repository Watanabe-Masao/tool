/**
 * Firebaseデータ同期モジュール (Backward Compatibility Wrapper)
 *
 * このファイルは後方互換性のためのラッパーです。
 * 実際の実装は以下のモジュールに分割されています：
 *
 * - firestore.js: Core Firestore utilities and CRUD operations
 * - sync-history.js: History synchronization logic
 * - utils.js: Utility functions (UUID, device ID, status, sleep)
 *
 * すべての既存の機能は維持されており、既存のコードは変更なく動作します。
 */

// Firestore CRUD operations
export {
  saveToCloud,
  updateInCloud,
  deleteFromCloud,
  hardDeleteFromCloud,
  getDeletedFromCloud,
  clearAllFromCloud
} from './firebase-sync/firestore.js';

// History synchronization
export {
  uploadToCloud,
  downloadFromCloud,
  syncData,
  getLastSyncTime,
  getIsSyncing,
  setupRealtimeListener,
  downloadToFile,
  uploadFromFile
} from './firebase-sync/sync-history.js';
