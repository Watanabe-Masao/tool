/**
 * 歩留まり率統計モードのテスト
 *
 * calculator-yield-stats.js の計算ロジックをテスト
 * 統計データ収集のための歩留まり率計算
 */

import { describe, test, expect } from '@jest/globals';
import {
  calculateYieldRate,
  validateEntry
} from '../scripts/calculator-yield-stats.js';

describe('calculateYieldRate', () => {
  describe('正常な計算', () => {
    test('基本的な歩留まり率計算', () => {
      const result = calculateYieldRate(100, 85);
      expect(result).toBe(85);
    });

    test('歩留まり率100%の場合', () => {
      const result = calculateYieldRate(100, 100);
      expect(result).toBe(100);
    });

    test('歩留まり率50%の場合', () => {
      const result = calculateYieldRate(100, 50);
      expect(result).toBe(50);
    });

    test('小数点を含む重量での計算', () => {
      const result = calculateYieldRate(150.5, 127.925);
      expect(result).toBeCloseTo(85, 2);
    });

    test('非常に小さい重量での計算', () => {
      const result = calculateYieldRate(0.1, 0.085);
      expect(result).toBeCloseTo(85, 2);
    });

    test('大きな重量での計算', () => {
      const result = calculateYieldRate(10000, 8500);
      expect(result).toBe(85);
    });

    test('歩留まり率が100%を超える場合（水分追加など）', () => {
      const result = calculateYieldRate(100, 120);
      expect(result).toBe(120);
    });
  });

  describe('エッジケース', () => {
    test('歩留まり率が非常に低い場合 (1%)', () => {
      const result = calculateYieldRate(100, 1);
      expect(result).toBe(1);
    });

    test('加工後重量が加工前重量より大きい場合', () => {
      const result = calculateYieldRate(100, 150);
      expect(result).toBe(150);
    });

    test('非常に高い歩留まり率 (200%)', () => {
      const result = calculateYieldRate(100, 200);
      expect(result).toBe(200);
    });
  });

  describe('無効な入力', () => {
    test('加工前重量が0の場合はnullを返す', () => {
      const result = calculateYieldRate(0, 85);
      expect(result).toBeNull();
    });

    test('加工後重量が0の場合はnullを返す', () => {
      const result = calculateYieldRate(100, 0);
      expect(result).toBeNull();
    });

    test('加工前重量が負の場合はnullを返す', () => {
      const result = calculateYieldRate(-100, 85);
      expect(result).toBeNull();
    });

    test('加工後重量が負の場合はnullを返す', () => {
      const result = calculateYieldRate(100, -85);
      expect(result).toBeNull();
    });

    test('加工前重量がnullの場合はnullを返す', () => {
      const result = calculateYieldRate(null, 85);
      expect(result).toBeNull();
    });

    test('加工後重量がnullの場合はnullを返す', () => {
      const result = calculateYieldRate(100, null);
      expect(result).toBeNull();
    });

    test('加工前重量がundefinedの場合はnullを返す', () => {
      const result = calculateYieldRate(undefined, 85);
      expect(result).toBeNull();
    });

    test('加工後重量がundefinedの場合はnullを返す', () => {
      const result = calculateYieldRate(100, undefined);
      expect(result).toBeNull();
    });

    test('両方の重量が0の場合はnullを返す', () => {
      const result = calculateYieldRate(0, 0);
      expect(result).toBeNull();
    });
  });

  describe('実用的なシナリオ', () => {
    test('野菜の皮むき加工 (85%)', () => {
      const result = calculateYieldRate(500, 425);
      expect(result).toBe(85);
    });

    test('肉のトリミング (70%)', () => {
      const result = calculateYieldRate(1000, 700);
      expect(result).toBe(70);
    });

    test('魚の下処理 (60%)', () => {
      const result = calculateYieldRate(2000, 1200);
      expect(result).toBe(60);
    });

    test('果物の皮むき (90%)', () => {
      const result = calculateYieldRate(300, 270);
      expect(result).toBe(90);
    });
  });
});

describe('validateEntry', () => {
  describe('有効なエントリ', () => {
    test('正常なエントリは検証を通過する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: 100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(true);
    });

    test('小数点を含む重量でも検証を通過する', () => {
      const entry = {
        productName: 'きゅうり',
        beforeWeight: 150.5,
        afterWeight: 127.925
      };
      expect(validateEntry(entry)).toBe(true);
    });

    test('非常に小さい重量でも検証を通過する', () => {
      const entry = {
        productName: 'ミニトマト',
        beforeWeight: 0.1,
        afterWeight: 0.085
      };
      expect(validateEntry(entry)).toBe(true);
    });

    test('大きな重量でも検証を通過する', () => {
      const entry = {
        productName: 'キャベツ箱',
        beforeWeight: 10000,
        afterWeight: 8500
      };
      expect(validateEntry(entry)).toBe(true);
    });

    test('長い商品名でも検証を通過する', () => {
      const entry = {
        productName: '有機栽培トマト（大玉・熊本県産）',
        beforeWeight: 100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(true);
    });

    test('スペースを含む商品名でも検証を通過する', () => {
      const entry = {
        productName: 'ミニ トマト',
        beforeWeight: 100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(true);
    });
  });

  describe('無効なエントリ - 商品名', () => {
    test('商品名が空文字列の場合は検証に失敗する', () => {
      const entry = {
        productName: '',
        beforeWeight: 100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('商品名がスペースのみの場合は検証に失敗する', () => {
      const entry = {
        productName: '   ',
        beforeWeight: 100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('商品名がnullの場合は検証に失敗する', () => {
      const entry = {
        productName: null,
        beforeWeight: 100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('商品名がundefinedの場合は検証に失敗する', () => {
      const entry = {
        productName: undefined,
        beforeWeight: 100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('商品名が欠けている場合は検証に失敗する', () => {
      const entry = {
        beforeWeight: 100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });
  });

  describe('無効なエントリ - 加工前重量', () => {
    test('加工前重量が0の場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: 0,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('加工前重量が負の場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: -100,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('加工前重量がnullの場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: null,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('加工前重量がundefinedの場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: undefined,
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('加工前重量が欠けている場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        afterWeight: 85
      };
      expect(validateEntry(entry)).toBe(false);
    });
  });

  describe('無効なエントリ - 加工後重量', () => {
    test('加工後重量が0の場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: 100,
        afterWeight: 0
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('加工後重量が負の場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: 100,
        afterWeight: -85
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('加工後重量がnullの場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: 100,
        afterWeight: null
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('加工後重量がundefinedの場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: 100,
        afterWeight: undefined
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('加工後重量が欠けている場合は検証に失敗する', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: 100
      };
      expect(validateEntry(entry)).toBe(false);
    });
  });

  describe('複合的な無効ケース', () => {
    test('すべてのフィールドが無効な場合は検証に失敗する', () => {
      const entry = {
        productName: '',
        beforeWeight: 0,
        afterWeight: -1
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('空オブジェクトの場合は検証に失敗する', () => {
      const entry = {};
      expect(validateEntry(entry)).toBe(false);
    });
  });

  describe('実用的なシナリオ', () => {
    test('正常な野菜エントリ', () => {
      const entry = {
        productName: 'レタス',
        beforeWeight: 500,
        afterWeight: 425
      };
      expect(validateEntry(entry)).toBe(true);
    });

    test('正常な肉エントリ', () => {
      const entry = {
        productName: '豚ロース',
        beforeWeight: 1000,
        afterWeight: 700
      };
      expect(validateEntry(entry)).toBe(true);
    });

    test('正常な魚エントリ', () => {
      const entry = {
        productName: 'サーモン',
        beforeWeight: 2000,
        afterWeight: 1200
      };
      expect(validateEntry(entry)).toBe(true);
    });

    test('データ入力ミス（重量が入力されていない）', () => {
      const entry = {
        productName: 'トマト',
        beforeWeight: null,
        afterWeight: null
      };
      expect(validateEntry(entry)).toBe(false);
    });

    test('不完全なデータ（商品名のみ）', () => {
      const entry = {
        productName: 'きゅうり'
      };
      expect(validateEntry(entry)).toBe(false);
    });
  });
});
