/**
 * 定額売価→計量加工の計算ロジック
 */

import {
  calcYield,
  per100FromPerUnit,
  afterCostPer100,
  markup,
  finishedPriceFromAp
} from './calculation.js';
import { num } from './dom-utils.js';
import { FIXED_FIELDS, LABELS, PERCENT_MULTIPLIER } from './constants.js';

/**
 * 定額モード - 重量から計算
 */
function calculateFromWeight() {
  const fields = FIXED_FIELDS.CALCULATE;
  const uc = num(fields.UNIT_COST);
  const up = num(fields.UNIT_PRICE);
  const bw = num(fields.BEFORE_WEIGHT);
  const aw = num(fields.AFTER_WEIGHT);
  const ap = num(fields.AFTER_PRICE_100);

  // 必須フィールドチェック
  if ([uc, up, bw, aw, ap].some(v => !Number.isFinite(v))) {
    return null;
  }

  const yr = calcYield(bw, aw);
  const beforeCost100 = per100FromPerUnit(uc, bw);
  const beforePrice100 = per100FromPerUnit(up, bw);
  const afterCost100 = afterCostPer100(beforeCost100, yr);
  const beforeMarkup = markup(beforeCost100, beforePrice100);
  const afterMarkupV = markup(afterCost100, ap);

  const awCalc = bw * (yr / PERCENT_MULTIPLIER);
  const finishedPrice = finishedPriceFromAp(ap, awCalc);
  const priceDiff = Number.isFinite(finishedPrice) ? finishedPrice - up : null;

  return {
    yr,
    bc: beforeCost100,
    bp: beforePrice100,
    ac: afterCost100,
    ap,
    bm: beforeMarkup,
    am: afterMarkupV,
    finishedPrice,
    priceDiff,
    finishedLabel: LABELS.FINISHED_PRICE_FIXED
  };
}

/**
 * 定額モード - 歩留まり率を直接入力
 */
function calculateFromDirectYield() {
  const fields = FIXED_FIELDS.DIRECT;
  const uc = num(fields.UNIT_COST);
  const up = num(fields.UNIT_PRICE);
  const bw = num(fields.BEFORE_WEIGHT);
  const yr = num(fields.YIELD_RATE);
  const ap = num(fields.AFTER_PRICE_100);

  // 必須フィールドチェック
  if ([uc, up, bw, yr, ap].some(v => !Number.isFinite(v))) {
    return null;
  }

  const beforeCost100 = per100FromPerUnit(uc, bw);
  const beforePrice100 = per100FromPerUnit(up, bw);
  const afterCost100 = afterCostPer100(beforeCost100, yr);
  const beforeMarkup = markup(beforeCost100, beforePrice100);
  const afterMarkupV = markup(afterCost100, ap);

  const awCalc = bw * (yr / PERCENT_MULTIPLIER);
  const finishedPrice = finishedPriceFromAp(ap, awCalc);
  const priceDiff = Number.isFinite(finishedPrice) ? finishedPrice - up : null;

  return {
    yr,
    bc: beforeCost100,
    bp: beforePrice100,
    ac: afterCost100,
    ap,
    bm: beforeMarkup,
    am: afterMarkupV,
    finishedPrice,
    priceDiff,
    finishedLabel: LABELS.FINISHED_PRICE_FIXED
  };
}

/**
 * 定額モードの計算を実行
 * @param {string} method - 'calculate' or 'direct'
 * @returns {Object|null} 計算結果またはnull
 */
export function calculateFixed(method) {
  if (method === 'direct') {
    return calculateFromDirectYield();
  }
  return calculateFromWeight();
}
