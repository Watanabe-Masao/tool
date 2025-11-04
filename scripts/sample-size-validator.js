/**
 * サンプルサイズ検証モジュール
 * 統計的妥当性の判定とビジュアルフィードバック
 * UX改善：プログレスバー、視覚的インジケーター、親切なメッセージ
 */

import { qs } from './dom-utils.js';
import { calculateStatistics, detectOutliers } from './yield-stats-calc.js';
import { calculateRequiredSampleSize, getConfidenceMessage } from './yield-stats-helpers.js';
import { appState } from './state.js';

/**
 * サンプルサイズの妥当性を検証・表示（UX改善版）
 * @param {Function} displayOutlierCallback - 外れ値表示コールバック
 * @param {Function} displayRecommendedCallback - 推奨値表示コールバック
 * @param {Set} manuallyExcludedIndices - 手動除外インデックス
 * @param {Array} currentOutliers - 現在の外れ値リスト
 * @returns {Object} 検証結果 {isValid, actualSize, requiredSize, stats}
 */
export function displaySampleSizeValidation(
  displayOutlierCallback,
  displayRecommendedCallback,
  manuallyExcludedIndices,
  currentOutliers
) {
  const toleranceErrorInput = qs('#toleranceError');
  const confidenceLevelSelect = qs('#confidenceLevel');
  const resultDiv = qs('#sampleSizeResult');

  if (!toleranceErrorInput || !confidenceLevelSelect || !resultDiv) {
    return null;
  }

  const toleranceError = parseFloat(toleranceErrorInput.value);

  // 入力値が無効な場合は結果を非表示
  if (!toleranceError || toleranceError <= 0) {
    resultDiv.style.transition = 'opacity 0.3s ease-out';
    resultDiv.style.opacity = '0';
    setTimeout(() => {
      resultDiv.classList.add('is-hidden');
      resultDiv.style.opacity = '';
    }, 300);
    return null;
  }

  // 現在の統計データを取得
  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';

  const data = appState.getYieldStatsData();
  if (!data) {
    resultDiv.classList.add('is-hidden');
    return null;
  }

  const values = data[statsType];
  if (!values || values.length === 0) {
    resultDiv.classList.add('is-hidden');
    return null;
  }

  // 統計値を計算
  const stats = calculateStatistics(values);
  const confidenceLevel = parseInt(confidenceLevelSelect.value);

  // 外れ値を検出
  const outlierResult = detectOutliers(values, stats);

  // 手動除外された外れ値を反映したデータを計算
  let finalValues = values;
  let finalStats = stats;

  if (manuallyExcludedIndices && manuallyExcludedIndices.size > 0 && currentOutliers && currentOutliers.length > 0) {
    // 手動除外する外れ値のセットを作成
    const excludedValues = new Set();
    manuallyExcludedIndices.forEach(index => {
      if (index < currentOutliers.length) {
        excludedValues.add(currentOutliers[index]);
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

  // プログレスバーで視覚的に表示
  displaySampleSizeProgress(actualSampleSize, requiredSampleSize, isValid);

  // 結果を表示（アニメーション付き）
  const actualSampleSizeSpan = qs('#actualSampleSize');
  const requiredSampleSizeSpan = qs('#requiredSampleSize');
  const validityBadge = qs('#validityJudgment');
  const validityExplanation = qs('#validityExplanation');

  if (actualSampleSizeSpan) {
    actualSampleSizeSpan.textContent = actualSampleSize;
    actualSampleSizeSpan.style.animation = 'countUp 0.5s ease-out';
  }

  if (requiredSampleSizeSpan) {
    requiredSampleSizeSpan.textContent = requiredSampleSize;
    requiredSampleSizeSpan.style.animation = 'countUp 0.5s ease-out';
  }

  if (validityBadge) {
    if (isValid) {
      validityBadge.textContent = '✓ 妥当';
      validityBadge.className = 'validity-badge valid';
    } else {
      validityBadge.textContent = '[警告]  不十分';
      validityBadge.className = 'validity-badge invalid';
    }
    validityBadge.style.animation = 'pulse 0.5s ease-in-out';
  }

  if (validityExplanation) {
    if (isValid) {
      const surplus = actualSampleSize - requiredSampleSize;
      const percentage = Math.round((actualSampleSize / requiredSampleSize) * 100);
      validityExplanation.innerHTML = `
        <span class="success-icon">✓</span>
        実際のサンプル数が必要数を<strong class="highlight">${surplus}個</strong>上回っており（${percentage}%達成）、<br>
        統計的に<strong>十分なデータ量</strong>です。信頼性の高い分析が可能です。
      `;
      validityExplanation.className = 'validity-explanation success';
    } else {
      const shortage = requiredSampleSize - actualSampleSize;
      const percentage = Math.round((actualSampleSize / requiredSampleSize) * 100);
      validityExplanation.innerHTML = `
        <span class="warning-icon">[警告] </span>
        実際のサンプル数が必要数より<strong class="highlight">${shortage}個</strong>不足しています（${percentage}%達成）。<br>
        <strong>より多くのデータを収集</strong>することを推奨します。
      `;
      validityExplanation.className = 'validity-explanation warning';
    }
  }

  // 信頼度メッセージを表示（視覚的改善）
  const confidenceMessageDiv = qs('#confidenceMessage');
  if (confidenceMessageDiv) {
    const confidenceInfo = getConfidenceMessage(toleranceError);
    confidenceMessageDiv.innerHTML = `
      <span class="confidence-icon">${confidenceInfo.className === 'excellent' ? '🌟' : confidenceInfo.className === 'good' ? '✓' : confidenceInfo.className === 'fair' ? '⚡' : '[警告] '}</span>
      ${confidenceInfo.message}
    `;
    confidenceMessageDiv.className = `confidence-message ${confidenceInfo.className}`;
  }

  // 外れ値を検出して表示
  if (displayOutlierCallback) {
    displayOutlierCallback(outlierResult, statsType, isValid);
  }

  // 推奨代表値を表示（サンプルサイズが妥当な場合のみ）
  if (finalValues.length >= 2) {
    window.lastCalculatedStats = finalStats;
    if (displayRecommendedCallback) {
      displayRecommendedCallback(finalStats, isValid, statsType);
    }
  } else {
    window.lastCalculatedStats = stats;
    if (displayRecommendedCallback) {
      displayRecommendedCallback(stats, isValid, statsType);
    }
  }

  // 結果を表示（スムーズなアニメーション）
  resultDiv.classList.remove('is-hidden');
  resultDiv.style.opacity = '0';
  setTimeout(() => {
    resultDiv.style.transition = 'opacity 0.5s ease-in';
    resultDiv.style.opacity = '1';
  }, 10);

  return {
    isValid,
    actualSize: actualSampleSize,
    requiredSize: requiredSampleSize,
    stats: finalStats
  };
}

/**
 * サンプルサイズをプログレスバーで視覚化
 * @param {number} actual - 実際のサンプル数
 * @param {number} required - 必要なサンプル数
 * @param {boolean} isValid - 妥当性
 */
function displaySampleSizeProgress(actual, required, isValid) {
  let progressContainer = qs('#sampleSizeProgressBar');

  // プログレスバーがなければ作成
  if (!progressContainer) {
    const resultDiv = qs('#sampleSizeResult');
    if (!resultDiv) return;

    progressContainer = document.createElement('div');
    progressContainer.id = 'sampleSizeProgressBar';
    progressContainer.className = 'sample-size-progress-container';
    progressContainer.innerHTML = `
      <div class="progress-label">
        <span>サンプル数の充足度</span>
        <span class="progress-percentage">0%</span>
      </div>
      <div class="progress-bar-wrapper">
        <div class="progress-bar-track">
          <div class="progress-bar-fill"></div>
        </div>
      </div>
    `;

    // スタイルを追加
    const style = document.createElement('style');
    style.textContent = `
      .sample-size-progress-container {
        margin: 16px 0;
        padding: 16px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .progress-label {
        display: flex;
        justify-content: space-between;
        margin-bottom: 8px;
        font-size: 14px;
        color: #495057;
      }
      .progress-percentage {
        font-weight: bold;
        color: #212529;
      }
      .progress-bar-wrapper {
        position: relative;
        height: 24px;
      }
      .progress-bar-track {
        width: 100%;
        height: 100%;
        background: #e9ecef;
        border-radius: 12px;
        overflow: hidden;
      }
      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
        transition: width 0.8s ease-out;
        border-radius: 12px;
      }
      .progress-bar-fill.warning {
        background: linear-gradient(90deg, #ffc107 0%, #ff9800 100%);
      }
      .progress-bar-fill.danger {
        background: linear-gradient(90deg, #dc3545 0%, #e74c3c 100%);
      }
    `;
    document.head.appendChild(style);

    // 最初の子要素として挿入
    resultDiv.insertBefore(progressContainer, resultDiv.firstChild);
  }

  // パーセンテージを計算
  const percentage = Math.min(Math.round((actual / required) * 100), 100);

  // プログレスバーを更新
  const fillBar = progressContainer.querySelector('.progress-bar-fill');
  const percentageSpan = progressContainer.querySelector('.progress-percentage');

  if (fillBar && percentageSpan) {
    fillBar.style.width = `${percentage}%`;

    // 色を変更
    fillBar.classList.remove('warning', 'danger');
    if (percentage < 70) {
      fillBar.classList.add('danger');
    } else if (percentage < 100) {
      fillBar.classList.add('warning');
    }

    // パーセンテージをアニメーションで表示
    let currentPercentage = 0;
    const interval = setInterval(() => {
      currentPercentage += Math.ceil(percentage / 20);
      if (currentPercentage >= percentage) {
        currentPercentage = percentage;
        clearInterval(interval);
      }
      percentageSpan.textContent = `${currentPercentage}%`;
    }, 30);
  }
}

/**
 * サンプルサイズ検証結果をリセット
 */
export function resetSampleSizeValidation() {
  const resultDiv = qs('#sampleSizeResult');
  if (resultDiv) {
    resultDiv.classList.add('is-hidden');
  }

  const progressContainer = qs('#sampleSizeProgressBar');
  if (progressContainer) {
    progressContainer.remove();
  }
}
