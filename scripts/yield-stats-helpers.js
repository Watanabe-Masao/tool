/**
 * 歩留まり統計: ヘルパー関数モジュール
 *
 * このモジュールは純粋な評価・計算関数を提供します。
 * 外部依存がなく、完全にテスト可能です。
 */

/**
 * 信頼性メッセージを取得
 *
 * @param {number} toleranceError - 許容誤差
 * @returns {Object} メッセージとクラス名を含むオブジェクト
 */
export function getConfidenceMessage(toleranceError) {
  if (toleranceError >= 1 && toleranceError <= 2) {
    return {
      message: '高精度：誤差範囲が狭く、非常に信頼性の高い推定が可能です',
      className: 'confidence-high'
    };
  } else if (toleranceError >= 3 && toleranceError <= 4) {
    return {
      message: '標準精度：一般的な分析に適した精度です',
      className: 'confidence-standard'
    };
  } else if (toleranceError >= 5 && toleranceError <= 6) {
    return {
      message: '低精度：誤差範囲が広く、精度が低くなります',
      className: 'confidence-low'
    };
  } else if (toleranceError >= 7 && toleranceError <= 8) {
    return {
      message: '非常に低い精度：誤差範囲が非常に広く、推定の信頼性が限定的です',
      className: 'confidence-very-low'
    };
  } else if (toleranceError > 8) {
    return {
      message: '精度不足：誤差範囲が大きすぎるため、推定の信頼性が著しく低下します',
      className: 'confidence-insufficient'
    };
  } else {
    return {
      message: '高精度：誤差範囲が狭く、非常に信頼性の高い推定が可能です',
      className: 'confidence-high'
    };
  }
}

/**
 * サンプル数とCVに基づくマトリックス評価を取得
 *
 * @param {number} n - サンプル数
 * @param {number} cv - 変動係数（%）
 * @returns {Object} 評価メッセージ、クラス名、レベルを含むオブジェクト
 */
export function getMatrixEvaluation(n, cv) {
  // サンプル数の範囲を判定
  let sampleRange;
  if (n <= 5) {
    sampleRange = 'n5';
  } else if (n >= 10 && n <= 20) {
    sampleRange = 'n10-20';
  } else if (n >= 30 && n <= 50) {
    sampleRange = 'n30-50';
  } else if (n >= 100) {
    sampleRange = 'n100+';
  } else {
    // 6-9, 21-29, 51-99の場合は近い範囲にマッピング
    if (n < 10) {
      sampleRange = 'n5';
    } else if (n < 30) {
      sampleRange = 'n10-20';
    } else if (n < 100) {
      sampleRange = 'n30-50';
    }
  }

  // CVの範囲を判定
  let cvRange;
  if (cv < 10) {
    cvRange = 'cv0-10';
  } else if (cv >= 10 && cv < 20) {
    cvRange = 'cv10-20';
  } else if (cv >= 20 && cv < 30) {
    cvRange = 'cv20-30';
  } else {
    cvRange = 'cv30+';
  }

  // マトリックスに基づく評価
  const evaluations = {
    'n5': {
      'cv0-10': {
        message: '目安レベル。参考値のみ（データ不足）',
        className: 'matrix-eval-caution',
        level: 'caution'
      },
      'cv10-20': {
        message: '目安レベル。参考値のみ',
        className: 'matrix-eval-caution',
        level: 'caution'
      },
      'cv20-30': {
        message: '不安定。外れ値の影響大',
        className: 'matrix-eval-warning',
        level: 'warning'
      },
      'cv30+': {
        message: '信頼性極めて低い。再測定推奨',
        className: 'matrix-eval-danger',
        level: 'danger'
      }
    },
    'n10-20': {
      'cv0-10': {
        message: 'やや安定。概ね良好',
        className: 'matrix-eval-good',
        level: 'good'
      },
      'cv10-20': {
        message: '概ね安定。傾向把握可',
        className: 'matrix-eval-good',
        level: 'good'
      },
      'cv20-30': {
        message: 'ばらつきあり。原因分析要',
        className: 'matrix-eval-warning',
        level: 'warning'
      },
      'cv30+': {
        message: 'データ再収集を推奨',
        className: 'matrix-eval-danger',
        level: 'danger'
      }
    },
    'n30-50': {
      'cv0-10': {
        message: '安定。統計的に信頼できる',
        className: 'matrix-eval-excellent',
        level: 'excellent'
      },
      'cv10-20': {
        message: '安定。品質問題は小',
        className: 'matrix-eval-excellent',
        level: 'excellent'
      },
      'cv20-30': {
        message: 'ややばらつきあり。改善検討',
        className: 'matrix-eval-good',
        level: 'good'
      },
      'cv30+': {
        message: '不安定。工程見直し必要',
        className: 'matrix-eval-warning',
        level: 'warning'
      }
    },
    'n100+': {
      'cv0-10': {
        message: '非常に安定。精度高い推定可能',
        className: 'matrix-eval-excellent',
        level: 'excellent'
      },
      'cv10-20': {
        message: '高信頼性。管理値設定可',
        className: 'matrix-eval-excellent',
        level: 'excellent'
      },
      'cv20-30': {
        message: '安定。制御強化で改善可',
        className: 'matrix-eval-good',
        level: 'good'
      },
      'cv30+': {
        message: '要改善。重大なばらつきの可能性',
        className: 'matrix-eval-warning',
        level: 'warning'
      }
    }
  };

  return evaluations[sampleRange][cvRange];
}

/**
 * 必要サンプルサイズを計算
 *
 * @param {number} stdDev - 標準偏差
 * @param {number} toleranceError - 許容誤差（E）
 * @param {number} confidenceLevel - 信頼水準（90, 95, 99）
 * @returns {number} 必要サンプルサイズ
 */
export function calculateRequiredSampleSize(stdDev, toleranceError, confidenceLevel) {
  // 標準偏差がゼロの場合（全データが同じ値）は計算不要
  if (stdDev === 0) {
    return 1; // 最小サンプルサイズ
  }

  // Z値のマッピング
  const zValues = {
    90: 1.645,
    95: 1.960,
    99: 2.576
  };

  const z = zValues[confidenceLevel] || 1.960;

  // n = (Z * s / E)²
  const n = Math.pow((z * stdDev) / toleranceError, 2);

  return Math.ceil(n); // 切り上げ
}

/**
 * 歩留まり統計データが有効かチェック
 * 少なくとも1つのデータタイプに2つ以上のデータポイントがあるか確認
 *
 * @param {Object} data - 歩留まり統計データ
 * @param {number[]} data.yieldRate - 歩留まり率の配列
 * @param {number[]} data.beforeWeight - 加工前重量の配列
 * @param {number[]} data.afterWeight - 加工後重量の配列
 * @returns {boolean} データが有効な場合true
 */
export function hasValidYieldStatsData(data) {
  if (!data) return false;

  // 少なくとも1つのデータタイプに2つ以上のデータポイントがあるかチェック
  const hasYieldRate = data.yieldRate && data.yieldRate.length >= 2;
  const hasBeforeWeight = data.beforeWeight && data.beforeWeight.length >= 2;
  const hasAfterWeight = data.afterWeight && data.afterWeight.length >= 2;

  return hasYieldRate || hasBeforeWeight || hasAfterWeight;
}
