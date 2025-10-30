/**
 * 歩留まり統計: 統計計算モジュール
 *
 * このモジュールは純粋な統計計算関数を提供します。
 * 外部依存がなく、テスト可能な設計です。
 */

/**
 * 統計値を計算
 *
 * @param {number[]} values - 計算対象の数値配列
 * @returns {Object} 統計値を含むオブジェクト
 * @returns {number} return.count - データ数
 * @returns {number} return.mean - 平均値
 * @returns {number} return.median - 中央値
 * @returns {number} return.stdDev - 標準偏差（不偏標準偏差）
 * @returns {number} return.max - 最大値
 * @returns {number} return.min - 最小値
 * @returns {number} return.range - 範囲（最大値 - 最小値）
 * @returns {number} return.q1 - 第1四分位数
 * @returns {number} return.q3 - 第3四分位数
 * @returns {number} return.iqr - 四分位範囲
 * @returns {number} return.cv - 変動係数（％）
 * @returns {number} return.skewness - 歪度
 * @returns {number} return.kurtosis - 尖度（超過尖度）
 * @returns {Object} return.sigma1 - 1σ範囲 {lower, upper}
 * @returns {Object} return.sigma2 - 2σ範囲 {lower, upper}
 * @returns {Object} return.sigma3 - 3σ範囲 {lower, upper}
 * @returns {number[]} return.sorted - ソート済みデータ
 */
export function calculateStatistics(values) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);

  // 平均値
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // 標準偏差（不偏標準偏差を使用）
  // n=1の場合は標準偏差を0とする
  const variance = n > 1
    ? values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (n - 1)
    : 0;
  const stdDev = Math.sqrt(variance);

  // 中央値
  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  // 最大値・最小値
  const max = sorted[n - 1];
  const min = sorted[0];

  // 範囲
  const range = max - min;

  // 四分位数
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1; // 四分位範囲

  // 変動係数（CV）
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  // 歪度（Skewness）
  // 歪度の計算にはn >= 3が必要
  const skewness = (n >= 3 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / n
    : 0;

  // 尖度（Kurtosis）- 超過尖度
  // 尖度の計算にはn >= 4が必要
  const kurtosis = (n >= 4 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) / n - 3
    : 0;

  // σ範囲
  const sigma1 = { lower: mean - stdDev, upper: mean + stdDev };
  const sigma2 = { lower: mean - 2 * stdDev, upper: mean + 2 * stdDev };
  const sigma3 = { lower: mean - 3 * stdDev, upper: mean + 3 * stdDev };

  return {
    count: n,
    mean,
    median,
    stdDev,
    variance,  // 不偏分散も返す
    max,
    min,
    range,
    q1,
    q3,
    iqr,
    cv,
    skewness,
    kurtosis,
    sigma1,
    sigma2,
    sigma3,
    sorted // ソート済みデータも返す（グラフ描画用）
  };
}

/**
 * 外れ値を検出（IQR法）
 *
 * @param {number[]} values - 検査対象の数値配列
 * @param {Object} stats - calculateStatistics()の戻り値
 * @returns {Object} 外れ値と正常値の情報
 * @returns {number[]} return.outliers - 外れ値の配列
 * @returns {number[]} return.cleanedValues - 正常値の配列
 * @returns {number} return.lowerBound - 下限値
 * @returns {number} return.upperBound - 上限値
 */
export function detectOutliers(values, stats) {
  // IQR法: Q1 - 1.5*IQR より小さい、またはQ3 + 1.5*IQR より大きい値を外れ値とする
  const lowerBound = stats.q1 - 1.5 * stats.iqr;
  const upperBound = stats.q3 + 1.5 * stats.iqr;

  const outliers = [];
  const cleanedValues = [];

  values.forEach(value => {
    if (value < lowerBound || value > upperBound) {
      outliers.push(value);
    } else {
      cleanedValues.push(value);
    }
  });

  return {
    outliers,
    cleanedValues,
    lowerBound,
    upperBound
  };
}
