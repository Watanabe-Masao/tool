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
 * 3つの方法で歩留まり率を計算
 * @param {Array<{beforeWeight: number, afterWeight: number}>} data - データ配列
 * @returns {{simple: number, total: number, weighted: number}} 計算結果
 */
export function calculateYieldRateByMethod(data) {
  if (!data || data.length === 0) {
    return { simple: null, total: null, weighted: null };
  }

  // 1. 単純平均（歩留まり率の平均値）
  // 式：(1/n) × Σ(加工後重量i / 加工前重量i × 100)
  const yieldRates = data.map(d => calcYield(d.beforeWeight, d.afterWeight));
  const simple = yieldRates.reduce((sum, rate) => sum + rate, 0) / yieldRates.length;

  // 2. 総合効率（平均値から求めた歩留まり率）
  // 式：Σ加工後重量 / Σ加工前重量 × 100
  const totalAfter = data.reduce((sum, d) => sum + d.afterWeight, 0);
  const totalBefore = data.reduce((sum, d) => sum + d.beforeWeight, 0);
  const total = (totalAfter / totalBefore) * 100;

  // 3. 加重平均歩留まり率
  // 式：Σ(加工前重量i × 歩留まり率i) / Σ加工前重量i
  const weightedSum = data.reduce((sum, d, i) => sum + (d.beforeWeight * yieldRates[i]), 0);
  const weighted = weightedSum / totalBefore;

  return { simple, total, weighted };
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
