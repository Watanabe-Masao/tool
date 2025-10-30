/**
 * メインアプリケーションロジック（段階的フォーム対応 - 2モード）
 */

import { per100FromPerUnit, per100FromBox, markup, calcYield, toFixed, afterCostPer100 } from './calculation.js';
import { qs, num, hide, show, toggleActive, setText, yen, pct, qsa, addTapListener } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, FIXED_FIELDS, WEIGHT_FIELDS, RADIO_NAMES, YIELD_STATS_FIELDS } from './constants.js';
import { calculateFixed } from './calculator-fixed.js';
import { calculateWeight } from './calculator-weight.js';
import { calculateYieldRate } from './calculator-yield-stats.js';
import { initMultiPatternUI, resetMultiPatternUI, setFromYieldStats, setStatValue } from './multi-pattern-ui.js';
import { displayResults, displayReverseSimulation, displayReverseError, hideReverseSimulation, checkAndShowYieldWarning } from './display.js';
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
import { initHistoryUI, updateSaveButtonsVisibility, showHistoryModal } from './history-ui.js';
import { saveSessionState, restoreSessionState, applySessionState, clearSessionState } from './session.js';
import {
  hasInputValues,
  handleModeSwitch,
  switchMode,
  clearFixedInputs,
  clearWeightInputs,
  clearYieldStatsInputs,
  switchYieldMethodFixed,
  switchYieldMethodWeight
} from './mode-manager.js';
import {
  resetSteps,
  handleStep1,
  handleStep2,
  handleStep3,
  handleDirectStep1,
  handleDirectStep2,
  handleDirectStep3,
  resetWeightSteps,
  handleWeightStep1,
  handleWeightStep2,
  handleWeightStep3,
  handleWeightDirectStep1,
  handleWeightDirectStep2,
  handleWeightDirectStep3,
  handleProductCalculation
} from './form-manager.js';
import { calculateStatistics, detectOutliers } from './yield-stats-calc.js';
import {
  resetYieldStatsEntries,
  addYieldStatsRow,
  compactYieldStatsRows,
  restoreYieldStatsTable,
  updateYieldStatsStatistics
} from './yield-stats-table.js';
import {
  getConfidenceMessage,
  getMatrixEvaluation,
  calculateRequiredSampleSize
} from './yield-stats-helpers.js';
import { renderStatsChart } from './yield-stats-charts.js';
import { setupPresetEventListeners, openPresetModal } from './multi-pattern-presets.js';
import {
  displayCurrentStatistics,
  setupFormulaModal,
  updateLoadStatsButtons
} from './yield-stats-display.js';

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

// window オブジェクトに関数を公開（history-ui.js から呼び出すため）
// yield-stats-table.jsの関数をラップして、コールバックを渡す
window.restoreYieldStatsTable = function(tableData) {
  restoreYieldStatsTable(tableData, {
    updateYieldStatsStatistics: () => updateYieldStatsStatistics(displayCurrentStatistics),
    updateSaveButtonsVisibility
  });
};

// 複数パターン分析の読み込みボタン更新関数を公開（history-ui.js から呼び出すため）
window.updateLoadStatsButtons = updateLoadStatsButtons;

// yield-stats-table.js の関数呼び出しに使うコールバックオブジェクト
const yieldStatsCallbacks = {
  updateYieldStatsStatistics: () => updateYieldStatsStatistics(displayCurrentStatistics),
  updateSaveButtonsVisibility,
  addYieldStatsRow: () => addYieldStatsRow(yieldStatsCallbacks),
  compactYieldStatsRows: () => compactYieldStatsRows(yieldStatsCallbacks)
};

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
 * 全クリア処理（すべての入力フィールドをクリア）
 */
function clearAll() {
  const currentMode = appState.getMode();

  // UI表示のリセット
  if (currentMode === MODE.FIXED) {
    resetSteps();
    // 品名フィールドをクリア
    const fixedProductNameEl = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
    if (fixedProductNameEl) fixedProductNameEl.value = '';

    // 定額モードの入力フィールドをクリア
    [FIXED_FIELDS.CALCULATE.UNIT_COST, FIXED_FIELDS.CALCULATE.UNIT_PRICE,
     FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT, FIXED_FIELDS.CALCULATE.AFTER_WEIGHT,
     FIXED_FIELDS.CALCULATE.AFTER_PRICE_100].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });
    [FIXED_FIELDS.DIRECT.UNIT_COST, FIXED_FIELDS.DIRECT.UNIT_PRICE,
     FIXED_FIELDS.DIRECT.BEFORE_WEIGHT, FIXED_FIELDS.DIRECT.YIELD_RATE,
     FIXED_FIELDS.DIRECT.AFTER_PRICE_100].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });
  } else if (currentMode === MODE.WEIGHT) {
    resetWeightSteps();
    // 品名フィールドをクリア
    const weightProductNameEl = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
    if (weightProductNameEl) weightProductNameEl.value = '';

    // 計量モードの入力フィールドをクリア
    [WEIGHT_FIELDS.CALCULATE.BOX_COST, WEIGHT_FIELDS.CALCULATE.BOX_PRICE,
     WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT, WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE,
     WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT, WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });
    [WEIGHT_FIELDS.DIRECT.BOX_COST, WEIGHT_FIELDS.DIRECT.BOX_PRICE,
     WEIGHT_FIELDS.DIRECT.BOX_WEIGHT, WEIGHT_FIELDS.DIRECT.YIELD_RATE,
     WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100].forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });
    // 100gあたりの売価表示をクリア
    setText(UI_ELEMENTS.PER_100G_DISPLAY, '-');
    setText(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, '-');
  } else if (currentMode === MODE.YIELD_STATS) {
    // 品名フィールドをクリア
    const productNameEl = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
    if (productNameEl) productNameEl.value = '';

    // テーブルをクリア
    yieldStatsEntryCounter = 0;
    const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
    if (tbody) {
      tbody.innerHTML = '';
      addYieldStatsRow(yieldStatsCallbacks);
    }
    resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks));
  }

  // 商品化シミュレーションの入力フィールドをクリア
  const expWeightEl = qs(`#${UI_ELEMENTS.EXP_WEIGHT}`);
  if (expWeightEl) expWeightEl.value = '';
  const consumableEl = qs(`#${UI_ELEMENTS.CONSUMABLE}`);
  if (consumableEl) consumableEl.value = '';

  appState.resetAll();
  // 保存ボタンの表示を更新（履歴IDがクリアされたので通常の保存ボタンを表示）
  updateSaveButtonsVisibility();
  // セッション状態をクリア
  clearSessionState();
}

/**
 * セッション状態を復元
 */
function restoreSession() {
  const sessionData = restoreSessionState();
  if (!sessionData) {
    return; // セッションデータがない場合は何もしない
  }

  const { mode, yieldMethod } = sessionData;

  // モードを復元
  if (mode && mode !== appState.getMode()) {
    // 複数パターン分析モードがセッションから復元された場合、歩留まり統計は表示しない
    if (mode === MODE.MULTI_PATTERN) {
      appState.showYieldStatsWithMultiPattern = false;
    }

    // モードボタンをクリックして切り替え
    const btnId = mode === MODE.FIXED ? UI_ELEMENTS.FIXED_BTN :
                  mode === MODE.WEIGHT ? UI_ELEMENTS.WEIGHT_BTN :
                  mode === MODE.YIELD_STATS ? UI_ELEMENTS.YIELD_STATS_BTN :
                  UI_ELEMENTS.MULTI_PATTERN_BTN;
    const modeBtn = qs(`#${btnId}`);
    if (modeBtn) {
      modeBtn.click(); // switchMode が呼ばれる
    }
  }

  // 歩留まり率計算方法を復元
  if ((mode === MODE.FIXED || mode === MODE.WEIGHT) && yieldMethod) {
    const radioName = mode === MODE.FIXED ? RADIO_NAMES.YIELD_METHOD_FIXED : RADIO_NAMES.YIELD_METHOD_WEIGHT;
    const radio = document.querySelector(`input[name="${radioName}"][value="${yieldMethod}"]`);
    if (radio && !radio.checked) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // 少し待ってから入力値を復元（UIの切り替えが完了するまで）
  setTimeout(() => {
    applySessionState(sessionData);
  }, 100);
}

/**
 * アプリケーション初期化
 */
function init() {
  // モード切替ボタン
  const fixedBtn = qs(`#${UI_ELEMENTS.FIXED_BTN}`);
  const weightBtn = qs(`#${UI_ELEMENTS.WEIGHT_BTN}`);
  const yieldStatsBtn = qs(`#${UI_ELEMENTS.YIELD_STATS_BTN}`);
  const multiPatternBtn = qs(`#${UI_ELEMENTS.MULTI_PATTERN_BTN}`);

  if (fixedBtn) {
    fixedBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.FIXED, {
        resetSteps,
        resetWeightSteps,
        resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
        updateLoadStatsButtons
      });
    });
  }

  if (weightBtn) {
    weightBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.WEIGHT, {
        resetSteps,
        resetWeightSteps,
        resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
        updateLoadStatsButtons
      });
    });
  }

  if (yieldStatsBtn) {
    yieldStatsBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.YIELD_STATS, {
        resetSteps,
        resetWeightSteps,
        resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
        updateLoadStatsButtons
      });
    });
  }

  if (multiPatternBtn) {
    multiPatternBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.MULTI_PATTERN, {
        resetSteps,
        resetWeightSteps,
        resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
        updateLoadStatsButtons
      });
    });
  }

  // クリアボタン（クラスベースで全てのボタンに設定）
  qsa('.clear-btn').forEach(btn => {
    addTapListener(btn, clearAll);
  });

  // 歩留まり率入力方法の切り替え（定額モード）
  qsa(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]`).forEach(r => {
    r.addEventListener('change', () => switchYieldMethodFixed(resetSteps, updateReverseSimulationLabels));
  });

  // 歩留まり率入力方法の切り替え（計量モード）
  qsa(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]`).forEach(r => {
    r.addEventListener('change', () => switchYieldMethodWeight(resetWeightSteps, updateReverseSimulationLabels));
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
  qs('#selectAllOutliers')?.addEventListener('touchend', (e) => {
    e.preventDefault();
    const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
    });
    handleOutlierCheckboxChange();
  }, { passive: false });

  qs('#deselectAllOutliers')?.addEventListener('click', () => {
    const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    handleOutlierCheckboxChange();
  });
  qs('#deselectAllOutliers')?.addEventListener('touchend', (e) => {
    e.preventDefault();
    const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    handleOutlierCheckboxChange();
  }, { passive: false });

  // 外れ値を含む行を削除
  qs('#deleteOutlierRows')?.addEventListener('click', deleteOutlierRows);
  qs('#deleteOutlierRows')?.addEventListener('touchend', (e) => { e.preventDefault(); deleteOutlierRows(); }, { passive: false });

  // 計算式詳細モーダル
  setupFormulaModal();

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

  // 複数パターン分析モードの初期化
  initMultiPatternUI();

  // プリセット管理の初期化
  setupPresetEventListeners();

  // 保存ボタンの表示を初期化
  updateSaveButtonsVisibility();

  // すべての入力フィールドに変更時のセッション保存を追加
  const sessionSaveFields = [
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
    // 歩留まり統計モード
    UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME,
    // 商品化シミュレーション
    UI_ELEMENTS.EXP_WEIGHT,
    UI_ELEMENTS.CONSUMABLE
  ];

  // セッション保存機能は無効化（モード切替時に確認ダイアログを表示する方式に変更）
  // sessionSaveFields.forEach(fieldId => {
  //   qs(`#${fieldId}`)?.addEventListener('input', () => {
  //     saveSessionState(appState.getMode());
  //   });
  // });

  // セッション状態の復元は無効化（モード切替時に確認ダイアログを表示する方式に変更）
  // restoreSession();

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

  /**
   * 推奨代表値を複数パターン分析に読み込む
   * @param {boolean} shouldSwitchMode - モード切替を行うか
   * @param {string} statsType - 統計タイプ（指定がない場合は現在の表示タイプを使用）
   */
  function loadRecommendedValueToMultiPattern(shouldSwitchMode = false, statsType = null) {
    const selectedStatsType = statsType || window.yieldStatsState?.currentDisplayType || 'yieldRate';
    const statsData = window.statsDataByType?.[selectedStatsType];

    if (!statsData) {
      console.warn('[MultiPattern] 統計データが見つかりません');
      return;
    }

    const recommended = getRecommendedValue(statsData);
    if (!recommended) {
      console.warn('[MultiPattern] 推奨値を取得できません');
      return;
    }

    const productNameEl = qs('#yieldStatsProductName');
    const productName = productNameEl?.value || '';

    loadStatsValueToMultiPattern(recommended.value, selectedStatsType, shouldSwitchMode, productName);

    // 推奨値を読み込んだことを通知
    console.log(`[MultiPattern] 推奨代表値（${recommended.label}: ${toFixed(recommended.value, 2)}）を読み込みました`);
  }

  /**
   * 統計値を複数パターン分析に読み込む共通関数
   * @param {number} value - 読み込む統計値
   * @param {string} displayType - 統計タイプ ('yieldRate', 'beforeWeight', 'afterWeight')
   * @param {boolean} shouldSwitchMode - モード切替を行うか
   * @param {string} productName - 商品名（オプション）
   */
  function loadStatsValueToMultiPattern(value, displayType, shouldSwitchMode = false, productName = '') {
    // モード切替が必要な場合
    if (shouldSwitchMode) {
      switchMode(MODE.MULTI_PATTERN, {
        resetSteps,
        resetWeightSteps,
        resetYieldStatsEntries,
        addYieldStatsRow,
        updateLoadStatsButtons
      });
    }

    // multi-pattern-ui.jsのsetStatValue関数を使用して値を設定
    setStatValue(value, displayType, productName);

    // 統計値の取り込みは「新規計算」として扱う（状態フラグをリセット）
    appState.markAsNewCalculation();
    updateSaveButtonsVisibility();
  }

  /**
   * 一括取り込み：推奨値をステップ1に転記
   */
  function loadAllStatsToMultiPattern() {
    try {
      const yieldRateStats = window.statsDataByType?.yieldRate;
      const beforeWeightStats = window.statsDataByType?.beforeWeight;
      const afterWeightStats = window.statsDataByType?.afterWeight;

      if (!yieldRateStats || yieldRateStats.count < 2) {
        alert('歩留まり率の統計データがありません。先に歩留まり統計で計算を実行してください。');
        return;
      }

      // 商品名を取得
      const productNameEl = qs('#yieldStatsProductName');
      const productName = productNameEl?.value?.trim() || '';

      // 推奨値を取得
      const yieldRateRecommended = getRecommendedValue(yieldRateStats);
      if (!yieldRateRecommended) {
        alert('歩留まり率の推奨値を取得できませんでした。');
        return;
      }

      // 加工前重量の推奨値を取得（存在する場合）
      const beforeWeightRecommended = beforeWeightStats && beforeWeightStats.count >= 2
        ? getRecommendedValue(beforeWeightStats)
        : null;

      // 加工後重量の推奨値を取得（存在する場合）
      const afterWeightRecommended = afterWeightStats && afterWeightStats.count >= 2
        ? getRecommendedValue(afterWeightStats)
        : null;

      // 現在のモードを取得
      const currentMode = document.querySelector('input[name="yieldMethodMultiPattern"]:checked')?.value || 'calculate';

      // 確認ダイアログ
      if (!confirm('推奨値をステップ1に転記しますか？')) {
        return;
      }

      // モードに応じて値を設定
      if (currentMode === 'direct') {
        // 歩留まり率直接入力モード：歩留まり率と加工前重量を設定
        setStatValue(yieldRateRecommended.value, 'yieldRate', productName);

        if (beforeWeightRecommended) {
          setStatValue(beforeWeightRecommended.value, 'beforeWeight');
          showTransferNotification(`推奨値を転記しました：歩留まり率 ${toFixed(yieldRateRecommended.value, 2)}%、加工前重量 ${toFixed(beforeWeightRecommended.value, 2)}g`);
        } else {
          showTransferNotification(`推奨値を転記しました：歩留まり率 ${toFixed(yieldRateRecommended.value, 2)}%`);
        }
      } else {
        // 重量から計算モード：加工前重量と加工後重量を設定
        if (!beforeWeightRecommended) {
          alert('加工前重量の統計データがありません。');
          return;
        }
        if (!afterWeightRecommended) {
          alert('加工後重量の統計データがありません。');
          return;
        }

        setStatValue(beforeWeightRecommended.value, 'beforeWeight', productName);
        setStatValue(afterWeightRecommended.value, 'afterWeight');

        showTransferNotification(`推奨値を転記しました：加工前重量 ${toFixed(beforeWeightRecommended.value, 2)}g、加工後重量 ${toFixed(afterWeightRecommended.value, 2)}g`);
      }

      // 統計値の取り込みは「新規計算」として扱う（状態フラグをリセット）
      appState.markAsNewCalculation();
      updateSaveButtonsVisibility();

      focusFirstPatternInput();
    } catch (error) {
      console.error('[ERROR] 一括転記でエラーが発生しました:', error);
      alert('一括転記でエラーが発生しました。コンソールを確認してください。');
    }
  }

  // グローバルスコープに公開（イベントハンドラーから参照できるように）
  window.loadAllStatsToMultiPattern = loadAllStatsToMultiPattern;
  window.loadStatsValueToMultiPattern = loadStatsValueToMultiPattern;
  window.showTransferNotification = showTransferNotification;
  window.focusFirstPatternInput = focusFirstPatternInput;

  /**
   * 転記完了通知を表示
   * @param {string} message - 通知メッセージ
   */
  function showTransferNotification(message) {
    // 通知用の要素を作成または取得
    let notification = qs('#transferNotification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'transferNotification';
      notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        background: #4caf50;
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        animation: slideIn 0.3s ease-out;
      `;
      document.body.appendChild(notification);
    }

    notification.textContent = message;
    notification.style.display = 'block';

    // 3秒後に非表示
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
  }

  /**
   * 最初のパターンの原価入力欄にフォーカス
   */
  function focusFirstPatternInput() {
    setTimeout(() => {
      const firstInput = qs('#multiPatternTableBody .pattern-unit-cost');
      if (firstInput) {
        firstInput.focus();
        firstInput.select();
      }
    }, 100);
  }

  // 複数パターン分析への遷移ボタン
  qs('#goToMultiPatternBtn')?.addEventListener('click', () => {
    handleModeSwitch(MODE.MULTI_PATTERN);
  });

  // 複数パターン分析画面: モード切り替えラジオボタンの変更イベント
  qsa('input[name="yieldMethodMultiPattern"]').forEach(radio => {
    radio.addEventListener('change', () => {
      updateLoadStatsButtons();
    });
  });

  // 複数パターン分析画面: 統計タイプ選択プルダウンの変更イベント
  qs('#loadStatsTypeSelect')?.addEventListener('change', () => {
    updateLoadStatsButtons();
  });

  // 注意：読み込みボタンのイベントハンドラーは動的に生成されるため、
  // updateLoadStatsButtons関数内で設定されます。
  // ここには静的なイベントハンドラーは設置しません（競合を防ぐため）。

  // σパターン一括生成ボタン
  qs('#generateSigmaPatternsBtn')?.addEventListener('click', () => {
    const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
    const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
    const statsData = window.statsDataByType?.[selectedStatsType];

    if (!statsData) {
      alert('統計データがありません。先に歩留まり統計で計算を実行してください。');
      return;
    }

    if (!confirm('現在のパターンをクリアして、標準偏差パターン（平均±1σ、±2σ）を自動生成しますか？')) {
      return;
    }

    // σパターンを生成
    const sigmaPatterns = generateSigmaPatterns(statsData, 2);

    if (sigmaPatterns.length === 0) {
      alert('パターンを生成できませんでした。');
      return;
    }

    // 複数パターン分析のパターンテーブルをクリアして、σパターンを追加
    // この処理はmulti-pattern-ui.jsに実装された関数を呼び出す
    if (window.multiPatternUI && typeof window.multiPatternUI.replaceAllPatterns === 'function') {
      window.multiPatternUI.replaceAllPatterns(sigmaPatterns);
      console.log(`[MultiPattern] ${sigmaPatterns.length}個のσパターンを生成しました`, sigmaPatterns);
    } else {
      console.warn('[MultiPattern] replaceAllPatterns関数が見つかりません');
      alert('パターン生成機能の初期化に失敗しました。');
    }
  });
  qs('#generateSigmaPatternsBtn')?.addEventListener('touchend', (e) => {
    e.preventDefault();
    const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
    const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
    const statsData = window.statsDataByType?.[selectedStatsType];

    if (!statsData) {
      alert('統計データがありません。先に歩留まり統計で計算を実行してください。');
      return;
    }

    if (!confirm('現在のパターンをクリアして、標準偏差パターン（平均±1σ、±2σ）を自動生成しますか？')) {
      return;
    }

    // σパターンを生成
    const sigmaPatterns = generateSigmaPatterns(statsData, 2);

    if (sigmaPatterns.length === 0) {
      alert('パターンを生成できませんでした。');
      return;
    }

    // 複数パターン分析のパターンテーブルをクリアして、σパターンを追加
    // この処理はmulti-pattern-ui.jsに実装された関数を呼び出す
    if (window.multiPatternUI && typeof window.multiPatternUI.replaceAllPatterns === 'function') {
      window.multiPatternUI.replaceAllPatterns(sigmaPatterns);
      console.log(`[MultiPattern] ${sigmaPatterns.length}個のσパターンを生成しました`, sigmaPatterns);
    } else {
      console.warn('[MultiPattern] replaceAllPatterns関数が見つかりません');
      alert('パターン生成機能の初期化に失敗しました。');
    }
  }, { passive: false });

  // グローバル入力変更検知：全ての入力フィールドの変更を監視してUI状態フラグを更新
  document.addEventListener('input', (e) => {
    // 入力フィールド（number, text）または select要素が変更された場合
    if (e.target.matches('input[type="number"], input[type="text"], select, textarea')) {
      // 保存ダイアログ内の入力は除外（これらは保存処理で別途処理される）
      if (!e.target.closest('#saveDialog')) {
        appState.markAsChanged();
        updateSaveButtonsVisibility();
      }
    }
  });

  // 歩留まり統計モードのテーブル行削除時も変更としてマーク
  document.addEventListener('click', (e) => {
    if (e.target.closest('.delete-row-btn')) {
      appState.markAsChanged();
      updateSaveButtonsVisibility();
    }
  });

  // プリセット管理機能のイベントリスナー
  qs('#presetModalClose')?.addEventListener('click', closePresetModal);
  qs('#createNewPresetBtn')?.addEventListener('click', openNewPresetEditor);
  qs('#addPairBtn')?.addEventListener('click', addPairToTemp);
  qs('#savePresetBtn')?.addEventListener('click', savePresetFromModal);
  qs('#cancelPresetBtn')?.addEventListener('click', () => {
    showPresetList();
    renderPresetList();
  });
  qs('#addSelectedPresetsBtn')?.addEventListener('click', addSelectedPresetsToTable);

  // プリセットから選択ボタン
  qs('#showPresetManagerBtn')?.addEventListener('click', openPresetModal);

  // モーダルのオーバーレイクリックで閉じる
  qs('#presetModal .modal-overlay')?.addEventListener('click', closePresetModal);

  // イベント委譲でプリセット関連のボタンを処理（クリックイベント）
  document.addEventListener('click', (e) => {
    // 編集ボタン
    if (e.target.classList.contains('preset-btn-edit')) {
      const presetId = parseInt(e.target.dataset.presetId);
      editPresetFromModal(presetId);
    }
    // 削除ボタン
    else if (e.target.classList.contains('preset-btn-delete')) {
      const presetId = parseInt(e.target.dataset.presetId);
      deletePresetFromModal(presetId);
    }
    // ペア削除ボタン
    else if (e.target.classList.contains('btn-remove-pair')) {
      const index = parseInt(e.target.dataset.pairIndex);
      removeTempPair(index);
    }
    // 統計読み込みボタン（平均値）
    else if (e.target.id === 'loadStatsMeanBtn' || e.target.closest('#loadStatsMeanBtn')) {
      const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
      const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
      const statsData = window.statsDataByType?.[selectedStatsType];
      if (statsData) {
        loadStatsValueToMultiPattern(statsData.mean, selectedStatsType, false);
      }
    }
    // 統計読み込みボタン（中央値）
    else if (e.target.id === 'loadStatsMedianBtn' || e.target.closest('#loadStatsMedianBtn')) {
      const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
      const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
      const statsData = window.statsDataByType?.[selectedStatsType];
      if (statsData) {
        loadStatsValueToMultiPattern(statsData.median, selectedStatsType, false);
      }
    }
    // 統計読み込みボタン（推奨値）
    else if (e.target.id === 'loadStatsRecommendedBtn' || e.target.closest('#loadStatsRecommendedBtn')) {
      const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
      const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
      loadRecommendedValueToMultiPattern(false, selectedStatsType);
    }
  });

  // イベント委譲でプリセット関連のボタンを処理（タッチイベント - モバイル対応）
  document.addEventListener('touchend', (e) => {
    // 編集ボタン
    if (e.target.classList.contains('preset-btn-edit')) {
      e.preventDefault();
      const presetId = parseInt(e.target.dataset.presetId);
      editPresetFromModal(presetId);
    }
    // 削除ボタン
    else if (e.target.classList.contains('preset-btn-delete')) {
      e.preventDefault();
      const presetId = parseInt(e.target.dataset.presetId);
      deletePresetFromModal(presetId);
    }
    // ペア削除ボタン
    else if (e.target.classList.contains('btn-remove-pair')) {
      e.preventDefault();
      const index = parseInt(e.target.dataset.pairIndex);
      removeTempPair(index);
    }
    // 統計読み込みボタン（平均値）
    else if (e.target.id === 'loadStatsMeanBtn' || e.target.closest('#loadStatsMeanBtn')) {
      e.preventDefault();
      const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
      const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
      const statsData = window.statsDataByType?.[selectedStatsType];
      if (statsData) {
        loadStatsValueToMultiPattern(statsData.mean, selectedStatsType, false);
      }
    }
    // 統計読み込みボタン（中央値）
    else if (e.target.id === 'loadStatsMedianBtn' || e.target.closest('#loadStatsMedianBtn')) {
      e.preventDefault();
      const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
      const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
      const statsData = window.statsDataByType?.[selectedStatsType];
      if (statsData) {
        loadStatsValueToMultiPattern(statsData.median, selectedStatsType, false);
      }
    }
    // 統計読み込みボタン（推奨値）
    else if (e.target.id === 'loadStatsRecommendedBtn' || e.target.closest('#loadStatsRecommendedBtn')) {
      e.preventDefault();
      const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
      const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
      loadRecommendedValueToMultiPattern(false, selectedStatsType);
    }
    // 歩留まり統計データを読み込むボタン
    else if (e.target.id === 'loadYieldStatsDataBtn' || e.target.closest('#loadYieldStatsDataBtn')) {
      e.preventDefault();
      showHistoryModal();
    }
  }, { passive: false });

  // アコーディオン（折りたたみ）機能
  document.querySelectorAll('.accordion-header').forEach(header => {
    header.addEventListener('click', () => {
      const contentId = header.getAttribute('data-accordion');
      const content = document.getElementById(contentId);

      if (!content) return;

      // トグル処理
      const isCollapsed = header.classList.contains('is-collapsed');

      if (isCollapsed) {
        // 展開
        header.classList.remove('is-collapsed');
        content.classList.remove('is-hidden');
      } else {
        // 折りたたみ
        header.classList.add('is-collapsed');
        content.classList.add('is-hidden');
      }
    });
  });
}

// アプリケーション起動
// DOMの準備が完了してから初期化を実行
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // DOMが既に読み込まれている場合は即座に実行
  init();
}
