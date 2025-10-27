/**
 * ステップ処理の汎用ハンドラー
 * 重複コードを削減し、保守性を向上させる
 */

import { per100FromPerUnit, per100FromBox, markup, calcYield, toFixed, afterCostPer100 } from './calculation.js';
import { qs, num, hide, show, setText, yen, pct } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, STEP_CONFIG, UI_ELEMENTS } from './constants.js';
import { calculateFixed } from './calculator-fixed.js';
import { calculateWeight } from './calculator-weight.js';
import { displayResults } from './display.js';

/**
 * 現在のモードとメソッドから設定を取得
 * @param {string} mode - 'fixed' or 'weight'
 * @param {string} method - 'calculate' or 'direct'
 * @returns {Object} ステップ設定オブジェクト
 */
function getStepConfig(mode, method) {
  const configKey = `${mode.toUpperCase()}_${method.toUpperCase()}`;
  return STEP_CONFIG[configKey];
}

/**
 * Step 1の処理: 基本情報入力→加工前の計算
 * @param {Object} config - ステップ設定オブジェクト
 * @returns {Object|null} Step 1の計算結果（directモードで使用）
 */
function handleGenericStep1(config) {
  const { mode, fields, steps, displayElement } = config;
  const isFixedMode = mode === MODE.FIXED;

  // 入力値を取得
  let cost, price, weight;
  if (isFixedMode) {
    cost = num(fields.UNIT_COST);
    price = num(fields.UNIT_PRICE);
    weight = num(fields.BEFORE_WEIGHT);
  } else {
    cost = num(fields.BOX_COST);
    price = num(fields.BOX_PRICE);
    weight = num(fields.BOX_WEIGHT);
  }

  // 計量モードの場合、100gあたりの売価をリアルタイム表示
  if (!isFixedMode && displayElement) {
    if (Number.isFinite(price) && Number.isFinite(weight) && weight > 0) {
      const price100 = per100FromBox(price, weight);
      setText(displayElement, yen(toFixed(price100)));
    } else {
      setText(displayElement, '-');
    }
  }

  // すべて入力されているかチェック
  if (![cost, price, weight].every(v => Number.isFinite(v) && v > 0)) {
    if (steps.step1.result) hide(steps.step1.result);
    hide(steps.step2.input);
    if (steps.step2.result) hide(steps.step2.result);
    hide(steps.step3.input);
    return null;
  }

  // 加工前の100gあたり計算
  const beforeCost100 = isFixedMode
    ? per100FromPerUnit(cost, weight)
    : per100FromBox(cost, weight);
  const beforePrice100 = isFixedMode
    ? per100FromPerUnit(price, weight)
    : per100FromBox(price, weight);
  const beforeMarkup = markup(beforeCost100, beforePrice100);

  // 結果を表示（Step 1の結果フィールドがある場合のみ）
  if (steps.step1.resultFields) {
    setText(steps.step1.resultFields.beforeCost, yen(toFixed(beforeCost100)));
    setText(steps.step1.resultFields.beforePrice, yen(toFixed(beforePrice100)));
    setText(steps.step1.resultFields.beforeMarkup, pct(toFixed(beforeMarkup)));
    show(steps.step1.result);
  }

  show(steps.step2.input);

  return { beforeCost100, beforePrice100, beforeMarkup };
}

/**
 * Step 2の処理: 歩留まり率の計算または入力
 * @param {Object} config - ステップ設定オブジェクト
 * @returns {Object|null} Step 2の計算結果
 */
function handleGenericStep2(config) {
  const { mode, method, fields, steps } = config;
  const isFixedMode = mode === MODE.FIXED;
  const isCalculateMethod = method === 'calculate';

  let yieldRate;

  if (isCalculateMethod) {
    // 重量から歩留まり率を計算
    const beforeWeight = isFixedMode
      ? num(fields.BEFORE_WEIGHT)
      : num(fields.BEFORE_SAMPLE);
    const afterWeight = num(fields.AFTER_WEIGHT);

    if (![beforeWeight, afterWeight].every(v => Number.isFinite(v) && v > 0)) {
      hide(steps.step2.result);
      hide(steps.step3.input);
      return null;
    }

    yieldRate = calcYield(beforeWeight, afterWeight);

    // 歩留まり率のみ表示
    setText(steps.step2.resultFields.yieldRate, pct(toFixed(yieldRate)));
  } else {
    // 歩留まり率を直接入力
    yieldRate = num(fields.YIELD_RATE);

    if (!Number.isFinite(yieldRate) || yieldRate <= 0) {
      hide(steps.step2.result);
      hide(steps.step3.input);
      return null;
    }

    // 歩留まり率を表示
    setText(steps.step2.resultFields.yieldRate, pct(toFixed(yieldRate)));

    // directモードでは加工前情報も計算して表示
    if (steps.step2.resultFields.beforeCost) {
      // 加工前の入力値を取得
      let cost, price, weight;
      if (isFixedMode) {
        cost = num(fields.UNIT_COST);
        price = num(fields.UNIT_PRICE);
        weight = num(fields.BEFORE_WEIGHT);
      } else {
        cost = num(fields.BOX_COST);
        price = num(fields.BOX_PRICE);
        weight = num(fields.BOX_WEIGHT);
      }

      // 加工前の100gあたり計算
      const beforeCost100 = isFixedMode
        ? per100FromPerUnit(cost, weight)
        : per100FromBox(cost, weight);
      const beforePrice100 = isFixedMode
        ? per100FromPerUnit(price, weight)
        : per100FromBox(price, weight);
      const beforeMarkup = markup(beforeCost100, beforePrice100);

      setText(steps.step2.resultFields.beforeCost, yen(toFixed(beforeCost100)));
      setText(steps.step2.resultFields.beforePrice, yen(toFixed(beforePrice100)));
      setText(steps.step2.resultFields.beforeMarkup, pct(toFixed(beforeMarkup)));
    }
  }

  show(steps.step2.result);
  show(steps.step3.input);

  return { yieldRate };
}

/**
 * Step 3の処理: 加工後設定売価入力→最終結果表示
 * @param {Object} config - ステップ設定オブジェクト
 * @param {Function} productCalculationCallback - 商品化シミュレーション処理のコールバック
 * @returns {Object|null} 計算結果
 */
function handleGenericStep3(config, productCalculationCallback) {
  const { mode, method, steps } = config;

  // 計算を実行
  const result = mode === MODE.FIXED
    ? calculateFixed(method)
    : calculateWeight(method);

  if (!result) {
    hide(steps.step3.result);
    hide(UI_ELEMENTS.RESULTS);
    return null;
  }

  // Step 3結果セクションに加工後の詳細を表示
  setText(steps.step3.resultFields.afterCost, yen(toFixed(result.ac)));
  setText(steps.step3.resultFields.afterPrice, yen(toFixed(result.ap)));
  setText(steps.step3.resultFields.afterMarkup, pct(toFixed(result.am)));

  show(steps.step3.result);

  // 最終結果セクションを表示
  const snapshotData = displayResults(result, 'step');
  appState.updateSnapshot(snapshotData);

  // 商品化シミュレーション処理を呼び出し
  if (productCalculationCallback) {
    productCalculationCallback();
  }

  return result;
}

/**
 * 統合されたステップ処理関数
 * 元のコードの動作を再現：各ステップは次のステップの入力欄を表示し、次のステップの処理も呼び出す
 * @param {string} mode - 'fixed' or 'weight'
 * @param {string} method - 'calculate' or 'direct'
 * @param {number} step - ステップ番号 (1, 2, 3)
 * @param {Function} productCalculationCallback - 商品化シミュレーション処理のコールバック
 */
export function handleStep(mode, method, step, productCalculationCallback = null) {
  const config = getStepConfig(mode, method);

  if (!config) {
    console.error(`Invalid configuration for mode: ${mode}, method: ${method}`);
    return;
  }

  if (step === 1) {
    const step1Data = handleGenericStep1(config);
    // Step 1が成功したら、Step 2の処理を呼び出す（入力チェックのため）
    if (step1Data) {
      handleStep(mode, method, 2, productCalculationCallback);
    }
  } else if (step === 2) {
    const step2Data = handleGenericStep2(config);
    // Step 2が成功したら、Step 3の処理を呼び出す（入力チェックのため）
    if (step2Data) {
      handleStep(mode, method, 3, productCalculationCallback);
    }
  } else if (step === 3) {
    handleGenericStep3(config, productCalculationCallback);
  }
}

/**
 * 既存の個別関数との互換性のためのラッパー関数群
 */
export function handleFixedCalculateStep1(productCalculationCallback) {
  handleStep(MODE.FIXED, 'calculate', 1, productCalculationCallback);
}

export function handleFixedDirectStep1(productCalculationCallback) {
  handleStep(MODE.FIXED, 'direct', 1, productCalculationCallback);
}

export function handleWeightCalculateStep1(productCalculationCallback) {
  handleStep(MODE.WEIGHT, 'calculate', 1, productCalculationCallback);
}

export function handleWeightDirectStep1(productCalculationCallback) {
  handleStep(MODE.WEIGHT, 'direct', 1, productCalculationCallback);
}
