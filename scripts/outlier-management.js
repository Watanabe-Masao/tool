/**
 * 外れ値管理モジュール
 * 外れ値の検出、表示、除外、削除を管理
 * UX改善：ローディング表示、アニメーション、視覚的フィードバック
 */

import { qs, qsa, pct, toFixed } from './dom-utils.js';
import { UI_ELEMENTS, YIELD_STATS_FIELDS } from './constants.js';

// 外れ値の状態管理
let currentOutlierValues = [];
let manuallyExcludedOutlierIndices = new Set();

/**
 * 外れ値状態の初期化
 */
export function initializeOutlierState() {
  currentOutlierValues = [];
  manuallyExcludedOutlierIndices = new Set();
}

/**
 * 現在の外れ値リストを取得
 */
export function getCurrentOutlierValues() {
  return [...currentOutlierValues];
}

/**
 * 手動除外インデックスを取得
 */
export function getManuallyExcludedIndices() {
  return new Set(manuallyExcludedOutlierIndices);
}

/**
 * 手動除外インデックスを設定
 */
export function setManuallyExcludedIndices(indices) {
  manuallyExcludedOutlierIndices = new Set(indices);
}

/**
 * 外れ値情報を表示（UX改善版）
 * @param {Object} outlierResult - 外れ値検出結果
 * @param {string} statsType - 統計タイプ
 * @param {boolean} isSampleSizeValid - サンプルサイズが有効か
 * @param {Function} onReCalculate - 再計算コールバック
 */
export function displayOutlierInfo(outlierResult, statsType, isSampleSizeValid, onReCalculate) {
  const outlierInfoDiv = qs('#outlierInfo');
  const outlierCount = qs('#outlierCount');
  const outlierRange = qs('#outlierRange');
  const outlierRecommendation = qs('#outlierRecommendation');
  const outlierCheckboxList = qs('#outlierCheckboxList');

  if (!outlierInfoDiv) {
    return;
  }

  // 外れ値がない場合は非表示（スムーズなアニメーション）
  if (outlierResult.outliers.length === 0) {
    outlierInfoDiv.style.transition = 'opacity 0.3s ease-out';
    outlierInfoDiv.style.opacity = '0';
    setTimeout(() => {
      outlierInfoDiv.classList.add('is-hidden');
      outlierInfoDiv.style.opacity = '';
    }, 300);

    manuallyExcludedOutlierIndices.clear();
    currentOutlierValues = [];
    highlightOutlierRows(statsType);
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

  // 外れ値の件数（視覚的フィードバック）
  if (outlierCount) {
    outlierCount.textContent = `${outlierResult.outliers.length}件`;
    outlierCount.style.animation = 'pulse 0.5s ease-in-out';
    setTimeout(() => {
      outlierCount.style.animation = '';
    }, 500);
  }

  // 正常範囲
  if (outlierRange) {
    const lowerBound = formatValue(outlierResult.lowerBound);
    const upperBound = formatValue(outlierResult.upperBound);
    outlierRange.textContent = `${lowerBound} ～ ${upperBound}`;
  }

  // チェックボックスリストを生成（アクセシビリティ改善）
  if (outlierCheckboxList) {
    outlierCheckboxList.innerHTML = '';

    outlierResult.outliers.forEach((outlierValue, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'outlier-checkbox-item';
      itemDiv.style.animation = `slideIn 0.3s ease-out ${index * 0.05}s both`;

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `outlier-${index}`;
      checkbox.dataset.index = index;
      checkbox.checked = manuallyExcludedOutlierIndices.has(index);
      checkbox.setAttribute('aria-label', `外れ値 ${formatValue(outlierValue)} を除外`);

      checkbox.addEventListener('change', () => {
        // 視覚的フィードバック
        itemDiv.style.transform = 'scale(1.05)';
        setTimeout(() => {
          itemDiv.style.transform = '';
        }, 200);

        handleOutlierCheckboxChange(onReCalculate);
      });

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

  // 推奨メッセージ（より親切な表現）
  if (outlierRecommendation) {
    const totalCount = outlierResult.outliers.length + outlierResult.cleanedValues.length;

    if (manuallyExcludedCount > 0) {
      outlierRecommendation.innerHTML = `
        <span class="recommendation-icon">✓</span>
        <strong>${outlierResult.outliers.length}件の外れ値を検出。</strong><br>
        現在<strong class="highlight">${manuallyExcludedCount}件</strong>を除外設定中です。<br>
        除外後は<strong>${remainingDataCount}件のデータ</strong>（元データ${totalCount}件中）で統計分析を行います。
      `;
      outlierRecommendation.className = 'outlier-recommendation success';
    } else if (remainingDataCount >= 2) {
      outlierRecommendation.innerHTML = `
        <span class="recommendation-icon">[警告] </span>
        <strong>${outlierResult.outliers.length}件の外れ値が検出されました。</strong><br>
        チェックボックスで除外する外れ値を選択してください。<br>
        除外後のデータで統計分析を行うことを<strong>推奨</strong>します。
      `;
      outlierRecommendation.className = 'outlier-recommendation warning';
    } else {
      outlierRecommendation.innerHTML = `
        <span class="recommendation-icon">[エラー] </span>
        <strong>${outlierResult.outliers.length}件の外れ値が検出されました。</strong><br>
        除外後のデータが不足する可能性があります。<br>
        データの見直しをお勧めします。
      `;
      outlierRecommendation.className = 'outlier-recommendation error';
    }
  }

  // 外れ値情報を表示（スムーズな表示）
  outlierInfoDiv.classList.remove('is-hidden');
  outlierInfoDiv.style.opacity = '0';
  setTimeout(() => {
    outlierInfoDiv.style.transition = 'opacity 0.3s ease-in';
    outlierInfoDiv.style.opacity = '1';
  }, 10);

  // 外れ値を含む行をハイライト
  highlightOutlierRows(statsType);
}

/**
 * 外れ値チェックボックスの変更を処理
 * @param {Function} onReCalculate - 再計算コールバック
 */
export function handleOutlierCheckboxChange(onReCalculate) {
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
  if (onReCalculate) {
    onReCalculate();
  }
}

/**
 * 外れ値を含む行をハイライト表示（UX改善版）
 * @param {string} statsType - 統計タイプ
 */
export function highlightOutlierRows(statsType) {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // まず全ての行とセルからハイライトを削除（スムーズなトランジション）
  const allRows = tbody.querySelectorAll('.yield-stats-row');
  allRows.forEach(row => {
    row.classList.remove('has-outlier');
    // セルからも外れ値クラスを削除
    const cells = row.querySelectorAll('.outlier-cell');
    cells.forEach(cell => cell.classList.remove('outlier-cell'));
  });

  // 外れ値が検出されていない場合は終了
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    return;
  }

  // 各行の値をチェックして外れ値を含む行をハイライト
  allRows.forEach((row, index) => {
    const rowId = row.dataset.rowId;
    let shouldHighlight = false;
    let outlierCell = null;

    if (statsType === 'yieldRate') {
      // 歩留まり率をチェック
      const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}`);
      if (yieldRateDisplay && yieldRateDisplay.classList.contains('calculated')) {
        const rateText = yieldRateDisplay.textContent.replace('%', '');
        const rate = parseFloat(rateText);
        if (!isNaN(rate) && isOutlierValue(rate)) {
          shouldHighlight = true;
          outlierCell = yieldRateDisplay;
        }
      }
    } else if (statsType === 'beforeWeight') {
      // 加工前重量をチェック
      const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
      if (beforeInput && beforeInput.value.trim() !== '') {
        const beforeWeight = parseFloat(beforeInput.value);
        if (!isNaN(beforeWeight) && isOutlierValue(beforeWeight)) {
          shouldHighlight = true;
          outlierCell = beforeInput;
        }
      }
    } else if (statsType === 'afterWeight') {
      // 加工後重量をチェック
      const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);
      if (afterInput && afterInput.value.trim() !== '') {
        const afterWeight = parseFloat(afterInput.value);
        if (!isNaN(afterWeight) && isOutlierValue(afterWeight)) {
          shouldHighlight = true;
          outlierCell = afterInput;
        }
      }
    }

    if (shouldHighlight) {
      // アニメーションで表示
      setTimeout(() => {
        row.classList.add('has-outlier');

        // 外れ値のセルに特別なクラスを追加
        if (outlierCell) {
          outlierCell.classList.add('outlier-cell');

          // 外れ値のセルにツールチップを追加
          outlierCell.setAttribute('title', '[警告]  この値は外れ値として検出されました');
        }
      }, index * 30);
    }
  });
}

/**
 * 値が外れ値リストに含まれているかをチェック
 * @param {number} value - チェックする値
 * @returns {boolean} - 外れ値の場合true
 */
export function isOutlierValue(value) {
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    return false;
  }

  // 浮動小数点数の比較のため、非常に小さい差を許容
  return currentOutlierValues.some(outlierValue =>
    Math.abs(value - outlierValue) < 0.0001
  );
}

/**
 * 外れ値を含む行をテーブルから削除（UX改善版）
 * @param {string} statsType - 統計タイプ
 * @param {Function} onComplete - 完了コールバック
 */
export function deleteOutlierRows(statsType, onComplete) {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // 外れ値が検出されていない場合は何もしない
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    showNotification('削除する外れ値がありません。', 'info');
    return;
  }

  // 確認ダイアログを表示（より詳細な情報）
  const statsTypeName = statsType === 'yieldRate' ? '歩留まり率' :
                       statsType === 'beforeWeight' ? '加工前重量' : '加工後重量';

  const confirmMessage = `${statsTypeName}に外れ値を含む行をテーブルから削除します。\n\n[警告]  削除した行は元に戻せません。\n\n削除する外れ値の数: ${currentOutlierValues.length}件\n\n本当に削除しますか？`;

  if (!confirm(confirmMessage)) {
    return;
  }

  // ローディング表示
  showLoadingOverlay('外れ値を含む行を削除しています...');

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

  // アニメーションで行を削除
  let deleteCount = 0;
  rowsToDelete.forEach((row, index) => {
    setTimeout(() => {
      row.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
      row.style.opacity = '0';
      row.style.transform = 'translateX(-20px)';

      setTimeout(() => {
        row.remove();
        deleteCount++;

        // 全て削除完了したら
        if (deleteCount === rowsToDelete.length) {
          hideLoadingOverlay();

          // 外れ値状態をクリア
          manuallyExcludedOutlierIndices.clear();
          currentOutlierValues = [];

          // 成功メッセージ
          showNotification(`${deleteCount}件の外れ値を含む行を削除しました。`, 'success');

          // コールバック実行
          if (onComplete) {
            onComplete();
          }
        }
      }, 300);
    }, index * 100);
  });
}

/**
 * ローディングオーバーレイを表示
 * @param {string} message - 表示メッセージ
 */
function showLoadingOverlay(message) {
  let overlay = qs('#loadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'loadingOverlay';
    overlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">${message}</div>
    `;
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      color: white;
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

/**
 * ローディングオーバーレイを非表示
 */
function hideLoadingOverlay() {
  const overlay = qs('#loadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

/**
 * 通知メッセージを表示
 * @param {string} message - メッセージ
 * @param {string} type - タイプ (success, error, warning, info)
 */
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 16px 24px;
    background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196f3'};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10001;
    animation: slideInRight 0.3s ease-out;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.transition = 'opacity 0.3s ease-out';
    notification.style.opacity = '0';
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 3000);
}
