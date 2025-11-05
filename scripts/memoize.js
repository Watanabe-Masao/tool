/**
 * メモ化ユーティリティ
 * 計算結果をキャッシュして重複計算を避ける
 */

/**
 * LRUキャッシュを実装したメモ化関数
 * @param {Function} fn - メモ化する関数
 * @param {Object} options - オプション
 * @param {number} options.maxSize - キャッシュの最大サイズ（デフォルト: 100）
 * @param {Function} options.keyGenerator - キャッシュキー生成関数（デフォルト: JSON.stringify）
 * @returns {Function} メモ化された関数
 */
export function memoize(fn, options = {}) {
  const maxSize = options.maxSize || 100;
  const keyGenerator = options.keyGenerator || JSON.stringify;

  // LRUキャッシュ: Map は挿入順を保持する
  const cache = new Map();

  return function memoized(...args) {
    // キャッシュキーを生成
    const key = keyGenerator(args);

    // キャッシュヒット
    if (cache.has(key)) {
      // LRU: アクセスされたエントリを最後尾に移動
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    // キャッシュミス: 関数を実行
    const result = fn.apply(this, args);

    // キャッシュに追加
    cache.set(key, result);

    // LRU: キャッシュサイズが最大値を超えたら最古のエントリを削除
    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  };
}

/**
 * 配列専用の高速キャッシュキー生成関数
 * JSON.stringify() より高速
 * @param {Array} args - 引数配列
 * @returns {string} キャッシュキー
 */
export function arrayKeyGenerator(args) {
  // 引数が1つで配列の場合
  if (args.length === 1 && Array.isArray(args[0])) {
    const arr = args[0];
    // 配列の長さ + 最初の3要素 + 最後の3要素でキーを生成
    // これにより大きな配列でも高速にキーを生成できる
    if (arr.length <= 6) {
      return arr.join(',');
    }
    return `${arr.length}:${arr.slice(0, 3).join(',')}_${arr.slice(-3).join(',')}`;
  }

  // 複数引数の場合は JSON.stringify にフォールバック
  return JSON.stringify(args);
}

/**
 * キャッシュをクリアする機能付きメモ化関数
 * @param {Function} fn - メモ化する関数
 * @param {Object} options - オプション
 * @returns {Function} メモ化された関数（clearCacheメソッド付き）
 */
export function memoizeWithClear(fn, options = {}) {
  const maxSize = options.maxSize || 100;
  const keyGenerator = options.keyGenerator || JSON.stringify;
  const cache = new Map();

  function memoized(...args) {
    const key = keyGenerator(args);

    if (cache.has(key)) {
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const result = fn.apply(this, args);
    cache.set(key, result);

    if (cache.size > maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    return result;
  }

  // キャッシュクリア機能
  memoized.clearCache = () => {
    cache.clear();
  };

  // キャッシュサイズ取得
  memoized.getCacheSize = () => {
    return cache.size;
  };

  return memoized;
}

/**
 * オブジェクト引数用のキャッシュキー生成関数
 * @param {Array} args - 引数配列
 * @returns {string} キャッシュキー
 */
export function objectKeyGenerator(args) {
  if (args.length === 0) {
    return '';
  }

  // オブジェクトの特定のプロパティのみを使用してキーを生成
  if (args.length === 1 && typeof args[0] === 'object' && args[0] !== null) {
    const obj = args[0];
    // ソート済みのキー順でシリアライズ
    const keys = Object.keys(obj).sort();
    return keys.map(k => `${k}:${obj[k]}`).join('|');
  }

  return JSON.stringify(args);
}
