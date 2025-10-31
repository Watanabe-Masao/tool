/**
 * 複数パターン分析の計算ロジック
 *
 * 用途: 歩留まり率と加工前重量を固定し、
 *       複数の原価・売価パターンで値入率等を比較分析
 */

import {
  per100FromPerUnit,
  afterCostPer100,
  markup,
  finishedPriceFromAp,
  isPositive
} from './calculation.js';
import { PERCENT_MULTIPLIER } from './constants.js';

/**
 * 単一パターンの計算を実行
 * @param {Object} params - 計算パラメータ
 * @param {number} params.yieldRate - 歩留まり率（%）
 * @param {number} params.beforeWeight - 加工前重量（g）
 * @param {number} params.unitCost - 1個あたりの原価（円）
 * @param {number} params.unitPrice - 1個あたりの売価（円）
 * @param {number} params.afterPrice100 - 加工後設定売価（100gあたり）（円）
 * @returns {Object|null} 計算結果またはnull
 */
export function calculatePattern(params) {
  const { yieldRate, beforeWeight, unitCost, unitPrice, afterPrice100 } = params;

  // 必須フィールドチェック
  if (!isPositive(yieldRate) || !isPositive(beforeWeight) ||
      !isPositive(unitCost) || !isPositive(unitPrice) || !isPositive(afterPrice100)) {
    return null;
  }

  // 加工前の100gあたり原価・売価を計算
  const beforeCost100 = per100FromPerUnit(unitCost, beforeWeight);
  const beforePrice100 = per100FromPerUnit(unitPrice, beforeWeight);

  if (!beforeCost100 || !beforePrice100) {
    return null;
  }

  // 加工後の100gあたり原価を計算
  const afterCost100 = afterCostPer100(beforeCost100, yieldRate);

  if (!afterCost100) {
    return null;
  }

  // 値入率を計算
  const beforeMarkup = markup(beforeCost100, beforePrice100);
  const afterMarkup = markup(afterCost100, afterPrice100);

  // 加工後重量を計算
  const afterWeight = beforeWeight * (yieldRate / PERCENT_MULTIPLIER);

  // 仕上がり売価を計算
  const finishedPrice = finishedPriceFromAp(afterPrice100, afterWeight);

  // 売価差額を計算
  const priceDiff = Number.isFinite(finishedPrice) ? finishedPrice - unitPrice : null;

  // 感度分析: 歩留まり率が1%変動した場合の値入率への影響
  // 歩留まり率を+1%した場合の加工後値入率を計算
  const yieldRatePlus1 = yieldRate + 1;
  const afterCost100Plus1 = afterCostPer100(beforeCost100, yieldRatePlus1);
  const afterMarkupPlus1 = afterCost100Plus1 ? markup(afterCost100Plus1, afterPrice100) : null;

  // 感度 = (歩留まり率+1%の値入率) - (現在の値入率)
  const sensitivity = (Number.isFinite(afterMarkupPlus1) && Number.isFinite(afterMarkup))
    ? afterMarkupPlus1 - afterMarkup
    : null;

  return {
    beforeCost100,      // 加工前100g原価
    beforePrice100,     // 加工前100g売価
    beforeMarkup,       // 加工前値入率
    afterCost100,       // 加工後100g原価
    afterPrice100,      // 加工後100g売価（入力値そのまま）
    afterMarkup,        // 加工後値入率
    afterWeight,        // 加工後重量
    finishedPrice,      // 仕上がり売価
    priceDiff,          // 売価差額
    sensitivity         // 感度分析（歩留まり1%変動時の値入率変動）
  };
}

/**
 * 複数パターンの計算を一括実行
 * @param {number} yieldRate - 歩留まり率（%）
 * @param {number} beforeWeight - 加工前重量（g）
 * @param {Array<Object>} patterns - パターン配列
 * @returns {Array<Object>} 計算結果の配列
 */
export function calculateMultiplePatterns(yieldRate, beforeWeight, patterns) {
  if (!isPositive(yieldRate) || !isPositive(beforeWeight)) {
    return [];
  }

  return patterns.map(pattern => {
    const result = calculatePattern({
      yieldRate,
      beforeWeight,
      unitCost: pattern.unitCost,
      unitPrice: pattern.unitPrice,
      afterPrice100: pattern.afterPrice100
    });

    return {
      ...pattern,
      result
    };
  });
}
