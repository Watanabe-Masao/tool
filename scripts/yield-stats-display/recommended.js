/**
 * 歩留まり統計: 推奨代表値モジュール
 *
 * 統計データに基づいて推奨される代表値（平均値または中央値）を判定・表示します。
 * UX改善: スケールアニメーション、アイコン付きバッジ、スライドイン
 */

import { qs } from '../dom-utils.js';
import { toFixed, pct } from '../dom-utils.js';
import { appState } from '../state.js';

/**
 * 推奨代表値を取得
 * @param {Object} stats - 統計データ
 * @returns {Object|null} {type: 'mean'|'median', value: number, label: string}
 */
export function getRecommendedValue(stats) {
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
 * 推奨代表値を表示（UX改善版: スケールアニメーション付き）
 * @param {Object} stats - 統計データ
 * @param {boolean} isSampleSizeValid - サンプルサイズが妥当かどうか
 * @param {string} statsType - 統計タイプ（'yieldRate', 'beforeWeight', 'afterWeight'）
 */
export function displayRecommendedValue(stats, isSampleSizeValid, statsType = 'yieldRate') {
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
    const hasYieldRateData = appState.hasYieldStatsDataByType('yieldRate');
    const yieldRateStats = appState.getCalculatedStats('yieldRate');

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
