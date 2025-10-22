/**
 * メインアプリケーションロジック
 * リファクタリング版 - モジュール化により責務を分離
 */

import { per100FromBox } from './calculation.js';
import { qs, num, hide, toggleActive, bind } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, RADIO_NAMES } from './constants.js';
import { calculateFixed } from './calculator-fixed.js';
import { calculateWeight } from './calculator-weight.js';
import {
  setupFixedRadioHandlers,
  setupWeightRadioHandlers,
  bindFixedInputs,
  bindWeightInputs,
  setupDiscountSlider,
  clearAllInputs
} from './input-handler.js';
import {
  showWarning,
  displayResults,
  clearAllDisplays,
  updatePer100gDisplay
} from './display.js';
import {
  calculateProductSimulation,
  updateDiscountSimulation
} from './product-simulator.js';

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
}

/**
 * 計量モードの100gあたり売価を更新
 */
function handleWeightPer100gUpdate() {
  const price = num('boxPrice');
  const weight = num('boxWeight');
  const value = per100FromBox(price ?? NaN, weight ?? NaN);
  updatePer100gDisplay(UI_ELEMENTS.PER_100G_DISPLAY, value);
}

function handleWeightPer100gUpdateDirect() {
  const price = num('boxPriceDirect');
  const weight = num('boxWeightDirect');
  const value = per100FromBox(price ?? NaN, weight ?? NaN);
  updatePer100gDisplay(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, value);
}

/**
 * メイン計算処理
 */
function calculate() {
  const mode = appState.getMode();
  const method = qs(`input[name="${RADIO_NAMES[mode === MODE.FIXED ? 'YIELD_METHOD_FIXED' : 'YIELD_METHOD_WEIGHT']}"]:checked`)?.value;

  let result;
  if (mode === MODE.FIXED) {
    result = calculateFixed(method);
  } else {
    result = calculateWeight(method);
  }

  if (!result) {
    showWarning();
    return;
  }

  const snapshotData = displayResults(result);
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
  clearAllInputs();
  clearAllDisplays();
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

  // ラジオボタン切替
  setupFixedRadioHandlers(calculate);
  setupWeightRadioHandlers(calculate);

  // 入力フィールド監視
  bindFixedInputs(calculate);
  bindWeightInputs(() => {
    handleWeightPer100gUpdate();
    handleWeightPer100gUpdateDirect();
    calculate();
  });

  // 商品化シミュレーション
  bind([UI_ELEMENTS.EXP_WEIGHT, UI_ELEMENTS.CONSUMABLE], handleProductCalculation);

  // 値引きシミュレーション
  setupDiscountSlider(handleDiscountUpdate);
}

// アプリケーション起動
init();
