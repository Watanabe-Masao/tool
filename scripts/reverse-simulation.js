/**
 * 逆算シミュレーション機能
 * 目標値入率から必要な値（重量、売価、原価、歩留まり率など）を逆算
 */

import { per100FromPerUnit, per100FromBox, calcYield, toFixed, afterCostPer100 } from './calculation.js';
import { qs, num, hide, show } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, FIXED_FIELDS, WEIGHT_FIELDS, RADIO_NAMES } from './constants.js';
import {
  calculateWeightFromMarkup,
  calculatePriceFromMarkup,
  calculateUnitCostFromMarkup,
  calculateBoxCostFromMarkup,
  calculateAfterWeightFromMarkup,
  calculateYieldRateFromMarkup,
  calculateDiscountRateFromGross
} from './product-simulator.js';
import { displayReverseSimulation, displayReverseError, hideReverseSimulation } from './display.js';

// 定数
const PERCENT_MULTIPLIER = 100;

/**
 * 逆算シミュレーションをリセット
 */
export function resetReverseSimulation() {
  hide(UI_ELEMENTS.REVERSE_SIM_SECTION);
  hideReverseSimulation();
  // 目標値入率をクリア
  const targetInput = qs(`#${UI_ELEMENTS.TARGET_MARKUP}`);
  if (targetInput) targetInput.value = '';
}

/**
 * 逆算シミュレーションの表示/非表示を切り替え
 * @param {Function} handleReverseCalculation - 逆算計算処理の関数
 */
export function toggleReverseSimulation(handleReverseCalculation) {
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
export function updateReverseSimulationLabels() {
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
export function handleReverseCalculation() {
  const snapshot = appState.getSnapshot();
  const targetMarkup = num(UI_ELEMENTS.TARGET_MARKUP);
  const productData = appState.getProductData();
  const currentMode = appState.getMode();

  // ラベルを更新
  updateReverseSimulationLabels();

  // どのラジオボタンが選択されているか取得
  const selectedRadio = document.querySelector(`input[name="${RADIO_NAMES.REVERSE_CALC_TARGET}"]:checked`);
  if (!selectedRadio) {
    displayReverseError('計算エラー', '計算する項目を選択してください');
    return;
  }

  const calcTarget = selectedRadio.value;

  // 値引率計算の場合は別処理
  if (calcTarget === 'discount') {
    if (!Number.isFinite(targetMarkup)) {
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
    hideReverseSimulation();
    return;
  }

  // 通常の計算の必須データチェック
  // 原価逆算ではafterCostは不要（afterPriceから逆算するため）
  if (calcTarget === 'cost') {
    if (!Number.isFinite(snapshot.afterPrice)) {
      displayReverseError('計算エラー', 'ステップ3まで入力して加工後の売価を計算してください');
      return;
    }
  } else {
    if (!Number.isFinite(snapshot.afterCost) || !Number.isFinite(snapshot.afterPrice)) {
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

  if (result !== null && Number.isFinite(result) && result >= 0) {
    displayReverseSimulation(result, label, unit, currentValue);
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
export function applyReverseSimulationResult() {
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
