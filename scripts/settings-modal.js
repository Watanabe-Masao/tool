/**
 * 設定モーダル管理
 * ヘッダーのアイコンとステータスバーの制御
 */

import { qs } from './dom-utils.js';
import { isSignedIn, getCurrentUser } from './firebase-auth.js';
import { getLastSyncTime } from './firebase-sync.js';

/**
 * 設定モーダルを開く
 */
export function openSettingsModal() {
  const modal = qs('#settings-modal');
  if (modal) {
    modal.open = true;
    updateSettingsModalContent();
  }
}

/**
 * 設定モーダルを閉じる
 */
export function closeSettingsModal() {
  const modal = qs('#settings-modal');
  if (modal) {
    modal.open = false;
  }
}

/**
 * 設定モーダルの内容を更新
 */
function updateSettingsModalContent() {
  const signedIn = isSignedIn();
  const user = signedIn ? getCurrentUser() : null;

  // ユーザー情報
  const authStatus = qs('#settings-auth-status');
  const userEmailRow = qs('#settings-user-email-row');
  const userEmail = qs('#settings-user-email');
  const userIdRow = qs('#settings-user-id-row');
  const userId = qs('#settings-user-id');
  const signinBtn = qs('#settings-signin-btn');
  const signoutBtn = qs('#settings-signout-btn');

  if (signedIn && user) {
    // ログイン中
    if (user.isAnonymous) {
      authStatus.textContent = '匿名ユーザー';
      userEmailRow.style.display = 'none';
    } else {
      authStatus.textContent = 'ログイン中';
      userEmailRow.style.display = 'flex';
      userEmail.textContent = user.email || '-';
    }

    userIdRow.style.display = 'flex';
    userId.textContent = user.uid || '-';

    signinBtn.style.display = 'none';
    signoutBtn.style.display = 'block';
  } else {
    // 未ログイン
    authStatus.textContent = '未ログイン';
    userEmailRow.style.display = 'none';
    userIdRow.style.display = 'none';

    signinBtn.style.display = 'block';
    signoutBtn.style.display = 'none';
  }

  // データ管理ボタンの有効化
  const downloadBtn = qs('#settings-download-btn');
  const uploadBtn = qs('#settings-upload-btn');
  const cleanupBtn = qs('#settings-cleanup-btn');

  if (downloadBtn) downloadBtn.disabled = !signedIn;
  if (uploadBtn) uploadBtn.disabled = !signedIn;
  if (cleanupBtn) cleanupBtn.disabled = !signedIn;

  // 最終同期時刻
  updateLastSyncTime();
}

/**
 * 最終同期時刻を更新
 */
function updateLastSyncTime() {
  const lastSyncEl = qs('#settings-last-sync');
  if (!lastSyncEl) return;

  const lastSync = getLastSyncTime();
  if (lastSync) {
    const formatted = formatDateTime(lastSync);
    lastSyncEl.textContent = `最終同期: ${formatted}`;
  } else {
    lastSyncEl.textContent = '最終同期: -';
  }
}

/**
 * 日時をフォーマット
 */
function formatDateTime(date) {
  if (!date) return '-';

  const now = new Date();
  const diff = now - date;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return `${seconds}秒前`;
  } else if (minutes < 60) {
    return `${minutes}分前`;
  } else if (hours < 24) {
    return `${hours}時間前`;
  } else if (days < 7) {
    return `${days}日前`;
  } else {
    // 1週間以上前は日時表示
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${year}/${month}/${day} ${hour}:${minute}`;
  }
}

/**
 * ステータスバーを更新
 */
export function updateStatusBar() {
  const signedIn = isSignedIn();
  const user = signedIn ? getCurrentUser() : null;

  // 認証ステータス
  const authIcon = qs('#auth-status-icon');
  const authText = qs('#auth-status-text');

  if (signedIn && user) {
    if (user.isAnonymous) {
      authIcon.textContent = '👤';
      authText.textContent = '匿名';
    } else {
      authIcon.textContent = '✅';
      authText.textContent = user.email?.split('@')[0] || 'ログイン中';
    }
  } else {
    authIcon.textContent = '☁️';
    authText.textContent = '未ログイン';
  }
}

/**
 * 同期ステータスを更新
 */
export function updateSyncStatus(status, message = '') {
  const syncIcon = qs('#sync-status-icon');
  const syncText = qs('#sync-status-text');

  if (!syncIcon || !syncText) return;

  // アイコンのアニメーションクラスをリセット
  syncIcon.classList.remove('syncing', 'success', 'error', 'warning');

  switch (status) {
    case 'uploading':
    case 'downloading':
    case 'syncing':
      syncIcon.classList.add('syncing');
      syncText.textContent = message || '同期中...';
      break;

    case 'success':
      syncIcon.classList.add('success');
      syncText.textContent = message || '同期完了';
      // 3秒後にクリア
      setTimeout(() => {
        syncText.textContent = '';
        syncIcon.classList.remove('success');
      }, 3000);
      break;

    case 'error':
      syncIcon.classList.add('error');
      syncText.textContent = message || '同期失敗';
      break;

    case 'warning':
      syncIcon.classList.add('warning');
      syncText.textContent = message || '警告';
      break;

    default:
      syncText.textContent = message;
  }

  // 設定モーダルが開いている場合は内容を更新
  const modal = qs('#settings-modal');
  if (modal && modal.open) {
    updateLastSyncTime();
  }
}

/**
 * 初期化
 */
export function initializeSettingsModal() {
  // 設定ボタン
  const settingsBtn = qs('#settings-button');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', openSettingsModal);
  }

  // 更新ボタン
  const refreshBtn = qs('#refresh-button');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      const syncBtn = qs('#sync-button');
      if (syncBtn) syncBtn.click();
    });
  }

  // モーダルを閉じる
  const closeBtn = qs('#close-settings-modal');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeSettingsModal);
  }

  // モーダルの外側をクリックで閉じる
  const modal = qs('#settings-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeSettingsModal();
      }
    });
  }

  // 設定モーダル内のボタン
  setupSettingsButtons();

  // 初期ステータス更新
  updateStatusBar();

  // 同期ステータス変更イベントをリッスン
  window.addEventListener('syncStatusChanged', (e) => {
    const { status, lastSyncTime } = e.detail;
    updateSyncStatus(status);
    updateStatusBar();
  });

  // 認証状態変更イベントをリッスン
  window.addEventListener('authStateChanged', () => {
    updateStatusBar();
    const modal = qs('#settings-modal');
    if (modal && modal.open) {
      updateSettingsModalContent();
    }
  });
}

/**
 * 設定モーダル内のボタンをセットアップ
 */
function setupSettingsButtons() {
  // ログインボタン
  const signinBtn = qs('#settings-signin-btn');
  if (signinBtn) {
    signinBtn.addEventListener('click', () => {
      const originalSigninBtn = qs('#signin-button');
      if (originalSigninBtn) originalSigninBtn.click();
    });
  }

  // ログアウトボタン
  const signoutBtn = qs('#settings-signout-btn');
  if (signoutBtn) {
    signoutBtn.addEventListener('click', () => {
      const originalSignoutBtn = qs('#signout-button');
      if (originalSignoutBtn) originalSignoutBtn.click();
      closeSettingsModal();
    });
  }

  // ダウンロードボタン
  const downloadBtn = qs('#settings-download-btn');
  if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
      const originalDownloadBtn = qs('#download-file-btn');
      if (originalDownloadBtn) originalDownloadBtn.click();
    });
  }

  // アップロードボタン
  const uploadBtn = qs('#settings-upload-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', () => {
      const originalUploadBtn = qs('#upload-file-btn');
      if (originalUploadBtn) originalUploadBtn.click();
    });
  }

  // 重複削除ボタン
  const cleanupBtn = qs('#settings-cleanup-btn');
  if (cleanupBtn) {
    cleanupBtn.addEventListener('click', () => {
      const originalCleanupBtn = qs('#cleanup-firestore-button');
      if (originalCleanupBtn) originalCleanupBtn.click();
    });
  }

  // 状態確認ボタン
  const statusBtn = qs('#settings-status-btn');
  if (statusBtn) {
    statusBtn.addEventListener('click', () => {
      const originalStatusBtn = qs('#check-sync-status-button');
      if (originalStatusBtn) originalStatusBtn.click();
    });
  }

  // DBリセットボタン
  const resetBtn = qs('#settings-reset-db-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const originalResetBtn = qs('#reset-db-button');
      if (originalResetBtn) originalResetBtn.click();
    });
  }
}
