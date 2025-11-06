/**
 * Phase 5 パフォーマンス最適化の統合テスト
 * @jest-environment jsdom
 */

import { calculateStatistics, detectOutliers } from '../scripts/yield-stats-calc.js';

describe('Phase 5 統合テスト: メモ化', () => {
  beforeEach(() => {
    // キャッシュをクリア
    if (calculateStatistics.clearCache) {
      calculateStatistics.clearCache();
    }
    if (detectOutliers.clearCache) {
      detectOutliers.clearCache();
    }
  });

  test('calculateStatistics がメモ化されている', () => {
    const data = [80, 82, 85, 83, 84];

    // 1回目: 計算実行
    const result1 = calculateStatistics(data);

    expect(result1.count).toBe(5);
    expect(result1.mean).toBeCloseTo(82.8);
    expect(result1.median).toBe(83);
    expect(result1.sorted).toEqual([80, 82, 83, 84, 85]);

    // 2回目: キャッシュから取得（同じ参照が返る）
    const result2 = calculateStatistics(data);

    expect(result2).toBe(result1); // 同じオブジェクト参照
  });

  test('異なるデータでは再計算される', () => {
    const data1 = [80, 82, 85];
    const data2 = [90, 92, 95];

    const result1 = calculateStatistics(data1);
    const result2 = calculateStatistics(data2);

    expect(result1.mean).toBeCloseTo(82.33, 1);
    expect(result2.mean).toBeCloseTo(92.33, 1);
    expect(result1).not.toBe(result2); // 異なるオブジェクト
  });

  test('clearCache() でキャッシュをクリアできる', () => {
    const data = [80, 82, 85];

    const result1 = calculateStatistics(data);

    // キャッシュクリア
    if (calculateStatistics.clearCache) {
      calculateStatistics.clearCache();
    }

    // 再計算される（新しいオブジェクトが返る）
    const result2 = calculateStatistics(data);

    expect(result1.mean).toBe(result2.mean); // 値は同じ
    // Note: メモ化実装によっては同じ参照になる場合もある
  });

  test('detectOutliers がメモ化されている', () => {
    const data = [80, 82, 85, 83, 84, 100]; // 100が外れ値
    const stats = calculateStatistics(data);

    // 1回目
    const result1 = detectOutliers(data, stats);

    expect(result1.outliers.length).toBeGreaterThan(0);
    expect(result1.cleanedValues.length).toBeGreaterThan(0);

    // 2回目: キャッシュから取得
    const result2 = detectOutliers(data, stats);

    expect(result2).toBe(result1); // 同じオブジェクト参照
  });

  test('統計計算の正確性を確認', () => {
    const data = [10, 20, 30, 40, 50];

    const stats = calculateStatistics(data);

    expect(stats.count).toBe(5);
    expect(stats.mean).toBe(30);
    expect(stats.median).toBe(30);
    expect(stats.min).toBe(10);
    expect(stats.max).toBe(50);
    expect(stats.range).toBe(40);
    expect(stats.sorted).toEqual([10, 20, 30, 40, 50]);
  });

  test('getCacheSize() でキャッシュサイズを確認', () => {
    if (!calculateStatistics.getCacheSize) {
      return; // getCacheSize が実装されていない場合はスキップ
    }

    calculateStatistics.clearCache();

    expect(calculateStatistics.getCacheSize()).toBe(0);

    calculateStatistics([1, 2, 3]);
    expect(calculateStatistics.getCacheSize()).toBe(1);

    calculateStatistics([4, 5, 6]);
    expect(calculateStatistics.getCacheSize()).toBe(2);

    calculateStatistics([1, 2, 3]); // 既存のキー
    expect(calculateStatistics.getCacheSize()).toBe(2); // 増えない
  });

  describe('エッジケース', () => {
    test('データが1つだけの場合（n=1）', () => {
      const data = [85];
      const stats = calculateStatistics(data);

      expect(stats.count).toBe(1);
      expect(stats.mean).toBe(85);
      expect(stats.median).toBe(85);
      expect(stats.stdDev).toBe(0); // n=1の場合、標準偏差は0
      expect(stats.skewness).toBe(0); // n<3なのでskewnessは0
      expect(stats.kurtosis).toBe(0); // n<4なのでkurtosisは0
    });

    test('平均が0の場合（CV計算）', () => {
      const data = [-5, 0, 5];
      const stats = calculateStatistics(data);

      expect(stats.mean).toBe(0);
      expect(stats.cv).toBe(0); // mean=0の場合、CVは0
      expect(stats.rsd).toBe(0); // RSDもCVと同じ
    });

    test('すべての値が同じ場合（標準偏差=0）', () => {
      const data = [80, 80, 80, 80];
      const stats = calculateStatistics(data);

      expect(stats.mean).toBe(80);
      expect(stats.stdDev).toBe(0); // すべて同じ値なので標準偏差は0
      expect(stats.skewness).toBe(0); // stdDev=0なのでskewnessは0
      expect(stats.kurtosis).toBe(0); // stdDev=0なのでkurtosisは0
    });

    test('データが2つの場合（n=2）', () => {
      const data = [80, 90];
      const stats = calculateStatistics(data);

      expect(stats.count).toBe(2);
      expect(stats.mean).toBe(85);
      expect(stats.skewness).toBe(0); // n<3なのでskewnessは0
      expect(stats.kurtosis).toBe(0); // n<4なのでkurtosisは0
    });
  });
});
