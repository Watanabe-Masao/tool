/**
 * メインアプリケーションエントリーポイント
 * イベントハンドラーのセットアップを委譲
 */

import { setupEventHandlers } from './event-handlers-setup.js';
import { initializeFirebaseUI } from './firebase-ui.js';

// アプリケーション起動
// DOMの準備が完了してからイベントハンドラーを初期化
async function initializeApp() {
  setupEventHandlers();

  // Firebase初期化（設定で有効になっている場合のみ）
  await initializeFirebaseUI();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  // DOMが既に読み込まれている場合は即座に実行
  initializeApp();
}
