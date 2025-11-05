/**
 * 履歴データの復元機能
 */

import { qs, show, hide, setText, yen, pct } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, FIXED_FIELDS, WEIGHT_FIELDS, UI_ELEMENTS, RADIO_NAMES } from './constants.js';
import { grossFromMarkup, toFixed } from './calculation.js';
import { hasValidYieldStatsData } from './yield-stats-helpers.js';

/**
 * モード切り替え（履歴読み込み専用）
 * @param {string} mode
 */
export function switchToMode(mode) {
  const currentMode = appState.getMode();
  const isFixed = mode === MODE.FIXED;
  const isWeight = mode === MODE.WEIGHT;
  const isYieldStats = mode === MODE.YIELD_STATS;
  const isMultiPattern = mode === MODE.MULTI_PATTERN;

  // 歩留まり統計表示フラグの管理
  if (currentMode === MODE.YIELD_STATS && isMultiPattern) {
    // 歩留まり統計から複数パターン分析に切り替えた場合、データがある場合のみ表示
    const data = appState.getYieldStatsData();
    appState.showYieldStatsWithMultiPattern = hasValidYieldStatsData(data);
  } else if (isMultiPattern && currentMode !== MODE.YIELD_STATS) {
    // 歩留まり統計以外から複数パターン分析に切り替えた場合は非表示
    appState.showYieldStatsWithMultiPattern = false;
  } else if (currentMode === MODE.MULTI_PATTERN && !isMultiPattern) {
    // 複数パターン分析から別のモードに切り替えた場合はリセット
    appState.showYieldStatsWithMultiPattern = false;
  }

  // appStateのモードを更新
  appState.setMode(mode);

  // ボタンのアクティブ状態を更新
  [UI_ELEMENTS.FIXED_BTN, UI_ELEMENTS.WEIGHT_BTN, UI_ELEMENTS.YIELD_STATS_BTN, UI_ELEMENTS.MULTI_PATTERN_BTN].forEach(btnId => {
    const btn = qs(`#${btnId}`);
    if (btn) {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-selected', 'false');
    }
  });

  const activeBtnId = isFixed ? UI_ELEMENTS.FIXED_BTN :
                      isWeight ? UI_ELEMENTS.WEIGHT_BTN :
                      isYieldStats ? UI_ELEMENTS.YIELD_STATS_BTN :
                      UI_ELEMENTS.MULTI_PATTERN_BTN;
  const activeBtn = qs(`#${activeBtnId}`);
  if (activeBtn) {
    activeBtn.classList.add('is-active');
    activeBtn.setAttribute('aria-selected', 'true');
  }

  // セクションの表示/非表示を切り替え
  const fixedInputs = qs(`#${UI_ELEMENTS.FIXED_INPUTS}`);
  const weightInputs = qs(`#${UI_ELEMENTS.WEIGHT_INPUTS}`);
  const yieldStatsInputs = qs(`#${UI_ELEMENTS.YIELD_STATS_INPUTS}`);
  const multiPatternInputs = qs(`#${UI_ELEMENTS.MULTI_PATTERN_INPUTS}`);

  if (fixedInputs) fixedInputs.classList.toggle('is-hidden', !isFixed);
  if (weightInputs) weightInputs.classList.toggle('is-hidden', !isWeight);
  // 歩留まり統計から複数パターン分析に切り替えた場合のみ、歩留まり統計も表示
  if (yieldStatsInputs) {
    const shouldShowYieldStats = isYieldStats || (isMultiPattern && appState.showYieldStatsWithMultiPattern);
    yieldStatsInputs.classList.toggle('is-hidden', !shouldShowYieldStats);
  }
  if (multiPatternInputs) multiPatternInputs.classList.toggle('is-hidden', !isMultiPattern);

  // 結果と警告を非表示
  hide(UI_ELEMENTS.RESULTS);
  hide(UI_ELEMENTS.WARNING);
}

/**
 * 歩留まり計算方法を切り替え（履歴読み込み専用）
 * changeイベントを経由せず、UIを直接切り替える
 * これにより、入力値クリアやフラグ変更を防ぐ
 * @param {string} mode
 * @param {string} yieldMethod
 */
export function switchYieldMethod(mode, yieldMethod) {
  const radioName = mode === MODE.FIXED ? RADIO_NAMES.YIELD_METHOD_FIXED : RADIO_NAMES.YIELD_METHOD_WEIGHT;
  const radio = document.querySelector(`input[name="${radioName}"][value="${yieldMethod}"]`);
  if (radio) {
    radio.checked = true;
  }

  const isDirect = yieldMethod === 'direct';

  if (mode === MODE.FIXED) {
    // 定額モードの表示切り替え
    const calculateMode = qs(`#${UI_ELEMENTS.FIXED_CALCULATE_MODE}`);
    const directMode = qs(`#${UI_ELEMENTS.FIXED_DIRECT_MODE}`);
    if (calculateMode) calculateMode.classList.toggle('is-hidden', isDirect);
    if (directMode) directMode.classList.toggle('is-hidden', !isDirect);
  } else if (mode === MODE.WEIGHT) {
    // 計量モードの表示切り替え
    const calculateMode = qs(`#${UI_ELEMENTS.WEIGHT_CALCULATE_MODE}`);
    const directMode = qs(`#${UI_ELEMENTS.WEIGHT_DIRECT_MODE}`);
    if (calculateMode) calculateMode.classList.toggle('is-hidden', isDirect);
    if (directMode) directMode.classList.toggle('is-hidden', !isDirect);
  }
}

/**
 * 全ての入力フィールドに値を復元
 * @param {string} mode
 * @param {Object} input
 * @param {string} productName - 履歴の商品名（商品名フィールドに設定）
 */
export function restoreAllInputFields(mode, input, productName = '') {
  // 商品名フィールドを復元（履歴の商品名を使用）
  if (mode === MODE.FIXED) {
    const fixedProductNameEl = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
    if (fixedProductNameEl) {
      fixedProductNameEl.value = productName || '';
    }
  } else if (mode === MODE.WEIGHT) {
    const weightProductNameEl = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
    if (weightProductNameEl) {
      weightProductNameEl.value = productName || '';
    }
  } else if (mode === MODE.YIELD_STATS) {
    const yieldStatsProductNameEl = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
    if (yieldStatsProductNameEl) {
      yieldStatsProductNameEl.value = productName || '';
    }
  }

  // 商品化シミュレーション（定額・計量モードのみ）
  if (mode === MODE.FIXED || mode === MODE.WEIGHT) {
    const expWeightEl = qs(`#${UI_ELEMENTS.EXP_WEIGHT}`);
    if (expWeightEl && input.expWeight != null) expWeightEl.value = input.expWeight;

    const consumableEl = qs(`#${UI_ELEMENTS.CONSUMABLE}`);
    if (consumableEl && input.consumable != null) consumableEl.value = input.consumable;
  }

  if (mode === MODE.FIXED) {
    if (input.yieldMethod === 'calculate') {
      // 重量から計算モード
      const unitCostEl = qs(`#${FIXED_FIELDS.CALCULATE.UNIT_COST}`);
      if (unitCostEl && input.unitCost != null) unitCostEl.value = input.unitCost;

      const unitPriceEl = qs(`#${FIXED_FIELDS.CALCULATE.UNIT_PRICE}`);
      if (unitPriceEl && input.unitPrice != null) unitPriceEl.value = input.unitPrice;

      const beforeWeightEl = qs(`#${FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT}`);
      if (beforeWeightEl && input.beforeWeight != null) beforeWeightEl.value = input.beforeWeight;

      const afterWeightEl = qs(`#${FIXED_FIELDS.CALCULATE.AFTER_WEIGHT}`);
      if (afterWeightEl && input.afterWeight != null) afterWeightEl.value = input.afterWeight;

      const afterPrice100El = qs(`#${FIXED_FIELDS.CALCULATE.AFTER_PRICE_100}`);
      if (afterPrice100El && input.afterPrice100 != null) afterPrice100El.value = input.afterPrice100;

      // inputイベントを発火させない（restoreCalculationResultsで結果を直接表示）
    } else {
      // 歩留まり率直接入力モード
      const unitCostEl = qs(`#${FIXED_FIELDS.DIRECT.UNIT_COST}`);
      if (unitCostEl && input.unitCost != null) unitCostEl.value = input.unitCost;

      const unitPriceEl = qs(`#${FIXED_FIELDS.DIRECT.UNIT_PRICE}`);
      if (unitPriceEl && input.unitPrice != null) unitPriceEl.value = input.unitPrice;

      const beforeWeightEl = qs(`#${FIXED_FIELDS.DIRECT.BEFORE_WEIGHT}`);
      if (beforeWeightEl && input.beforeWeight != null) beforeWeightEl.value = input.beforeWeight;

      const yieldRateEl = qs(`#${FIXED_FIELDS.DIRECT.YIELD_RATE}`);
      if (yieldRateEl && input.yieldRate != null) yieldRateEl.value = input.yieldRate;

      const afterPrice100El = qs(`#${FIXED_FIELDS.DIRECT.AFTER_PRICE_100}`);
      if (afterPrice100El && input.afterPrice100 != null) afterPrice100El.value = input.afterPrice100;

      // inputイベントを発火させない（restoreCalculationResultsで結果を直接表示）
    }
  } else if (mode === MODE.WEIGHT) {
    if (input.yieldMethod === 'calculate') {
      // 重量から計算モード
      const boxCostEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_COST}`);
      if (boxCostEl && input.boxCost != null) boxCostEl.value = input.boxCost;

      const boxPriceEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_PRICE}`);
      if (boxPriceEl && input.boxPrice != null) boxPriceEl.value = input.boxPrice;

      const boxWeightEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT}`);
      if (boxWeightEl && input.boxWeight != null) boxWeightEl.value = input.boxWeight;

      const beforeSampleEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE}`);
      if (beforeSampleEl && input.beforeSample != null) beforeSampleEl.value = input.beforeSample;

      const afterWeightEl = qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT}`);
      if (afterWeightEl && input.afterWeight != null) afterWeightEl.value = input.afterWeight;

      const afterPrice100El = qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100}`);
      if (afterPrice100El && input.afterPrice100 != null) afterPrice100El.value = input.afterPrice100;

      // inputイベントを発火させない（restoreCalculationResultsで結果を直接表示）
    } else {
      // 歩留まり率直接入力モード
      const boxCostEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_COST}`);
      if (boxCostEl && input.boxCost != null) boxCostEl.value = input.boxCost;

      const boxPriceEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_PRICE}`);
      if (boxPriceEl && input.boxPrice != null) boxPriceEl.value = input.boxPrice;

      const boxWeightEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_WEIGHT}`);
      if (boxWeightEl && input.boxWeight != null) boxWeightEl.value = input.boxWeight;

      const yieldRateEl = qs(`#${WEIGHT_FIELDS.DIRECT.YIELD_RATE}`);
      if (yieldRateEl && input.yieldRate != null) yieldRateEl.value = input.yieldRate;

      const afterPrice100El = qs(`#${WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100}`);
      if (afterPrice100El && input.afterPrice100 != null) afterPrice100El.value = input.afterPrice100;

      // inputイベントを発火させない（restoreCalculationResultsで結果を直接表示）
    }
  } else if (mode === MODE.YIELD_STATS) {
    // 歩留まり統計モード（商品名は116-130行目で既に設定済み）

    // テーブルデータを復元（window.restoreYieldStatsTable関数を使用）
    if (input.tableData && window.restoreYieldStatsTable) {
      window.restoreYieldStatsTable(input.tableData);
    }
  }
}

/**
 * 保存された計算結果を復元してappStateを更新
 * @param {string} mode
 * @param {string} yieldMethod
 * @param {Object} result
 * @param {Object} input
 */
export function restoreCalculationResults(mode, yieldMethod, result, input) {
  // appStateのsnapshotを更新
  appState.updateSnapshot({
    ac: result.afterCost,
    ap: result.afterPrice,
    bm: result.beforeMarkup,
    am: result.afterMarkup,
    bp: result.beforePrice,
    bc: result.beforeCost,
    yr: result.yieldRate
  });

  // ステップを最終ステップに設定
  appState.setStep(3);

  // 結果値をフォーマット
  const beforeCost = yen(toFixed(result.beforeCost));
  const beforePrice = yen(toFixed(result.beforePrice));
  const beforeMarkup = pct(toFixed(result.beforeMarkup));
  const afterCost = yen(toFixed(result.afterCost));
  const afterPrice = yen(toFixed(result.afterPrice));
  const afterMarkup = pct(toFixed(result.afterMarkup));
  const yieldRate = pct(toFixed(result.yieldRate));

  // モードとメソッドに応じてステップ結果コンテナを表示し、値を設定
  if (mode === MODE.FIXED) {
    if (yieldMethod === 'calculate') {
      // 重量から計算モード
      show(UI_ELEMENTS.FIXED_STEP1);
      show(UI_ELEMENTS.FIXED_STEP1_RESULT);
      setText(UI_ELEMENTS.BEFORE_COST_STEP1, beforeCost);
      setText(UI_ELEMENTS.BEFORE_PRICE_STEP1, beforePrice);
      setText(UI_ELEMENTS.BEFORE_MARKUP_STEP1, beforeMarkup);

      show(UI_ELEMENTS.FIXED_STEP2);
      show(UI_ELEMENTS.FIXED_STEP2_RESULT);
      setText(UI_ELEMENTS.YIELD_RATE_STEP2, yieldRate);

      show(UI_ELEMENTS.FIXED_STEP3);
      show(UI_ELEMENTS.FIXED_STEP3_RESULT);
      setText(UI_ELEMENTS.AFTER_COST_STEP3, afterCost);
      setText(UI_ELEMENTS.AFTER_PRICE_STEP3, afterPrice);
      setText(UI_ELEMENTS.AFTER_MARKUP_STEP3, afterMarkup);
    } else {
      // 歩留まり率直接入力モード
      show(UI_ELEMENTS.FIXED_DIRECT_STEP1);
      show(UI_ELEMENTS.FIXED_DIRECT_STEP2);
      show(UI_ELEMENTS.FIXED_DIRECT_STEP2_RESULT);
      setText(UI_ELEMENTS.YIELD_RATE_DIRECT_STEP2, yieldRate);
      setText(UI_ELEMENTS.BEFORE_COST_DIRECT_STEP2, beforeCost);
      setText(UI_ELEMENTS.BEFORE_PRICE_DIRECT_STEP2, beforePrice);
      setText(UI_ELEMENTS.BEFORE_MARKUP_DIRECT_STEP2, beforeMarkup);

      show(UI_ELEMENTS.FIXED_DIRECT_STEP3);
      show(UI_ELEMENTS.FIXED_DIRECT_STEP3_RESULT);
      setText(UI_ELEMENTS.AFTER_COST_DIRECT_STEP3, afterCost);
      setText(UI_ELEMENTS.AFTER_PRICE_DIRECT_STEP3, afterPrice);
      setText(UI_ELEMENTS.AFTER_MARKUP_DIRECT_STEP3, afterMarkup);
    }
  } else {
    if (yieldMethod === 'calculate') {
      // 重量から計算モード
      show(UI_ELEMENTS.WEIGHT_STEP1);
      show(UI_ELEMENTS.WEIGHT_STEP1_RESULT);
      setText(UI_ELEMENTS.BEFORE_COST_WEIGHT_STEP1, beforeCost);
      setText(UI_ELEMENTS.BEFORE_PRICE_WEIGHT_STEP1, beforePrice);
      setText(UI_ELEMENTS.BEFORE_MARKUP_WEIGHT_STEP1, beforeMarkup);

      // 100gあたりの売価を計算して表示
      if (input.boxPrice != null && input.boxWeight != null) {
        const per100gPrice = (input.boxPrice / (input.boxWeight * 1000)) * 100;
        setText(UI_ELEMENTS.PER_100G_DISPLAY, yen(toFixed(per100gPrice)));
      }

      show(UI_ELEMENTS.WEIGHT_STEP2);
      show(UI_ELEMENTS.WEIGHT_STEP2_RESULT);
      setText(UI_ELEMENTS.YIELD_RATE_WEIGHT_STEP2, yieldRate);

      show(UI_ELEMENTS.WEIGHT_STEP3);
      show(UI_ELEMENTS.WEIGHT_STEP3_RESULT);
      setText(UI_ELEMENTS.AFTER_COST_WEIGHT_STEP3, afterCost);
      setText(UI_ELEMENTS.AFTER_PRICE_WEIGHT_STEP3, afterPrice);
      setText(UI_ELEMENTS.AFTER_MARKUP_WEIGHT_STEP3, afterMarkup);
    } else {
      // 歩留まり率直接入力モード
      show(UI_ELEMENTS.WEIGHT_DIRECT_STEP1);
      show(UI_ELEMENTS.WEIGHT_DIRECT_STEP1_RESULT);
      setText(UI_ELEMENTS.BEFORE_COST_WEIGHT_DIRECT_STEP1, beforeCost);
      setText(UI_ELEMENTS.BEFORE_PRICE_WEIGHT_DIRECT_STEP1, beforePrice);
      setText(UI_ELEMENTS.BEFORE_MARKUP_WEIGHT_DIRECT_STEP1, beforeMarkup);

      // 100gあたりの売価を計算して表示
      if (input.boxPrice != null && input.boxWeight != null) {
        const per100gPrice = (input.boxPrice / (input.boxWeight * 1000)) * 100;
        setText(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, yen(toFixed(per100gPrice)));
      }

      show(UI_ELEMENTS.WEIGHT_DIRECT_STEP2);
      show(UI_ELEMENTS.WEIGHT_DIRECT_STEP2_RESULT);
      setText(UI_ELEMENTS.YIELD_RATE_WEIGHT_DIRECT_STEP2, yieldRate);

      show(UI_ELEMENTS.WEIGHT_DIRECT_STEP3);
      show(UI_ELEMENTS.WEIGHT_DIRECT_STEP3_RESULT);
      setText(UI_ELEMENTS.AFTER_COST_WEIGHT_DIRECT_STEP3, afterCost);
      setText(UI_ELEMENTS.AFTER_PRICE_WEIGHT_DIRECT_STEP3, afterPrice);
      setText(UI_ELEMENTS.AFTER_MARKUP_WEIGHT_DIRECT_STEP3, afterMarkup);
    }
  }

  // 最終結果セクションを表示
  show(UI_ELEMENTS.RESULTS);

  // 粗利率を計算して表示
  const beforeGross = grossFromMarkup(result.beforeMarkup, 0);
  const afterGross = grossFromMarkup(result.afterMarkup, 0);
  setText(UI_ELEMENTS.BEFORE_GROSS, pct(toFixed(beforeGross)));
  setText(UI_ELEMENTS.AFTER_GROSS, pct(toFixed(afterGross)));
}
