/**
 * Firebase Sync Utility Functions
 *
 * This module provides:
 * - UUID generation
 * - Device ID management
 * - Sync status updates
 * - Async delay utilities
 */

/**
 * ユーティリティ：指定時間待機
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 同期ステータスを更新
 */
export function updateSyncStatus(status, lastSyncTime = null) {
  const event = new CustomEvent('syncStatusChanged', {
    detail: { status, lastSyncTime }
  });
  window.dispatchEvent(event);
}

/**
 * デバイスIDを取得（またはと生成）
 */
export function getDeviceId() {
  let deviceId = localStorage.getItem('deviceId');
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('deviceId', deviceId);
  }
  return deviceId;
}

/**
 * UUID v4を生成
 * @returns {string} UUID (例: "550e8400-e29b-41d4-a916-446655440000")
 */
export function generateUUID() {
  // 最新ブラウザではcrypto.randomUUID()を使用
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // フォールバック: UUID v4の形式で生成
  // xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
