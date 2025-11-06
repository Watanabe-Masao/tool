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
import { debounce } from './debounce.js';

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
 * テーブルの全行番号を更新（相対値1,2,3...に）
 */
export function updateRowNumbers() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  const allRows = tbody.querySelectorAll('.yield-stats-row');
  allRows.forEach((row, index) => {
    const rowNumberCell = row.querySelector('.row-number');
    if (rowNumberCell) {
      rowNumberCell.textContent = index + 1; // 1-based行番号
    }
  });
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
  appState.clearExcludedOutliers();
  appState.setCurrentDisplayType('yieldRate');

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
    <td class="row-number">1</td>
    <td>
      <input type="number"
             id="${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}"
             class="table-input before-weight-input"
             step="0.01"
             inputmode="decimal"
             placeholder="300"
             data-row-id="${rowId}" />
    </td>
    <td>
      <input type="number"
             id="${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}"
             class="table-input after-weight-input"
             step="0.01"
             inputmode="decimal"
             placeholder="150"
             data-row-id="${rowId}" />
    </td>
    <td class="yield-result yield-rate-display" id="${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}">-</td>
    <td class="z-score z-score-display" id="zScore${rowId}">-</td>
    <td class="confidence-judgment confidence-judgment-display" id="confidenceJudgment${rowId}">-</td>
  `;

  tbody.appendChild(row);

  // 行番号を更新（相対値に）
  updateRowNumbers();

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

  // デバウンスを適用して入力パフォーマンスを向上
  const debouncedHandleInput = debounce(handleYieldStatsInput, 300);
  beforeWeightInput?.addEventListener('input', debouncedHandleInput);
  afterWeightInput?.addEventListener('input', debouncedHandleInput);

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
    // 配列ベース管理: rowから直接inputを取得
    const beforeInput = row.querySelector('.before-weight-input');
    const afterInput = row.querySelector('.after-weight-input');

    const hasBeforeWeight = beforeInput && beforeInput.value.trim() !== '';
    const hasAfterWeight = afterInput && afterInput.value.trim() !== '';

    // 両方のフィールドに値がある行だけを残す（上詰め処理）
    if (hasBeforeWeight && hasAfterWeight) {
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
      // 配列ベース管理: 最後に追加した行から直接inputを取得
      const allNewRows = tbody.querySelectorAll('.yield-stats-row');
      const lastRow = allNewRows[allNewRows.length - 1];
      const beforeInput = lastRow.querySelector('.before-weight-input');
      const afterInput = lastRow.querySelector('.after-weight-input');

      beforeInput.value = rowData.beforeValue;
      afterInput.value = rowData.afterValue;

      // 計算を直接実行（イベント発火ではなく）
      const hasBeforeWeight = rowData.beforeValue.trim() !== '';
      const hasAfterWeight = rowData.afterValue.trim() !== '';
      const yieldRateDisplay = lastRow.querySelector('.yield-rate-display');

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

  // 行番号を更新（相対値に）
  updateRowNumbers();

  // 統計情報を更新
  if (callbacks.updateYieldStatsStatistics) {
    callbacks.updateYieldStatsStatistics();
  }
}

/**
 * テーブルに入力データがあるかチェック
 *
 * @returns {boolean} データがある場合true
 */
export function checkIfTableHasData() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return false;

  const rows = tbody.querySelectorAll('.yield-stats-row');
  for (const row of rows) {
    const beforeInput = row.querySelector('.before-weight-input');
    const afterInput = row.querySelector('.after-weight-input');

    if ((beforeInput && beforeInput.value.trim() !== '') ||
        (afterInput && afterInput.value.trim() !== '')) {
      return true;
    }
  }

  return false;
}

/**
 * 歩留まり率統計モード: テーブルデータを追加（既存データを保持）
 *
 * @param {Array} tableData - 追加するテーブルデータ
 * @param {Object} callbacks - コールバック関数のオブジェクト
 */
export function appendYieldStatsTable(tableData, callbacks = {}) {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody || !tableData || tableData.length === 0) {
    return;
  }

  // カウンターはリセットしない（既存の行を保持）
  // 空行を削除してから追加
  compactYieldStatsRows(callbacks);

  // データから行を追加
  tableData.forEach((rowData, index) => {
    addYieldStatsRow(callbacks);

    // 配列ベース管理: 最後に追加した行から直接inputを取得
    const allRows = tbody.querySelectorAll('.yield-stats-row');
    const lastRow = allRows[allRows.length - 1];
    const beforeInput = lastRow.querySelector('.before-weight-input');
    const afterInput = lastRow.querySelector('.after-weight-input');

    if (beforeInput && rowData.beforeWeight !== undefined && rowData.beforeWeight !== null) {
      beforeInput.value = rowData.beforeWeight;
    }
    if (afterInput && rowData.afterWeight !== undefined && rowData.afterWeight !== null) {
      afterInput.value = rowData.afterWeight;
    }

    // 歩留まり率を計算して表示
    const beforeWeight = beforeInput ? beforeInput.value.trim() : '';
    const afterWeight = afterInput ? afterInput.value.trim() : '';
    const yieldRateDisplay = lastRow.querySelector('.yield-rate-display');

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
  appState.setYieldStatsFromHistory(true);
  appState.setYieldStatsCalculated(true);

  // 行番号を更新（相対値に）
  updateRowNumbers();

  // 統計情報を更新（DOMの更新が完全に反映されるのを待つ）
  setTimeout(() => {
    if (callbacks.updateYieldStatsStatistics) {
      callbacks.updateYieldStatsStatistics();
    }
  }, 50);
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
  appState.setYieldStatsFromHistory(true);
  appState.setYieldStatsCalculated(true);

  // 行番号を更新（相対値に）
  updateRowNumbers();

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
    // 配列ベース管理: rowから直接要素を取得
    const beforeInput = row.querySelector('.before-weight-input');
    const afterInput = row.querySelector('.after-weight-input');
    const yieldRateDisplay = row.querySelector('.yield-rate-display');

    // 歩留まり率
    if (yieldRateDisplay && yieldRateDisplay.classList.contains('calculated')) {
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

    // 各行のz-scoreを計算して表示
    const avgYield = stats.mean;
    const stdDevYield = stats.stdDev;

    allRows.forEach(row => {
      // 配列ベース管理: rowから直接要素を取得
      const yieldRateDisplay = row.querySelector('.yield-rate-display');
      const zScoreDisplay = row.querySelector('.z-score-display');
      const confidenceJudgmentDisplay = row.querySelector('.confidence-judgment-display');

      if (yieldRateDisplay && yieldRateDisplay.classList.contains('calculated') && zScoreDisplay) {
        const rateText = yieldRateDisplay.textContent.replace('%', '');
        const rate = parseFloat(rateText);

        if (!isNaN(rate) && avgYield > 0 && stdDevYield > 0) {
          // z-score = (個別値 - 平均) / 標準偏差
          const zScore = (rate - avgYield) / stdDevYield;
          const absZScore = Math.abs(zScore);

          // z-scoreの表示（±記号付き、小数第2位まで）
          let displayText = `${toFixed(zScore, 2)}σ`;

          // 確率的な説明を追加
          if (absZScore <= 1) {
            displayText += ` (68%範囲内)`;
            zScoreDisplay.style.color = '#1b5e20'; // 濃い緑
          } else if (absZScore <= 2) {
            displayText += ` (95%範囲内)`;
            zScoreDisplay.style.color = '#388e3c'; // 緑
          } else if (absZScore <= 3) {
            displayText += ` (99.7%範囲内)`;
            zScoreDisplay.style.color = '#f57c00'; // オレンジ
          } else {
            displayText += ` (外れ値の可能性)`;
            zScoreDisplay.style.color = '#c62828'; // 赤
          }

          zScoreDisplay.textContent = displayText;

          // 判定（z-scoreベース）
          if (confidenceJudgmentDisplay) {
            let judgment = '';
            let judgmentColor = '';

            if (absZScore <= 1) {
              judgment = '✓✓';
              judgmentColor = '#1b5e20'; // 濃い緑
            } else if (absZScore <= 2) {
              judgment = '○';
              judgmentColor = '#388e3c'; // 緑
            } else if (absZScore <= 3) {
              judgment = '△';
              judgmentColor = '#f57c00'; // オレンジ
            } else {
              judgment = '×';
              judgmentColor = '#c62828'; // 赤
            }

            confidenceJudgmentDisplay.textContent = judgment;
            confidenceJudgmentDisplay.style.color = judgmentColor;
            confidenceJudgmentDisplay.style.fontWeight = 'bold';
          }
        } else {
          zScoreDisplay.textContent = '-';
          zScoreDisplay.style.color = '';
          if (confidenceJudgmentDisplay) {
            confidenceJudgmentDisplay.textContent = '-';
            confidenceJudgmentDisplay.style.color = '';
            confidenceJudgmentDisplay.style.fontWeight = '';
          }
        }
      } else if (zScoreDisplay) {
        zScoreDisplay.textContent = '-';
        zScoreDisplay.style.color = '';
        if (confidenceJudgmentDisplay) {
          confidenceJudgmentDisplay.textContent = '-';
          confidenceJudgmentDisplay.style.color = '';
          confidenceJudgmentDisplay.style.fontWeight = '';
        }
      }
    });
  } else {
    // データが不足している場合はz-scoreと判定をクリア
    allRows.forEach(row => {
      // 配列ベース管理: rowから直接要素を取得
      const zScoreDisplay = row.querySelector('.z-score-display');
      const confidenceJudgmentDisplay = row.querySelector('.confidence-judgment-display');

      if (zScoreDisplay) {
        zScoreDisplay.textContent = '-';
        zScoreDisplay.style.color = '';
      }
      if (confidenceJudgmentDisplay) {
        confidenceJudgmentDisplay.textContent = '-';
        confidenceJudgmentDisplay.style.color = '';
        confidenceJudgmentDisplay.style.fontWeight = '';
      }
    });
  }

  // AppStateに保存
  appState.setYieldStatsRawData(yieldStatsData);

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
