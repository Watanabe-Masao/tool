/**
 * 複数パターン分析のテスト
 *
 * calculator-multi-pattern.js の計算ロジックをテスト
 * 複数の原価・売価パターンで値入率等を比較分析
 */

import { describe, test, expect } from '@jest/globals';
import {
  calculatePattern,
  calculateMultiplePatterns
} from '../scripts/calculator-multi-pattern.js';

describe('calculatePattern', () => {
  describe('正常な計算', () => {
    test('基本的な計算が正しく動作する', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 200
      };
      const result = calculatePattern(params);

      expect(result).not.toBeNull();
      expect(result.beforeCost100).toBe(100); // 100 * 100 / 100
      expect(result.beforePrice100).toBe(150); // 150 * 100 / 100
      expect(result.beforeMarkup).toBeCloseTo(33.33, 2); // (150-100)/150*100
      expect(result.afterCost100).toBeCloseTo(117.65, 2); // 100 / 0.85
      expect(result.afterPrice100).toBe(200);
      expect(result.afterMarkup).toBeCloseTo(41.18, 2); // (200-117.65)/200*100
      expect(result.afterWeight).toBe(85); // 100 * 0.85
      expect(result.finishedPrice).toBe(170); // 200 * (85 / 100)
      expect(result.priceDiff).toBe(20); // 170 - 150
      expect(result.sensitivity).toBeDefined(); // 感度分析結果
    });

    test('感度分析が正しく計算される', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 200
      };
      const result = calculatePattern(params);

      // 歩留まり率85%の値入率
      const markup85 = result.afterMarkup;

      // 歩留まり率86%の加工後コスト: 100 / 0.86 = 116.28
      // 歩留まり率86%の値入率: (200 - 116.28) / 200 * 100 = 41.86
      // 感度: 41.86 - 41.18 = 0.68
      expect(result.sensitivity).toBeCloseTo(0.68, 1);
    });

    test('歩留まり率100%の場合', () => {
      const params = {
        yieldRate: 100,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 200
      };
      const result = calculatePattern(params);

      expect(result.afterCost100).toBe(100); // コストが変わらない
      expect(result.afterWeight).toBe(100);
      expect(result.finishedPrice).toBe(200);
    });

    test('歩留まり率50%の場合', () => {
      const params = {
        yieldRate: 50,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 300
      };
      const result = calculatePattern(params);

      expect(result.afterCost100).toBe(200); // 100 / 0.5
      expect(result.afterWeight).toBe(50);
      expect(result.finishedPrice).toBe(150); // 300 * (50 / 100)
      expect(result.priceDiff).toBe(0); // 150 - 150
    });

    test('異なる加工前重量での計算', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 200,
        unitCost: 120,
        unitPrice: 180,
        afterPrice100: 250
      };
      const result = calculatePattern(params);

      expect(result.beforeCost100).toBe(60); // 120 * 100 / 200
      expect(result.beforePrice100).toBe(90); // 180 * 100 / 200
      expect(result.afterWeight).toBe(170); // 200 * 0.85
      expect(result.finishedPrice).toBe(425); // 250 * (170 / 100)
    });
  });

  describe('エッジケース', () => {
    test('歩留まり率が非常に低い場合 (10%)', () => {
      const params = {
        yieldRate: 10,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 500
      };
      const result = calculatePattern(params);

      expect(result.afterCost100).toBe(1000); // 100 / 0.1
      expect(result.afterWeight).toBe(10);
      expect(result.finishedPrice).toBe(50); // 500 * (10 / 100)
      expect(result.priceDiff).toBe(-100); // マイナスになる
    });

    test('加工後売価が非常に高い場合', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 10000
      };
      const result = calculatePattern(params);

      expect(result.afterPrice100).toBe(10000);
      expect(result.finishedPrice).toBe(8500); // 10000 * (85 / 100)
      expect(result.priceDiff).toBe(8350);
    });

    test('単価コストと単価売価が同じ場合（粗利率0%）', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 100,
        afterPrice100: 200
      };
      const result = calculatePattern(params);

      expect(result.beforeMarkup).toBe(0);
      expect(result).not.toBeNull();
    });

    test('赤字価格設定（コストより売価が低い）', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 150,
        unitPrice: 100,
        afterPrice100: 200
      };
      const result = calculatePattern(params);

      expect(result.beforeMarkup).toBe(-50); // マイナス粗利率
      expect(result).not.toBeNull();
    });

    test('感度分析: 歩留まり率99%の場合', () => {
      // 99% → 100% で感度を計算
      const params = {
        yieldRate: 99,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 200
      };
      const result = calculatePattern(params);

      // 歩留まり率100%になると、加工後コストは100になる
      expect(result.sensitivity).toBeDefined();
      expect(Number.isFinite(result.sensitivity)).toBe(true);
    });
  });

  describe('無効な入力', () => {
    test('歩留まり率が0の場合はnullを返す', () => {
      const params = {
        yieldRate: 0,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 200
      };
      expect(calculatePattern(params)).toBeNull();
    });

    test('歩留まり率が負の場合はnullを返す', () => {
      const params = {
        yieldRate: -85,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 200
      };
      expect(calculatePattern(params)).toBeNull();
    });

    test('加工前重量が0の場合はnullを返す', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 0,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 200
      };
      expect(calculatePattern(params)).toBeNull();
    });

    test('単価コストが0の場合はnullを返す', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 0,
        unitPrice: 150,
        afterPrice100: 200
      };
      expect(calculatePattern(params)).toBeNull();
    });

    test('単価売価が0の場合はnullを返す', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 0,
        afterPrice100: 200
      };
      expect(calculatePattern(params)).toBeNull();
    });

    test('加工後売価が0の場合はnullを返す', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 0
      };
      expect(calculatePattern(params)).toBeNull();
    });

    test('必須パラメータが欠けている場合はnullを返す', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: 100,
        unitPrice: 150
        // afterPrice100が欠けている
      };
      expect(calculatePattern(params)).toBeNull();
    });

    test('nullが含まれる場合はnullを返す', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 100,
        unitCost: null,
        unitPrice: 150,
        afterPrice100: 200
      };
      expect(calculatePattern(params)).toBeNull();
    });

    test('undefinedが含まれる場合はnullを返す', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: undefined,
        unitCost: 100,
        unitPrice: 150,
        afterPrice100: 200
      };
      expect(calculatePattern(params)).toBeNull();
    });
  });

  describe('実用的なシナリオ', () => {
    test('野菜の皮むき加工分析', () => {
      const params = {
        yieldRate: 85,
        beforeWeight: 500,
        unitCost: 250,
        unitPrice: 375,
        afterPrice100: 100
      };
      const result = calculatePattern(params);

      expect(result.beforeCost100).toBe(50); // 250 * 100 / 500
      expect(result.beforePrice100).toBe(75); // 375 * 100 / 500
      expect(result.afterWeight).toBe(425); // 500 * 0.85
      expect(result.finishedPrice).toBe(425); // 100 * (425 / 100)
      expect(result.priceDiff).toBe(50); // 425 - 375
    });

    test('肉のトリミング加工分析', () => {
      const params = {
        yieldRate: 70,
        beforeWeight: 1000,
        unitCost: 1500,
        unitPrice: 2100,
        afterPrice100: 300
      };
      const result = calculatePattern(params);

      expect(result.beforeCost100).toBe(150); // 1500 * 100 / 1000
      expect(result.beforePrice100).toBe(210); // 2100 * 100 / 1000
      expect(result.afterWeight).toBe(700); // 1000 * 0.7
      expect(result.finishedPrice).toBe(2100); // 300 * (700 / 100)
    });

    test('魚の下処理分析', () => {
      const params = {
        yieldRate: 60,
        beforeWeight: 2000,
        unitCost: 3000,
        unitPrice: 4500,
        afterPrice100: 400
      };
      const result = calculatePattern(params);

      expect(result.afterWeight).toBe(1200); // 2000 * 0.6
      expect(result.finishedPrice).toBe(4800); // 400 * (1200 / 100)
      expect(result.priceDiff).toBe(300); // 4800 - 4500
    });
  });
});

describe('calculateMultiplePatterns', () => {
  describe('正常な計算', () => {
    test('複数パターンを一括計算できる', () => {
      const patterns = [
        { name: 'パターンA', unitCost: 100, unitPrice: 150, afterPrice100: 180 },
        { name: 'パターンB', unitCost: 120, unitPrice: 180, afterPrice100: 200 },
        { name: 'パターンC', unitCost: 80, unitPrice: 120, afterPrice100: 160 }
      ];

      const results = calculateMultiplePatterns(85, 100, patterns);

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe('パターンA');
      expect(results[0].result).not.toBeNull();
      expect(results[0].result.finishedPrice).toBe(153); // 180 * (85 / 100)

      expect(results[1].name).toBe('パターンB');
      expect(results[1].result).not.toBeNull();
      expect(results[1].result.finishedPrice).toBe(170); // 200 * (85 / 100)

      expect(results[2].name).toBe('パターンC');
      expect(results[2].result).not.toBeNull();
      expect(results[2].result.finishedPrice).toBe(136); // 160 * (85 / 100)
    });

    test('元のパターンデータが結果に含まれる', () => {
      const patterns = [
        {
          name: 'テストパターン',
          description: '説明文',
          unitCost: 100,
          unitPrice: 150,
          afterPrice100: 200
        }
      ];

      const results = calculateMultiplePatterns(85, 100, patterns);

      expect(results[0].name).toBe('テストパターン');
      expect(results[0].description).toBe('説明文');
      expect(results[0].unitCost).toBe(100);
      expect(results[0].unitPrice).toBe(150);
      expect(results[0].afterPrice100).toBe(200);
      expect(results[0].result).toBeDefined();
    });

    test('空の配列を渡すと空の配列が返る', () => {
      const results = calculateMultiplePatterns(85, 100, []);
      expect(results).toEqual([]);
    });

    test('各パターンで異なる歩留まり率影響を比較できる', () => {
      const patterns = [
        { name: '低価格', unitCost: 100, unitPrice: 150, afterPrice100: 180 },
        { name: '高価格', unitCost: 100, unitPrice: 150, afterPrice100: 300 }
      ];

      const results = calculateMultiplePatterns(85, 100, patterns);

      expect(results[0].result.afterMarkup).toBeLessThan(results[1].result.afterMarkup);
      expect(results[0].result.finishedPrice).toBeLessThan(results[1].result.finishedPrice);
    });
  });

  describe('エッジケース', () => {
    test('単一パターンでも動作する', () => {
      const patterns = [
        { name: '単一', unitCost: 100, unitPrice: 150, afterPrice100: 200 }
      ];

      const results = calculateMultiplePatterns(85, 100, patterns);

      expect(results).toHaveLength(1);
      expect(results[0].result).not.toBeNull();
    });

    test('一部のパターンが無効な場合でも処理を続ける', () => {
      const patterns = [
        { name: '有効', unitCost: 100, unitPrice: 150, afterPrice100: 200 },
        { name: '無効', unitCost: 0, unitPrice: 150, afterPrice100: 200 }, // 無効
        { name: '有効2', unitCost: 120, unitPrice: 180, afterPrice100: 220 }
      ];

      const results = calculateMultiplePatterns(85, 100, patterns);

      expect(results).toHaveLength(3);
      expect(results[0].result).not.toBeNull();
      expect(results[1].result).toBeNull(); // 無効なパターン
      expect(results[2].result).not.toBeNull();
    });

    test('大量のパターンを処理できる', () => {
      const patterns = Array.from({ length: 100 }, (_, i) => ({
        name: `パターン${i}`,
        unitCost: 100 + i,
        unitPrice: 150 + i,
        afterPrice100: 200 + i
      }));

      const results = calculateMultiplePatterns(85, 100, patterns);

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.result).not.toBeNull();
      });
    });
  });

  describe('無効な入力', () => {
    test('歩留まり率が0の場合は空配列を返す', () => {
      const patterns = [
        { name: 'パターン', unitCost: 100, unitPrice: 150, afterPrice100: 200 }
      ];
      const results = calculateMultiplePatterns(0, 100, patterns);
      expect(results).toEqual([]);
    });

    test('歩留まり率が負の場合は空配列を返す', () => {
      const patterns = [
        { name: 'パターン', unitCost: 100, unitPrice: 150, afterPrice100: 200 }
      ];
      const results = calculateMultiplePatterns(-85, 100, patterns);
      expect(results).toEqual([]);
    });

    test('加工前重量が0の場合は空配列を返す', () => {
      const patterns = [
        { name: 'パターン', unitCost: 100, unitPrice: 150, afterPrice100: 200 }
      ];
      const results = calculateMultiplePatterns(85, 0, patterns);
      expect(results).toEqual([]);
    });

    test('加工前重量が負の場合は空配列を返す', () => {
      const patterns = [
        { name: 'パターン', unitCost: 100, unitPrice: 150, afterPrice100: 200 }
      ];
      const results = calculateMultiplePatterns(85, -100, patterns);
      expect(results).toEqual([]);
    });
  });

  describe('実用的なシナリオ', () => {
    test('3つの価格戦略を比較', () => {
      const patterns = [
        {
          name: '低価格戦略',
          unitCost: 100,
          unitPrice: 130,
          afterPrice100: 160
        },
        {
          name: '中価格戦略',
          unitCost: 100,
          unitPrice: 150,
          afterPrice100: 200
        },
        {
          name: '高価格戦略',
          unitCost: 100,
          unitPrice: 180,
          afterPrice100: 250
        }
      ];

      const results = calculateMultiplePatterns(85, 100, patterns);

      expect(results).toHaveLength(3);

      // 低価格戦略
      expect(results[0].result.beforeMarkup).toBeCloseTo(23.08, 1);
      expect(results[0].result.afterMarkup).toBeCloseTo(26.47, 1);

      // 中価格戦略
      expect(results[1].result.beforeMarkup).toBeCloseTo(33.33, 1);
      expect(results[1].result.afterMarkup).toBeCloseTo(41.18, 1);

      // 高価格戦略
      expect(results[2].result.beforeMarkup).toBeCloseTo(44.44, 1);
      expect(results[2].result.afterMarkup).toBeCloseTo(52.94, 1);
    });

    test('異なる原価での比較分析', () => {
      const patterns = [
        { name: '国内産', unitCost: 150, unitPrice: 225, afterPrice100: 280 },
        { name: '輸入品', unitCost: 80, unitPrice: 120, afterPrice100: 150 }
      ];

      const results = calculateMultiplePatterns(85, 100, patterns);

      expect(results).toHaveLength(2);

      // 両方とも値入率は同じくらいになるはず（約33%）
      expect(results[0].result.beforeMarkup).toBeCloseTo(33.33, 1);
      expect(results[1].result.beforeMarkup).toBeCloseTo(33.33, 1);

      // しかし仕上がり売価は大きく異なる
      expect(results[0].result.finishedPrice).toBeGreaterThan(results[1].result.finishedPrice);
    });
  });
});
