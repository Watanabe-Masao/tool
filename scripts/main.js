/**
 * メインアプリケーションエントリーポイント
 * イベントハンドラーのセットアップを委譲
 */

import { setupEventHandlers } from './event-handlers-setup.js';

// アプリケーション起動
// DOMの準備が完了してからイベントハンドラーを初期化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupEventHandlers);
} else {
  // DOMが既に読み込まれている場合は即座に実行
  setupEventHandlers();
}
