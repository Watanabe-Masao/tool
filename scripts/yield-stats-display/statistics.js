/**
 * 歩留まり統計: 統計値表示モジュール
 *
 * 基本統計量とマトリックス評価の表示を担当します。
 * UX改善: フェードイン/スライドアップアニメーション付き
 */

import { qs } from '../dom-utils.js';
import { toFixed, pct } from '../dom-utils.js';
import { getMatrixEvaluation } from '../yield-stats-helpers.js';

/**
 * マトリックス評価を表示（UX改善版: アニメーション付き）
 * @param {Object} stats - 統計情報
 */
export function displayMatrixEvaluation(stats) {
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
    'poor': '⚠️'
  };
  const icon = icons[evaluation.className] || '';

  messageDiv.innerHTML = `<span class="matrix-icon">${icon}</span> ${evaluation.message}`;
  messageDiv.className = `matrix-eval-message ${evaluation.className}`;

  // メッセージもフェードイン
  messageDiv.style.animation = 'fadeInUp 0.5s ease-out';
}

/**
 * 統計値を表示（UX改善版: フェードインアニメーション付き）
 * @param {Object} stats - 統計情報
 * @param {string} unit - 単位（デフォルト: '%'）
 */
export function displayStatistics(stats, unit = '%') {
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

  // 基本統計量（段階的にフェードイン - 50msずつずらす）
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
