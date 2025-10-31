/**
 * デバウンス関数
 * 頻繁に発生するイベントを制限し、最後のイベントから一定時間経過後に1回だけ実行する
 */

import { TIME } from './constants.js';

/**
 * デバウンス関数
 * @param {Function} func - 実行する関数
 * @param {number} delay - 遅延時間（ミリ秒）デフォルト300ms
 * @returns {Function} デバウンスされた関数
 */
export function debounce(func, delay = TIME.DEBOUNCE_DELAY) {
  let timeoutId = null;

  return function debounced(...args) {
    // 既存のタイマーをクリア
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // 新しいタイマーを設定
    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * 先頭実行型デバウンス（最初の呼び出しは即座に実行、その後は遅延）
 * @param {Function} func - 実行する関数
 * @param {number} delay - 遅延時間（ミリ秒）
 * @returns {Function} デバウンスされた関数
 */
export function debounceLeading(func, delay = TIME.DEBOUNCE_DELAY) {
  let timeoutId = null;
  let lastRan = 0;

  return function debounced(...args) {
    const now = Date.now();

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    // 初回または前回実行から十分時間が経過していれば即座に実行
    if (now - lastRan >= delay) {
      func.apply(this, args);
      lastRan = now;
    } else {
      // それ以外は遅延実行
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastRan = Date.now();
        timeoutId = null;
      }, delay);
    }
  };
}

/**
 * スロットル関数（一定時間内に最大1回だけ実行）
 * デバウンスと異なり、一定間隔で確実に実行される
 * @param {Function} func - 実行する関数
 * @param {number} limit - 実行間隔（ミリ秒）
 * @returns {Function} スロットルされた関数
 */
export function throttle(func, limit = TIME.DEBOUNCE_DELAY) {
  let inThrottle = false;
  let lastResult;

  return function throttled(...args) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }

    return lastResult;
  };
}
