/**
 * 計算モジュール
 * Pattern calculation logic and results display
 */

import { calculatePattern } from '../calculator-multi-pattern.js';
import { toFixed, calcYield } from '../calculation.js';

// 定数
const CSS_HIDDEN = 'is-hidden';

// DOM要素参照（core.jsから設定される）
let elements = {};

// 現在のモード参照（core.jsから設定される）
let getCurrentYieldMethod = null;

// パターン取得関数（patterns.jsから設定される）
let getPatternsFunc = null;

/**
 * DOM要素参照を設定
 * @param {Object} elementsRef - DOM要素の参照
 */
export function setElements(elementsRef) {
  elements = elementsRef;
}

/**
 * 現在のモード取得関数を設定
 * @param {Function} func - 現在のモードを取得する関数
 */
export function setGetCurrentYieldMethod(func) {
  getCurrentYieldMethod = func;
}

/**
 * パターン取得関数を設定
 * @param {Function} func - パターンを取得する関数
 */
export function setGetPatternsFunc(func) {
  getPatternsFunc = func;
}

/**
 * 要素から数値を取得
 * @param {HTMLElement} element - HTML要素
 * @returns {number|null} 数値またはnull
 */
function getNumValue(element) {
  if (!element) {return null;}
  const v = parseFloat(element.value);
  return Number.isFinite(v) ? v : null;
}

/**
 * 全パターンを再計算
 */
export function recalculateAll() {
  // 現在のモードに応じて歩留まり率と加工前重量を取得
  let yr, bw;

  const currentYieldMethod = getCurrentYieldMethod ? getCurrentYieldMethod() : 'calculate';

  if (currentYieldMethod === 'calculate') {
    const beforeWeight = getNumValue(elements.beforeWeightCalc);
    const afterWeight = getNumValue(elements.afterWeightCalc);

    if (!Number.isFinite(beforeWeight) || !Number.isFinite(afterWeight) || beforeWeight <= 0 || afterWeight <= 0) {
      elements.step2Result.classList.add(CSS_HIDDEN);
      return;
    }

    yr = calcYield(beforeWeight, afterWeight);
    bw = beforeWeight;
  } else {
    yr = getNumValue(elements.yieldRateDirect);
    bw = getNumValue(elements.beforeWeightDirect);
  }

  if (!Number.isFinite(yr) || !Number.isFinite(bw) || yr <= 0 || bw <= 0) {
    elements.step2Result.classList.add(CSS_HIDDEN);
    return;
  }

  // パターンを取得
  const patterns = getPatternsFunc ? getPatternsFunc() : [];

  // 有効なパターンのみ計算
  const validPatterns = patterns.filter(p =>
    Number.isFinite(p.unitCost) && p.unitCost > 0 &&
    Number.isFinite(p.unitPrice) && p.unitPrice > 0 &&
    Number.isFinite(p.afterPrice100) && p.afterPrice100 > 0
  );

  if (validPatterns.length === 0) {
    elements.step2Result.classList.add(CSS_HIDDEN);
    return;
  }

  // 売価基準で降順にソート（金額の高い順）
  validPatterns.sort((a, b) => b.unitPrice - a.unitPrice);

  // 結果テーブルをクリア
  elements.resultsTableBody.innerHTML = '';

  // Document Fragment を使用してDOM操作を最適化（リフロー削減）
  const fragment = document.createDocumentFragment();

  // 各パターンを計算して表示
  validPatterns.forEach(pattern => {
    const result = calculatePattern({
      yieldRate: yr,
      beforeWeight: bw,
      unitCost: pattern.unitCost,
      unitPrice: pattern.unitPrice,
      afterPrice100: pattern.afterPrice100
    });

    if (result) {
      const row = document.createElement('tr');

      // 各指標の増減を計算
      const costChange = result.afterCost100 - result.beforeCost100;
      const priceChange = result.afterPrice100 - result.beforePrice100;
      const markupChange = result.afterMarkup - result.beforeMarkup;

      // 増減の表示クラスを決定
      const getCostChangeClass = (val) => {
        if (val > 0) {return 'result-negative';} // 原価増加は赤
        if (val < 0) {return 'result-positive';} // 原価減少は緑
        return 'result-neutral';
      };

      const getPriceChangeClass = (val) => {
        if (val > 0) {return 'result-positive';} // 売価増加は緑
        if (val < 0) {return 'result-negative';} // 売価減少は赤
        return 'result-neutral';
      };

      const getMarkupChangeClass = (val) => {
        if (val > 0) {return 'result-positive';} // 値入率増加は緑
        if (val < 0) {return 'result-negative';} // 値入率減少は赤
        return 'result-neutral';
      };

      // 1個差額の表示クラス
      let priceDiffClass = 'result-value';
      if (result.priceDiff > 0) {
        priceDiffClass = 'result-positive';
      } else if (result.priceDiff < 0) {
        priceDiffClass = 'result-negative';
      }

      // 感度の表示クラス
      let sensitivityClass = 'result-value';
      let sensitivitySign = '';
      if (result.sensitivity !== null && Number.isFinite(result.sensitivity)) {
        if (result.sensitivity > 0) {
          sensitivityClass = 'result-positive';
          sensitivitySign = '+';
        } else if (result.sensitivity < 0) {
          sensitivityClass = 'result-negative';
        }
      }

      // 符号付きフォーマット関数
      const formatChange = (val, decimals = 2) => {
        if (!Number.isFinite(val)) {return '-';}
        return (val >= 0 ? '+' : '') + toFixed(val, decimals);
      };

      row.innerHTML = `
        <td class="result-number">${pattern.id}</td>
        <td class="result-before">${toFixed(result.beforeCost100, 2)}</td>
        <td class="result-after">${toFixed(result.afterCost100, 2)}</td>
        <td class="${getCostChangeClass(costChange)}">${formatChange(costChange)}</td>
        <td class="result-before">${toFixed(result.beforePrice100, 2)}</td>
        <td class="result-after">${toFixed(result.afterPrice100, 2)}</td>
        <td class="${getPriceChangeClass(priceChange)}">${formatChange(priceChange)}</td>
        <td class="result-before">${toFixed(result.beforeMarkup, 2)}%</td>
        <td class="result-after result-highlight">${toFixed(result.afterMarkup, 2)}%</td>
        <td class="${getMarkupChangeClass(markupChange)}">${formatChange(markupChange)}%</td>
        <td class="result-value">${toFixed(result.finishedPrice, 2)}</td>
        <td class="${priceDiffClass}">${result.priceDiff >= 0 ? '+' : ''}${toFixed(result.priceDiff, 2)}</td>
        <td class="${sensitivityClass}">${result.sensitivity !== null ? sensitivitySign + toFixed(result.sensitivity, 3) : '-'}</td>
      `;

      fragment.appendChild(row);
    }
  });

  // 一括でDOM に追加（1回のリフロー）
  elements.resultsTableBody.appendChild(fragment);

  // 結果を表示
  elements.step2Result.classList.remove(CSS_HIDDEN);
}
