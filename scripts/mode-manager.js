/**
 * モード管理モジュール
 * アプリケーションのモード切り替えとモード間の状態管理を担当
 */

import { qs, hide, show, setText } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, FIXED_FIELDS, WEIGHT_FIELDS, RADIO_NAMES, YIELD_STATS_FIELDS } from './constants.js';
import { resetMultiPatternUI } from './multi-pattern-ui.js';
import { updateSaveButtonsVisibility } from './history-ui.js';

/**
 * 歩留まり統計データが有効かチェック
 * @returns {boolean}
 */
function hasValidYieldStatsData() {
  const data = appState.getYieldStatsData();
  if (!data) return false;

  // 少なくとも1つのデータタイプに2つ以上のデータポイントがあるかチェック
  const hasYieldRate = data.yieldRate && data.yieldRate.length >= 2;
  const hasBeforeWeight = data.beforeWeight && data.beforeWeight.length >= 2;
  const hasAfterWeight = data.afterWeight && data.afterWeight.length >= 2;

  return hasYieldRate || hasBeforeWeight || hasAfterWeight;
}

/**
 * 現在のモードに入力値があるかチェック
 * @returns {boolean} 入力値があればtrue
 */
export function hasInputValues() {
  const currentMode = appState.getMode();

  if (currentMode === MODE.FIXED) {
    // 品名フィールドをチェック
    const fixedProductNameEl = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
    if (fixedProductNameEl && fixedProductNameEl.value.trim() !== '') return true;

    const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
    const method = methodRadio ? methodRadio.value : 'calculate';

    if (method === 'calculate') {
      // 重量から計算モード
      const fields = [
        FIXED_FIELDS.CALCULATE.UNIT_COST,
        FIXED_FIELDS.CALCULATE.UNIT_PRICE,
        FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT,
        FIXED_FIELDS.CALCULATE.AFTER_WEIGHT,
        FIXED_FIELDS.CALCULATE.AFTER_PRICE_100
      ];
      return fields.some(id => {
        const el = qs(`#${id}`);
        return el && el.value.trim() !== '';
      });
    } else {
      // 歩留まり率直接入力モード
      const fields = [
        FIXED_FIELDS.DIRECT.UNIT_COST,
        FIXED_FIELDS.DIRECT.UNIT_PRICE,
        FIXED_FIELDS.DIRECT.BEFORE_WEIGHT,
        FIXED_FIELDS.DIRECT.YIELD_RATE,
        FIXED_FIELDS.DIRECT.AFTER_PRICE_100
      ];
      return fields.some(id => {
        const el = qs(`#${id}`);
        return el && el.value.trim() !== '';
      });
    }
  } else if (currentMode === MODE.WEIGHT) {
    // 品名フィールドをチェック
    const weightProductNameEl = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
    if (weightProductNameEl && weightProductNameEl.value.trim() !== '') return true;

    const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
    const method = methodRadio ? methodRadio.value : 'calculate';

    if (method === 'calculate') {
      // 重量から計算モード
      const fields = [
        WEIGHT_FIELDS.CALCULATE.BOX_COST,
        WEIGHT_FIELDS.CALCULATE.BOX_PRICE,
        WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT,
        WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE,
        WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT,
        WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100
      ];
      return fields.some(id => {
        const el = qs(`#${id}`);
        return el && el.value.trim() !== '';
      });
    } else {
      // 歩留まり率直接入力モード
      const fields = [
        WEIGHT_FIELDS.DIRECT.BOX_COST,
        WEIGHT_FIELDS.DIRECT.BOX_PRICE,
        WEIGHT_FIELDS.DIRECT.BOX_WEIGHT,
        WEIGHT_FIELDS.DIRECT.YIELD_RATE,
        WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100
      ];
      return fields.some(id => {
        const el = qs(`#${id}`);
        return el && el.value.trim() !== '';
      });
    }
  } else if (currentMode === MODE.YIELD_STATS) {
    // 歩留まり統計モード：品名または行データがあるかチェック
    const productNameEl = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
    if (productNameEl && productNameEl.value.trim() !== '') return true;

    // テーブルに入力があるかチェック
    const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
    if (tbody) {
      const rows = tbody.querySelectorAll('.yield-stats-row');
      for (const row of rows) {
        const rowId = row.dataset.rowId;
        if (rowId !== undefined) {
          const beforeWeightInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
          const afterWeightInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);
          if ((beforeWeightInput && beforeWeightInput.value.trim() !== '') ||
              (afterWeightInput && afterWeightInput.value.trim() !== '')) {
            return true;
          }
        }
      }
    }
  } else if (currentMode === MODE.MULTI_PATTERN) {
    // 複数パターン分析モード：品名または入力値があるかチェック
    const productNameEl = qs(`#${UI_ELEMENTS.MULTI_PATTERN_PRODUCT_NAME}`);
    if (productNameEl && productNameEl.value.trim() !== '') return true;

    // 歩留まり率と加工前重量をチェック
    const yieldRateEl = qs('#multiYieldRate');
    const beforeWeightEl = qs('#multiBeforeWeight');
    if ((yieldRateEl && yieldRateEl.value.trim() !== '') ||
        (beforeWeightEl && beforeWeightEl.value.trim() !== '')) {
      return true;
    }

    // パターンテーブルに入力があるかチェック
    const tbody = qs('#multiPatternTableBody');
    if (tbody) {
      const inputs = tbody.querySelectorAll('input[type="number"]');
      for (const input of inputs) {
        if (input.value.trim() !== '') return true;
      }
    }
  }

  return false;
}

/**
 * 入力フィールドをクリア
 * @param {Array<string>} fieldIds - クリアするフィールドのID配列
 */
function clearFields(fieldIds) {
  fieldIds.forEach(id => {
    const el = qs(`#${id}`);
    if (el) el.value = '';
  });
}

/**
 * 定額モードの入力をクリア
 */
export function clearFixedInputs() {
  const fixedProductNameEl = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
  if (fixedProductNameEl) fixedProductNameEl.value = '';

  clearFields([
    FIXED_FIELDS.CALCULATE.UNIT_COST,
    FIXED_FIELDS.CALCULATE.UNIT_PRICE,
    FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT,
    FIXED_FIELDS.CALCULATE.AFTER_WEIGHT,
    FIXED_FIELDS.CALCULATE.AFTER_PRICE_100,
    FIXED_FIELDS.DIRECT.UNIT_COST,
    FIXED_FIELDS.DIRECT.UNIT_PRICE,
    FIXED_FIELDS.DIRECT.BEFORE_WEIGHT,
    FIXED_FIELDS.DIRECT.YIELD_RATE,
    FIXED_FIELDS.DIRECT.AFTER_PRICE_100
  ]);
}

/**
 * 計量モードの入力をクリア
 */
export function clearWeightInputs() {
  const weightProductNameEl = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
  if (weightProductNameEl) weightProductNameEl.value = '';

  clearFields([
    WEIGHT_FIELDS.CALCULATE.BOX_COST,
    WEIGHT_FIELDS.CALCULATE.BOX_PRICE,
    WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT,
    WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE,
    WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT,
    WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100,
    WEIGHT_FIELDS.DIRECT.BOX_COST,
    WEIGHT_FIELDS.DIRECT.BOX_PRICE,
    WEIGHT_FIELDS.DIRECT.BOX_WEIGHT,
    WEIGHT_FIELDS.DIRECT.YIELD_RATE,
    WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100
  ]);

  setText(UI_ELEMENTS.PER_100G_DISPLAY, '-');
  setText(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, '-');
}

/**
 * 歩留まり統計モードの入力をクリア
 * @param {Function} addYieldStatsRowCallback - 行追加のコールバック関数
 */
export function clearYieldStatsInputs(addYieldStatsRowCallback) {
  const productNameEl = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
  if (productNameEl) productNameEl.value = '';

  // テーブルをクリア
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (tbody) {
    tbody.innerHTML = '';
    if (typeof addYieldStatsRowCallback === 'function') {
      addYieldStatsRowCallback();
    }
  }
}

/**
 * モード切替のハンドリング（入力値がある場合は確認ダイアログを表示）
 * @param {string} newMode - 切り替え先のモード
 * @param {Object} callbacks - モード別のコールバック関数
 */
export function handleModeSwitch(newMode, callbacks = {}) {
  // 同じモードへの切り替えはスキップ
  if (appState.getMode() === newMode) {
    return;
  }

  // 歩留まり統計→複数パターン分析の切り替えは確認なしで実行（データを保持するため）
  const currentMode = appState.getMode();
  if (currentMode === MODE.YIELD_STATS && newMode === MODE.MULTI_PATTERN) {
    switchMode(newMode, callbacks);
    return;
  }

  // 複数パターン分析→歩留まり統計の切り替えも確認なしで実行
  if (currentMode === MODE.MULTI_PATTERN && newMode === MODE.YIELD_STATS) {
    switchMode(newMode, callbacks);
    return;
  }

  // 現在のモードに入力値があるかチェック
  if (hasInputValues()) {
    if (confirm('入力されている値が消えますが、よろしいですか？')) {
      switchMode(newMode, callbacks);
    }
    // ユーザーがキャンセルした場合は何もしない
  } else {
    // 入力値がない場合は直接切り替え
    switchMode(newMode, callbacks);
  }
}

/**
 * モード切替処理
 * @param {string} newMode - 切り替え先のモード
 * @param {Object} callbacks - モード別のコールバック関数
 */
export function switchMode(newMode, callbacks = {}) {
  const currentMode = appState.getMode();

  // 現在のモードの入力値をクリア
  // 歩留まり統計⇔複数パターン分析の切り替えではデータをクリアしない
  const isYieldStatsMultiPatternSwitch =
    (currentMode === MODE.YIELD_STATS && newMode === MODE.MULTI_PATTERN) ||
    (currentMode === MODE.MULTI_PATTERN && newMode === MODE.YIELD_STATS);

  if (!isYieldStatsMultiPatternSwitch) {
    if (currentMode === MODE.FIXED) {
      clearFixedInputs();
    } else if (currentMode === MODE.WEIGHT) {
      clearWeightInputs();
    } else if (currentMode === MODE.YIELD_STATS) {
      clearYieldStatsInputs(callbacks.addYieldStatsRow);

      // 注意：統計データは複数パターン分析で使用するため、ここではクリアしない
    } else if (currentMode === MODE.MULTI_PATTERN) {
      // 複数パターン分析モードのクリア処理
      resetMultiPatternUI();
    }
  }

  // 履歴から読み込んだIDをクリア（入力値をクリアしたので新規保存に戻す）
  // 歩留まり統計⇔複数パターン分析の切り替えでは履歴IDを保持
  if (!isYieldStatsMultiPatternSwitch) {
    appState.clearLoadedHistoryId();
    // UI状態フラグを更新：新規計算
    appState.markAsNewCalculation();
  }

  appState.setMode(newMode);

  // 歩留まり統計表示フラグの管理
  if (currentMode === MODE.YIELD_STATS && newMode === MODE.MULTI_PATTERN) {
    // 歩留まり統計から複数パターン分析に切り替えた場合、データがある場合のみ表示
    appState.showYieldStatsWithMultiPattern = hasValidYieldStatsData();
  } else if (newMode === MODE.MULTI_PATTERN && currentMode !== MODE.YIELD_STATS) {
    // 歩留まり統計以外から複数パターン分析に切り替えた場合は非表示
    appState.showYieldStatsWithMultiPattern = false;
  } else if (currentMode === MODE.MULTI_PATTERN && newMode !== MODE.MULTI_PATTERN) {
    // 複数パターン分析から別のモードに切り替えた場合はリセット
    appState.showYieldStatsWithMultiPattern = false;
  }

  const isFixed = newMode === MODE.FIXED;
  const isWeight = newMode === MODE.WEIGHT;
  const isYieldStats = newMode === MODE.YIELD_STATS;
  const isMultiPattern = newMode === MODE.MULTI_PATTERN;

  // ボタンのアクティブ状態を更新
  [UI_ELEMENTS.FIXED_BTN, UI_ELEMENTS.WEIGHT_BTN, UI_ELEMENTS.YIELD_STATS_BTN, UI_ELEMENTS.MULTI_PATTERN_BTN].forEach(btnId => {
    const btn = qs(`#${btnId}`);
    if (btn) {
      btn.classList.remove('is-active');
      btn.setAttribute('aria-selected', 'false');
    }
  });

  let activeBtnId;
  if (isFixed) activeBtnId = UI_ELEMENTS.FIXED_BTN;
  else if (isWeight) activeBtnId = UI_ELEMENTS.WEIGHT_BTN;
  else if (isYieldStats) activeBtnId = UI_ELEMENTS.YIELD_STATS_BTN;
  else if (isMultiPattern) activeBtnId = UI_ELEMENTS.MULTI_PATTERN_BTN;

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

  hide(UI_ELEMENTS.RESULTS);
  hide(UI_ELEMENTS.WARNING);

  // 各モードの初期化コールバックを実行
  if (isFixed && callbacks.resetSteps) {
    callbacks.resetSteps();
  } else if (isWeight && callbacks.resetWeightSteps) {
    callbacks.resetWeightSteps();
  } else if (isYieldStats && callbacks.resetYieldStatsEntries) {
    callbacks.resetYieldStatsEntries();
  } else if (isMultiPattern && callbacks.updateLoadStatsButtons) {
    callbacks.updateLoadStatsButtons();
  }

  // 保存ボタンの表示を更新（新規保存に戻す）
  updateSaveButtonsVisibility();
}

/**
 * 歩留まり率入力方法の切り替え（定額モード）
 * @param {Function} resetStepsCallback - ステップリセットのコールバック
 * @param {Function} updateLabelsCallback - ラベル更新のコールバック
 */
export function switchYieldMethodFixed(resetStepsCallback, updateLabelsCallback) {
  const method = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`)?.value;
  const isDirect = method === 'direct';

  // モードの表示切り替え
  qs(`#${UI_ELEMENTS.FIXED_CALCULATE_MODE}`).classList.toggle('is-hidden', isDirect);
  qs(`#${UI_ELEMENTS.FIXED_DIRECT_MODE}`).classList.toggle('is-hidden', !isDirect);

  // ステップをリセット
  if (typeof resetStepsCallback === 'function') {
    resetStepsCallback();
  }

  // 定額モードの入力値をクリア
  clearFields([
    FIXED_FIELDS.CALCULATE.UNIT_COST,
    FIXED_FIELDS.CALCULATE.UNIT_PRICE,
    FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT,
    FIXED_FIELDS.CALCULATE.AFTER_WEIGHT,
    FIXED_FIELDS.CALCULATE.AFTER_PRICE_100,
    FIXED_FIELDS.DIRECT.UNIT_COST,
    FIXED_FIELDS.DIRECT.UNIT_PRICE,
    FIXED_FIELDS.DIRECT.BEFORE_WEIGHT,
    FIXED_FIELDS.DIRECT.YIELD_RATE,
    FIXED_FIELDS.DIRECT.AFTER_PRICE_100
  ]);

  // 逆算シミュレーションが表示されている場合、ラベルのみ更新
  if (typeof updateLabelsCallback === 'function') {
    updateLabelsCallback();
  }

  // UI状態を更新：計算方法を変更したので変更フラグを立てる
  appState.markAsChanged();
  updateSaveButtonsVisibility();
}

/**
 * 歩留まり率入力方法の切り替え（計量モード）
 * @param {Function} resetWeightStepsCallback - ステップリセットのコールバック
 * @param {Function} updateLabelsCallback - ラベル更新のコールバック
 */
export function switchYieldMethodWeight(resetWeightStepsCallback, updateLabelsCallback) {
  const method = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`)?.value;
  const isDirect = method === 'direct';

  // モードの表示切り替え
  qs(`#${UI_ELEMENTS.WEIGHT_CALCULATE_MODE}`).classList.toggle('is-hidden', isDirect);
  qs(`#${UI_ELEMENTS.WEIGHT_DIRECT_MODE}`).classList.toggle('is-hidden', !isDirect);

  // ステップをリセット
  if (typeof resetWeightStepsCallback === 'function') {
    resetWeightStepsCallback();
  }

  // 計量モードの入力値をクリア
  clearFields([
    WEIGHT_FIELDS.CALCULATE.BOX_COST,
    WEIGHT_FIELDS.CALCULATE.BOX_PRICE,
    WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT,
    WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE,
    WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT,
    WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100,
    WEIGHT_FIELDS.DIRECT.BOX_COST,
    WEIGHT_FIELDS.DIRECT.BOX_PRICE,
    WEIGHT_FIELDS.DIRECT.BOX_WEIGHT,
    WEIGHT_FIELDS.DIRECT.YIELD_RATE,
    WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100
  ]);

  // 100gあたりの売価表示をクリア
  setText(UI_ELEMENTS.PER_100G_DISPLAY, '-');
  setText(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, '-');

  // 逆算シミュレーションが表示されている場合、ラベルのみ更新
  if (typeof updateLabelsCallback === 'function') {
    updateLabelsCallback();
  }

  // UI状態を更新：計算方法を変更したので変更フラグを立てる
  appState.markAsChanged();
  updateSaveButtonsVisibility();
}
