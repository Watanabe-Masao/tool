/**
 * 歩留まり統計: 表示管理モジュール（Phase 9: UX改善完了版）
 *
 * 統計値の表示、読み込みボタン管理などを担当します。
 * 外れ値処理の一部は outlier-management.js に分離されています。
 *
 * Phase 9 UX改善完了:
 * ✅  displayMatrixEvaluation: アイコン付き、フェードイン/スライドアップアニメーション
 * ✅  displayStatistics: 全統計値に段階的フェードインアニメーション (17項目)
 * ✅  displaySampleSizeValidation: カラーコーディング付きプログレスバー、カウントアップアニメーション
 * ✅  displayRecommendedValue: スケールアニメーション、アイコン付きバッジ、スライドイン
 * ✅  外れ値管理: highlightOutlierRows, isOutlierValue (outlier-management.jsから統合)
 *
 * UX改善の特徴:
 * -  アイコン: 視覚的なフィードバック（🌟✓⚡[警告] ️等）
 * - 🎨 カラーコーディング: 緑（良好）、黄（警告）、赤（危険）
 * - 🎬 アニメーション: fadeInUp, scaleIn, カウントアップ
 * -  プログレスバー: サンプル数充足度の視覚化
 * - ⏱️ タイミング制御: 段階的表示で認知負荷を軽減
 *
 * 新規モジュール（将来の拡張用）:
 * - outlier-management.js (403行): さらに高度な外れ値UX機能
 * - sample-size-validator.js (335行): 独立した検証UI
 * - stats-ui-helpers.js (456行): 追加のUI補助機能
 *
 * リファクタリング実績:
 * - Phase 0-8: main.js 5,621行 → 15行 (99.7%削減)
 * - Phase 9: yield-stats-display.js 1,289行 → 1,391行 (UX改善により102行追加, 7.9%増)
 */

import { qs, qsa, hide, show, setText, yen, pct, toFixed } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, UI_ELEMENTS, YIELD_STATS_FIELDS } from './constants.js';
import { showInfo, showWarning } from './toast.js';
import { calculateStatistics, detectOutliers } from './yield-stats-calc.js';
import { renderStatsChart } from './yield-stats-charts.js';
import {
  getConfidenceMessage,
  getMatrixEvaluation,
  calculateRequiredSampleSize
} from './yield-stats-helpers.js';
import { updateToleranceUnit } from './event-handlers-setup.js';
// 新しいモジュール（将来の拡張用にモジュールは保持、実際の使用は一部のみ）
import {
  highlightOutlierRows,
  isOutlierValue
} from './outlier-management.js';

function displayCurrentStatistics() {
  const selectElement = qs('#statsTypeSelect');
  const selectedType = selectElement?.value || 'yieldRate';
  const data = appState.getYieldStatsData();

  // 状態を更新：現在の表示タイプ
  window.yieldStatsState.currentDisplayType = selectedType;

  // 統計タイプが変更されたら外れ値の除外状態をリセット
  // 注：この時点ではまだ自動切り替え前なので selectedType を使用
  if (window.yieldStatsState.currentDisplayType !== selectedType) {
    window.yieldStatsState.manuallyExcludedOutlierIndices.clear();
    window.yieldStatsState.currentOutlierValues = [];
    window.yieldStatsState.isOutlierExcluded = false;
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
    } else {
      // 全てのタイプでデータが不足している場合は非表示
      hide('yieldStatsResults');
      return;
    }
  }

  // 手動除外が設定されている場合、データをフィルタリング
  let finalValues = values;
  let finalStats = null;

  if (window.yieldStatsState.manuallyExcludedOutlierIndices.size > 0 && window.yieldStatsState.currentOutlierValues.length > 0) {
    const excludedValues = new Set();
    window.yieldStatsState.manuallyExcludedOutlierIndices.forEach(index => {
      if (index < window.yieldStatsState.currentOutlierValues.length) {
        excludedValues.add(window.yieldStatsState.currentOutlierValues[index]);
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

  // 後方互換性のため、従来の変数も維持（サンプルサイズが妥当な場合のみ）
  // 許容誤差が入力されている場合はその妥当性を、未入力の場合は保存済みの妥当性を使用
  const validation = window.yieldStatsState?.sampleSizeValidation?.[actualSelectedType];
  const isSampleSizeValid = validation ? validation.isValid : true; // 妥当性情報がない場合はtrue（後方互換性）

  if (isSampleSizeValid) {
    window.lastCalculatedStats = finalStats; // 表示用（選択された統計タイプ）
  } else {
    window.lastCalculatedStats = null; // サンプルサイズ不十分の場合はnull
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
 * マトリックス評価を表示（UX改善版: アニメーション付き）
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

  // マトリックス評価を取得
  const evaluation = getMatrixEvaluation(n, cv);

  // アニメーション付きで値を更新
  const updateWithAnimation = (element, newText) => {
    element.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
    element.style.opacity = '0';
    element.style.transform = 'translateY(-5px)';

    setTimeout(() => {
      element.textContent = newText;
      element.style.opacity = '1';
      element.style.transform = 'translateY(0)';
    }, 150);
  };

  // サンプル数とCVをアニメーション付きで表示
  updateWithAnimation(sampleSizeSpan, `${n}個`);
  updateWithAnimation(cvSpan, `${toFixed(cv)}%`);

  // メッセージを表示（評価クラスに応じたアイコン付き）
  const icons = {
    'excellent': '🌟',
    'good': '✓',
    'fair': '⚡',
    'poor': '[警告] ️'
  };
  const icon = icons[evaluation.className] || '';

  messageDiv.innerHTML = `<span class="matrix-icon">${icon}</span> ${evaluation.message}`;
  messageDiv.className = `matrix-eval-message ${evaluation.className}`;

  // メッセージもフェードイン
  messageDiv.style.animation = 'fadeInUp 0.5s ease-out';
}

/**
 * 統計値を表示（UX改善版: フェードインアニメーション付き）
 */
function displayStatistics(stats, unit = '%') {
  const formatValue = (value) => {
    if (unit === '%') {
      return pct(toFixed(value));
    } else {
      return `${toFixed(value)}${unit}`;
    }
  };

  // アニメーション付きで値を設定するヘルパー関数
  const setTextWithAnimation = (id, text) => {
    const element = qs(`#${id}`);
    if (element) {
      element.style.transition = 'opacity 0.2s ease-out';
      element.style.opacity = '0';
      setTimeout(() => {
        element.textContent = text;
        element.style.opacity = '1';
      }, 100);
    }
  };

  // 基本統計量（段階的にフェードイン）
  setTimeout(() => setTextWithAnimation('statsCount', `${stats.count}個`), 0);
  setTimeout(() => setTextWithAnimation('statsMax', formatValue(stats.max)), 50);
  setTimeout(() => setTextWithAnimation('statsMin', formatValue(stats.min)), 100);
  setTimeout(() => setTextWithAnimation('statsRange', formatValue(stats.range)), 150);
  setTimeout(() => setTextWithAnimation('statsAvg', formatValue(stats.mean)), 200);
  setTimeout(() => setTextWithAnimation('statsMedian', formatValue(stats.median)), 250);
  setTimeout(() => setTextWithAnimation('statsStdDev', formatValue(stats.stdDev)), 300);
  setTimeout(() => setTextWithAnimation('statsCV', `${toFixed(stats.cv)}%`), 350);

  // 四分位数
  setTimeout(() => setTextWithAnimation('statsQ1', formatValue(stats.q1)), 400);
  setTimeout(() => setTextWithAnimation('statsQ3', formatValue(stats.q3)), 450);
  setTimeout(() => setTextWithAnimation('statsIQR', formatValue(stats.iqr)), 500);

  // 分布の形状
  setTimeout(() => setTextWithAnimation('statsSkewness', toFixed(stats.skewness, 3)), 550);
  setTimeout(() => setTextWithAnimation('statsKurtosis', toFixed(stats.kurtosis, 3)), 600);

  // σ範囲
  setTimeout(() => setTextWithAnimation('statsSigma1', `${formatValue(stats.sigma1.lower)} ～ ${formatValue(stats.sigma1.upper)}`), 650);
  setTimeout(() => setTextWithAnimation('statsSigma2', `${formatValue(stats.sigma2.lower)} ～ ${formatValue(stats.sigma2.upper)}`), 700);
  setTimeout(() => setTextWithAnimation('statsSigma3', `${formatValue(stats.sigma3.lower)} ～ ${formatValue(stats.sigma3.upper)}`), 750);
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

  if (window.yieldStatsState.manuallyExcludedOutlierIndices.size > 0 && window.yieldStatsState.currentOutlierValues.length > 0) {
    // 手動除外する外れ値のセットを作成
    const excludedValues = new Set();
    window.yieldStatsState.manuallyExcludedOutlierIndices.forEach(index => {
      if (index < window.yieldStatsState.currentOutlierValues.length) {
        excludedValues.add(window.yieldStatsState.currentOutlierValues[index]);
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
      validityBadge.textContent = '[警告]  不十分';
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
  if (window.yieldStatsState) {
    window.yieldStatsState.sampleSizeValidation[statsType] = {
      isValid,
      actualSize: actualSampleSize,
      requiredSize: requiredSampleSize
    };
  }

  // 推奨代表値を表示
  // サンプルサイズの妥当性に応じて表示内容を分岐
  if (finalValues.length >= 2) {
    window.lastCalculatedStats = isValid ? finalStats : null;
    displayRecommendedValue(finalStats, isValid, statsType);
  } else {
    window.lastCalculatedStats = isValid ? stats : null;
    displayRecommendedValue(stats, isValid, statsType);
  }

  // 複数パターン分析の読み込みボタンの状態を更新（サンプルサイズ妥当性が変更されたため）
  updateLoadStatsButtons();

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

  // サンプルサイズ妥当性（統計タイプ別）
  sampleSizeValidation: {
    yieldRate: null,      // { isValid: boolean, actualSize: number, requiredSize: number }
    beforeWeight: null,
    afterWeight: null
  },

  // 次のアクション指示
  shouldShowMultiPatternLink: false       // 複数パターン分析リンクを表示すべきか
};

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
    window.yieldStatsState.manuallyExcludedOutlierIndices.clear();
    window.yieldStatsState.currentOutlierValues = [];
    // ハイライトをクリア
    highlightOutlierRows(statsType);
    return;
  }

  // 現在の外れ値リストを更新
  window.yieldStatsState.currentOutlierValues = [...outlierResult.outliers];

  // 前回の除外状態をクリア（新しい検出結果に合わせる）
  const validIndices = new Set();
  window.yieldStatsState.manuallyExcludedOutlierIndices.forEach(index => {
    if (index < window.yieldStatsState.currentOutlierValues.length) {
      validIndices.add(index);
    }
  });
  window.yieldStatsState.manuallyExcludedOutlierIndices = validIndices;

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
      checkbox.checked = window.yieldStatsState.manuallyExcludedOutlierIndices.has(index);
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
  const manuallyExcludedCount = window.yieldStatsState.manuallyExcludedOutlierIndices.size;
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

/**
 * 外れ値チェックボックスの変更を処理
 */
function handleOutlierCheckboxChange() {
  // チェックボックスの状態を読み取り
  window.yieldStatsState.manuallyExcludedOutlierIndices.clear();

  const checkboxes = qsa('#outlierCheckboxList input[type="checkbox"]:checked');
  checkboxes.forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index, 10);
    if (!isNaN(index)) {
      window.yieldStatsState.manuallyExcludedOutlierIndices.add(index);
    }
  });

  // 統計を再計算・再表示（除外後のデータで）
  displayCurrentStatistics();
}


/**
 * 外れ値を含む行をテーブルから削除
 */
function deleteOutlierRows() {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody) return;

  // 外れ値が検出されていない場合は何もしない
  if (!window.yieldStatsState.currentOutlierValues || window.yieldStatsState.currentOutlierValues.length === 0) {
    showWarning('削除する外れ値がありません。');
    return;
  }

  // 確認ダイアログを表示
  const statsTypeSelect = qs('#statsTypeSelect');
  const statsType = statsTypeSelect?.value || 'yieldRate';
  const statsTypeName = statsType === 'yieldRate' ? '歩留まり率' :
                       statsType === 'beforeWeight' ? '加工前重量' : '加工後重量';

  const confirmMessage = `${statsTypeName}に外れ値を含む行をテーブルから削除します。\n削除した行は元に戻せません。\n\n削除する外れ値の数: ${window.yieldStatsState.currentOutlierValues.length}件\n\n本当に削除しますか？`;

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

  // 行番号を再割り当て
  compactYieldStatsRows(yieldStatsCallbacks);

  // 統計を再計算
  updateYieldStatsStatistics(displayCurrentStatistics);

  // 削除完了メッセージ
  showInfo(`${rowsToDelete.length}行を削除しました。`);
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

  // UX改善: アイコン付きでバッジを表示
  const icon = recommendedType === '平均値' ? '' : '';
  recommendedBadge.innerHTML = `<span style="margin-right: 0.3em;">${icon}</span>${recommendedType}`;

  // バッジをスケールアニメーションで表示
  recommendedBadge.style.transition = 'all 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
  recommendedBadge.style.transform = 'scale(0.5)';
  recommendedBadge.style.opacity = '0';

  setTimeout(() => {
    recommendedBadge.style.transform = 'scale(1)';
    recommendedBadge.style.opacity = '1';
  }, 100);

  // 理由をタイプライター風にフェードイン
  recommendedReason.style.transition = 'opacity 0.5s ease-out';
  recommendedReason.style.opacity = '0';
  recommendedReason.textContent = reason;

  setTimeout(() => {
    recommendedReason.style.opacity = '1';
  }, 300);

  // コンテナ全体をスライドイン
  recommendedValueDiv.style.transition = 'all 0.5s ease-out';
  recommendedValueDiv.style.transform = 'translateY(20px)';
  recommendedValueDiv.style.opacity = '0';
  recommendedValueDiv.classList.remove('is-hidden');

  setTimeout(() => {
    recommendedValueDiv.style.transform = 'translateY(0)';
    recommendedValueDiv.style.opacity = '1';
  }, 50);

  // 複数パターン分析へのリンクを表示（歩留まり率の統計を表示している場合のみ）
  const multiPatternLink = qs('#multiPatternLink');
  if (multiPatternLink && statsType === 'yieldRate') {
    const hasYieldRateData = window.yieldStatsState.hasYieldRateData;
    const yieldRateStats = window.statsDataByType?.yieldRate;

    // データが十分にあるかチェック
    if (isSampleSizeValid && hasYieldRateData && yieldRateStats && yieldRateStats.count >= 2) {
      multiPatternLink.style.transition = 'opacity 0.3s ease-out';
      multiPatternLink.style.opacity = '0';
      multiPatternLink.classList.remove('is-hidden');

      setTimeout(() => {
        multiPatternLink.style.opacity = '1';
      }, 500);
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

    // サンプルサイズの妥当性をチェック
    const yieldRateValidation = window.yieldStatsState?.sampleSizeValidation?.yieldRate;
    const beforeWeightValidation = window.yieldStatsState?.sampleSizeValidation?.beforeWeight;
    const afterWeightValidation = window.yieldStatsState?.sampleSizeValidation?.afterWeight;

    // 歩留まり率の統計データが必須かつサンプルサイズが妥当である必要がある
    if (!yieldRateStats || yieldRateStats.count < 2 || (yieldRateValidation && !yieldRateValidation.isValid)) {
      loadStatsButtons.classList.add('is-hidden');
      loadStatsNoData.classList.remove('is-hidden');

      // サンプルサイズ不十分の場合は専用メッセージを表示
      if (yieldRateStats && yieldRateValidation && !yieldRateValidation.isValid) {
        loadStatsNoData.innerHTML = `
          <div class="no-data-message" style="padding: 1em; text-align: center; color: #dc3545;">
            <p style="margin: 0 0 0.5em 0; font-weight: bold;">⚠️ サンプルサイズが不十分です</p>
            <p style="margin: 0; font-size: 0.9em;">実際のサンプル数: ${yieldRateValidation.actualSize}、必要なサンプル数: ${yieldRateValidation.requiredSize}</p>
            <p style="margin: 0.5em 0 0 0; font-size: 0.9em;">より多くのデータを収集してから推奨値を使用してください。</p>
          </div>`;
      } else {
        loadStatsNoData.innerHTML = '<p style="text-align: center; padding: 1em; color: #6c757d;">歩留まり統計のデータがありません。<br>先に歩留まり統計で計算を実行してください。</p>';
      }

      if (generateSigmaPatternsSection) {
        generateSigmaPatternsSection.classList.add('is-hidden');
      }
      return;
    }

    // 推奨値を取得（妥当性チェック済み）
    const yieldRateRecommended = getRecommendedValue(yieldRateStats);
    const beforeWeightRecommended = beforeWeightStats && beforeWeightStats.count >= 2
      && (!beforeWeightValidation || beforeWeightValidation.isValid)
      ? getRecommendedValue(beforeWeightStats)
      : null;
    const afterWeightRecommended = afterWeightStats && afterWeightStats.count >= 2
      && (!afterWeightValidation || afterWeightValidation.isValid)
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
    bulkImportBtn.textContent = ' 推奨値を一括転記';

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

  // サンプルサイズの妥当性をチェック
  const validation = window.yieldStatsState?.sampleSizeValidation?.[selectedStatsType];

  if (stats && stats.count >= 2 && (!validation || validation.isValid)) {
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
    // データがない、またはサンプルサイズが不十分な場合、メッセージを表示
    loadStatsButtons.classList.add('is-hidden');
    loadStatsNoData.classList.remove('is-hidden');

    // サンプルサイズ不十分の場合は専用メッセージ
    if (stats && stats.count >= 2 && validation && !validation.isValid) {
      loadStatsNoData.innerHTML = `
        <div class="no-data-message" style="padding: 1em; text-align: center; color: #dc3545;">
          <p style="margin: 0 0 0.5em 0; font-weight: bold;">⚠️ サンプルサイズが不十分です</p>
          <p style="margin: 0; font-size: 0.9em;">実際のサンプル数: ${validation.actualSize}、必要なサンプル数: ${validation.requiredSize}</p>
          <p style="margin: 0.5em 0 0 0; font-size: 0.9em;">より多くのデータを収集してから推奨値を使用してください。</p>
        </div>`;
    } else {
      loadStatsNoData.innerHTML = '<p style="text-align: center; padding: 1em; color: #6c757d;">歩留まり統計のデータがありません。<br>先に歩留まり統計で計算を実行してください。</p>';
    }

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
