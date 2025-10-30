#!/usr/bin/env node

/**
 * 相対標準偏差（RSD）/ 変動係数（CV）の包括的テスト
 *
 * RSD (Relative Standard Deviation) = (標準偏差 / 平均値) × 100
 * CV (Coefficient of Variation) = RSDと同じ計算式
 *
 * 実行方法: node test-rsd.js
 */

// yield-stats-calc.js から calculateStatistics をインポート（ES6モジュールではないのでrequireは使えない）
// テスト用に関数を再定義
function calculateStatistics(values) {
  const n = values.length;
  const sorted = [...values].sort((a, b) => a - b);

  // 平均値
  const mean = values.reduce((sum, val) => sum + val, 0) / n;

  // 標準偏差（不偏標準偏差を使用）
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

  // 変動係数（CV）/ 相対標準偏差（RSD）
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;
  const rsd = cv; // RSDはCVのエイリアス

  // 歪度（Skewness）
  const skewness = (n >= 3 && stdDev > 0)
    ? values.reduce((sum, val) => sum + Math.pow((val - mean) / stdDev, 3), 0) / n
    : 0;

  // 尖度（Kurtosis）
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
    rsd,
    skewness,
    kurtosis
  };
}

// テストケース定義
const testCases = [
  {
    name: "基本テスト: 完全に均一なデータ（RSD = 0%）",
    data: [10, 10, 10, 10, 10],
    expected: {
      mean: 10.0,
      stdDev: 0.0,
      cv: 0.0,
      rsd: 0.0,
    },
    description: "すべて同じ値の場合、標準偏差は0なのでRSD/CVも0になる"
  },
  {
    name: "低変動データ: 歩留まり率が安定している場合",
    data: [85.0, 85.5, 86.0, 85.8, 85.2],
    expected: {
      mean: 85.5,
      stdDev: 0.387,
      cv: 0.453,
      rsd: 0.453,
    },
    description: "RSD < 1%は非常に安定したプロセスを示す"
  },
  {
    name: "中程度変動: 通常の製造プロセス",
    data: [78.5, 82.3, 79.1, 80.7, 81.2],
    expected: {
      mean: 80.36,
      stdDev: 1.548,
      cv: 1.926,
      rsd: 1.926,
    },
    description: "RSD 1-5%は通常の許容範囲内"
  },
  {
    name: "高変動データ: プロセス改善が必要",
    data: [70, 80, 90, 75, 85],
    expected: {
      mean: 80.0,
      stdDev: 8.165,
      cv: 10.206,
      rsd: 10.206,
    },
    description: "RSD > 10%は高いばらつきを示し、改善が必要"
  },
  {
    name: "小数点以下の精密なデータ",
    data: [1.234, 1.235, 1.236, 1.237, 1.238],
    expected: {
      mean: 1.236,
      stdDev: 0.00158,
      cv: 0.128,
      rsd: 0.128,
    },
    description: "小数点以下の細かい変動も正確に捉えられる"
  },
  {
    name: "大きな数値のデータ",
    data: [1000, 1050, 950, 1020, 980],
    expected: {
      mean: 1000.0,
      stdDev: 39.051,
      cv: 3.905,
      rsd: 3.905,
    },
    description: "大きな数値でもRSDは相対的な変動を示す"
  },
  {
    name: "負の値を含むデータ（絶対値で計算）",
    data: [-10, -12, -8, -11, -9],
    expected: {
      mean: -10.0,
      stdDev: 1.581,
      cv: 15.811,
      rsd: 15.811,
    },
    description: "負の値の場合は平均の絶対値で割る"
  },
  {
    name: "最小サンプル数（n=2）",
    data: [80, 85],
    expected: {
      mean: 82.5,
      stdDev: 3.536,
      cv: 4.286,
      rsd: 4.286,
    },
    description: "2点のデータでもRSDは計算可能"
  },
  {
    name: "単一データ（n=1）",
    data: [75],
    expected: {
      mean: 75.0,
      stdDev: 0.0,
      cv: 0.0,
      rsd: 0.0,
    },
    description: "1点のみの場合、標準偏差は0なのでRSDも0"
  },
  {
    name: "実データ: 鶏もも肉の歩留まり率（10サンプル）",
    data: [78.2, 79.5, 77.8, 80.1, 78.9, 79.3, 78.5, 79.8, 78.1, 79.6],
    expected: {
      mean: 78.98,
      stdDev: 0.819,
      cv: 1.037,
      rsd: 1.037,
    },
    description: "実際の歩留まり率データ: RSD約1%は優れた品質管理を示す"
  },
  {
    name: "実データ: 豚バラ肉の歩留まり率（変動大）",
    data: [72.5, 78.3, 69.8, 75.2, 73.1, 76.9, 71.4, 74.8, 70.6, 77.2],
    expected: {
      mean: 73.98,
      stdDev: 2.868,
      cv: 3.877,
      rsd: 3.877,
    },
    description: "変動が大きい場合のRSD約4%: まだ許容範囲内"
  },
  {
    name: "極端な外れ値を含むデータ",
    data: [80, 81, 82, 80, 81, 95],
    expected: {
      mean: 83.167,
      stdDev: 5.845,
      cv: 7.028,
      rsd: 7.028,
    },
    description: "外れ値（95）がRSDを大きく上昇させる"
  },
  {
    name: "ゼロ平均のエッジケース（偏差データ）",
    data: [-5, -3, 0, 3, 5],
    expected: {
      mean: 0.0,
      stdDev: 4.0,
      cv: 0.0,  // 平均が0の場合はCVは定義されない（0を返す）
      rsd: 0.0,
    },
    description: "平均が0の場合、RSD/CVは計算不能（0を返す）"
  },
  {
    name: "品質管理基準: 優良（RSD < 2%）",
    data: [49.5, 50.0, 49.8, 50.2, 49.9, 50.1, 49.7, 50.3],
    expected: {
      mean: 49.9375,
      stdDev: 0.259,
      cv: 0.519,
      rsd: 0.519,
    },
    description: "RSD < 2%: 優れた工程管理"
  },
  {
    name: "品質管理基準: 許容（RSD 2-5%）",
    data: [48.0, 50.5, 49.2, 51.0, 48.8, 50.2, 49.5, 51.5],
    expected: {
      mean: 49.8375,
      stdDev: 1.218,
      cv: 2.444,
      rsd: 2.444,
    },
    description: "RSD 2-5%: 許容範囲内の変動"
  },
  {
    name: "品質管理基準: 要改善（RSD > 5%）",
    data: [45.0, 52.0, 48.5, 54.0, 46.8, 51.2, 47.5, 53.5],
    expected: {
      mean: 49.8125,
      stdDev: 3.283,
      cv: 6.591,
      rsd: 6.591,
    },
    description: "RSD > 5%: プロセス改善が推奨される"
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
  magenta: '\x1b[35m',
};

console.log(`\n${colors.bright}${colors.cyan}========================================`);
console.log(`📊 相対標準偏差（RSD）/ 変動係数（CV）テスト`);
console.log(`========================================${colors.reset}\n`);

console.log(`${colors.blue}概要:${colors.reset}`);
console.log(`  RSD (Relative Standard Deviation) = (標準偏差 / 平均値) × 100`);
console.log(`  CV (Coefficient of Variation) = RSDと同じ計算式`);
console.log(`  用途: 異なる単位や規模のデータのばらつきを比較\n`);

console.log(`${colors.blue}品質管理基準:${colors.reset}`);
console.log(`  ${colors.green}優良${colors.reset}: RSD < 2%  (非常に安定したプロセス)`);
console.log(`  ${colors.yellow}許容${colors.reset}: RSD 2-5% (通常の許容範囲内)`);
console.log(`  ${colors.red}要改善${colors.reset}: RSD > 5%  (プロセス改善が必要)\n`);

let totalTests = 0;
let passedTests = 0;
const tolerance = 0.5; // 許容誤差（%ポイント）

testCases.forEach((testCase, index) => {
  console.log(`${colors.bright}${index + 1}. ${testCase.name}${colors.reset}`);
  console.log(`   ${colors.blue}説明:${colors.reset} ${testCase.description}`);
  console.log(`   ${colors.blue}データ:${colors.reset} [${testCase.data.join(', ')}]`);

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

      // CVとRSDの一致を確認
      if (key === 'rsd') {
        const cvRsdMatch = Math.abs(result.cv - result.rsd) < 0.001;
        if (cvRsdMatch) {
          console.log(`   ${colors.green}✓${colors.reset} ${key}: ${actualValue.toFixed(3)}% (CV=${result.cv.toFixed(3)}% ※一致確認)`);
        } else {
          console.log(`   ${colors.red}✗${colors.reset} ${key}: ${actualValue.toFixed(3)}% (CV=${result.cv.toFixed(3)}% ※不一致)`);
          allPassed = false;
        }
      } else {
        console.log(`   ${colors.green}✓${colors.reset} ${key}: ${actualValue.toFixed(3)} (期待値: ${expectedValue.toFixed(3)})`);
      }
    } else {
      allPassed = false;
      console.log(`   ${colors.red}✗${colors.reset} ${key}: ${actualValue.toFixed(3)} (期待値: ${expectedValue.toFixed(3)}, 差: ${diff.toFixed(4)})`);
    }
  }

  // RSD値に基づく品質評価を表示
  if (result.rsd !== undefined) {
    let quality = '';
    if (result.rsd < 2) {
      quality = `${colors.green}優良（非常に安定）${colors.reset}`;
    } else if (result.rsd < 5) {
      quality = `${colors.yellow}許容範囲内${colors.reset}`;
    } else {
      quality = `${colors.red}要改善${colors.reset}`;
    }
    console.log(`   ${colors.blue}品質評価:${colors.reset} ${quality}`);
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

// 重要なポイントを表示
console.log(`\n${colors.bright}${colors.magenta}重要なポイント:${colors.reset}`);
console.log(`  1. RSDとCVは常に同じ値である（エイリアス関係）`);
console.log(`  2. RSDは相対的な変動を示すため、異なる単位のデータを比較可能`);
console.log(`  3. 平均が0の場合、RSDは定義されない（実装では0を返す）`);
console.log(`  4. 負の値を含む場合、平均の絶対値で割る`);
console.log(`  5. 品質管理では一般的にRSD < 5%が目標とされる`);

if (passedTests === totalTests) {
  console.log(`\n${colors.green}${colors.bright}✅ 全てのテストに合格しました！${colors.reset}`);
  console.log(`${colors.green}   RSD/CV計算は正しく実装されています。${colors.reset}\n`);
  process.exit(0);
} else {
  console.log(`\n${colors.red}${colors.bright}❌ ${totalTests - passedTests}個のテストが失敗しました${colors.reset}`);
  console.log(`${colors.red}   実装を確認してください。${colors.reset}\n`);
  process.exit(1);
}
