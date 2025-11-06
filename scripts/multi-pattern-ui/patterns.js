/**
 * パターン管理モジュール
 * Pattern CRUD operations (add, delete, edit, sort)
 */

import { logger } from '../core/logger.js';
import { escapeAttribute, htmlWithRaw, raw } from '../core/sanitizer.js';
import { showWarning } from '../toast.js';
import { debounce } from '../debounce.js';

// パターン状態管理
let patternIdCounter = 1;
const patterns = [];

// デバウンス用マップ（パターンIDごとにデバウンスインスタンスを保持）
const debouncedHandlers = new Map();

// DOM要素参照（core.jsから設定される）
let elements = {};

// 再計算コールバック（core.jsから設定される）
let recalculateCallback = null;

/**
 * DOM要素参照を設定
 * @param {Object} elementsRef - DOM要素の参照
 */
export function setElements(elementsRef) {
  elements = elementsRef;
}

/**
 * 再計算コールバックを設定
 * @param {Function} callback - 再計算を実行する関数
 */
export function setRecalculateCallback(callback) {
  recalculateCallback = callback;
}

/**
 * パターン配列を取得
 * @returns {Array} パターン配列
 */
export function getPatterns() {
  return patterns;
}

/**
 * パターンIDカウンターを取得
 * @returns {number} 現在のパターンIDカウンター
 */
export function getPatternIdCounter() {
  return patternIdCounter;
}

/**
 * パターンIDカウンターをリセット
 */
export function resetPatternIdCounter() {
  patternIdCounter = 1;
}

/**
 * パターン配列をクリア
 */
export function clearPatterns() {
  patterns.length = 0;
}

/**
 * パターン行番号を更新（相対値1,2,3...に）
 */
export function updatePatternNumbers() {
  if (!elements.tableBody) return;

  const allRows = elements.tableBody.querySelectorAll('tr');
  allRows.forEach((row, index) => {
    const numberCell = row.querySelector('.pattern-number');
    if (numberCell) {
      numberCell.textContent = index + 1; // 1-based行番号
    }
  });
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
 * パターンを追加
 */
export function addPattern() {
  const patternId = patternIdCounter++;

  const row = document.createElement('tr');
  row.dataset.patternId = patternId;
  row.innerHTML = `
    <td class="pattern-number">1</td>
    <td><input type="number" class="pattern-unit-cost" step="0.01" inputmode="decimal" placeholder="150" /></td>
    <td><input type="number" class="pattern-unit-price" step="0.01" inputmode="decimal" placeholder="198" /></td>
    <td><input type="number" class="pattern-after-price" step="0.01" inputmode="decimal" placeholder="158" /></td>
    <td><button type="number" class="btn-remove" data-pattern-id="${patternId}">削除</button></td>
  `;

  elements.tableBody.appendChild(row);

  // パターンデータを追加
  patterns.push({
    id: patternId,
    unitCost: null,
    unitPrice: null,
    afterPrice100: null
  });

  // 入力イベントを設定（デバウンス化）
  const debouncedHandler = debounce(() => handlePatternInput(patternId));
  debouncedHandlers.set(patternId, debouncedHandler);

  const inputs = row.querySelectorAll('input');
  inputs.forEach(input => {
    input.addEventListener('input', debouncedHandler);
  });

  // 削除ボタンのイベント
  const removeBtn = row.querySelector('.btn-remove');
  removeBtn.addEventListener('click', () => removePattern(patternId));

  // パターン番号を更新
  updatePatternNumbers();
}

/**
 * パターンを削除
 * @param {number} patternId - パターンID
 */
export function removePattern(patternId) {
  // 最低1つは残す
  if (patterns.length <= 1) {
    showWarning('最低1つのパターンが必要です。');
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

  // デバウンスハンドラーを削除
  debouncedHandlers.delete(patternId);

  // パターン番号を更新
  updatePatternNumbers();

  // 結果を再計算
  if (recalculateCallback) {
    recalculateCallback();
  }
}

/**
 * パターンの入力処理
 * @param {number} patternId - パターンID
 */
export function handlePatternInput(patternId) {
  const row = elements.tableBody.querySelector(`tr[data-pattern-id="${patternId}"]`);
  if (!row) {return;}

  const unitCostInput = row.querySelector('.pattern-unit-cost');
  const unitPriceInput = row.querySelector('.pattern-unit-price');
  const afterPrice100Input = row.querySelector('.pattern-after-price');

  const unitCost = getNumValue(unitCostInput);
  const unitPrice = getNumValue(unitPriceInput);
  const afterPrice100 = getNumValue(afterPrice100Input);

  // パターンデータを更新
  const pattern = patterns.find(p => p.id === patternId);
  if (pattern) {
    pattern.unitCost = unitCost;
    pattern.unitPrice = unitPrice;
    pattern.afterPrice100 = afterPrice100;
  }

  // 重複検出
  checkDuplicates();

  // 結果を再計算
  if (recalculateCallback) {
    recalculateCallback();
  }
}

/**
 * 重複パターンを検出してエラー表示
 */
export function checkDuplicates() {
  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  // 重複検出用のマップ
  const patternMap = new Map();
  const duplicateIds = new Set();

  rows.forEach(row => {
    const patternId = parseInt(row.dataset.patternId);
    const unitCostInput = row.querySelector('.pattern-unit-cost');
    const unitPriceInput = row.querySelector('.pattern-unit-price');

    const unitCost = getNumValue(unitCostInput);
    const unitPrice = getNumValue(unitPriceInput);

    // 両方の値が入力されている場合のみチェック
    if (Number.isFinite(unitCost) && Number.isFinite(unitPrice)) {
      const key = `${unitCost.toFixed(2)}_${unitPrice.toFixed(2)}`;

      if (patternMap.has(key)) {
        // 重複を検出
        duplicateIds.add(patternId);
        duplicateIds.add(patternMap.get(key));
      } else {
        patternMap.set(key, patternId);
      }
    }
  });

  // すべてのパターンのエラー表示をクリア
  rows.forEach(row => {
    const unitCostInput = row.querySelector('.pattern-unit-cost');
    const unitPriceInput = row.querySelector('.pattern-unit-price');
    unitCostInput.style.borderColor = '';
    unitPriceInput.style.borderColor = '';
    unitCostInput.title = '';
    unitPriceInput.title = '';
  });

  // 重複しているパターンをエラー表示
  duplicateIds.forEach(patternId => {
    const row = elements.tableBody.querySelector(`tr[data-pattern-id="${patternId}"]`);
    if (row) {
      const unitCostInput = row.querySelector('.pattern-unit-cost');
      const unitPriceInput = row.querySelector('.pattern-unit-price');
      unitCostInput.style.borderColor = '#e74c3c';
      unitPriceInput.style.borderColor = '#e74c3c';
      unitCostInput.style.borderWidth = '2px';
      unitPriceInput.style.borderWidth = '2px';
      unitCostInput.title = '⚠️ 重複しています';
      unitPriceInput.title = '⚠️ 重複しています';
    }
  });
}

/**
 * すべてのパターンを置き換え
 * @param {Array<Object>} newPatterns - 新しいパターンの配列 {label, value, sigma}
 */
export function replaceAllPatterns(newPatterns) {
  if (!Array.isArray(newPatterns) || newPatterns.length === 0) {
    logger.warn('[MultiPattern] 有効なパターンが指定されていません');
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
    // XSS対策: labelをエスケープして属性値として安全に使用
    const escapedLabel = pattern.label ? escapeAttribute(pattern.label) : '';
    const labelComment = escapedLabel ? ` data-label="${escapedLabel}"` : '';

    // XSS対策: htmlWithRaw を使用（数値IDは安全、HTMLは信頼できる静的コンテンツ）
    row.innerHTML = htmlWithRaw`
      <td class="pattern-number"${raw(labelComment)}>1</td>
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

    // 入力イベントを設定（デバウンス化）
    const debouncedHandler = debounce(() => handlePatternInput(patternId));
    debouncedHandlers.set(patternId, debouncedHandler);

    const inputs = row.querySelectorAll('input');
    inputs.forEach(input => {
      input.addEventListener('input', debouncedHandler);
    });

    // 削除ボタンのイベント
    const removeBtn = row.querySelector('.btn-remove');
    removeBtn.addEventListener('click', () => removePattern(patternId));
  });

  // パターン番号を更新
  updatePatternNumbers();
}
