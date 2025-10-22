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
