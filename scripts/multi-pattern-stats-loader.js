/**
 * 複数パターン分析への統計値読み込み機能
 * 歩留まり統計から複数パターン分析へデータを転記
 */

import { qs, toFixed } from './dom-utils.js';
import { appState } from './state.js';
import { MODE } from './constants.js';
import { showError, showWarning } from './toast.js';
import { switchMode } from './mode-manager.js';
import {
  resetSteps,
  resetWeightSteps
} from './form-manager.js';
import {
  resetYieldStatsEntries,
  addYieldStatsRow
} from './yield-stats-table.js';
import { setStatValue } from './multi-pattern-ui.js';
import { updateSaveButtonsVisibility } from './history-ui.js';
import { updateLoadStatsButtons } from './yield-stats-display.js';
import { getRecommendedValue } from './yield-stats-helpers.js';

/**
 * 推奨代表値を複数パターン分析に読み込む
 * @param {boolean} shouldSwitchMode - モード切替を行うか
 * @param {string} statsType - 統計タイプ（指定がない場合は現在の表示タイプを使用）
 */
export function loadRecommendedValueToMultiPattern(shouldSwitchMode = false, statsType = null) {
  const selectedStatsType = statsType || window.yieldStatsState?.currentDisplayType || 'yieldRate';
  const statsData = window.statsDataByType?.[selectedStatsType];

  if (!statsData) {
    console.warn('[MultiPattern] 統計データが見つかりません');
    return;
  }

  // サンプルサイズの妥当性をチェック
  const validation = window.yieldStatsState?.sampleSizeValidation?.[selectedStatsType];
  if (validation && !validation.isValid) {
    alert(`サンプルサイズが不十分です。\n\n実際のサンプル数: ${validation.actualSize}\n必要なサンプル数: ${validation.requiredSize}\n\nより多くのデータを収集してから推奨値を使用してください。`);
    console.warn('[MultiPattern] サンプルサイズが不十分なため、推奨値を読み込めません');
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
export function loadStatsValueToMultiPattern(value, displayType, shouldSwitchMode = false, productName = '') {
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
export function loadAllStatsToMultiPattern() {
  try {
    const yieldRateStats = window.statsDataByType?.yieldRate;
    const beforeWeightStats = window.statsDataByType?.beforeWeight;
    const afterWeightStats = window.statsDataByType?.afterWeight;

    if (!yieldRateStats || yieldRateStats.count < 2) {
      showWarning('歩留まり率の統計データがありません。先に歩留まり統計で計算を実行してください。');
      return;
    }

    // 商品名を取得
    const productNameEl = qs('#yieldStatsProductName');
    const productName = productNameEl?.value?.trim() || '';

    // サンプルサイズの妥当性をチェック
    const yieldRateValidation = window.yieldStatsState?.sampleSizeValidation?.yieldRate;
    if (yieldRateValidation && !yieldRateValidation.isValid) {
      alert(`歩留まり率のサンプルサイズが不十分です。\n\n実際のサンプル数: ${yieldRateValidation.actualSize}\n必要なサンプル数: ${yieldRateValidation.requiredSize}\n\nより多くのデータを収集してから推奨値を使用してください。`);
      return;
    }

    // 推奨値を取得
    const yieldRateRecommended = getRecommendedValue(yieldRateStats);
    if (!yieldRateRecommended) {
      showError('歩留まり率の推奨値を取得できませんでした。');
      return;
    }

    // 加工前重量の推奨値を取得（存在する場合、かつサンプルサイズが妥当な場合）
    const beforeWeightValidation = window.yieldStatsState?.sampleSizeValidation?.beforeWeight;
    const beforeWeightRecommended = beforeWeightStats && beforeWeightStats.count >= 2
      && (!beforeWeightValidation || beforeWeightValidation.isValid)
      ? getRecommendedValue(beforeWeightStats)
      : null;

    // 加工後重量の推奨値を取得（存在する場合、かつサンプルサイズが妥当な場合）
    const afterWeightValidation = window.yieldStatsState?.sampleSizeValidation?.afterWeight;
    const afterWeightRecommended = afterWeightStats && afterWeightStats.count >= 2
      && (!afterWeightValidation || afterWeightValidation.isValid)
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
        if (beforeWeightValidation && !beforeWeightValidation.isValid) {
          showWarning(`加工前重量のサンプルサイズが不十分です。\n実際: ${beforeWeightValidation.actualSize}、必要: ${beforeWeightValidation.requiredSize}`);
        } else {
          showWarning('加工前重量の統計データがありません。');
        }
        return;
      }
      if (!afterWeightRecommended) {
        if (afterWeightValidation && !afterWeightValidation.isValid) {
          showWarning(`加工後重量のサンプルサイズが不十分です。\n実際: ${afterWeightValidation.actualSize}、必要: ${afterWeightValidation.requiredSize}`);
        } else {
          showWarning('加工後重量の統計データがありません。');
        }
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
    showError('一括転記でエラーが発生しました。コンソールを確認してください。');
  }
}

/**
 * 転記完了通知を表示
 * @param {string} message - 通知メッセージ
 */
export function showTransferNotification(message) {
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
export function focusFirstPatternInput() {
  setTimeout(() => {
    const firstInput = qs('#multiPatternTableBody .pattern-unit-cost');
    if (firstInput) {
      firstInput.focus();
      firstInput.select();
    }
  }, 100);
}
