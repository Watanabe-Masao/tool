/**
 * 計量計算モードのテスト
 *
 * calculator-weight.js の計算ロジックをテスト
 * 箱単位での重量・価格計算（定額モードとは異なる計算方式）
 */

import { describe, test, expect } from '@jest/globals';
import {
  calculateFromWeightLogic,
  calculateFromDirectYieldLogic
} from '../scripts/calculator-weight.js';

describe('calculateFromWeightLogic - サンプル重量から計算', () => {
  describe('正常な計算', () => {
    test('基本的な計算が正しく動作する', () => {
      // bc=1000円, bp=1500円, bwKg=1kg, bs=100g, aw=85g, ap=200円/100g
      const result = calculateFromWeightLogic(1000, 1500, 1, 100, 85, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85); // 歩留まり率 85%
      expect(result.bc).toBe(100); // 箱コスト100円/100g (1000÷10)
      expect(result.bp).toBe(150); // 箱売価150円/100g (1500÷10)
      expect(result.ac).toBeCloseTo(117.65, 2); // 加工後コスト
      expect(result.ap).toBe(200); // 加工後売価
      expect(result.bm).toBeCloseTo(33.33, 2); // 加工前粗利率 (150-100)/150*100
      expect(result.am).toBeCloseTo(41.18, 2); // 加工後粗利率
      // finishedWeight = 1000g * 0.85 = 850g
      // finishedPrice = 200 * (850 / 100) = 1700
      expect(result.finishedPrice).toBe(1700);
      expect(result.priceDiff).toBe(200); // 1700 - 1500
      expect(result.finishedLabel).toBe('1箱あたりの仕上がり売価');
    });

    test('2kgの箱での計算', () => {
      // bc=2000円, bp=3000円, bwKg=2kg, bs=100g, aw=80g, ap=180円/100g
      const result = calculateFromWeightLogic(2000, 3000, 2, 100, 80, 180);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(80);
      expect(result.bc).toBe(100); // 2000÷20=100
      expect(result.bp).toBe(150); // 3000÷20=150
      // finishedWeight = 2000g * 0.8 = 1600g
      // finishedPrice = 180 * (1600 / 100) = 2880
      expect(result.finishedPrice).toBe(2880);
      expect(result.priceDiff).toBe(-120); // 2880 - 3000
    });

    test('小数点を含む箱重量での計算', () => {
      const result = calculateFromWeightLogic(1200, 1800, 1.5, 100, 85, 220);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85);
      expect(result.bc).toBeCloseTo(80, 2); // 1200÷15=80
      expect(result.bp).toBe(120); // 1800÷15=120
      // finishedWeight = 1500g * 0.85 = 1275g
      // finishedPrice = 220 * (1275 / 100) = 2805
      expect(result.finishedPrice).toBe(2805);
    });

    test('歩留まり率100%の場合', () => {
      const result = calculateFromWeightLogic(1000, 1500, 1, 100, 100, 200);

      expect(result.yr).toBe(100);
      expect(result.ac).toBe(100); // コストも変わらない
      expect(result.finishedPrice).toBe(2000); // 200 * 10
      expect(result.priceDiff).toBe(500); // 2000 - 1500
    });

    test('歩留まり率50%の場合', () => {
      const result = calculateFromWeightLogic(1000, 1500, 1, 100, 50, 300);

      expect(result.yr).toBe(50);
      expect(result.ac).toBe(200); // 100 / 0.5
      // finishedWeight = 1000g * 0.5 = 500g
      // finishedPrice = 300 * (500 / 100) = 1500
      expect(result.finishedPrice).toBe(1500);
      expect(result.priceDiff).toBe(0); // 1500 - 1500
    });
  });

  describe('エッジケース', () => {
    test('歩留まり率が非常に低い場合 (10%)', () => {
      const result = calculateFromWeightLogic(1000, 1500, 1, 100, 10, 500);

      expect(result.yr).toBe(10);
      expect(result.ac).toBe(1000); // 100 / 0.1
      // finishedWeight = 1000g * 0.1 = 100g
      // finishedPrice = 500 * (100 / 100) = 500
      expect(result.finishedPrice).toBe(500);
      expect(result.priceDiff).toBe(-1000); // マイナスになる
    });

    test('非常に大きい箱重量 (10kg)', () => {
      const result = calculateFromWeightLogic(10000, 15000, 10, 100, 85, 180);

      expect(result).not.toBeNull();
      expect(result.bc).toBe(100); // 10000÷100=100
      expect(result.bp).toBe(150); // 15000÷100=150
      // finishedWeight = 10000g * 0.85 = 8500g
      // finishedPrice = 180 * (8500 / 100) = 15300
      expect(result.finishedPrice).toBe(15300);
    });

    test('箱コストと箱売価が同じ場合（粗利率0%）', () => {
      const result = calculateFromWeightLogic(1000, 1000, 1, 100, 85, 200);

      expect(result.bm).toBe(0); // 粗利率0%
      expect(result).not.toBeNull();
    });

    test('箱コストが箱売価より高い場合（赤字）', () => {
      const result = calculateFromWeightLogic(1500, 1000, 1, 100, 85, 200);

      expect(result.bm).toBe(-50); // マイナス粗利率
      expect(result).not.toBeNull();
    });
  });

  describe('無効な入力', () => {
    test('必須パラメータが欠けている場合はnullを返す', () => {
      expect(calculateFromWeightLogic(null, 1500, 1, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, null, 1, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, 1500, null, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, 1500, 1, null, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, 1500, 1, 100, null, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, 1500, 1, 100, 85, null)).toBeNull();
    });

    test('undefinedが含まれる場合はnullを返す', () => {
      expect(calculateFromWeightLogic(undefined, 1500, 1, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, undefined, 1, 100, 85, 200)).toBeNull();
    });

    test('NaNが含まれる場合はnullを返す', () => {
      expect(calculateFromWeightLogic(NaN, 1500, 1, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, 1500, NaN, 100, 85, 200)).toBeNull();
    });

    test('Infinityが含まれる場合はnullを返す', () => {
      expect(calculateFromWeightLogic(Infinity, 1500, 1, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, 1500, 1, 100, 85, Infinity)).toBeNull();
    });

    test('文字列が含まれる場合はnullを返す', () => {
      expect(calculateFromWeightLogic('1000', 1500, 1, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(1000, '1500', 1, 100, 85, 200)).toBeNull();
    });
  });

  describe('境界値', () => {
    test('非常に小さい箱重量 (0.1kg)', () => {
      const result = calculateFromWeightLogic(100, 150, 0.1, 10, 8.5, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85);
      expect(result.bc).toBe(100); // 100÷1=100
      expect(result.bp).toBe(150);
      // finishedWeight = 100g * 0.85 = 85g
      // finishedPrice = 200 * (85 / 100) = 170
      expect(result.finishedPrice).toBe(170);
    });

    test('ゼロ箱重量（計算エラー）', () => {
      const result = calculateFromWeightLogic(1000, 1500, 0, 100, 85, 200);

      // per100FromBox が null を返すため、影響を受ける
      expect(result).not.toBeNull();
      expect(result.bc).toBeNull();
      expect(result.bp).toBeNull();
    });

    test('加工後重量がゼロ', () => {
      const result = calculateFromWeightLogic(1000, 1500, 1, 100, 0, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBeNull(); // calcYield が null を返す
    });
  });

  describe('実用的なシナリオ', () => {
    test('野菜1箱 (5kg) の加工', () => {
      // 5kg箱、5000円コスト、7500円売価、歩留まり85%、加工後180円/100g
      const result = calculateFromWeightLogic(5000, 7500, 5, 100, 85, 180);

      expect(result.yr).toBe(85);
      expect(result.bc).toBe(100); // 5000÷50=100
      expect(result.bp).toBe(150); // 7500÷50=150
      // finishedWeight = 5000g * 0.85 = 4250g
      // finishedPrice = 180 * (4250 / 100) = 7650
      expect(result.finishedPrice).toBe(7650);
      expect(result.priceDiff).toBe(150); // 価格上昇
    });

    test('肉1箱 (3kg) のトリミング', () => {
      // 3kg箱、15000円コスト、21000円売価、歩留まり70%、加工後1000円/100g
      const result = calculateFromWeightLogic(15000, 21000, 3, 100, 70, 1000);

      expect(result.yr).toBe(70);
      expect(result.bc).toBe(500); // 15000÷30=500
      expect(result.bp).toBe(700); // 21000÷30=700
      // finishedWeight = 3000g * 0.7 = 2100g
      // finishedPrice = 1000 * (2100 / 100) = 21000
      expect(result.finishedPrice).toBe(21000);
      expect(result.priceDiff).toBe(0); // 価格変わらず
    });
  });
});

describe('calculateFromDirectYieldLogic - 歩留まり率を直接入力', () => {
  describe('正常な計算', () => {
    test('基本的な計算が正しく動作する', () => {
      // bc=1000円, bp=1500円, bwKg=1kg, yr=85%, ap=200円/100g
      const result = calculateFromDirectYieldLogic(1000, 1500, 1, 85, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85); // 直接入力された歩留まり率
      expect(result.bc).toBe(100);
      expect(result.bp).toBe(150);
      expect(result.ac).toBeCloseTo(117.65, 2);
      expect(result.ap).toBe(200);
      expect(result.bm).toBeCloseTo(33.33, 2);
      expect(result.am).toBeCloseTo(41.18, 2);
      expect(result.finishedPrice).toBe(1700);
      expect(result.priceDiff).toBe(200);
      expect(result.finishedLabel).toBe('1箱あたりの仕上がり売価');
    });

    test('calculateFromWeightLogicと同じ結果になる', () => {
      // 同じ歩留まり率であれば同じ結果
      const result1 = calculateFromWeightLogic(1000, 1500, 1, 100, 85, 200);
      const result2 = calculateFromDirectYieldLogic(1000, 1500, 1, 85, 200);

      expect(result1.yr).toBe(result2.yr);
      expect(result1.ac).toBeCloseTo(result2.ac, 10);
      expect(result1.finishedPrice).toBe(result2.finishedPrice);
      expect(result1.priceDiff).toBe(result2.priceDiff);
    });

    test('歩留まり率100%の場合', () => {
      const result = calculateFromDirectYieldLogic(1000, 1500, 1, 100, 200);

      expect(result.yr).toBe(100);
      expect(result.ac).toBe(100);
      expect(result.finishedPrice).toBe(2000);
    });

    test('歩留まり率50%の場合', () => {
      const result = calculateFromDirectYieldLogic(1000, 1500, 1, 50, 300);

      expect(result.yr).toBe(50);
      expect(result.ac).toBe(200);
      expect(result.finishedPrice).toBe(1500);
    });

    test('小数点を含む歩留まり率', () => {
      const result = calculateFromDirectYieldLogic(1000, 1500, 1, 85.5, 200);

      expect(result.yr).toBe(85.5);
      expect(result.ac).toBeCloseTo(116.96, 2);
      // finishedWeight = 1000g * 0.855 = 855g
      // finishedPrice = 200 * (855 / 100) = 1710
      expect(result.finishedPrice).toBeCloseTo(1710, 10); // 浮動小数点精度を考慮
    });

    test('異なる箱重量での計算', () => {
      const result = calculateFromDirectYieldLogic(2400, 3600, 2, 85, 250);

      expect(result).not.toBeNull();
      expect(result.bc).toBe(120); // 2400 ÷ 20 = 120
      expect(result.bp).toBe(180); // 3600 ÷ 20 = 180
      // finishedWeight = 2000g * 0.85 = 1700g
      // finishedPrice = 250 * (1700 / 100) = 4250
      expect(result.finishedPrice).toBe(4250);
    });
  });

  describe('エッジケース', () => {
    test('歩留まり率が非常に低い場合 (5%)', () => {
      const result = calculateFromDirectYieldLogic(1000, 1500, 1, 5, 500);

      expect(result.yr).toBe(5);
      expect(result.ac).toBe(2000); // 100 / 0.05
      // finishedWeight = 1000g * 0.05 = 50g
      // finishedPrice = 500 * (50 / 100) = 250
      expect(result.finishedPrice).toBe(250);
      expect(result.priceDiff).toBe(-1250);
    });

    test('歩留まり率120%（水分追加など特殊ケース）', () => {
      const result = calculateFromDirectYieldLogic(1000, 1500, 1, 120, 200);

      expect(result.yr).toBe(120);
      expect(result.ac).toBeCloseTo(83.33, 2);
      // finishedWeight = 1000g * 1.2 = 1200g
      // finishedPrice = 200 * (1200 / 100) = 2400
      expect(result.finishedPrice).toBe(2400);
    });

    test('粗利率が負の値になる場合', () => {
      const result = calculateFromDirectYieldLogic(1500, 1000, 1, 85, 200);

      expect(result.bm).toBe(-50);
      expect(result).not.toBeNull();
    });
  });

  describe('無効な入力', () => {
    test('必須パラメータが欠けている場合はnullを返す', () => {
      expect(calculateFromDirectYieldLogic(null, 1500, 1, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(1000, null, 1, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(1000, 1500, null, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(1000, 1500, 1, null, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(1000, 1500, 1, 85, null)).toBeNull();
    });

    test('undefinedが含まれる場合はnullを返す', () => {
      expect(calculateFromDirectYieldLogic(1000, 1500, undefined, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(1000, 1500, 1, undefined, 200)).toBeNull();
    });

    test('NaNが含まれる場合はnullを返す', () => {
      expect(calculateFromDirectYieldLogic(1000, NaN, 1, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(1000, 1500, 1, NaN, 200)).toBeNull();
    });

    test('Infinityが含まれる場合はnullを返す', () => {
      expect(calculateFromDirectYieldLogic(1000, 1500, 1, Infinity, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(Infinity, 1500, 1, 85, 200)).toBeNull();
    });
  });

  describe('境界値', () => {
    test('歩留まり率0%', () => {
      const result = calculateFromDirectYieldLogic(1000, 1500, 1, 0, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(0);
      // finishedWeight = 1000g * 0 = 0g
      // finishedPrice は null (isPositive(0) が false)
      expect(result.finishedPrice).toBeNull();
    });

    test('非常に小さい歩留まり率 (0.1%)', () => {
      const result = calculateFromDirectYieldLogic(1000, 1500, 1, 0.1, 200);

      expect(result.yr).toBe(0.1);
      expect(result.ac).toBe(100000); // 100 / 0.001
      // finishedWeight = 1000g * 0.001 = 1g
      // finishedPrice = 200 * (1 / 100) = 2
      expect(result.finishedPrice).toBe(2);
    });

    test('非常に小さい箱重量 (0.01kg)', () => {
      const result = calculateFromDirectYieldLogic(10, 15, 0.01, 85, 200);

      expect(result).not.toBeNull();
      expect(result.bc).toBe(100); // 10 ÷ 0.1 = 100
    });
  });

  describe('実用的なシナリオ', () => {
    test('野菜箱の皮むき加工 (歩留まり率85%)', () => {
      const result = calculateFromDirectYieldLogic(5000, 7500, 5, 85, 180);

      expect(result.yr).toBe(85);
      expect(result.finishedPrice).toBe(7650);
      expect(result.priceDiff).toBe(150);
    });

    test('肉箱のトリミング加工 (歩留まり率70%)', () => {
      const result = calculateFromDirectYieldLogic(15000, 21000, 3, 70, 1000);

      expect(result.yr).toBe(70);
      expect(result.finishedPrice).toBe(21000);
      expect(result.priceDiff).toBe(0);
    });

    test('魚箱の下処理 (歩留まり率60%)', () => {
      const result = calculateFromDirectYieldLogic(12000, 18000, 4, 60, 800);

      expect(result.yr).toBe(60);
      // finishedWeight = 4000g * 0.6 = 2400g
      // finishedPrice = 800 * (2400 / 100) = 19200
      expect(result.finishedPrice).toBe(19200);
      expect(result.priceDiff).toBe(1200);
    });
  });
});
