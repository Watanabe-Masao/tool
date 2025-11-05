/**
 * 歩留まり統計遷移ユーティリティ
 *
 * 歩留まり統計から複数パターン分析への遷移に関する
 * 共通ロジックを提供します。
 *
 * リファクタリング目的:
 * - event-handlers-setup.js内の80行の重複コードを削減
 * - データクリア処理の一元化
 * - 保守性とテスタビリティの向上
 */

import { qs, hide } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS } from './constants.js';
import { clearYieldStatsInputs } from './mode-manager.js';
import { addYieldStatsRow } from './yield-stats-table.js';
import { updateLoadStatsButtons } from './yield-stats-display.js';

/**
 * 統計データの存在をチェック
 * @returns {Object} { hasValidStats: boolean, isFromHistory: boolean, hasYieldStatsData: boolean }
 */
export function checkStatsDataExists() {
  // window.statsDataByType から統計データを確認
  const yieldRateStats = window.statsDataByType?.yieldRate;
  const hasValidStats = yieldRateStats && yieldRateStats.count >= 2;

  // 履歴から読み込まれた場合もチェック
  const isFromHistory = window.yieldStatsState?.isFromHistory;
  const yieldStatsData = appState.getYieldStatsData();
  const hasYieldStatsData = yieldStatsData && (
    (yieldStatsData.yieldRate && yieldStatsData.yieldRate.length >= 2) ||
    (yieldStatsData.beforeWeight && yieldStatsData.beforeWeight.length >= 2) ||
    (yieldStatsData.afterWeight && yieldStatsData.afterWeight.length >= 2)
  );

  return {
    hasValidStats,
    isFromHistory,
    hasYieldStatsData,
    hasAnyStats: hasValidStats || (isFromHistory && hasYieldStatsData)
  };
}

/**
 * 歩留まり統計の全データをクリア
 *
 * このフンクションは以下を実行します:
 * 1. appStateのデータクリア
 * 2. windowグローバル変数のクリア
 * 3. yieldStatsStateの完全リセット
 * 4. DOMの非表示化
 * 5. UIの更新
 *
 * @param {Function} yieldStatsCallbacks - 歩留まり統計のコールバック（addYieldStatsRow用）
 */
export function clearAllYieldStatsData(yieldStatsCallbacks) {
  // 1. appStateのデータクリア
  appState.showYieldStatsWithMultiPattern = false;
  appState.setYieldStatsData(null);

  // 2. windowグローバル変数のクリア
  window.statsDataByType = {};
  window.lastCalculatedStats = null;

  // 3. window.yieldStatsState を初期状態に完全リセット
  if (window.yieldStatsState) {
    window.yieldStatsState.currentDisplayType = 'yieldRate';
    window.yieldStatsState.isFromHistory = false;
    window.yieldStatsState.isCalculated = false;
    window.yieldStatsState.hasYieldRateData = false;
    window.yieldStatsState.hasBeforeWeightData = false;
    window.yieldStatsState.hasAfterWeightData = false;
    window.yieldStatsState.isOutlierExcluded = false;
    window.yieldStatsState.manuallyExcludedOutlierIndices.clear();
    window.yieldStatsState.currentOutlierValues = [];
    window.yieldStatsState.sampleSizeValidation = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };
    window.yieldStatsState.shouldShowMultiPatternLink = false;
  }

  // 4. 歩留まり統計のテーブルと結果をクリア
  clearYieldStatsInputs(() => addYieldStatsRow(yieldStatsCallbacks));
  hide('yieldStatsResults');

  // 5. 歩留まり統計のDOM要素を非表示
  const yieldStatsInputs = qs(`#${UI_ELEMENTS.YIELD_STATS_INPUTS}`);
  if (yieldStatsInputs) {
    yieldStatsInputs.classList.add('is-hidden');
  }

  // 6. データクリア後、updateLoadStatsButtons を呼び出してメッセージをクリア
  // これは重要：handleModeSwitch内で呼ばれた後、データクリアしたので再度呼ぶ必要がある
  updateLoadStatsButtons();
}

/**
 * 歩留まり統計から複数パターン分析への遷移を処理
 *
 * この関数は以下の役割を果たします：
 * 1. 現在のモードが歩留まり統計でない場合、通常の遷移
 * 2. 統計データがない場合、通常の遷移
 * 3. 統計データがある場合、確認ダイアログを表示
 *    - 「はい」：統計値を取り込む
 *    - 「いいえ」：データをクリアして遷移
 *
 * @param {string} targetMode - 遷移先のモード (MODE.MULTI_PATTERN)
 * @param {Object} modeSwitchCallbacks - handleModeSwitch に渡すコールバック
 * @param {Function} loadAllStatsToMultiPattern - 統計値読み込み関数
 * @param {Object} yieldStatsCallbacks - 歩留まり統計のコールバック
 * @param {Object} options - 追加オプション
 * @param {Function} options.beforeTransition - 遷移前に実行する処理（商品名の設定など）
 * @returns {boolean} true: 確認ダイアログを表示した, false: 通常の遷移を行った
 */
export function handleYieldStatsTransition(
  targetMode,
  modeSwitchCallbacks,
  loadAllStatsToMultiPattern,
  yieldStatsCallbacks,
  options = {}
) {
  const currentMode = appState.getMode();

  // 歩留まり統計モード以外から遷移する場合は通常処理
  if (currentMode !== MODE.YIELD_STATS) {
    return false; // 通常遷移を行うことを示す
  }

  // 統計データの存在をチェック
  const { hasAnyStats, isFromHistory } = checkStatsDataExists();

  // 統計データがない場合は通常処理
  if (!hasAnyStats) {
    return false; // 通常遷移を行うことを示す
  }

  // 遷移前の処理（オプション）
  if (options.beforeTransition && typeof options.beforeTransition === 'function') {
    options.beforeTransition();
  }

  // 確認メッセージを表示（サンプルサイズの妥当性に関わらず）
  const useStats = confirm('歩留まり統計の推奨値を複数パターン分析で使用しますか？');

  // まず画面を遷移
  const handleModeSwitch = modeSwitchCallbacks.handleModeSwitch;
  handleModeSwitch(targetMode, modeSwitchCallbacks);

  // 「はい」を選択した場合、推奨値を取り込む
  if (useStats) {
    // 画面遷移後に少し待ってから値を取り込む（確認ダイアログはスキップ）
    // 履歴から読み込まれた場合は、統計計算の完了を待つために少し長めに待つ
    const delay = isFromHistory ? 400 : 100;
    setTimeout(() => {
      loadAllStatsToMultiPattern(true);
    }, delay);
  } else {
    // 「いいえ」を選択した場合、歩留まり統計をクリアして非表示にする
    clearAllYieldStatsData(yieldStatsCallbacks);
  }

  return true; // 確認ダイアログを表示したことを示す
}
