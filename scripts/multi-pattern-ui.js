/**
 * 複数パターン分析モードのUI制御
 */

import { calculatePattern } from './calculator-multi-pattern.js';
import { toFixed, calcYield, per100FromPerUnit, afterCostPer100, markup, priceFromMarkup, isPositive } from './calculation.js';
import { PERCENT_MULTIPLIER } from './constants.js';
import { showError, showWarning } from './toast.js';
import { debounce } from './debounce.js';

// 定数
const INITIAL_PATTERN_COUNT = 3;
const CSS_HIDDEN = 'is-hidden';

// 状態管理
let patternIdCounter = 1;
const patterns = [];
let currentYieldMethod = 'calculate'; // 'calculate' or 'direct'

// デバウンス用マップ（パターンIDごとにデバウンスインスタンスを保持）
const debouncedHandlers = new Map();

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
    breakEvenBtn: document.getElementById('breakEvenBtn'),

    // 目標値入率
    targetMarkupRate: document.getElementById('targetMarkupRate'),
    targetMarkupSlider: document.getElementById('targetMarkupSlider'),
    applyTargetMarkupBtn: document.getElementById('applyTargetMarkupBtn'),

    // 微調整ボタン
    adjustMinus10Btn: document.getElementById('adjustMinus10Btn'),
    adjustPlus10Btn: document.getElementById('adjustPlus10Btn'),

    // 丸め込みボタン
    roundTo0Btn: document.getElementById('roundTo0Btn'),
    roundTo5Btn: document.getElementById('roundTo5Btn'),
    roundTo8Btn: document.getElementById('roundTo8Btn'),

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
  const debouncedHandleCalculateModeInput = debounce(handleCalculateModeInput);
  elements.beforeWeightCalc.addEventListener('input', debouncedHandleCalculateModeInput);
  elements.afterWeightCalc.addEventListener('input', debouncedHandleCalculateModeInput);

  // 歩留まり率直接入力モードの入力イベント
  const debouncedHandleDirectModeInput = debounce(handleDirectModeInput);
  elements.beforeWeightDirect.addEventListener('input', debouncedHandleDirectModeInput);
  elements.yieldRateDirect.addEventListener('input', debouncedHandleDirectModeInput);

  // パターン追加ボタン
  if (elements.addPatternBtn) {
    elements.addPatternBtn.addEventListener('click', addPattern);
  }

  // 損益分岐点一括計算ボタン
  if (elements.breakEvenBtn) {
    elements.breakEvenBtn.addEventListener('click', calculateBreakEvenPrices);
  }

  // 目標値入率のスライダーと入力ボックスの連携
  if (elements.targetMarkupRate && elements.targetMarkupSlider) {
    const debouncedUpdatePricesFromTargetMarkup = debounce((value) => {
      updatePricesFromTargetMarkup(value, false);
    });

    // スライダーを動かしたら入力ボックス、売価を自動更新
    elements.targetMarkupSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      elements.targetMarkupRate.value = toFixed(value, 1);
      // 売価をリアルタイムで自動更新（ハイライトなし）
      debouncedUpdatePricesFromTargetMarkup(value);
    });

    // 入力ボックスを変更したらスライダー、売価を自動更新
    elements.targetMarkupRate.addEventListener('input', (e) => {
      let value = parseFloat(e.target.value);
      if (isNaN(value)) value = 0;
      if (value < 0) value = 0;
      if (value > 99) value = 99;
      elements.targetMarkupRate.value = toFixed(value, 1);
      elements.targetMarkupSlider.value = value;
      // スライダーのカスタムプロパティを更新
      elements.targetMarkupSlider.style.setProperty('--slider-percent', `${value}%`);
      // 売価をリアルタイムで自動更新（ハイライトなし）
      debouncedUpdatePricesFromTargetMarkup(value);
    });
  }

  // 目標値入率から売価を挿入ボタン
  if (elements.applyTargetMarkupBtn) {
    elements.applyTargetMarkupBtn.addEventListener('click', applyTargetMarkupPrices);
  }

  // 微調整ボタン
  if (elements.adjustMinus10Btn) {
    elements.adjustMinus10Btn.addEventListener('click', () => adjustPrices(-10));
  }
  if (elements.adjustPlus10Btn) {
    elements.adjustPlus10Btn.addEventListener('click', () => adjustPrices(10));
  }

  // 丸め込みボタン
  if (elements.roundTo0Btn) {
    elements.roundTo0Btn.addEventListener('click', () => roundPrices(0));
  }
  if (elements.roundTo5Btn) {
    elements.roundTo5Btn.addEventListener('click', () => roundPrices(5));
  }
  if (elements.roundTo8Btn) {
    elements.roundTo8Btn.addEventListener('click', () => roundPrices(8));
  }

  // クリアボタン
  if (elements.clearBtn) {
    elements.clearBtn.addEventListener('click', clearAll);
  }

  // 初期パターンを追加
  for (let i = 0; i < INITIAL_PATTERN_COUNT; i++) {
    addPattern();
  }

  // ヘルプアイコンのモバイル対応（タップで表示/非表示）
  initHelpIconMobile();

  // 比較結果のヘルプモーダル
  initResultsHelpModal();
}

/**
 * ヘルプアイコンのモバイル対応を初期化
 */
function initHelpIconMobile() {
  // タッチデバイスの検出
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchDevice) {
    // 全てのヘルプアイコンにタップイベントを設定
    document.addEventListener('click', (e) => {
      const helpIcon = e.target.closest('.help-icon');

      if (helpIcon) {
        // クリックされたヘルプアイコンのトグル
        e.stopPropagation();
        helpIcon.classList.toggle('active');
      } else {
        // ヘルプアイコン以外をクリックしたら全て閉じる
        document.querySelectorAll('.help-icon.active').forEach(icon => {
          icon.classList.remove('active');
        });
      }
    });
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
 */
function removePattern(patternId) {
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
  recalculateAll();
}

/**
 * パターン番号を1から連番で更新
 */
function updatePatternNumbers() {
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');
  rows.forEach((row, index) => {
    const patternNumberCell = row.querySelector('.pattern-number');
    if (patternNumberCell) {
      patternNumberCell.textContent = index + 1;
    }
  });
}

/**
 * パターンの入力処理
 */
function handlePatternInput(patternId) {
  const row = elements.tableBody.querySelector(`tr[data-pattern-id="${patternId}"]`);
  if (!row) return;

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
  recalculateAll();
}

/**
 * 重複パターンを検出してエラー表示
 */
function checkDuplicates() {
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
      unitCostInput.title = '[警告] ️ 重複しています';
      unitPriceInput.title = '[警告] ️ 重複しています';
    }
  });
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

  // 売価基準で降順にソート（金額の高い順）
  validPatterns.sort((a, b) => b.unitPrice - a.unitPrice);

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

      // 各指標の増減を計算
      const costChange = result.afterCost100 - result.beforeCost100;
      const priceChange = result.afterPrice100 - result.beforePrice100;
      const markupChange = result.afterMarkup - result.beforeMarkup;

      // 増減の表示クラスを決定
      const getCostChangeClass = (val) => {
        if (val > 0) return 'result-negative'; // 原価増加は赤
        if (val < 0) return 'result-positive'; // 原価減少は緑
        return 'result-neutral';
      };

      const getPriceChangeClass = (val) => {
        if (val > 0) return 'result-positive'; // 売価増加は緑
        if (val < 0) return 'result-negative'; // 売価減少は赤
        return 'result-neutral';
      };

      const getMarkupChangeClass = (val) => {
        if (val > 0) return 'result-positive'; // 値入率増加は緑
        if (val < 0) return 'result-negative'; // 値入率減少は赤
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
        if (!Number.isFinite(val)) return '-';
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

      elements.resultsTableBody.appendChild(row);
    }
  });

  // 結果を表示
  elements.step2Result.classList.remove(CSS_HIDDEN);
}

/**
 * 損益分岐点を一括計算して設定
 * 各パターンの加工後設定売価に、加工前値入率を維持する売価を設定
 */
function calculateBreakEvenPrices() {
  // ボタンを無効化してローディング表示
  const btn = elements.breakEvenBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 計算中...';
  }

  // 現在のモードに応じて歩留まり率と加工前重量を取得
  let yr, bw;

  if (currentYieldMethod === 'calculate') {
    const beforeWeight = getNumValue(elements.beforeWeightCalc);
    const afterWeight = getNumValue(elements.afterWeightCalc);

    if (!isPositive(beforeWeight) || !isPositive(afterWeight)) {
      showWarning('加工前重量と加工後重量を入力してください。');
      if (btn) {
        btn.disabled = false;
        btn.textContent = ' 値入率分岐点を一括挿入';
      }
      return;
    }

    yr = calcYield(beforeWeight, afterWeight);
    bw = beforeWeight;
  } else {
    yr = getNumValue(elements.yieldRateDirect);
    bw = getNumValue(elements.beforeWeightDirect);
  }

  if (!isPositive(yr) || !isPositive(bw)) {
    showWarning('歩留まり率と加工前重量を入力してください。');
    if (btn) {
      btn.disabled = false;
      btn.textContent = ' 値入率分岐点を一括挿入';
    }
    return;
  }

  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  if (rows.length === 0) {
    showWarning('パターンがありません。');
    if (btn) {
      btn.disabled = false;
      btn.textContent = ' 値入率分岐点を一括挿入';
    }
    return;
  }

  let updatedCount = 0;
  const updatedInputs = [];

  // 各パターンの損益分岐点を計算して設定
  rows.forEach(row => {
    const unitCostInput = row.querySelector('.pattern-unit-cost');
    const unitPriceInput = row.querySelector('.pattern-unit-price');
    const afterPriceInput = row.querySelector('.pattern-after-price');

    const unitCost = getNumValue(unitCostInput);
    const unitPrice = getNumValue(unitPriceInput);

    // 1個原価と1個売価が入力されている場合のみ計算
    if (isPositive(unitCost) && isPositive(unitPrice)) {
      // 加工前100g原価を計算
      const beforeCost100 = per100FromPerUnit(unitCost, bw);
      // 加工前100g売価を計算
      const beforePrice100 = per100FromPerUnit(unitPrice, bw);

      if (beforeCost100 && beforePrice100) {
        // 加工前値入率を計算
        const beforeMarkupRate = markup(beforeCost100, beforePrice100);

        if (Number.isFinite(beforeMarkupRate) && beforeMarkupRate >= 0 && beforeMarkupRate < 100) {
          // 加工後100g原価を計算
          const afterCost100 = afterCostPer100(beforeCost100, yr);

          if (afterCost100) {
            // 加工前値入率を維持する加工後100g売価を計算
            const breakEvenPrice = priceFromMarkup(afterCost100, beforeMarkupRate);

            if (isPositive(breakEvenPrice)) {
              // 加工後設定売価に設定
              afterPriceInput.value = toFixed(breakEvenPrice, 2);

              // ハイライト表示のために入力欄を記録
              updatedInputs.push(afterPriceInput);

              // inputイベントを発火して再計算をトリガー
              const patternId = parseInt(row.dataset.patternId);
              handlePatternInput(patternId);

              updatedCount++;
            }
          }
        }
      }
    }
  });

  // ボタンを元に戻す
  if (btn) {
    btn.disabled = false;
    btn.textContent = ' 値入率分岐点を一括挿入';
  }

  if (updatedCount > 0) {
    // 成功メッセージを表示
    if (btn) {
      btn.innerHTML = '<i class="fa-regular fa-circle-check"></i> 挿入完了！';
      setTimeout(() => {
        btn.textContent = ' 値入率分岐点を一括挿入';
      }, 2000);
    }

    // 更新された入力欄をハイライト表示
    updatedInputs.forEach(input => {
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = '#c8e6c9'; // 緑色のハイライト

      // 2秒後にハイライトを解除
      setTimeout(() => {
        input.style.backgroundColor = '';
      }, 2000);
    });
  } else {
    showWarning('1個原価と1個売価が入力されているパターンがありません。');
  }
}

/**
 * 目標値入率から売価を更新（リアルタイム用）
 * @param {number} targetMarkup - 目標値入率
 * @param {boolean} showHighlight - ハイライトを表示するか
 * @returns {number} - 更新したパターン数
 */
function updatePricesFromTargetMarkup(targetMarkup, showHighlight = false) {
  // 入力値の検証
  if (!Number.isFinite(targetMarkup) || targetMarkup < 0 || targetMarkup >= 100) {
    return 0;
  }

  // 現在のモードに応じて歩留まり率と加工前重量を取得
  let yr, bw;

  if (currentYieldMethod === 'calculate') {
    const beforeWeight = getNumValue(elements.beforeWeightCalc);
    const afterWeight = getNumValue(elements.afterWeightCalc);

    if (!isPositive(beforeWeight) || !isPositive(afterWeight)) {
      return 0;
    }

    yr = calcYield(beforeWeight, afterWeight);
    bw = beforeWeight;
  } else {
    yr = getNumValue(elements.yieldRateDirect);
    bw = getNumValue(elements.beforeWeightDirect);
  }

  if (!isPositive(yr) || !isPositive(bw)) {
    return 0;
  }

  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  if (rows.length === 0) {
    return 0;
  }

  let updatedCount = 0;
  const updatedInputs = [];

  // 各パターンに目標値入率を適用
  rows.forEach((row) => {
    const unitCostInput = row.querySelector('.pattern-unit-cost');
    const afterPriceInput = row.querySelector('.pattern-after-price');

    const unitCost = getNumValue(unitCostInput);

    // 1個原価が入力されている場合のみ計算
    if (isPositive(unitCost)) {
      // 加工前100g原価を計算
      const beforeCost100 = per100FromPerUnit(unitCost, bw);

      if (beforeCost100) {
        // 加工後100g原価を計算
        const afterCost100 = afterCostPer100(beforeCost100, yr);

        if (afterCost100) {
          // 目標値入率を達成する加工後100g売価を計算
          const targetPrice = priceFromMarkup(afterCost100, targetMarkup);

          if (isPositive(targetPrice)) {
            // 加工後設定売価に設定
            afterPriceInput.value = toFixed(targetPrice, 2);

            // ハイライト表示のために入力欄を記録
            if (showHighlight) {
              updatedInputs.push(afterPriceInput);
            }

            // inputイベントを発火して再計算をトリガー
            const patternId = parseInt(row.dataset.patternId);
            handlePatternInput(patternId);

            updatedCount++;
          }
        }
      }
    }
  });

  // ハイライト表示
  if (showHighlight && updatedInputs.length > 0) {
    updatedInputs.forEach(input => {
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = '#bbdefb'; // 青色のハイライト

      // 2秒後にハイライトを解除
      setTimeout(() => {
        input.style.backgroundColor = '';
      }, 2000);
    });
  }

  return updatedCount;
}

/**
 * 目標値入率から売価を一括計算して設定（ボタンクリック用）
 */
function applyTargetMarkupPrices() {
  // ボタンを無効化してローディング表示
  const btn = elements.applyTargetMarkupBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 計算中...';
  }

  // 目標値入率を取得
  const targetMarkup = getNumValue(elements.targetMarkupRate);

  if (!Number.isFinite(targetMarkup) || targetMarkup < 0 || targetMarkup >= 100) {
    showWarning('目標値入率を0〜99の範囲で入力してください。');
    if (btn) {
      btn.disabled = false;
      btn.textContent = ' 売価を挿入';
    }
    return;
  }

  // 売価を更新（ハイライト表示あり）
  const updatedCount = updatePricesFromTargetMarkup(targetMarkup, true);

  // ボタンを元に戻す
  if (btn) {
    btn.disabled = false;
  }

  if (updatedCount > 0) {
    // 成功メッセージを表示
    if (btn) {
      btn.innerHTML = `<i class="fa-regular fa-circle-check"></i> 挿入完了！（${toFixed(targetMarkup, 1)}%）`;
      setTimeout(() => {
        btn.textContent = ' 売価を挿入';
      }, 2000);
    }
  } else {
    if (btn) {
      btn.textContent = ' 売価を挿入';
    }
    showWarning('1個原価が入力されているパターンがありません。');
  }
}

/**
 * 売価を丸め込み（下一桁を0, 5, 8に調整）
 * @param {number} digit - 下一桁の数字（0, 5, 8）
 */
function roundPrices(digit) {
  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  if (rows.length === 0) {
    showWarning('パターンがありません。');
    return;
  }

  let updatedCount = 0;
  const updatedInputs = [];

  // 各パターンの加工後設定売価を丸め込み
  rows.forEach((row, index) => {
    const afterPriceInput = row.querySelector('.pattern-after-price');
    const currentValue = getNumValue(afterPriceInput);

    if (isPositive(currentValue)) {
      // 丸め込み処理
      const roundedValue = roundToDigit(currentValue, digit);

      // 値を設定
      afterPriceInput.value = roundedValue;

      // ハイライト表示のために入力欄を記録
      updatedInputs.push(afterPriceInput);

      // inputイベントを発火して再計算をトリガー
      const patternId = parseInt(row.dataset.patternId);
      handlePatternInput(patternId);

      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    // 更新された入力欄をハイライト表示
    updatedInputs.forEach(input => {
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = '#fff9c4'; // 黄色のハイライト

      // 2秒後にハイライトを解除
      setTimeout(() => {
        input.style.backgroundColor = '';
      }, 2000);
    });
  } else {
    showWarning('加工後設定売価が入力されているパターンがありません。');
  }
}

/**
 * 値を指定した下一桁に丸め込み（小数点なし）
 * @param {number} value - 元の値
 * @param {number} digit - 下一桁の数字（0, 5, 8）
 * @returns {number} - 丸め込み後の値
 */
function roundToDigit(value, digit) {
  // 丸め込みモードを取得
  const roundModeRadio = document.querySelector('input[name="roundMode"]:checked');
  const roundMode = roundModeRadio ? roundModeRadio.value : 'round';

  // 小数点を四捨五入して整数に
  const intValue = Math.round(value);

  // 下一桁を取得
  const lastDigit = intValue % 10;

  // 10の位を計算
  const base = Math.floor(intValue / 10) * 10;

  // モードに応じて処理
  if (roundMode === 'round') {
    // 近接値: 従来の動作（最も近い方）
    if (lastDigit <= digit) {
      return base + digit;
    } else {
      return base + 10 + digit;
    }
  } else if (roundMode === 'ceil') {
    // 切り上げ: digitより小さければ現在の10の位+digit、それ以外は次の10の位+digit
    if (lastDigit <= digit) {
      return base + digit;
    } else {
      return base + 10 + digit;
    }
  } else if (roundMode === 'floor') {
    // 切り捨て: digitより大きければ現在の10の位+digit、それ以外は前の10の位+digit
    if (lastDigit >= digit) {
      return base + digit;
    } else {
      return base - 10 + digit;
    }
  }

  // デフォルト（念のため）
  return base + digit;
}

/**
 * 売価を指定の金額だけ調整（一括加算/減算）
 * @param {number} amount - 調整金額（+10 or -10）
 */
function adjustPrices(amount) {
  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  if (rows.length === 0) {
    showWarning('パターンがありません。');
    return;
  }

  let updatedCount = 0;
  const updatedInputs = [];

  // 各パターンの加工後設定売価を調整
  rows.forEach((row, index) => {
    const afterPriceInput = row.querySelector('.pattern-after-price');
    const currentValue = getNumValue(afterPriceInput);

    if (isPositive(currentValue)) {
      // 調整後の値
      const adjustedValue = currentValue + amount;

      // 負の値にならないようにチェック
      if (adjustedValue > 0) {
        // 値を設定
        afterPriceInput.value = toFixed(adjustedValue, 2);

        // ハイライト表示のために入力欄を記録
        updatedInputs.push(afterPriceInput);

        // inputイベントを発火して再計算をトリガー
        const patternId = parseInt(row.dataset.patternId);
        handlePatternInput(patternId);

        updatedCount++;
      }
    }
  });

  if (updatedCount > 0) {
    // 更新された入力欄をハイライト表示
    const highlightColor = amount > 0 ? '#c8e6c9' : '#ffccbc'; // +は緑、-はオレンジ
    updatedInputs.forEach(input => {
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = highlightColor;

      // 2秒後にハイライトを解除
      setTimeout(() => {
        input.style.backgroundColor = '';
      }, 2000);
    });
  } else {
    showWarning('加工後設定売価が入力されているパターンがありません。');
  }
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
    // 歩留まり統計から読み込んだ場合は読み取り専用にして動的連動を有効化
    productNameEl.setAttribute('readonly', 'readonly');
    productNameEl.style.backgroundColor = '#f0f0f0';
    productNameEl.style.cursor = 'not-allowed';
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

/**
 * 比較結果のヘルプモーダルを初期化
 */
function initResultsHelpModal() {
  const helpBtn = document.getElementById('resultsHelpBtn');
  const modal = document.getElementById('resultsHelpModal');
  const closeBtn = document.getElementById('resultsHelpModalClose');
  const overlay = modal?.querySelector('.modal-overlay');

  if (!helpBtn || !modal || !closeBtn || !overlay) {
    return;
  }

  // ヘルプボタンをクリックでモーダルを開く
  helpBtn.addEventListener('click', () => {
    modal.classList.add('is-active');
    document.body.style.overflow = 'hidden'; // 背景のスクロールを無効化
  });

  // 閉じるボタンをクリックでモーダルを閉じる
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('is-active');
    document.body.style.overflow = ''; // スクロールを復元
  });

  // オーバーレイをクリックでモーダルを閉じる
  overlay.addEventListener('click', () => {
    modal.classList.remove('is-active');
    document.body.style.overflow = '';
  });

  // ESCキーでモーダルを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-active')) {
      modal.classList.remove('is-active');
      document.body.style.overflow = '';
    }
  });
}

// グローバルアクセス用のAPI
if (typeof window !== 'undefined') {
  window.multiPatternUI = {
    replaceAllPatterns,
    updatePatternNumbers
  };
}
