/**
 * Service Worker - 完全オフライン対応
 */

// バージョン更新時はここを変更（例: v1 → v2 → v3...）
// タイムスタンプを含めることで確実に更新を検出
const CACHE_VERSION = 3;
const CACHE_BUILD = '20250125-031'; // YYYYMMDD-XXX形式
const CACHE_NAME = `yield-calculator-v${CACHE_VERSION}-${CACHE_BUILD}`;

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

// フェッチ時: Network First戦略（常に最新を取得、オフライン時のみキャッシュ）
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // ネットワークから取得成功
        console.log('[Service Worker] Network success:', event.request.url);

        // レスポンスが有効か確認
        if (response && response.status === 200 && response.type !== 'error') {
          // レスポンスをクローンしてキャッシュに保存（オフライン時のバックアップ）
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      })
      .catch((error) => {
        // ネットワーク失敗時（オフライン）: キャッシュから取得
        console.log('[Service Worker] Network failed, using cache:', event.request.url);
        return caches.match(event.request)
          .then((cachedResponse) => {
            if (cachedResponse) {
              console.log('[Service Worker] Cache hit:', event.request.url);
              return cachedResponse;
            }
            console.error('[Service Worker] No cache available:', event.request.url);
            throw error;
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

  // バージョン情報の要求に応答
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({
      version: CACHE_VERSION,
      build: CACHE_BUILD,
      cacheName: CACHE_NAME
    });
  }
});
