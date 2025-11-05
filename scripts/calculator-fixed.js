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
 * 定額モード - 重量から計算（純粋関数）
 * @param {number} uc - 単価コスト
 * @param {number} up - 単価売価
 * @param {number} bw - 加工前重量
 * @param {number} aw - 加工後重量
 * @param {number} ap - 加工後100g単価
 * @returns {Object|null} 計算結果
 */
export function calculateFromWeightLogic(uc, up, bw, aw, ap) {
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
 * 定額モード - 重量から計算（DOM統合）
 */
function calculateFromWeight() {
  const fields = FIXED_FIELDS.CALCULATE;
  const uc = num(fields.UNIT_COST);
  const up = num(fields.UNIT_PRICE);
  const bw = num(fields.BEFORE_WEIGHT);
  const aw = num(fields.AFTER_WEIGHT);
  const ap = num(fields.AFTER_PRICE_100);

  return calculateFromWeightLogic(uc, up, bw, aw, ap);
}

/**
 * 定額モード - 歩留まり率を直接入力（純粋関数）
 * @param {number} uc - 単価コスト
 * @param {number} up - 単価売価
 * @param {number} bw - 加工前重量
 * @param {number} yr - 歩留まり率
 * @param {number} ap - 加工後100g単価
 * @returns {Object|null} 計算結果
 */
export function calculateFromDirectYieldLogic(uc, up, bw, yr, ap) {
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
 * 定額モード - 歩留まり率を直接入力（DOM統合）
 */
function calculateFromDirectYield() {
  const fields = FIXED_FIELDS.DIRECT;
  const uc = num(fields.UNIT_COST);
  const up = num(fields.UNIT_PRICE);
  const bw = num(fields.BEFORE_WEIGHT);
  const yr = num(fields.YIELD_RATE);
  const ap = num(fields.AFTER_PRICE_100);

  return calculateFromDirectYieldLogic(uc, up, bw, yr, ap);
}

/**
 * 定額モードの計算を実行（純粋関数）
 * @param {string} method - 'calculate' or 'direct'
 * @param {number} uc - 単価コスト
 * @param {number} up - 単価売価
 * @param {number} bw - 加工前重量
 * @param {number} awOrYr - 加工後重量（calculate）または歩留まり率（direct）
 * @param {number} ap - 加工後100g単価
 * @returns {Object|null} 計算結果またはnull
 */
export function calculateFixedLogic(method, uc, up, bw, awOrYr, ap) {
  if (method === 'direct') {
    return calculateFromDirectYieldLogic(uc, up, bw, awOrYr, ap);
  }
  return calculateFromWeightLogic(uc, up, bw, awOrYr, ap);
}

/**
 * 定額モードの計算を実行（DOM統合）
 * @param {string} method - 'calculate' or 'direct'
 * @returns {Object|null} 計算結果またはnull
 */
export function calculateFixed(method) {
  const fields = method === 'direct' ? FIXED_FIELDS.DIRECT : FIXED_FIELDS.CALCULATE;
  const uc = num(fields.UNIT_COST);
  const up = num(fields.UNIT_PRICE);
  const bw = num(fields.BEFORE_WEIGHT);
  const awOrYr = num(method === 'direct' ? fields.YIELD_RATE : fields.AFTER_WEIGHT);
  const ap = num(fields.AFTER_PRICE_100);

  return calculateFixedLogic(method, uc, up, bw, awOrYr, ap);
}
