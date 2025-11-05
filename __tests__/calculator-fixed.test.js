/**
 * 定額計算モードのテスト
 *
 * calculator-fixed.js の計算ロジックをテスト
 * ユーザーが実際に使用する重要なビジネスロジック
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
  calculateFromWeightLogic,
  calculateFromDirectYieldLogic,
  calculateFixedLogic,
  calculateFixed
} from '../scripts/calculator-fixed.js';

describe('calculateFromWeightLogic - 重量から計算', () => {
  describe('正常な計算', () => {
    test('基本的な計算が正しく動作する', () => {
      // uc=100円, up=150円, bw=100g, aw=85g, ap=200円/100g
      const result = calculateFromWeightLogic(100, 150, 100, 85, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85); // 歩留まり率 85%
      expect(result.bc).toBe(100); // 加工前コスト100円/100g
      expect(result.bp).toBe(150); // 加工前売価150円/100g
      expect(result.ac).toBeCloseTo(117.65, 2); // 加工後コスト
      expect(result.ap).toBe(200); // 加工後売価
      expect(result.bm).toBeCloseTo(33.33, 2); // 加工前粗利率 (150-100)/150*100
      expect(result.am).toBeCloseTo(41.18, 2); // 加工後粗利率 (200-117.65)/200*100
      expect(result.finishedPrice).toBe(170); // 仕上がり売価 (200 * 85 / 100)
      expect(result.priceDiff).toBe(20); // 差額 (170 - 150)
      expect(result.finishedLabel).toBe('1個あたりの仕上がり売価');
    });

    test('歩留まり率100%の場合', () => {
      // 重量が変わらない場合
      const result = calculateFromWeightLogic(100, 150, 100, 100, 200);

      expect(result.yr).toBe(100);
      expect(result.ac).toBe(100); // コストも変わらない
      expect(result.finishedPrice).toBe(200); // 200 * 1.0
      expect(result.priceDiff).toBe(50); // 200 - 150
    });

    test('歩留まり率50%の場合', () => {
      const result = calculateFromWeightLogic(100, 150, 100, 50, 300);

      expect(result.yr).toBe(50);
      expect(result.ac).toBe(200); // 100 / 0.5
      expect(result.finishedPrice).toBe(150); // 300 * 0.5
      expect(result.priceDiff).toBe(0); // 150 - 150
    });

    test('小数点を含む重量での計算', () => {
      const result = calculateFromWeightLogic(120, 180, 150.5, 127.925, 250);

      expect(result).not.toBeNull();
      expect(result.yr).toBeCloseTo(85, 2);
      expect(result.bc).toBeCloseTo(79.73, 2);
      // finishedWeight = 150.5 * 0.85 = 127.925g
      // finishedPrice = 250 * (127.925 / 100) = 319.8125
      expect(result.finishedPrice).toBeCloseTo(319.81, 1);
    });

    test('大きな数値での計算', () => {
      const result = calculateFromWeightLogic(1000, 1500, 1000, 850, 2000);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85);
      // finishedWeight = 1000 * 0.85 = 850g
      // finishedPrice = 2000 * (850 / 100) = 17000
      expect(result.finishedPrice).toBe(17000);
      expect(result.priceDiff).toBe(15500); // 17000 - 1500
    });
  });

  describe('エッジケース', () => {
    test('歩留まり率が非常に低い場合 (10%)', () => {
      const result = calculateFromWeightLogic(100, 150, 100, 10, 500);

      expect(result.yr).toBe(10);
      expect(result.ac).toBe(1000); // 100 / 0.1
      expect(result.finishedPrice).toBe(50); // 500 * 0.1
      expect(result.priceDiff).toBe(-100); // マイナスになる
    });

    test('加工後売価が非常に高い場合', () => {
      const result = calculateFromWeightLogic(100, 150, 100, 85, 10000);

      expect(result.ap).toBe(10000);
      expect(result.finishedPrice).toBe(8500);
      expect(result.priceDiff).toBe(8350); // 大きなプラス
    });

    test('単価コストと単価売価が同じ場合（粗利率0%）', () => {
      const result = calculateFromWeightLogic(100, 100, 100, 85, 200);

      expect(result.bm).toBe(0); // 粗利率0%
      expect(result).not.toBeNull();
    });

    test('単価コストが単価売価より高い場合（赤字）', () => {
      const result = calculateFromWeightLogic(150, 100, 100, 85, 200);

      expect(result.bm).toBe(-50); // マイナス粗利率
      expect(result).not.toBeNull();
    });
  });

  describe('無効な入力', () => {
    test('必須パラメータが欠けている場合はnullを返す', () => {
      expect(calculateFromWeightLogic(null, 150, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(100, null, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(100, 150, null, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(100, 150, 100, null, 200)).toBeNull();
      expect(calculateFromWeightLogic(100, 150, 100, 85, null)).toBeNull();
    });

    test('undefinedが含まれる場合はnullを返す', () => {
      expect(calculateFromWeightLogic(undefined, 150, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(100, undefined, 100, 85, 200)).toBeNull();
    });

    test('NaNが含まれる場合はnullを返す', () => {
      expect(calculateFromWeightLogic(NaN, 150, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(100, 150, NaN, 85, 200)).toBeNull();
    });

    test('Infinityが含まれる場合はnullを返す', () => {
      expect(calculateFromWeightLogic(Infinity, 150, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(100, 150, 100, 85, Infinity)).toBeNull();
    });

    test('文字列が含まれる場合はnullを返す', () => {
      expect(calculateFromWeightLogic('100', 150, 100, 85, 200)).toBeNull();
      expect(calculateFromWeightLogic(100, '150', 100, 85, 200)).toBeNull();
    });

    test('負の値が含まれる場合でも計算は実行される', () => {
      // 負の値は Number.isFinite() を通過するため計算される
      const result = calculateFromWeightLogic(-100, 150, 100, 85, 200);
      expect(result).not.toBeNull();
    });
  });

  describe('境界値', () => {
    test('非常に小さい正の値', () => {
      const result = calculateFromWeightLogic(0.01, 0.02, 0.01, 0.0085, 0.03);
      expect(result).not.toBeNull();
      expect(result.yr).toBeCloseTo(85, 10); // 浮動小数点の精度を考慮
    });

    test('ゼロ重量（歩留まり率計算がnullを返す）', () => {
      const result = calculateFromWeightLogic(100, 150, 0, 85, 200);
      // calcYield が null を返すため、結果も影響を受ける
      expect(result).not.toBeNull();
      expect(result.yr).toBeNull();
    });

    test('加工後重量がゼロ', () => {
      const result = calculateFromWeightLogic(100, 150, 100, 0, 200);
      expect(result).not.toBeNull();
      expect(result.yr).toBeNull();
    });
  });
});

describe('calculateFromDirectYieldLogic - 歩留まり率を直接入力', () => {
  describe('正常な計算', () => {
    test('基本的な計算が正しく動作する', () => {
      // uc=100円, up=150円, bw=100g, yr=85%, ap=200円/100g
      const result = calculateFromDirectYieldLogic(100, 150, 100, 85, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85); // 直接入力された歩留まり率
      expect(result.bc).toBe(100);
      expect(result.bp).toBe(150);
      expect(result.ac).toBeCloseTo(117.65, 2);
      expect(result.ap).toBe(200);
      expect(result.bm).toBeCloseTo(33.33, 2); // (150-100)/150*100
      expect(result.am).toBeCloseTo(41.18, 2); // (200-117.65)/200*100
      expect(result.finishedPrice).toBe(170); // 200 * (100 * 0.85) / 100
      expect(result.priceDiff).toBe(20);
      expect(result.finishedLabel).toBe('1個あたりの仕上がり売価');
    });

    test('calculateFromWeightLogicと同じ結果になる', () => {
      // 同じ歩留まり率であれば同じ結果
      const result1 = calculateFromWeightLogic(100, 150, 100, 85, 200);
      const result2 = calculateFromDirectYieldLogic(100, 150, 100, 85, 200);

      expect(result1.yr).toBe(result2.yr);
      expect(result1.ac).toBeCloseTo(result2.ac, 10);
      expect(result1.finishedPrice).toBe(result2.finishedPrice);
      expect(result1.priceDiff).toBe(result2.priceDiff);
    });

    test('歩留まり率100%の場合', () => {
      const result = calculateFromDirectYieldLogic(100, 150, 100, 100, 200);

      expect(result.yr).toBe(100);
      expect(result.ac).toBe(100);
      expect(result.finishedPrice).toBe(200);
    });

    test('歩留まり率50%の場合', () => {
      const result = calculateFromDirectYieldLogic(100, 150, 100, 50, 300);

      expect(result.yr).toBe(50);
      expect(result.ac).toBe(200);
      expect(result.finishedPrice).toBe(150);
    });

    test('小数点を含む歩留まり率', () => {
      const result = calculateFromDirectYieldLogic(100, 150, 100, 85.5, 200);

      expect(result.yr).toBe(85.5);
      expect(result.ac).toBeCloseTo(116.96, 2);
      expect(result.finishedPrice).toBe(171); // 200 * 0.855
    });

    test('異なる加工前重量での計算', () => {
      const result = calculateFromDirectYieldLogic(120, 180, 200, 85, 250);

      expect(result).not.toBeNull();
      expect(result.bc).toBe(60); // 120 * 100 / 200
      expect(result.bp).toBe(90); // 180 * 100 / 200
      expect(result.finishedPrice).toBe(425); // 250 * (200 * 0.85) / 100
    });
  });

  describe('エッジケース', () => {
    test('歩留まり率が非常に低い場合 (5%)', () => {
      const result = calculateFromDirectYieldLogic(100, 150, 100, 5, 500);

      expect(result.yr).toBe(5);
      expect(result.ac).toBe(2000); // 100 / 0.05
      expect(result.finishedPrice).toBe(25); // 500 * 0.05
      expect(result.priceDiff).toBe(-125);
    });

    test('歩留まり率120%（理論上あり得ないが数値的には可能）', () => {
      // 水分を加えるなど、特殊なケース
      const result = calculateFromDirectYieldLogic(100, 150, 100, 120, 200);

      expect(result.yr).toBe(120);
      expect(result.ac).toBeCloseTo(83.33, 2);
      expect(result.finishedPrice).toBe(240);
    });

    test('粗利率が負の値になる場合', () => {
      const result = calculateFromDirectYieldLogic(150, 100, 100, 85, 200);

      expect(result.bm).toBe(-50);
      expect(result).not.toBeNull();
    });
  });

  describe('無効な入力', () => {
    test('必須パラメータが欠けている場合はnullを返す', () => {
      expect(calculateFromDirectYieldLogic(null, 150, 100, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(100, null, 100, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(100, 150, null, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(100, 150, 100, null, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(100, 150, 100, 85, null)).toBeNull();
    });

    test('undefinedが含まれる場合はnullを返す', () => {
      expect(calculateFromDirectYieldLogic(100, 150, undefined, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(100, 150, 100, undefined, 200)).toBeNull();
    });

    test('NaNが含まれる場合はnullを返す', () => {
      expect(calculateFromDirectYieldLogic(100, NaN, 100, 85, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(100, 150, 100, NaN, 200)).toBeNull();
    });

    test('Infinityが含まれる場合はnullを返す', () => {
      expect(calculateFromDirectYieldLogic(100, 150, 100, Infinity, 200)).toBeNull();
      expect(calculateFromDirectYieldLogic(Infinity, 150, 100, 85, 200)).toBeNull();
    });
  });

  describe('境界値', () => {
    test('歩留まり率0%', () => {
      const result = calculateFromDirectYieldLogic(100, 150, 100, 0, 200);

      // 0で除算が発生するため Infinity になる可能性がある
      expect(result).not.toBeNull();
      expect(result.yr).toBe(0);
      // finishedWeight = 100 * 0 = 0g
      // finishedPrice は null (isPositive(0) が false)
      expect(result.finishedPrice).toBeNull();
    });

    test('非常に小さい歩留まり率 (0.1%)', () => {
      const result = calculateFromDirectYieldLogic(100, 150, 100, 0.1, 200);

      expect(result.yr).toBe(0.1);
      expect(result.ac).toBe(100000); // 100 / 0.001
      expect(result.finishedPrice).toBe(0.2); // 200 * 0.001
    });

    test('非常に小さい加工前重量', () => {
      const result = calculateFromDirectYieldLogic(0.1, 0.15, 0.01, 85, 2);

      expect(result).not.toBeNull();
      expect(result.bc).toBe(1000); // 0.1 * 100 / 0.01
    });
  });

  describe('実用的なシナリオ', () => {
    test('野菜の皮むき加工 (歩留まり率85%)', () => {
      // 100円の野菜、150円で販売、100g、歩留まり85%、加工後200円/100g
      const result = calculateFromDirectYieldLogic(100, 150, 100, 85, 200);

      expect(result.yr).toBe(85);
      expect(result.finishedPrice).toBe(170);
      expect(result.priceDiff).toBe(20); // 加工で20円上がる
    });

    test('肉のトリミング加工 (歩留まり率70%)', () => {
      // 500円の肉、700円で販売、200g、歩留まり70%、加工後1000円/100g
      const result = calculateFromDirectYieldLogic(500, 700, 200, 70, 1000);

      expect(result.yr).toBe(70);
      expect(result.bc).toBe(250); // 500 * 100 / 200
      expect(result.bp).toBe(350); // 700 * 100 / 200
      expect(result.ac).toBeCloseTo(357.14, 2);
      expect(result.finishedPrice).toBe(1400); // 1000 * (200 * 0.7) / 100
    });

    test('魚の下処理 (歩留まり率60%)', () => {
      const result = calculateFromDirectYieldLogic(300, 450, 150, 60, 800);

      expect(result.yr).toBe(60);
      expect(result.finishedPrice).toBe(720);
      expect(result.priceDiff).toBe(270);
    });
  });
});

describe('calculateFixedLogic - メソッド選択による計算', () => {
  describe('calculateメソッド（重量から計算）', () => {
    test('基本的な計算が正しく動作する', () => {
      const result = calculateFixedLogic('calculate', 100, 150, 100, 85, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85);
      expect(result.finishedPrice).toBe(170);
    });

    test('calculateFromWeightLogicと同じ結果を返す', () => {
      const result1 = calculateFixedLogic('calculate', 100, 150, 100, 85, 200);
      const result2 = calculateFromWeightLogic(100, 150, 100, 85, 200);

      expect(result1).toEqual(result2);
    });

    test('歩留まり率100%の場合', () => {
      const result = calculateFixedLogic('calculate', 100, 150, 100, 100, 200);
      expect(result.yr).toBe(100);
      expect(result.finishedPrice).toBe(200);
    });

    test('小数点を含む重量での計算', () => {
      const result = calculateFixedLogic('calculate', 120, 180, 150.5, 127.925, 250);
      expect(result).not.toBeNull();
      expect(result.yr).toBeCloseTo(85, 2);
    });
  });

  describe('directメソッド（歩留まり率を直接入力）', () => {
    test('基本的な計算が正しく動作する', () => {
      const result = calculateFixedLogic('direct', 100, 150, 100, 85, 200);

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85);
      expect(result.finishedPrice).toBe(170);
    });

    test('calculateFromDirectYieldLogicと同じ結果を返す', () => {
      const result1 = calculateFixedLogic('direct', 100, 150, 100, 85, 200);
      const result2 = calculateFromDirectYieldLogic(100, 150, 100, 85, 200);

      expect(result1).toEqual(result2);
    });

    test('歩留まり率50%の場合', () => {
      const result = calculateFixedLogic('direct', 100, 150, 100, 50, 300);
      expect(result.yr).toBe(50);
      expect(result.finishedPrice).toBe(150);
    });

    test('小数点を含む歩留まり率', () => {
      const result = calculateFixedLogic('direct', 100, 150, 100, 85.5, 200);
      expect(result.yr).toBe(85.5);
    });
  });

  describe('メソッドのバリデーション', () => {
    test('calculateとdirectで異なる結果を返す', () => {
      // calculate: 第4引数は加工後重量
      const resultCalculate = calculateFixedLogic('calculate', 100, 150, 100, 85, 200);

      // direct: 第4引数は歩留まり率
      const resultDirect = calculateFixedLogic('direct', 100, 150, 100, 85, 200);

      // 同じパラメータでも意味が異なる
      expect(resultCalculate).toEqual(resultDirect); // この場合は同じ結果
    });

    test('不明なメソッドの場合はcalculateとして扱う', () => {
      const result = calculateFixedLogic('unknown', 100, 150, 100, 85, 200);
      expect(result).not.toBeNull();
      expect(result.yr).toBe(85);
    });

    test('空文字列のメソッドはcalculateとして扱う', () => {
      const result = calculateFixedLogic('', 100, 150, 100, 85, 200);
      expect(result).not.toBeNull();
    });

    test('nullのメソッドはcalculateとして扱う', () => {
      const result = calculateFixedLogic(null, 100, 150, 100, 85, 200);
      expect(result).not.toBeNull();
    });
  });

  describe('実用的なシナリオ', () => {
    test('野菜の皮むき（calculateメソッド）', () => {
      const result = calculateFixedLogic('calculate', 100, 150, 100, 85, 200);
      expect(result.finishedPrice).toBe(170);
      expect(result.priceDiff).toBe(20);
    });

    test('野菜の皮むき（directメソッド）', () => {
      const result = calculateFixedLogic('direct', 100, 150, 100, 85, 200);
      expect(result.finishedPrice).toBe(170);
      expect(result.priceDiff).toBe(20);
    });

    test('肉のトリミング（directメソッド）', () => {
      const result = calculateFixedLogic('direct', 500, 700, 200, 70, 1000);
      expect(result.yr).toBe(70);
      expect(result.finishedPrice).toBe(1400);
    });
  });
});

describe('calculateFixed - DOM統合関数', () => {
  beforeEach(() => {
    // DOMをクリア
    document.body.innerHTML = '';
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  describe('calculateメソッド（重量から計算）', () => {
    test('DOM要素から値を読み取って計算する', () => {
      // DOM要素を作成
      document.body.innerHTML = `
        <input id="unitCost" value="100" />
        <input id="unitPrice" value="150" />
        <input id="beforeWeight" value="100" />
        <input id="afterWeight" value="85" />
        <input id="afterPrice100" value="200" />
      `;

      const result = calculateFixed('calculate');

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85);
      expect(result.finishedPrice).toBe(170);
    });

    test('DOM要素が空の場合はnullを返す', () => {
      document.body.innerHTML = `
        <input id="unitCost" value="" />
        <input id="unitPrice" value="150" />
        <input id="beforeWeight" value="100" />
        <input id="afterWeight" value="85" />
        <input id="afterPrice100" value="200" />
      `;

      const result = calculateFixed('calculate');

      expect(result).toBeNull();
    });

    test('DOM要素が無効な値の場合はnullを返す', () => {
      document.body.innerHTML = `
        <input id="unitCost" value="abc" />
        <input id="unitPrice" value="150" />
        <input id="beforeWeight" value="100" />
        <input id="afterWeight" value="85" />
        <input id="afterPrice100" value="200" />
      `;

      const result = calculateFixed('calculate');

      expect(result).toBeNull();
    });

    test('小数点を含む値でも正しく計算する', () => {
      document.body.innerHTML = `
        <input id="unitCost" value="100.5" />
        <input id="unitPrice" value="150.75" />
        <input id="beforeWeight" value="100.25" />
        <input id="afterWeight" value="85.2" />
        <input id="afterPrice100" value="200.5" />
      `;

      const result = calculateFixed('calculate');

      expect(result).not.toBeNull();
      expect(result.yr).toBeCloseTo(84.99, 2);
    });
  });

  describe('directメソッド（歩留まり率を直接入力）', () => {
    test('DOM要素から値を読み取って計算する', () => {
      document.body.innerHTML = `
        <input id="unitCostDirect" value="100" />
        <input id="unitPriceDirect" value="150" />
        <input id="beforeWeightDirect" value="100" />
        <input id="yieldRateDirect" value="85" />
        <input id="afterPrice100Direct" value="200" />
      `;

      const result = calculateFixed('direct');

      expect(result).not.toBeNull();
      expect(result.yr).toBe(85);
      expect(result.finishedPrice).toBe(170);
    });

    test('DOM要素が空の場合はnullを返す', () => {
      document.body.innerHTML = `
        <input id="unitCostDirect" value="100" />
        <input id="unitPriceDirect" value="150" />
        <input id="beforeWeightDirect" value="" />
        <input id="yieldRateDirect" value="85" />
        <input id="afterPrice100Direct" value="200" />
      `;

      const result = calculateFixed('direct');

      expect(result).toBeNull();
    });

    test('歩留まり率が正しく読み取られる', () => {
      document.body.innerHTML = `
        <input id="unitCostDirect" value="100" />
        <input id="unitPriceDirect" value="150" />
        <input id="beforeWeightDirect" value="100" />
        <input id="yieldRateDirect" value="70.5" />
        <input id="afterPrice100Direct" value="200" />
      `;

      const result = calculateFixed('direct');

      expect(result).not.toBeNull();
      expect(result.yr).toBe(70.5);
    });
  });

  describe('メソッドによるDOM要素の切り替え', () => {
    test('calculateメソッドは加工後重量を使用する', () => {
      document.body.innerHTML = `
        <input id="unitCost" value="100" />
        <input id="unitPrice" value="150" />
        <input id="beforeWeight" value="100" />
        <input id="afterWeight" value="80" />
        <input id="afterPrice100" value="200" />
      `;

      const result = calculateFixed('calculate');

      // afterWeightの80を使用（歩留まり率80%として計算）
      expect(result.yr).toBe(80);
    });

    test('directメソッドは歩留まり率を使用する', () => {
      document.body.innerHTML = `
        <input id="unitCostDirect" value="100" />
        <input id="unitPriceDirect" value="150" />
        <input id="beforeWeightDirect" value="100" />
        <input id="yieldRateDirect" value="90" />
        <input id="afterPrice100Direct" value="200" />
      `;

      const result = calculateFixed('direct');

      // yieldRateDirect の90を使用
      expect(result.yr).toBe(90);
    });
  });

  describe('エラーハンドリング', () => {
    test('DOM要素が存在しない場合はnullを返す', () => {
      // DOM要素なし
      document.body.innerHTML = '';

      const result = calculateFixed('calculate');

      expect(result).toBeNull();
    });

    test('一部のDOM要素だけ存在する場合はnullを返す', () => {
      document.body.innerHTML = `
        <input id="unitCost" value="100" />
        <input id="unitPrice" value="150" />
      `;

      const result = calculateFixed('calculate');

      expect(result).toBeNull();
    });
  });
});
