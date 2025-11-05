/**
 * @jest-environment jsdom
 */

import { memoize, memoizeWithClear, arrayKeyGenerator, objectKeyGenerator } from '../scripts/memoize.js';

describe('memoize', () => {
  describe('基本的なメモ化', () => {
    test('関数の結果をキャッシュする', () => {
      let callCount = 0;
      const expensiveFunction = (x) => {
        callCount++;
        return x * 2;
      };

      const memoized = memoize(expensiveFunction);

      // 初回呼び出し
      expect(memoized(5)).toBe(10);
      expect(callCount).toBe(1);

      // 2回目は同じ引数なのでキャッシュから返す
      expect(memoized(5)).toBe(10);
      expect(callCount).toBe(1); // 関数は呼ばれていない

      // 異なる引数では再計算
      expect(memoized(10)).toBe(20);
      expect(callCount).toBe(2);
    });

    test('複数の引数を持つ関数をメモ化', () => {
      let callCount = 0;
      const add = (a, b) => {
        callCount++;
        return a + b;
      };

      const memoized = memoize(add);

      expect(memoized(1, 2)).toBe(3);
      expect(callCount).toBe(1);

      expect(memoized(1, 2)).toBe(3);
      expect(callCount).toBe(1); // キャッシュヒット

      expect(memoized(2, 3)).toBe(5);
      expect(callCount).toBe(2);
    });
  });

  describe('LRUキャッシュ', () => {
    test('maxSizeを超えると古いエントリが削除される', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * 2;
      };

      const memoized = memoize(fn, { maxSize: 2 });

      // 3つの値をキャッシュに追加（maxSize=2なので最古が削除される）
      const result1 = memoized(1); // callCount: 1
      const result2 = memoized(2); // callCount: 2
      const result3 = memoized(3); // callCount: 3

      expect(result1).toBe(2);
      expect(result2).toBe(4);
      expect(result3).toBe(6);
      expect(callCount).toBe(3);

      // キャッシュサイズが2に制限されることを確認
      // 1は削除されているはず
      callCount = 0;
      memoized(1); // 再計算される
      expect(callCount).toBe(1);
    });

    test('LRU動作: アクセスされたエントリが優先される', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * 2;
      };

      const memoized = memoize(fn, { maxSize: 2 });

      memoized(1);
      memoized(2);
      // ここでキャッシュは満杯: [1, 2]

      // 1を再度アクセス
      callCount = 0;
      memoized(1);
      expect(callCount).toBe(0); // キャッシュヒット

      // 3を追加すると、1より古い2が削除されるはず
      memoized(3);

      // 1はまだキャッシュにある
      callCount = 0;
      memoized(1);
      expect(callCount).toBe(0);
    });
  });

  describe('カスタムキー生成', () => {
    test('arrayKeyGeneratorで配列を高速にキー化', () => {
      const arr1 = [1, 2, 3];
      const arr2 = [1, 2, 3];
      const arr3 = [1, 2, 4];

      const key1 = arrayKeyGenerator([arr1]);
      const key2 = arrayKeyGenerator([arr2]);
      const key3 = arrayKeyGenerator([arr3]);

      // 同じ配列は同じキー
      expect(key1).toBe(key2);
      // 異なる配列は異なるキー
      expect(key1).not.toBe(key3);
    });

    test('arrayKeyGeneratorで複数引数の場合はJSON.stringifyにフォールバック', () => {
      const key = arrayKeyGenerator([1, 2, 3]);
      // 配列以外の複数引数の場合はJSON.stringifyを使う
      expect(key).toBe(JSON.stringify([1, 2, 3]));
    });

    test('大きな配列でも高速にキー生成', () => {
      const largeArray = Array(1000).fill(0).map((_, i) => i);
      const key = arrayKeyGenerator([largeArray]);

      // 長さ + 先頭3要素 + 末尾3要素
      expect(key).toContain('1000');
      expect(key).toContain('0,1,2');
      expect(key).toContain('997,998,999');
    });

    test('objectKeyGeneratorでオブジェクトをキー化', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { b: 2, a: 1 }; // 順序が違う
      const obj3 = { a: 1, b: 3 };

      const key1 = objectKeyGenerator([obj1]);
      const key2 = objectKeyGenerator([obj2]);
      const key3 = objectKeyGenerator([obj3]);

      // プロパティ順序に関係なく同じキー
      expect(key1).toBe(key2);
      // 値が異なれば異なるキー
      expect(key1).not.toBe(key3);
    });

    test('objectKeyGeneratorで引数が0個の場合は空文字列を返す', () => {
      const key = objectKeyGenerator([]);
      expect(key).toBe('');
    });

    test('objectKeyGeneratorで複数引数の場合はJSON.stringifyにフォールバック', () => {
      const key = objectKeyGenerator([{ a: 1 }, { b: 2 }]);
      expect(key).toBe(JSON.stringify([{ a: 1 }, { b: 2 }]));
    });

    test('objectKeyGeneratorで非オブジェクト引数の場合はJSON.stringifyにフォールバック', () => {
      const key1 = objectKeyGenerator([123]);
      expect(key1).toBe(JSON.stringify([123]));

      const key2 = objectKeyGenerator(['string']);
      expect(key2).toBe(JSON.stringify(['string']));

      const key3 = objectKeyGenerator([null]);
      expect(key3).toBe(JSON.stringify([null]));
    });
  });

  describe('memoizeWithClear', () => {
    test('clearCache()でキャッシュをクリア', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * 2;
      };

      const memoized = memoizeWithClear(fn);

      memoized(5);
      expect(callCount).toBe(1);

      memoized(5);
      expect(callCount).toBe(1); // キャッシュヒット

      // キャッシュクリア
      memoized.clearCache();

      memoized(5);
      expect(callCount).toBe(2); // 再計算
    });

    test('getCacheSize()でキャッシュサイズを取得', () => {
      const fn = (x) => x * 2;
      const memoized = memoizeWithClear(fn);

      expect(memoized.getCacheSize()).toBe(0);

      memoized(1);
      expect(memoized.getCacheSize()).toBe(1);

      memoized(2);
      expect(memoized.getCacheSize()).toBe(2);

      memoized(1); // 既存のキー
      expect(memoized.getCacheSize()).toBe(2);

      memoized.clearCache();
      expect(memoized.getCacheSize()).toBe(0);
    });

    test('maxSizeを超えると古いエントリが削除される', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * 2;
      };

      const memoized = memoizeWithClear(fn, { maxSize: 2 });

      // 3つの値をキャッシュに追加（maxSize=2なので最古が削除される）
      const result1 = memoized(1); // callCount: 1
      const result2 = memoized(2); // callCount: 2
      const result3 = memoized(3); // callCount: 3

      expect(result1).toBe(2);
      expect(result2).toBe(4);
      expect(result3).toBe(6);
      expect(callCount).toBe(3);
      expect(memoized.getCacheSize()).toBe(2); // maxSize制限

      // キャッシュサイズが2に制限されることを確認
      // 1は削除されているはず
      callCount = 0;
      memoized(1); // 再計算される
      expect(callCount).toBe(1);
    });

    test('memoizeWithClearのLRU動作: アクセスされたエントリが優先される', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * 2;
      };

      const memoized = memoizeWithClear(fn, { maxSize: 2 });

      memoized(1);
      memoized(2);
      expect(memoized.getCacheSize()).toBe(2);

      // 1を再度アクセス（LRUで最新になる）
      callCount = 0;
      memoized(1);
      expect(callCount).toBe(0); // キャッシュヒット

      // 3を追加すると、最も古い2が削除されるはず
      memoized(3);
      expect(memoized.getCacheSize()).toBe(2);

      // 1はまだキャッシュにある
      callCount = 0;
      memoized(1);
      expect(callCount).toBe(0); // キャッシュヒット

      // 2は削除されているので再計算
      memoized(2);
      expect(callCount).toBe(1);
    });
  });

  describe('エッジケース', () => {
    test('数値や文字列を正しくキャッシュ', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return x * x;
      };

      const memoized = memoize(fn);

      // 0
      expect(memoized(0)).toBe(0);
      expect(callCount).toBe(1);

      expect(memoized(0)).toBe(0);
      expect(callCount).toBe(1); // キャッシュヒット

      // 負の数
      expect(memoized(-5)).toBe(25);
      expect(callCount).toBe(2);

      expect(memoized(-5)).toBe(25);
      expect(callCount).toBe(2); // キャッシュヒット
    });

    test('引数なしの関数もメモ化可能', () => {
      let callCount = 0;
      const fn = () => {
        callCount++;
        return Math.random();
      };

      const memoized = memoize(fn);

      const result1 = memoized();
      expect(callCount).toBe(1);

      const result2 = memoized();
      expect(callCount).toBe(1);

      // 同じ結果が返る
      expect(result1).toBe(result2);
    });

    test('配列やオブジェクトを返す関数もメモ化', () => {
      let callCount = 0;
      const fn = (x) => {
        callCount++;
        return { value: x, squared: x * x };
      };

      const memoized = memoize(fn);

      const result1 = memoized(5);
      expect(callCount).toBe(1);
      expect(result1).toEqual({ value: 5, squared: 25 });

      const result2 = memoized(5);
      expect(callCount).toBe(1);

      // 同じ参照が返る
      expect(result1).toBe(result2);
    });
  });
});
