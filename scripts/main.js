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
import { initHistoryUI, updateSaveButtonsVisibility, showHistoryModal } from './history-ui.js';
import { saveSessionState, restoreSessionState, applySessionState, clearSessionState } from './session.js';

/**
 * 現在のモードに入力値があるかチェック
 * @returns {boolean} 入力値があればtrue
 */
function hasInputValues() {
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
 * モード切替のハンドリング（入力値がある場合は確認ダイアログを表示）
 * @param {string} newMode - 切り替え先のモード
 */
function handleModeSwitch(newMode) {
  // 同じモードへの切り替えはスキップ
  if (appState.getMode() === newMode) {
    return;
  }

  // 歩留まり統計→複数パターン分析の切り替えは確認なしで実行（データを保持するため）
  const currentMode = appState.getMode();
  if (currentMode === MODE.YIELD_STATS && newMode === MODE.MULTI_PATTERN) {
    switchMode(newMode);
    return;
  }

  // 複数パターン分析→歩留まり統計の切り替えも確認なしで実行
  if (currentMode === MODE.MULTI_PATTERN && newMode === MODE.YIELD_STATS) {
    switchMode(newMode);
    return;
  }

  // 現在のモードに入力値があるかチェック
  if (hasInputValues()) {
    if (confirm('入力されている値が消えますが、よろしいですか？')) {
      switchMode(newMode);
    }
    // ユーザーがキャンセルした場合は何もしない
  } else {
    // 入力値がない場合は直接切り替え
    switchMode(newMode);
  }
}

/**
 * モード切替処理
 */
function switchMode(newMode) {
  const currentMode = appState.getMode();

  // 現在のモードの入力値をクリア
  // 歩留まり統計⇔複数パターン分析の切り替えではデータをクリアしない
  const isYieldStatsMultiPatternSwitch =
    (currentMode === MODE.YIELD_STATS && newMode === MODE.MULTI_PATTERN) ||
    (currentMode === MODE.MULTI_PATTERN && newMode === MODE.YIELD_STATS);

  if (!isYieldStatsMultiPatternSwitch) {
    if (currentMode === MODE.FIXED) {
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
        addYieldStatsRow();
      }

      // 注意：統計データ（statsDataByType）と状態（yieldStatsState）は
      // 複数パターン分析で使用するため、ここではクリアしない
      // 新しいモードが歩留まり統計モードの場合のみクリアする
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
    // 歩留まり統計から複数パターン分析に切り替えた場合のみ、歩留まり統計を表示
    appState.showYieldStatsWithMultiPattern = true;
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

  // ステップをリセット
  if (isFixed) {
    resetSteps();
  } else if (isWeight) {
    resetWeightSteps();
  } else if (isYieldStats) {
    resetYieldStatsEntries();

    // 歩留まり統計モードに入る時のみ、統計データと状態をリセット
    window.yieldStatsState = {
      currentDisplayType: 'yieldRate',
      isFromHistory: false,
      isCalculated: false,
      hasYieldRateData: false,
      hasBeforeWeightData: false,
      hasAfterWeightData: false,
      isOutlierExcluded: false,
      manuallyExcludedOutlierIndices: new Set(),
      currentOutlierValues: [],
      shouldShowMultiPatternLink: false
    };

    // 統計データもクリア
    window.statsDataByType = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };
  } else if (isMultiPattern) {
    // 複数パターン分析モードは特別なリセット処理は不要（既にresetMultiPatternUIで処理済み）
    // 歩留まり統計から読み込むボタンの状態を更新
    updateLoadStatsButtons();
  }

  // 保存ボタンの表示を更新（新規保存に戻す）
  updateSaveButtonsVisibility();
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

  // 定額モードの入力値をクリア
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

  // 逆算シミュレーションが表示されている場合、ラベルのみ更新
  updateReverseSimulationLabels();

  // UI状態を更新：計算方法を変更したので変更フラグを立てる
  appState.markAsChanged();
  updateSaveButtonsVisibility();
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

  // 計量モードの入力値をクリア
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

  // 逆算シミュレーションが表示されている場合、ラベルのみ更新
  updateReverseSimulationLabels();

  // UI状態を更新：計算方法を変更したので変更フラグを立てる
  appState.markAsChanged();
  updateSaveButtonsVisibility();
}

/**
 * ステップをリセット（UIの表示/非表示のみ、入力値はクリアしない）
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
 * 計量モードのステップをリセット（UIの表示/非表示のみ、入力値はクリアしない）
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
 * 歩留まり率統計モード: 表示をリセット（入力値はクリアしない）
 */
function resetYieldStatsEntries() {
  // 統計結果を非表示にする
  hide('yieldStatsResults');

  // 外れ値の除外状態をリセット
  manuallyExcludedOutlierIndices.clear();
  currentOutlierValues = [];
  currentStatsType = '';

  // テーブルが空の場合のみ初期行を追加
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (tbody && tbody.querySelectorAll('.yield-stats-row').length === 0) {
    yieldStatsEntryCounter = 0;
    addYieldStatsRow();
  }
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
    <td class="relative-deviation" id="relativeDeviation${rowId}">-</td>
    <td class="confidence-judgment" id="confidenceJudgment${rowId}">-</td>
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

  // テーブル行を追加したのでUI状態を更新
  // 注: 行追加だけでは保存すべきデータがないが、
  // テーブル構造が変更されたことを記録する
  appState.markAsChanged();
  updateSaveButtonsVisibility();
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
 * 歩留まり率統計モード: テーブルデータを復元
 * @param {Array} tableData - 保存されたテーブルデータ
 */
function restoreYieldStatsTable(tableData) {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // テーブルをリセット
  yieldStatsEntryCounter = 0;
  tbody.innerHTML = '';

  // データがない場合は1行だけ追加
  if (!tableData || tableData.length === 0) {
    addYieldStatsRow();
    return;
  }

  // 保存されたデータから行を再構築
  tableData.forEach(rowData => {
    addYieldStatsRow();
    const rowId = yieldStatsEntryCounter - 1;
    const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
    const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);

    if (beforeInput && rowData.beforeWeight !== undefined && rowData.beforeWeight !== null) {
      beforeInput.value = rowData.beforeWeight;
    }
    if (afterInput && rowData.afterWeight !== undefined && rowData.afterWeight !== null) {
      afterInput.value = rowData.afterWeight;
    }

    // 歩留まり率を計算して表示
    const beforeWeight = beforeInput ? beforeInput.value.trim() : '';
    const afterWeight = afterInput ? afterInput.value.trim() : '';
    const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}`);

    if (beforeWeight !== '' && afterWeight !== '') {
      const beforeVal = parseFloat(beforeWeight);
      const afterVal = parseFloat(afterWeight);
      if (beforeVal > 0 && afterVal > 0) {
        const yieldRate = calculateYieldRate(beforeVal, afterVal);
        if (yieldRate !== null) {
          yieldRateDisplay.textContent = pct(toFixed(yieldRate));
          yieldRateDisplay.classList.add('calculated');
          yieldRateDisplay.classList.remove('error');
        }
      }
    } else if (beforeWeight !== '' || afterWeight !== '') {
      // 片方だけ入力されている場合はエラー
      yieldRateDisplay.textContent = 'エラー';
      yieldRateDisplay.classList.add('error');
      yieldRateDisplay.classList.remove('calculated');
    }
  });

  // 最後の行に値がある場合、新しい空行を追加
  const lastData = tableData[tableData.length - 1];
  if (lastData && lastData.beforeWeight && lastData.afterWeight) {
    addYieldStatsRow();
  }

  // 状態を更新：履歴から読み込まれた
  window.yieldStatsState.isFromHistory = true;
  window.yieldStatsState.isCalculated = true;

  // 統計情報を更新（DOMの更新が完全に反映されるのを待つ）
  setTimeout(() => {
    updateYieldStatsStatistics();
  }, 50);
}

// window オブジェクトに関数を公開（history-ui.js から呼び出すため）
window.restoreYieldStatsTable = restoreYieldStatsTable;

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
  const yieldStatsData = {
    yieldRate: yieldRates,
    beforeWeight: beforeWeights,
    afterWeight: afterWeights
  };

  // 歩留まり率の統計値を計算して保存（履歴表示用）
  if (yieldRates.length >= 2) {
    const stats = calculateStatistics(yieldRates);
    yieldStatsData.avgYieldRate = stats.mean;
    yieldStatsData.medianYieldRate = stats.median;
    yieldStatsData.stdDevYieldRate = stats.stdDev;
    yieldStatsData.minYieldRate = stats.min;
    yieldStatsData.maxYieldRate = stats.max;

    // 許容誤差を取得
    const toleranceErrorInput = qs('#yieldStatsToleranceError');
    const toleranceError = toleranceErrorInput ? parseFloat(toleranceErrorInput.value) : 3.0;

    // 各行の相対偏差率を計算して表示
    const avgYield = stats.mean;
    allRows.forEach(row => {
      const rowId = row.dataset.rowId;
      const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}`);
      const relativeDeviationDisplay = qs(`#relativeDeviation${rowId}`);
      const confidenceJudgmentDisplay = qs(`#confidenceJudgment${rowId}`);

      if (yieldRateDisplay && yieldRateDisplay.classList.contains('calculated') && relativeDeviationDisplay) {
        const rateText = yieldRateDisplay.textContent.replace('%', '');
        const rate = parseFloat(rateText);

        if (!isNaN(rate) && avgYield > 0) {
          // 相対偏差率 = (平均 - 個別値) / 平均 × 100
          const relativeDeviation = ((avgYield - rate) / avgYield) * 100;
          const absDeviation = Math.abs(relativeDeviation);

          // 表示用のテキストを生成
          let displayText = `${toFixed(relativeDeviation, 1)}%`;

          // 説明テキストを追加
          if (relativeDeviation > 0) {
            displayText += ` (平均より${toFixed(relativeDeviation, 1)}%低い)`;
            relativeDeviationDisplay.style.color = '#d32f2f'; // 赤色
          } else if (relativeDeviation < 0) {
            displayText += ` (平均より${toFixed(Math.abs(relativeDeviation), 1)}%高い)`;
            relativeDeviationDisplay.style.color = '#388e3c'; // 緑色
          } else {
            displayText = '0.0% (平均と同じ)';
            relativeDeviationDisplay.style.color = '#666';
          }

          relativeDeviationDisplay.textContent = displayText;

          // 判定を計算（許容誤差との比較）
          if (confidenceJudgmentDisplay) {
            let judgment = '';
            let judgmentColor = '';

            if (absDeviation <= toleranceError * 2 / 3) {
              // 許容誤差の66%以内: 非常に良好 (1～2%の場合、許容誤差3.0なら2.0以内)
              judgment = '✓ 非常に良好';
              judgmentColor = '#1b5e20'; // 濃い緑
            } else if (absDeviation <= toleranceError) {
              // 許容誤差以内: 良好 (3～4%相当)
              judgment = '○ 良好';
              judgmentColor = '#388e3c'; // 緑
            } else if (absDeviation <= toleranceError * 2) {
              // 許容誤差の2倍以内: 許容範囲 (5～6%相当)
              judgment = '△ 許容範囲';
              judgmentColor = '#f57c00'; // オレンジ
            } else if (absDeviation <= toleranceError * 2.67) {
              // 許容誤差の2.67倍以内: 要注意 (7～8%相当)
              judgment = '! 要注意';
              judgmentColor = '#e64a19'; // 赤オレンジ
            } else {
              // それ以上: 要改善
              judgment = '× 要改善';
              judgmentColor = '#c62828'; // 赤
            }

            confidenceJudgmentDisplay.textContent = judgment;
            confidenceJudgmentDisplay.style.color = judgmentColor;
            confidenceJudgmentDisplay.style.fontWeight = 'bold';
          }
        } else {
          relativeDeviationDisplay.textContent = '-';
          relativeDeviationDisplay.style.color = '';
          if (confidenceJudgmentDisplay) {
            confidenceJudgmentDisplay.textContent = '-';
            confidenceJudgmentDisplay.style.color = '';
            confidenceJudgmentDisplay.style.fontWeight = '';
          }
        }
      } else if (relativeDeviationDisplay) {
        relativeDeviationDisplay.textContent = '-';
        relativeDeviationDisplay.style.color = '';
        if (confidenceJudgmentDisplay) {
          confidenceJudgmentDisplay.textContent = '-';
          confidenceJudgmentDisplay.style.color = '';
          confidenceJudgmentDisplay.style.fontWeight = '';
        }
      }
    });
  } else {
    // データが不足している場合は相対偏差率と判定をクリア
    allRows.forEach(row => {
      const rowId = row.dataset.rowId;
      const relativeDeviationDisplay = qs(`#relativeDeviation${rowId}`);
      const confidenceJudgmentDisplay = qs(`#confidenceJudgment${rowId}`);

      if (relativeDeviationDisplay) {
        relativeDeviationDisplay.textContent = '-';
        relativeDeviationDisplay.style.color = '';
      }
      if (confidenceJudgmentDisplay) {
        confidenceJudgmentDisplay.textContent = '-';
        confidenceJudgmentDisplay.style.color = '';
        confidenceJudgmentDisplay.style.fontWeight = '';
      }
    });
  }

  // AppStateに保存
  appState.setYieldStatsData(yieldStatsData);

  // データが2つ以上ある場合のみ統計を表示
  const hasEnoughData = yieldRates.length >= 2 || beforeWeights.length >= 2 || afterWeights.length >= 2;

  if (hasEnoughData) {
    displayCurrentStatistics();
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

  // 標準偏差（不偏標準偏差を使用）
  // n=1の場合は標準偏差を0とする
  const variance = n > 1
    ? values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1)
    : 0;
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
  // 歪度の計算にはn >= 3が必要
  const skewness = (n >= 3 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / n
    : 0;

  // 尖度（Kurtosis）- 超過尖度
  // 尖度の計算にはn >= 4が必要
  const kurtosis = (n >= 4 && stdDev > 0)
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
  const data = appState.getYieldStatsData();

  // 状態を更新：現在の表示タイプ
  window.yieldStatsState.currentDisplayType = selectedType;

  // 統計タイプが変更されたら外れ値の除外状態をリセット
  // 注：この時点ではまだ自動切り替え前なので selectedType を使用
  if (currentStatsType !== selectedType) {
    window.yieldStatsState.manuallyExcludedOutlierIndices.clear();
    window.yieldStatsState.currentOutlierValues = [];
    window.yieldStatsState.isOutlierExcluded = false;

    // 後方互換性のため既存変数も更新
    manuallyExcludedOutlierIndices = window.yieldStatsState.manuallyExcludedOutlierIndices;
    currentOutlierValues = window.yieldStatsState.currentOutlierValues;
  }

  if (!data) {
    hide('yieldStatsResults');
    return;
  }

  // 統計タイプごとの統計データをオブジェクトで管理（表示処理の前に実行）
  if (!window.statsDataByType) {
    window.statsDataByType = {};
  }

  // 各統計タイプの統計を計算して保存
  ['yieldRate', 'beforeWeight', 'afterWeight'].forEach(type => {
    if (data[type] && Array.isArray(data[type]) && data[type].length >= 2) {
      window.statsDataByType[type] = calculateStatistics(data[type]);
    } else {
      window.statsDataByType[type] = null;
    }
  });

  // 状態を更新：データ存在フラグ
  window.yieldStatsState.hasYieldRateData = !!(data.yieldRate && Array.isArray(data.yieldRate) && data.yieldRate.length >= 2);
  window.yieldStatsState.hasBeforeWeightData = !!(data.beforeWeight && Array.isArray(data.beforeWeight) && data.beforeWeight.length >= 2);
  window.yieldStatsState.hasAfterWeightData = !!(data.afterWeight && Array.isArray(data.afterWeight) && data.afterWeight.length >= 2);

  // 状態を更新：計算済みフラグ
  // 注：isFromHistoryは履歴復元時に既にtrueが設定されている場合があるので、
  // 既にtrueの場合は保持し、falseの場合のみ明示的にfalseを設定する
  window.yieldStatsState.isCalculated = true;
  if (!window.yieldStatsState.isFromHistory) {
    window.yieldStatsState.isFromHistory = false;
  }

  // 複数パターン分析の読み込みボタンの状態を更新
  updateLoadStatsButtons();

  // 選択されたタイプにデータがない場合、データのあるタイプに自動切り替え
  let values = data[selectedType];
  let actualSelectedType = selectedType;

  if (!values || !Array.isArray(values) || values.length < 2) {
    // データのあるタイプを探す（優先順: yieldRate > beforeWeight > afterWeight）
    const typePriority = ['yieldRate', 'beforeWeight', 'afterWeight'];
    let foundType = null;

    for (const type of typePriority) {
      if (data[type] && Array.isArray(data[type]) && data[type].length >= 2) {
        foundType = type;
        break;
      }
    }

    if (foundType) {
      // データのあるタイプに切り替え
      actualSelectedType = foundType;
      values = data[foundType];

      // セレクトボックスも更新
      if (selectElement) {
        selectElement.value = foundType;
        window.yieldStatsState.currentDisplayType = foundType;
      }

      // currentStatsTypeも更新
      currentStatsType = foundType;
    } else {
      // 全てのタイプでデータが不足している場合は非表示
      hide('yieldStatsResults');
      return;
    }
  } else {
    // データがある場合、currentStatsTypeを更新
    currentStatsType = actualSelectedType;
  }

  // 手動除外が設定されている場合、データをフィルタリング
  let finalValues = values;
  let finalStats = null;

  if (manuallyExcludedOutlierIndices.size > 0 && currentOutlierValues.length > 0) {
    const excludedValues = new Set();
    manuallyExcludedOutlierIndices.forEach(index => {
      if (index < currentOutlierValues.length) {
        excludedValues.add(currentOutlierValues[index]);
      }
    });

    finalValues = values.filter(v => {
      for (const excludedValue of excludedValues) {
        if (Math.abs(v - excludedValue) < 0.0001) {
          return false;
        }
      }
      return true;
    });
  }

  // 最終的なデータで統計を計算
  if (finalValues.length >= 2) {
    finalStats = calculateStatistics(finalValues);
  } else {
    // データが不足している場合は非表示
    hide('yieldStatsResults');
    return;
  }

  // 統計タイプに応じた単位を設定
  let unit = '';
  let typeName = '';
  if (actualSelectedType === 'yieldRate') {
    unit = '%';
    typeName = '歩留まり率';
  } else if (actualSelectedType === 'beforeWeight') {
    unit = 'g';
    typeName = '加工前重量';
  } else if (actualSelectedType === 'afterWeight') {
    unit = 'g';
    typeName = '加工後重量';
  }

  // 除外後のデータで統計を表示
  displayStatistics(finalStats, unit);
  displayMatrixEvaluation(finalStats);
  renderStatsChart(finalValues, finalStats, typeName, unit);

  // 統計結果を表示
  show('yieldStatsResults');

  // サンプルサイズ妥当性判断の単位と表示を更新
  updateToleranceUnit();

  // 後方互換性のため、従来の変数も維持
  window.lastCalculatedStats = finalStats; // 表示用（選択された統計タイプ）

  // サンプルサイズ検証を実行（許容誤差が入力されている場合は推奨代表値も表示）
  const toleranceErrorInput = qs('#toleranceError');
  const hasTolerance = toleranceErrorInput && parseFloat(toleranceErrorInput.value) > 0;

  displaySampleSizeValidation();

  // 許容誤差が未入力の場合も推奨代表値と複数パターン分析ボタンを表示
  if (!hasTolerance) {
    displayRecommendedValue(finalStats, true, actualSelectedType);
  }
}

/**
 * マトリックス評価を表示
 * @param {Object} stats - 統計情報
 */
function displayMatrixEvaluation(stats) {
  const sampleSizeSpan = qs('#matrixEvalSampleSize');
  const cvSpan = qs('#matrixEvalCV');
  const messageDiv = qs('#matrixEvalMessage');

  if (!sampleSizeSpan || !cvSpan || !messageDiv) {
    return;
  }

  const n = stats.count;
  const cv = stats.cv;

  // サンプル数とCVを表示
  sampleSizeSpan.textContent = `${n}個`;
  cvSpan.textContent = `${toFixed(cv)}%`;

  // マトリックス評価を取得
  const evaluation = getMatrixEvaluation(n, cv);

  // メッセージを表示
  messageDiv.textContent = evaluation.message;
  messageDiv.className = `matrix-eval-message ${evaluation.className}`;
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
 * 許容誤差に基づいて信頼度メッセージを判定
 * @param {number} toleranceError - 許容誤差（E）
 * @returns {Object} メッセージと色の情報
 */
function getConfidenceMessage(toleranceError) {
  if (toleranceError >= 1 && toleranceError <= 2) {
    return {
      message: '高精度：誤差範囲が狭く、非常に信頼性の高い推定が可能です',
      className: 'confidence-high'
    };
  } else if (toleranceError >= 3 && toleranceError <= 4) {
    return {
      message: '標準精度：一般的な分析に適した精度です',
      className: 'confidence-standard'
    };
  } else if (toleranceError >= 5 && toleranceError <= 6) {
    return {
      message: '低精度：誤差範囲が広く、精度が低くなります',
      className: 'confidence-low'
    };
  } else if (toleranceError >= 7 && toleranceError <= 8) {
    return {
      message: '非常に低い精度：誤差範囲が非常に広く、推定の信頼性が限定的です',
      className: 'confidence-very-low'
    };
  } else if (toleranceError > 8) {
    return {
      message: '精度不足：誤差範囲が大きすぎるため、推定の信頼性が著しく低下します',
      className: 'confidence-insufficient'
    };
  } else {
    return {
      message: '高精度：誤差範囲が狭く、非常に信頼性の高い推定が可能です',
      className: 'confidence-high'
    };
  }
}

/**
 * サンプル数とCVのマトリックスから評価メッセージを判定
 * @param {number} n - サンプル数
 * @param {number} cv - 変動係数（%）
 * @returns {Object} 評価メッセージとクラス名
 */
function getMatrixEvaluation(n, cv) {
  // サンプル数の範囲を判定
  let sampleRange;
  if (n <= 5) {
    sampleRange = 'n5';
  } else if (n >= 10 && n <= 20) {
    sampleRange = 'n10-20';
  } else if (n >= 30 && n <= 50) {
    sampleRange = 'n30-50';
  } else if (n >= 100) {
    sampleRange = 'n100+';
  } else {
    // 6-9, 21-29, 51-99の場合は近い範囲にマッピング
    if (n < 10) {
      sampleRange = 'n5';
    } else if (n < 30) {
      sampleRange = 'n10-20';
    } else if (n < 100) {
      sampleRange = 'n30-50';
    }
  }

  // CVの範囲を判定
  let cvRange;
  if (cv < 10) {
    cvRange = 'cv0-10';
  } else if (cv >= 10 && cv < 20) {
    cvRange = 'cv10-20';
  } else if (cv >= 20 && cv < 30) {
    cvRange = 'cv20-30';
  } else {
    cvRange = 'cv30+';
  }

  // マトリックスに基づく評価
  const evaluations = {
    'n5': {
      'cv0-10': {
        message: '目安レベル。参考値のみ（データ不足）',
        className: 'matrix-eval-caution',
        level: 'caution'
      },
      'cv10-20': {
        message: '目安レベル。参考値のみ',
        className: 'matrix-eval-caution',
        level: 'caution'
      },
      'cv20-30': {
        message: '不安定。外れ値の影響大',
        className: 'matrix-eval-warning',
        level: 'warning'
      },
      'cv30+': {
        message: '信頼性極めて低い。再測定推奨',
        className: 'matrix-eval-danger',
        level: 'danger'
      }
    },
    'n10-20': {
      'cv0-10': {
        message: 'やや安定。概ね良好',
        className: 'matrix-eval-good',
        level: 'good'
      },
      'cv10-20': {
        message: '概ね安定。傾向把握可',
        className: 'matrix-eval-good',
        level: 'good'
      },
      'cv20-30': {
        message: 'ばらつきあり。原因分析要',
        className: 'matrix-eval-warning',
        level: 'warning'
      },
      'cv30+': {
        message: 'データ再収集を推奨',
        className: 'matrix-eval-danger',
        level: 'danger'
      }
    },
    'n30-50': {
      'cv0-10': {
        message: '安定。統計的に信頼できる',
        className: 'matrix-eval-excellent',
        level: 'excellent'
      },
      'cv10-20': {
        message: '安定。品質問題は小',
        className: 'matrix-eval-excellent',
        level: 'excellent'
      },
      'cv20-30': {
        message: 'ややばらつきあり。改善検討',
        className: 'matrix-eval-good',
        level: 'good'
      },
      'cv30+': {
        message: '不安定。工程見直し必要',
        className: 'matrix-eval-warning',
        level: 'warning'
      }
    },
    'n100+': {
      'cv0-10': {
        message: '非常に安定。精度高い推定可能',
        className: 'matrix-eval-excellent',
        level: 'excellent'
      },
      'cv10-20': {
        message: '高信頼性。管理値設定可',
        className: 'matrix-eval-excellent',
        level: 'excellent'
      },
      'cv20-30': {
        message: '安定。制御強化で改善可',
        className: 'matrix-eval-good',
        level: 'good'
      },
      'cv30+': {
        message: '要改善。重大なばらつきの可能性',
        className: 'matrix-eval-warning',
        level: 'warning'
      }
    }
  };

  return evaluations[sampleRange][cvRange];
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

  const data = appState.getYieldStatsData();
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

  // 信頼度メッセージを表示
  const confidenceMessageDiv = qs('#confidenceMessage');
  if (confidenceMessageDiv) {
    const confidenceInfo = getConfidenceMessage(toleranceError);
    confidenceMessageDiv.textContent = confidenceInfo.message;
    confidenceMessageDiv.className = `confidence-message ${confidenceInfo.className}`;
  }

  // 外れ値を検出して表示
  displayOutlierInfo(outlierResult, statsType, isValid);

  // 推奨代表値を表示（サンプルサイズが妥当な場合のみ）
  // 手動除外後のデータで計算
  if (finalValues.length >= 2) {
    // グローバルに保存（複数パターン分析への遷移用）
    window.lastCalculatedStats = finalStats;
    displayRecommendedValue(finalStats, isValid, statsType);
  } else {
    // グローバルに保存（複数パターン分析への遷移用）
    window.lastCalculatedStats = stats;
    displayRecommendedValue(stats, isValid, statsType);
  }

  // 結果を表示
  resultDiv.classList.remove('is-hidden');
}

/**
 * 歩留まり統計の状態管理
 * データと状態を明確に分離して管理
 */
window.yieldStatsState = {
  // 表示関連の状態
  currentDisplayType: 'yieldRate',        // 現在表示中の統計タイプ

  // データソース関連の状態
  isFromHistory: false,                   // 履歴から読み込まれたか
  isCalculated: false,                    // 計算済みか（新規計算されたか）

  // データ存在フラグ
  hasYieldRateData: false,                // 歩留まり率データが存在するか
  hasBeforeWeightData: false,             // 加工前重量データが存在するか
  hasAfterWeightData: false,              // 加工後重量データが存在するか

  // UI状態
  isOutlierExcluded: false,               // 外れ値除外が適用されているか
  manuallyExcludedOutlierIndices: new Set(), // 手動除外された外れ値のインデックス
  currentOutlierValues: [],               // 現在の外れ値リスト

  // 次のアクション指示
  shouldShowMultiPatternLink: false       // 複数パターン分析リンクを表示すべきか
};

// 後方互換性のため、グローバル変数も残す（徐々に置き換え）
let manuallyExcludedOutlierIndices = window.yieldStatsState.manuallyExcludedOutlierIndices;
let currentOutlierValues = window.yieldStatsState.currentOutlierValues;
let currentStatsType = window.yieldStatsState.currentDisplayType;

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

  // 統計を再計算・再表示（除外後のデータで）
  displayCurrentStatistics();
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
 * 計算式詳細モーダルのセットアップ
 */
function setupFormulaModal() {
  const modal = qs('#formulaModal');
  const modalClose = qs('#formulaModalClose');
  const modalOverlay = modal?.querySelector('.modal-overlay');
  const modalTitle = qs('#formulaModalTitle');
  const modalBody = qs('#formulaModalBody');

  if (!modal || !modalClose || !modalOverlay || !modalTitle || !modalBody) {
    return;
  }

  // モーダルを開く関数
  const openModal = (formulaName, formula, description, example) => {
    modalTitle.textContent = formulaName;

    let html = '<div class="formula-section">';

    if (formula) {
      html += '<div class="formula-label">計算式</div>';
      html += `<div class="formula-expression">${formula}</div>`;
    }

    if (description) {
      html += `<div class="formula-description">${description}</div>`;
    }

    if (example) {
      html += `<div class="formula-example"><strong>例：</strong> ${example}</div>`;
    }

    html += '</div>';

    modalBody.innerHTML = html;
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden'; // スクロール防止
  };

  // モーダルを閉じる関数
  const closeModal = () => {
    modal.classList.remove('is-open');
    document.body.style.overflow = ''; // スクロール復元
  };

  // 閉じるボタンのクリック
  modalClose.addEventListener('click', closeModal);

  // オーバーレイのクリック
  modalOverlay.addEventListener('click', closeModal);

  // Escキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) {
      closeModal();
    }
  });

  // 全ての?マークにイベントリスナーを追加
  const helpIcons = qsa('.help-icon');
  helpIcons.forEach(icon => {
    const formulaName = icon.dataset.formulaName;
    const formula = icon.dataset.formula;
    const description = icon.dataset.formulaDesc;
    const example = icon.dataset.formulaExample;

    // data属性がある場合のみクリック/タップイベントを追加
    if (formulaName && formula) {
      // PCでのクリックとスマホでのタップ両方に対応
      const handleInteraction = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal(formulaName, formula, description, example);
      };

      icon.addEventListener('click', handleInteraction);

      // タッチデバイス用：clickイベントが発火しない場合に備えて
      icon.addEventListener('touchend', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal(formulaName, formula, description, example);
      });
    }
  });
}

/**
 * 推奨代表値を取得
 * @param {Object} stats - 統計データ
 * @returns {Object} {type: 'mean'|'median', value: number, label: string}
 */
function getRecommendedValue(stats) {
  if (!stats) return null;

  const skewness = stats.skewness;
  const absSkewness = Math.abs(skewness);

  if (absSkewness <= 0.5) {
    return { type: 'mean', value: stats.mean, label: '平均値' };
  } else {
    return { type: 'median', value: stats.median, label: '中央値' };
  }
}

/**
 * 標準偏差を使った範囲パターンを生成
 * @param {Object} stats - 統計データ
 * @param {number} sigmaRange - 標準偏差の範囲（デフォルト: 2）
 * @returns {Array<Object>} {label: string, value: number}[]
 */
function generateSigmaPatterns(stats, sigmaRange = 2) {
  if (!stats || !Number.isFinite(stats.mean) || !Number.isFinite(stats.stdDev)) {
    return [];
  }

  const patterns = [];
  const mean = stats.mean;
  const stdDev = stats.stdDev;

  // 範囲内のσパターンを生成（-2σ, -1σ, 平均, +1σ, +2σ）
  for (let i = -sigmaRange; i <= sigmaRange; i++) {
    const value = mean + (i * stdDev);

    // 負の値は除外（歩留まり率や重量は負にならない）
    if (value < 0) continue;

    let label;
    if (i === 0) {
      label = '平均値';
    } else if (i > 0) {
      label = `平均+${i}σ`;
    } else {
      label = `平均${i}σ`;
    }

    patterns.push({
      label,
      value,
      sigma: i
    });
  }

  return patterns;
}

/**
 * 推奨代表値を表示
 * @param {Object} stats - 統計データ
 * @param {boolean} isSampleSizeValid - サンプルサイズが妥当かどうか
 * @param {string} statsType - 統計タイプ（'yieldRate', 'beforeWeight', 'afterWeight'）
 */
function displayRecommendedValue(stats, isSampleSizeValid, statsType = 'yieldRate') {
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

  // 複数パターン分析へのリンクを表示（歩留まり率の統計を表示している場合のみ）
  const multiPatternLink = qs('#multiPatternLink');
  if (multiPatternLink && statsType === 'yieldRate') {
    const hasYieldRateData = window.yieldStatsState.hasYieldRateData;
    const yieldRateStats = window.statsDataByType?.yieldRate;

    // データが十分にあるかチェック
    if (isSampleSizeValid && hasYieldRateData && yieldRateStats && yieldRateStats.count >= 2) {
      multiPatternLink.classList.remove('is-hidden');
    } else {
      multiPatternLink.classList.add('is-hidden');
    }
  } else {
    if (multiPatternLink) {
      multiPatternLink.classList.add('is-hidden');
    }
  }
}

/**
 * ボタンにタッチとクリックのイベントハンドラーを設定
 * タッチデバイスとマウスデバイスの両方に対応
 */
function attachButtonHandler(button, handler) {
  let touchStarted = false;

  button.addEventListener('touchstart', () => {
    touchStarted = true;
  }, { passive: true });

  button.addEventListener('touchend', (e) => {
    if (touchStarted) {
      e.preventDefault();
      touchStarted = false;
      handler();
    }
  }, { passive: false });

  button.addEventListener('click', () => {
    if (!touchStarted) {
      handler();
    }
  });
}

/**
 * 歩留まり統計から読み込むボタンの状態を更新
 * ボタンのイベントハンドラーは動的に生成時に直接設定されます。
 */
function updateLoadStatsButtons() {
  const loadStatsButtons = qs('#loadStatsButtons');
  const loadStatsNoData = qs('#loadStatsNoData');
  const loadMeanValueDisplay = qs('#loadMeanValueDisplay');
  const loadMedianValueDisplay = qs('#loadMedianValueDisplay');
  const loadRecommendedValueDisplay = qs('#loadRecommendedValueDisplay');
  const generateSigmaPatternsSection = qs('#generateSigmaPatternsSection');
  const loadStatsTypeSelect = qs('#loadStatsTypeSelect');

  if (!loadStatsButtons || !loadStatsNoData || !loadStatsTypeSelect) {
    return;
  }

  // 現在の複数パターン分析のモードを取得
  const currentMode = document.querySelector('input[name="yieldMethodMultiPattern"]:checked')?.value || 'calculate';

  // 現在選択されている値を保存
  const previousValue = loadStatsTypeSelect.value;

  // モードに応じてプルダウンの選択肢を更新
  loadStatsTypeSelect.innerHTML = '';
  if (currentMode === 'direct') {
    // 歩留まり率直接入力モード：歩留まり率と加工前重量のみ
    loadStatsTypeSelect.innerHTML = `
      <option value="bulk">一括取り込み（推奨値をステップ1に転記）</option>
      <option value="yieldRate">歩留まり率（%）</option>
      <option value="beforeWeight">加工前重量（g）</option>
    `;
  } else {
    // 重量から計算モード：加工前重量と加工後重量のみ
    loadStatsTypeSelect.innerHTML = `
      <option value="bulk">一括取り込み（推奨値をステップ1に転記）</option>
      <option value="beforeWeight">加工前重量（g）</option>
      <option value="afterWeight">加工後重量（g）</option>
    `;
  }

  // 以前の選択値が新しいオプションに存在すれば復元
  if (previousValue && Array.from(loadStatsTypeSelect.options).some(opt => opt.value === previousValue)) {
    loadStatsTypeSelect.value = previousValue;
  }

  // 複数パターン分析画面のプルダウンで選択された統計タイプを取得
  const selectedStatsType = loadStatsTypeSelect.value;

  // 一括取り込みモードの場合
  if (selectedStatsType === 'bulk') {
    const yieldRateStats = window.statsDataByType?.yieldRate;
    const beforeWeightStats = window.statsDataByType?.beforeWeight;
    const afterWeightStats = window.statsDataByType?.afterWeight;

    // 歩留まり率の統計データが必須
    if (!yieldRateStats || yieldRateStats.count < 2) {
      loadStatsButtons.classList.add('is-hidden');
      loadStatsNoData.classList.remove('is-hidden');
      if (generateSigmaPatternsSection) {
        generateSigmaPatternsSection.classList.add('is-hidden');
      }
      return;
    }

    // 推奨値を取得
    const yieldRateRecommended = getRecommendedValue(yieldRateStats);
    const beforeWeightRecommended = beforeWeightStats && beforeWeightStats.count >= 2
      ? getRecommendedValue(beforeWeightStats)
      : null;
    const afterWeightRecommended = afterWeightStats && afterWeightStats.count >= 2
      ? getRecommendedValue(afterWeightStats)
      : null;

    // テーブル全体を書き換え（2列レイアウト）
    const table = loadStatsButtons.querySelector('table');
    if (table) {
      let rows = '';

      // モードに応じて表示する項目を変更
      if (currentMode === 'direct') {
        // 歩留まり率直接入力モード
        rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">歩留まり率</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${yieldRateRecommended ? toFixed(yieldRateRecommended.value, 2) + '%' : '-'}</td>
          </tr>`;
        if (beforeWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工前重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(beforeWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
      } else {
        // 重量から計算モード
        if (beforeWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工前重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(beforeWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
        if (afterWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工後重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(afterWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
      }

      table.innerHTML = `
        <thead>
          <tr>
            <th style="text-align: left; padding: 0.6em;">項目</th>
            <th style="text-align: right; padding: 0.6em;">推奨値</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>`;
    }

    // ボタンを表示、メッセージを非表示
    loadStatsButtons.classList.remove('is-hidden');
    loadStatsNoData.classList.add('is-hidden');

    // σパターン生成セクションを非表示（一括取り込みモードでは不要）
    if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }

    // 一括取り込みボタンをテーブルの外に配置
    // 既存のボタンコンテナを探すか、新規作成
    let bulkImportBtnContainer = qs('#bulkImportBtnContainer');
    if (!bulkImportBtnContainer) {
      bulkImportBtnContainer = document.createElement('div');
      bulkImportBtnContainer.id = 'bulkImportBtnContainer';
      bulkImportBtnContainer.style.cssText = 'text-align: center; margin-top: 0.8em;';
      loadStatsButtons.appendChild(bulkImportBtnContainer);
    }

    // ボタンを直接イベントハンドラーと共に作成
    bulkImportBtnContainer.innerHTML = '';
    const bulkImportBtn = document.createElement('button');
    bulkImportBtn.type = 'button';
    bulkImportBtn.id = 'bulkImportBtn';
    bulkImportBtn.className = 'btn btn-recommended btn-sm';
    bulkImportBtn.style.cssText = 'font-size: 0.9em; padding: 0.5em 1.2em;';
    bulkImportBtn.textContent = '📥 推奨値を一括転記';

    // イベントハンドラを設定
    attachButtonHandler(bulkImportBtn, () => {
      if (window.loadAllStatsToMultiPattern) {
        window.loadAllStatsToMultiPattern();
      } else {
        console.error('[ERROR] loadAllStatsToMultiPattern関数が見つかりません');
      }
    });

    bulkImportBtnContainer.appendChild(bulkImportBtn);

    return;
  }

  // 通常モード（個別の統計タイプ）
  const stats = window.statsDataByType?.[selectedStatsType];

  // 一括取り込みボタンコンテナを削除（通常モードでは不要）
  const bulkImportBtnContainer = qs('#bulkImportBtnContainer');
  if (bulkImportBtnContainer) {
    bulkImportBtnContainer.remove();
  }

  if (stats && stats.count >= 2) {
    // 推奨値を取得
    const recommended = getRecommendedValue(stats);

    // 単位を取得
    const unit = selectedStatsType === 'yieldRate' ? '%' : 'g';

    // テーブル全体を通常表示（3列）に戻す
    const table = loadStatsButtons.querySelector('table');
    if (table) {
      // テーブルのthead/tbodyを作成
      table.innerHTML = `
        <thead>
          <tr>
            <th>統計種別</th>
            <th>値</th>
            <th>読み込み</th>
          </tr>
        </thead>
        <tbody></tbody>`;

      const tbody = table.querySelector('tbody');

      // 平均値の行を作成
      const meanRow = tbody.insertRow();
      meanRow.innerHTML = `
        <td class="stats-label">平均値</td>
        <td class="stats-value">${toFixed(stats.mean, 2)}${unit}</td>
        <td class="stats-action"></td>`;
      const meanBtn = document.createElement('button');
      meanBtn.type = 'button';
      meanBtn.className = 'btn btn-primary btn-sm';
      meanBtn.textContent = '読み込む';
      attachButtonHandler(meanBtn, () => {
        if (window.loadStatsValueToMultiPattern) {
          window.loadStatsValueToMultiPattern(stats.mean, selectedStatsType, false);
          window.showTransferNotification('平均値を転記しました');
          window.focusFirstPatternInput();
        }
      });
      meanRow.cells[2].appendChild(meanBtn);

      // 中央値の行を作成
      const medianRow = tbody.insertRow();
      medianRow.innerHTML = `
        <td class="stats-label">中央値</td>
        <td class="stats-value">${toFixed(stats.median, 2)}${unit}</td>
        <td class="stats-action"></td>`;
      const medianBtn = document.createElement('button');
      medianBtn.type = 'button';
      medianBtn.className = 'btn btn-secondary btn-sm';
      medianBtn.textContent = '読み込む';
      attachButtonHandler(medianBtn, () => {
        if (window.loadStatsValueToMultiPattern) {
          window.loadStatsValueToMultiPattern(stats.median, selectedStatsType, false);
          window.showTransferNotification('中央値を転記しました');
          window.focusFirstPatternInput();
        }
      });
      medianRow.cells[2].appendChild(medianBtn);

      // 推奨値の行を作成
      if (recommended) {
        const recommendedRow = tbody.insertRow();
        recommendedRow.className = 'recommended-row';
        recommendedRow.innerHTML = `
          <td class="stats-label">📌 推奨値</td>
          <td class="stats-value">${toFixed(recommended.value, 2)}${unit}</td>
          <td class="stats-action"></td>`;
        const recommendedBtn = document.createElement('button');
        recommendedBtn.type = 'button';
        recommendedBtn.className = 'btn btn-recommended btn-sm';
        recommendedBtn.textContent = '読み込む';
        attachButtonHandler(recommendedBtn, () => {
          if (window.loadStatsValueToMultiPattern) {
            window.loadStatsValueToMultiPattern(recommended.value, selectedStatsType, false);
            window.showTransferNotification('推奨値を転記しました');
            window.focusFirstPatternInput();
          }
        });
        recommendedRow.cells[2].appendChild(recommendedBtn);
      }
    }

    // ボタンを表示、メッセージを非表示
    loadStatsButtons.classList.remove('is-hidden');
    loadStatsNoData.classList.add('is-hidden');

    // σパターン生成セクションを表示（歩留まり率の場合のみ）
    if (generateSigmaPatternsSection && selectedStatsType === 'yieldRate') {
      generateSigmaPatternsSection.classList.remove('is-hidden');
    } else if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }
  } else {
    // データがない場合、メッセージを表示
    loadStatsButtons.classList.add('is-hidden');
    loadStatsNoData.classList.remove('is-hidden');

    // σパターン生成セクションを非表示
    if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }
  }
}

/**
 * プリセット管理機能（モーダル版）
 */
const PRESET_STORAGE_KEY = 'multiPatternPresets';
let currentEditingPreset = null; // 編集中のプリセット
let tempPairs = []; // 一時的な原価・売価ペア配列

// プリセットをlocalStorageから読み込む
function loadPresets() {
  const presets = localStorage.getItem(PRESET_STORAGE_KEY);
  if (!presets) return [];

  const parsedPresets = JSON.parse(presets);

  // 古いデータとの互換性のため、patternsプロパティがない場合は空配列を設定
  return parsedPresets.map(preset => ({
    ...preset,
    patterns: Array.isArray(preset.patterns) ? preset.patterns : []
  }));
}

// プリセットをlocalStorageに保存
function savePresetsData(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

// モーダルを開く（一覧表示）
function openPresetModal() {
  renderPresetList();
  showPresetList();

  const modal = qs('#presetModal');
  if (modal) {
    modal.classList.add('is-open');
  }
}

// モーダルを閉じる
function closePresetModal() {
  qs('#presetModal').classList.remove('is-open');
  currentEditingPreset = null;
  tempPairs = [];
}

// プリセット一覧を表示
function showPresetList() {
  const editor = qs('.preset-editor');
  const listSection = qs('.preset-list-section');

  if (editor) editor.style.display = 'none';
  if (listSection) listSection.style.display = 'block';
}

// プリセット編集画面を表示
function showPresetEditor() {
  const editor = qs('.preset-editor');
  const listSection = qs('.preset-list-section');

  if (editor) editor.style.display = 'block';
  if (listSection) listSection.style.display = 'none';
}

// 新規プリセット作成画面を開く
function openNewPresetEditor() {
  currentEditingPreset = null;
  tempPairs = [];

  const editorTitle = qs('#presetEditorTitle');
  if (editorTitle) {
    editorTitle.textContent = '新規プリセット作成';
  }

  const presetName = qs('#presetName');
  if (presetName) {
    presetName.value = '';
  }

  const tempUnitCost = qs('#tempUnitCost');
  if (tempUnitCost) {
    tempUnitCost.value = '';
  }

  const tempUnitPrice = qs('#tempUnitPrice');
  if (tempUnitPrice) {
    tempUnitPrice.value = '';
  }

  renderTempPairs();
  showPresetEditor();
}

// 一時ペアをテーブルに表示
function renderTempPairs() {
  const tbody = qs('#presetPairsTableBody');
  if (!tbody) return;

  if (tempPairs.length === 0) {
    tbody.innerHTML = '<tr class="empty-message"><td colspan="3" style="text-align: center; color: #999; padding: 2em;">原価・売価を追加してください</td></tr>';
    return;
  }

  // 売価基準で降順ソート
  const sorted = [...tempPairs].sort((a, b) => b.unitPrice - a.unitPrice);

  tbody.innerHTML = sorted.map((pair, index) => `
    <tr>
      <td>${pair.unitCost}</td>
      <td>${pair.unitPrice}</td>
      <td><button type="button" class="btn-remove-pair" data-pair-index="${index}">削除</button></td>
    </tr>
  `).join('');
}

// 原価・売価ペアを追加
function addPairToTemp() {
  const unitCost = parseFloat(qs('#tempUnitCost')?.value);
  const unitPrice = parseFloat(qs('#tempUnitPrice')?.value);

  if (!Number.isFinite(unitCost) || !Number.isFinite(unitPrice) || unitCost <= 0 || unitPrice <= 0) {
    alert('原価と売価を正しく入力してください。');
    return;
  }

  // 原価が売価を上回っている場合のチェック
  if (unitCost > unitPrice) {
    alert('原価が売価を上回っています。\n通常、売価は原価よりも高く設定されます。\n入力内容を確認してください。');
    return;
  }

  tempPairs.push({ unitCost, unitPrice });
  qs('#tempUnitCost').value = '';
  qs('#tempUnitPrice').value = '';
  renderTempPairs();
}

// 一時ペアを削除
function removeTempPair(index) {
  // ソート済みの配列から実際のインデックスを見つける
  const sorted = [...tempPairs].sort((a, b) => b.unitPrice - a.unitPrice);
  const pairToRemove = sorted[index];
  const realIndex = tempPairs.findIndex(p => p.unitCost === pairToRemove.unitCost && p.unitPrice === pairToRemove.unitPrice);

  if (realIndex !== -1) {
    tempPairs.splice(realIndex, 1);
  }
  renderTempPairs();
}

// プリセットを保存
function savePresetFromModal() {
  const name = qs('#presetName')?.value.trim();

  if (!name) {
    alert('プリセット名を入力してください。');
    return;
  }

  if (tempPairs.length === 0) {
    alert('少なくとも1つの原価・売価ペアを追加してください。');
    return;
  }

  const presets = loadPresets();
  const patterns = [...tempPairs].sort((a, b) => b.unitPrice - a.unitPrice);

  if (currentEditingPreset) {
    // 編集モード
    const index = presets.findIndex(p => p.id === currentEditingPreset.id);
    if (index !== -1) {
      presets[index] = { id: currentEditingPreset.id, name, patterns };
    }
  } else {
    // 新規追加
    const newPreset = {
      id: Date.now(),
      name,
      patterns
    };
    presets.push(newPreset);
  }

  savePresetsData(presets);
  renderPresetList();
  showPresetList();
}

// プリセット一覧を表示
function renderPresetList() {
  const presetList = qs('#presetList');
  if (!presetList) return;

  const presets = loadPresets();

  if (presets.length === 0) {
    presetList.innerHTML = '<p style="color: #999; text-align: center; padding: 2em;">保存されたプリセットはありません</p>';
    return;
  }

  presetList.innerHTML = presets.map(preset => {
    // patternsが存在しない場合は空配列として扱う（データの互換性対策）
    const patterns = Array.isArray(preset.patterns) ? preset.patterns : [];

    const patternsDisplay = patterns
      .slice(0, 3)
      .map(p => `<span class="preset-pattern-badge">${p.unitCost || 0}円→${p.unitPrice || 0}円</span>`)
      .join('');
    const moreText = patterns.length > 3 ? ` <span style="color: #999;">他${patterns.length - 3}件</span>` : '';

    return `
      <div class="preset-item" data-preset-id="${preset.id}">
        <input type="checkbox" class="preset-checkbox" data-preset-id="${preset.id}">
        <div class="preset-info">
          <div class="preset-name">${preset.name || '名称未設定'}</div>
          <div class="preset-item-patterns">${patternsDisplay}${moreText}</div>
        </div>
        <button class="preset-btn preset-btn-edit" data-preset-id="${preset.id}">編集</button>
        <button class="preset-btn preset-btn-delete" data-preset-id="${preset.id}">削除</button>
      </div>
    `;
  }).join('');
}

// プリセットを編集
function editPresetFromModal(id) {
  const presets = loadPresets();
  const preset = presets.find(p => p.id === id);

  if (!preset) return;

  currentEditingPreset = preset;
  // preset.patternsが存在しない場合は空配列として扱う
  tempPairs = Array.isArray(preset.patterns) ? [...preset.patterns] : [];
  qs('#presetEditorTitle').textContent = 'プリセット編集';
  qs('#presetName').value = preset.name;
  qs('#tempUnitCost').value = '';
  qs('#tempUnitPrice').value = '';
  renderTempPairs();

  // 編集画面を表示
  showPresetEditor();
}

// プリセットを削除
function deletePresetFromModal(id) {
  if (!confirm('このプリセットを削除してもよろしいですか？')) return;

  const presets = loadPresets();
  const filtered = presets.filter(p => p.id !== id);
  savePresetsData(filtered);
  renderPresetList();
}

/**
 * テーブル内の空欄行を削除する
 */
function removeEmptyRows() {
  const tableBody = qs('#multiPatternTableBody');
  if (!tableBody) return;

  const rows = Array.from(tableBody.querySelectorAll('tr'));

  rows.forEach(row => {
    const unitCostInput = row.querySelector('.pattern-unit-cost');
    const unitPriceInput = row.querySelector('.pattern-unit-price');

    // 両方の入力が空欄の場合、行を削除
    if (unitCostInput && unitPriceInput) {
      const costValue = unitCostInput.value.trim();
      const priceValue = unitPriceInput.value.trim();

      if (costValue === '' && priceValue === '') {
        row.remove();
      }
    }
  });

  // 行がすべて削除された場合、最低1行は残す
  if (tableBody.querySelectorAll('tr').length === 0) {
    const addBtn = qs('#addPatternBtn');
    if (addBtn) {
      addBtn.click();
    }
  }
}

// 選択したプリセットをパターンテーブルに追加
function addSelectedPresetsToTable() {
  const checkedBoxes = qsa('.preset-checkbox:checked');

  if (checkedBoxes.length === 0) {
    alert('追加するプリセットを選択してください。');
    return;
  }

  const presets = loadPresets();
  const tableBody = qs('#multiPatternTableBody');
  if (!tableBody) return;

  // プリセット追加前に空欄行を削除
  removeEmptyRows();

  // 全てのパターンを配列にまとめる
  const allPatterns = [];
  checkedBoxes.forEach(checkbox => {
    const presetId = parseInt(checkbox.dataset.presetId);
    const preset = presets.find(p => p.id === presetId);
    if (preset && Array.isArray(preset.patterns)) {
      allPatterns.push(...preset.patterns);
    }
  });

  // 既存の空欄行を取得
  const existingRows = Array.from(tableBody.querySelectorAll('tr'));
  const firstEmptyRow = existingRows.find(row => {
    const costInput = row.querySelector('.pattern-unit-cost');
    const priceInput = row.querySelector('.pattern-unit-price');
    return costInput && priceInput && costInput.value.trim() === '' && priceInput.value.trim() === '';
  });

  // パターンを追加
  allPatterns.forEach((pattern, index) => {
    let targetRow;

    if (index === 0 && firstEmptyRow) {
      // 最初のパターンで空行が存在する場合、その行を使う
      targetRow = firstEmptyRow;
    } else {
      // それ以外は新しい行を追加
      const addBtn = qs('#addPatternBtn');
      if (addBtn) {
        addBtn.click();
        const rows = tableBody.querySelectorAll('tr');
        targetRow = rows[rows.length - 1];
      }
    }

    // 行に値を設定
    if (targetRow) {
      const unitCostInput = targetRow.querySelector('.pattern-unit-cost');
      const unitPriceInput = targetRow.querySelector('.pattern-unit-price');

      if (unitCostInput) {
        unitCostInput.value = pattern.unitCost;
        unitCostInput.dispatchEvent(new Event('input'));
      }
      if (unitPriceInput) {
        unitPriceInput.value = pattern.unitPrice;
        unitPriceInput.dispatchEvent(new Event('input'));
      }
    }
  });

  // パターン番号を更新（念のため）
  if (window.multiPatternUI && typeof window.multiPatternUI.updatePatternNumbers === 'function') {
    window.multiPatternUI.updatePatternNumbers();
  }

  // モーダルを閉じる
  closePresetModal();

  // チェックを解除
  qsa('.preset-checkbox').forEach(cb => cb.checked = false);
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
    // stdDevが0またはほぼ0の場合は計算不可能
    if (!stdDev || stdDev <= 0 || !Number.isFinite(stdDev)) {
      return 0;
    }
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
    // bandwidthまたはvalues.lengthが0の場合は0を返す
    if (!bandwidth || bandwidth <= 0 || values.length === 0 || !Number.isFinite(bandwidth)) {
      return 0;
    }
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
      addYieldStatsRow();
    }
    resetYieldStatsEntries();
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
  // グローバルスコープに関数を公開（最優先で実行）
  window.openPresetModal = openPresetModal;

  // モード切替ボタン
  const fixedBtn = qs(`#${UI_ELEMENTS.FIXED_BTN}`);
  const weightBtn = qs(`#${UI_ELEMENTS.WEIGHT_BTN}`);
  const yieldStatsBtn = qs(`#${UI_ELEMENTS.YIELD_STATS_BTN}`);
  const multiPatternBtn = qs(`#${UI_ELEMENTS.MULTI_PATTERN_BTN}`);

  if (fixedBtn) {
    fixedBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.FIXED);
    });
  }

  if (weightBtn) {
    weightBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.WEIGHT);
    });
  }

  if (yieldStatsBtn) {
    yieldStatsBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.YIELD_STATS);
    });
  }

  if (multiPatternBtn) {
    multiPatternBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.MULTI_PATTERN);
    });
  }

  // クリアボタン（クラスベースで全てのボタンに設定）
  qsa('.clear-btn').forEach(btn => {
    addTapListener(btn, clearAll);
  });

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
      switchMode(MODE.MULTI_PATTERN);
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
