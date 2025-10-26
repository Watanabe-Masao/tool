/**
 * 商品化シミュレーション
 */

import { num, qs } from './dom-utils.js';
import { UI_ELEMENTS, GRAMS_PER_100G, PERCENT_MULTIPLIER, TOLERANCE } from './constants.js';
import { displayProductSimulation, hideProductSimulation, displayDiscountGross, hideDiscountResults } from './display.js';

/**
 * 商品化原価・売価・値入率を計算
 */
export function calculateProductSimulation(snapshot) {
  const weight = num(UI_ELEMENTS.EXP_WEIGHT);
  const c = num(UI_ELEMENTS.CONSUMABLE) ?? 0;
  const consumableCost = Math.max(0, c);

  // 入力が不正、またはsnapshotが不正な場合
  if (
    !Number.isFinite(weight) ||
    weight <= 0 ||
    !Number.isFinite(snapshot.afterCost) ||
    !Number.isFinite(snapshot.afterPrice)
  ) {
    hideProductSimulation();
    return null;
  }

  const cost = (snapshot.afterCost * weight / GRAMS_PER_100G) + consumableCost;
  const price = snapshot.afterPrice * weight / GRAMS_PER_100G;
  const markup = price > 0 ? ((price - cost) / price) * PERCENT_MULTIPLIER : 0;

  displayProductSimulation({ cost, price, markup });

  return { cost, price, markup };
}

/**
 * 値引後最終粗利率を更新
 */
export function updateDiscountSimulation(productData) {
  if (!productData || !Number.isFinite(productData.price) || !Number.isFinite(productData.markup)) {
    hideDiscountResults();
    return;
  }

  const discountRate = parseFloat(qs(`#${UI_ELEMENTS.DISC_INPUT}`).value) || 0;
  displayDiscountGross(discountRate, productData.markup);
}

/**
 * 逆算シミュレーション: 目標値入率から必要な重量を計算
 * @param {number} afterCost - 加工後100gあたり原価
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費
 * @returns {number|null} 必要な重量（g）
 */
export function calculateWeightFromMarkup(afterCost, afterPrice, targetMarkup, consumable) {
  // markup = ((price - cost) / price) * 100
  // cost = afterCost * weight / 100 + consumable
  // price = afterPrice * weight / 100
  //
  // markup/100 = (price - cost) / price
  // price * (markup/100) = price - cost
  // cost = price * (1 - markup/100)
  // afterCost * w / 100 + consumable = (afterPrice * w / 100) * (1 - markup/100)
  // afterCost * w / 100 + consumable = afterPrice * w / 100 * (1 - markup/100)
  // consumable = w / 100 * (afterPrice * (1 - markup/100) - afterCost)
  // w = consumable * 100 / (afterPrice * (1 - markup/100) - afterCost)

  if (!Number.isFinite(afterCost) || !Number.isFinite(afterPrice) ||
      !Number.isFinite(targetMarkup) || !Number.isFinite(consumable)) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const denominator = afterPrice * (1 - markupRatio) - afterCost;

  if (denominator <= 0) {
    return null; // 計算不可能（値入率が高すぎる、または原価が売価以上）
  }

  // 消耗品費が0の場合の特別処理
  if (consumable === 0) {
    // 重量に依存しないので、目標markupが達成可能かチェック
    const actualMarkup = ((afterPrice - afterCost) / afterPrice) * PERCENT_MULTIPLIER;
    // 目標markupと一致するかチェック
    if (Math.abs(actualMarkup - targetMarkup) < TOLERANCE.MARKUP) {
      // 一致する場合、任意の有効な重量を返す（100g）
      return 100;
    } else {
      // 一致しない場合、計算不可能
      return null;
    }
  }

  const weight = (consumable * GRAMS_PER_100G) / denominator;

  return weight > 0 ? weight : null;
}

/**
 * 逆算シミュレーション: 目標値入率から必要な100gあたり売価を計算
 * @param {number} afterCost - 加工後100gあたり原価
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費
 * @returns {number|null} 必要な100gあたり売価
 */
export function calculatePriceFromMarkup(afterCost, weight, targetMarkup, consumable) {
  // cost = afterCost * weight / 100 + consumable
  // price = afterPrice * weight / 100
  // markup/100 = (price - cost) / price
  // cost = price * (1 - markup/100)
  // afterCost * weight / 100 + consumable = (afterPrice * weight / 100) * (1 - markup/100)
  // afterPrice = (afterCost * weight / 100 + consumable) / (weight / 100 * (1 - markup/100))
  // afterPrice = (afterCost + consumable * 100 / weight) / (1 - markup/100)

  if (!Number.isFinite(afterCost) || !Number.isFinite(weight) ||
      !Number.isFinite(targetMarkup) || !Number.isFinite(consumable) || weight <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;

  if (markupRatio >= 1) {
    return null; // 値入率100%以上は計算不可能
  }

  const afterPrice = (afterCost + (consumable * GRAMS_PER_100G / weight)) / (1 - markupRatio);

  return afterPrice > 0 ? afterPrice : null;
}

/**
 * 逆算シミュレーション: 目標値入率から必要な消耗品費を計算
 * @param {number} afterCost - 加工後100gあたり原価
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @returns {number|null} 必要な消耗品費（円）
 */
export function calculateConsumableFromMarkup(afterCost, afterPrice, weight, targetMarkup) {
  // cost = afterCost * weight / 100 + consumable
  // price = afterPrice * weight / 100
  // markup/100 = (price - cost) / price
  // cost = price * (1 - markup/100)
  // afterCost * weight / 100 + consumable = afterPrice * weight / 100 * (1 - markup/100)
  // consumable = afterPrice * weight / 100 * (1 - markup/100) - afterCost * weight / 100
  // consumable = weight / 100 * (afterPrice * (1 - markup/100) - afterCost)

  if (!Number.isFinite(afterCost) || !Number.isFinite(afterPrice) ||
      !Number.isFinite(weight) || !Number.isFinite(targetMarkup) || weight <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const consumable = (weight / GRAMS_PER_100G) * (afterPrice * (1 - markupRatio) - afterCost);

  return consumable >= 0 ? consumable : null;
}

/**
 * 逆算シミュレーション: 目標値入率から必要な原価を計算（定額売価モード: 1個あたりの原価）
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} beforeWeight - 加工前重量（g）
 * @param {number} yieldRate - 歩留まり率（%）
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費（円）
 * @returns {number|null} 必要な1個あたりの原価（円）
 */
export function calculateUnitCostFromMarkup(afterPrice, beforeWeight, yieldRate, weight, targetMarkup, consumable) {
  // 1. 目標値入率から加工後100gあたり原価を逆算
  // finalCost = afterCost * weight / 100 + consumable
  // finalPrice = afterPrice * weight / 100
  // markup/100 = (finalPrice - finalCost) / finalPrice
  // finalCost = finalPrice * (1 - markup/100)
  // afterCost * weight / 100 + consumable = afterPrice * weight / 100 * (1 - markup/100)
  // afterCost = afterPrice * (1 - markup/100) - consumable * 100 / weight

  if (!Number.isFinite(afterPrice) || !Number.isFinite(beforeWeight) ||
      !Number.isFinite(yieldRate) || !Number.isFinite(weight) ||
      !Number.isFinite(targetMarkup) || !Number.isFinite(consumable) ||
      beforeWeight <= 0 || yieldRate <= 0 || weight <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const afterCost = afterPrice * (1 - markupRatio) - (consumable * GRAMS_PER_100G / weight);

  if (afterCost <= 0) {
    return null;
  }

  // 2. 加工前100gあたり原価を計算
  // afterCost = beforeCost / (yieldRate / 100)
  // beforeCost = afterCost * (yieldRate / 100)
  const beforeCost = afterCost * (yieldRate / PERCENT_MULTIPLIER);

  // 3. 1個あたりの原価を計算
  // beforeCost = unitCost / beforeWeight * 100
  // unitCost = beforeCost * beforeWeight / 100
  const unitCost = beforeCost * beforeWeight / GRAMS_PER_100G;

  return unitCost > 0 ? unitCost : null;
}

/**
 * 逆算シミュレーション: 目標値入率から必要な原価を計算（計量売価モード: 1箱あたりの原価）
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} boxWeight - 1箱あたりの重量（kg）
 * @param {number} yieldRate - 歩留まり率（%）
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費（円）
 * @returns {number|null} 必要な1箱あたりの原価（円）
 */
export function calculateBoxCostFromMarkup(afterPrice, boxWeight, yieldRate, weight, targetMarkup, consumable) {
  // 1. 目標値入率から加工後100gあたり原価を逆算
  if (!Number.isFinite(afterPrice) || !Number.isFinite(boxWeight) ||
      !Number.isFinite(yieldRate) || !Number.isFinite(weight) ||
      !Number.isFinite(targetMarkup) || !Number.isFinite(consumable) ||
      boxWeight <= 0 || yieldRate <= 0 || weight <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const afterCost = afterPrice * (1 - markupRatio) - (consumable * GRAMS_PER_100G / weight);

  if (afterCost <= 0) {
    return null;
  }

  // 2. 加工前100gあたり原価を計算
  const beforeCost = afterCost * (yieldRate / PERCENT_MULTIPLIER);

  // 3. 1箱あたりの原価を計算
  // beforeCost = boxCost / (boxWeight * 1000) * 100
  // beforeCost = boxCost / (boxWeight * 10)
  // boxCost = beforeCost * boxWeight * 10
  const boxCost = beforeCost * boxWeight * 10;

  return boxCost > 0 ? boxCost : null;
}

/**
 * 逆算シミュレーション: 目標値入率から必要な加工後重量を計算
 * @param {number} beforeWeight - 加工前重量（g）
 * @param {number} beforeCost - 加工前100gあたり原価
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費
 * @returns {number|null} 必要な加工後重量（g）
 */
export function calculateAfterWeightFromMarkup(beforeWeight, beforeCost, afterPrice, weight, targetMarkup, consumable) {
  // yieldRate = afterWeight / beforeWeight * 100
  // afterCost = beforeCost / (yieldRate / 100) = beforeCost * beforeWeight / afterWeight
  // finalCost = afterCost * weight / 100 + consumable = (beforeCost * beforeWeight / afterWeight) * weight / 100 + consumable
  // finalPrice = afterPrice * weight / 100
  // targetMarkup/100 = (finalPrice - finalCost) / finalPrice
  // finalCost = finalPrice * (1 - targetMarkup/100)
  // (beforeCost * beforeWeight / afterWeight) * weight / 100 + consumable = afterPrice * weight / 100 * (1 - targetMarkup/100)
  // beforeCost * beforeWeight * weight / (afterWeight * 100) = afterPrice * weight / 100 * (1 - targetMarkup/100) - consumable
  // beforeCost * beforeWeight * weight / afterWeight = afterPrice * weight * (1 - targetMarkup/100) - consumable * 100
  // afterWeight = beforeCost * beforeWeight * weight / (afterPrice * weight * (1 - targetMarkup/100) - consumable * 100)
  // afterWeight = beforeCost * beforeWeight / (afterPrice * (1 - targetMarkup/100) - consumable * 100 / weight)

  if (!Number.isFinite(beforeWeight) || !Number.isFinite(beforeCost) || !Number.isFinite(afterPrice) ||
      !Number.isFinite(weight) || !Number.isFinite(targetMarkup) || !Number.isFinite(consumable) ||
      beforeWeight <= 0 || weight <= 0 || beforeCost <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const denominator = afterPrice * (1 - markupRatio) - (consumable * GRAMS_PER_100G / weight);

  if (denominator <= 0) {
    return null;
  }

  const afterWeight = (beforeCost * beforeWeight) / denominator;

  return afterWeight > 0 && afterWeight <= beforeWeight ? afterWeight : null;
}

/**
 * 逆算シミュレーション: 目標値入率から必要な歩留まり率を計算
 * @param {number} beforeCost - 加工前100gあたり原価
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費
 * @returns {number|null} 必要な歩留まり率（%）
 */
export function calculateYieldRateFromMarkup(beforeCost, afterPrice, weight, targetMarkup, consumable) {
  // yieldRate = yr とする
  // afterCost = beforeCost / (yr / 100)  (加工後100gあたり原価)
  // finalCost = afterCost * weight / 100 + consumable = (beforeCost / (yr / 100)) * weight / 100 + consumable
  // finalCost = beforeCost * (100 / yr) * weight / 100 + consumable
  // finalCost = beforeCost * weight / yr + consumable
  // finalPrice = afterPrice * weight / 100
  // markup/100 = (finalPrice - finalCost) / finalPrice
  // finalCost = finalPrice * (1 - markup/100)
  // beforeCost * weight / yr + consumable = afterPrice * weight / 100 * (1 - markup/100)
  // beforeCost * weight / yr = afterPrice * weight / 100 * (1 - markup/100) - consumable
  // yr = beforeCost * weight / (afterPrice * weight / 100 * (1 - markup/100) - consumable)
  // yr = beforeCost * 100 / (afterPrice * (1 - markup/100) - consumable * 100 / weight)

  if (!Number.isFinite(beforeCost) || !Number.isFinite(afterPrice) ||
      !Number.isFinite(weight) || !Number.isFinite(targetMarkup) || !Number.isFinite(consumable) ||
      weight <= 0 || beforeCost <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const denominator = afterPrice * (1 - markupRatio) - (consumable * GRAMS_PER_100G / weight);

  if (denominator <= 0) {
    return null;
  }

  const yieldRate = (beforeCost * PERCENT_MULTIPLIER) / denominator;

  return yieldRate > 0 && yieldRate <= 100 ? yieldRate : null;
}

/**
 * 逆算シミュレーション: 目標粗利率から必要な値引率を計算
 * @param {number} productMarkup - 商品化後の値入率（%）
 * @param {number} targetGross - 目標粗利率（%）
 * @returns {number|null} 必要な値引率（%）
 */
export function calculateDiscountRateFromGross(productMarkup, targetGross) {
  // productMarkup = 商品化後の値入率
  // targetGross = 目標粗利率
  // 粗利率 = 値入率 なので、目標粗利率 = 目標値入率
  //
  // 値引前の値入率 = productMarkup
  // 値引後の値入率 = targetGross
  //
  // cost = price * (1 - productMarkup/100)
  // 値引後の売価 = price * (1 - discountRate/100)
  // targetGross/100 = (値引後売価 - cost) / 値引後売価
  // targetGross/100 = (price * (1 - d) - cost) / (price * (1 - d))  where d = discountRate/100
  // targetGross/100 * price * (1 - d) = price * (1 - d) - cost
  // cost = price * (1 - d) * (1 - targetGross/100)
  //
  // cost = price * (1 - productMarkup/100) = price * (1 - d) * (1 - targetGross/100)
  // (1 - productMarkup/100) = (1 - d) * (1 - targetGross/100)
  // (1 - d) = (1 - productMarkup/100) / (1 - targetGross/100)
  // d = 1 - (1 - productMarkup/100) / (1 - targetGross/100)
  // discountRate = (1 - (1 - productMarkup/100) / (1 - targetGross/100)) * 100

  if (!Number.isFinite(productMarkup) || !Number.isFinite(targetGross)) {
    return null;
  }

  const productMarkupRatio = productMarkup / PERCENT_MULTIPLIER;
  const targetGrossRatio = targetGross / PERCENT_MULTIPLIER;

  if (targetGrossRatio >= 1) {
    return null; // 目標粗利率100%以上は不可能
  }

  const denominator = 1 - targetGrossRatio;

  if (denominator <= 0) {
    return null;
  }

  const discountRatio = 1 - (1 - productMarkupRatio) / denominator;
  const discountRate = discountRatio * PERCENT_MULTIPLIER;

  return discountRate >= 0 && discountRate <= 100 ? discountRate : null;
}
