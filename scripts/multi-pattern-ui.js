/**
 * 複数パターン分析モードのUI制御
 */

import { calculatePattern } from './calculator-multi-pattern.js';
import { toFixed } from './calculation.js';
import { PERCENT_MULTIPLIER } from './constants.js';

// 状態管理
let patternIdCounter = 1;
const patterns = [];

// DOM要素（初期化時に取得）
let elements = {};

/**
 * 初期化
 */
export function initMultiPatternUI() {
  // DOM要素を取得
  elements = {
    // ステップ1
    yieldRate: document.getElementById('multiYieldRate'),
    beforeWeight: document.getElementById('multiBeforeWeight'),
    step1Result: document.getElementById('multiPatternStep1Result'),
    afterWeightDisplay: document.getElementById('multiAfterWeightDisplay'),

    // ステップ2
    step2: document.getElementById('multiPatternStep2'),
    tableBody: document.getElementById('multiPatternTableBody'),
    addPatternBtn: document.getElementById('addPatternBtn'),

    // 結果
    step2Result: document.getElementById('multiPatternStep2Result'),
    resultsTableBody: document.getElementById('multiPatternResultsTableBody'),

    // クリアボタン
    clearBtn: document.getElementById('multiPatternClearBtn')
  };

  // 要素が存在しない場合は初期化しない
  if (!elements.yieldRate || !elements.beforeWeight) {
    console.warn('[MultiPattern] Required elements not found');
    return;
  }

  // ステップ1の入力イベント
  elements.yieldRate.addEventListener('input', handleStep1Input);
  elements.beforeWeight.addEventListener('input', handleStep1Input);

  // パターン追加ボタン
  if (elements.addPatternBtn) {
    elements.addPatternBtn.addEventListener('click', addPattern);
  }

  // クリアボタン
  if (elements.clearBtn) {
    elements.clearBtn.addEventListener('click', clearAll);
  }

  // 初期パターンを3つ追加
  addPattern();
  addPattern();
  addPattern();
}

/**
 * 要素から数値を取得
 */
function getNumValue(element) {
  if (!element) return null;
  const v = parseFloat(element.value);
  return Number.isFinite(v) ? v : null;
}

/**
 * ステップ1の入力処理
 */
function handleStep1Input() {
  const yr = getNumValue(elements.yieldRate);
  const bw = getNumValue(elements.beforeWeight);

  if (!Number.isFinite(yr) || !Number.isFinite(bw) || yr <= 0 || bw <= 0) {
    elements.step1Result.classList.add('is-hidden');
    elements.step2.classList.add('is-hidden');
    elements.step2Result.classList.add('is-hidden');
    return;
  }

  // 加工後重量を計算して表示
  const afterWeight = bw * (yr / PERCENT_MULTIPLIER);
  elements.afterWeightDisplay.textContent = `${toFixed(afterWeight, 2)}g`;

  // ステップ1結果とステップ2を表示
  elements.step1Result.classList.remove('is-hidden');
  elements.step2.classList.remove('is-hidden');

  // パターンが入力されていれば計算を更新
  recalculateAll();
}

/**
 * パターンを追加
 */
function addPattern() {
  const patternId = patternIdCounter++;

  const row = document.createElement('tr');
  row.dataset.patternId = patternId;
  row.innerHTML = `
    <td class="pattern-number">${patternId}</td>
    <td><input type="number" class="pattern-unit-cost" step="0.01" inputmode="decimal" placeholder="150" /></td>
    <td><input type="number" class="pattern-unit-price" step="0.01" inputmode="decimal" placeholder="198" /></td>
    <td><input type="number" class="pattern-after-price" step="0.01" inputmode="decimal" placeholder="158" /></td>
    <td><button type="button" class="btn-remove" data-pattern-id="${patternId}">削除</button></td>
  `;

  elements.tableBody.appendChild(row);

  // パターンデータを追加
  patterns.push({
    id: patternId,
    unitCost: null,
    unitPrice: null,
    afterPrice100: null
  });

  // 入力イベントを設定
  const inputs = row.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', () => handlePatternInput(patternId));
  });

  // 削除ボタンのイベント
  const removeBtn = row.querySelector('.btn-remove');
  removeBtn.addEventListener('click', () => removePattern(patternId));
}

/**
 * パターンを削除
 */
function removePattern(patternId) {
  // 最低1つは残す
  if (patterns.length <= 1) {
    alert('最低1つのパターンが必要です。');
    return;
  }

  // DOM要素を削除
  const row = elements.tableBody.querySelector(`tr[data-pattern-id="${patternId}"]`);
  if (row) {
    row.remove();
  }

  // パターンデータを削除
  const index = patterns.findIndex(p => p.id === patternId);
  if (index !== -1) {
    patterns.splice(index, 1);
  }

  // 結果を再計算
  recalculateAll();
}

/**
 * パターンの入力処理
 */
function handlePatternInput(patternId) {
  const row = elements.tableBody.querySelector(`tr[data-pattern-id="${patternId}"]`);
  if (!row) return;

  const unitCost = getNumValue(row.querySelector('.pattern-unit-cost'));
  const unitPrice = getNumValue(row.querySelector('.pattern-unit-price'));
  const afterPrice100 = getNumValue(row.querySelector('.pattern-after-price'));

  // パターンデータを更新
  const pattern = patterns.find(p => p.id === patternId);
  if (pattern) {
    pattern.unitCost = unitCost;
    pattern.unitPrice = unitPrice;
    pattern.afterPrice100 = afterPrice100;
  }

  // 結果を再計算
  recalculateAll();
}

/**
 * 全パターンを再計算
 */
function recalculateAll() {
  const yr = getNumValue(elements.yieldRate);
  const bw = getNumValue(elements.beforeWeight);

  if (!Number.isFinite(yr) || !Number.isFinite(bw) || yr <= 0 || bw <= 0) {
    elements.step2Result.classList.add('is-hidden');
    return;
  }

  // 有効なパターンのみ計算
  const validPatterns = patterns.filter(p =>
    Number.isFinite(p.unitCost) && p.unitCost > 0 &&
    Number.isFinite(p.unitPrice) && p.unitPrice > 0 &&
    Number.isFinite(p.afterPrice100) && p.afterPrice100 > 0
  );

  if (validPatterns.length === 0) {
    elements.step2Result.classList.add('is-hidden');
    return;
  }

  // 結果テーブルをクリア
  elements.resultsTableBody.innerHTML = '';

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

      // 差額の表示クラス
      let priceDiffClass = 'result-value';
      if (result.priceDiff > 0) {
        priceDiffClass = 'result-positive';
      } else if (result.priceDiff < 0) {
        priceDiffClass = 'result-negative';
      }

      row.innerHTML = `
        <td class="result-number">${pattern.id}</td>
        <td class="result-value">${toFixed(result.beforeCost100, 2)}</td>
        <td class="result-value">${toFixed(result.beforePrice100, 2)}</td>
        <td class="result-value">${toFixed(result.beforeMarkup, 2)}%</td>
        <td class="result-value">${toFixed(result.afterCost100, 2)}</td>
        <td class="result-value">${toFixed(result.afterPrice100, 2)}</td>
        <td class="result-highlight">${toFixed(result.afterMarkup, 2)}%</td>
        <td class="result-value">${toFixed(result.finishedPrice, 2)}</td>
        <td class="${priceDiffClass}">${result.priceDiff >= 0 ? '+' : ''}${toFixed(result.priceDiff, 2)}</td>
      `;

      elements.resultsTableBody.appendChild(row);
    }
  });

  // 結果を表示
  elements.step2Result.classList.remove('is-hidden');
}

/**
 * すべてクリア
 */
function clearAll() {
  // 商品名をクリア
  const productNameEl = document.getElementById('multiPatternProductName');
  if (productNameEl) productNameEl.value = '';

  // 入力値をクリア
  if (elements.yieldRate) elements.yieldRate.value = '';
  if (elements.beforeWeight) elements.beforeWeight.value = '';

  // パターンテーブルをクリア
  if (elements.tableBody) elements.tableBody.innerHTML = '';
  patterns.length = 0;
  patternIdCounter = 1;

  // 結果を非表示
  if (elements.step1Result) elements.step1Result.classList.add('is-hidden');
  if (elements.step2) elements.step2.classList.add('is-hidden');
  if (elements.step2Result) elements.step2Result.classList.add('is-hidden');

  // 初期パターンを3つ追加
  addPattern();
  addPattern();
  addPattern();
}

/**
 * モード切替時の初期化
 */
export function resetMultiPatternUI() {
  clearAll();
}
