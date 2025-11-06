/**
 * 遅延ロードユーティリティ
 * 外部ライブラリと内部モジュールを必要な時にのみロードしてパフォーマンスを向上
 */

import { logger } from './core/logger.js';

// ロード状態を管理（外部ライブラリ）
const loadStates = {
  echarts: { loaded: false, loading: false, promise: null }
};

// モジュールキャッシュ（内部モジュール）
const moduleCache = {
  yieldStats: null,
  multiPattern: null,
  firebaseSync: null
};

/**
 * EChartsを遅延ロード
 * @returns {Promise<Object>} EChartsインスタンス
 */
export async function loadECharts() {
  // すでにロード済みの場合
  if (typeof window.echarts !== 'undefined') {
    loadStates.echarts.loaded = true;
    return window.echarts;
  }

  // ロード中の場合は既存のPromiseを返す
  if (loadStates.echarts.loading) {
    return loadStates.echarts.promise;
  }

  // 新規ロード開始
  loadStates.echarts.loading = true;
  loadStates.echarts.promise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js';
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      loadStates.echarts.loaded = true;
      loadStates.echarts.loading = false;
      logger.info('ECharts loaded successfully');
      resolve(window.echarts);
    };

    script.onerror = () => {
      loadStates.echarts.loading = false;
      const error = new Error('Failed to load ECharts');
      logger.error('ECharts loading failed', error);
      reject(error);
    };

    document.head.appendChild(script);
  });

  return loadStates.echarts.promise;
}

/**
 * 外部スクリプトを動的にロード（汎用）
 * @param {string} url - スクリプトのURL
 * @param {Object} options - オプション
 * @param {string} options.globalName - グローバル変数名（存在チェック用）
 * @param {boolean} options.crossOrigin - crossOrigin属性
 * @returns {Promise<void>}
 */
export async function loadScript(url, options = {}) {
  const { globalName, crossOrigin = false } = options;

  // グローバル変数が既に存在する場合
  if (globalName && typeof window[globalName] !== 'undefined') {
    return window[globalName];
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = url;

    if (crossOrigin) {
      script.crossOrigin = 'anonymous';
    }

    script.onload = () => {
      logger.info(`Script loaded: ${url}`);
      resolve(globalName ? window[globalName] : undefined);
    };

    script.onerror = () => {
      const error = new Error(`Failed to load script: ${url}`);
      logger.error(error.message);
      reject(error);
    };

    document.head.appendChild(script);
  });
}

/**
 * Chart.jsを遅延ロード（将来的な使用のため）
 * @returns {Promise<Object>} Chart.jsインスタンス
 */
export async function loadChartJS() {
  return loadScript(
    'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js',
    { globalName: 'Chart', crossOrigin: true }
  );
}

/**
 * ロード済みかチェック
 * @param {string} libraryName - ライブラリ名（'echarts', など）
 * @returns {boolean}
 */
export function isLoaded(libraryName) {
  const state = loadStates[libraryName];
  return state ? state.loaded : false;
}

/**
 * 歩留まり統計モジュールを遅延ロード
 * @returns {Promise<Object>} モジュールエクスポート
 */
export async function loadYieldStatsModule() {
  if (moduleCache.yieldStats) {
    return moduleCache.yieldStats;
  }

  logger.info('[Lazy Load] Loading yield stats module...');
  const start = performance.now();

  try {
    const [display, calc, helpers, charts, table] = await Promise.all([
      import('./yield-stats-display.js'),
      import('./yield-stats-calc.js'),
      import('./yield-stats-helpers.js'),
      import('./yield-stats-charts.js'),
      import('./yield-stats-table.js')
    ]);

    moduleCache.yieldStats = {
      display,
      calc,
      helpers,
      charts,
      table
    };

    const duration = (performance.now() - start).toFixed(2);
    logger.info(`[Lazy Load] Yield stats module loaded in ${duration}ms`);

    return moduleCache.yieldStats;
  } catch (error) {
    logger.error('[Lazy Load] Failed to load yield stats module:', error);
    throw error;
  }
}

/**
 * 複数パターン分析モジュールを遅延ロード
 * @returns {Promise<Object>} モジュールエクスポート
 */
export async function loadMultiPatternModule() {
  if (moduleCache.multiPattern) {
    return moduleCache.multiPattern;
  }

  logger.info('[Lazy Load] Loading multi-pattern module...');
  const start = performance.now();

  try {
    const [ui, calc, presets, statsLoader] = await Promise.all([
      import('./multi-pattern-ui.js'),
      import('./calculator-multi-pattern.js'),
      import('./multi-pattern-presets.js'),
      import('./multi-pattern-stats-loader.js')
    ]);

    moduleCache.multiPattern = {
      ui,
      calc,
      presets,
      statsLoader
    };

    const duration = (performance.now() - start).toFixed(2);
    logger.info(`[Lazy Load] Multi-pattern module loaded in ${duration}ms`);

    return moduleCache.multiPattern;
  } catch (error) {
    logger.error('[Lazy Load] Failed to load multi-pattern module:', error);
    throw error;
  }
}

/**
 * Firebase同期モジュールを遅延ロード
 * @returns {Promise<Object>} モジュールエクスポート
 */
export async function loadFirebaseSyncModule() {
  if (moduleCache.firebaseSync) {
    return moduleCache.firebaseSync;
  }

  logger.info('[Lazy Load] Loading firebase sync module...');
  const start = performance.now();

  try {
    const firebaseSync = await import('./firebase-sync.js');

    moduleCache.firebaseSync = firebaseSync;

    const duration = (performance.now() - start).toFixed(2);
    logger.info(`[Lazy Load] Firebase sync module loaded in ${duration}ms`);

    return moduleCache.firebaseSync;
  } catch (error) {
    logger.error('[Lazy Load] Failed to load firebase sync module:', error);
    throw error;
  }
}

/**
 * モジュールがロード済みかチェック
 * @param {string} moduleName - モジュール名（'yieldStats', 'multiPattern', 'firebaseSync'）
 * @returns {boolean}
 */
export function isModuleLoaded(moduleName) {
  return moduleCache[moduleName] !== null;
}

/**
 * ローディング表示を追加/削除するヘルパー
 * @param {HTMLElement} container - ローディング表示を追加するコンテナ
 * @param {boolean} show - 表示/非表示
 */
export function toggleLoadingIndicator(container, show = true) {
  if (!container) return;

  const loadingId = 'lazy-loading-indicator';
  let indicator = container.querySelector(`#${loadingId}`);

  if (show && !indicator) {
    indicator = document.createElement('div');
    indicator.id = loadingId;
    indicator.className = 'loading-indicator';
    indicator.innerHTML = `
      <div class="spinner"></div>
      <p>読み込み中...</p>
    `;
    container.appendChild(indicator);

    // スタイルを追加（初回のみ）
    if (!document.getElementById('lazy-loading-styles')) {
      const style = document.createElement('style');
      style.id = 'lazy-loading-styles';
      style.textContent = `
        .loading-indicator {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
          color: #666;
        }
        .spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .loading-indicator p {
          margin-top: 16px;
          font-size: 14px;
        }
      `;
      document.head.appendChild(style);
    }
  } else if (!show && indicator) {
    indicator.remove();
  }
}
