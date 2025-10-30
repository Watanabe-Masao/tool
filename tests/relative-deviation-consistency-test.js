/**
 * 相対偏差率と許容誤差・信頼水準に基づいた判定結果の整合性テスト
 *
 * このテストは、相対偏差率の計算とその判定ロジックが
 * 許容誤差および信頼水準と整合性が取れているかを検証します。
 */

// ========================================
// 問題の分析
// ========================================

/**
 * 現在の実装における2つの異なる概念：
 *
 * 1. 許容誤差（Tolerance Error, E）:
 *    - サンプルサイズ計算に使用: n = (Z × σ / E)²
 *    - 意味: 母平均の推定値の最大誤差
 *    - 例: E = 3.0% なら、真の母平均が 50% の場合、
 *          サンプル平均は 47%～53% の範囲に入る確率が高い
 *
 * 2. 相対偏差率（Relative Deviation）:
 *    - 個別データポイントの評価に使用: ((mean - value) / mean) × 100
 *    - 意味: 個別の測定値がサンプル平均からどれだけ離れているか
 *    - 例: 平均 = 50%, 個別値 = 48% なら、相対偏差率 = 4%
 *
 * 問題点：
 * 現在の判定ロジックは、個別データポイントの相対偏差率を
 * 母平均推定用の許容誤差と直接比較している。
 * これは統計的に正しくない比較である。
 *
 * 正しいアプローチ：
 * - 許容誤差: サンプルサイズの妥当性評価に使用
 * - 相対偏差率: 標準偏差またはz-scoreと比較して外れ値を判定
 */

// ========================================
// テスト用の統計計算関数
// ========================================

function calculateMean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values) {
  const mean = calculateMean(values);
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateRelativeDeviation(mean, value) {
  return ((mean - value) / mean) * 100;
}

function calculateRequiredSampleSize(stdDev, toleranceError, confidenceLevel) {
  const zValues = { 90: 1.645, 95: 1.960, 99: 2.576 };
  const z = zValues[confidenceLevel] || 1.960;
  const n = Math.pow((z * stdDev) / toleranceError, 2);
  return Math.ceil(n);
}

// ========================================
// 現在の判定ロジック（問題あり）
// ========================================

function currentJudgmentLogic(absDeviation, toleranceError) {
  if (absDeviation <= toleranceError * 2 / 3) {
    return { judgment: '✓ 非常に良好', color: '#1b5e20' };
  } else if (absDeviation <= toleranceError) {
    return { judgment: '○ 良好', color: '#388e3c' };
  } else if (absDeviation <= toleranceError * 2) {
    return { judgment: '△ 許容範囲', color: '#f57c00' };
  } else if (absDeviation <= toleranceError * 2.67) {
    return { judgment: '! 要注意', color: '#e64a19' };
  } else {
    return { judgment: '× 要改善', color: '#c62828' };
  }
}

// ========================================
// 推奨される判定ロジック（統計的に正しい）
// ========================================

function recommendedJudgmentLogic(value, mean, stdDev) {
  // z-scoreを計算: (value - mean) / stdDev
  const zScore = Math.abs((value - mean) / stdDev);

  if (zScore <= 1) {
    // ±1σ以内（68.3%のデータが含まれる）
    return { judgment: '✓ 非常に良好', color: '#1b5e20', reason: '1σ以内（68.3%範囲内）' };
  } else if (zScore <= 2) {
    // ±2σ以内（95.4%のデータが含まれる）
    return { judgment: '○ 良好', color: '#388e3c', reason: '2σ以内（95.4%範囲内）' };
  } else if (zScore <= 3) {
    // ±3σ以内（99.7%のデータが含まれる）
    return { judgment: '△ 注意', color: '#f57c00', reason: '3σ以内（99.7%範囲内）' };
  } else {
    // ±3σ外（外れ値の可能性が高い）
    return { judgment: '× 外れ値の可能性', color: '#c62828', reason: '3σ外（外れ値の可能性）' };
  }
}

// ========================================
// テストケース
// ========================================

console.log('=================================================');
console.log('相対偏差率と許容誤差の整合性テスト');
console.log('=================================================\n');

// テストデータ1: 正規分布に近いデータ
const testData1 = {
  name: 'テスト1: 正規分布に近いデータ（CV=5%）',
  yieldRates: [48.5, 49.0, 49.5, 50.0, 50.5, 51.0, 51.5, 52.0, 50.2, 49.8],
  toleranceError: 3.0,
  confidenceLevel: 95
};

// テストデータ2: ばらつきの大きいデータ
const testData2 = {
  name: 'テスト2: ばらつきの大きいデータ（CV=10%）',
  yieldRates: [45.0, 47.0, 49.0, 50.0, 51.0, 53.0, 55.0, 52.0, 48.0, 50.5],
  toleranceError: 3.0,
  confidenceLevel: 95
};

// テストデータ3: 外れ値を含むデータ
const testData3 = {
  name: 'テスト3: 外れ値を含むデータ',
  yieldRates: [49.0, 49.5, 50.0, 50.5, 51.0, 50.2, 49.8, 50.3, 65.0, 35.0],
  toleranceError: 3.0,
  confidenceLevel: 95
};

function runTest(testData) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(testData.name);
  console.log('='.repeat(60));

  const mean = calculateMean(testData.yieldRates);
  const stdDev = calculateStdDev(testData.yieldRates);
  const cv = (stdDev / mean) * 100;
  const requiredN = calculateRequiredSampleSize(stdDev, testData.toleranceError, testData.confidenceLevel);

  console.log(`\n【統計量】`);
  console.log(`サンプル数: ${testData.yieldRates.length}`);
  console.log(`平均値: ${mean.toFixed(2)}%`);
  console.log(`標準偏差: ${stdDev.toFixed(2)}%`);
  console.log(`変動係数(CV): ${cv.toFixed(2)}%`);
  console.log(`\n【サンプルサイズ妥当性】`);
  console.log(`許容誤差: ${testData.toleranceError}%`);
  console.log(`信頼水準: ${testData.confidenceLevel}%`);
  console.log(`必要サンプル数: ${requiredN}`);
  console.log(`判定: ${testData.yieldRates.length >= requiredN ? '✓ 妥当' : '× 不十分'}`);

  console.log(`\n【個別データポイントの評価】`);
  console.log(`${'値'.padEnd(10)}${'相対偏差率'.padEnd(20)}${'z-score'.padEnd(12)}${'現在の判定'.padEnd(20)}${'推奨判定'.padEnd(30)}`);
  console.log('-'.repeat(100));

  testData.yieldRates.forEach(value => {
    const relDev = calculateRelativeDeviation(mean, value);
    const absRelDev = Math.abs(relDev);
    const zScore = Math.abs((value - mean) / stdDev);
    const currentJudgment = currentJudgmentLogic(absRelDev, testData.toleranceError);
    const recommendedJudgment = recommendedJudgmentLogic(value, mean, stdDev);

    console.log(
      `${value.toFixed(1).padEnd(10)}` +
      `${relDev.toFixed(1).padEnd(20)}` +
      `${zScore.toFixed(2).padEnd(12)}` +
      `${currentJudgment.judgment.padEnd(20)}` +
      `${recommendedJudgment.judgment} (${recommendedJudgment.reason})`
    );
  });

  // 不整合の検出
  console.log(`\n【整合性チェック】`);
  let inconsistencies = 0;
  testData.yieldRates.forEach(value => {
    const relDev = calculateRelativeDeviation(mean, value);
    const absRelDev = Math.abs(relDev);
    const zScore = Math.abs((value - mean) / stdDev);
    const currentJudgment = currentJudgmentLogic(absRelDev, testData.toleranceError);
    const recommendedJudgment = recommendedJudgmentLogic(value, mean, stdDev);

    // 判定が大きく異なる場合（例: 現在が「良好」で推奨が「外れ値」）
    if ((currentJudgment.judgment.includes('良好') && recommendedJudgment.judgment.includes('外れ値')) ||
        (currentJudgment.judgment.includes('改善') && recommendedJudgment.judgment.includes('良好'))) {
      inconsistencies++;
      console.log(`⚠️  値 ${value.toFixed(1)}: 現在「${currentJudgment.judgment}」⇔ 推奨「${recommendedJudgment.judgment}」`);
    }
  });

  if (inconsistencies === 0) {
    console.log('✓ このデータセットでは大きな不整合は見られません');
  } else {
    console.log(`× ${inconsistencies}件の不整合が検出されました`);
  }
}

// 全テストを実行
[testData1, testData2, testData3].forEach(runTest);

// ========================================
// 結論と推奨事項
// ========================================

console.log(`\n\n${'='.repeat(80)}`);
console.log('結論と推奨事項');
console.log('='.repeat(80));

console.log(`
【問題点】
1. 許容誤差（E）は「母平均の推定誤差」を表す統計量であり、
   「個別データポイントの評価」に使用するのは統計的に不適切

2. 相対偏差率を許容誤差と比較すると、ばらつきの大きさ（標準偏差）が
   考慮されないため、正しい判定ができない

3. 例: CV=5%のデータで相対偏差率4%は正常値だが、
      CV=1%のデータで相対偏差率4%は明らかな外れ値
      → 現在のロジックでは両方とも同じ判定になる

【推奨される修正】

オプション1: z-scoreベースの判定（統計的に正しい）
---------------------------------------------------------
const zScore = Math.abs((value - mean) / stdDev);

if (zScore <= 1) {
  return '✓ 非常に良好（1σ以内、68.3%範囲内）';
} else if (zScore <= 2) {
  return '○ 良好（2σ以内、95.4%範囲内）';
} else if (zScore <= 3) {
  return '△ 注意（3σ以内、99.7%範囲内）';
} else {
  return '× 外れ値の可能性（3σ外）';
}

オプション2: CVを考慮した相対偏差率の判定
---------------------------------------------------------
const cv = (stdDev / mean) * 100;
const adjustedThreshold = toleranceError * (cv / 5.0); // CV=5%を基準に調整

if (absDeviation <= adjustedThreshold * 2/3) {
  return '✓ 非常に良好';
} else if (absDeviation <= adjustedThreshold) {
  return '○ 良好';
}
// ... 以下同様

【使い分け】
- サンプルサイズの妥当性評価: 許容誤差とサンプルサイズ計算式を使用（現在の実装は正しい）
- 個別データポイントの評価: z-scoreを使用（修正が必要）

【ユーザーへの説明】
現在「相対偏差率 vs 許容誤差」という表現は混乱を招く可能性があるため、
「z-score（標準偏差の何倍離れているか）」という表現に変更することを推奨します。
`);

console.log(`\n${'='.repeat(80)}`);
console.log('テスト完了');
console.log('='.repeat(80) + '\n');
