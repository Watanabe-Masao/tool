/**
 * 統計UI補助モジュール
 * 統計マトリックス評価、推奨値表示、σパターン生成
 * UX改善：視覚的なマトリックス、カラーコーディング、アイコン
 */

import { qs, pct, toFixed } from './dom-utils.js';
import { getMatrixEvaluation } from './yield-stats-helpers.js';

/**
 * サンプル数×CV評価マトリックスを表示（UX改善版）
 * @param {Object} stats - 統計データ
 */
export function displayMatrixEvaluation(stats) {
  const matrixDiv = qs('#matrixEvaluation');
  if (!matrixDiv) {
    return;
  }

  const evaluation = getMatrixEvaluation(stats.count, stats.cv);

  if (matrixDiv) {
    // ビジュアル改善：アイコンとカラーコーディング
    const icon = evaluation.className === 'excellent' ? '🌟' :
                 evaluation.className === 'good' ? '✓' :
                 evaluation.className === 'fair' ? '⚡' : '[警告] ';

    matrixDiv.innerHTML = `
      <div class="matrix-badge ${evaluation.className}">
        <span class="matrix-icon">${icon}</span>
        <span class="matrix-label">${evaluation.label}</span>
      </div>
      <div class="matrix-message">${evaluation.message}</div>
    `;
    matrixDiv.className = `matrix-evaluation ${evaluation.className}`;

    // アニメーション効果
    matrixDiv.style.animation = 'fadeInUp 0.5s ease-out';
  }
}

/**
 * 推奨代表値を計算（改善版）
 * @param {Object} stats - 統計データ
 * @returns {Object|null} {value, label, description}
 */
export function getRecommendedValue(stats) {
  if (!stats || stats.count < 2) {
    return null;
  }

  const { mean, median, cv, skewness } = stats;

  // 変動係数（CV）による判定
  const isLowVariation = cv < 5;  // CV < 5%は低変動
  const isHighVariation = cv > 15; // CV > 15%は高変動

  // 歪度による判定
  const isSkewed = Math.abs(skewness) > 0.5;

  // 推奨値の決定ロジック
  if (isHighVariation || isSkewed) {
    // 変動が大きい、または歪みがある場合は中央値を推奨
    return {
      value: median,
      label: '中央値',
      description: '外れ値や歪みに強い代表値。変動が大きい場合に推奨。',
      icon: '',
      reason: isHighVariation ? 'CV > 15%のため' : '歪度が大きいため'
    };
  } else {
    // 変動が小さく、正規分布に近い場合は平均値を推奨
    return {
      value: mean,
      label: '平均値',
      description: 'データ全体の傾向を反映。安定したデータに最適。',
      icon: '',
      reason: 'データが安定しているため'
    };
  }
}

/**
 * σパターンを生成（改善版）
 * @param {Object} stats - 統計データ
 * @param {number} sigmaRange - σの範囲（デフォルト2）
 * @returns {Array} パターンの配列
 */
export function generateSigmaPatterns(stats, sigmaRange = 2) {
  if (!stats || stats.count < 2) {
    return [];
  }

  const patterns = [];
  const { mean, stdDev } = stats;

  // -2σ, -1σ, 平均, +1σ, +2σ のパターンを生成
  for (let i = -sigmaRange; i <= sigmaRange; i++) {
    const value = mean + (i * stdDev);

    // 負の値は除外（歩留まり率や重量は正の値）
    if (value >= 0) {
      patterns.push({
        label: i === 0 ? '平均値' : `平均${i > 0 ? '+' : ''}${i}σ`,
        value: value,
        sigma: i,
        description: getSigmaDescription(i)
      });
    }
  }

  return patterns;
}

/**
 * σに応じた説明文を取得
 * @param {number} sigma - σ値
 * @returns {string} 説明文
 */
function getSigmaDescription(sigma) {
  if (sigma === 0) return '中心値（最も標準的な値）';
  if (sigma === -2) return '非常に低い値（約2.5%の確率）';
  if (sigma === -1) return '低めの値（約16%の確率）';
  if (sigma === 1) return '高めの値（約16%の確率）';
  if (sigma === 2) return '非常に高い値（約2.5%の確率）';
  return '';
}

/**
 * 推奨値を視覚的に表示（UX大幅改善版）
 * @param {Object} stats - 統計データ
 * @param {boolean} isSampleSizeValid - サンプルサイズが妥当か
 * @param {string} statsType - 統計タイプ
 */
export function displayRecommendedValue(stats, isSampleSizeValid, statsType = 'yieldRate') {
  const recommendedValueDiv = qs('#recommendedValue');
  const recommendedValueSpan = qs('#recommendedValueNumber');
  const recommendedValueLabel = qs('#recommendedValueLabel');
  const recommendedDescription = qs('#recommendedDescription');

  if (!recommendedValueDiv) {
    return;
  }

  // サンプルサイズが不十分な場合は警告を表示
  if (!isSampleSizeValid) {
    recommendedValueDiv.innerHTML = `
      <div class="recommended-warning">
        <span class="warning-icon">[警告] </span>
        <div class="warning-content">
          <strong>サンプルサイズが不十分です</strong>
          <p>より多くのデータを収集してから推奨値を参照してください。</p>
        </div>
      </div>
    `;
    recommendedValueDiv.classList.remove('is-hidden');
    recommendedValueDiv.style.animation = 'fadeIn 0.5s ease-out';
    return;
  }

  const recommended = getRecommendedValue(stats);

  if (!recommended) {
    recommendedValueDiv.classList.add('is-hidden');
    return;
  }

  // 単位
  const unit = statsType === 'yieldRate' ? '%' : 'g';

  // 推奨値を表示
  if (recommendedValueSpan) {
    recommendedValueSpan.textContent = unit === '%' ?
      pct(toFixed(recommended.value)) :
      `${toFixed(recommended.value)}${unit}`;
    recommendedValueSpan.className = `recommended-value-number ${recommended.label === '中央値' ? 'median' : 'mean'}`;
    recommendedValueSpan.style.animation = 'scaleIn 0.5s ease-out';
  }

  if (recommendedValueLabel) {
    recommendedValueLabel.innerHTML = `
      <span class="recommended-icon">${recommended.icon}</span>
      ${recommended.label}
      <span class="recommended-reason">${recommended.reason}</span>
    `;
    recommendedValueLabel.style.animation = 'fadeInUp 0.5s ease-out 0.1s both';
  }

  if (recommendedDescription) {
    recommendedDescription.textContent = recommended.description;
    recommendedDescription.style.animation = 'fadeInUp 0.5s ease-out 0.2s both';
  }

  // σパターン生成セクションの表示/非表示
  const generateSigmaPatternsSection = qs('#generateSigmaPatternsSection');
  if (generateSigmaPatternsSection) {
    if (isSampleSizeValid && stats.count >= 3) {
      generateSigmaPatternsSection.classList.remove('is-hidden');
      generateSigmaPatternsSection.style.animation = 'fadeInUp 0.5s ease-out 0.3s both';
    } else {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }
  }

  recommendedValueDiv.classList.remove('is-hidden');
  recommendedValueDiv.style.animation = 'fadeIn 0.5s ease-out';
}

/**
 * 統計値を表示（UX改善版）
 * @param {Object} stats - 統計データ
 * @param {string} unit - 単位
 */
export function displayStatistics(stats, unit = '%') {
  const elements = {
    count: qs('#statsCount'),
    mean: qs('#statsMean'),
    median: qs('#statsMedian'),
    stdDev: qs('#statsStdDev'),
    cv: qs('#statsCV'),
    rsd: qs('#statsRSD'),
    min: qs('#statsMin'),
    max: qs('#statsMax'),
    range: qs('#statsRange'),
    q1: qs('#statsQ1'),
    q3: qs('#statsQ3'),
    iqr: qs('#statsIQR')
  };

  // フォーマット関数
  const format = (value) => {
    if (unit === '%') {
      return pct(toFixed(value));
    } else {
      return `${toFixed(value)}${unit}`;
    }
  };

  // 各統計値を表示（アニメーション付き）
  let delay = 0;
  Object.entries(elements).forEach(([key, element]) => {
    if (element && stats[key] !== undefined) {
      const value = key === 'count' ? stats[key] :
                    key === 'cv' || key === 'rsd' ? pct(toFixed(stats[key])) :
                    format(stats[key]);

      element.textContent = value;
      element.style.animation = `fadeInUp 0.4s ease-out ${delay}s both`;
      delay += 0.05;
    }
  });
}

/**
 * CSSアニメーションを追加（初回のみ）
 */
function addAnimationStyles() {
  if (document.getElementById('stats-ui-animations')) {
    return;
  }

  const style = document.createElement('style');
  style.id = 'stats-ui-animations';
  style.textContent = `
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes scaleIn {
      from {
        opacity: 0;
        transform: scale(0.8);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes countUp {
      from { transform: scale(1.2); opacity: 0.5; }
      to { transform: scale(1); opacity: 1; }
    }

    .matrix-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: bold;
      margin-bottom: 8px;
    }

    .matrix-badge.excellent {
      background: linear-gradient(135deg, #4caf50 0%, #45a049 100%);
      color: white;
    }

    .matrix-badge.good {
      background: linear-gradient(135deg, #2196f3 0%, #1976d2 100%);
      color: white;
    }

    .matrix-badge.fair {
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      color: white;
    }

    .matrix-badge.poor {
      background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
      color: white;
    }

    .recommended-warning {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: #fff3cd;
      border-left: 4px solid #ffc107;
      border-radius: 8px;
    }

    .warning-icon {
      font-size: 24px;
    }

    .warning-content strong {
      color: #856404;
      display: block;
      margin-bottom: 4px;
    }

    .warning-content p {
      color: #856404;
      margin: 0;
    }

    .recommended-value-number {
      font-size: 32px;
      font-weight: bold;
      color: #2196f3;
    }

    .recommended-value-number.median {
      color: #9c27b0;
    }

    .recommended-reason {
      font-size: 12px;
      color: #666;
      margin-left: 8px;
    }

    .highlight {
      color: #f44336;
      font-weight: bold;
    }
  `;
  document.head.appendChild(style);
}

// 初期化時にアニメーションスタイルを追加
addAnimationStyles();
