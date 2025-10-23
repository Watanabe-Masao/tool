/**
 * 商品化シミュレーション
 */

import { num, qs } from './dom-utils.js';
import { UI_ELEMENTS, GRAMS_PER_100G, PERCENT_MULTIPLIER } from './constants.js';
import { displayProductSimulation, hideProductSimulation, displayDiscountGross, hideDiscountResults } from './display.js';

/**
 * 商品化原価・売価・値入率を計算
 */
export function calculateProductSimulation(snapshot) {
  const weight = num(UI_ELEMENTS.EXP_WEIGHT);
  const consumableCost = num(UI_ELEMENTS.CONSUMABLE) ?? 0;

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
 * 値引き後粗利率を更新
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
 * 逆算シミュレーション: 目標値入率から必要な消耗品費（1個あたりの原価）を計算
 * @param {number} afterCost - 加工後100gあたり原価
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @returns {number|null} 必要な消耗品費
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
 * 逆算シミュレーション: 目標値入率から必要な加工後重量を計算
 * @param {number} beforeWeight - 加工前重量（g）
 * @param {number} afterCost - 加工後100gあたり原価
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費
 * @returns {number|null} 必要な加工後重量（g）
 */
export function calculateAfterWeightFromMarkup(beforeWeight, afterCost, afterPrice, weight, targetMarkup, consumable) {
  // afterCost は加工後100gあたりなので、まず加工前100gあたり原価を求める
  // yieldRate = afterWeight / beforeWeight * 100
  // afterCost = beforeCost / (yieldRate / 100) = beforeCost * 100 / yieldRate
  // beforeCost = afterCost * yieldRate / 100 = afterCost * (afterWeight / beforeWeight)
  //
  // cost = beforeCost * weight / 100 + consumable
  // cost = afterCost * (afterWeight / beforeWeight) * weight / 100 + consumable
  //
  // price = afterPrice * weight / 100
  // markup/100 = (price - cost) / price
  // cost = price * (1 - markup/100)
  // afterCost * (afterWeight / beforeWeight) * weight / 100 + consumable = afterPrice * weight / 100 * (1 - markup/100)
  // afterCost * (afterWeight / beforeWeight) * weight / 100 = afterPrice * weight / 100 * (1 - markup/100) - consumable
  // afterWeight = beforeWeight * (afterPrice * weight / 100 * (1 - markup/100) - consumable) / (afterCost * weight / 100)
  // afterWeight = beforeWeight * (afterPrice * (1 - markup/100) - consumable * 100 / weight) / afterCost

  if (!Number.isFinite(beforeWeight) || !Number.isFinite(afterCost) || !Number.isFinite(afterPrice) ||
      !Number.isFinite(weight) || !Number.isFinite(targetMarkup) || !Number.isFinite(consumable) ||
      beforeWeight <= 0 || weight <= 0 || afterCost <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const numerator = afterPrice * (1 - markupRatio) - (consumable * GRAMS_PER_100G / weight);

  if (numerator <= 0) {
    return null;
  }

  const afterWeight = beforeWeight * numerator / afterCost;

  return afterWeight > 0 && afterWeight <= beforeWeight ? afterWeight : null;
}

/**
 * 逆算シミュレーション: 目標値入率から必要な歩留まり率を計算
 * @param {number} afterCost - 加工後100gあたり原価
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費
 * @returns {number|null} 必要な歩留まり率（%）
 */
export function calculateYieldRateFromMarkup(afterCost, afterPrice, weight, targetMarkup, consumable) {
  // yieldRate = yr とする
  // beforeCost = afterCost * (yr / 100)  (加工前100gあたり原価)
  // cost = beforeCost * weight / 100 + consumable = afterCost * (yr / 100) * weight / 100 + consumable
  // price = afterPrice * weight / 100
  // markup/100 = (price - cost) / price
  // cost = price * (1 - markup/100)
  // afterCost * yr / 100 * weight / 100 + consumable = afterPrice * weight / 100 * (1 - markup/100)
  // afterCost * yr * weight / 10000 = afterPrice * weight / 100 * (1 - markup/100) - consumable
  // yr = (afterPrice * weight / 100 * (1 - markup/100) - consumable) * 10000 / (afterCost * weight)
  // yr = ((afterPrice * (1 - markup/100) - consumable * 100 / weight) * 10000) / (afterCost * 100)
  // yr = (afterPrice * (1 - markup/100) - consumable * 100 / weight) * 100 / afterCost

  if (!Number.isFinite(afterCost) || !Number.isFinite(afterPrice) ||
      !Number.isFinite(weight) || !Number.isFinite(targetMarkup) || !Number.isFinite(consumable) ||
      weight <= 0 || afterCost <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const numerator = afterPrice * (1 - markupRatio) - (consumable * GRAMS_PER_100G / weight);

  if (numerator <= 0) {
    return null;
  }

  const yieldRate = (numerator / afterCost) * PERCENT_MULTIPLIER;

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
