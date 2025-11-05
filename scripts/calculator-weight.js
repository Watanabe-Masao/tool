/**
 * 計量売価→計量加工の計算ロジック
 */

import {
  calcYield,
  per100FromBox,
  afterCostPer100,
  markup,
  finishedPriceFromAp
} from './calculation.js';
import { num } from './dom-utils.js';
import { WEIGHT_FIELDS, LABELS, GRAMS_PER_KG, PERCENT_MULTIPLIER } from './constants.js';

/**
 * 計量モード - 重量から計算（純粋関数）
 * @param {number} bc - 箱コスト
 * @param {number} bp - 箱売価
 * @param {number} bwKg - 箱重量（kg）
 * @param {number} bs - 加工前サンプル重量
 * @param {number} aw - 加工後重量
 * @param {number} ap - 加工後100g単価
 * @returns {Object|null} 計算結果
 */
export function calculateFromWeightLogic(bc, bp, bwKg, bs, aw, ap) {
  // 必須フィールドチェック
  if ([bc, bp, bwKg, bs, aw, ap].some(v => !Number.isFinite(v))) {
    return null;
  }

  const yr = calcYield(bs, aw);
  const bcPer100 = per100FromBox(bc, bwKg);
  const bpPer100 = per100FromBox(bp, bwKg);
  const acPer100 = afterCostPer100(bcPer100, yr);
  const bm = markup(bcPer100, bpPer100);
  const am = markup(acPer100, ap);

  const finishedWeightG = (bwKg * GRAMS_PER_KG) * (yr / PERCENT_MULTIPLIER);
  const finishedPrice = finishedPriceFromAp(ap, finishedWeightG);
  const priceDiff = Number.isFinite(finishedPrice) ? finishedPrice - bp : null;

  return {
    yr,
    bc: bcPer100,
    bp: bpPer100,
    ac: acPer100,
    ap,
    bm,
    am,
    finishedPrice,
    priceDiff,
    finishedLabel: LABELS.FINISHED_PRICE_WEIGHT
  };
}

/**
 * 計量モード - 重量から計算（DOM統合）
 */
function calculateFromWeight() {
  const fields = WEIGHT_FIELDS.CALCULATE;
  const bc = num(fields.BOX_COST);
  const bp = num(fields.BOX_PRICE);
  const bwKg = num(fields.BOX_WEIGHT);
  const bs = num(fields.BEFORE_SAMPLE);
  const aw = num(fields.AFTER_WEIGHT);
  const ap = num(fields.AFTER_PRICE_100);

  return calculateFromWeightLogic(bc, bp, bwKg, bs, aw, ap);
}

/**
 * 計量モード - 歩留まり率を直接入力（純粋関数）
 * @param {number} bc - 箱コスト
 * @param {number} bp - 箱売価
 * @param {number} bwKg - 箱重量（kg）
 * @param {number} yr - 歩留まり率
 * @param {number} ap - 加工後100g単価
 * @returns {Object|null} 計算結果
 */
export function calculateFromDirectYieldLogic(bc, bp, bwKg, yr, ap) {
  // 必須フィールドチェック
  if ([bc, bp, bwKg, yr, ap].some(v => !Number.isFinite(v))) {
    return null;
  }

  const bcPer100 = per100FromBox(bc, bwKg);
  const bpPer100 = per100FromBox(bp, bwKg);
  const acPer100 = afterCostPer100(bcPer100, yr);
  const bm = markup(bcPer100, bpPer100);
  const am = markup(acPer100, ap);

  const finishedWeightG = (bwKg * GRAMS_PER_KG) * (yr / PERCENT_MULTIPLIER);
  const finishedPrice = finishedPriceFromAp(ap, finishedWeightG);
  const priceDiff = Number.isFinite(finishedPrice) ? finishedPrice - bp : null;

  return {
    yr,
    bc: bcPer100,
    bp: bpPer100,
    ac: acPer100,
    ap,
    bm,
    am,
    finishedPrice,
    priceDiff,
    finishedLabel: LABELS.FINISHED_PRICE_WEIGHT
  };
}

/**
 * 計量モード - 歩留まり率を直接入力（DOM統合）
 */
function calculateFromDirectYield() {
  const fields = WEIGHT_FIELDS.DIRECT;
  const bc = num(fields.BOX_COST);
  const bp = num(fields.BOX_PRICE);
  const bwKg = num(fields.BOX_WEIGHT);
  const yr = num(fields.YIELD_RATE);
  const ap = num(fields.AFTER_PRICE_100);

  return calculateFromDirectYieldLogic(bc, bp, bwKg, yr, ap);
}

/**
 * 計量モードの計算を実行（純粋関数）
 * @param {string} method - 'calculate' or 'direct'
 * @param {number} bc - 箱コスト
 * @param {number} bp - 箱売価
 * @param {number} bwKg - 箱重量（kg）
 * @param {number} bsOrYr - 加工前サンプル重量（calculate）または歩留まり率（direct）
 * @param {number} awOrAp - 加工後重量（calculate）または加工後100g単価（direct）
 * @param {number} ap - 加工後100g単価（calculateのみ）
 * @returns {Object|null} 計算結果またはnull
 */
export function calculateWeightByMethod(method, bc, bp, bwKg, bsOrYr, awOrAp, ap) {
  if (method === 'direct') {
    // direct: bsOrYr=歩留まり率, awOrAp=加工後100g単価
    return calculateFromDirectYieldLogic(bc, bp, bwKg, bsOrYr, awOrAp);
  }
  // calculate: bsOrYr=加工前サンプル, awOrAp=加工後重量, ap=加工後100g単価
  return calculateFromWeightLogic(bc, bp, bwKg, bsOrYr, awOrAp, ap);
}

/**
 * 計量モードの計算を実行（DOM統合）
 * @param {string} method - 'calculate' or 'direct'
 * @returns {Object|null} 計算結果またはnull
 */
export function calculateWeight(method) {
  if (method === 'direct') {
    return calculateFromDirectYield();
  }
  return calculateFromWeight();
}
