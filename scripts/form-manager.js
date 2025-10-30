/**
 * フォーム管理モジュール
 * 定額モードと計量モードのステップ管理とフォーム処理を担当
 */

import { per100FromPerUnit, per100FromBox, markup, calcYield, toFixed } from './calculation.js';
import { qs, num, hide, show, setText, yen, pct } from './dom-utils.js';
import { appState } from './state.js';
import { UI_ELEMENTS, FIXED_FIELDS, WEIGHT_FIELDS, RADIO_NAMES } from './constants.js';
import { calculateFixed } from './calculator-fixed.js';
import { calculateWeight } from './calculator-weight.js';
import { displayResults, checkAndShowYieldWarning } from './display.js';
import { calculateProductSimulation, updateDiscountSimulation } from './product-simulator.js';

/**
 * ステップをリセット（UIの表示/非表示のみ、入力値はクリアしない）
 */
export function resetSteps() {
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
  } else {
    // 重量から計算モード
    show(UI_ELEMENTS.FIXED_STEP1);
    hide(UI_ELEMENTS.FIXED_STEP1_RESULT);
    hide(UI_ELEMENTS.FIXED_STEP2);
    hide(UI_ELEMENTS.FIXED_STEP2_RESULT);
    hide(UI_ELEMENTS.FIXED_STEP3);
    hide(UI_ELEMENTS.FIXED_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);
  }
}

/**
 * Step 1の処理：基本情報入力→加工前の計算（重量から計算モード）
 */
export function handleStep1() {
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
export function handleStep2() {
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

  // 歩留まり率100%超過の警告チェック
  checkAndShowYieldWarning(UI_ELEMENTS.YIELD_WARNING_FIXED, yr);

  show(UI_ELEMENTS.FIXED_STEP2_RESULT);
  show(UI_ELEMENTS.FIXED_STEP3);

  // 次のステップの処理をトリガー
  handleStep3();
}

/**
 * Step 3の処理：加工後設定売価入力→最終結果表示（重量から計算モード）
 * 加工後の100gあたり原価・売価・値入率を計算してStep 3結果セクションに表示
 */
export function handleStep3() {
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
export function handleDirectStep1() {
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
export function handleDirectStep2() {
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

  // 歩留まり率100%超過の警告チェック
  checkAndShowYieldWarning(UI_ELEMENTS.YIELD_WARNING_FIXED_DIRECT, yr);

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
export function handleDirectStep3() {
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
 * 計量モードのステップをリセット（UIの表示/非表示のみ、入力値はクリアしない）
 */
export function resetWeightSteps() {
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
  } else {
    // 重量から計算モード
    show(UI_ELEMENTS.WEIGHT_STEP1);
    hide(UI_ELEMENTS.WEIGHT_STEP1_RESULT);
    hide(UI_ELEMENTS.WEIGHT_STEP2);
    hide(UI_ELEMENTS.WEIGHT_STEP2_RESULT);
    hide(UI_ELEMENTS.WEIGHT_STEP3);
    hide(UI_ELEMENTS.WEIGHT_STEP3_RESULT);
    hide(UI_ELEMENTS.RESULTS);
  }
}

/**
 * Step 1の処理：箱の基本情報入力→加工前の計算（計量モード - 重量から計算）
 */
export function handleWeightStep1() {
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
export function handleWeightStep2() {
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

  // 歩留まり率100%超過の警告チェック
  checkAndShowYieldWarning(UI_ELEMENTS.YIELD_WARNING_WEIGHT, yr);

  show(UI_ELEMENTS.WEIGHT_STEP2_RESULT);
  show(UI_ELEMENTS.WEIGHT_STEP3);

  // 次のステップの処理をトリガー
  handleWeightStep3();
}

/**
 * Step 3の処理：加工後設定売価入力→最終結果表示（計量モード - 重量から計算）
 */
export function handleWeightStep3() {
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
export function handleWeightDirectStep1() {
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
export function handleWeightDirectStep2() {
  const yr = num(WEIGHT_FIELDS.DIRECT.YIELD_RATE);

  if (!Number.isFinite(yr) || yr <= 0) {
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP2_RESULT);
    hide(UI_ELEMENTS.WEIGHT_DIRECT_STEP3);
    return;
  }

  // 歩留まり率を表示
  setText(UI_ELEMENTS.YIELD_RATE_WEIGHT_DIRECT_STEP2, pct(toFixed(yr)));

  // 歩留まり率100%超過の警告チェック
  checkAndShowYieldWarning(UI_ELEMENTS.YIELD_WARNING_WEIGHT_DIRECT, yr);

  show(UI_ELEMENTS.WEIGHT_DIRECT_STEP2_RESULT);
  show(UI_ELEMENTS.WEIGHT_DIRECT_STEP3);

  // 次のステップの処理をトリガー
  handleWeightDirectStep3();
}

/**
 * Step 3の処理：加工後設定売価入力→最終結果表示（計量モード - 歩留まり率直接入力）
 */
export function handleWeightDirectStep3() {
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
export function handleProductCalculation() {
  const snapshot = appState.getSnapshot();
  const productData = calculateProductSimulation(snapshot);

  if (productData) {
    appState.updateProductData(productData);
    updateDiscountSimulation(productData);
  } else {
    appState.updateProductData({ price: null, markup: null, cost: null });
  }
}
