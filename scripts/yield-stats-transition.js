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

import { logger } from './core/logger.js';

import { qs, hide } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS } from './constants.js';
import { clearYieldStatsInputs } from './mode-manager.js';
import { addYieldStatsRow } from './yield-stats-table.js';
import { updateLoadStatsButtons } from './yield-stats-display.js';

// タイミング定数（Phase 0で削除されたTIME定数の代わり）
const UI_TRANSITION_DELAY = 300; // UI遷移待機時間（ms）
const STATS_POLL_MAX_WAIT = 5000; // 統計データ待機最大時間（ms）
const STATS_POLL_INTERVAL = 100;  // ポーリング間隔（ms）

/**
 * 統計データの準備完了を待つ（Promiseベース）
 *
 * この関数は、履歴読み込み後に統計計算が完了するまでポーリングで待機します。
 * setTimeoutのマジックナンバーを置き換えるために作成されました。
 *
 * @param {boolean} isFromHistory - 履歴から読み込まれたデータか
 * @returns {Promise<void>}
 */
export async function waitForStatsDataReady(isFromHistory) {
  // 履歴からの読み込みでない場合は、UI遷移のみ待つ
  if (!isFromHistory) {
    return new Promise(resolve => {
      setTimeout(resolve, UI_TRANSITION_DELAY);
    });
  }

  // 履歴から読み込まれた場合は、統計データの準備完了を待つ
  const startTime = Date.now();

  while (Date.now() - startTime < STATS_POLL_MAX_WAIT) {
    // 統計データが準備できているかチェック
    const yieldRateStats = appState.getCalculatedStats('yieldRate');
    if (yieldRateStats && yieldRateStats.count >= 2) {
      // データが準備できた
      return;
    }

    // 少し待ってから再チェック
    await new Promise(resolve => setTimeout(resolve, STATS_POLL_INTERVAL));
  }

  // タイムアウト：最大待機時間を超えた
  logger.warn('[waitForStatsDataReady] タイムアウト: 統計データの準備が完了しませんでした');
}

/**
 * 統計データの存在をチェック
 * @returns {Object} { hasValidStats: boolean, isFromHistory: boolean, hasYieldStatsData: boolean }
 */
export function checkStatsDataExists() {
  // appState から統計データを確認
  const yieldRateStats = appState.getCalculatedStats('yieldRate');
  const hasValidStats = yieldRateStats && yieldRateStats.count >= 2;

  // 履歴から読み込まれた場合もチェック
  const isFromHistory = appState.isYieldStatsFromHistory();
  const yieldStatsData = appState.getYieldStatsRawData();
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
 * 2. DOMの非表示化
 * 3. UIの更新
 *
 * @param {Function} yieldStatsCallbacks - 歩留まり統計のコールバック（addYieldStatsRow用）
 */
export function clearAllYieldStatsData(yieldStatsCallbacks) {
  // 1. appStateのすべての歩留まり統計データをクリア
  appState.showYieldStatsWithMultiPattern = false;
  appState.clearAllYieldStats(); // 一元化されたクリア処理

  // 2. 歩留まり統計のテーブルと結果をクリア
  clearYieldStatsInputs(() => addYieldStatsRow(yieldStatsCallbacks));
  hide('yieldStatsResults');

  // 3. 歩留まり統計のDOM要素を非表示
  const yieldStatsInputs = qs(`#${UI_ELEMENTS.YIELD_STATS_INPUTS}`);
  if (yieldStatsInputs) {
    yieldStatsInputs.classList.add('is-hidden');
  }

  // 4. データクリア後、updateLoadStatsButtons を呼び出してメッセージをクリア
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
    // 画面遷移後、統計データの準備完了を待ってから値を取り込む
    // Promiseベースのポーリングで確実にデータが準備できるまで待つ
    waitForStatsDataReady(isFromHistory)
      .then(() => {
        loadAllStatsToMultiPattern(true);
      })
      .catch(error => {
        logger.error('[handleYieldStatsTransition] データ待機エラー:', error);
        // エラーが発生しても読み込みは試行する
        loadAllStatsToMultiPattern(true);
      });
  } else {
    // 「いいえ」を選択した場合、歩留まり統計をクリアして非表示にする
    clearAllYieldStatsData(yieldStatsCallbacks);
  }

  return true; // 確認ダイアログを表示したことを示す
}
