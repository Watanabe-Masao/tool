/**
 * Service Worker - 完全オフライン対応
 */

// バージョン管理: GitHub Actionsデプロイ時に自動的にタイムスタンプが注入されます
// ローカル開発時は 'dev' として動作します
const CACHE_VERSION = 32; // VersionError対策でキャッシュをクリア
const CACHE_BUILD = '__BUILD_TIMESTAMP__'; // デプロイ時に置換されます（例: 20250126-153045-a1b2c3d）
const CACHE_NAME = `yield-calculator-v${CACHE_VERSION}-${CACHE_BUILD}`;

const urlsToCache = [
  '/tool/',
  '/tool/index.html',
  '/tool/styles/main.css',
  '/tool/styles/history.css',
  '/tool/styles/firebase.css',
  '/tool/scripts/main.js',
  '/tool/scripts/constants.js',
  '/tool/scripts/state.js',
  '/tool/scripts/calculation.js',
  '/tool/scripts/calculator-fixed.js',
  '/tool/scripts/calculator-weight.js',
  '/tool/scripts/calculator-yield-stats.js',
  '/tool/scripts/input-handler.js',
  '/tool/scripts/display.js',
  '/tool/scripts/product-simulator.js',
  '/tool/scripts/dom-utils.js',
  '/tool/scripts/db.js',
  '/tool/scripts/storage.js',
  '/tool/scripts/history-ui.js',
  '/tool/scripts/firebase-config.js',
  '/tool/scripts/firebase-auth.js',
  '/tool/scripts/firebase-sync.js',
  '/tool/scripts/firebase-ui.js',
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
// Safari対応: 完全なエラーハンドリングとフォールバック
self.addEventListener('fetch', (event) => {
  // Firebase API や外部APIはキャッシュしない
  const url = new URL(event.request.url);
  const skipCacheDomains = [
    'googleapis.com',
    'firebaseio.com',
    'firebase.google.com',
    'identitytoolkit.googleapis.com',
    'firestore.googleapis.com',
    'securetoken.googleapis.com'
  ];

  const shouldSkipCache = skipCacheDomains.some(domain => url.hostname.includes(domain));

  // POSTリクエストはキャッシュしない（Cache APIはGETのみサポート）
  const isGetRequest = event.request.method === 'GET';

  // Safari対応: respondWith内で必ず有効なPromise<Response>を返す
  event.respondWith(
    (async () => {
      try {
        // ネットワークリクエストを試行
        const response = await fetch(event.request);

        // ネットワークから取得成功
        console.log('[Service Worker] Network success:', event.request.url);

        // レスポンスが有効か確認 & GETリクエスト & Firebase APIでない場合のみキャッシュ
        if (response && response.status === 200 && response.type !== 'error' && isGetRequest && !shouldSkipCache) {
          // Safari対応: キャッシュ操作を非同期で実行し、エラーを無視
          try {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              return cache.put(event.request, responseToCache);
            }).catch((cacheError) => {
              console.warn('[Service Worker] Cache put failed:', cacheError);
            });
          } catch (cloneError) {
            console.warn('[Service Worker] Response clone failed:', cloneError);
          }
        }

        return response;
      } catch (networkError) {
        // ネットワーク失敗時（オフライン）: キャッシュから取得
        console.log('[Service Worker] Network failed, using cache:', event.request.url);

        try {
          const cachedResponse = await caches.match(event.request);

          if (cachedResponse) {
            console.log('[Service Worker] Cache hit:', event.request.url);
            return cachedResponse;
          }

          // キャッシュにもない場合
          console.warn('[Service Worker] No cache available:', event.request.url);

          // Safari対応: ナビゲーションリクエストの場合はindex.htmlを返す
          if (event.request.mode === 'navigate') {
            const fallbackResponse = await caches.match('/tool/index.html');
            if (fallbackResponse) {
              return fallbackResponse;
            }
          }

          // 最終フォールバック: 503エラーレスポンスを返す（Safari対応）
          return new Response('Service Unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        } catch (cacheError) {
          console.error('[Service Worker] Cache operation failed:', cacheError);

          // Safari対応: キャッシュ操作に失敗しても必ずレスポンスを返す
          return new Response('Cache Error', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
              'Content-Type': 'text/plain'
            })
          });
        }
      }
    })()
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
