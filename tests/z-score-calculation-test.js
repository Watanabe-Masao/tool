/**
 * z-score計算の検証テスト
 *
 * 修正後のロジックが正しくz-scoreを計算し、
 * 適切な判定を行うことを確認します。
 */

// テスト用の統計計算関数
function calculateMean(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values) {
  const mean = calculateMean(values);
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.sqrt(variance);
}

function calculateZScore(value, mean, stdDev) {
  return (value - mean) / stdDev;
}

function getJudgment(absZScore) {
  if (absZScore <= 1) {
    return { judgment: '✓ 非常に良好', color: '#1b5e20', range: '68%範囲内' };
  } else if (absZScore <= 2) {
    return { judgment: '○ 良好', color: '#388e3c', range: '95%範囲内' };
  } else if (absZScore <= 3) {
    return { judgment: '△ 注意', color: '#f57c00', range: '99.7%範囲内' };
  } else {
    return { judgment: '× 外れ値の可能性', color: '#c62828', range: '外れ値の可能性' };
  }
}

console.log('='.repeat(80));
console.log('z-score計算の検証テスト');
console.log('='.repeat(80));

// テストケース1: 正規分布に近いデータ
console.log('\n【テストケース1: 正規分布に近いデータ】');
const testData1 = [48.5, 49.0, 49.5, 50.0, 50.5, 51.0, 51.5, 52.0, 50.2, 49.8];
const mean1 = calculateMean(testData1);
const stdDev1 = calculateStdDev(testData1);

console.log(`平均値: ${mean1.toFixed(2)}%`);
console.log(`標準偏差: ${stdDev1.toFixed(2)}%`);
console.log(`\n個別値のz-scoreと判定:`);
console.log(`${'値'.padEnd(10)}${'z-score'.padEnd(15)}${'判定'.padEnd(20)}${'範囲'}`);
console.log('-'.repeat(70));

testData1.forEach(value => {
  const zScore = calculateZScore(value, mean1, stdDev1);
  const absZScore = Math.abs(zScore);
  const result = getJudgment(absZScore);
  console.log(
    `${value.toFixed(1).padEnd(10)}` +
    `${zScore.toFixed(2).padEnd(15)}` +
    `${result.judgment.padEnd(20)}` +
    `${result.range}`
  );
});

// テストケース2: ばらつきの大きいデータ
console.log('\n\n【テストケース2: ばらつきの大きいデータ】');
const testData2 = [45.0, 47.0, 49.0, 50.0, 51.0, 53.0, 55.0, 52.0, 48.0, 50.5];
const mean2 = calculateMean(testData2);
const stdDev2 = calculateStdDev(testData2);

console.log(`平均値: ${mean2.toFixed(2)}%`);
console.log(`標準偏差: ${stdDev2.toFixed(2)}%`);
console.log(`\n個別値のz-scoreと判定:`);
console.log(`${'値'.padEnd(10)}${'z-score'.padEnd(15)}${'判定'.padEnd(20)}${'範囲'}`);
console.log('-'.repeat(70));

testData2.forEach(value => {
  const zScore = calculateZScore(value, mean2, stdDev2);
  const absZScore = Math.abs(zScore);
  const result = getJudgment(absZScore);
  console.log(
    `${value.toFixed(1).padEnd(10)}` +
    `${zScore.toFixed(2).padEnd(15)}` +
    `${result.judgment.padEnd(20)}` +
    `${result.range}`
  );
});

// テストケース3: 外れ値を含むデータ
console.log('\n\n【テストケース3: 外れ値を含むデータ】');
const testData3 = [49.0, 49.5, 50.0, 50.5, 51.0, 50.2, 49.8, 50.3, 65.0, 35.0];
const mean3 = calculateMean(testData3);
const stdDev3 = calculateStdDev(testData3);

console.log(`平均値: ${mean3.toFixed(2)}%`);
console.log(`標準偏差: ${stdDev3.toFixed(2)}%`);
console.log(`\n個別値のz-scoreと判定:`);
console.log(`${'値'.padEnd(10)}${'z-score'.padEnd(15)}${'判定'.padEnd(20)}${'範囲'}`);
console.log('-'.repeat(70));

testData3.forEach(value => {
  const zScore = calculateZScore(value, mean3, stdDev3);
  const absZScore = Math.abs(zScore);
  const result = getJudgment(absZScore);
  console.log(
    `${value.toFixed(1).padEnd(10)}` +
    `${zScore.toFixed(2).padEnd(15)}` +
    `${result.judgment.padEnd(20)}` +
    `${result.range}`
  );
});

// 統計的妥当性の確認
console.log('\n\n' + '='.repeat(80));
console.log('統計的妥当性の確認');
console.log('='.repeat(80));

function countInRange(values, mean, stdDev, sigmaRange) {
  let count = 0;
  values.forEach(value => {
    const zScore = Math.abs((value - mean) / stdDev);
    if (zScore <= sigmaRange) {
      count++;
    }
  });
  return count;
}

[
  { name: 'テストケース1', data: testData1, mean: mean1, stdDev: stdDev1 },
  { name: 'テストケース2', data: testData2, mean: mean2, stdDev: stdDev2 },
  { name: 'テストケース3', data: testData3, mean: mean3, stdDev: stdDev3 }
].forEach(testCase => {
  console.log(`\n${testCase.name}:`);

  const within1Sigma = countInRange(testCase.data, testCase.mean, testCase.stdDev, 1);
  const within2Sigma = countInRange(testCase.data, testCase.mean, testCase.stdDev, 2);
  const within3Sigma = countInRange(testCase.data, testCase.mean, testCase.stdDev, 3);

  const total = testCase.data.length;

  console.log(`  ±1σ以内: ${within1Sigma}/${total} (${(within1Sigma/total*100).toFixed(1)}%) 理論値: 68.3%`);
  console.log(`  ±2σ以内: ${within2Sigma}/${total} (${(within2Sigma/total*100).toFixed(1)}%) 理論値: 95.4%`);
  console.log(`  ±3σ以内: ${within3Sigma}/${total} (${(within3Sigma/total*100).toFixed(1)}%) 理論値: 99.7%`);
});

console.log('\n' + '='.repeat(80));
console.log('テスト完了');
console.log('='.repeat(80) + '\n');

console.log('\n✅ 修正内容:');
console.log('1. 相対偏差率の計算をz-scoreの計算に変更');
console.log('2. 判定基準を許容誤差ベースからz-scoreベースに変更');
console.log('3. 判定閾値: ±1σ(非常に良好) / ±2σ(良好) / ±3σ(注意) / 3σ外(外れ値の可能性)');
console.log('4. 標準偏差を考慮した統計的に正しい判定を実現');
console.log('\n📊 期待される効果:');
console.log('- ばらつきの大きさ（標準偏差）を考慮した適切な判定');
console.log('- 確率的な解釈が可能（68%、95%、99.7%範囲）');
console.log('- データのばらつきに応じた動的な判定基準');
console.log('- 外れ値検出の標準的な統計手法との整合性');
