/**
 * Service Worker更新チェック
 * 新しいバージョンを検出し、ユーザーに通知
 */

import { logger } from './core/logger.js';
import { showToast } from './toast.js';

/**
 * Service Worker登録と更新チェック
 */
export function registerServiceWorkerWithUpdate() {
  if ('serviceWorker' in navigator) {
    // Service Workerを登録
    navigator.serviceWorker.register('/tool/sw.js')
      .then((registration) => {
        logger.info('✅ Service Worker registered:', registration.scope);

        // 🔥 定期的に更新をチェック（1時間ごと）
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);

        // 新しいService Workerが待機中の場合
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          logger.info('🔄 New Service Worker found, installing...');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // 新しいバージョンが利用可能
              logger.info('✅ New Service Worker installed');

              // ユーザーに通知
              showUpdateNotification();
            }
          });
        });
      })
      .catch((error) => {
        logger.error('❌ Service Worker registration failed:', error);
      });

    // 制御が変更された時（新しいService Workerがアクティブになった時）
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      logger.info('🔄 Service Worker controller changed, reloading...');
      // 自動リロード（オプション：ユーザーに確認することも可能）
      window.location.reload();
    });
  }
}

/**
 * 更新通知を表示
 */
function showUpdateNotification() {
  // トースト通知で更新を促す
  const updateToast = showToast(
    '新しいバージョンが利用可能です。',
    'info',
    10000 // 10秒表示
  );

  // 更新ボタンを追加（オプション）
  if (updateToast) {
    const button = document.createElement('button');
    button.textContent = '今すぐ更新';
    button.style.cssText = 'margin-left: 10px; padding: 5px 10px; background: white; border: none; border-radius: 4px; cursor: pointer;';
    button.onclick = () => {
      // Service Workerを即座にアクティブ化
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
    };
    updateToast.appendChild(button);
  }
}

/**
 * Service Workerをアンインストール（デバッグ用）
 */
export async function unregisterServiceWorker() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      logger.info('✅ Service Worker unregistered');
    }
  }
}

/**
 * キャッシュをクリア（デバッグ用）
 */
export async function clearAllCaches() {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
    logger.info('✅ All caches cleared:', cacheNames);
  }
}

// デバッグヘルパーをグローバルに公開
if (typeof window !== 'undefined') {
  window.swDebug = {
    unregister: unregisterServiceWorker,
    clearCaches: clearAllCaches
  };
  logger.info('🛠️ Service Worker debug helpers available:');
  logger.info('  - window.swDebug.unregister() - Unregister Service Worker');
  logger.info('  - window.swDebug.clearCaches() - Clear all caches');
}
