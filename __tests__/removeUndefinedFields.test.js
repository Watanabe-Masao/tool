/**
 * removeUndefinedFields 関数のテスト
 */

import { describe, test, expect } from '@jest/globals';

// テスト用にremoveUndefinedFieldsをインライン定義
function removeUndefinedFields(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date || obj.constructor?.name === 'Timestamp' || obj.constructor?.name === 'FieldValue') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .filter(item => item !== undefined)
      .map(item => removeUndefinedFields(item));
  }

  const cleaned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
      cleaned[key] = removeUndefinedFields(obj[key]);
    }
  }
  return cleaned;
}

describe('removeUndefinedFields', () => {
  test('should remove undefined fields from flat object', () => {
    const input = {
      name: 'テスト',
      category: undefined,
      mode: 'fixed',
      price: null
    };

    const result = removeUndefinedFields(input);

    expect(result).toEqual({
      name: 'テスト',
      mode: 'fixed',
      price: null
    });
    expect(result).not.toHaveProperty('category');
  });

  test('should remove undefined fields from nested objects', () => {
    const input = {
      name: 'テスト',
      input: {
        buyPrice: 100,
        sellPrice: undefined,
        quantity: 10
      },
      result: {
        profit: 50,
        margin: undefined
      },
      category: undefined
    };

    const result = removeUndefinedFields(input);

    expect(result).toEqual({
      name: 'テスト',
      input: {
        buyPrice: 100,
        quantity: 10
      },
      result: {
        profit: 50
      }
    });
  });

  test('should handle arrays with undefined values', () => {
    const input = {
      items: [1, undefined, 3, undefined, 5]
    };

    const result = removeUndefinedFields(input);

    expect(result).toEqual({
      items: [1, 3, 5]
    });
  });

  test('should handle nested arrays with objects', () => {
    const input = {
      items: [
        { id: 1, value: 'a', extra: undefined },
        { id: 2, value: 'b' },
        { id: 3, value: undefined }
      ]
    };

    const result = removeUndefinedFields(input);

    expect(result).toEqual({
      items: [
        { id: 1, value: 'a' },
        { id: 2, value: 'b' },
        { id: 3 }
      ]
    });
  });

  test('should preserve null values', () => {
    const input = {
      name: 'テスト',
      category: null,
      product: null,
      value: undefined
    };

    const result = removeUndefinedFields(input);

    expect(result).toEqual({
      name: 'テスト',
      category: null,
      product: null
    });
    expect(result.category).toBeNull();
    expect(result.product).toBeNull();
  });

  test('should handle deeply nested objects', () => {
    const input = {
      level1: {
        level2: {
          level3: {
            value: 'deep',
            undefined1: undefined
          },
          undefined2: undefined
        },
        undefined3: undefined
      }
    };

    const result = removeUndefinedFields(input);

    expect(result).toEqual({
      level1: {
        level2: {
          level3: {
            value: 'deep'
          }
        }
      }
    });
  });

  test('should preserve Date objects', () => {
    const date = new Date('2025-11-03');
    const input = {
      name: 'テスト',
      createdAt: date,
      category: undefined
    };

    const result = removeUndefinedFields(input);

    expect(result).toEqual({
      name: 'テスト',
      createdAt: date
    });
    expect(result.createdAt).toBe(date);
    expect(result.createdAt instanceof Date).toBe(true);
  });

  test('should handle empty objects', () => {
    const input = {};
    const result = removeUndefinedFields(input);
    expect(result).toEqual({});
  });

  test('should handle objects with all undefined values', () => {
    const input = {
      a: undefined,
      b: undefined,
      c: undefined
    };

    const result = removeUndefinedFields(input);
    expect(result).toEqual({});
  });

  test('should handle primitive types', () => {
    expect(removeUndefinedFields(123)).toBe(123);
    expect(removeUndefinedFields('test')).toBe('test');
    expect(removeUndefinedFields(true)).toBe(true);
    expect(removeUndefinedFields(false)).toBe(false);
    expect(removeUndefinedFields(null)).toBe(null);
    expect(removeUndefinedFields(undefined)).toBe(undefined);
  });

  test('should handle typical calculation data structure', () => {
    const input = {
      name: 'テスト商品',
      mode: 'fixed',
      category: null,
      input: {
        buyPrice: 100,
        sellPrice: 150,
        quantity: undefined
      },
      result: {
        profit: 50,
        profitRate: 50,
        extra: undefined
      },
      product: null,
      timestamp: 1699000000000
    };

    const result = removeUndefinedFields(input);

    expect(result).toEqual({
      name: 'テスト商品',
      mode: 'fixed',
      category: null,
      input: {
        buyPrice: 100,
        sellPrice: 150
      },
      result: {
        profit: 50,
        profitRate: 50
      },
      product: null,
      timestamp: 1699000000000
    });
  });
});
