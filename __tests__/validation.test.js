/**
 * バリデーション関数のテスト
 *
 * validation.js の検証ロジックをテスト
 */

import { describe, test, expect } from '@jest/globals';
import { ValidationError } from '../scripts/errors.js';
import {
  validateName,
  validateMode,
  validateInputData,
  validateResultData,
  validateCategory,
  validateProductData,
  validateCalculationData,
  validateId,
  validateUUID
} from '../scripts/validation.js';

describe('validateName', () => {
  test('有効な名前は検証を通過する', () => {
    expect(validateName('テスト計算')).toBe(true);
    expect(validateName('計算データ1')).toBe(true);
    expect(validateName('A')).toBe(true);
  });

  test('空文字列はエラーをスローする', () => {
    expect(() => validateName('')).toThrow(ValidationError);
    expect(() => validateName('  ')).toThrow(ValidationError);
  });

  test('null/undefinedはエラーをスローする', () => {
    expect(() => validateName(null)).toThrow(ValidationError);
    expect(() => validateName(undefined)).toThrow(ValidationError);
  });

  test('100文字を超える名前はエラーをスローする', () => {
    const longName = 'あ'.repeat(101);
    expect(() => validateName(longName)).toThrow(ValidationError);
  });
});

describe('validateMode', () => {
  test('有効なモードは検証を通過する', () => {
    expect(validateMode('fixed')).toBe(true);
    expect(validateMode('weight')).toBe(true);
    expect(validateMode('yieldStats')).toBe(true);
    expect(validateMode('multiPattern')).toBe(true);
  });

  test('無効なモードはエラーをスローする', () => {
    expect(() => validateMode('INVALID')).toThrow(ValidationError);
    expect(() => validateMode('FIXED')).toThrow(ValidationError); // 大文字は無効
    expect(() => validateMode('')).toThrow(ValidationError);
  });

  test('null/undefinedはエラーをスローする', () => {
    expect(() => validateMode(null)).toThrow(ValidationError);
    expect(() => validateMode(undefined)).toThrow(ValidationError);
  });
});

describe('validateInputData', () => {
  test('有効なfixedモード入力データは検証を通過する', () => {
    const inputData = {
      unitCost: 100,
      unitPrice: 150,
      beforeWeight: 100,
      afterWeight: 80
    };
    expect(validateInputData(inputData, 'fixed')).toBe(true);
  });

  test('有効なweightモード入力データは検証を通過する', () => {
    const inputData = {
      beforeWeight: 100,
      afterWeight: 80,
      unitCost: 100
    };
    expect(validateInputData(inputData, 'weight')).toBe(true);
  });

  test('null/undefinedはエラーをスローする', () => {
    expect(() => validateInputData(null, 'fixed')).toThrow(ValidationError);
    expect(() => validateInputData(undefined, 'fixed')).toThrow(ValidationError);
  });

  test('配列はエラーをスローする', () => {
    expect(() => validateInputData([], 'fixed')).toThrow(ValidationError);
  });

  test('文字列はエラーをスローする', () => {
    expect(() => validateInputData('test', 'fixed')).toThrow(ValidationError);
  });
});

describe('validateResultData', () => {
  test('有効な結果データは検証を通過する', () => {
    const resultData = {
      yieldRate: 80,
      beforeCost100: 100,
      afterCost100: 125
    };
    expect(validateResultData(resultData)).toBe(true);
  });

  test('null/undefinedはエラーをスローする', () => {
    expect(() => validateResultData(null)).toThrow(ValidationError);
    expect(() => validateResultData(undefined)).toThrow(ValidationError);
  });

  test('配列はエラーをスローする', () => {
    expect(() => validateResultData([])).toThrow(ValidationError);
  });
});

describe('validateCategory', () => {
  test('有効なカテゴリは検証を通過する', () => {
    expect(validateCategory('野菜')).toBe(true);
    expect(validateCategory('肉類')).toBe(true);
    expect(validateCategory('')).toBe(true); // 空文字列は許可
  });

  test('50文字を超えるカテゴリはエラーをスローする', () => {
    const longCategory = 'あ'.repeat(51);
    expect(() => validateCategory(longCategory)).toThrow(ValidationError);
  });

  test('文字列以外はエラーをスローする', () => {
    expect(() => validateCategory(123)).toThrow(ValidationError);
    expect(() => validateCategory({})).toThrow(ValidationError);
    expect(() => validateCategory([])).toThrow(ValidationError);
  });
});

describe('validateProductData', () => {
  test('有効な商品データは検証を通過する', () => {
    const productData = {
      name: '商品名',
      supplier: '仕入れ先'
    };
    expect(validateProductData(productData)).toBe(true);
  });

  test('空のオブジェクトは検証を通過する', () => {
    expect(validateProductData({})).toBe(true);
  });

  test('null/undefinedは許可される（オプションフィールド）', () => {
    expect(validateProductData(null)).toBe(true);
    expect(validateProductData(undefined)).toBe(true);
  });

  test('配列はエラーをスローする', () => {
    expect(() => validateProductData([])).toThrow(ValidationError);
  });
});

describe('validateCalculationData', () => {
  test('完全な計算データは検証を通過する', () => {
    const data = {
      name: 'テスト計算',
      mode: 'fixed',
      inputData: { test: 'data' },
      resultData: { result: 'data' },
      category: 'カテゴリ',
      productData: { name: '商品名' },
      timestamp: Date.now()
    };
    expect(validateCalculationData(data)).toBe(true);
  });

  test('必須フィールド（name, mode, inputData, resultData）で検証を通過する', () => {
    const data = {
      name: 'テスト',
      mode: 'weight',
      inputData: {},
      resultData: {} // resultDataは必須
    };
    expect(validateCalculationData(data)).toBe(true);
  });

  test('nameが欠けているとエラーをスローする', () => {
    const data = {
      mode: 'fixed',
      inputData: {}
    };
    expect(() => validateCalculationData(data)).toThrow(ValidationError);
  });

  test('modeが欠けているとエラーをスローする', () => {
    const data = {
      name: 'テスト',
      inputData: {}
    };
    expect(() => validateCalculationData(data)).toThrow(ValidationError);
  });

  test('inputDataが欠けているとエラーをスローする', () => {
    const data = {
      name: 'テスト',
      mode: 'fixed'
    };
    expect(() => validateCalculationData(data)).toThrow(ValidationError);
  });
});

describe('validateId', () => {
  test('有効なIDは検証を通過する', () => {
    expect(validateId(1)).toBe(true);
    expect(validateId(999)).toBe(true);
    expect(validateId(1, 'カスタムID')).toBe(true);
  });

  test('0以下のIDはエラーをスローする', () => {
    expect(() => validateId(0)).toThrow(ValidationError);
    expect(() => validateId(-1)).toThrow(ValidationError);
  });

  test('整数でないIDはエラーをスローする', () => {
    expect(() => validateId(1.5)).toThrow(ValidationError);
    expect(() => validateId(NaN)).toThrow(ValidationError);
    expect(() => validateId(Infinity)).toThrow(ValidationError);
  });

  test('null/undefinedはエラーをスローする', () => {
    expect(() => validateId(null)).toThrow(ValidationError);
    expect(() => validateId(undefined)).toThrow(ValidationError);
  });

  test('文字列はエラーをスローする', () => {
    expect(() => validateId('1')).toThrow(ValidationError);
  });
});

describe('validateUUID', () => {
  test('有効なUUID v4は検証を通過する', () => {
    expect(validateUUID('550e8400-e29b-41d4-a916-446655440000')).toBe(true);
    expect(validateUUID('123e4567-e89b-42d3-a456-426614174000')).toBe(true); // 3番目のブロックを4で開始
  });

  test('無効なUUID形式はエラーをスローする', () => {
    expect(() => validateUUID('invalid-uuid')).toThrow(ValidationError);
    expect(() => validateUUID('550e8400-e29b-41d4-a916')).toThrow(ValidationError);
    expect(() => validateUUID('')).toThrow(ValidationError);
  });

  test('null/undefinedはエラーをスローする', () => {
    expect(() => validateUUID(null)).toThrow(ValidationError);
    expect(() => validateUUID(undefined)).toThrow(ValidationError);
  });

  test('文字列以外はエラーをスローする', () => {
    expect(() => validateUUID(123)).toThrow(ValidationError);
    expect(() => validateUUID({})).toThrow(ValidationError);
  });
});
