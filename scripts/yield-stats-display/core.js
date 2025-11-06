/**
 * 歩留まり統計: コア表示管理モジュール
 *
 * 統計値の表示、読み込みボタン管理などを担当するメインオーケストレーター。
 * 外れ値処理、計算式モーダル、σパターン生成も含みます。
 */

import { logger } from '../core/logger.js';
import { escapeHTML } from '../core/sanitizer.js';
import { qs, qsa, hide, show, toFixed } from '../dom-utils.js';
import { appState } from '../state.js';
import { MODE, UI_ELEMENTS, YIELD_STATS_FIELDS } from '../constants.js';
import { showInfo, showWarning } from '../toast.js';
import { calculateStatistics } from '../yield-stats-calc.js';
import { renderStatsChart } from '../yield-stats-charts.js';
import { updateToleranceUnit } from '../event-handlers-setup.js';
import { isOutlierValue } from '../outlier-management.js';

// Import from new modules
import { displayStatistics, displayMatrixEvaluation } from './statistics.js';
import { displayRecommendedValue } from './recommended.js';
import { updateLoadStatsButtons } from './buttons.js';
import { displaySampleSizeValidation } from './validation.js';

// Re-export functions that are used by other modules
export { updateLoadStatsButtons } from './buttons.js';
export { displaySampleSizeValidation } from './validation.js';

/**
 * 現在の統計データを表示するメインオーケストレーター関数
 */
export async function displayCurrentStatistics() {
  const selectElement = qs('#statsTypeSelect');
  const selectedType = selectElement?.value || 'yieldRate';
  const data = appState.getYieldStatsRawData();

  logger.info('[displayCurrentStatistics] data:', data);

  // 状態を更新：現在の表示タイプ（setCurrentDisplayType内で外れ値リセット処理あり）
  appState.setCurrentDisplayType(selectedType);

  if (!data) {
    hide('yieldStatsResults');
    logger.info('[displayCurrentStatistics] No data, hiding results');
    return;
  }

  // 各統計タイプの統計を計算して保存
  ['yieldRate', 'beforeWeight', 'afterWeight'].forEach(type => {
    if (data[type] && Array.isArray(data[type]) && data[type].length >= 2) {
      const stats = calculateStatistics(data[type]);
      logger.info(`[displayCurrentStatistics] Setting ${type} stats:`, stats);
      appState.setCalculatedStats(type, stats);
    } else {
      appState.setCalculatedStats(type, null);
    }
  });

  // 状態を更新：計算済みフラグ
  // 注：isFromHistoryは履歴復元時に既にtrueが設定されている場合があるので、
  // 既にtrueの場合は保持し、falseの場合のみ明示的にfalseを設定する
  appState.setYieldStatsCalculated(true);
  if (!appState.isYieldStatsFromHistory()) {
    appState.setYieldStatsFromHistory(false);
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
        appState.setCurrentDisplayType(foundType);
      }
    } else {
      // 全てのタイプでデータが不足している場合は非表示
      hide('yieldStatsResults');
      return;
    }
  }

  // 手動除外が設定されている場合、データをフィルタリング
  let finalValues = values;
  let finalStats = null;

  const manuallyExcludedIndices = appState.getManuallyExcludedOutlierIndices();
  const currentOutliers = appState.getCurrentOutlierValues();

  if (manuallyExcludedIndices.size > 0 && currentOutliers.length > 0) {
    const excludedValues = new Set();
    manuallyExcludedIndices.forEach(index => {
      if (index < currentOutliers.length) {
        excludedValues.add(currentOutliers[index]);
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
  logger.info('[displayCurrentStatistics] Displaying statistics for:', actualSelectedType, 'finalStats:', finalStats);
  displayStatistics(finalStats, unit);
  logger.info('[displayCurrentStatistics] displayStatistics done');
  displayMatrixEvaluation(finalStats);
  logger.info('[displayCurrentStatistics] displayMatrixEvaluation done');
  await renderStatsChart(finalValues, finalStats, typeName, unit);
  logger.info('[displayCurrentStatistics] renderStatsChart done');

  // 統計結果を表示
  show('yieldStatsResults');
  logger.info('[displayCurrentStatistics] yieldStatsResults shown');

  // サンプルサイズ妥当性判断の単位と表示を更新
  updateToleranceUnit();

  // サンプルサイズ妥当性判断（後方互換性のため、従来の動作を維持）
  // 許容誤差が入力されている場合はその妥当性を、未入力の場合は保存済みの妥当性を使用
  const validation = appState.getSampleSizeValidation(actualSelectedType);
  const isSampleSizeValid = validation ? validation.isValid : true; // 妥当性情報がない場合はtrue（後方互換性）

  if (isSampleSizeValid) {
    appState.setLastCalculatedStats(finalStats); // 表示用（選択された統計タイプ）
  } else {
    appState.setLastCalculatedStats(null); // サンプルサイズ不十分の場合はnull
  }

  // サンプルサイズ検証を実行（許容誤差が入力されている場合は推奨代表値も表示）
  const toleranceErrorInput = qs('#toleranceError');
  const hasTolerance = toleranceErrorInput && parseFloat(toleranceErrorInput.value) > 0;

  displaySampleSizeValidation();

  // 許容誤差が未入力の場合も推奨代表値を表示（ただしサンプルサイズが妥当な場合のみ）
  if (!hasTolerance) {
    displayRecommendedValue(finalStats, isSampleSizeValid, actualSelectedType);
  }
}

/**
 * 外れ値チェックボックスの変更を処理
 */
export function handleOutlierCheckboxChange() {
  // チェックボックスの状態を読み取り
  appState.clearExcludedOutliers();

  const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]:checked');
  checkboxes.forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index, 10);
    if (!isNaN(index)) {
      appState.excludeOutlierByIndex(index);
    }
  });

  // 統計を再計算・再表示（除外後のデータで）
  displayCurrentStatistics();
}

/**
 * 外れ値を含む行をテーブルから削除
 */
export function deleteOutlierRows() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // 外れ値が検出されていない場合は何もしない
  const currentOutliers = appState.getCurrentOutlierValues();
  if (!currentOutliers || currentOutliers.length === 0) {
    showWarning('削除する外れ値がありません。');
    return;
  }

  // 確認ダイアログを表示
  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';
  const statsTypeName = statsType === 'yieldRate' ? '歩留まり率' :
                       statsType === 'beforeWeight' ? '加工前重量' : '加工後重量';

  const confirmMessage = `${statsTypeName}に外れ値を含む行をテーブルから削除します。\n削除した行は元に戻せません。\n\n削除する外れ値の数: ${currentOutliers.length}件\n\n本当に削除しますか？`;

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
    showWarning('削除する行が見つかりませんでした。');
    return;
  }

  rowsToDelete.forEach(row => {
    row.remove();
  });

  // 行番号を再割り当て（グローバル関数を使用）
  if (typeof window.yieldStatsCallbacks !== 'undefined') {
    window.compactYieldStatsRows(window.yieldStatsCallbacks);
  }

  // 統計を再計算（グローバル関数を使用）
  if (typeof window.updateYieldStatsStatistics !== 'undefined') {
    window.updateYieldStatsStatistics(displayCurrentStatistics);
  }

  // 削除完了メッセージ
  showInfo(`${rowsToDelete.length}行を削除しました。`);
}

/**
 * 計算式詳細モーダルのセットアップ
 */
export function setupFormulaModal() {
  const modal = qs('#formulaModal');
  const modalClose = qs('#formulaModalClose');
  const modalOverlay = modal?.querySelector('.modal-overlay');
  const modalTitle = qs('#formulaModalTitle');
  const modalBody = qs('#formulaModalBody');

  if (!modal || !modalClose || !modalOverlay || !modalTitle || !modalBody) {
    return;
  }

  // モーダルを開く関数（XSS対策: dataset属性の値をエスケープ）
  const openModal = (formulaName, formula, description, example) => {
    modalTitle.textContent = formulaName;

    // XSS対策: dataset属性から取得した値をエスケープ
    let html = '<div class="formula-section">';

    if (formula) {
      html += '<div class="formula-label">計算式</div>';
      html += `<div class="formula-expression">${escapeHTML(formula)}</div>`;
    }

    if (description) {
      html += `<div class="formula-description">${escapeHTML(description)}</div>`;
    }

    if (example) {
      html += `<div class="formula-example"><strong>例：</strong> ${escapeHTML(example)}</div>`;
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
 * 標準偏差を使った範囲パターンを生成
 * @param {Object} stats - 統計データ
 * @param {number} sigmaRange - 標準偏差の範囲（デフォルト: 2）
 * @returns {Array<Object>} {label: string, value: number, sigma: number}[]
 */
export function generateSigmaPatterns(stats, sigmaRange = 2) {
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
