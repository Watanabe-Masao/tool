/**
 * メインアプリケーションロジック（段階的フォーム対応 - 2モード）
 */

import { per100FromPerUnit, per100FromBox, markup, calcYield, toFixed } from './calculation.js';
import { qs, num, hide, show, toggleActive, setText, yen, pct, qsa } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, FIXED_FIELDS, WEIGHT_FIELDS, RADIO_NAMES } from './constants.js';
import { calculateFixed } from './calculator-fixed.js';
import { calculateWeight } from './calculator-weight.js';
import { displayResults, displayReverseSimulation, displayReverseError, hideReverseSimulation } from './display.js';
import {
  calculateProductSimulation,
  updateDiscountSimulation,
  calculateWeightFromMarkup,
  calculatePriceFromMarkup,
  calculateConsumableFromMarkup,
  calculateAfterWeightFromMarkup,
  calculateYieldRateFromMarkup,
  calculateDiscountRateFromGross
} from './product-simulator.js';
import { initHistoryUI } from './history-ui.js';

/**
 * モード切替処理
 */
function switchMode(newMode) {
  appState.setMode(newMode);

  const isFixed = newMode === MODE.FIXED;
  toggleActive(
    qs(isFixed ? `#${UI_ELEMENTS.FIXED_BTN}` : `#${UI_ELEMENTS.WEIGHT_BTN}`),
    qs(isFixed ? `#${UI_ELEMENTS.WEIGHT_BTN}` : `#${UI_ELEMENTS.FIXED_BTN}`)
  );

  qs(`#${UI_ELEMENTS.FIXED_INPUTS}`).classList.toggle('is-hidden', !isFixed);
  qs(`#${UI_ELEMENTS.WEIGHT_INPUTS}`).classList.toggle('is-hidden', isFixed);
  hide(UI_ELEMENTS.RESULTS);
  hide(UI_ELEMENTS.WARNING);

  // ステップをリセット
  if (isFixed) {
    resetSteps();
  } else {
    resetWeightSteps();
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
    } else {
      // 歩留まり率を直接入力モード
      inputs.unitCost = num(FIXED_FIELDS.DIRECT.UNIT_COST);
      inputs.unitPrice = num(FIXED_FIELDS.DIRECT.UNIT_PRICE);
      inputs.beforeWeight = num(FIXED_FIELDS.DIRECT.BEFORE_WEIGHT);
      inputs.yieldRateDirect = num(FIXED_FIELDS.DIRECT.YIELD_RATE);
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
    } else {
      // 歩留まり率を直接入力モード
      inputs.boxCost = num(WEIGHT_FIELDS.DIRECT.BOX_COST);
      inputs.boxPrice = num(WEIGHT_FIELDS.DIRECT.BOX_PRICE);
      inputs.boxWeight = num(WEIGHT_FIELDS.DIRECT.BOX_WEIGHT);
      inputs.yieldRateDirect = num(WEIGHT_FIELDS.DIRECT.YIELD_RATE);
    }
  }

  return inputs;
}

/**
 * 逆算シミュレーション処理
 */
function handleReverseCalculation() {
  const snapshot = appState.getSnapshot();
  const targetMarkup = num(UI_ELEMENTS.TARGET_MARKUP);
  const productData = appState.getProductData();
  const currentMode = appState.getMode();

  // どのラジオボタンが選択されているか取得
  const selectedRadio = document.querySelector(`input[name="${RADIO_NAMES.REVERSE_CALC_TARGET}"]:checked`);
  if (!selectedRadio) {
    hideReverseSimulation();
    return;
  }

  const calcTarget = selectedRadio.value;

  // 値引率計算の場合は別処理
  if (calcTarget === 'discount') {
    if (!productData.markup || !Number.isFinite(targetMarkup)) {
      hideReverseSimulation();
      return;
    }
    const result = calculateDiscountRateFromGross(productData.markup, targetMarkup);
    if (result !== null && Number.isFinite(result)) {
      if (result < 0) {
        displayReverseError('値引率', `目標粗利率は${toFixed(productData.markup)}%以下で設定してください`);
      } else if (result > 100) {
        displayReverseError('値引率', `目標粗利率は${toFixed(productData.markup)}%以下で設定してください`);
      } else {
        displayReverseSimulation(result, '必要な値引率', '%');
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

  // 通常の計算の必須データチェック
  if (!snapshot.afterCost || !snapshot.afterPrice || !Number.isFinite(targetMarkup)) {
    hideReverseSimulation();
    return;
  }

  // 入力値を一括取得（モード・入力方法別に構造化）
  const inputs = getReverseSimulationInputs();

  let result = null;
  let label = '';
  let unit = '';
  let errorMsg = '';

  switch (calcTarget) {
    case 'weight':
      result = calculateWeightFromMarkup(inputs.afterCost, inputs.afterPrice, targetMarkup, inputs.consumable);
      label = '必要な重量';
      unit = 'g';
      if (result === null) {
        const maxMarkup = ((inputs.afterPrice - inputs.afterCost) / inputs.afterPrice) * 100;
        errorMsg = `目標値入率は${toFixed(maxMarkup)}%以下で設定してください`;
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
      if (result === null) {
        errorMsg = '目標値入率は100%未満で設定してください';
      }
      break;

    case 'consumable':
      if (!Number.isFinite(inputs.weight) || inputs.weight <= 0) {
        displayReverseError('消耗品費', '1パックに入れる予定重量を入力してください');
        return;
      }
      result = calculateConsumableFromMarkup(inputs.afterCost, inputs.afterPrice, inputs.weight, targetMarkup);
      label = '必要な消耗品費';
      unit = '円';
      if (result === null) {
        errorMsg = '目標値入率を下げるか、条件を見直してください';
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
        result = calculateAfterWeightFromMarkup(
          beforeWeight,
          inputs.afterCost,
          inputs.afterPrice,
          inputs.weight,
          targetMarkup,
          inputs.consumable
        );
        label = '必要な加工後重量';
        unit = 'g';
        if (result === null || result > beforeWeight) {
          errorMsg = `目標値入率を下げるか、加工前重量を${toFixed(beforeWeight)}g以上に設定してください`;
        }
      } else {
        // ========================================
        // 歩留まり率を直接入力モード: 歩留まり率を逆算
        // ========================================
        result = calculateYieldRateFromMarkup(
          inputs.afterCost,
          inputs.afterPrice,
          inputs.weight,
          targetMarkup,
          inputs.consumable
        );
        label = '必要な歩留まり率';
        unit = '%';
        if (result === null || result > 100) {
          errorMsg = '目標値入率を下げるか、条件を見直してください';
        }
      }
      break;
  }

  if (result !== null && Number.isFinite(result) && result >= 0) {
    displayReverseSimulation(result, label, unit);
    // 結果の値を保存（クリック時に使用）
    const reverseResultStat = qs(`#${UI_ELEMENTS.REVERSE_RESULT_STAT}`);
    if (reverseResultStat) {
      reverseResultStat.dataset.calcTarget = calcTarget;
      reverseResultStat.dataset.calcValue = result.toString();
    }
  } else {
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
 * 全クリア処理
 */
function clearAll() {
  const currentMode = appState.getMode();
  if (currentMode === MODE.FIXED) {
    resetSteps();
  } else {
    resetWeightSteps();
  }
  appState.resetAll();
}

/**
 * アプリケーション初期化
 */
function init() {
  // モード切替ボタン
  qs(`#${UI_ELEMENTS.FIXED_BTN}`)?.addEventListener('click', () => switchMode(MODE.FIXED));
  qs(`#${UI_ELEMENTS.WEIGHT_BTN}`)?.addEventListener('click', () => switchMode(MODE.WEIGHT));
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
    FIXED_FIELDS.CALCULATE.BOX_COST,
    FIXED_FIELDS.CALCULATE.BOX_PRICE,
    FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT,
    FIXED_FIELDS.CALCULATE.BEFORE_SAMPLE,
    FIXED_FIELDS.CALCULATE.AFTER_WEIGHT,
    FIXED_FIELDS.CALCULATE.AFTER_PRICE_100,
    // 定額モード - 歩留まり率直接入力
    FIXED_FIELDS.DIRECT.BOX_COST,
    FIXED_FIELDS.DIRECT.BOX_PRICE,
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

  // Service Workerを登録（PWA対応）
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/tool/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope);
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    });
  }
}

// アプリケーション起動
init();
