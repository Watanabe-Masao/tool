/**
 * 複数パターン分析モードのUI制御
 */

import { calculatePattern } from './calculator-multi-pattern.js';
import { toFixed, calcYield } from './calculation.js';
import { PERCENT_MULTIPLIER } from './constants.js';

// 定数
const INITIAL_PATTERN_COUNT = 3;
const CSS_HIDDEN = 'is-hidden';

// 状態管理
let patternIdCounter = 1;
const patterns = [];
let currentYieldMethod = 'calculate'; // 'calculate' or 'direct'

// DOM要素（初期化時に取得）
let elements = {};

/**
 * 初期化
 */
export function initMultiPatternUI() {
  // DOM要素を取得
  elements = {
    // モード切り替え
    calculateMode: document.getElementById('multiPatternCalculateMode'),
    directMode: document.getElementById('multiPatternDirectMode'),

    // 重量から計算モード
    beforeWeightCalc: document.getElementById('multiBeforeWeightCalc'),
    afterWeightCalc: document.getElementById('multiAfterWeightCalc'),
    step1ResultCalc: document.getElementById('multiPatternStep1ResultCalc'),
    yieldRateDisplayCalc: document.getElementById('multiYieldRateDisplayCalc'),

    // 歩留まり率直接入力モード
    beforeWeightDirect: document.getElementById('multiBeforeWeightDirect'),
    yieldRateDirect: document.getElementById('multiYieldRateDirect'),
    step1ResultDirect: document.getElementById('multiPatternStep1ResultDirect'),
    yieldRateDisplayDirect: document.getElementById('multiYieldRateDisplayDirect'),
    afterWeightDisplayDirect: document.getElementById('multiAfterWeightDisplayDirect'),

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
  if (!elements.beforeWeightCalc || !elements.beforeWeightDirect) {
    console.warn('[MultiPattern] Required elements not found');
    return;
  }

  // モード切り替えラジオボタン
  const yieldMethodRadios = document.querySelectorAll('input[name="yieldMethodMultiPattern"]');
  yieldMethodRadios.forEach(radio => {
    radio.addEventListener('change', handleYieldMethodChange);
  });

  // 重量から計算モードの入力イベント
  elements.beforeWeightCalc.addEventListener('input', handleCalculateModeInput);
  elements.afterWeightCalc.addEventListener('input', handleCalculateModeInput);

  // 歩留まり率直接入力モードの入力イベント
  elements.beforeWeightDirect.addEventListener('input', handleDirectModeInput);
  elements.yieldRateDirect.addEventListener('input', handleDirectModeInput);

  // パターン追加ボタン
  if (elements.addPatternBtn) {
    elements.addPatternBtn.addEventListener('click', addPattern);
  }

  // クリアボタン
  if (elements.clearBtn) {
    elements.clearBtn.addEventListener('click', clearAll);
  }

  // 初期パターンを追加
  for (let i = 0; i < INITIAL_PATTERN_COUNT; i++) {
    addPattern();
  }
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
 * 歩留まり率入力方法の切り替え
 */
function handleYieldMethodChange(e) {
  currentYieldMethod = e.target.value;
  const isDirect = currentYieldMethod === 'direct';

  // モードの表示切り替え
  if (elements.calculateMode) elements.calculateMode.classList.toggle(CSS_HIDDEN, isDirect);
  if (elements.directMode) elements.directMode.classList.toggle(CSS_HIDDEN, !isDirect);

  // 結果を非表示
  if (elements.step2) elements.step2.classList.add(CSS_HIDDEN);
  if (elements.step2Result) elements.step2Result.classList.add(CSS_HIDDEN);
  if (elements.step1ResultCalc) elements.step1ResultCalc.classList.add(CSS_HIDDEN);
  if (elements.step1ResultDirect) elements.step1ResultDirect.classList.add(CSS_HIDDEN);
}

/**
 * 重量から計算モードの入力処理
 */
function handleCalculateModeInput() {
  const bw = getNumValue(elements.beforeWeightCalc);
  const aw = getNumValue(elements.afterWeightCalc);

  if (!Number.isFinite(bw) || !Number.isFinite(aw) || bw <= 0 || aw <= 0) {
    elements.step1ResultCalc.classList.add(CSS_HIDDEN);
    elements.step2.classList.add(CSS_HIDDEN);
    elements.step2Result.classList.add(CSS_HIDDEN);
    return;
  }

  // 歩留まり率を計算
  const yr = calcYield(bw, aw);
  if (!Number.isFinite(yr)) {
    elements.step1ResultCalc.classList.add(CSS_HIDDEN);
    elements.step2.classList.add(CSS_HIDDEN);
    elements.step2Result.classList.add(CSS_HIDDEN);
    return;
  }

  // 歩留まり率を表示
  elements.yieldRateDisplayCalc.textContent = `${toFixed(yr, 2)}%`;
  elements.step1ResultCalc.classList.remove(CSS_HIDDEN);
  elements.step2.classList.remove(CSS_HIDDEN);

  // パターンが入力されていれば計算を更新
  recalculateAll();
}

/**
 * 歩留まり率直接入力モードの入力処理
 */
function handleDirectModeInput() {
  const bw = getNumValue(elements.beforeWeightDirect);
  const yr = getNumValue(elements.yieldRateDirect);

  if (!Number.isFinite(bw) || !Number.isFinite(yr) || bw <= 0 || yr <= 0) {
    elements.step1ResultDirect.classList.add(CSS_HIDDEN);
    elements.step2.classList.add(CSS_HIDDEN);
    elements.step2Result.classList.add(CSS_HIDDEN);
    return;
  }

  // 加工後重量を計算
  const aw = bw * (yr / PERCENT_MULTIPLIER);

  // 結果を表示
  elements.yieldRateDisplayDirect.textContent = `${toFixed(yr, 2)}%`;
  elements.afterWeightDisplayDirect.textContent = `${toFixed(aw, 2)}g`;
  elements.step1ResultDirect.classList.remove(CSS_HIDDEN);
  elements.step2.classList.remove(CSS_HIDDEN);

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
  // 現在のモードに応じて歩留まり率と加工前重量を取得
  let yr, bw;

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
  elements.step2Result.classList.remove(CSS_HIDDEN);
}

/**
 * すべてクリア
 */
function clearAll() {
  // 商品名をクリア
  const productNameEl = document.getElementById('multiPatternProductName');
  if (productNameEl) productNameEl.value = '';

  // 重量から計算モードの入力値をクリア
  if (elements.beforeWeightCalc) elements.beforeWeightCalc.value = '';
  if (elements.afterWeightCalc) elements.afterWeightCalc.value = '';

  // 歩留まり率直接入力モードの入力値をクリア
  if (elements.beforeWeightDirect) elements.beforeWeightDirect.value = '';
  if (elements.yieldRateDirect) elements.yieldRateDirect.value = '';

  // パターンテーブルをクリア
  if (elements.tableBody) elements.tableBody.innerHTML = '';
  patterns.length = 0;
  patternIdCounter = 1;

  // 結果を非表示
  if (elements.step1ResultCalc) elements.step1ResultCalc.classList.add(CSS_HIDDEN);
  if (elements.step1ResultDirect) elements.step1ResultDirect.classList.add(CSS_HIDDEN);
  if (elements.step2) elements.step2.classList.add(CSS_HIDDEN);
  if (elements.step2Result) elements.step2Result.classList.add(CSS_HIDDEN);

  // 初期パターンを追加
  for (let i = 0; i < INITIAL_PATTERN_COUNT; i++) {
    addPattern();
  }
}

/**
 * モード切替時の初期化
 */
export function resetMultiPatternUI() {
  clearAll();
}

/**
 * 歩留まり統計から値を設定
 * @param {number} yieldRate - 歩留まり率（%）
 * @param {string} productName - 商品名
 */
export function setFromYieldStats(yieldRate, productName = '') {
  // 商品名を設定
  const productNameEl = document.getElementById('multiPatternProductName');
  if (productNameEl && productName) {
    productNameEl.value = productName;
  }

  // 歩留まり率直接入力モードに切り替え
  const directRadio = document.querySelector('input[name="yieldMethodMultiPattern"][value="direct"]');
  if (directRadio) {
    directRadio.checked = true;
    // change イベントを発火
    directRadio.dispatchEvent(new Event('change'));
  }

  // 歩留まり率を設定
  if (elements.yieldRateDirect && Number.isFinite(yieldRate)) {
    elements.yieldRateDirect.value = yieldRate.toFixed(2);
    // input イベントを発火して計算を実行
    handleDirectModeInput();
  }
}

/**
 * 統計値を複数パターン分析に設定（汎用関数）
 * 現在のモードを維持したまま、適切なフィールドに値を設定
 * @param {number} value - 設定する値
 * @param {string} statType - 統計タイプ ('yieldRate', 'beforeWeight', 'afterWeight')
 * @param {string} productName - 商品名（オプション）
 */
export function setStatValue(value, statType, productName = '') {
  // 商品名を設定
  const productNameEl = document.getElementById('multiPatternProductName');
  if (productNameEl && productName) {
    productNameEl.value = productName;
  }

  // 現在のモードを取得（モードは変更しない）
  const currentMode = document.querySelector('input[name="yieldMethodMultiPattern"]:checked')?.value || 'calculate';

  if (statType === 'yieldRate') {
    // 歩留まり率 → 直接入力モードの歩留まり率フィールド
    // （directモードでのみ有効）
    if (currentMode === 'direct' && elements.yieldRateDirect && Number.isFinite(value)) {
      elements.yieldRateDirect.value = value.toFixed(2);
      handleDirectModeInput();
    }
  } else if (statType === 'beforeWeight') {
    // 加工前重量 → 現在のモードに応じたフィールド
    if (currentMode === 'calculate' && elements.beforeWeightCalc && Number.isFinite(value)) {
      // 重量から計算モードの加工前重量
      elements.beforeWeightCalc.value = value.toFixed(2);
      elements.beforeWeightCalc.dispatchEvent(new Event('input'));
    } else if (currentMode === 'direct' && elements.beforeWeightDirect && Number.isFinite(value)) {
      // 直接入力モードの加工前重量
      elements.beforeWeightDirect.value = value.toFixed(2);
      elements.beforeWeightDirect.dispatchEvent(new Event('input'));
    }
  } else if (statType === 'afterWeight') {
    // 加工後重量 → 重量から計算モードの加工後重量フィールド
    // （calculateモードでのみ有効）
    if (currentMode === 'calculate' && elements.afterWeightCalc && Number.isFinite(value)) {
      elements.afterWeightCalc.value = value.toFixed(2);
      elements.afterWeightCalc.dispatchEvent(new Event('input'));
    }
  }
}

/**
 * すべてのパターンを置き換え
 * @param {Array<Object>} newPatterns - 新しいパターンの配列 {label, value, sigma}
 */
export function replaceAllPatterns(newPatterns) {
  if (!Array.isArray(newPatterns) || newPatterns.length === 0) {
    console.warn('[MultiPattern] 有効なパターンが指定されていません');
    return;
  }

  // 既存のパターンをすべてクリア
  elements.tableBody.innerHTML = '';
  patterns.length = 0;
  patternIdCounter = 1;

  // 新しいパターンを追加
  newPatterns.forEach(pattern => {
    const patternId = patternIdCounter++;
    const row = document.createElement('tr');
    row.dataset.patternId = patternId;

    // パターンラベルをコメントとして表示（オプション）
    const labelComment = pattern.label ? ` data-label="${pattern.label}"` : '';

    row.innerHTML = `
      <td class="pattern-number"${labelComment}>${patternId}</td>
      <td><input type="number" class="pattern-unit-cost" step="0.01" inputmode="decimal" placeholder="150" /></td>
      <td><input type="number" class="pattern-unit-price" step="0.01" inputmode="decimal" placeholder="198" /></td>
      <td><input type="number" class="pattern-after-price" step="0.01" inputmode="decimal" placeholder="158" /></td>
      <td><button type="button" class="btn-remove" data-pattern-id="${patternId}">削除</button></td>
    `;

    elements.tableBody.appendChild(row);

    // パターンデータを追加
    patterns.push({
      id: patternId,
      label: pattern.label || '',
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
  });

  console.log(`[MultiPattern] ${newPatterns.length}個のパターンを追加しました`);
}

// グローバルアクセス用のAPI
if (typeof window !== 'undefined') {
  window.multiPatternUI = {
    replaceAllPatterns
  };
}
