/**
 * 歩留まり統計: サンプルサイズ検証モジュール
 *
 * サンプルサイズの妥当性検証と外れ値の表示・管理を担当します。
 * UX改善: プログレスバー、カウントアップアニメーション、カラーコーディング
 *
 * 注: このモジュールはcore.jsと循環依存関係にありますが、
 * handleOutlierCheckboxChangeはイベントハンドラーとしてのみ使用されるため、
 * モジュールロード時には問題ありません。
 */

import { logger } from '../core/logger.js';
import { qs, qsa, toFixed, pct } from '../dom-utils.js';
import { appState } from '../state.js';
import { calculateStatistics, detectOutliers } from '../yield-stats-calc.js';
import { getConfidenceMessage, calculateRequiredSampleSize } from '../yield-stats-helpers.js';
import { highlightOutlierRows, isOutlierValue } from '../outlier-management.js';
import { displayRecommendedValue } from './recommended.js';
import { updateLoadStatsButtons } from './buttons.js';
import { handleOutlierCheckboxChange } from './core.js';

/**
 * サンプルサイズ妥当性を表示（UX改善版: プログレスバー、カウントアップアニメーション付き）
 */
export function displaySampleSizeValidation() {
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

  const data = appState.getYieldStatsRawData();
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

  const manuallyExcludedIndices = appState.getManuallyExcludedOutlierIndices();
  const currentOutliers = appState.getCurrentOutlierValues();

  if (manuallyExcludedIndices.size > 0 && currentOutliers.length > 0) {
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

  // 結果を表示（UX改善: プログレスバーとアニメーション付き）
  const actualSampleSizeSpan = qs('#actualSampleSize');
  const requiredSampleSizeSpan = qs('#requiredSampleSize');
  const validityBadge = qs('#validityJudgment');
  const validityExplanation = qs('#validityExplanation');

  // プログレスバーを追加または更新
  let progressContainer = qs('#sampleSizeProgressContainer');
  if (!progressContainer) {
    progressContainer = document.createElement('div');
    progressContainer.id = 'sampleSizeProgressContainer';
    progressContainer.style.cssText = 'margin: 1em 0; padding: 0.8em; background: #f8f9fa; border-radius: 4px;';

    // actualSampleSize の親要素の後に挿入
    const firstResultRow = actualSampleSizeSpan?.closest('.result-row');
    if (firstResultRow && firstResultRow.nextElementSibling) {
      firstResultRow.nextElementSibling.insertAdjacentElement('beforebegin', progressContainer);
    }
  }

  // プログレスバーのパーセンテージを計算
  const percentage = Math.min(Math.round((actualSampleSize / requiredSampleSize) * 100), 100);

  // プログレスバーのHTML生成
  progressContainer.innerHTML = `
    <div style="display: flex; justify-content: space-between; margin-bottom: 0.5em; font-size: 0.9em;">
      <span style="font-weight: 500;">サンプル数の充足度</span>
      <span id="progressPercentage" style="font-weight: bold; color: ${isValid ? '#2ecc71' : percentage < 70 ? '#e74c3c' : '#f39c12'};">0%</span>
    </div>
    <div style="width: 100%; height: 20px; background: #e0e0e0; border-radius: 10px; overflow: hidden; position: relative;">
      <div id="progressBar" style="height: 100%; background: linear-gradient(90deg, ${isValid ? '#2ecc71, #27ae60' : percentage < 70 ? '#e74c3c, #c0392b' : '#f39c12, #e67e22'}); width: 0%; transition: width 1s ease-out; border-radius: 10px;"></div>
    </div>
  `;

  // アニメーション付きでプログレスバーを伸ばす
  setTimeout(() => {
    const progressBar = qs('#progressBar');
    const progressPercentageSpan = qs('#progressPercentage');
    if (progressBar) {
      progressBar.style.width = `${percentage}%`;
    }

    // パーセンテージをカウントアップアニメーション
    if (progressPercentageSpan) {
      let currentPercentage = 0;
      const increment = Math.ceil(percentage / 20);
      const interval = setInterval(() => {
        currentPercentage += increment;
        if (currentPercentage >= percentage) {
          currentPercentage = percentage;
          clearInterval(interval);
        }
        progressPercentageSpan.textContent = `${currentPercentage}%`;
      }, 50);
    }
  }, 100);

  // 数値をアニメーション付きで表示
  if (actualSampleSizeSpan) {
    actualSampleSizeSpan.style.transition = 'opacity 0.3s ease-out';
    actualSampleSizeSpan.style.opacity = '0';
    setTimeout(() => {
      actualSampleSizeSpan.textContent = actualSampleSize;
      actualSampleSizeSpan.style.opacity = '1';
    }, 150);
  }

  if (requiredSampleSizeSpan) {
    requiredSampleSizeSpan.style.transition = 'opacity 0.3s ease-out';
    requiredSampleSizeSpan.style.opacity = '0';
    setTimeout(() => {
      requiredSampleSizeSpan.textContent = requiredSampleSize;
      requiredSampleSizeSpan.style.opacity = '1';
    }, 250);
  }

  // バッジをアニメーション付きで表示
  if (validityBadge) {
    validityBadge.style.transition = 'all 0.3s ease-out';
    validityBadge.style.transform = 'scale(0.8)';
    validityBadge.style.opacity = '0';

    if (isValid) {
      validityBadge.textContent = '✓ 妥当';
      validityBadge.className = 'validity-badge valid';
    } else {
      validityBadge.textContent = '⚠️ 不十分';
      validityBadge.className = 'validity-badge invalid';
    }

    setTimeout(() => {
      validityBadge.style.transform = 'scale(1)';
      validityBadge.style.opacity = '1';
    }, 350);
  }

  // 説明文をフェードイン
  if (validityExplanation) {
    validityExplanation.style.transition = 'opacity 0.3s ease-out';
    validityExplanation.style.opacity = '0';

    if (isValid) {
      const surplus = actualSampleSize - requiredSampleSize;
      validityExplanation.textContent = `実際のサンプル数が必要数を${surplus}個上回っており、統計的に十分なデータ量です。`;
    } else {
      const shortage = requiredSampleSize - actualSampleSize;
      validityExplanation.textContent = `実際のサンプル数が必要数より${shortage}個不足しています。より多くのデータを収集することを推奨します。`;
    }

    setTimeout(() => {
      validityExplanation.style.opacity = '1';
    }, 450);
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

  // サンプルサイズ妥当性を状態に保存
  appState.setSampleSizeValidation(statsType, {
    isValid,
    actualSize: actualSampleSize,
    requiredSize: requiredSampleSize
  });

  // 推奨代表値を表示
  // サンプルサイズの妥当性に応じて表示内容を分岐
  if (finalValues.length >= 2) {
    appState.setLastCalculatedStats(isValid ? finalStats : null);
    displayRecommendedValue(finalStats, isValid, statsType);
  } else {
    appState.setLastCalculatedStats(isValid ? stats : null);
    displayRecommendedValue(stats, isValid, statsType);
  }

  // 複数パターン分析の読み込みボタンの状態を更新（サンプルサイズ妥当性が変更されたため）
  updateLoadStatsButtons();

  // 結果を表示
  resultDiv.classList.remove('is-hidden');
}

/**
 * 外れ値情報を表示
 * @param {Object} outlierResult - 外れ値検出結果
 * @param {string} statsType - 統計タイプ
 * @param {boolean} isSampleSizeValid - サンプルサイズが妥当かどうか
 */
export function displayOutlierInfo(outlierResult, statsType, isSampleSizeValid) {
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
    appState.clearExcludedOutliers();
    // ハイライトをクリア
    highlightOutlierRows(statsType);
    return;
  }

  // 現在の外れ値リストを更新
  appState.setCurrentOutlierValues([...outlierResult.outliers]);

  // 前回の除外状態をクリア（新しい検出結果に合わせる）
  const validIndices = new Set();
  const manuallyExcludedIndices = appState.getManuallyExcludedOutlierIndices();
  const currentOutliers = appState.getCurrentOutlierValues();

  manuallyExcludedIndices.forEach(index => {
    if (index < currentOutliers.length) {
      validIndices.add(index);
    }
  });

  // 有効なインデックスのみ保持
  appState.clearExcludedOutliers();
  validIndices.forEach(index => appState.excludeOutlierByIndex(index));

  // 統計タイプに応じた単位を取得
  const unit = statsType === 'yieldRate' ? '%' : 'g';

  const formatValue = (value) => {
    if (unit === '%') {
      return pct(toFixed(value));
    } 
      return `${toFixed(value)}${unit}`;
    
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
      checkbox.checked = appState.getManuallyExcludedOutlierIndices().has(index);
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
  const manuallyExcludedCount = appState.getManuallyExcludedOutlierIndices().size;
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
  highlightOutlierRows(statsType);
}
