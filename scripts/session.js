/**
 * セッション状態の永続化
 * ページリロード後も入力値とモードを保持
 */

import { qs } from './dom-utils.js';
import { MODE, FIXED_FIELDS, WEIGHT_FIELDS, YIELD_STATS_FIELDS, UI_ELEMENTS, RADIO_NAMES } from './constants.js';

const SESSION_KEY = 'yieldCalculatorSession';

/**
 * 現在のセッション状態を localStorage に保存
 * @param {string} mode - 現在のモード
 */
export function saveSessionState(mode) {
  try {
    const sessionData = {
      mode: mode,
      timestamp: Date.now()
    };

    // 各モードの入力値を収集
    if (mode === MODE.FIXED) {
      const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
      sessionData.yieldMethod = methodRadio ? methodRadio.value : 'calculate';

      if (sessionData.yieldMethod === 'calculate') {
        sessionData.inputs = {
          unitCost: qs(`#${FIXED_FIELDS.CALCULATE.UNIT_COST}`)?.value || '',
          unitPrice: qs(`#${FIXED_FIELDS.CALCULATE.UNIT_PRICE}`)?.value || '',
          beforeWeight: qs(`#${FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT}`)?.value || '',
          afterWeight: qs(`#${FIXED_FIELDS.CALCULATE.AFTER_WEIGHT}`)?.value || '',
          afterPrice100: qs(`#${FIXED_FIELDS.CALCULATE.AFTER_PRICE_100}`)?.value || ''
        };
      } else {
        sessionData.inputs = {
          unitCost: qs(`#${FIXED_FIELDS.DIRECT.UNIT_COST}`)?.value || '',
          unitPrice: qs(`#${FIXED_FIELDS.DIRECT.UNIT_PRICE}`)?.value || '',
          beforeWeight: qs(`#${FIXED_FIELDS.DIRECT.BEFORE_WEIGHT}`)?.value || '',
          yieldRate: qs(`#${FIXED_FIELDS.DIRECT.YIELD_RATE}`)?.value || '',
          afterPrice100: qs(`#${FIXED_FIELDS.DIRECT.AFTER_PRICE_100}`)?.value || ''
        };
      }
    } else if (mode === MODE.WEIGHT) {
      const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
      sessionData.yieldMethod = methodRadio ? methodRadio.value : 'calculate';

      if (sessionData.yieldMethod === 'calculate') {
        sessionData.inputs = {
          boxCost: qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_COST}`)?.value || '',
          boxPrice: qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_PRICE}`)?.value || '',
          boxWeight: qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT}`)?.value || '',
          beforeSample: qs(`#${WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE}`)?.value || '',
          afterWeight: qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT}`)?.value || '',
          afterPrice100: qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100}`)?.value || ''
        };
      } else {
        sessionData.inputs = {
          boxCost: qs(`#${WEIGHT_FIELDS.DIRECT.BOX_COST}`)?.value || '',
          boxPrice: qs(`#${WEIGHT_FIELDS.DIRECT.BOX_PRICE}`)?.value || '',
          boxWeight: qs(`#${WEIGHT_FIELDS.DIRECT.BOX_WEIGHT}`)?.value || '',
          yieldRate: qs(`#${WEIGHT_FIELDS.DIRECT.YIELD_RATE}`)?.value || '',
          afterPrice100: qs(`#${WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100}`)?.value || ''
        };
      }
    } else if (mode === MODE.YIELD_STATS) {
      sessionData.inputs = {
        productName: qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`)?.value || ''
      };

      // テーブルデータを収集
      const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
      const tableData = [];

      if (tbody) {
        const rows = tbody.querySelectorAll('.yield-stats-row');
        rows.forEach((row) => {
          const rowId = row.dataset.rowId;
          if (rowId !== undefined) {
            const beforeWeightInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
            const afterWeightInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);

            const beforeWeight = beforeWeightInput ? beforeWeightInput.value : '';
            const afterWeight = afterWeightInput ? afterWeightInput.value : '';

            // 空の行もスキップせずに保存（行番号を保持するため）
            tableData.push({
              beforeWeight: beforeWeight,
              afterWeight: afterWeight
            });
          }
        });
      }

      sessionData.tableData = tableData;
    }

    // 商品化シミュレーションの値
    sessionData.simulation = {
      expWeight: qs(`#${UI_ELEMENTS.EXP_WEIGHT}`)?.value || '',
      consumable: qs(`#${UI_ELEMENTS.CONSUMABLE}`)?.value || ''
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
  } catch (error) {
    console.error('Failed to save session state:', error);
  }
}

/**
 * localStorage からセッション状態を復元
 * @returns {Object|null} セッションデータ、またはnull
 */
export function restoreSessionState() {
  try {
    const sessionDataStr = localStorage.getItem(SESSION_KEY);
    if (!sessionDataStr) {
      return null;
    }

    const sessionData = JSON.parse(sessionDataStr);

    // 24時間以上経過したセッションデータは破棄
    const ONE_DAY = 24 * 60 * 60 * 1000;
    if (sessionData.timestamp && (Date.now() - sessionData.timestamp > ONE_DAY)) {
      clearSessionState();
      return null;
    }

    return sessionData;
  } catch (error) {
    console.error('Failed to restore session state:', error);
    return null;
  }
}

/**
 * セッション状態をクリア
 */
export function clearSessionState() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear session state:', error);
  }
}

/**
 * セッションデータから入力フィールドを復元
 * @param {Object} sessionData - セッションデータ
 */
export function applySessionState(sessionData) {
  if (!sessionData || !sessionData.mode) {
    return false;
  }

  const { mode, yieldMethod, inputs, simulation, tableData } = sessionData;

  // モードを復元（後でmain.jsから呼ばれる想定）
  // ここでは入力値のみ復元

  // 商品化シミュレーション
  if (simulation) {
    const expWeightEl = qs(`#${UI_ELEMENTS.EXP_WEIGHT}`);
    if (expWeightEl && simulation.expWeight) expWeightEl.value = simulation.expWeight;

    const consumableEl = qs(`#${UI_ELEMENTS.CONSUMABLE}`);
    if (consumableEl && simulation.consumable) consumableEl.value = simulation.consumable;
  }

  // 各モードの入力値を復元
  if (!inputs) {
    return true; // モード情報のみ
  }

  if (mode === MODE.FIXED) {
    if (yieldMethod === 'calculate') {
      const unitCostEl = qs(`#${FIXED_FIELDS.CALCULATE.UNIT_COST}`);
      if (unitCostEl && inputs.unitCost) unitCostEl.value = inputs.unitCost;

      const unitPriceEl = qs(`#${FIXED_FIELDS.CALCULATE.UNIT_PRICE}`);
      if (unitPriceEl && inputs.unitPrice) unitPriceEl.value = inputs.unitPrice;

      const beforeWeightEl = qs(`#${FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT}`);
      if (beforeWeightEl && inputs.beforeWeight) beforeWeightEl.value = inputs.beforeWeight;

      const afterWeightEl = qs(`#${FIXED_FIELDS.CALCULATE.AFTER_WEIGHT}`);
      if (afterWeightEl && inputs.afterWeight) afterWeightEl.value = inputs.afterWeight;

      const afterPrice100El = qs(`#${FIXED_FIELDS.CALCULATE.AFTER_PRICE_100}`);
      if (afterPrice100El && inputs.afterPrice100) afterPrice100El.value = inputs.afterPrice100;
    } else {
      const unitCostEl = qs(`#${FIXED_FIELDS.DIRECT.UNIT_COST}`);
      if (unitCostEl && inputs.unitCost) unitCostEl.value = inputs.unitCost;

      const unitPriceEl = qs(`#${FIXED_FIELDS.DIRECT.UNIT_PRICE}`);
      if (unitPriceEl && inputs.unitPrice) unitPriceEl.value = inputs.unitPrice;

      const beforeWeightEl = qs(`#${FIXED_FIELDS.DIRECT.BEFORE_WEIGHT}`);
      if (beforeWeightEl && inputs.beforeWeight) beforeWeightEl.value = inputs.beforeWeight;

      const yieldRateEl = qs(`#${FIXED_FIELDS.DIRECT.YIELD_RATE}`);
      if (yieldRateEl && inputs.yieldRate) yieldRateEl.value = inputs.yieldRate;

      const afterPrice100El = qs(`#${FIXED_FIELDS.DIRECT.AFTER_PRICE_100}`);
      if (afterPrice100El && inputs.afterPrice100) afterPrice100El.value = inputs.afterPrice100;
    }
  } else if (mode === MODE.WEIGHT) {
    if (yieldMethod === 'calculate') {
      const boxCostEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_COST}`);
      if (boxCostEl && inputs.boxCost) boxCostEl.value = inputs.boxCost;

      const boxPriceEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_PRICE}`);
      if (boxPriceEl && inputs.boxPrice) boxPriceEl.value = inputs.boxPrice;

      const boxWeightEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT}`);
      if (boxWeightEl && inputs.boxWeight) boxWeightEl.value = inputs.boxWeight;

      const beforeSampleEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE}`);
      if (beforeSampleEl && inputs.beforeSample) beforeSampleEl.value = inputs.beforeSample;

      const afterWeightEl = qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT}`);
      if (afterWeightEl && inputs.afterWeight) afterWeightEl.value = inputs.afterWeight;

      const afterPrice100El = qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100}`);
      if (afterPrice100El && inputs.afterPrice100) afterPrice100El.value = inputs.afterPrice100;
    } else {
      const boxCostEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_COST}`);
      if (boxCostEl && inputs.boxCost) boxCostEl.value = inputs.boxCost;

      const boxPriceEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_PRICE}`);
      if (boxPriceEl && inputs.boxPrice) boxPriceEl.value = inputs.boxPrice;

      const boxWeightEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_WEIGHT}`);
      if (boxWeightEl && inputs.boxWeight) boxWeightEl.value = inputs.boxWeight;

      const yieldRateEl = qs(`#${WEIGHT_FIELDS.DIRECT.YIELD_RATE}`);
      if (yieldRateEl && inputs.yieldRate) yieldRateEl.value = inputs.yieldRate;

      const afterPrice100El = qs(`#${WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100}`);
      if (afterPrice100El && inputs.afterPrice100) afterPrice100El.value = inputs.afterPrice100;
    }
  } else if (mode === MODE.YIELD_STATS) {
    const productNameEl = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
    if (productNameEl && inputs.productName) {
      productNameEl.value = inputs.productName;
    }

    // テーブルデータを復元（window.restoreYieldStatsTable関数を使用）
    if (tableData && window.restoreYieldStatsTable) {
      window.restoreYieldStatsTable(tableData);
    }
  }

  return true;
}
