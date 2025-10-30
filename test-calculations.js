/**
 * 計算ロジックの正確性テスト
 * Node.js環境で実行
 *
 * 実行方法: node test-calculations.js
 */

// ========================================
// テストヘルパー関数
// ========================================

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(description, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✅ Test ${testCount}: ${description}`);
  } catch (error) {
    failCount++;
    console.log(`❌ Test ${testCount}: ${description}`);
    console.log(`   Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

function assertAlmostEquals(actual, expected, tolerance = 0.01, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message || `Expected ${expected} (±${tolerance}), but got ${actual}`);
  }
}

// ========================================
// 計算関数の実装（scripts/calculation.js から）
// ========================================

const toFixed = (n, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : null;

function calcYield(beforeWeightG, afterWeightG) {
  if (!isPositive(beforeWeightG) || !isPositive(afterWeightG)) return null;
  return (afterWeightG / beforeWeightG) * 100;
}

function per100FromPerUnit(valuePerUnit, unitWeightG) {
  if (!isPositive(unitWeightG)) return null;
  return (valuePerUnit / unitWeightG) * 100;
}

function per100FromBox(totalValue, boxWeightKg) {
  if (!isPositive(boxWeightKg)) return null;
  const grams = boxWeightKg * 1000;
  return (totalValue / grams) * 100;
}

function afterCostPer100(beforeCostPer100, yieldRatePct) {
  if (!isPositive(beforeCostPer100) || !isPositive(yieldRatePct)) return null;
  return beforeCostPer100 / (yieldRatePct / 100);
}

function markup(costPer100, pricePer100) {
  if (!isPositive(pricePer100) || !isNonNegative(costPer100)) return null;
  return ((pricePer100 - costPer100) / pricePer100) * 100;
}

function grossFromMarkup(markupPct, discountPct = 0) {
  const m = markupPct / 100;
  const d = discountPct / 100;
  if (!isNonNegative(m) || !isNonNegative(d) || d >= 1) return 0;
  return ((m - d) / (1 - d)) * 100;
}

function finishedPriceFromAp(apPer100, finishedWeightG) {
  if (!isPositive(apPer100) || !isPositive(finishedWeightG)) return null;
  return apPer100 * (finishedWeightG / 100);
}

function isPositive(n) { return Number.isFinite(n) && n > 0; }
function isNonNegative(n) { return Number.isFinite(n) && n >= 0; }

// ========================================
// 統計計算関数（scripts/main.js から）
// ========================================

function calculateStatistics(values) {
  const n = values.length;

  if (n === 0) {
    return null;
  }

  if (n === 1) {
    const value = values[0];
    return {
      n: 1,
      mean: value,
      stdDev: 0,
      median: value,
      max: value,
      min: value,
      range: 0,
      q1: value,
      q3: value,
      iqr: 0,
      cv: 0,
      skewness: 0,
      kurtosis: 0
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  // 平均値
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // 不偏標準偏差
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
  const iqr = q3 - q1;

  // 変動係数（CV）
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  // 歪度（Skewness）
  const skewness = (n >= 3 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / n
    : 0;

  // 尖度（Kurtosis）
  const kurtosis = (n >= 4 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) / n - 3
    : 0;

  return {
    n,
    mean,
    stdDev,
    median,
    max,
    min,
    range,
    q1,
    q3,
    iqr,
    cv,
    skewness,
    kurtosis
  };
}

// ========================================
// 歩留まり率計算テスト
// ========================================

console.log('\n========================================');
console.log('歩留まり率計算テスト');
console.log('========================================\n');

test('基本的な歩留まり率計算: 100g → 80g = 80%', () => {
  const result = calcYield(100, 80);
  assertAlmostEquals(result, 80, 0.01, '歩留まり率は80%であるべき');
});

test('歩留まり率100%超過: 100g → 120g = 120%（水分吸収ケース）', () => {
  const result = calcYield(100, 120);
  assertAlmostEquals(result, 120, 0.01, '歩留まり率は120%であるべき');
});

test('実際の食材例: 鶏肉200g → 骨除去後160g = 80%', () => {
  const result = calcYield(200, 160);
  assertAlmostEquals(result, 80, 0.01, '歩留まり率は80%であるべき');
});

test('小数点を含む重量: 123.45g → 98.76g', () => {
  const result = calcYield(123.45, 98.76);
  assertAlmostEquals(result, 80.0, 0.1, '歩留まり率は約80%であるべき');
});

test('負の重量はnullを返す', () => {
  const result = calcYield(-100, 80);
  assertEquals(result, null, '負の重量ではnullを返すべき');
});

test('0の重量はnullを返す', () => {
  const result = calcYield(0, 80);
  assertEquals(result, null, 'ゼロ重量ではnullを返すべき');
});

// ========================================
// 100gあたり原価・売価計算テスト
// ========================================

console.log('\n========================================');
console.log('100gあたり原価・売価計算テスト');
console.log('========================================\n');

test('定額モード: 1個150円、200g → 100gあたり75円', () => {
  const result = per100FromPerUnit(150, 200);
  assertAlmostEquals(result, 75, 0.01, '100gあたり75円であるべき');
});

test('定額モード: 1個198円、100g → 100gあたり198円', () => {
  const result = per100FromPerUnit(198, 100);
  assertAlmostEquals(result, 198, 0.01, '100gあたり198円であるべき');
});

test('計量モード: 1箱5000円、10kg → 100gあたり50円', () => {
  const result = per100FromBox(5000, 10);
  assertAlmostEquals(result, 50, 0.01, '100gあたり50円であるべき');
});

test('計量モード: 1箱3000円、5kg → 100gあたり60円', () => {
  const result = per100FromBox(3000, 5);
  assertAlmostEquals(result, 60, 0.01, '100gあたり60円であるべき');
});

// ========================================
// 加工後原価計算テスト
// ========================================

console.log('\n========================================');
console.log('加工後原価計算テスト');
console.log('========================================\n');

test('加工前100gあたり50円、歩留まり率80% → 加工後62.5円', () => {
  const result = afterCostPer100(50, 80);
  assertAlmostEquals(result, 62.5, 0.01, '加工後原価は62.5円であるべき');
});

test('加工前100gあたり100円、歩留まり率50% → 加工後200円', () => {
  const result = afterCostPer100(100, 50);
  assertAlmostEquals(result, 200, 0.01, '加工後原価は200円であるべき');
});

test('歩留まり率100%の場合、原価は変わらない', () => {
  const result = afterCostPer100(75, 100);
  assertAlmostEquals(result, 75, 0.01, '加工後原価は75円であるべき');
});

// ========================================
// 値入率（マークアップ）計算テスト
// ========================================

console.log('\n========================================');
console.log('値入率（マークアップ）計算テスト');
console.log('========================================\n');

test('原価50円、売価100円 → 値入率50%', () => {
  const result = markup(50, 100);
  assertAlmostEquals(result, 50, 0.01, '値入率は50%であるべき');
});

test('原価75円、売価100円 → 値入率25%', () => {
  const result = markup(75, 100);
  assertAlmostEquals(result, 25, 0.01, '値入率は25%であるべき');
});

test('原価80円、売価120円 → 値入率33.33%', () => {
  const result = markup(80, 120);
  assertAlmostEquals(result, 33.33, 0.01, '値入率は約33.33%であるべき');
});

test('原価と売価が同じ場合 → 値入率0%', () => {
  const result = markup(100, 100);
  assertAlmostEquals(result, 0, 0.01, '値入率は0%であるべき');
});

// ========================================
// 粗利率計算テスト
// ========================================

console.log('\n========================================');
console.log('粗利率計算テスト');
console.log('========================================\n');

test('値入率50%、値引き0% → 粗利率50%', () => {
  const result = grossFromMarkup(50, 0);
  assertAlmostEquals(result, 50, 0.01, '粗利率は50%であるべき');
});

test('値入率50%、値引き10% → 粗利率44.44%', () => {
  const result = grossFromMarkup(50, 10);
  assertAlmostEquals(result, 44.44, 0.1, '粗利率は約44.44%であるべき');
});

test('値入率30%、値引き5% → 粗利率26.32%', () => {
  const result = grossFromMarkup(30, 5);
  assertAlmostEquals(result, 26.32, 0.1, '粗利率は約26.32%であるべき');
});

// ========================================
// 仕上がり価格計算テスト
// ========================================

console.log('\n========================================');
console.log('仕上がり価格計算テスト');
console.log('========================================\n');

test('100gあたり150円、仕上がり重量200g → 300円', () => {
  const result = finishedPriceFromAp(150, 200);
  assertAlmostEquals(result, 300, 0.01, '仕上がり価格は300円であるべき');
});

test('100gあたり198円、仕上がり重量160g → 316.8円', () => {
  const result = finishedPriceFromAp(198, 160);
  assertAlmostEquals(result, 316.8, 0.01, '仕上がり価格は316.8円であるべき');
});

// ========================================
// 統計計算テスト
// ========================================

console.log('\n========================================');
console.log('統計計算テスト');
console.log('========================================\n');

test('基本的な統計: [80, 85, 90, 95, 100]', () => {
  const values = [80, 85, 90, 95, 100];
  const stats = calculateStatistics(values);

  assertAlmostEquals(stats.mean, 90, 0.01, '平均値は90であるべき');
  assertAlmostEquals(stats.median, 90, 0.01, '中央値は90であるべき');
  assertAlmostEquals(stats.stdDev, 7.91, 0.1, '標準偏差は約7.91であるべき');
  assertEquals(stats.min, 80, '最小値は80であるべき');
  assertEquals(stats.max, 100, '最大値は100であるべき');
  assertEquals(stats.range, 20, '範囲は20であるべき');
});

test('偶数個のデータ: [75, 80, 85, 90]', () => {
  const values = [75, 80, 85, 90];
  const stats = calculateStatistics(values);

  assertAlmostEquals(stats.mean, 82.5, 0.01, '平均値は82.5であるべき');
  assertAlmostEquals(stats.median, 82.5, 0.01, '中央値は82.5であるべき');
});

test('n=1のデータ: [85]', () => {
  const values = [85];
  const stats = calculateStatistics(values);

  assertEquals(stats.n, 1, 'データ数は1であるべき');
  assertEquals(stats.mean, 85, '平均値は85であるべき');
  assertEquals(stats.stdDev, 0, '標準偏差は0であるべき');
  assertEquals(stats.median, 85, '中央値は85であるべき');
});

test('n=2のデータ: [80, 90]', () => {
  const values = [80, 90];
  const stats = calculateStatistics(values);

  assertAlmostEquals(stats.mean, 85, 0.01, '平均値は85であるべき');
  assertAlmostEquals(stats.stdDev, 7.07, 0.1, '不偏標準偏差は約7.07であるべき');
  assertEquals(stats.skewness, 0, 'n=2では歪度は0であるべき');
  assertEquals(stats.kurtosis, 0, 'n=2では尖度は0であるべき');
});

test('n=3のデータ: [80, 85, 90]で歪度が計算される', () => {
  const values = [80, 85, 90];
  const stats = calculateStatistics(values);

  assertEquals(stats.n, 3, 'データ数は3であるべき');
  assert(stats.skewness !== undefined, '歪度が計算されるべき');
});

test('n=4のデータ: [80, 85, 90, 95]で尖度が計算される', () => {
  const values = [80, 85, 90, 95];
  const stats = calculateStatistics(values);

  assertEquals(stats.n, 4, 'データ数は4であるべき');
  assert(stats.kurtosis !== undefined, '尖度が計算されるべき');
});

test('実際の歩留まり率データ: [78.5, 82.3, 79.1, 80.7, 81.2]', () => {
  const values = [78.5, 82.3, 79.1, 80.7, 81.2];
  const stats = calculateStatistics(values);

  assertAlmostEquals(stats.mean, 80.36, 0.1, '平均値は約80.36であるべき');
  assertAlmostEquals(stats.stdDev, 1.42, 0.1, '標準偏差は約1.42であるべき');
  assertAlmostEquals(stats.cv, 1.77, 0.1, '変動係数は約1.77%であるべき');
});

// ========================================
// 統合シナリオテスト
// ========================================

console.log('\n========================================');
console.log('統合シナリオテスト');
console.log('========================================\n');

test('定額モード完全シナリオ: 鶏もも肉1個200g、150円 → 骨除去後160g', () => {
  // Step 1: 歩留まり率計算
  const yieldRate = calcYield(200, 160);
  assertAlmostEquals(yieldRate, 80, 0.01);

  // Step 2: 加工前100gあたり原価
  const beforeCost = per100FromPerUnit(150, 200);
  assertAlmostEquals(beforeCost, 75, 0.01);

  // Step 3: 加工後100gあたり原価
  const afterCost = afterCostPer100(beforeCost, yieldRate);
  assertAlmostEquals(afterCost, 93.75, 0.01);

  // Step 4: 加工後売価を198円/100gと設定
  const afterPrice = 198;

  // Step 5: 値入率計算
  const markupRate = markup(afterCost, afterPrice);
  assertAlmostEquals(markupRate, 52.65, 0.1);

  // Step 6: 仕上がり価格
  const finishedPrice = finishedPriceFromAp(afterPrice, 160);
  assertAlmostEquals(finishedPrice, 316.8, 0.01);
});

test('計量モード完全シナリオ: 豚バラ10kg箱5000円 → サンプル100g→80g', () => {
  // Step 1: 歩留まり率計算
  const yieldRate = calcYield(100, 80);
  assertAlmostEquals(yieldRate, 80, 0.01);

  // Step 2: 加工前100gあたり原価
  const beforeCost = per100FromBox(5000, 10);
  assertAlmostEquals(beforeCost, 50, 0.01);

  // Step 3: 加工後100gあたり原価
  const afterCost = afterCostPer100(beforeCost, yieldRate);
  assertAlmostEquals(afterCost, 62.5, 0.01);

  // Step 4: 加工後売価を128円/100gと設定
  const afterPrice = 128;

  // Step 5: 値入率計算
  const markupRate = markup(afterCost, afterPrice);
  assertAlmostEquals(markupRate, 51.17, 0.1);
});

// ========================================
// テスト結果サマリー
// ========================================

console.log('\n========================================');
console.log('テスト結果サマリー');
console.log('========================================\n');

console.log(`総テスト数: ${testCount}`);
console.log(`✅ 成功: ${passCount}`);
console.log(`❌ 失敗: ${failCount}`);
console.log(`成功率: ${((passCount / testCount) * 100).toFixed(1)}%\n`);

if (failCount === 0) {
  console.log('🎉 すべてのテストが成功しました！\n');
  process.exit(0);
} else {
  console.log('⚠️  一部のテストが失敗しました。\n');
  process.exit(1);
}
