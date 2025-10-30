/**
 * 歩留まり統計: テーブル管理モジュール
 *
 * このモジュールは歩留まり統計テーブルのUI管理と
 * データ収集・保存を担当します。
 */

import { qs, hide, show, setText, pct } from './dom-utils.js';
import { toFixed } from './calculation.js';
import { UI_ELEMENTS, YIELD_STATS_FIELDS } from './constants.js';
import { appState } from './state.js';
import { calculateYieldRate } from './calculator-yield-stats.js';
import { calculateStatistics } from './yield-stats-calc.js';

// モジュール内のカウンター
let yieldStatsEntryCounter = 0;

/**
 * エントリーカウンターを取得（デバッグ・テスト用）
 */
export function getYieldStatsEntryCounter() {
  return yieldStatsEntryCounter;
}

/**
 * エントリーカウンターをリセット（テスト用）
 */
export function resetYieldStatsEntryCounter() {
  yieldStatsEntryCounter = 0;
}

/**
 * 歩留まり率統計モード: 表示をリセット（入力値はクリアしない）
 *
 * @param {Function} addYieldStatsRowCallback - 行追加のコールバック
 */
export function resetYieldStatsEntries(addYieldStatsRowCallback) {
  // 統計結果を非表示にする
  hide('yieldStatsResults');

  // 外れ値の除外状態をリセット
  if (window.yieldStatsState) {
    window.yieldStatsState.manuallyExcludedOutlierIndices.clear();
    window.yieldStatsState.currentOutlierValues = [];
    window.yieldStatsState.currentDisplayType = '';
  }

  // テーブルが空の場合のみ初期行を追加
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (tbody && tbody.querySelectorAll('.yield-stats-row').length === 0) {
    yieldStatsEntryCounter = 0;
    if (addYieldStatsRowCallback) {
      addYieldStatsRowCallback();
    }
  }
}

/**
 * 歩留まり率統計モード: 新しい行を追加
 *
 * @param {Object} callbacks - コールバック関数のオブジェクト
 * @param {Function} callbacks.updateYieldStatsStatistics - 統計更新コールバック
 * @param {Function} callbacks.updateSaveButtonsVisibility - 保存ボタン更新コールバック
 */
export function addYieldStatsRow(callbacks = {}) {
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
          compactYieldStatsRows(callbacks);
        } else {
          // 1行しかない場合は統計を非表示
          if (callbacks.updateYieldStatsStatistics) {
            callbacks.updateYieldStatsStatistics();
          }
        }
      }, 100);
      return;
    }

    // どちらか片方だけ入力されている場合はエラー表示
    if ((hasBeforeWeight && !hasAfterWeight) || (!hasBeforeWeight && hasAfterWeight)) {
      yieldRateDisplay.textContent = 'エラー';
      yieldRateDisplay.classList.add('error');
      yieldRateDisplay.classList.remove('calculated');
      if (callbacks.updateYieldStatsStatistics) {
        callbacks.updateYieldStatsStatistics();
      }
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
          addYieldStatsRow(callbacks);
        }

        // 統計情報を更新
        if (callbacks.updateYieldStatsStatistics) {
          callbacks.updateYieldStatsStatistics();
        }
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
  appState.markAsChanged();
  if (callbacks.updateSaveButtonsVisibility) {
    callbacks.updateSaveButtonsVisibility();
  }
}

/**
 * 歩留まり率統計モード: 空行を上詰めする
 *
 * @param {Object} callbacks - コールバック関数のオブジェクト
 */
export function compactYieldStatsRows(callbacks = {}) {
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
      addYieldStatsRow(callbacks);
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
      addYieldStatsRow(callbacks);
    }
  } else {
    // データがない場合は1行追加
    addYieldStatsRow(callbacks);
  }

  // 統計情報を更新
  if (callbacks.updateYieldStatsStatistics) {
    callbacks.updateYieldStatsStatistics();
  }
}

/**
 * 歩留まり率統計モード: テーブルデータを復元
 *
 * @param {Array} tableData - 保存されたテーブルデータ
 * @param {Object} callbacks - コールバック関数のオブジェクト
 */
export function restoreYieldStatsTable(tableData, callbacks = {}) {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // テーブルをリセット
  yieldStatsEntryCounter = 0;
  tbody.innerHTML = '';

  // データがない場合は1行だけ追加
  if (!tableData || tableData.length === 0) {
    addYieldStatsRow(callbacks);
    return;
  }

  // 保存されたデータから行を再構築
  tableData.forEach(rowData => {
    addYieldStatsRow(callbacks);
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
    addYieldStatsRow(callbacks);
  }

  // 状態を更新：履歴から読み込まれた
  if (window.yieldStatsState) {
    window.yieldStatsState.isFromHistory = true;
    window.yieldStatsState.isCalculated = true;
  }

  // 統計情報を更新（DOMの更新が完全に反映されるのを待つ）
  setTimeout(() => {
    if (callbacks.updateYieldStatsStatistics) {
      callbacks.updateYieldStatsStatistics();
    }
  }, 50);
}

/**
 * 歩留まり率統計モード: 統計情報を更新
 *
 * @param {Function} displayCurrentStatisticsCallback - 統計表示コールバック
 */
export function updateYieldStatsStatistics(displayCurrentStatisticsCallback) {
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
              judgment = '✓ 非常に良好';
              judgmentColor = '#1b5e20'; // 濃い緑
            } else if (absDeviation <= toleranceError) {
              judgment = '○ 良好';
              judgmentColor = '#388e3c'; // 緑
            } else if (absDeviation <= toleranceError * 2) {
              judgment = '△ 許容範囲';
              judgmentColor = '#f57c00'; // オレンジ
            } else if (absDeviation <= toleranceError * 2.67) {
              judgment = '! 要注意';
              judgmentColor = '#e64a19'; // 赤オレンジ
            } else {
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
    if (displayCurrentStatisticsCallback) {
      displayCurrentStatisticsCallback();
    }
  } else {
    hide('yieldStatsResults');
  }
}
