/**
 * 歩留まり率統計モードの計算ロジック
 */

import { calcYield } from './calculation.js';

/**
 * 歩留まり率を計算
 * @param {number} beforeWeight - 加工前重量（g）
 * @param {number} afterWeight - 加工後重量（g）
 * @returns {number|null} 歩留まり率（%）、計算できない場合はnull
 */
export function calculateYieldRate(beforeWeight, afterWeight) {
  if (!beforeWeight || !afterWeight || beforeWeight <= 0 || afterWeight <= 0) {
    return null;
  }

  return calcYield(beforeWeight, afterWeight);
}

/**
 * 歩留まり率エントリのデータを検証
 * @param {Object} entry - エントリデータ
 * @param {string} entry.productName - 品名
 * @param {number} entry.beforeWeight - 加工前重量
 * @param {number} entry.afterWeight - 加工後重量
 * @returns {boolean} 有効なエントリかどうか
 */
export function validateEntry(entry) {
  return (
    entry.productName &&
    entry.productName.trim() !== '' &&
    entry.beforeWeight > 0 &&
    entry.afterWeight > 0
  );
}
