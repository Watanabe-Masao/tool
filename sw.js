/**
 * Service Worker - 完全オフライン対応
 */

const CACHE_NAME = 'yield-calculator-v1';
const urlsToCache = [
  '/tool/',
  '/tool/index.html',
  '/tool/styles/main.css',
  '/tool/styles/history.css',
  '/tool/scripts/main.js',
  '/tool/scripts/constants.js',
  '/tool/scripts/state.js',
  '/tool/scripts/calculation.js',
  '/tool/scripts/calculator-fixed.js',
  '/tool/scripts/calculator-weight.js',
  '/tool/scripts/input-handler.js',
  '/tool/scripts/display.js',
  '/tool/scripts/product-simulator.js',
  '/tool/scripts/dom-utils.js',
  '/tool/scripts/db.js',
  '/tool/scripts/storage.js',
  '/tool/scripts/history-ui.js',
  '/tool/manifest.json',
  '/tool/icons/icon-192.png',
  '/tool/icons/icon-512.png'
];

// インストール時: キャッシュを作成
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .catch((error) => {
        console.error('[Service Worker] Cache failed:', error);
      })
  );

  // 新しいService Workerをすぐにアクティブ化
  self.skipWaiting();
});

// アクティブ化時: 古いキャッシュを削除
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );

  // すべてのクライアントを即座に制御
  return self.clients.claim();
});

// フェッチ時: Cache First戦略（高速表示）
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュに存在する場合は即座に返す
        if (response) {
          console.log('[Service Worker] Cache hit:', event.request.url);
          return response;
        }

        // キャッシュになければネットワークから取得
        console.log('[Service Worker] Network request:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // レスポンスが有効か確認
            if (!response || response.status !== 200 || response.type === 'error') {
              return response;
            }

            // レスポンスをクローンしてキャッシュに保存
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch failed:', error);
            // オフライン時のフォールバック処理
            // 必要に応じてオフライン用のページを返す
          });
      })
  );
});

// メッセージ受信: キャッシュの手動更新
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_UPDATE') {
    event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.addAll(urlsToCache);
      })
    );
  }
});
