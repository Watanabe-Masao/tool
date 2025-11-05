/**
 * イベントハンドラーのセットアップ
 * アプリケーションの全イベントリスナーを初期化
 */

// すべての必要なimportsをmain.jsからコピー
import { qs, qsa, num, hide, show, toggleActive, setText, yen, pct, addTapListener, toFixed } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, FIXED_FIELDS, WEIGHT_FIELDS, RADIO_NAMES, YIELD_STATS_FIELDS, TIME } from './constants.js';
import { updateSaveButtonsVisibility, showHistoryModal } from './history-ui.js';
import { saveSessionState, restoreSessionState, applySessionState, clearSessionState } from './session.js';
import { showError, showWarning } from './toast.js';
import { debounce } from './debounce.js';
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
import {
  resetYieldStatsEntries,
  addYieldStatsRow,
  compactYieldStatsRows,
  restoreYieldStatsTable,
  updateYieldStatsStatistics
} from './yield-stats-table.js';
import {
  displayCurrentStatistics,
  setupFormulaModal,
  updateLoadStatsButtons,
  displaySampleSizeValidation,
  handleOutlierCheckboxChange,
  deleteOutlierRows,
  generateSigmaPatterns
} from './yield-stats-display.js';
import {
  resetReverseSimulation,
  toggleReverseSimulation,
  updateReverseSimulationLabels,
  handleReverseCalculation,
  applyReverseSimulationResult
} from './reverse-simulation.js';
import {
  loadRecommendedValueToMultiPattern,
  loadStatsValueToMultiPattern,
  loadAllStatsToMultiPattern,
  showTransferNotification,
  focusFirstPatternInput
} from './multi-pattern-stats-loader.js';
import { initHistoryUI } from './history-ui.js';
import { initMultiPatternUI } from './multi-pattern-ui.js';
import { setupPresetEventListeners, openPresetModal, closePresetModal } from './multi-pattern-presets.js';
import { updateDiscountSimulation } from './product-simulator.js';

// yield-stats-table.js の関数呼び出しに使うコールバックオブジェクト
const yieldStatsCallbacks = {
  updateYieldStatsStatistics: () => updateYieldStatsStatistics(displayCurrentStatistics),
  updateSaveButtonsVisibility,
  addYieldStatsRow: () => addYieldStatsRow(yieldStatsCallbacks),
  compactYieldStatsRows: () => compactYieldStatsRows(yieldStatsCallbacks)
};

/**
 * 値引き更新処理
 */
function handleDiscountUpdate() {
  const productData = appState.getProductData();
  updateDiscountSimulation(productData);
}

/**
 * 許容誤差の単位を更新
 */
export function updateToleranceUnit() {
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
    let yieldStatsEntryCounter = 0;
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
        updateLoadStatsButtons,
        displayCurrentStatistics
      });
    });
  }

  if (weightBtn) {
    weightBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.WEIGHT, {
        resetSteps,
        resetWeightSteps,
        resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
        updateLoadStatsButtons,
        displayCurrentStatistics
      });
    });
  }

  if (yieldStatsBtn) {
    yieldStatsBtn.addEventListener('click', () => {
      handleModeSwitch(MODE.YIELD_STATS, {
        resetSteps,
        resetWeightSteps,
        resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
        updateLoadStatsButtons,
        displayCurrentStatistics
      });
    });
  }

  if (multiPatternBtn) {
    multiPatternBtn.addEventListener('click', () => {
      // 現在のモードを取得
      const currentMode = appState.getMode();

      // 複数パターン分析の商品名フィールドを取得
      const multiPatternProductName = qs('#multiPatternProductName');

      if (multiPatternProductName) {
        // 歩留まり統計モード以外から遷移する場合は商品名をクリアして編集可能にする
        if (currentMode !== MODE.YIELD_STATS) {
          multiPatternProductName.value = '';
          multiPatternProductName.removeAttribute('readonly');
          multiPatternProductName.style.backgroundColor = '';
          multiPatternProductName.style.cursor = '';
        }
        // 歩留まり統計モードから遷移する場合はreadonly属性を保持（動的連動を継続）
      }

      handleModeSwitch(MODE.MULTI_PATTERN, {
        resetSteps,
        resetWeightSteps,
        resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
        updateLoadStatsButtons,
        displayCurrentStatistics
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
  const debouncedHandleStep1 = debounce(handleStep1);
  [FIXED_FIELDS.CALCULATE.UNIT_COST, FIXED_FIELDS.CALCULATE.UNIT_PRICE,
   FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', debouncedHandleStep1);
  });

  // 定額モード - 重量から計算モード - Step 2の入力監視
  qs(`#${FIXED_FIELDS.CALCULATE.AFTER_WEIGHT}`)?.addEventListener('input', debounce(handleStep2));

  // 定額モード - 重量から計算モード - Step 3の入力監視
  qs(`#${FIXED_FIELDS.CALCULATE.AFTER_PRICE_100}`)?.addEventListener('input', debounce(handleStep3));

  // 定額モード - 歩留まり率直接入力モード - Step 1の入力監視
  const debouncedHandleDirectStep1 = debounce(handleDirectStep1);
  [FIXED_FIELDS.DIRECT.UNIT_COST, FIXED_FIELDS.DIRECT.UNIT_PRICE,
   FIXED_FIELDS.DIRECT.BEFORE_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', debouncedHandleDirectStep1);
  });

  // 定額モード - 歩留まり率直接入力モード - Step 2の入力監視
  qs(`#${FIXED_FIELDS.DIRECT.YIELD_RATE}`)?.addEventListener('input', debounce(handleDirectStep2));

  // 定額モード - 歩留まり率直接入力モード - Step 3の入力監視
  qs(`#${FIXED_FIELDS.DIRECT.AFTER_PRICE_100}`)?.addEventListener('input', debounce(handleDirectStep3));

  // 計量モード - 重量から計算モード - Step 1の入力監視
  const debouncedHandleWeightStep1 = debounce(handleWeightStep1);
  [WEIGHT_FIELDS.CALCULATE.BOX_COST, WEIGHT_FIELDS.CALCULATE.BOX_PRICE,
   WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', debouncedHandleWeightStep1);
  });

  // 計量モード - 重量から計算モード - Step 2の入力監視
  const debouncedHandleWeightStep2 = debounce(handleWeightStep2);
  [WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE, WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', debouncedHandleWeightStep2);
  });

  // 計量モード - 重量から計算モード - Step 3の入力監視
  qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100}`)?.addEventListener('input', debounce(handleWeightStep3));

  // 計量モード - 歩留まり率直接入力モード - Step 1の入力監視
  const debouncedHandleWeightDirectStep1 = debounce(handleWeightDirectStep1);
  [WEIGHT_FIELDS.DIRECT.BOX_COST, WEIGHT_FIELDS.DIRECT.BOX_PRICE,
   WEIGHT_FIELDS.DIRECT.BOX_WEIGHT].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', debouncedHandleWeightDirectStep1);
  });

  // 計量モード - 歩留まり率直接入力モード - Step 2の入力監視
  qs(`#${WEIGHT_FIELDS.DIRECT.YIELD_RATE}`)?.addEventListener('input', debounce(handleWeightDirectStep2));

  // 計量モード - 歩留まり率直接入力モード - Step 3の入力監視
  qs(`#${WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100}`)?.addEventListener('input', debounce(handleWeightDirectStep3));

  // 歩留まり率統計モード - 統計タイプ選択
  qs('#statsTypeSelect')?.addEventListener('change', () => {
    displayCurrentStatistics();
  });

  // 歩留まり率統計モード - グラフタイプ選択
  qs('#chartTypeSelect')?.addEventListener('change', () => {
    displayCurrentStatistics();
  });

  // 歩留まり率統計モード - サンプルサイズ妥当性判断
  const debouncedDisplaySampleSizeValidation = debounce(displaySampleSizeValidation);
  qs('#toleranceError')?.addEventListener('input', debouncedDisplaySampleSizeValidation);
  qs('#confidenceLevel')?.addEventListener('change', debouncedDisplaySampleSizeValidation);

  /**
   * 外れ値の全選択処理
   */
  function handleSelectAllOutliers() {
    const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = true;
    });
    handleOutlierCheckboxChange();
  }

  /**
   * 外れ値の全解除処理
   */
  function handleDeselectAllOutliers() {
    const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      checkbox.checked = false;
    });
    handleOutlierCheckboxChange();
  }

  // 外れ値の全選択・全解除ボタン
  qs('#selectAllOutliers')?.addEventListener('click', handleSelectAllOutliers);
  qs('#selectAllOutliers')?.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleSelectAllOutliers();
  }, { passive: false });

  qs('#deselectAllOutliers')?.addEventListener('click', handleDeselectAllOutliers);
  qs('#deselectAllOutliers')?.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleDeselectAllOutliers();
  }, { passive: false });

  // 外れ値を含む行を削除
  qs('#deleteOutlierRows')?.addEventListener('click', deleteOutlierRows);
  qs('#deleteOutlierRows')?.addEventListener('touchend', (e) => {
    e.preventDefault();
    deleteOutlierRows();
  }, { passive: false });

  // 計算式詳細モーダル
  setupFormulaModal();

  // 商品化シミュレーション
  const debouncedHandleProductCalculation = debounce(handleProductCalculation);
  [UI_ELEMENTS.EXP_WEIGHT, UI_ELEMENTS.CONSUMABLE].forEach(id => {
    qs(`#${id}`)?.addEventListener('input', debouncedHandleProductCalculation);
  });

  // 値引きシミュレーション
  const debouncedHandleDiscountUpdate = debounce(handleDiscountUpdate);
  qs(`#${UI_ELEMENTS.DISC_SLIDER}`)?.addEventListener('input', (e) => {
    qs(`#${UI_ELEMENTS.DISC_INPUT}`).value = e.target.value;
    debouncedHandleDiscountUpdate();
  });

  qs(`#${UI_ELEMENTS.DISC_INPUT}`)?.addEventListener('input', (e) => {
    let v = parseFloat(e.target.value) || 0;
    v = Math.max(0, Math.min(100, v));
    e.target.value = v;
    qs(`#${UI_ELEMENTS.DISC_SLIDER}`).value = Math.min(v, 50);
    debouncedHandleDiscountUpdate();
  });

  // 逆算シミュレーション
  // イベント委譲を使用して確実にクリックを検出
  document.addEventListener('click', (e) => {
    // 値引後粗利率をクリック → 逆算シミュレーションを開く
    const discGrossTarget = e.target.closest(`#${UI_ELEMENTS.DISC_GROSS_STAT}`);
    if (discGrossTarget) {
      e.preventDefault();
      toggleReverseSimulation(handleReverseCalculation);
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

  const debouncedHandleReverseCalculation = debounce(handleReverseCalculation);
  qs(`#${UI_ELEMENTS.TARGET_MARKUP}`)?.addEventListener('input', debouncedHandleReverseCalculation);
  qsa(`input[name="${RADIO_NAMES.REVERSE_CALC_TARGET}"]`).forEach(r => {
    r.addEventListener('change', debouncedHandleReverseCalculation);
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

  // Service Workerを登録（PWA対応 + 更新通知）
  if ('serviceWorker' in navigator) {
    let refreshing = false;

    // Service Worker登録
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/tool/sw.js')
        .then((registration) => {
          // 更新チェック
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;

            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // 新しいバージョンが利用可能
                showUpdateNotification(newWorker);
              }
            });
          });

          // 定期的な更新チェック（1時間ごと）
          setInterval(() => {
            registration.update();
          }, TIME.ONE_HOUR);
        })
        .catch((error) => {
          console.error('[PWA] Service Worker registration failed:', error);
        });
    });

    // Service Worker制御変更時の自動リロード
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
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
      newWorker.postMessage({ type: 'SKIP_WAITING' });
    }, { once: true });

    // 閉じるボタンクリック
    dismissBtn.addEventListener('click', () => {
      notification.classList.add('is-hidden');
    }, { once: true });
  }

  // グローバルスコープに公開（イベントハンドラーから参照できるように）
  window.loadAllStatsToMultiPattern = loadAllStatsToMultiPattern;
  window.loadStatsValueToMultiPattern = loadStatsValueToMultiPattern;
  window.showTransferNotification = showTransferNotification;
  window.focusFirstPatternInput = focusFirstPatternInput;

  // 歩留まり統計の商品名が変更されたら複数パターン分析にも動的に反映
  qs('#yieldStatsProductName')?.addEventListener('input', (e) => {
    const multiPatternProductName = qs('#multiPatternProductName');
    // 複数パターン分析の商品名が読み取り専用の場合のみ同期
    if (multiPatternProductName && multiPatternProductName.hasAttribute('readonly')) {
      multiPatternProductName.value = e.target.value;
    }
  });

  // 複数パターン分析への遷移ボタン
  qs('#goToMultiPatternBtn')?.addEventListener('click', () => {
    // 歩留まり統計の商品名を複数パターン分析に引き継ぐ
    const yieldStatsProductName = qs('#yieldStatsProductName')?.value || '';
    const multiPatternProductName = qs('#multiPatternProductName');
    if (multiPatternProductName && yieldStatsProductName) {
      multiPatternProductName.value = yieldStatsProductName;
      // 歩留まり統計から遷移した場合は商品名を読み取り専用にする
      multiPatternProductName.setAttribute('readonly', 'readonly');
      multiPatternProductName.style.backgroundColor = '#f0f0f0';
      multiPatternProductName.style.cursor = 'not-allowed';
    }
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

  /**
   * σパターン一括生成処理
   */
  function handleGenerateSigmaPatterns() {
    const loadStatsTypeSelect = qs('#loadStatsTypeSelect');
    const selectedStatsType = loadStatsTypeSelect?.value || 'yieldRate';
    const statsData = window.statsDataByType?.[selectedStatsType];

    if (!statsData) {
      showWarning('統計データがありません。先に歩留まり統計で計算を実行してください。');
      return;
    }

    if (!confirm('現在のパターンをクリアして、標準偏差パターン（平均±1σ、±2σ）を自動生成しますか？')) {
      return;
    }

    // σパターンを生成
    const sigmaPatterns = generateSigmaPatterns(statsData, 2);

    if (sigmaPatterns.length === 0) {
      showError('パターンを生成できませんでした。');
      return;
    }

    // 複数パターン分析のパターンテーブルをクリアして、σパターンを追加
    // この処理はmulti-pattern-ui.jsに実装された関数を呼び出す
    if (window.multiPatternUI && typeof window.multiPatternUI.replaceAllPatterns === 'function') {
      window.multiPatternUI.replaceAllPatterns(sigmaPatterns);
    } else {
      console.warn('[MultiPattern] replaceAllPatterns関数が見つかりません');
      showError('パターン生成機能の初期化に失敗しました。');
    }
  }

  // σパターン一括生成ボタン
  qs('#generateSigmaPatternsBtn')?.addEventListener('click', handleGenerateSigmaPatterns);
  qs('#generateSigmaPatternsBtn')?.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleGenerateSigmaPatterns();
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

  // プリセット管理機能のイベントリスナーは setupPresetEventListeners() で設定済み
  // （重複を避けるため、ここでの設定は削除）

  /**
   * 統計読み込みボタンのハンドラー（共通処理）
   */
  function handleStatsLoadButtonClick(e) {
    // 統計読み込みボタン（平均値）
    if (e.target.id === 'loadStatsMeanBtn' || e.target.closest('#loadStatsMeanBtn')) {
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
    // 歩留まり統計データを読み込むボタン
    else if (e.target.id === 'loadYieldStatsDataBtn' || e.target.closest('#loadYieldStatsDataBtn')) {
      showHistoryModal();
    }
  }

  // 統計読み込みボタンのイベントリスナー
  document.addEventListener('click', handleStatsLoadButtonClick);

  // 統計読み込みボタンのタッチイベントリスナー（モバイル対応）
  document.addEventListener('touchend', (e) => {
    // タッチイベントの場合のみpreventDefault
    if (e.target.closest('#loadStatsMeanBtn, #loadStatsMedianBtn, #loadStatsRecommendedBtn, #loadYieldStatsDataBtn')) {
      e.preventDefault();
      handleStatsLoadButtonClick(e);
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

  // 歩留まり統計全体の折りたたみ機能
  const yieldStatsToggle = qs('#yieldStatsToggle');
  if (yieldStatsToggle) {
    yieldStatsToggle.addEventListener('click', () => {
      const content = qs('#yieldStatsContent');
      const icon = yieldStatsToggle.querySelector('.accordion-icon');

      if (content && icon) {
        const isHidden = content.style.display === 'none';

        if (isHidden) {
          // 展開
          content.style.display = 'block';
          icon.textContent = '▼';
          icon.style.transform = 'rotate(0deg)';
        } else {
          // 折りたたみ
          content.style.display = 'none';
          icon.textContent = '▶';
          icon.style.transform = 'rotate(-90deg)';
        }
      }
    });
  }
}

// 公開用のセットアップ関数としてinit関数をexport
export function setupEventHandlers() {
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

  // 歩留まり統計の表示関数を公開（history-ui.js から呼び出すため）
  window.displayCurrentStatistics = displayCurrentStatistics;

  // init関数を実行
  init();
}

