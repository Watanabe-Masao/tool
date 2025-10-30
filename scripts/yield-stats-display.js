/**
 * 歩留まり統計: 表示管理モジュール
 *
 * 統計値の表示、外れ値処理、サンプルサイズ検証、
 * 推奨値表示、読み込みボタン管理などを担当します。
 */

import { qs, qsa, hide, show, setText, yen, pct, toFixed } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, YIELD_STATS_FIELDS } from './constants.js';
import { calculateStatistics, detectOutliers } from './yield-stats-calc.js';
import { renderStatsChart } from './yield-stats-charts.js';
import {
  getConfidenceMessage,
  getMatrixEvaluation,
  calculateRequiredSampleSize
} from './yield-stats-helpers.js';

// 外れ値の状態管理
let currentStatsType = '';
let manuallyExcludedOutlierIndices = new Set();
let currentOutlierValues = [];

function displayCurrentStatistics() {
  const selectElement = qs('#statsTypeSelect');
  const selectedType = selectElement?.value || 'yieldRate';
  const data = appState.getYieldStatsData();

  // 状態を更新：現在の表示タイプ
  window.yieldStatsState.currentDisplayType = selectedType;

  // 統計タイプが変更されたら外れ値の除外状態をリセット
  // 注：この時点ではまだ自動切り替え前なので selectedType を使用
  if (currentStatsType !== selectedType) {
    window.yieldStatsState.manuallyExcludedOutlierIndices.clear();
    window.yieldStatsState.currentOutlierValues = [];
    window.yieldStatsState.isOutlierExcluded = false;

    // 後方互換性のため既存変数も更新
    manuallyExcludedOutlierIndices = window.yieldStatsState.manuallyExcludedOutlierIndices;
    currentOutlierValues = window.yieldStatsState.currentOutlierValues;
  }

  if (!data) {
    hide('yieldStatsResults');
    return;
  }

  // 統計タイプごとの統計データをオブジェクトで管理（表示処理の前に実行）
  if (!window.statsDataByType) {
    window.statsDataByType = {};
  }

  // 各統計タイプの統計を計算して保存
  ['yieldRate', 'beforeWeight', 'afterWeight'].forEach(type => {
    if (data[type] && Array.isArray(data[type]) && data[type].length >= 2) {
      window.statsDataByType[type] = calculateStatistics(data[type]);
    } else {
      window.statsDataByType[type] = null;
    }
  });

  // 状態を更新：データ存在フラグ
  window.yieldStatsState.hasYieldRateData = !!(data.yieldRate && Array.isArray(data.yieldRate) && data.yieldRate.length >= 2);
  window.yieldStatsState.hasBeforeWeightData = !!(data.beforeWeight && Array.isArray(data.beforeWeight) && data.beforeWeight.length >= 2);
  window.yieldStatsState.hasAfterWeightData = !!(data.afterWeight && Array.isArray(data.afterWeight) && data.afterWeight.length >= 2);

  // 状態を更新：計算済みフラグ
  // 注：isFromHistoryは履歴復元時に既にtrueが設定されている場合があるので、
  // 既にtrueの場合は保持し、falseの場合のみ明示的にfalseを設定する
  window.yieldStatsState.isCalculated = true;
  if (!window.yieldStatsState.isFromHistory) {
    window.yieldStatsState.isFromHistory = false;
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
        window.yieldStatsState.currentDisplayType = foundType;
      }

      // currentStatsTypeも更新
      currentStatsType = foundType;
    } else {
      // 全てのタイプでデータが不足している場合は非表示
      hide('yieldStatsResults');
      return;
    }
  } else {
    // データがある場合、currentStatsTypeを更新
    currentStatsType = actualSelectedType;
  }

  // 手動除外が設定されている場合、データをフィルタリング
  let finalValues = values;
  let finalStats = null;

  if (manuallyExcludedOutlierIndices.size > 0 && currentOutlierValues.length > 0) {
    const excludedValues = new Set();
    manuallyExcludedOutlierIndices.forEach(index => {
      if (index < currentOutlierValues.length) {
        excludedValues.add(currentOutlierValues[index]);
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
  displayStatistics(finalStats, unit);
  displayMatrixEvaluation(finalStats);
  renderStatsChart(finalValues, finalStats, typeName, unit);

  // 統計結果を表示
  show('yieldStatsResults');

  // サンプルサイズ妥当性判断の単位と表示を更新
  updateToleranceUnit();

  // 後方互換性のため、従来の変数も維持
  window.lastCalculatedStats = finalStats; // 表示用（選択された統計タイプ）

  // サンプルサイズ検証を実行（許容誤差が入力されている場合は推奨代表値も表示）
  const toleranceErrorInput = qs('#toleranceError');
  const hasTolerance = toleranceErrorInput && parseFloat(toleranceErrorInput.value) > 0;

  displaySampleSizeValidation();

  // 許容誤差が未入力の場合も推奨代表値と複数パターン分析ボタンを表示
  if (!hasTolerance) {
    displayRecommendedValue(finalStats, true, actualSelectedType);
  }
}

/**
 * マトリックス評価を表示
 * @param {Object} stats - 統計情報
 */
function displayMatrixEvaluation(stats) {
  const sampleSizeSpan = qs('#matrixEvalSampleSize');
  const cvSpan = qs('#matrixEvalCV');
  const messageDiv = qs('#matrixEvalMessage');

  if (!sampleSizeSpan || !cvSpan || !messageDiv) {
    return;
  }

  const n = stats.count;
  const cv = stats.cv;

  // サンプル数とCVを表示
  sampleSizeSpan.textContent = `${n}個`;
  cvSpan.textContent = `${toFixed(cv)}%`;

  // マトリックス評価を取得
  const evaluation = getMatrixEvaluation(n, cv);

  // メッセージを表示
  messageDiv.textContent = evaluation.message;
  messageDiv.className = `matrix-eval-message ${evaluation.className}`;
}

/**
 * 統計値を表示
 */
function displayStatistics(stats, unit = '%') {
  const formatValue = (value) => {
    if (unit === '%') {
      return pct(toFixed(value));
    } else {
      return `${toFixed(value)}${unit}`;
    }
  };

  // 基本統計量
  setText('statsCount', `${stats.count}個`);
  setText('statsMax', formatValue(stats.max));
  setText('statsMin', formatValue(stats.min));
  setText('statsRange', formatValue(stats.range));
  setText('statsAvg', formatValue(stats.mean));
  setText('statsMedian', formatValue(stats.median));
  setText('statsStdDev', formatValue(stats.stdDev));
  setText('statsCV', `${toFixed(stats.cv)}%`);

  // 四分位数
  setText('statsQ1', formatValue(stats.q1));
  setText('statsQ3', formatValue(stats.q3));
  setText('statsIQR', formatValue(stats.iqr));

  // 分布の形状
  setText('statsSkewness', toFixed(stats.skewness, 3));
  setText('statsKurtosis', toFixed(stats.kurtosis, 3));

  // σ範囲
  setText('statsSigma1', `${formatValue(stats.sigma1.lower)} ～ ${formatValue(stats.sigma1.upper)}`);
  setText('statsSigma2', `${formatValue(stats.sigma2.lower)} ～ ${formatValue(stats.sigma2.upper)}`);
  setText('statsSigma3', `${formatValue(stats.sigma3.lower)} ～ ${formatValue(stats.sigma3.upper)}`);
}

/**
 * 外れ値を検出（IQR法）
 * @param {Array<number>} values - データ配列
 * @param {Object} stats - 統計データ
 * @returns {Object} { outliers: 外れ値の配列, cleanedValues: 外れ値を除外したデータ, lowerBound: 下限, upperBound: 上限 }
 */

/**
 * サンプルサイズ妥当性を表示
 */
function displaySampleSizeValidation() {
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

  const data = appState.getYieldStatsData();
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

  if (manuallyExcludedOutlierIndices.size > 0 && currentOutlierValues.length > 0) {
    // 手動除外する外れ値のセットを作成
    const excludedValues = new Set();
    manuallyExcludedOutlierIndices.forEach(index => {
      if (index < currentOutlierValues.length) {
        excludedValues.add(currentOutlierValues[index]);
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

  // 結果を表示
  const actualSampleSizeSpan = qs('#actualSampleSize');
  const requiredSampleSizeSpan = qs('#requiredSampleSize');
  const validityBadge = qs('#validityJudgment');
  const validityExplanation = qs('#validityExplanation');

  if (actualSampleSizeSpan) {
    actualSampleSizeSpan.textContent = actualSampleSize;
  }

  if (requiredSampleSizeSpan) {
    requiredSampleSizeSpan.textContent = requiredSampleSize;
  }

  if (validityBadge) {
    if (isValid) {
      validityBadge.textContent = '妥当';
      validityBadge.className = 'validity-badge valid';
    } else {
      validityBadge.textContent = '不十分';
      validityBadge.className = 'validity-badge invalid';
    }
  }

  if (validityExplanation) {
    if (isValid) {
      const surplus = actualSampleSize - requiredSampleSize;
      validityExplanation.textContent = `実際のサンプル数が必要数を${surplus}個上回っており、統計的に十分なデータ量です。`;
    } else {
      const shortage = requiredSampleSize - actualSampleSize;
      validityExplanation.textContent = `実際のサンプル数が必要数より${shortage}個不足しています。より多くのデータを収集することを推奨します。`;
    }
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

  // 推奨代表値を表示（サンプルサイズが妥当な場合のみ）
  // 手動除外後のデータで計算
  if (finalValues.length >= 2) {
    // グローバルに保存（複数パターン分析への遷移用）
    window.lastCalculatedStats = finalStats;
    displayRecommendedValue(finalStats, isValid, statsType);
  } else {
    // グローバルに保存（複数パターン分析への遷移用）
    window.lastCalculatedStats = stats;
    displayRecommendedValue(stats, isValid, statsType);
  }

  // 結果を表示
  resultDiv.classList.remove('is-hidden');
}

/**
 * 歩留まり統計の状態管理
 * データと状態を明確に分離して管理
 */
window.yieldStatsState = {
  // 表示関連の状態
  currentDisplayType: 'yieldRate',        // 現在表示中の統計タイプ

  // データソース関連の状態
  isFromHistory: false,                   // 履歴から読み込まれたか
  isCalculated: false,                    // 計算済みか（新規計算されたか）

  // データ存在フラグ
  hasYieldRateData: false,                // 歩留まり率データが存在するか
  hasBeforeWeightData: false,             // 加工前重量データが存在するか
  hasAfterWeightData: false,              // 加工後重量データが存在するか

  // UI状態
  isOutlierExcluded: false,               // 外れ値除外が適用されているか
  manuallyExcludedOutlierIndices: new Set(), // 手動除外された外れ値のインデックス
  currentOutlierValues: [],               // 現在の外れ値リスト

  // 次のアクション指示
  shouldShowMultiPatternLink: false       // 複数パターン分析リンクを表示すべきか
};

// 後方互換性のため、グローバル変数も残す（徐々に置き換え）
manuallyExcludedOutlierIndices = window.yieldStatsState.manuallyExcludedOutlierIndices;
currentOutlierValues = window.yieldStatsState.currentOutlierValues;
currentStatsType = window.yieldStatsState.currentDisplayType;

/**
 * 外れ値情報を表示
 * @param {Object} outlierResult - 外れ値検出結果
 * @param {string} statsType - 統計タイプ
 * @param {boolean} isSampleSizeValid - サンプルサイズが妥当かどうか
 */
function displayOutlierInfo(outlierResult, statsType, isSampleSizeValid) {
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
    manuallyExcludedOutlierIndices.clear();
    currentOutlierValues = [];
    // ハイライトをクリア
    highlightOutlierRows();
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
      checkbox.checked = manuallyExcludedOutlierIndices.has(index);
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
  const manuallyExcludedCount = manuallyExcludedOutlierIndices.size;
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
  highlightOutlierRows();
}

/**
 * 外れ値チェックボックスの変更を処理
 */
function handleOutlierCheckboxChange() {
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
  displayCurrentStatistics();
}

/**
 * 外れ値を含む行をハイライト表示
 */
function highlightOutlierRows() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';

  // まず全ての行からハイライトを削除
  const allRows = tbody.querySelectorAll('.yield-stats-row');
  allRows.forEach(row => {
    row.classList.remove('has-outlier');
  });

  // 外れ値が検出されていない場合は終了
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    return;
  }

  // 各行の値をチェックして外れ値を含む行をハイライト
  allRows.forEach(row => {
    const rowId = row.dataset.rowId;

    if (statsType === 'yieldRate') {
      // 歩留まり率をチェック
      const yieldRateDisplay = qs(`#${YIELD_STATS_FIELDS.YIELD_RATE}${rowId}`);
      if (yieldRateDisplay && yieldRateDisplay.classList.contains('calculated')) {
        const rateText = yieldRateDisplay.textContent.replace('%', '');
        const rate = parseFloat(rateText);
        if (!isNaN(rate) && isOutlierValue(rate)) {
          row.classList.add('has-outlier');
        }
      }
    } else if (statsType === 'beforeWeight') {
      // 加工前重量をチェック
      const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
      if (beforeInput && beforeInput.value.trim() !== '') {
        const beforeWeight = parseFloat(beforeInput.value);
        if (!isNaN(beforeWeight) && isOutlierValue(beforeWeight)) {
          row.classList.add('has-outlier');
        }
      }
    } else if (statsType === 'afterWeight') {
      // 加工後重量をチェック
      const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);
      if (afterInput && afterInput.value.trim() !== '') {
        const afterWeight = parseFloat(afterInput.value);
        if (!isNaN(afterWeight) && isOutlierValue(afterWeight)) {
          row.classList.add('has-outlier');
        }
      }
    }
  });
}

/**
 * 値が外れ値リストに含まれているかをチェック
 * @param {number} value - チェックする値
 * @returns {boolean} - 外れ値の場合true
 */
function isOutlierValue(value) {
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    return false;
  }

  // 浮動小数点数の比較のため、非常に小さい差を許容
  return currentOutlierValues.some(outlierValue =>
    Math.abs(value - outlierValue) < 0.0001
  );
}

/**
 * 外れ値を含む行をテーブルから削除
 */
function deleteOutlierRows() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // 外れ値が検出されていない場合は何もしない
  if (!currentOutlierValues || currentOutlierValues.length === 0) {
    alert('削除する外れ値がありません。');
    return;
  }

  // 確認ダイアログを表示
  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';
  const statsTypeName = statsType === 'yieldRate' ? '歩留まり率' :
                       statsType === 'beforeWeight' ? '加工前重量' : '加工後重量';

  const confirmMessage = `${statsTypeName}に外れ値を含む行をテーブルから削除します。\n削除した行は元に戻せません。\n\n削除する外れ値の数: ${currentOutlierValues.length}件\n\n本当に削除しますか？`;

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
    alert('削除する行が見つかりませんでした。');
    return;
  }

  rowsToDelete.forEach(row => {
    row.remove();
  });

  // 行番号を再割り当て
  compactYieldStatsRows(yieldStatsCallbacks);

  // 統計を再計算
  updateYieldStatsStatistics(displayCurrentStatistics);

  // 削除完了メッセージ
  alert(`${rowsToDelete.length}行を削除しました。`);
}

/**
 * 計算式詳細モーダルのセットアップ
 */
function setupFormulaModal() {
  const modal = qs('#formulaModal');
  const modalClose = qs('#formulaModalClose');
  const modalOverlay = modal?.querySelector('.modal-overlay');
  const modalTitle = qs('#formulaModalTitle');
  const modalBody = qs('#formulaModalBody');

  if (!modal || !modalClose || !modalOverlay || !modalTitle || !modalBody) {
    return;
  }

  // モーダルを開く関数
  const openModal = (formulaName, formula, description, example) => {
    modalTitle.textContent = formulaName;

    let html = '<div class="formula-section">';

    if (formula) {
      html += '<div class="formula-label">計算式</div>';
      html += `<div class="formula-expression">${formula}</div>`;
    }

    if (description) {
      html += `<div class="formula-description">${description}</div>`;
    }

    if (example) {
      html += `<div class="formula-example"><strong>例：</strong> ${example}</div>`;
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
 * 推奨代表値を取得
 * @param {Object} stats - 統計データ
 * @returns {Object} {type: 'mean'|'median', value: number, label: string}
 */
function getRecommendedValue(stats) {
  if (!stats) return null;

  const skewness = stats.skewness;
  const absSkewness = Math.abs(skewness);

  if (absSkewness <= 0.5) {
    return { type: 'mean', value: stats.mean, label: '平均値' };
  } else {
    return { type: 'median', value: stats.median, label: '中央値' };
  }
}

/**
 * 標準偏差を使った範囲パターンを生成
 * @param {Object} stats - 統計データ
 * @param {number} sigmaRange - 標準偏差の範囲（デフォルト: 2）
 * @returns {Array<Object>} {label: string, value: number}[]
 */
function generateSigmaPatterns(stats, sigmaRange = 2) {
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

/**
 * 推奨代表値を表示
 * @param {Object} stats - 統計データ
 * @param {boolean} isSampleSizeValid - サンプルサイズが妥当かどうか
 * @param {string} statsType - 統計タイプ（'yieldRate', 'beforeWeight', 'afterWeight'）
 */
function displayRecommendedValue(stats, isSampleSizeValid, statsType = 'yieldRate') {
  const recommendedValueDiv = qs('#recommendedValue');
  const recommendedBadge = qs('#recommendedBadge');
  const recommendedReason = qs('#recommendedReason');

  if (!recommendedValueDiv || !recommendedBadge || !recommendedReason) {
    return;
  }

  // サンプルサイズが妥当な場合のみ表示
  if (!isSampleSizeValid) {
    recommendedValueDiv.classList.add('is-hidden');
    return;
  }

  const skewness = stats.skewness;
  const absSkewness = Math.abs(skewness);

  // 統計タイプに応じた単位を取得
  const unit = statsType === 'yieldRate' ? '%' : 'g';

  const formatValue = (value) => {
    if (unit === '%') {
      return pct(toFixed(value));
    } else {
      return `${toFixed(value)}${unit}`;
    }
  };

  let recommendedType = '';
  let reason = '';

  // 歪度に基づいて推奨値を判定
  if (absSkewness <= 0.5) {
    // 分布が正規分布に近い → 平均値を推奨
    recommendedType = '平均値';
    const meanValue = formatValue(stats.mean);
    reason = `データの分布が正規分布に近く（歪度: ${toFixed(skewness, 3)}）、外れ値の影響が少ないと考えられます。代表値として平均値（${meanValue}）の使用を推奨します。`;
  } else {
    // 分布が歪んでいる → 中央値を推奨
    recommendedType = '中央値';
    const medianValue = formatValue(stats.median);
    const direction = skewness > 0 ? '右に歪んでおり（正の歪度）' : '左に歪んでおり（負の歪度）';
    reason = `データの分布が${direction}、外れ値の影響を受けやすい状態です（歪度: ${toFixed(skewness, 3)}）。より頑健な代表値として中央値（${medianValue}）の使用を推奨します。`;
  }

  recommendedBadge.textContent = recommendedType;
  recommendedReason.textContent = reason;

  recommendedValueDiv.classList.remove('is-hidden');

  // 複数パターン分析へのリンクを表示（歩留まり率の統計を表示している場合のみ）
  const multiPatternLink = qs('#multiPatternLink');
  if (multiPatternLink && statsType === 'yieldRate') {
    const hasYieldRateData = window.yieldStatsState.hasYieldRateData;
    const yieldRateStats = window.statsDataByType?.yieldRate;

    // データが十分にあるかチェック
    if (isSampleSizeValid && hasYieldRateData && yieldRateStats && yieldRateStats.count >= 2) {
      multiPatternLink.classList.remove('is-hidden');
    } else {
      multiPatternLink.classList.add('is-hidden');
    }
  } else {
    if (multiPatternLink) {
      multiPatternLink.classList.add('is-hidden');
    }
  }
}

/**
 * ボタンにタッチとクリックのイベントハンドラーを設定
 * タッチデバイスとマウスデバイスの両方に対応
 */
function attachButtonHandler(button, handler) {
  let touchStarted = false;

  button.addEventListener('touchstart', () => {
    touchStarted = true;
  }, { passive: true });

  button.addEventListener('touchend', (e) => {
    if (touchStarted) {
      e.preventDefault();
      touchStarted = false;
      handler();
    }
  }, { passive: false });

  button.addEventListener('click', () => {
    if (!touchStarted) {
      handler();
    }
  });
}

/**
 * 歩留まり統計から読み込むボタンの状態を更新
 * ボタンのイベントハンドラーは動的に生成時に直接設定されます。
 */
function updateLoadStatsButtons() {
  const loadStatsButtons = qs('#loadStatsButtons');
  const loadStatsNoData = qs('#loadStatsNoData');
  const loadMeanValueDisplay = qs('#loadMeanValueDisplay');
  const loadMedianValueDisplay = qs('#loadMedianValueDisplay');
  const loadRecommendedValueDisplay = qs('#loadRecommendedValueDisplay');
  const generateSigmaPatternsSection = qs('#generateSigmaPatternsSection');
  const loadStatsTypeSelect = qs('#loadStatsTypeSelect');

  if (!loadStatsButtons || !loadStatsNoData || !loadStatsTypeSelect) {
    return;
  }

  // 現在の複数パターン分析のモードを取得
  const currentMode = document.querySelector('input[name="yieldMethodMultiPattern"]:checked')?.value || 'calculate';

  // 現在選択されている値を保存
  const previousValue = loadStatsTypeSelect.value;

  // モードに応じてプルダウンの選択肢を更新
  loadStatsTypeSelect.innerHTML = '';
  if (currentMode === 'direct') {
    // 歩留まり率直接入力モード：歩留まり率と加工前重量のみ
    loadStatsTypeSelect.innerHTML = `
      <option value="bulk">一括取り込み（推奨値をステップ1に転記）</option>
      <option value="yieldRate">歩留まり率（%）</option>
      <option value="beforeWeight">加工前重量（g）</option>
    `;
  } else {
    // 重量から計算モード：加工前重量と加工後重量のみ
    loadStatsTypeSelect.innerHTML = `
      <option value="bulk">一括取り込み（推奨値をステップ1に転記）</option>
      <option value="beforeWeight">加工前重量（g）</option>
      <option value="afterWeight">加工後重量（g）</option>
    `;
  }

  // 以前の選択値が新しいオプションに存在すれば復元
  if (previousValue && Array.from(loadStatsTypeSelect.options).some(opt => opt.value === previousValue)) {
    loadStatsTypeSelect.value = previousValue;
  }

  // 複数パターン分析画面のプルダウンで選択された統計タイプを取得
  const selectedStatsType = loadStatsTypeSelect.value;

  // 一括取り込みモードの場合
  if (selectedStatsType === 'bulk') {
    const yieldRateStats = window.statsDataByType?.yieldRate;
    const beforeWeightStats = window.statsDataByType?.beforeWeight;
    const afterWeightStats = window.statsDataByType?.afterWeight;

    // 歩留まり率の統計データが必須
    if (!yieldRateStats || yieldRateStats.count < 2) {
      loadStatsButtons.classList.add('is-hidden');
      loadStatsNoData.classList.remove('is-hidden');
      if (generateSigmaPatternsSection) {
        generateSigmaPatternsSection.classList.add('is-hidden');
      }
      return;
    }

    // 推奨値を取得
    const yieldRateRecommended = getRecommendedValue(yieldRateStats);
    const beforeWeightRecommended = beforeWeightStats && beforeWeightStats.count >= 2
      ? getRecommendedValue(beforeWeightStats)
      : null;
    const afterWeightRecommended = afterWeightStats && afterWeightStats.count >= 2
      ? getRecommendedValue(afterWeightStats)
      : null;

    // テーブル全体を書き換え（2列レイアウト）
    const table = loadStatsButtons.querySelector('table');
    if (table) {
      let rows = '';

      // モードに応じて表示する項目を変更
      if (currentMode === 'direct') {
        // 歩留まり率直接入力モード
        rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">歩留まり率</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${yieldRateRecommended ? toFixed(yieldRateRecommended.value, 2) + '%' : '-'}</td>
          </tr>`;
        if (beforeWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工前重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(beforeWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
      } else {
        // 重量から計算モード
        if (beforeWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工前重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(beforeWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
        if (afterWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工後重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(afterWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
      }

      table.innerHTML = `
        <thead>
          <tr>
            <th style="text-align: left; padding: 0.6em;">項目</th>
            <th style="text-align: right; padding: 0.6em;">推奨値</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>`;
    }

    // ボタンを表示、メッセージを非表示
    loadStatsButtons.classList.remove('is-hidden');
    loadStatsNoData.classList.add('is-hidden');

    // σパターン生成セクションを非表示（一括取り込みモードでは不要）
    if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }

    // 一括取り込みボタンをテーブルの外に配置
    // 既存のボタンコンテナを探すか、新規作成
    let bulkImportBtnContainer = qs('#bulkImportBtnContainer');
    if (!bulkImportBtnContainer) {
      bulkImportBtnContainer = document.createElement('div');
      bulkImportBtnContainer.id = 'bulkImportBtnContainer';
      bulkImportBtnContainer.style.cssText = 'text-align: center; margin-top: 0.8em;';
      loadStatsButtons.appendChild(bulkImportBtnContainer);
    }

    // ボタンを直接イベントハンドラーと共に作成
    bulkImportBtnContainer.innerHTML = '';
    const bulkImportBtn = document.createElement('button');
    bulkImportBtn.type = 'button';
    bulkImportBtn.id = 'bulkImportBtn';
    bulkImportBtn.className = 'btn btn-recommended btn-sm';
    bulkImportBtn.style.cssText = 'font-size: 0.9em; padding: 0.5em 1.2em;';
    bulkImportBtn.textContent = '📥 推奨値を一括転記';

    // イベントハンドラを設定
    attachButtonHandler(bulkImportBtn, () => {
      if (window.loadAllStatsToMultiPattern) {
        window.loadAllStatsToMultiPattern();
      } else {
        console.error('[ERROR] loadAllStatsToMultiPattern関数が見つかりません');
      }
    });

    bulkImportBtnContainer.appendChild(bulkImportBtn);

    return;
  }

  // 通常モード（個別の統計タイプ）
  const stats = window.statsDataByType?.[selectedStatsType];

  // 一括取り込みボタンコンテナを削除（通常モードでは不要）
  const bulkImportBtnContainer = qs('#bulkImportBtnContainer');
  if (bulkImportBtnContainer) {
    bulkImportBtnContainer.remove();
  }

  if (stats && stats.count >= 2) {
    // 推奨値を取得
    const recommended = getRecommendedValue(stats);

    // 単位を取得
    const unit = selectedStatsType === 'yieldRate' ? '%' : 'g';

    // テーブル全体を通常表示（3列）に戻す
    const table = loadStatsButtons.querySelector('table');
    if (table) {
      // テーブルのthead/tbodyを作成
      table.innerHTML = `
        <thead>
          <tr>
            <th>統計種別</th>
            <th>値</th>
            <th>読み込み</th>
          </tr>
        </thead>
        <tbody></tbody>`;

      const tbody = table.querySelector('tbody');

      // 平均値の行を作成
      const meanRow = tbody.insertRow();
      meanRow.innerHTML = `
        <td class="stats-label">平均値</td>
        <td class="stats-value">${toFixed(stats.mean, 2)}${unit}</td>
        <td class="stats-action"></td>`;
      const meanBtn = document.createElement('button');
      meanBtn.type = 'button';
      meanBtn.className = 'btn btn-primary btn-sm';
      meanBtn.textContent = '読み込む';
      attachButtonHandler(meanBtn, () => {
        if (window.loadStatsValueToMultiPattern) {
          window.loadStatsValueToMultiPattern(stats.mean, selectedStatsType, false);
          window.showTransferNotification('平均値を転記しました');
          window.focusFirstPatternInput();
        }
      });
      meanRow.cells[2].appendChild(meanBtn);

      // 中央値の行を作成
      const medianRow = tbody.insertRow();
      medianRow.innerHTML = `
        <td class="stats-label">中央値</td>
        <td class="stats-value">${toFixed(stats.median, 2)}${unit}</td>
        <td class="stats-action"></td>`;
      const medianBtn = document.createElement('button');
      medianBtn.type = 'button';
      medianBtn.className = 'btn btn-secondary btn-sm';
      medianBtn.textContent = '読み込む';
      attachButtonHandler(medianBtn, () => {
        if (window.loadStatsValueToMultiPattern) {
          window.loadStatsValueToMultiPattern(stats.median, selectedStatsType, false);
          window.showTransferNotification('中央値を転記しました');
          window.focusFirstPatternInput();
        }
      });
      medianRow.cells[2].appendChild(medianBtn);

      // 推奨値の行を作成
      if (recommended) {
        const recommendedRow = tbody.insertRow();
        recommendedRow.className = 'recommended-row';
        recommendedRow.innerHTML = `
          <td class="stats-label">📌 推奨値</td>
          <td class="stats-value">${toFixed(recommended.value, 2)}${unit}</td>
          <td class="stats-action"></td>`;
        const recommendedBtn = document.createElement('button');
        recommendedBtn.type = 'button';
        recommendedBtn.className = 'btn btn-recommended btn-sm';
        recommendedBtn.textContent = '読み込む';
        attachButtonHandler(recommendedBtn, () => {
          if (window.loadStatsValueToMultiPattern) {
            window.loadStatsValueToMultiPattern(recommended.value, selectedStatsType, false);
            window.showTransferNotification('推奨値を転記しました');
            window.focusFirstPatternInput();
          }
        });
        recommendedRow.cells[2].appendChild(recommendedBtn);
      }
    }

    // ボタンを表示、メッセージを非表示
    loadStatsButtons.classList.remove('is-hidden');
    loadStatsNoData.classList.add('is-hidden');

    // σパターン生成セクションを表示（歩留まり率の場合のみ）
    if (generateSigmaPatternsSection && selectedStatsType === 'yieldRate') {
      generateSigmaPatternsSection.classList.remove('is-hidden');
    } else if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }
  } else {
    // データがない場合、メッセージを表示
    loadStatsButtons.classList.add('is-hidden');
    loadStatsNoData.classList.remove('is-hidden');

    // σパターン生成セクションを非表示
    if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }
  }
}


// エクスポート
export {
  displayCurrentStatistics,
  setupFormulaModal,
  updateLoadStatsButtons,
  displaySampleSizeValidation,
  handleOutlierCheckboxChange,
  deleteOutlierRows,
  generateSigmaPatterns
};
