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
 * 逆算シミュレーション: 目標値入率から必要な100gあたり原価を計算
 * @param {number} afterPrice - 加工後100gあたり売価
 * @param {number} weight - 1パックあたりの重量（g）
 * @param {number} targetMarkup - 目標値入率（%）
 * @param {number} consumable - 消耗品費
 * @returns {number|null} 必要な100gあたり原価
 */
export function calculateCostFromMarkup(afterPrice, weight, targetMarkup, consumable) {
  // cost = price * (1 - markup/100)
  // afterCost * weight / 100 + consumable = (afterPrice * weight / 100) * (1 - markup/100)
  // afterCost * weight / 100 = afterPrice * weight / 100 * (1 - markup/100) - consumable
  // afterCost = afterPrice * (1 - markup/100) - consumable * 100 / weight

  if (!Number.isFinite(afterPrice) || !Number.isFinite(weight) ||
      !Number.isFinite(targetMarkup) || !Number.isFinite(consumable) || weight <= 0) {
    return null;
  }

  const markupRatio = targetMarkup / PERCENT_MULTIPLIER;
  const afterCost = afterPrice * (1 - markupRatio) - (consumable * GRAMS_PER_100G / weight);

  return afterCost > 0 ? afterCost : null;
}
