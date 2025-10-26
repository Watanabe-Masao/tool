/**
 * メインアプリケーションロジック（段階的フォーム対応 - 2モード）
 */

import { per100FromPerUnit, per100FromBox, markup, calcYield, toFixed, afterCostPer100 } from './calculation.js';
import { qs, num, hide, show, toggleActive, setText, yen, pct, qsa } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, FIXED_FIELDS, WEIGHT_FIELDS, RADIO_NAMES, YIELD_STATS_FIELDS } from './constants.js';
import { calculateFixed } from './calculator-fixed.js';
import { calculateWeight } from './calculator-weight.js';
import { calculateYieldRate } from './calculator-yield-stats.js';
import { displayResults, displayReverseSimulation, displayReverseError, hideReverseSimulation } from './display.js';
import {
  calculateProductSimulation,
  updateDiscountSimulation,
  calculateWeightFromMarkup,
  calculatePriceFromMarkup,
  calculateUnitCostFromMarkup,
  calculateBoxCostFromMarkup,
  calculateAfterWeightFromMarkup,
  calculateYieldRateFromMarkup,
  calculateDiscountRateFromGross
} from './product-simulator.js';
import { initHistoryUI, updateSaveButtonsVisibility } from './history-ui.js';

/**
 * モード切替処理
 */
function switchMode(newMode) {
  appState.setMode(newMode);

  const isFixed = newMode === MODE.FIXED;
  const isWeight = newMode === MODE.WEIGHT;
  const isYieldStats = newMode === MODE.YIELD_STATS;

  // ボタンのアクティブ状態を更新
  [UI_ELEMENTS.FIXED_BTN, UI_ELEMENTS.WEIGHT_BTN, UI_ELEMENTS.YIELD_STATS_BTN].forEach(btnId => {
    const btn = qs(`#${btnId}`);
    if (btn) {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-selected', 'false');
    }
  });

  const activeBtn = qs(`#${isFixed ? UI_ELEMENTS.FIXED_BTN : isWeight ? UI_ELEMENTS.WEIGHT_BTN : UI_ELEMENTS.YIELD_STATS_BTN}`);
  if (activeBtn) {
    activeBtn.classList.add('is-active');
    activeBtn.setAttribute('aria-selected', 'true');
  }

  // セクションの表示/非表示を切り替え
  const fixedInputs = qs(`#${UI_ELEMENTS.FIXED_INPUTS}`);
  const weightInputs = qs(`#${UI_ELEMENTS.WEIGHT_INPUTS}`);
  const yieldStatsInputs = qs(`#${UI_ELEMENTS.YIELD_STATS_INPUTS}`);

  if (fixedInputs) fixedInputs.classList.toggle('is-hidden', !isFixed);
  if (weightInputs) weightInputs.classList.toggle('is-hidden', !isWeight);
  if (yieldStatsInputs) yieldStatsInputs.classList.toggle('is-hidden', !isYieldStats);

  hide(UI_ELEMENTS.RESULTS);
  hide(UI_ELEMENTS.WARNING);

  // ステップをリセット
  if (isFixed) {
    resetSteps();
  } else if (isWeight) {
    resetWeightSteps();
  } else if (isYieldStats) {
    resetYieldStatsEntries();
  }
}

/**
 * 歩留まり率入力方法の切り替え（定額モード）
 */
function switchYieldMethod() {
  const method = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`)?.value;
  const isDirect = method === 'direct';

  // モードの表示切り替え
  qs(`#${UI_ELEMENTS.FIXED_CALCULATE_MODE}`).classList.toggle('is-hidden', isDirect);
  qs(`#${UI_ELEMENTS.FIXED_DIRECT_MODE}`).classList.toggle('is-hidden', !isDirect);

  // ステップをリセット
  resetSteps();

  // 逆算シミュレーションが表示されている場合、ラベルのみ更新
  updateReverseSimulationLabels();
}

/**
 * 歩留まり率入力方法の切り替え（計量モード）
 */
function switchWeightYieldMethod() {
  const method = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`)?.value;
  const isDirect = method === 'direct';

  // モードの表示切り替え
  qs(`#${UI_ELEMENTS.WEIGHT_CALCULATE_MODE}`).classList.toggle('is-hidden', isDirect);
  qs(`#${UI_ELEMENTS.WEIGHT_DIRECT_MODE}`).classList.toggle('is-hidden', !isDirect);

  // ステップをリセット
  resetWeightSteps();

  // 逆算シミュレーションが表示されている場合、ラベルのみ更新
  updateReverseSimulationLabels();
}

/**
 * ステップをリセット
 */
function resetSteps() {
  appState.resetStep();

  const method = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`)?.value;

  if (method === 'direct') {
    // 歩留まり率直接入力モード
    show(UI_ELEMENTS.FIXED_DIRECT_STEP1);
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP1_RESULT);
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP2);
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP2_RESULT);
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP3);
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);

    // 入力フィールドをクリア
    [FIXED_FIELDS.DIRECT.UNIT_COST, FIXED_FIELDS.DIRECT.UNIT_PRICE,
     FIXED_FIELDS.DIRECT.BEFORE_WEIGHT, FIXED_FIELDS.DIRECT.YIELD_RATE,
     FIXED_FIELDS.DIRECT.AFTER_PRICE_100].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });
  } else {
    // 重量から計算モード
    show(UI_ELEMENTS.FIXED_STEP1);
    hide(UI_ELEMENTS.FIXED_STEP1_RESULT);
    hide(UI_ELEMENTS.FIXED_STEP2);
    hide(UI_ELEMENTS.FIXED_STEP2_RESULT);
    hide(UI_ELEMENTS.FIXED_STEP3);
    hide(UI_ELEMENTS.FIXED_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);

    // 入力フィールドをクリア
    [FIXED_FIELDS.CALCULATE.UNIT_COST, FIXED_FIELDS.CALCULATE.UNIT_PRICE,
     FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT, FIXED_FIELDS.CALCULATE.AFTER_WEIGHT,
     FIXED_FIELDS.CALCULATE.AFTER_PRICE_100].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });
  }
}

/**
 * Step 1の処理：基本情報入力→加工前の計算（重量から計算モード）
 */
function handleStep1() {
  const uc = num(FIXED_FIELDS.CALCULATE.UNIT_COST);
  const up = num(FIXED_FIELDS.CALCULATE.UNIT_PRICE);
  const bw = num(FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT);

  // 3つすべて入力されているかチェック
  if (![uc, up, bw].every(v => Number.isFinite(v) && v > 0)) {
    hide(UI_ELEMENTS.FIXED_STEP1_RESULT);
    hide(UI_ELEMENTS.FIXED_STEP2);
    hide(UI_ELEMENTS.FIXED_STEP2_RESULT);
    hide(UI_ELEMENTS.FIXED_STEP3);
    return;
  }

  // 加工前の100gあたり計算
  const beforeCost100 = per100FromPerUnit(uc, bw);
  const beforePrice100 = per100FromPerUnit(up, bw);
  const beforeMarkup = markup(beforeCost100, beforePrice100);

  // 結果を表示
  setText(UI_ELEMENTS.BEFORE_COST_STEP1, yen(toFixed(beforeCost100)));
  setText(UI_ELEMENTS.BEFORE_PRICE_STEP1, yen(toFixed(beforePrice100)));
  setText(UI_ELEMENTS.BEFORE_MARKUP_STEP1, pct(toFixed(beforeMarkup)));

  show(UI_ELEMENTS.FIXED_STEP1_RESULT);
  show(UI_ELEMENTS.FIXED_STEP2);

  // 次のステップの処理をトリガー
  handleStep2();
}

/**
 * Step 2の処理：加工後重量入力→歩留まり率計算（重量から計算モード）
 */
function handleStep2() {
  const bw = num(FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT);
  const aw = num(FIXED_FIELDS.CALCULATE.AFTER_WEIGHT);

  if (![bw, aw].every(v => Number.isFinite(v) && v > 0)) {
    hide(UI_ELEMENTS.FIXED_STEP2_RESULT);
    hide(UI_ELEMENTS.FIXED_STEP3);
    return;
  }

  // 歩留まり率を計算
  const yr = calcYield(bw, aw);
  setText(UI_ELEMENTS.YIELD_RATE_STEP2, pct(toFixed(yr)));

  show(UI_ELEMENTS.FIXED_STEP2_RESULT);
  show(UI_ELEMENTS.FIXED_STEP3);

  // 次のステップの処理をトリガー
  handleStep3();
}

/**
 * Step 3の処理：加工後設定売価入力→最終結果表示（重量から計算モード）
 * 加工後の100gあたり原価・売価・値入率を計算してStep 3結果セクションに表示
 */
function handleStep3() {
  const method = 'calculate';
  const result = calculateFixed(method);

  if (!result) {
    hide(UI_ELEMENTS.FIXED_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);
    return;
  }

  // Step 3結果セクションに加工後の詳細を表示
  setText(UI_ELEMENTS.AFTER_COST_STEP3, yen(toFixed(result.ac)));
  setText(UI_ELEMENTS.AFTER_PRICE_STEP3, yen(toFixed(result.ap)));
  setText(UI_ELEMENTS.AFTER_MARKUP_STEP3, pct(toFixed(result.am)));

  show(UI_ELEMENTS.FIXED_STEP3_RESULT);

  // 最終結果セクションを表示（歩留まり率・加工前・加工後は既に表示済みなので非表示）
  const snapshotData = displayResults(result, 'step');
  appState.updateSnapshot(snapshotData);

  handleProductCalculation();
}

/**
 * Step 1の処理：基本情報入力（歩留まり率直接入力モード）
 */
function handleDirectStep1() {
  const uc = num(FIXED_FIELDS.DIRECT.UNIT_COST);
  const up = num(FIXED_FIELDS.DIRECT.UNIT_PRICE);
  const bw = num(FIXED_FIELDS.DIRECT.BEFORE_WEIGHT);

  // 3つすべて入力されているかチェック
  if (![uc, up, bw].every(v => Number.isFinite(v) && v > 0)) {
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP2);
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP2_RESULT);
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP3);
    return;
  }

  // Step 2の入力欄を表示（結果は表示しない）
  show(UI_ELEMENTS.FIXED_DIRECT_STEP2);

  // 次のステップの処理をトリガー
  handleDirectStep2();
}

/**
 * Step 2の処理：歩留まり率入力→歩留まり率と加工前の情報を表示（歩留まり率直接入力モード）
 */
function handleDirectStep2() {
  const uc = num(FIXED_FIELDS.DIRECT.UNIT_COST);
  const up = num(FIXED_FIELDS.DIRECT.UNIT_PRICE);
  const bw = num(FIXED_FIELDS.DIRECT.BEFORE_WEIGHT);
  const yr = num(FIXED_FIELDS.DIRECT.YIELD_RATE);

  if (!Number.isFinite(yr) || yr <= 0) {
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP2_RESULT);
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP3);
    return;
  }

  // 歩留まり率を表示
  setText(UI_ELEMENTS.YIELD_RATE_DIRECT_STEP2, pct(toFixed(yr)));

  // 加工前の100gあたり計算
  const beforeCost100 = per100FromPerUnit(uc, bw);
  const beforePrice100 = per100FromPerUnit(up, bw);
  const beforeMarkup = markup(beforeCost100, beforePrice100);

  // 加工前の結果を表示
  setText(UI_ELEMENTS.BEFORE_COST_DIRECT_STEP2, yen(toFixed(beforeCost100)));
  setText(UI_ELEMENTS.BEFORE_PRICE_DIRECT_STEP2, yen(toFixed(beforePrice100)));
  setText(UI_ELEMENTS.BEFORE_MARKUP_DIRECT_STEP2, pct(toFixed(beforeMarkup)));

  show(UI_ELEMENTS.FIXED_DIRECT_STEP2_RESULT);
  show(UI_ELEMENTS.FIXED_DIRECT_STEP3);

  // 次のステップの処理をトリガー
  handleDirectStep3();
}

/**
 * Step 3の処理：加工後設定売価入力→最終結果表示（歩留まり率直接入力モード）
 */
function handleDirectStep3() {
  const method = 'direct';
  const result = calculateFixed(method);

  if (!result) {
    hide(UI_ELEMENTS.FIXED_DIRECT_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);
    return;
  }

  // Step 3結果セクションに加工後の詳細を表示
  setText(UI_ELEMENTS.AFTER_COST_DIRECT_STEP3, yen(toFixed(result.ac)));
  setText(UI_ELEMENTS.AFTER_PRICE_DIRECT_STEP3, yen(toFixed(result.ap)));
  setText(UI_ELEMENTS.AFTER_MARKUP_DIRECT_STEP3, pct(toFixed(result.am)));

  show(UI_ELEMENTS.FIXED_DIRECT_STEP3_RESULT);

  // 最終結果セクションを表示（歩留まり率・加工前・加工後は既に表示済みなので非表示）
  const snapshotData = displayResults(result, 'step');
  appState.updateSnapshot(snapshotData);

  handleProductCalculation();
}

/**
 * 計量モードのステップをリセット
 */
function resetWeightSteps() {
  appState.resetStep();

  const method = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`)?.value;

  if (method === 'direct') {
    // 歩留まり率直接入力モード
    show(UI_ELEMENTS.WEIGHT_DIRECT_STEP1);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP1_RESULT);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP2);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP2_RESULT);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP3);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);

    // 入力フィールドをクリア
    [WEIGHT_FIELDS.DIRECT.BOX_COST, WEIGHT_FIELDS.DIRECT.BOX_PRICE,
     WEIGHT_FIELDS.DIRECT.BOX_WEIGHT, WEIGHT_FIELDS.DIRECT.YIELD_RATE,
     WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });

    // 100gあたりの売価表示をクリア
    setText(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, '-');
  } else {
    // 重量から計算モード
    show(UI_ELEMENTS.WEIGHT_STEP1);
    hide(UI_ELEMENTS.WEIGHT_STEP1_RESULT);
    hide(UI_ELEMENTS.WEIGHT_STEP2);
    hide(UI_ELEMENTS.WEIGHT_STEP2_RESULT);
    hide(UI_ELEMENTS.WEIGHT_STEP3);
    hide(UI_ELEMENTS.WEIGHT_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);

    // 入力フィールドをクリア
    [WEIGHT_FIELDS.CALCULATE.BOX_COST, WEIGHT_FIELDS.CALCULATE.BOX_PRICE,
     WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT, WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE,
     WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT, WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });

    // 100gあたりの売価表示をクリア
    setText(UI_ELEMENTS.PER_100G_DISPLAY, '-');
  }
}

/**
 * Step 1の処理：箱の基本情報入力→加工前の計算（計量モード - 重量から計算）
 */
function handleWeightStep1() {
  const bc = num(WEIGHT_FIELDS.CALCULATE.BOX_COST);
  const bp = num(WEIGHT_FIELDS.CALCULATE.BOX_PRICE);
  const bw = num(WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT);

  // 100gあたりの売価をリアルタイム表示
  if (Number.isFinite(bp) && Number.isFinite(bw) && bw > 0) {
    const price100 = per100FromBox(bp, bw);
    setText(UI_ELEMENTS.PER_100G_DISPLAY, yen(toFixed(price100)));
  } else {
    setText(UI_ELEMENTS.PER_100G_DISPLAY, '-');
  }

  // 3つすべて入力されているかチェック
  if (![bc, bp, bw].every(v => Number.isFinite(v) && v > 0)) {
    hide(UI_ELEMENTS.WEIGHT_STEP1_RESULT);
    hide(UI_ELEMENTS.WEIGHT_STEP2);
    hide(UI_ELEMENTS.WEIGHT_STEP2_RESULT);
    hide(UI_ELEMENTS.WEIGHT_STEP3);
    return;
  }

  // 加工前の100gあたり計算
  const beforeCost100 = per100FromBox(bc, bw);
  const beforePrice100 = per100FromBox(bp, bw);
  const beforeMarkup = markup(beforeCost100, beforePrice100);

  // 結果を表示
  setText(UI_ELEMENTS.BEFORE_COST_WEIGHT_STEP1, yen(toFixed(beforeCost100)));
  setText(UI_ELEMENTS.BEFORE_PRICE_WEIGHT_STEP1, yen(toFixed(beforePrice100)));
  setText(UI_ELEMENTS.BEFORE_MARKUP_WEIGHT_STEP1, pct(toFixed(beforeMarkup)));

  show(UI_ELEMENTS.WEIGHT_STEP1_RESULT);
  show(UI_ELEMENTS.WEIGHT_STEP2);

  // 次のステップの処理をトリガー
  handleWeightStep2();
}

/**
 * Step 2の処理：加工前後のサンプル重量入力→歩留まり率計算（計量モード - 重量から計算）
 */
function handleWeightStep2() {
  const bs = num(WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE);
  const aw = num(WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT);

  if (![bs, aw].every(v => Number.isFinite(v) && v > 0)) {
    hide(UI_ELEMENTS.WEIGHT_STEP2_RESULT);
    hide(UI_ELEMENTS.WEIGHT_STEP3);
    return;
  }

  // 歩留まり率を計算
  const yr = calcYield(bs, aw);
  setText(UI_ELEMENTS.YIELD_RATE_WEIGHT_STEP2, pct(toFixed(yr)));

  show(UI_ELEMENTS.WEIGHT_STEP2_RESULT);
  show(UI_ELEMENTS.WEIGHT_STEP3);

  // 次のステップの処理をトリガー
  handleWeightStep3();
}

/**
 * Step 3の処理：加工後設定売価入力→最終結果表示（計量モード - 重量から計算）
 */
function handleWeightStep3() {
  const method = 'calculate';
  const result = calculateWeight(method);

  if (!result) {
    hide(UI_ELEMENTS.WEIGHT_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);
    return;
  }

  // Step 3結果セクションに加工後の詳細を表示
  setText(UI_ELEMENTS.AFTER_COST_WEIGHT_STEP3, yen(toFixed(result.ac)));
  setText(UI_ELEMENTS.AFTER_PRICE_WEIGHT_STEP3, yen(toFixed(result.ap)));
  setText(UI_ELEMENTS.AFTER_MARKUP_WEIGHT_STEP3, pct(toFixed(result.am)));

  show(UI_ELEMENTS.WEIGHT_STEP3_RESULT);

  // 最終結果セクションを表示（歩留まり率・加工前・加工後は既に表示済みなので非表示）
  const snapshotData = displayResults(result, 'step');
  appState.updateSnapshot(snapshotData);

  handleProductCalculation();
}

/**
 * Step 1の処理：箱の基本情報入力（計量モード - 歩留まり率直接入力）
 * 箱の基本情報から加工前の100gあたり原価・売価・値入率を計算して表示
 */
function handleWeightDirectStep1() {
  const bc = num(WEIGHT_FIELDS.DIRECT.BOX_COST);
  const bp = num(WEIGHT_FIELDS.DIRECT.BOX_PRICE);
  const bw = num(WEIGHT_FIELDS.DIRECT.BOX_WEIGHT);

  // 100gあたりの売価をリアルタイム表示
  if (Number.isFinite(bp) && Number.isFinite(bw) && bw > 0) {
    const price100 = per100FromBox(bp, bw);
    setText(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, yen(toFixed(price100)));
  } else {
    setText(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, '-');
  }

  // 3つすべて入力されているかチェック
  if (![bc, bp, bw].every(v => Number.isFinite(v) && v > 0)) {
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP1_RESULT);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP2);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP2_RESULT);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP3);
    return;
  }

  // 加工前の100gあたり計算
  const beforeCost100 = per100FromBox(bc, bw);
  const beforePrice100 = per100FromBox(bp, bw);
  const beforeMarkup = markup(beforeCost100, beforePrice100);

  // 結果を表示
  setText(UI_ELEMENTS.BEFORE_COST_WEIGHT_DIRECT_STEP1, yen(toFixed(beforeCost100)));
  setText(UI_ELEMENTS.BEFORE_PRICE_WEIGHT_DIRECT_STEP1, yen(toFixed(beforePrice100)));
  setText(UI_ELEMENTS.BEFORE_MARKUP_WEIGHT_DIRECT_STEP1, pct(toFixed(beforeMarkup)));

  show(UI_ELEMENTS.WEIGHT_DIRECT_STEP1_RESULT);
  show(UI_ELEMENTS.WEIGHT_DIRECT_STEP2);

  // 次のステップの処理をトリガー
  handleWeightDirectStep2();
}

/**
 * Step 2の処理：歩留まり率入力→歩留まり率を表示（計量モード - 歩留まり率直接入力）
 */
function handleWeightDirectStep2() {
  const yr = num(WEIGHT_FIELDS.DIRECT.YIELD_RATE);

  if (!Number.isFinite(yr) || yr <= 0) {
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP2_RESULT);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP3);
    return;
  }

  // 歩留まり率を表示
  setText(UI_ELEMENTS.YIELD_RATE_WEIGHT_DIRECT_STEP2, pct(toFixed(yr)));

  show(UI_ELEMENTS.WEIGHT_DIRECT_STEP2_RESULT);
  show(UI_ELEMENTS.WEIGHT_DIRECT_STEP3);

  // 次のステップの処理をトリガー
  handleWeightDirectStep3();
}

/**
 * Step 3の処理：加工後設定売価入力→最終結果表示（計量モード - 歩留まり率直接入力）
 */
function handleWeightDirectStep3() {
  const method = 'direct';
  const result = calculateWeight(method);

  if (!result) {
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);
    return;
  }

  // Step 3結果セクションに加工後の詳細を表示
  setText(UI_ELEMENTS.AFTER_COST_WEIGHT_DIRECT_STEP3, yen(toFixed(result.ac)));
  setText(UI_ELEMENTS.AFTER_PRICE_WEIGHT_DIRECT_STEP3, yen(toFixed(result.ap)));
  setText(UI_ELEMENTS.AFTER_MARKUP_WEIGHT_DIRECT_STEP3, pct(toFixed(result.am)));

  show(UI_ELEMENTS.WEIGHT_DIRECT_STEP3_RESULT);

  // 最終結果セクションを表示（歩留まり率・加工前・加工後は既に表示済みなので非表示）
  const snapshotData = displayResults(result, 'step');
  appState.updateSnapshot(snapshotData);

  handleProductCalculation();
}

/**
 * 商品化シミュレーション処理
 */
function handleProductCalculation() {
  const snapshot = appState.getSnapshot();
  const productData = calculateProductSimulation(snapshot);

  if (productData) {
    appState.updateProductData(productData);
    updateDiscountSimulation(productData);
  } else {
    appState.updateProductData({ price: null, markup: null, cost: null });
  }
}

/**
 * 逆算シミュレーションをリセット
 */
function resetReverseSimulation() {
  hide(UI_ELEMENTS.REVERSE_SIM_SECTION);
  hideReverseSimulation();
  // 目標値入率をクリア
  const targetInput = qs(`#${UI_ELEMENTS.TARGET_MARKUP}`);
  if (targetInput) targetInput.value = '';
}

/**
 * 逆算シミュレーションの表示/非表示を切り替え
 */
function toggleReverseSimulation() {
  const section = qs(`#${UI_ELEMENTS.REVERSE_SIM_SECTION}`);
  if (section.classList.contains('is-hidden')) {
    // 現在のモードに応じて歩留まり率ラベルを更新
    const currentMode = appState.getMode();
    let isCalculateMode = true;

    if (currentMode === MODE.FIXED) {
      const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
      isCalculateMode = methodRadio && methodRadio.value === 'calculate';
    } else {
      const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
      isCalculateMode = methodRadio && methodRadio.value === 'calculate';
    }

    const yieldLabel = qs(`#${UI_ELEMENTS.YIELD_CALC_LABEL}`);
    if (yieldLabel) {
      yieldLabel.textContent = isCalculateMode ? '加工後重量（g）' : '歩留まり率（%）';
    }

    show(UI_ELEMENTS.REVERSE_SIM_SECTION);
    handleReverseCalculation();
  } else {
    hide(UI_ELEMENTS.REVERSE_SIM_SECTION);
  }
}

/**
 * 逆算シミュレーション用の入力値を取得
 * @returns {Object} 必要な入力値
 */
function getReverseSimulationInputs() {
  const currentMode = appState.getMode();
  const snapshot = appState.getSnapshot();

  // 基本的な入力値
  const inputs = {
    mode: currentMode,
    afterCost: snapshot.afterCost,
    afterPrice: snapshot.afterPrice,
    yieldRate: snapshot.yieldRate,
    weight: num(UI_ELEMENTS.EXP_WEIGHT),
    consumable: num(UI_ELEMENTS.CONSUMABLE) ?? 0
  };

  if (currentMode === MODE.FIXED) {
    // 定額売価→計量加工
    const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
    inputs.isCalculateMode = methodRadio && methodRadio.value === 'calculate';

    if (inputs.isCalculateMode) {
      // 重量から計算モード
      inputs.unitCost = num(FIXED_FIELDS.CALCULATE.UNIT_COST);
      inputs.unitPrice = num(FIXED_FIELDS.CALCULATE.UNIT_PRICE);
      inputs.beforeWeight = num(FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT);
      inputs.afterWeight = num(FIXED_FIELDS.CALCULATE.AFTER_WEIGHT);
      // 歩留まり率を入力値から計算（snapshotに依存しない）
      if (Number.isFinite(inputs.beforeWeight) && Number.isFinite(inputs.afterWeight)) {
        inputs.yieldRate = calcYield(inputs.beforeWeight, inputs.afterWeight);
      }
      // afterPriceをsnapshotまたは入力フィールドから取得
      if (!Number.isFinite(inputs.afterPrice)) {
        inputs.afterPrice = num(FIXED_FIELDS.CALCULATE.AFTER_PRICE_100);
      }
      // afterCostをsnapshotまたは入力フィールドから計算
      if (!Number.isFinite(inputs.afterCost)) {
        const beforeCost = per100FromPerUnit(inputs.unitCost, inputs.beforeWeight);
        if (Number.isFinite(beforeCost) && Number.isFinite(inputs.yieldRate)) {
          inputs.afterCost = afterCostPer100(beforeCost, inputs.yieldRate);
        }
      }
      // beforeCostを計算（歩留まり率逆算用）
      inputs.beforeCost = per100FromPerUnit(inputs.unitCost, inputs.beforeWeight);
    } else {
      // 歩留まり率を直接入力モード
      inputs.unitCost = num(FIXED_FIELDS.DIRECT.UNIT_COST);
      inputs.unitPrice = num(FIXED_FIELDS.DIRECT.UNIT_PRICE);
      inputs.beforeWeight = num(FIXED_FIELDS.DIRECT.BEFORE_WEIGHT);
      inputs.yieldRateDirect = num(FIXED_FIELDS.DIRECT.YIELD_RATE);
      // afterPriceをsnapshotまたは入力フィールドから取得
      if (!Number.isFinite(inputs.afterPrice)) {
        inputs.afterPrice = num(FIXED_FIELDS.DIRECT.AFTER_PRICE_100);
      }
      // afterCostをsnapshotまたは入力フィールドから計算
      if (!Number.isFinite(inputs.afterCost)) {
        const beforeCost = per100FromPerUnit(inputs.unitCost, inputs.beforeWeight);
        if (Number.isFinite(beforeCost) && Number.isFinite(inputs.yieldRateDirect)) {
          inputs.afterCost = afterCostPer100(beforeCost, inputs.yieldRateDirect);
        }
      }
      // beforeCostを計算（歩留まり率逆算用）
      inputs.beforeCost = per100FromPerUnit(inputs.unitCost, inputs.beforeWeight);
    }
  } else {
    // 計量売価→計量加工
    const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
    inputs.isCalculateMode = methodRadio && methodRadio.value === 'calculate';

    if (inputs.isCalculateMode) {
      // 重量から計算モード
      inputs.boxCost = num(WEIGHT_FIELDS.CALCULATE.BOX_COST);
      inputs.boxPrice = num(WEIGHT_FIELDS.CALCULATE.BOX_PRICE);
      inputs.boxWeight = num(WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT);
      inputs.beforeSample = num(WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE);
      inputs.afterWeight = num(WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT);
      // 歩留まり率を入力値から計算（snapshotに依存しない）
      if (Number.isFinite(inputs.beforeSample) && Number.isFinite(inputs.afterWeight)) {
        inputs.yieldRate = calcYield(inputs.beforeSample, inputs.afterWeight);
      }
      // afterPriceをsnapshotまたは入力フィールドから取得
      if (!Number.isFinite(inputs.afterPrice)) {
        inputs.afterPrice = num(WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100);
      }
      // afterCostをsnapshotまたは入力フィールドから計算
      if (!Number.isFinite(inputs.afterCost)) {
        const beforeCost = per100FromBox(inputs.boxCost, inputs.boxWeight);
        if (Number.isFinite(beforeCost) && Number.isFinite(inputs.yieldRate)) {
          inputs.afterCost = afterCostPer100(beforeCost, inputs.yieldRate);
        }
      }
      // beforeCostを計算（歩留まり率逆算用）
      inputs.beforeCost = per100FromBox(inputs.boxCost, inputs.boxWeight);
    } else {
      // 歩留まり率を直接入力モード
      inputs.boxCost = num(WEIGHT_FIELDS.DIRECT.BOX_COST);
      inputs.boxPrice = num(WEIGHT_FIELDS.DIRECT.BOX_PRICE);
      inputs.boxWeight = num(WEIGHT_FIELDS.DIRECT.BOX_WEIGHT);
      inputs.yieldRateDirect = num(WEIGHT_FIELDS.DIRECT.YIELD_RATE);
      // afterPriceをsnapshotまたは入力フィールドから取得
      if (!Number.isFinite(inputs.afterPrice)) {
        inputs.afterPrice = num(WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100);
      }
      // afterCostをsnapshotまたは入力フィールドから計算
      if (!Number.isFinite(inputs.afterCost)) {
        const beforeCost = per100FromBox(inputs.boxCost, inputs.boxWeight);
        if (Number.isFinite(beforeCost) && Number.isFinite(inputs.yieldRateDirect)) {
          inputs.afterCost = afterCostPer100(beforeCost, inputs.yieldRateDirect);
        }
      }
      // beforeCostを計算（歩留まり率逆算用）
      inputs.beforeCost = per100FromBox(inputs.boxCost, inputs.boxWeight);
    }
  }

  return inputs;
}

/**
 * 逆算シミュレーションのラベルのみを更新（計算は行わない）
 */
function updateReverseSimulationLabels() {
  // 逆算シミュレーションが表示されていない場合は何もしない
  const reverseSimSection = qs(`#${UI_ELEMENTS.REVERSE_SIM_SECTION}`);
  if (!reverseSimSection || reverseSimSection.classList.contains('is-hidden')) {
    return;
  }

  const currentMode = appState.getMode();

  // 現在のモードに応じて「原価」ラベルを動的に変更
  const costLabel = qs('#reverseCostLabel');
  if (costLabel) {
    if (currentMode === MODE.FIXED) {
      costLabel.textContent = '1個あたりの原価（円）';
    } else {
      costLabel.textContent = '1箱あたりの原価（円）';
    }
  }

  // 入力方法に応じて「加工後重量/歩留まり率」ラベルを動的に変更
  const yieldLabel = qs('#reverseYieldLabel');
  if (yieldLabel) {
    let isCalculateMode = true;
    if (currentMode === MODE.FIXED) {
      const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
      isCalculateMode = methodRadio && methodRadio.value === 'calculate';
    } else {
      const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
      isCalculateMode = methodRadio && methodRadio.value === 'calculate';
    }
    yieldLabel.textContent = isCalculateMode ? '加工後重量（g）' : '歩留まり率（%）';
  }
}

/**
 * 逆算シミュレーション処理
 */
function handleReverseCalculation() {
  const snapshot = appState.getSnapshot();
  const targetMarkup = num(UI_ELEMENTS.TARGET_MARKUP);
  const productData = appState.getProductData();
  const currentMode = appState.getMode();

  console.log('[逆算] handleReverseCalculation called', {
    snapshot,
    targetMarkup,
    productData,
    currentMode
  });

  // ラベルを更新
  updateReverseSimulationLabels();

  // どのラジオボタンが選択されているか取得
  const selectedRadio = document.querySelector(`input[name="${RADIO_NAMES.REVERSE_CALC_TARGET}"]:checked`);
  if (!selectedRadio) {
    console.log('[逆算] ラジオボタンが選択されていません');
    displayReverseError('計算エラー', '計算する項目を選択してください');
    return;
  }

  const calcTarget = selectedRadio.value;
  console.log('[逆算] 計算対象:', calcTarget);

  // 値引率計算の場合は別処理
  if (calcTarget === 'discount') {
    if (!Number.isFinite(targetMarkup)) {
      console.log('[逆算] 目標値入率が未入力のため、結果を非表示にします');
      hideReverseSimulation();
      return;
    }
    if (!Number.isFinite(productData.markup)) {
      displayReverseError('計算エラー', '商品化シミュレーションを完了してください');
      return;
    }
    const result = calculateDiscountRateFromGross(productData.markup, targetMarkup);
    const currentDiscountRate = num(UI_ELEMENTS.DISCOUNT_RATE) ?? 0; // 現在の値引率
    if (result !== null && Number.isFinite(result)) {
      if (result < 0) {
        displayReverseError('値引率', `目標粗利率は${toFixed(productData.markup)}%以下で設定してください`);
      } else if (result > 100) {
        displayReverseError('値引率', `目標粗利率は${toFixed(productData.markup)}%以下で設定してください`);
      } else {
        displayReverseSimulation(result, '必要な値引率', '%', currentDiscountRate);
        // 結果の値を保存（クリック時に使用）
        const reverseResultStat = qs(`#${UI_ELEMENTS.REVERSE_RESULT_STAT}`);
        if (reverseResultStat) {
          reverseResultStat.dataset.calcTarget = calcTarget;
          reverseResultStat.dataset.calcValue = result.toString();
        }
      }
    } else {
      displayReverseError('値引率', `目標粗利率は${toFixed(productData.markup)}%以下で設定してください`);
    }
    return;
  }

  // 目標値入率が未入力の場合は、エラーを表示せず静かに待つ
  if (!Number.isFinite(targetMarkup)) {
    console.log('[逆算] 目標値入率が未入力のため、結果を非表示にします');
    hideReverseSimulation();
    return;
  }

  // 通常の計算の必須データチェック
  // 原価逆算ではafterCostは不要（afterPriceから逆算するため）
  if (calcTarget === 'cost') {
    if (!Number.isFinite(snapshot.afterPrice)) {
      console.log('[逆算] 必須データ不足（原価計算）', {
        afterPrice: snapshot.afterPrice
      });
      displayReverseError('計算エラー', 'ステップ3まで入力して加工後の売価を計算してください');
      return;
    }
  } else {
    if (!Number.isFinite(snapshot.afterCost) || !Number.isFinite(snapshot.afterPrice)) {
      console.log('[逆算] 必須データ不足（通常計算）', {
        afterCost: snapshot.afterCost,
        afterPrice: snapshot.afterPrice
      });
      displayReverseError('計算エラー', 'ステップ3まで入力して加工後の原価・売価を計算してください');
      return;
    }
  }

  // 入力値を一括取得（モード・入力方法別に構造化）
  const inputs = getReverseSimulationInputs();

  let result = null;
  let label = '';
  let unit = '';
  let errorMsg = '';
  let currentValue = null; // 現在の値を格納

  switch (calcTarget) {
    case 'weight':
      result = calculateWeightFromMarkup(inputs.afterCost, inputs.afterPrice, targetMarkup, inputs.consumable);
      label = '必要な重量';
      unit = 'g';
      currentValue = inputs.weight; // 現在の重量
      if (result === null) {
        if (inputs.consumable === 0) {
          // 消耗品費が0の場合、重量に依存しないので特別なメッセージ
          const actualMarkup = ((inputs.afterPrice - inputs.afterCost) / inputs.afterPrice) * 100;
          errorMsg = `消耗品費が0の場合、重量に関係なく値入率は${toFixed(actualMarkup)}%になります。値引後最終粗利率を${toFixed(actualMarkup)}%に設定してください。`;
        } else {
          const maxMarkup = ((inputs.afterPrice - inputs.afterCost) / inputs.afterPrice) * 100;
          errorMsg = `目標値入率が${toFixed(maxMarkup)}%を超えます。値引後最終粗利率を0〜${toFixed(maxMarkup)}%の範囲で設定してください。`;
        }
      }
      break;

    case 'price':
      if (!Number.isFinite(inputs.weight) || inputs.weight <= 0) {
        displayReverseError('加工後設定売価', '1パックに入れる予定重量を入力してください');
        return;
      }
      result = calculatePriceFromMarkup(inputs.afterCost, inputs.weight, targetMarkup, inputs.consumable);
      label = '必要な100gあたり売価';
      unit = '円';
      currentValue = inputs.afterPrice; // 現在の100gあたり売価
      if (result === null) {
        errorMsg = '値引後最終粗利率が100%以上は計算できません。値引後最終粗利率を0〜99.99%の範囲で設定してください。';
      }
      break;

    case 'cost':
      // 原価の逆算（モード・入力方法に応じて異なる）
      if (!Number.isFinite(inputs.weight) || inputs.weight <= 0) {
        displayReverseError(currentMode === MODE.FIXED ? '1個あたりの原価' : '1箱あたりの原価', '1パックに入れる予定重量を入力してください');
        return;
      }

      if (currentMode === MODE.FIXED) {
        // ========================================
        // 定額売価→計量加工: 1個あたりの原価を逆算
        // ========================================
        if (!Number.isFinite(inputs.beforeWeight) || inputs.beforeWeight <= 0) {
          displayReverseError('1個あたりの原価', '加工前重量を入力してください');
          return;
        }

        // 使用する歩留まり率を判定
        const yieldRateToUse = inputs.isCalculateMode ? inputs.yieldRate : inputs.yieldRateDirect;
        if (!Number.isFinite(yieldRateToUse) || yieldRateToUse <= 0) {
          displayReverseError('1個あたりの原価', inputs.isCalculateMode ? '加工後重量を入力してください' : '歩留まり率を入力してください');
          return;
        }

        result = calculateUnitCostFromMarkup(
          inputs.afterPrice,
          inputs.beforeWeight,
          yieldRateToUse,
          inputs.weight,
          targetMarkup,
          inputs.consumable
        );
        label = '必要な1個あたりの原価';
        currentValue = inputs.unitCost; // 現在の1個あたりの原価
      } else {
        // ========================================
        // 計量売価→計量加工: 1箱あたりの原価を逆算
        // ========================================
        if (!Number.isFinite(inputs.boxWeight) || inputs.boxWeight <= 0) {
          displayReverseError('1箱あたりの原価', '1箱あたりの重量を入力してください');
          return;
        }

        // 使用する歩留まり率を判定
        const yieldRateToUse = inputs.isCalculateMode ? inputs.yieldRate : inputs.yieldRateDirect;
        if (!Number.isFinite(yieldRateToUse) || yieldRateToUse <= 0) {
          displayReverseError('1箱あたりの原価', inputs.isCalculateMode ? '加工後重量を入力してください' : '歩留まり率を入力してください');
          return;
        }

        result = calculateBoxCostFromMarkup(
          inputs.afterPrice,
          inputs.boxWeight,
          yieldRateToUse,
          inputs.weight,
          targetMarkup,
          inputs.consumable
        );
        label = '必要な1箱あたりの原価';
        currentValue = inputs.boxCost; // 現在の1箱あたりの原価
      }
      unit = '円';
      if (result === null || result < 0) {
        if (Number.isFinite(inputs.afterCost) && Number.isFinite(inputs.afterPrice)) {
          const maxMarkup = ((inputs.afterPrice - inputs.afterCost) / inputs.afterPrice) * 100;
          errorMsg = `目標値入率が${toFixed(maxMarkup)}%を超えます。値引後最終粗利率を0〜${toFixed(maxMarkup)}%の範囲で設定してください。`;
        } else {
          errorMsg = '計算に必要な情報が不足しています。入力値を確認してください。';
        }
      }
      break;

    case 'yield':
      // 加工後重量 or 歩留まり率の逆算（入力方法に応じて異なる）
      if (!Number.isFinite(inputs.weight) || inputs.weight <= 0) {
        displayReverseError(inputs.isCalculateMode ? '加工後重量' : '歩留まり率', '1パックに入れる予定重量を入力してください');
        return;
      }

      if (inputs.isCalculateMode) {
        // ========================================
        // 重量から計算モード: 加工後重量を逆算
        // ========================================
        const beforeWeight = currentMode === MODE.FIXED ? inputs.beforeWeight : inputs.beforeSample;
        if (!Number.isFinite(beforeWeight) || beforeWeight <= 0) {
          displayReverseError('加工後重量', '加工前重量を入力してください');
          return;
        }
        if (!Number.isFinite(inputs.beforeCost) || inputs.beforeCost <= 0) {
          displayReverseError('加工後重量', '加工前の原価を入力してください');
          return;
        }
        result = calculateAfterWeightFromMarkup(
          beforeWeight,
          inputs.beforeCost,
          inputs.afterPrice,
          inputs.weight,
          targetMarkup,
          inputs.consumable
        );
        label = '必要な加工後重量';
        unit = 'g';
        currentValue = inputs.afterWeight; // 現在の加工後重量
        if (result === null) {
          // 計算可能な最大値入率を算出
          if (Number.isFinite(inputs.beforeCost) && Number.isFinite(inputs.afterPrice)) {
            const maxMarkup = ((inputs.afterPrice - inputs.beforeCost) / inputs.afterPrice) * PERCENT_MULTIPLIER;
            errorMsg = `目標値入率が${toFixed(maxMarkup)}%を超えます。値引後最終粗利率を0〜${toFixed(maxMarkup)}%の範囲で設定してください。`;
          } else {
            errorMsg = '計算に必要な情報が不足しています。入力値を確認してください。';
          }
        }
      } else {
        // ========================================
        // 歩留まり率を直接入力モード: 歩留まり率を逆算
        // ========================================
        if (!Number.isFinite(inputs.beforeCost) || inputs.beforeCost <= 0) {
          displayReverseError('歩留まり率', '加工前の原価を入力してください');
          return;
        }
        result = calculateYieldRateFromMarkup(
          inputs.beforeCost,
          inputs.afterPrice,
          inputs.weight,
          targetMarkup,
          inputs.consumable
        );
        label = '必要な歩留まり率';
        unit = '%';
        // 入力方法に応じて現在の歩留まり率を取得
        currentValue = inputs.isCalculateMode ? inputs.yieldRate : inputs.yieldRateDirect;
        if (result === null) {
          // 計算可能な最大値入率を算出
          if (Number.isFinite(inputs.beforeCost) && Number.isFinite(inputs.afterPrice)) {
            const maxMarkup = ((inputs.afterPrice - inputs.beforeCost) / inputs.afterPrice) * PERCENT_MULTIPLIER;
            errorMsg = `目標値入率が${toFixed(maxMarkup)}%を超えます。値引後最終粗利率を0〜${toFixed(maxMarkup)}%の範囲で設定してください。`;
          } else {
            errorMsg = '計算に必要な情報が不足しています。入力値を確認してください。';
          }
        }
      }
      break;
  }

  console.log('[逆算] 計算結果:', { result, label, unit, currentValue, errorMsg });

  if (result !== null && Number.isFinite(result) && result >= 0) {
    console.log('[逆算] 結果を表示します');
    displayReverseSimulation(result, label, unit, currentValue);
    // 結果の値を保存（クリック時に使用）
    const reverseResultStat = qs(`#${UI_ELEMENTS.REVERSE_RESULT_STAT}`);
    if (reverseResultStat) {
      reverseResultStat.dataset.calcTarget = calcTarget;
      reverseResultStat.dataset.calcValue = result.toString();
    }
  } else {
    console.log('[逆算] エラーを表示します:', errorMsg || '計算できませんでした');
    displayReverseError(label, errorMsg || '計算できませんでした。条件を見直してください');
  }
}

/**
 * 逆算シミュレーション結果を適用
 */
function applyReverseSimulationResult() {
  const reverseResultStat = qs(`#${UI_ELEMENTS.REVERSE_RESULT_STAT}`);
  if (!reverseResultStat) return;

  const calcTarget = reverseResultStat.dataset.calcTarget;
  const calcValue = parseFloat(reverseResultStat.dataset.calcValue);

  if (!calcTarget || !Number.isFinite(calcValue)) return;

  const currentMode = appState.getMode();
  let targetElement = null;

  switch (calcTarget) {
    case 'weight':
      // 1パックに入れる予定重量
      targetElement = qs(`#${UI_ELEMENTS.EXP_WEIGHT}`);
      break;

    case 'price':
      // 加工後設定売価（モードに応じて異なる）
      if (currentMode === MODE.FIXED) {
        const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
        const isCalculateMode = methodRadio && methodRadio.value === 'calculate';
        targetElement = qs(`#${isCalculateMode ? FIXED_FIELDS.CALCULATE.AFTER_PRICE_100 : FIXED_FIELDS.DIRECT.AFTER_PRICE_100}`);
      } else {
        const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
        const isCalculateMode = methodRadio && methodRadio.value === 'calculate';
        targetElement = qs(`#${isCalculateMode ? WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100 : WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100}`);
      }
      break;

    case 'cost':
      // ========================================
      // 原価の適用（モード・入力方法に応じて異なる）
      // ========================================
      if (currentMode === MODE.FIXED) {
        // 定額売価→計量加工: 1個あたりの原価
        const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
        const isCalculateMode = methodRadio && methodRadio.value === 'calculate';
        // 重量から計算モード: unitCost（計算用）
        // 歩留まり率直接入力モード: unitCostDirect（直接入力用）
        targetElement = qs(`#${isCalculateMode ? FIXED_FIELDS.CALCULATE.UNIT_COST : FIXED_FIELDS.DIRECT.UNIT_COST}`);
      } else {
        // 計量売価→計量加工: 1箱あたりの原価
        const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
        const isCalculateMode = methodRadio && methodRadio.value === 'calculate';
        // 重量から計算モード: boxCost（計算用）
        // 歩留まり率直接入力モード: boxCostDirect（直接入力用）
        targetElement = qs(`#${isCalculateMode ? WEIGHT_FIELDS.CALCULATE.BOX_COST : WEIGHT_FIELDS.DIRECT.BOX_COST}`);
      }
      break;

    case 'yield':
      // ========================================
      // 加工後重量 or 歩留まり率の適用（入力方法に応じて異なる）
      // ========================================
      if (currentMode === MODE.FIXED) {
        const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
        const isCalculateMode = methodRadio && methodRadio.value === 'calculate';
        // 重量から計算モード: afterWeight（加工後重量）
        // 歩留まり率直接入力モード: yieldRateDirect（歩留まり率）
        targetElement = qs(`#${isCalculateMode ? FIXED_FIELDS.CALCULATE.AFTER_WEIGHT : FIXED_FIELDS.DIRECT.YIELD_RATE}`);
      } else {
        const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
        const isCalculateMode = methodRadio && methodRadio.value === 'calculate';
        // 重量から計算モード: afterWeightW（加工後重量）
        // 歩留まり率直接入力モード: yieldRateDirectW（歩留まり率）
        targetElement = qs(`#${isCalculateMode ? WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT : WEIGHT_FIELDS.DIRECT.YIELD_RATE}`);
      }
      break;

    case 'discount':
      // 値引率
      targetElement = qs(`#${UI_ELEMENTS.DISC_INPUT}`);
      // スライダーも更新
      const slider = qs(`#${UI_ELEMENTS.DISC_SLIDER}`);
      if (slider) slider.value = Math.min(calcValue, 50);
      break;
  }

  if (targetElement) {
    targetElement.value = toFixed(calcValue);
    // inputイベントをトリガーして再計算を実行
    targetElement.dispatchEvent(new Event('input', { bubbles: true }));

    // 逆算シミュレーションを閉じる
    resetReverseSimulation();

    // 要素までスクロールしてフォーカスを当てる
    setTimeout(() => {
      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetElement.focus();
      // モバイルでの視認性向上のため、一時的にハイライト
      targetElement.style.transition = 'background-color 0.3s';
      const originalBg = targetElement.style.backgroundColor;
      targetElement.style.backgroundColor = '#fff3cd';
      setTimeout(() => {
        targetElement.style.backgroundColor = originalBg;
      }, 1000);
    }, 100);
  }
}

/**
 * 値引き更新処理
 */
function handleDiscountUpdate() {
  const productData = appState.getProductData();
  updateDiscountSimulation(productData);
}

/**
 * 歩留まり率統計モード: エントリ数カウンター
 */
let yieldStatsEntryCounter = 0;

/**
 * 歩留まり率統計モード: テーブルをリセット
 */
function resetYieldStatsEntries() {
  yieldStatsEntryCounter = 0;
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (tbody) {
    tbody.innerHTML = '';
    // 初期行を1行追加
    addYieldStatsRow();
  }
  // 統計結果をリセット
  hide('yieldStatsResults');

  // 外れ値の除外状態をリセット
  manuallyExcludedOutlierIndices.clear();
  currentOutlierValues = [];
}

/**
 * 歩留まり率統計モード: 新しい行を追加
 */
function addYieldStatsRow() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  const rowId = yieldStatsEntryCounter++;
  const row = document.createElement('tr');
  row.id = `yieldStatsRow${rowId}`;
  row.className = 'yield-stats-row';
  row.dataset.rowId = rowId;

  row.innerHTML = `
    <td class="row-number">${rowId + 1}</td>
    <td>
      <input type="number"
             id="${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}"
             class="table-input"
             step="0.01"
             inputmode="decimal"
             placeholder="300"
             data-row-id="${rowId}" />
    </td>
    <td>
      <input type="number"
             id="${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}"
             class="table-input"
             step="0.01"
             inputmode="decimal"
             placeholder="150"
             data-row-id="${rowId}" />
    </td>
    <td class="yield-result" id="${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}">-</td>
  `;

  tbody.appendChild(row);

  // 入力イベントリスナーを追加
  const beforeWeightInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
  const afterWeightInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);

  const handleYieldStatsInput = () => {
    const beforeWeight = parseFloat(beforeWeightInput.value);
    const afterWeight = parseFloat(afterWeightInput.value);
    const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}`);
    const hasBeforeWeight = beforeWeightInput.value.trim() !== '';
    const hasAfterWeight = afterWeightInput.value.trim() !== '';

    // 両方空の場合は上詰め処理（複数行ある場合のみ）
    if (!hasBeforeWeight && !hasAfterWeight) {
      // 結果をクリア
      yieldRateDisplay.textContent = '-';
      yieldRateDisplay.classList.remove('calculated', 'error');

      // 複数行ある場合のみ上詰め処理を実行
      setTimeout(() => {
        const allRows = tbody.querySelectorAll('.yield-stats-row');
        if (allRows.length > 1) {
          compactYieldStatsRows();
        } else {
          // 1行しかない場合は統計を非表示
          updateYieldStatsStatistics();
        }
      }, 100);
      return;
    }

    // どちらか片方だけ入力されている場合はエラー表示
    if ((hasBeforeWeight && !hasAfterWeight) || (!hasBeforeWeight && hasAfterWeight)) {
      yieldRateDisplay.textContent = 'エラー';
      yieldRateDisplay.classList.add('error');
      yieldRateDisplay.classList.remove('calculated');
      updateYieldStatsStatistics();
      return;
    }

    // 両方入力されている場合は計算
    if (beforeWeight > 0 && afterWeight > 0) {
      const yieldRate = calculateYieldRate(beforeWeight, afterWeight);
      if (yieldRate !== null) {
        yieldRateDisplay.textContent = pct(toFixed(yieldRate));
        yieldRateDisplay.classList.add('calculated');
        yieldRateDisplay.classList.remove('error');

        // 最後の行に値が入力されたら、新しい行を追加
        const allRows = tbody.querySelectorAll('.yield-stats-row');
        const lastRow = allRows[allRows.length - 1];
        if (lastRow.id === `yieldStatsRow${rowId}`) {
          addYieldStatsRow();
        }

        // 統計情報を更新
        updateYieldStatsStatistics();
      } else {
        yieldRateDisplay.textContent = '-';
        yieldRateDisplay.classList.remove('calculated', 'error');
      }
    } else {
      yieldRateDisplay.textContent = '-';
      yieldRateDisplay.classList.remove('calculated', 'error');
    }
  };

  beforeWeightInput?.addEventListener('input', handleYieldStatsInput);
  afterWeightInput?.addEventListener('input', handleYieldStatsInput);
}

/**
 * 歩留まり率統計モード: 空行を上詰めする
 */
function compactYieldStatsRows() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  const allRows = Array.from(tbody.querySelectorAll('.yield-stats-row'));
  const validRows = [];

  // データがある行だけを抽出
  allRows.forEach(row => {
    const rowId = row.dataset.rowId;
    const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
    const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);

    const hasBeforeWeight = beforeInput && beforeInput.value.trim() !== '';
    const hasAfterWeight = afterInput && afterInput.value.trim() !== '';

    // どちらか一方でも値がある行は残す
    if (hasBeforeWeight || hasAfterWeight) {
      validRows.push({
        beforeValue: beforeInput.value,
        afterValue: afterInput.value
      });
    }
  });

  // テーブルを再構築
  yieldStatsEntryCounter = 0;
  tbody.innerHTML = '';

  // 有効な行を追加
  if (validRows.length > 0) {
    validRows.forEach(rowData => {
      addYieldStatsRow();
      const newRowId = yieldStatsEntryCounter - 1;
      const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${newRowId}`);
      const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${newRowId}`);

      beforeInput.value = rowData.beforeValue;
      afterInput.value = rowData.afterValue;

      // 計算を直接実行（イベント発火ではなく）
      const hasBeforeWeight = rowData.beforeValue.trim() !== '';
      const hasAfterWeight = rowData.afterValue.trim() !== '';
      const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${newRowId}`);

      if (hasBeforeWeight && hasAfterWeight) {
        const beforeWeight = parseFloat(rowData.beforeValue);
        const afterWeight = parseFloat(rowData.afterValue);
        if (beforeWeight > 0 && afterWeight > 0) {
          const yieldRate = calculateYieldRate(beforeWeight, afterWeight);
          if (yieldRate !== null) {
            yieldRateDisplay.textContent = pct(toFixed(yieldRate));
            yieldRateDisplay.classList.add('calculated');
            yieldRateDisplay.classList.remove('error');
          }
        }
      } else if (hasBeforeWeight || hasAfterWeight) {
        // 片方だけ入力されている場合はエラー
        yieldRateDisplay.textContent = 'エラー';
        yieldRateDisplay.classList.add('error');
        yieldRateDisplay.classList.remove('calculated');
      }
    });

    // 最後の有効な行の両方のフィールドに値が入っている場合のみ新しい行を追加
    const lastRow = validRows[validRows.length - 1];
    const lastHasBothValues = lastRow.beforeValue.trim() !== '' && lastRow.afterValue.trim() !== '';

    if (lastHasBothValues) {
      addYieldStatsRow();
    }
  } else {
    // データがない場合は1行追加
    addYieldStatsRow();
  }

  // 統計情報を更新
  updateYieldStatsStatistics();
}

/**
 * 歩留まり率統計モード: 統計情報を更新
 */
function updateYieldStatsStatistics() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // 3種類のデータを収集
  const yieldRates = [];
  const beforeWeights = [];
  const afterWeights = [];
  const allRows = tbody.querySelectorAll('.yield-stats-row');

  allRows.forEach(row => {
    const rowId = row.dataset.rowId;
    const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
    const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);
    const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}`);

    // 歩留まり率
    if (yieldRateDisplay.classList.contains('calculated')) {
      const rateText = yieldRateDisplay.textContent.replace('%', '');
      const rate = parseFloat(rateText);
      if (!isNaN(rate)) {
        yieldRates.push(rate);
      }
    }

    // 加工前重量
    if (beforeInput && beforeInput.value.trim() !== '') {
      const beforeWeight = parseFloat(beforeInput.value);
      if (!isNaN(beforeWeight) && beforeWeight > 0) {
        beforeWeights.push(beforeWeight);
      }
    }

    // 加工後重量
    if (afterInput && afterInput.value.trim() !== '') {
      const afterWeight = parseFloat(afterInput.value);
      if (!isNaN(afterWeight) && afterWeight > 0) {
        afterWeights.push(afterWeight);
      }
    }
  });

  // データを保存（表示切り替えに使用）
  window.yieldStatsData = {
    yieldRate: yieldRates,
    beforeWeight: beforeWeights,
    afterWeight: afterWeights
  };

  // データが2つ以上ある場合のみ統計を表示
  const hasEnoughData = yieldRates.length >= 2 || beforeWeights.length >= 2 || afterWeights.length >= 2;

  if (hasEnoughData) {
    displayCurrentStatistics();
    show('yieldStatsResults');
  } else {
    hide('yieldStatsResults');
  }
}

/**
 * 統計値を計算
 */
function calculateStatistics(values) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);

  // 平均値
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // 標準偏差
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // 中央値
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // 最大値・最小値
  const max = sorted[n - 1];
  const min = sorted[0];

  // 範囲
  const range = max - min;

  // 四分位数
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1; // 四分位範囲

  // 変動係数（CV）
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  // 歪度（Skewness）
  const skewness = (n > 2 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / n
    : 0;

  // 尖度（Kurtosis）- 超過尖度
  const kurtosis = (n > 3 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) / n - 3
    : 0;

  // σ範囲
  const sigma1 = { lower: mean - stdDev, upper: mean + stdDev };
  const sigma2 = { lower: mean - 2 * stdDev, upper: mean + 2 * stdDev };
  const sigma3 = { lower: mean - 3 * stdDev, upper: mean + 3 * stdDev };

  return {
    count: n,
    mean,
    median,
    stdDev,
    max,
    min,
    range,
    q1,
    q3,
    iqr,
    cv,
    skewness,
    kurtosis,
    sigma1,
    sigma2,
    sigma3,
    sorted // ソート済みデータも返す（グラフ描画用）
  };
}

/**
 * 現在選択されている統計タイプの統計を表示
 */
function displayCurrentStatistics() {
  const selectElement = qs('#statsTypeSelect');
  const selectedType = selectElement?.value || 'yieldRate';
  const data = window.yieldStatsData;

  // 統計タイプが変更されたら外れ値の除外状態をリセット
  manuallyExcludedOutlierIndices.clear();
  currentOutlierValues = [];

  if (!data) return;

  const values = data[selectedType];
  if (!values || values.length < 2) {
    // データが不足している場合は非表示
    hide('yieldStatsResults');
    return;
  }

  const stats = calculateStatistics(values);

  // 統計タイプに応じた単位を設定
  let unit = '';
  let typeName = '';
  if (selectedType === 'yieldRate') {
    unit = '%';
    typeName = '歩留まり率';
  } else if (selectedType === 'beforeWeight') {
    unit = 'g';
    typeName = '加工前重量';
  } else if (selectedType === 'afterWeight') {
    unit = 'g';
    typeName = '加工後重量';
  }

  displayStatistics(stats, unit);
  renderStatsChart(values, stats, typeName, unit);

  // サンプルサイズ妥当性判断の単位と表示を更新
  updateToleranceUnit();
  displaySampleSizeValidation();
}

/**
 * 統計値を表示
 */
function displayStatistics(stats, unit = '%') {
  const formatValue = (value) => {
    if (unit === '%') {
      return pct(toFixed(value));
    } else {
      return `${toFixed(value)}${unit}`;
    }
  };

  // 基本統計量
  setText('statsCount', `${stats.count}個`);
  setText('statsMax', formatValue(stats.max));
  setText('statsMin', formatValue(stats.min));
  setText('statsRange', formatValue(stats.range));
  setText('statsAvg', formatValue(stats.mean));
  setText('statsMedian', formatValue(stats.median));
  setText('statsStdDev', formatValue(stats.stdDev));
  setText('statsCV', `${toFixed(stats.cv)}%`);

  // 四分位数
  setText('statsQ1', formatValue(stats.q1));
  setText('statsQ3', formatValue(stats.q3));
  setText('statsIQR', formatValue(stats.iqr));

  // 分布の形状
  setText('statsSkewness', toFixed(stats.skewness, 3));
  setText('statsKurtosis', toFixed(stats.kurtosis, 3));

  // σ範囲
  setText('statsSigma1', `${formatValue(stats.sigma1.lower)} ～ ${formatValue(stats.sigma1.upper)}`);
  setText('statsSigma2', `${formatValue(stats.sigma2.lower)} ～ ${formatValue(stats.sigma2.upper)}`);
  setText('statsSigma3', `${formatValue(stats.sigma3.lower)} ～ ${formatValue(stats.sigma3.upper)}`);
}

/**
 * 外れ値を検出（IQR法）
 * @param {Array<number>} values - データ配列
 * @param {Object} stats - 統計データ
 * @returns {Object} { outliers: 外れ値の配列, cleanedValues: 外れ値を除外したデータ, lowerBound: 下限, upperBound: 上限 }
 */
function detectOutliers(values, stats) {
  // IQR法: Q1 - 1.5*IQR より小さい、またはQ3 + 1.5*IQR より大きい値を外れ値とする
  const lowerBound = stats.q1 - 1.5 * stats.iqr;
  const upperBound = stats.q3 + 1.5 * stats.iqr;

  const outliers = [];
  const cleanedValues = [];

  values.forEach(value => {
    if (value < lowerBound || value > upperBound) {
      outliers.push(value);
    } else {
      cleanedValues.push(value);
    }
  });

  return {
    outliers,
    cleanedValues,
    lowerBound,
    upperBound
  };
}

/**
 * 必要サンプルサイズを計算
 * @param {number} stdDev - 標準偏差
 * @param {number} toleranceError - 許容誤差（E）
 * @param {number} confidenceLevel - 信頼水準（90, 95, 99）
 * @returns {number} 必要サンプルサイズ
 */
function calculateRequiredSampleSize(stdDev, toleranceError, confidenceLevel) {
  // 標準偏差がゼロの場合（全データが同じ値）は計算不要
  if (stdDev === 0) {
    return 1; // 最小サンプルサイズ
  }

  // Z値のマッピング
  const zValues = {
    90: 1.645,
    95: 1.960,
    99: 2.576
  };

  const z = zValues[confidenceLevel] || 1.960;

  // n = (Z * s / E)²
  const n = Math.pow((z * stdDev) / toleranceError, 2);

  return Math.ceil(n); // 切り上げ
}

/**
 * サンプルサイズ妥当性を表示
 */
function displaySampleSizeValidation() {
  const toleranceErrorInput = qs('#toleranceError');
  const confidenceLevelSelect = qs('#confidenceLevel');
  const resultDiv = qs('#sampleSizeResult');

  if (!toleranceErrorInput || !confidenceLevelSelect || !resultDiv) {
    return;
  }

  const toleranceError = parseFloat(toleranceErrorInput.value);

  // 入力値が無効な場合は結果を非表示
  if (!toleranceError || toleranceError <= 0) {
    resultDiv.classList.add('is-hidden');
    return;
  }

  // 現在の統計データを取得
  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';

  const data = window.yieldStatsData;
  if (!data) {
    resultDiv.classList.add('is-hidden');
    return;
  }

  const values = data[statsType];
  if (!values || values.length === 0) {
    resultDiv.classList.add('is-hidden');
    return;
  }

  // 統計値を計算
  const stats = calculateStatistics(values);
  const confidenceLevel = parseInt(confidenceLevelSelect.value);

  // 外れ値を検出
  const outlierResult = detectOutliers(values, stats);

  // 手動除外された外れ値を反映したデータを計算
  let finalValues = values;
  let finalStats = stats;

  if (manuallyExcludedOutlierIndices.size > 0 && currentOutlierValues.length > 0) {
    // 手動除外する外れ値のセットを作成
    const excludedValues = new Set();
    manuallyExcludedOutlierIndices.forEach(index => {
      if (index < currentOutlierValues.length) {
        excludedValues.add(currentOutlierValues[index]);
      }
    });

    // 除外する外れ値以外のデータをフィルタリング
    finalValues = values.filter(v => {
      // 浮動小数点数の比較のため、非常に小さい差を許容
      for (const excludedValue of excludedValues) {
        if (Math.abs(v - excludedValue) < 0.0001) {
          return false;
        }
      }
      return true;
    });

    // 除外後のデータが2件以上ある場合のみ再計算
    if (finalValues.length >= 2) {
      finalStats = calculateStatistics(finalValues);
    }
  }

  // 必要サンプルサイズを計算（除外後のデータの統計を使用）
  const requiredSampleSize = calculateRequiredSampleSize(
    finalStats.stdDev,
    toleranceError,
    confidenceLevel
  );

  // 実際のサンプルサイズ（除外後のデータ数）
  const actualSampleSize = finalStats.count;
  const isValid = actualSampleSize >= requiredSampleSize;

  // 結果を表示
  const actualSampleSizeSpan = qs('#actualSampleSize');
  const requiredSampleSizeSpan = qs('#requiredSampleSize');
  const validityBadge = qs('#validityJudgment');
  const validityExplanation = qs('#validityExplanation');

  if (actualSampleSizeSpan) {
    actualSampleSizeSpan.textContent = actualSampleSize;
  }

  if (requiredSampleSizeSpan) {
    requiredSampleSizeSpan.textContent = requiredSampleSize;
  }

  if (validityBadge) {
    if (isValid) {
      validityBadge.textContent = '妥当';
      validityBadge.className = 'validity-badge valid';
    } else {
      validityBadge.textContent = '不十分';
      validityBadge.className = 'validity-badge invalid';
    }
  }

  if (validityExplanation) {
    if (isValid) {
      const surplus = actualSampleSize - requiredSampleSize;
      validityExplanation.textContent = `実際のサンプル数が必要数を${surplus}個上回っており、統計的に十分なデータ量です。`;
    } else {
      const shortage = requiredSampleSize - actualSampleSize;
      validityExplanation.textContent = `実際のサンプル数が必要数より${shortage}個不足しています。より多くのデータを収集することを推奨します。`;
    }
  }

  // 外れ値を検出して表示
  displayOutlierInfo(outlierResult, statsType, isValid);

  // 推奨代表値を表示（サンプルサイズが妥当な場合のみ）
  // 手動除外後のデータで計算
  if (finalValues.length >= 2) {
    displayRecommendedValue(finalStats, isValid);
  } else {
    displayRecommendedValue(stats, isValid);
  }

  // 結果を表示
  resultDiv.classList.remove('is-hidden');
}

// 外れ値の除外状態を管理（値のインデックスで管理）
let manuallyExcludedOutlierIndices = new Set();
let currentOutlierValues = []; // 現在の外れ値リスト

/**
 * 外れ値情報を表示
 * @param {Object} outlierResult - 外れ値検出結果
 * @param {string} statsType - 統計タイプ
 * @param {boolean} isSampleSizeValid - サンプルサイズが妥当かどうか
 */
function displayOutlierInfo(outlierResult, statsType, isSampleSizeValid) {
  const outlierInfoDiv = qs('#outlierInfo');
  const outlierCount = qs('#outlierCount');
  const outlierRange = qs('#outlierRange');
  const outlierRecommendation = qs('#outlierRecommendation');
  const outlierCheckboxList = qs('#outlierCheckboxList');

  if (!outlierInfoDiv) {
    return;
  }

  // 外れ値がない場合は非表示
  if (outlierResult.outliers.length === 0) {
    outlierInfoDiv.classList.add('is-hidden');
    manuallyExcludedOutlierIndices.clear();
    currentOutlierValues = [];
    // ハイライトをクリア
    highlightOutlierRows();
    return;
  }

  // 現在の外れ値リストを更新
  currentOutlierValues = [...outlierResult.outliers];

  // 前回の除外状態をクリア（新しい検出結果に合わせる）
  const validIndices = new Set();
  manuallyExcludedOutlierIndices.forEach(index => {
    if (index < currentOutlierValues.length) {
      validIndices.add(index);
    }
  });
  manuallyExcludedOutlierIndices = validIndices;

  // 統計タイプに応じた単位を取得
  const unit = statsType === 'yieldRate' ? '%' : 'g';

  const formatValue = (value) => {
    if (unit === '%') {
      return pct(toFixed(value));
    } else {
      return `${toFixed(value)}${unit}`;
    }
  };

  // 外れ値の件数
  if (outlierCount) {
    outlierCount.textContent = `${outlierResult.outliers.length}件`;
  }

  // 正常範囲
  if (outlierRange) {
    const lowerBound = formatValue(outlierResult.lowerBound);
    const upperBound = formatValue(outlierResult.upperBound);
    outlierRange.textContent = `${lowerBound} ～ ${upperBound}`;
  }

  // チェックボックスリストを生成
  if (outlierCheckboxList) {
    outlierCheckboxList.innerHTML = '';

    outlierResult.outliers.forEach((outlierValue, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'outlier-checkbox-item';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `outlier-${index}`;
      checkbox.dataset.index = index;
      checkbox.checked = manuallyExcludedOutlierIndices.has(index);
      checkbox.addEventListener('change', () => handleOutlierCheckboxChange());

      const label = document.createElement('label');
      label.htmlFor = `outlier-${index}`;
      label.className = 'outlier-checkbox-label';
      label.textContent = formatValue(outlierValue);

      itemDiv.appendChild(checkbox);
      itemDiv.appendChild(label);
      outlierCheckboxList.appendChild(itemDiv);
    });
  }

  // 手動除外数を計算
  const manuallyExcludedCount = manuallyExcludedOutlierIndices.size;
  const remainingOutliersCount = outlierResult.outliers.length - manuallyExcludedCount;
  const remainingDataCount = outlierResult.cleanedValues.length + remainingOutliersCount;

  // 推奨メッセージ
  if (outlierRecommendation) {
    const totalCount = outlierResult.outliers.length + outlierResult.cleanedValues.length;

    if (manuallyExcludedCount > 0) {
      outlierRecommendation.textContent = `${outlierResult.outliers.length}件の外れ値を検出。現在${manuallyExcludedCount}件を除外設定中です。除外後は${remainingDataCount}件のデータ（元データ${totalCount}件中）で統計分析を行います。`;
    } else if (remainingDataCount >= 2) {
      outlierRecommendation.textContent = `${outlierResult.outliers.length}件の外れ値が検出されました。チェックボックスで除外する外れ値を選択してください。除外後のデータで統計分析を行うことを推奨します。`;
    } else {
      outlierRecommendation.textContent = `${outlierResult.outliers.length}件の外れ値が検出されましたが、除外後のデータが不足する可能性があります。データの見直しをお勧めします。`;
    }
  }

  // 外れ値情報を表示
  outlierInfoDiv.classList.remove('is-hidden');

  // 外れ値を含む行をハイライト
  highlightOutlierRows();
}

/**
 * 外れ値チェックボックスの変更を処理
 */
function handleOutlierCheckboxChange() {
  // チェックボックスの状態を読み取り
  manuallyExcludedOutlierIndices.clear();

  const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]:checked');
  checkboxes.forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index, 10);
    if (!isNaN(index)) {
      manuallyExcludedOutlierIndices.add(index);
    }
  });

  // サンプルサイズ妥当性判断を再実行
  displaySampleSizeValidation();
}

/**
 * 外れ値を含む行をハイライト表示
 */
function highlightOutlierRows() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';

  // まず全ての行からハイライトを削除
  const allRows = tbody.querySelectorAll('.yield-stats-row');
  allRows.forEach(row => {
    row.classList.remove('has-outlier');
  });

  // 外れ値が検出されていない場合は終了
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    return;
  }

  // 各行の値をチェックして外れ値を含む行をハイライト
  allRows.forEach(row => {
    const rowId = row.dataset.rowId;

    if (statsType === 'yieldRate') {
      // 歩留まり率をチェック
      const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}`);
      if (yieldRateDisplay && yieldRateDisplay.classList.contains('calculated')) {
        const rateText = yieldRateDisplay.textContent.replace('%', '');
        const rate = parseFloat(rateText);
        if (!isNaN(rate) && isOutlierValue(rate)) {
          row.classList.add('has-outlier');
        }
      }
    } else if (statsType === 'beforeWeight') {
      // 加工前重量をチェック
      const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
      if (beforeInput && beforeInput.value.trim() !== '') {
        const beforeWeight = parseFloat(beforeInput.value);
        if (!isNaN(beforeWeight) && isOutlierValue(beforeWeight)) {
          row.classList.add('has-outlier');
        }
      }
    } else if (statsType === 'afterWeight') {
      // 加工後重量をチェック
      const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);
      if (afterInput && afterInput.value.trim() !== '') {
        const afterWeight = parseFloat(afterInput.value);
        if (!isNaN(afterWeight) && isOutlierValue(afterWeight)) {
          row.classList.add('has-outlier');
        }
      }
    }
  });
}

/**
 * 値が外れ値リストに含まれているかをチェック
 * @param {number} value - チェックする値
 * @returns {boolean} - 外れ値の場合true
 */
function isOutlierValue(value) {
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    return false;
  }

  // 浮動小数点数の比較のため、非常に小さい差を許容
  return currentOutlierValues.some(outlierValue =>
    Math.abs(value - outlierValue) < 0.0001
  );
}

/**
 * 外れ値を含む行をテーブルから削除
 */
function deleteOutlierRows() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // 外れ値が検出されていない場合は何もしない
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    alert('削除する外れ値がありません。');
    return;
  }

  // 確認ダイアログを表示
  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';
  const statsTypeName = statsType === 'yieldRate' ? '歩留まり率' :
                       statsType === 'beforeWeight' ? '加工前重量' : '加工後重量';

  const confirmMessage = `${statsTypeName}に外れ値を含む行をテーブルから削除します。\n削除した行は元に戻せません。\n\n削除する外れ値の数: ${currentOutlierValues.length}件\n\n本当に削除しますか？`;

  if (!confirm(confirmMessage)) {
    return;
  }

  // 外れ値を含む行を収集
  const rowsToDelete = [];
  const allRows = tbody.querySelectorAll('.yield-stats-row');

  allRows.forEach(row => {
    const rowId = row.dataset.rowId;

    if (statsType === 'yieldRate') {
      // 歩留まり率をチェック
      const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}`);
      if (yieldRateDisplay && yieldRateDisplay.classList.contains('calculated')) {
        const rateText = yieldRateDisplay.textContent.replace('%', '');
        const rate = parseFloat(rateText);
        if (!isNaN(rate) && isOutlierValue(rate)) {
          rowsToDelete.push(row);
        }
      }
    } else if (statsType === 'beforeWeight') {
      // 加工前重量をチェック
      const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
      if (beforeInput && beforeInput.value.trim() !== '') {
        const beforeWeight = parseFloat(beforeInput.value);
        if (!isNaN(beforeWeight) && isOutlierValue(beforeWeight)) {
          rowsToDelete.push(row);
        }
      }
    } else if (statsType === 'afterWeight') {
      // 加工後重量をチェック
      const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);
      if (afterInput && afterInput.value.trim() !== '') {
        const afterWeight = parseFloat(afterInput.value);
        if (!isNaN(afterWeight) && isOutlierValue(afterWeight)) {
          rowsToDelete.push(row);
        }
      }
    }
  });

  // 行を削除
  if (rowsToDelete.length === 0) {
    alert('削除する行が見つかりませんでした。');
    return;
  }

  rowsToDelete.forEach(row => {
    row.remove();
  });

  // 行番号を再割り当て
  compactYieldStatsRows();

  // 統計を再計算
  updateYieldStatsStatistics();

  // 削除完了メッセージ
  alert(`${rowsToDelete.length}行を削除しました。`);
}

/**
 * 推奨代表値を表示
 * @param {Object} stats - 統計データ
 * @param {boolean} isSampleSizeValid - サンプルサイズが妥当かどうか
 */
function displayRecommendedValue(stats, isSampleSizeValid) {
  const recommendedValueDiv = qs('#recommendedValue');
  const recommendedBadge = qs('#recommendedBadge');
  const recommendedReason = qs('#recommendedReason');

  if (!recommendedValueDiv || !recommendedBadge || !recommendedReason) {
    return;
  }

  // サンプルサイズが妥当な場合のみ表示
  if (!isSampleSizeValid) {
    recommendedValueDiv.classList.add('is-hidden');
    return;
  }

  const skewness = stats.skewness;
  const absSkewness = Math.abs(skewness);

  // 統計タイプに応じた単位を取得
  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';
  const unit = statsType === 'yieldRate' ? '%' : 'g';

  const formatValue = (value) => {
    if (unit === '%') {
      return pct(toFixed(value));
    } else {
      return `${toFixed(value)}${unit}`;
    }
  };

  let recommendedType = '';
  let reason = '';

  // 歪度に基づいて推奨値を判定
  if (absSkewness <= 0.5) {
    // 分布が正規分布に近い → 平均値を推奨
    recommendedType = '平均値';
    const meanValue = formatValue(stats.mean);
    reason = `データの分布が正規分布に近く（歪度: ${toFixed(skewness, 3)}）、外れ値の影響が少ないと考えられます。代表値として平均値（${meanValue}）の使用を推奨します。`;
  } else {
    // 分布が歪んでいる → 中央値を推奨
    recommendedType = '中央値';
    const medianValue = formatValue(stats.median);
    const direction = skewness > 0 ? '右に歪んでおり（正の歪度）' : '左に歪んでおり（負の歪度）';
    reason = `データの分布が${direction}、外れ値の影響を受けやすい状態です（歪度: ${toFixed(skewness, 3)}）。より頑健な代表値として中央値（${medianValue}）の使用を推奨します。`;
  }

  recommendedBadge.textContent = recommendedType;
  recommendedReason.textContent = reason;

  recommendedValueDiv.classList.remove('is-hidden');
}

/**
 * 許容誤差の単位を更新
 */
function updateToleranceUnit() {
  const statsTypeSelect = qs('#statsTypeSelect');
  const toleranceUnit = qs('#toleranceUnit');

  if (!statsTypeSelect || !toleranceUnit) {
    return;
  }

  const statsType = statsTypeSelect.value;

  if (statsType === 'yieldRate') {
    toleranceUnit.textContent = '%';
  } else {
    toleranceUnit.textContent = 'g';
  }
}

/**
 * グラフを描画（グラフタイプに応じて分岐）
 */
let statsChartInstance = null;

function renderStatsChart(values, stats, typeName, unit) {
  const chartTypeSelect = qs('#chartTypeSelect');
  const chartType = chartTypeSelect?.value || 'boxplot';

  const chartDom = qs('#statsChart');
  if (!chartDom) return;

  // EChartsが読み込まれていない場合は何もしない
  if (typeof echarts === 'undefined') {
    console.warn('ECharts is not loaded');
    return;
  }

  // 既存のインスタンスがあれば破棄
  if (statsChartInstance) {
    statsChartInstance.dispose();
  }

  // EChartsインスタンスを初期化
  statsChartInstance = echarts.init(chartDom);

  // グラフタイプに応じた描画
  let option;
  switch (chartType) {
    case 'boxplot':
      option = createBoxplotOption(values, stats, typeName, unit);
      break;
    case 'histogram':
      option = createHistogramOption(values, stats, typeName, unit);
      break;
    case 'scatter':
      option = createScatterOption(values, stats, typeName, unit);
      break;
    case 'normal':
      option = createNormalDistOption(values, stats, typeName, unit);
      break;
    case 'qqplot':
      option = createQQPlotOption(values, stats, typeName, unit);
      break;
    default:
      option = createBoxplotOption(values, stats, typeName, unit);
  }

  statsChartInstance.setOption(option);

  // ウィンドウリサイズ時にチャートもリサイズ
  window.addEventListener('resize', () => {
    if (statsChartInstance) {
      statsChartInstance.resize();
    }
  });
}

/**
 * 箱ひげ図のオプションを生成
 */
function createBoxplotOption(values, stats, typeName, unit) {

  // 箱ひげ図用のデータを準備
  // EChartsの箱ひげ図は [min, Q1, median, Q3, max] の形式
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  // 四分位数を計算
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];

  const boxplotData = [
    [stats.min, q1, stats.median, q3, stats.max]
  ];

  const option = {
    title: {
      text: `${typeName}の分布`,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      axisPointer: {
        type: 'shadow'
      },
      formatter: function(param) {
        if (param.componentSubType === 'boxplot') {
          const data = param.data;
          return `
            <div style="font-weight: 600; margin-bottom: 4px;">${typeName}</div>
            最大値: ${toFixed(data[4])}${unit}<br/>
            第3四分位数: ${toFixed(data[3])}${unit}<br/>
            中央値: ${toFixed(data[2])}${unit}<br/>
            第1四分位数: ${toFixed(data[1])}${unit}<br/>
            最小値: ${toFixed(data[0])}${unit}
          `;
        } else {
          return `データ: ${toFixed(param.data[1])}${unit}`;
        }
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'category',
      data: [typeName],
      boundaryGap: true,
      nameGap: 30,
      splitArea: {
        show: false
      },
      axisLabel: {
        fontSize: 12
      },
      splitLine: {
        show: false
      }
    },
    yAxis: {
      type: 'value',
      name: unit,
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      },
      splitArea: {
        show: true
      },
      axisLabel: {
        fontSize: 11,
        formatter: (value) => `${toFixed(value)}`
      }
    },
    series: [
      {
        name: 'boxplot',
        type: 'boxplot',
        data: boxplotData,
        itemStyle: {
          color: 'rgba(102, 126, 234, 0.8)',
          borderColor: '#667eea',
          borderWidth: 2
        },
        tooltip: {
          show: true
        }
      },
      {
        name: 'データポイント',
        type: 'scatter',
        data: values.map((val, idx) => [0, val]),
        itemStyle: {
          color: 'rgba(118, 75, 162, 0.5)'
        },
        symbolSize: 6
      }
    ]
  };

  return option;
}

/**
 * ヒストグラムのオプションを生成
 */
function createHistogramOption(values, stats, typeName, unit) {
  // ビンの数を計算（スタージェスの公式）
  const binCount = Math.ceil(Math.log2(values.length) + 1);
  const range = stats.max - stats.min;
  const binWidth = range / binCount;

  // ヒストグラムのデータを生成
  const bins = Array(binCount).fill(0);
  const binLabels = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = stats.min + i * binWidth;
    const binEnd = binStart + binWidth;
    binLabels.push(`${toFixed(binStart)}`);
  }

  values.forEach(val => {
    const binIndex = Math.min(Math.floor((val - stats.min) / binWidth), binCount - 1);
    bins[binIndex]++;
  });

  return {
    title: {
      text: `${typeName}の度数分布`,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: function(params) {
        const binIndex = params[0].dataIndex;
        const binStart = stats.min + binIndex * binWidth;
        const binEnd = binStart + binWidth;
        return `${toFixed(binStart)}${unit} ～ ${toFixed(binEnd)}${unit}<br/>度数: ${params[0].value}個`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'category',
      data: binLabels,
      name: typeName,
      nameLocation: 'middle',
      nameGap: 30,
      axisLabel: {
        fontSize: 10,
        rotate: 45
      }
    },
    yAxis: {
      type: 'value',
      name: '度数',
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      }
    },
    series: [{
      data: bins,
      type: 'bar',
      itemStyle: {
        color: 'rgba(102, 126, 234, 0.8)'
      },
      barWidth: '90%'
    }]
  };
}

/**
 * 散布図のオプションを生成
 */
function createScatterOption(values, stats, typeName, unit) {
  const scatterData = values.map((val, idx) => [idx + 1, val]);

  return {
    title: {
      text: `${typeName}の散布図`,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        return `データ ${params.data[0]}: ${toFixed(params.data[1])}${unit}`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'value',
      name: 'データ番号',
      nameLocation: 'middle',
      nameGap: 30
    },
    yAxis: {
      type: 'value',
      name: unit,
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      }
    },
    series: [{
      data: scatterData,
      type: 'scatter',
      itemStyle: {
        color: 'rgba(102, 126, 234, 0.8)'
      },
      symbolSize: 10,
      markLine: {
        data: [
          { yAxis: stats.mean, name: '平均値', lineStyle: { color: '#e74c3c', width: 2 }, label: { formatter: '平均' } },
          { yAxis: stats.median, name: '中央値', lineStyle: { color: '#f39c12', width: 2 }, label: { formatter: '中央値' } }
        ]
      }
    }]
  };
}

/**
 * 折れ線グラフのオプションを生成
 */
function createLineOption(values, stats, typeName, unit) {
  const lineData = values.map((val, idx) => [idx + 1, val]);

  return {
    title: {
      text: `${typeName}の推移`,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        return `データ ${params[0].data[0]}: ${toFixed(params[0].data[1])}${unit}`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'value',
      name: 'データ番号',
      nameLocation: 'middle',
      nameGap: 30
    },
    yAxis: {
      type: 'value',
      name: unit,
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      }
    },
    series: [{
      data: lineData,
      type: 'line',
      smooth: true,
      itemStyle: {
        color: 'rgba(102, 126, 234, 0.8)'
      },
      lineStyle: {
        width: 2
      },
      areaStyle: {
        color: 'rgba(102, 126, 234, 0.2)'
      },
      markLine: {
        data: [
          { yAxis: stats.mean, name: '平均値', lineStyle: { color: '#e74c3c', width: 2, type: 'dashed' }, label: { formatter: '平均' } }
        ]
      }
    }]
  };
}

/**
 * 正規分布曲線のオプションを生成
 */
function createNormalDistOption(values, stats, typeName, unit) {
  // 正規分布の確率密度関数
  const normalPDF = (x, mean, stdDev) => {
    return (1 / (stdDev * Math.sqrt(2 * Math.PI))) *
           Math.exp(-0.5 * Math.pow((x - mean) / stdDev, 2));
  };

  // カーブ用のデータポイントを生成
  const curvePoints = [];
  const rangeMin = stats.mean - 4 * stats.stdDev;
  const rangeMax = stats.mean + 4 * stats.stdDev;
  const step = (rangeMax - rangeMin) / 100;

  for (let x = rangeMin; x <= rangeMax; x += step) {
    curvePoints.push([x, normalPDF(x, stats.mean, stats.stdDev)]);
  }

  // ヒストグラムのデータ（正規化）
  const binCount = Math.ceil(Math.log2(values.length) + 1);
  const range = stats.max - stats.min;
  const binWidth = range / binCount;
  const bins = Array(binCount).fill(0);
  const binCenters = [];

  for (let i = 0; i < binCount; i++) {
    const binStart = stats.min + i * binWidth;
    const binCenter = binStart + binWidth / 2;
    binCenters.push(binCenter);
  }

  values.forEach(val => {
    const binIndex = Math.min(Math.floor((val - stats.min) / binWidth), binCount - 1);
    bins[binIndex]++;
  });

  // ヒストグラムを正規化（確率密度に変換）
  const normalizedBins = bins.map(count => count / (values.length * binWidth));
  const histogramData = binCenters.map((center, idx) => [center, normalizedBins[idx]]);

  return {
    title: {
      text: `${typeName}の正規分布`,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'axis'
    },
    legend: {
      data: ['実測データ', '正規分布曲線'],
      top: 25
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'value',
      name: unit,
      nameLocation: 'middle',
      nameGap: 30
    },
    yAxis: {
      type: 'value',
      name: '確率密度',
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      }
    },
    series: [
      {
        name: '実測データ',
        data: histogramData,
        type: 'bar',
        itemStyle: {
          color: 'rgba(102, 126, 234, 0.5)'
        },
        barWidth: binWidth * 0.8
      },
      {
        name: '正規分布曲線',
        data: curvePoints,
        type: 'line',
        smooth: true,
        itemStyle: {
          color: '#e74c3c'
        },
        lineStyle: {
          width: 3
        }
      }
    ]
  };
}

/**
 * バイオリンプロットのオプションを生成（箱ひげ図＋密度推定の近似）
 */
function createViolinOption(values, stats, typeName, unit) {
  // カーネル密度推定（簡易版）
  const kde = (x, bandwidth) => {
    return values.reduce((sum, val) => {
      const u = (x - val) / bandwidth;
      return sum + Math.exp(-0.5 * u * u);
    }, 0) / (values.length * bandwidth * Math.sqrt(2 * Math.PI));
  };

  const bandwidth = 1.06 * stats.stdDev * Math.pow(values.length, -0.2);
  const rangeMin = stats.min - stats.stdDev;
  const rangeMax = stats.max + stats.stdDev;
  const step = (rangeMax - rangeMin) / 50;

  // 密度データを生成
  const densityData = [];
  for (let y = rangeMin; y <= rangeMax; y += step) {
    const density = kde(y, bandwidth);
    densityData.push([density, y]);
    densityData.unshift([-density, y]); // 左右対称
  }

  // 箱ひげ図データ
  const boxplotData = [
    [stats.min, stats.q1, stats.median, stats.q3, stats.max]
  ];

  return {
    title: {
      text: `${typeName}のバイオリンプロット`,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item'
    },
    grid: {
      left: '15%',
      right: '15%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'value',
      show: false
    },
    yAxis: {
      type: 'value',
      name: unit,
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      }
    },
    series: [
      {
        type: 'line',
        data: densityData,
        areaStyle: {
          color: 'rgba(102, 126, 234, 0.4)'
        },
        lineStyle: {
          color: 'rgba(102, 126, 234, 0.8)',
          width: 2
        },
        smooth: true,
        symbol: 'none'
      },
      {
        type: 'boxplot',
        data: boxplotData,
        itemStyle: {
          color: 'rgba(255, 255, 255, 0.8)',
          borderColor: '#667eea',
          borderWidth: 2
        },
        boxWidth: [0.1, 0.1]
      }
    ]
  };
}

/**
 * 累積分布関数（CDF）のオプションを生成
 */
function createCDFOption(values, stats, typeName, unit) {
  // ソート済みデータから累積分布を計算
  const sorted = stats.sorted;
  const n = sorted.length;
  const cdfData = sorted.map((val, idx) => [val, (idx + 1) / n]);

  return {
    title: {
      text: `${typeName}の累積分布関数（CDF）`,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'axis',
      formatter: function(params) {
        return `値: ${toFixed(params[0].data[0])}${unit}<br/>累積確率: ${(params[0].data[1] * 100).toFixed(1)}%`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'value',
      name: unit,
      nameLocation: 'middle',
      nameGap: 30
    },
    yAxis: {
      type: 'value',
      name: '累積確率',
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      },
      min: 0,
      max: 1,
      axisLabel: {
        formatter: (value) => `${(value * 100).toFixed(0)}%`
      }
    },
    series: [{
      data: cdfData,
      type: 'line',
      step: 'end',
      itemStyle: {
        color: 'rgba(102, 126, 234, 0.8)'
      },
      lineStyle: {
        width: 2
      },
      areaStyle: {
        color: 'rgba(102, 126, 234, 0.2)'
      },
      markLine: {
        data: [
          { yAxis: 0.25, name: 'Q1', lineStyle: { color: '#f39c12', type: 'dashed' }, label: { formatter: 'Q1(25%)' } },
          { yAxis: 0.5, name: 'Median', lineStyle: { color: '#e74c3c', type: 'dashed' }, label: { formatter: '中央値(50%)' } },
          { yAxis: 0.75, name: 'Q3', lineStyle: { color: '#f39c12', type: 'dashed' }, label: { formatter: 'Q3(75%)' } }
        ]
      }
    }]
  };
}

/**
 * Q-Qプロットのオプションを生成
 */
function createQQPlotOption(values, stats, typeName, unit) {
  // 標準正規分位数を計算
  const sorted = stats.sorted;
  const n = sorted.length;
  const qqData = [];

  for (let i = 0; i < n; i++) {
    // 理論的な分位数（標準正規分布）
    const p = (i + 0.5) / n;
    // 標準正規分布の逆累積分布関数の近似
    const theoreticalQuantile = approximateNormalQuantile(p);
    // 標準化したサンプル分位数
    const sampleQuantile = (sorted[i] - stats.mean) / stats.stdDev;
    qqData.push([theoreticalQuantile, sampleQuantile]);
  }

  // 理論的な直線（y=x）
  const minQ = Math.min(...qqData.map(d => d[0]));
  const maxQ = Math.max(...qqData.map(d => d[0]));
  const referenceLine = [[minQ, minQ], [maxQ, maxQ]];

  return {
    title: {
      text: `${typeName}のQ-Qプロット（正規性検定）`,
      left: 'center',
      textStyle: {
        fontSize: 14,
        fontWeight: 600,
        color: '#333'
      }
    },
    tooltip: {
      trigger: 'item',
      formatter: function(params) {
        return `理論分位数: ${toFixed(params.data[0], 2)}<br/>サンプル分位数: ${toFixed(params.data[1], 2)}`;
      }
    },
    grid: {
      left: '10%',
      right: '10%',
      bottom: '15%',
      top: '20%'
    },
    xAxis: {
      type: 'value',
      name: '理論分位数（標準正規分布）',
      nameLocation: 'middle',
      nameGap: 30
    },
    yAxis: {
      type: 'value',
      name: 'サンプル分位数（標準化）',
      nameTextStyle: {
        fontSize: 12,
        color: '#666'
      }
    },
    series: [
      {
        name: '理論直線',
        type: 'line',
        data: referenceLine,
        lineStyle: {
          color: '#e74c3c',
          width: 2,
          type: 'dashed'
        },
        symbol: 'none',
        z: 1
      },
      {
        name: 'データポイント',
        data: qqData,
        type: 'scatter',
        itemStyle: {
          color: 'rgba(102, 126, 234, 0.6)'
        },
        symbolSize: 8,
        z: 2
      }
    ]
  };
}

/**
 * 標準正規分布の逆累積分布関数の近似（Beasley-Springer-Moro algorithm）
 */
function approximateNormalQuantile(p) {
  if (p <= 0 || p >= 1) return p < 0.5 ? -10 : 10;

  const a = [
    2.50662823884,
    -18.61500062529,
    41.39119773534,
    -25.44106049637
  ];

  const b = [
    -8.47351093090,
    23.08336743743,
    -21.06224101826,
    3.13082909833
  ];

  const c = [
    0.3374754822726147,
    0.9761690190917186,
    0.1607979714918209,
    0.0276438810333863,
    0.0038405729373609,
    0.0003951896511919,
    0.0000321767881768,
    0.0000002888167364,
    0.0000003960315187
  ];

  const y = p - 0.5;

  if (Math.abs(y) < 0.42) {
    const r = y * y;
    return y * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]) /
           ((((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1);
  }

  const r = p < 0.5 ? p : 1 - p;
  const s = Math.log(-Math.log(r));
  let t = c[0];
  for (let i = 1; i < c.length; i++) {
    t += c[i] * Math.pow(s, i);
  }

  return p < 0.5 ? -t : t;
}

/**
 * 全クリア処理
 */
function clearAll() {
  const currentMode = appState.getMode();
  if (currentMode === MODE.FIXED) {
    resetSteps();
  } else if (currentMode === MODE.WEIGHT) {
    resetWeightSteps();
  } else if (currentMode === MODE.YIELD_STATS) {
    resetYieldStatsEntries();
  }
  appState.resetAll();
  // 保存ボタンの表示を更新（履歴IDがクリアされたので通常の保存ボタンを表示）
  updateSaveButtonsVisibility();
}

/**
 * アプリケーション初期化
 */
function init() {
  // モード切替ボタン
  qs(`#${UI_ELEMENTS.FIXED_BTN}`)?.addEventListener('click', () => switchMode(MODE.FIXED));
  qs(`#${UI_ELEMENTS.WEIGHT_BTN}`)?.addEventListener('click', () => switchMode(MODE.WEIGHT));
  qs(`#${UI_ELEMENTS.YIELD_STATS_BTN}`)?.addEventListener('click', () => switchMode(MODE.YIELD_STATS));
  qs(`#${UI_ELEMENTS.CLEAR_BTN}`)?.addEventListener('click', clearAll);

  // 歩留まり率入力方法の切り替え（定額モード）
  qsa(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]`).forEach(r => {
    r.addEventListener('change', switchYieldMethod);
  });

  // 歩留まり率入力方法の切り替え（計量モード）
  qsa(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]`).forEach(r => {
    r.addEventListener('change', switchWeightYieldMethod);
  });

  // 定額モード - 重量から計算モード - Step 1の入力監視
  [FIXED_FIELDS.CALCULATE.UNIT_COST, FIXED_FIELDS.CALCULATE.UNIT_PRICE,
   FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', handleStep1);
  });

  // 定額モード - 重量から計算モード - Step 2の入力監視
  qs(`#${FIXED_FIELDS.CALCULATE.AFTER_WEIGHT}`)?.addEventListener('input', handleStep2);

  // 定額モード - 重量から計算モード - Step 3の入力監視
  qs(`#${FIXED_FIELDS.CALCULATE.AFTER_PRICE_100}`)?.addEventListener('input', handleStep3);

  // 定額モード - 歩留まり率直接入力モード - Step 1の入力監視
  [FIXED_FIELDS.DIRECT.UNIT_COST, FIXED_FIELDS.DIRECT.UNIT_PRICE,
   FIXED_FIELDS.DIRECT.BEFORE_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', handleDirectStep1);
  });

  // 定額モード - 歩留まり率直接入力モード - Step 2の入力監視
  qs(`#${FIXED_FIELDS.DIRECT.YIELD_RATE}`)?.addEventListener('input', handleDirectStep2);

  // 定額モード - 歩留まり率直接入力モード - Step 3の入力監視
  qs(`#${FIXED_FIELDS.DIRECT.AFTER_PRICE_100}`)?.addEventListener('input', handleDirectStep3);

  // 計量モード - 重量から計算モード - Step 1の入力監視
  [WEIGHT_FIELDS.CALCULATE.BOX_COST, WEIGHT_FIELDS.CALCULATE.BOX_PRICE,
   WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', handleWeightStep1);
  });

  // 計量モード - 重量から計算モード - Step 2の入力監視
  [WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE, WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', handleWeightStep2);
  });

  // 計量モード - 重量から計算モード - Step 3の入力監視
  qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100}`)?.addEventListener('input', handleWeightStep3);

  // 計量モード - 歩留まり率直接入力モード - Step 1の入力監視
  [WEIGHT_FIELDS.DIRECT.BOX_COST, WEIGHT_FIELDS.DIRECT.BOX_PRICE,
   WEIGHT_FIELDS.DIRECT.BOX_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', handleWeightDirectStep1);
  });

  // 計量モード - 歩留まり率直接入力モード - Step 2の入力監視
  qs(`#${WEIGHT_FIELDS.DIRECT.YIELD_RATE}`)?.addEventListener('input', handleWeightDirectStep2);

  // 計量モード - 歩留まり率直接入力モード - Step 3の入力監視
  qs(`#${WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100}`)?.addEventListener('input', handleWeightDirectStep3);

  // 歩留まり率統計モード - 統計タイプ選択
  qs('#statsTypeSelect')?.addEventListener('change', () => {
    displayCurrentStatistics();
  });

  // 歩留まり率統計モード - グラフタイプ選択
  qs('#chartTypeSelect')?.addEventListener('change', () => {
    displayCurrentStatistics();
  });

  // 歩留まり率統計モード - サンプルサイズ妥当性判断
  qs('#toleranceError')?.addEventListener('input', () => {
    displaySampleSizeValidation();
  });

  qs('#confidenceLevel')?.addEventListener('change', () => {
    displaySampleSizeValidation();
  });

  // 外れ値の全選択・全解除ボタン
  qs('#selectAllOutliers')?.addEventListener('click', () => {
    const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
    });
    handleOutlierCheckboxChange();
  });

  qs('#deselectAllOutliers')?.addEventListener('click', () => {
    const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    handleOutlierCheckboxChange();
  });

  // 外れ値を含む行を削除
  qs('#deleteOutlierRows')?.addEventListener('click', deleteOutlierRows);

  // 商品化シミュレーション
  [UI_ELEMENTS.EXP_WEIGHT, UI_ELEMENTS.CONSUMABLE].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', handleProductCalculation);
  });

  // 値引きシミュレーション
  qs(`#${UI_ELEMENTS.DISC_SLIDER}`)?.addEventListener('input', (e) => {
    qs(`#${UI_ELEMENTS.DISC_INPUT}`).value = e.target.value;
    handleDiscountUpdate();
  });

  qs(`#${UI_ELEMENTS.DISC_INPUT}`)?.addEventListener('input', (e) => {
    let v = parseFloat(e.target.value) || 0;
    v = Math.max(0, Math.min(100, v));
    e.target.value = v;
    qs(`#${UI_ELEMENTS.DISC_SLIDER}`).value = Math.min(v, 50);
    handleDiscountUpdate();
  });

  // 逆算シミュレーション
  // イベント委譲を使用して確実にクリックを検出
  document.addEventListener('click', (e) => {
    // 値引後粗利率をクリック → 逆算シミュレーションを開く
    const discGrossTarget = e.target.closest(`#${UI_ELEMENTS.DISC_GROSS_STAT}`);
    if (discGrossTarget) {
      e.preventDefault();
      toggleReverseSimulation();
      return;
    }

    // 逆算結果をクリック → 値を適用
    const reverseResultTarget = e.target.closest(`#${UI_ELEMENTS.REVERSE_RESULT_STAT}`);
    if (reverseResultTarget) {
      e.preventDefault();
      applyReverseSimulationResult();
      return;
    }
  });

  qs(`#${UI_ELEMENTS.TARGET_MARKUP}`)?.addEventListener('input', handleReverseCalculation);
  qsa(`input[name="${RADIO_NAMES.REVERSE_CALC_TARGET}"]`).forEach(r => {
    r.addEventListener('change', handleReverseCalculation);
  });

  // ステップ1-5の入力が変更されたら逆算シミュレーションをリセット
  const allInputFields = [
    // 定額モード - 重量から計算
    FIXED_FIELDS.CALCULATE.UNIT_COST,
    FIXED_FIELDS.CALCULATE.UNIT_PRICE,
    FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT,
    FIXED_FIELDS.CALCULATE.AFTER_WEIGHT,
    FIXED_FIELDS.CALCULATE.AFTER_PRICE_100,
    // 定額モード - 歩留まり率直接入力
    FIXED_FIELDS.DIRECT.UNIT_COST,
    FIXED_FIELDS.DIRECT.UNIT_PRICE,
    FIXED_FIELDS.DIRECT.BEFORE_WEIGHT,
    FIXED_FIELDS.DIRECT.YIELD_RATE,
    FIXED_FIELDS.DIRECT.AFTER_PRICE_100,
    // 計量モード - 重量から計算
    WEIGHT_FIELDS.CALCULATE.BOX_COST,
    WEIGHT_FIELDS.CALCULATE.BOX_PRICE,
    WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT,
    WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE,
    WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT,
    WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100,
    // 計量モード - 歩留まり率直接入力
    WEIGHT_FIELDS.DIRECT.BOX_COST,
    WEIGHT_FIELDS.DIRECT.BOX_PRICE,
    WEIGHT_FIELDS.DIRECT.BOX_WEIGHT,
    WEIGHT_FIELDS.DIRECT.YIELD_RATE,
    WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100,
    // 商品化シミュレーション
    UI_ELEMENTS.EXP_WEIGHT,
    UI_ELEMENTS.CONSUMABLE,
    // 値引きシミュレーション
    UI_ELEMENTS.DISC_INPUT
  ];

  allInputFields.forEach(fieldId => {
    qs(`#${fieldId}`)?.addEventListener('input', resetReverseSimulation);
  });

  // スライダーも監視
  qs(`#${UI_ELEMENTS.DISC_SLIDER}`)?.addEventListener('input', resetReverseSimulation);

  // 履歴機能の初期化
  initHistoryUI();

  // 保存ボタンの表示を初期化
  updateSaveButtonsVisibility();

  // Service Workerを登録（PWA対応 + 更新通知）
  if ('serviceWorker' in navigator) {
    let refreshing = false;

    // Service Worker登録
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/tool/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope);

          // 更新チェック
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('[PWA] New Service Worker found');

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新しいバージョンが利用可能
                console.log('[PWA] New version available');
                showUpdateNotification(newWorker);
              }
            });
          });

          // 定期的な更新チェック（1時間ごと）
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    });

    // Service Worker制御変更時の自動リロード
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        console.log('[PWA] Reloading page with new Service Worker');
        window.location.reload();
      }
    });
  }

  /**
   * 更新通知UIを表示
   */
  function showUpdateNotification(newWorker) {
    const notification = qs('#updateNotification');
    const updateBtn = qs('#updateBtn');
    const dismissBtn = qs('#dismissUpdateBtn');

    if (!notification) return;

    // 通知を表示
    notification.classList.remove('is-hidden');

    // 更新ボタンクリック
    updateBtn.addEventListener('click', () => {
      console.log('[PWA] User triggered update');
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    }, { once: true });

    // 閉じるボタンクリック
    dismissBtn.addEventListener('click', () => {
      notification.classList.add('is-hidden');
    }, { once: true });
  }
}

// アプリケーション起動
init();
