/**
import { logger } from './core/logger.js';
 * メインアプリケーションエントリーポイント
 * イベントハンドラーのセットアップを委譲
 */

import { setupEventHandlers } from './event-handlers-setup.js';
import { initializeFirebaseUI } from './firebase-ui.js';
import { initializeSimpleHeader } from './simple-header.js';
import { initializeDeletedDataUI } from './deleted-data-ui.js';
import { initializeHelpModal } from './help-modal.js';
import { registerServiceWorkerWithUpdate } from './sw-update-check.js';

// グローバルエラーハンドラ - "Script error."を防ぐ
window.addEventListener('error', (event) => {
  if (event.message === 'Script error.' && event.filename === '') {
    logger.error('[Global Error Handler] CORS制約によりエラー詳細が隠されています');
    logger.error('エラー位置:', event.lineno, event.colno);
    logger.error('スタック:', event.error?.stack);
    return;
  }
  logger.error('[Global Error Handler]', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error
  });
});

// Promise rejectionハンドラ
window.addEventListener('unhandledrejection', (event) => {
  logger.error('[Unhandled Promise Rejection]', event.reason);
});

// アプリケーション起動
// DOMの準備が完了してからイベントハンドラーを初期化
async function initializeApp() {
  try {
    // Service Worker登録（最初に実行）
    registerServiceWorkerWithUpdate();

    setupEventHandlers();

    // Firebase初期化（設定で有効になっている場合のみ）
    await initializeFirebaseUI();

    // シンプルヘッダー初期化
    initializeSimpleHeader();

    // 論理削除データ管理UI初期化
    initializeDeletedDataUI();

    // ヘルプモーダル初期化
    initializeHelpModal();
  } catch (error) {
    logger.error('[App Initialization Error]', error);
    // ユーザーにエラーを表示
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);background:red;color:white;padding:10px 20px;border-radius:5px;z-index:10000';
    errorDiv.textContent = 'アプリの初期化に失敗しました。ページを再読み込みしてください。';
    document.body.appendChild(errorDiv);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOMが既に読み込まれている場合は即座に実行
  initializeApp();
}
