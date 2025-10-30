#!/usr/bin/env node

/**
 * 統計計算の検証テスト（Node.js版）
 * 実行方法: node test-statistics.js
 */

// calculateStatistics関数（main.jsから抽出）
function calculateStatistics(values) {
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
  const iqr = q3 - q1;

  // 変動係数（CV）
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  // 歪度（Skewness）
  const skewness = (n >= 3 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / n
    : 0;

  // 尖度（Kurtosis）- 超過尖度
  const kurtosis = (n >= 4 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 4), 0) / n - 3
    : 0;

  return {
    count: n,
    mean,
    median,
    stdDev,
    variance,
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

// テストケース定義
const testCases = [
  {
    name: "簡単な整数データ（n=8）",
    data: [2, 4, 4, 4, 5, 5, 7, 9],
    expected: {
      mean: 5.0,
      stdDev: 2.138,
      variance: 4.571,
    },
  },
  {
    name: "歩留まり率の実データ（n=10）",
    data: [85.5, 87.2, 86.8, 85.9, 86.5, 87.0, 86.2, 86.8, 87.5, 86.0],
    expected: {
      mean: 86.54,
      stdDev: 0.625,
      variance: 0.391,
    },
  },
  {
    name: "小さなサンプル（n=3）",
    data: [10, 20, 30],
    expected: {
      mean: 20.0,
      stdDev: 10.0,
      variance: 100.0,
    },
  },
  {
    name: "n=1の場合",
    data: [42],
    expected: {
      mean: 42.0,
      stdDev: 0.0,
      variance: 0.0,
    },
  },
  {
    name: "全て同じ値（n=5）",
    data: [5, 5, 5, 5, 5],
    expected: {
      mean: 5.0,
      stdDev: 0.0,
      variance: 0.0,
    },
  },
  {
    name: "歪度テスト（n=3）",
    data: [1, 2, 3],
    expected: {
      skewness: 0.0,
    },
  },
  {
    name: "歪度テスト（n=2）",
    data: [1, 2],
    expected: {
      skewness: 0.0,
    },
  },
  {
    name: "尖度テスト（n=4）",
    data: [1, 2, 3, 4],
    expected: {
      kurtosis: -2.078, // 正しい超過尖度の値
    },
  },
];

// ANSI カラーコード
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

console.log(`\n${colors.bright}${colors.cyan}========================================`);
console.log(`📊 統計計算の検証テスト`);
console.log(`========================================${colors.reset}\n`);

console.log(`${colors.blue}目的:${colors.reset} 不偏標準偏差（Sample Standard Deviation）の計算が正しく実装されているかを検証`);
console.log(`${colors.blue}公式:${colors.reset} s = √(Σ(xi - x̄)² / (n-1))\n`);

let totalTests = 0;
let passedTests = 0;
const tolerance = 0.01; // 許容誤差

testCases.forEach((testCase, index) => {
  console.log(`${colors.bright}${index + 1}. ${testCase.name}${colors.reset}`);
  console.log(`   データ: [${testCase.data.join(', ')}]`);

  const result = calculateStatistics(testCase.data);
  let allPassed = true;

  // 各期待値をチェック
  for (const [key, expectedValue] of Object.entries(testCase.expected)) {
    const actualValue = result[key];
    const diff = Math.abs(actualValue - expectedValue);
    const passed = diff < tolerance;

    totalTests++;
    if (passed) {
      passedTests++;
      console.log(`   ${colors.green}✓${colors.reset} ${key}: ${actualValue.toFixed(3)} (期待値: ${expectedValue.toFixed(3)})`);
    } else {
      allPassed = false;
      console.log(`   ${colors.red}✗${colors.reset} ${key}: ${actualValue.toFixed(3)} (期待値: ${expectedValue.toFixed(3)}, 差: ${diff.toFixed(4)})`);
    }
  }

  if (allPassed) {
    console.log(`   ${colors.green}${colors.bright}✅ PASS${colors.reset}\n`);
  } else {
    console.log(`   ${colors.red}${colors.bright}❌ FAIL${colors.reset}\n`);
  }
});

// サマリー
console.log(`${colors.bright}${colors.cyan}========================================`);
console.log(`テスト結果サマリー`);
console.log(`========================================${colors.reset}`);
console.log(`総テスト数: ${totalTests}`);
console.log(`成功: ${colors.green}${passedTests}${colors.reset} / ${totalTests}`);
console.log(`失敗: ${colors.red}${totalTests - passedTests}${colors.reset}`);
console.log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

if (passedTests === totalTests) {
  console.log(`\n${colors.green}${colors.bright}✅ 全てのテストに合格しました！${colors.reset}`);
  console.log(`${colors.green}   不偏標準偏差の計算は正しく実装されています。${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}${colors.bright}❌ ${totalTests - passedTests}個のテストが失敗しました${colors.reset}`);
  console.log(`${colors.red}   実装を確認してください。${colors.reset}\n`);
  process.exit(1);
}
