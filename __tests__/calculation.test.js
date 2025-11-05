/**
 * 計算ロジックのテスト
 *
 * calculation.js の純粋関数をテストします
 */

import { describe, test, expect } from '@jest/globals';
import {
  toFixed,
  calcYield,
  per100FromPerUnit,
  per100FromBox,
  afterCostPer100,
  markup,
  priceFromMarkup,
  grossFromMarkup,
  finishedPriceFromAp,
  isPositive,
  isNonNegative
} from '../scripts/calculation.js';

describe('toFixed', () => {
  test('数値を指定桁数で丸める', () => {
    expect(toFixed(3.14159, 2)).toBe(3.14);
    expect(toFixed(3.14159, 3)).toBe(3.142);
    expect(toFixed(3.14159, 0)).toBe(3);
  });

  test('デフォルトは2桁', () => {
    expect(toFixed(3.14159)).toBe(3.14);
  });

  test('無限大や不正な値はnullを返す', () => {
    expect(toFixed(Infinity)).toBeNull();
    expect(toFixed(NaN)).toBeNull();
    expect(toFixed(undefined)).toBeNull();
  });
});

describe('calcYield', () => {
  test('歩留まり率を正しく計算', () => {
    expect(calcYield(100, 85)).toBe(85);
    expect(calcYield(200, 150)).toBe(75);
    expect(calcYield(50, 40)).toBe(80);
  });

  test('0以下の値はnullを返す', () => {
    expect(calcYield(0, 85)).toBeNull();
    expect(calcYield(100, 0)).toBeNull();
    expect(calcYield(-10, 50)).toBeNull();
  });

  test('不正な値はnullを返す', () => {
    expect(calcYield(NaN, 85)).toBeNull();
    expect(calcYield(100, undefined)).toBeNull();
  });
});

describe('per100FromPerUnit', () => {
  test('単価から100gあたりの価格を計算', () => {
    // 150円/個、個あたり50g → 100gあたり300円
    expect(per100FromPerUnit(150, 50)).toBe(300);

    // 200円/個、個あたり100g → 100gあたり200円
    expect(per100FromPerUnit(200, 100)).toBe(200);
  });

  test('0以下の重量はnullを返す', () => {
    expect(per100FromPerUnit(150, 0)).toBeNull();
    expect(per100FromPerUnit(150, -10)).toBeNull();
  });
});

describe('per100FromBox', () => {
  test('箱全体の金額と重量から100gあたりの価格を計算', () => {
    // 10000円、5kg → 100gあたり200円
    expect(per100FromBox(10000, 5)).toBe(200);

    // 5000円、2kg → 100gあたり250円
    expect(per100FromBox(5000, 2)).toBe(250);
  });

  test('0以下の重量はnullを返す', () => {
    expect(per100FromBox(10000, 0)).toBeNull();
    expect(per100FromBox(10000, -1)).toBeNull();
  });
});

describe('afterCostPer100', () => {
  test('歩留まり率から加工後の100gあたりコストを計算', () => {
    // 100円、歩留まり80% → 125円
    expect(afterCostPer100(100, 80)).toBe(125);

    // 200円、歩留まり50% → 400円
    expect(afterCostPer100(200, 50)).toBe(400);
  });

  test('0以下の値はnullを返す', () => {
    expect(afterCostPer100(0, 80)).toBeNull();
    expect(afterCostPer100(100, 0)).toBeNull();
    expect(afterCostPer100(-10, 80)).toBeNull();
  });
});

describe('markup', () => {
  test('値入率を正しく計算', () => {
    // コスト50円、売価100円 → 値入率50%
    expect(markup(50, 100)).toBe(50);

    // コスト70円、売価100円 → 値入率30%
    expect(markup(70, 100)).toBe(30);
  });

  test('コストが0でも計算可能', () => {
    expect(markup(0, 100)).toBe(100);
  });

  test('売価が0以下はnullを返す', () => {
    expect(markup(50, 0)).toBeNull();
    expect(markup(50, -10)).toBeNull();
  });

  test('コストが負はnullを返す', () => {
    expect(markup(-10, 100)).toBeNull();
  });
});

describe('priceFromMarkup', () => {
  test('値入率から売価を逆算', () => {
    // コスト50円、値入率50% → 売価100円
    expect(priceFromMarkup(50, 50)).toBe(100);

    // コスト70円、値入率30% → 売価100円
    expect(priceFromMarkup(70, 30)).toBe(100);
  });

  test('値入率0%はコストと同額', () => {
    expect(priceFromMarkup(100, 0)).toBe(100);
  });

  test('値入率100%以上はnullを返す', () => {
    expect(priceFromMarkup(100, 100)).toBeNull();
    expect(priceFromMarkup(100, 110)).toBeNull();
  });

  test('不正な値はnullを返す', () => {
    expect(priceFromMarkup(0, 50)).toBeNull();
    expect(priceFromMarkup(-10, 50)).toBeNull();
    expect(priceFromMarkup(100, -5)).toBeNull();
  });
});

describe('grossFromMarkup', () => {
  test('値入率と値引率から粗利率を計算', () => {
    // 値入率50%、値引率0% → 粗利率50%
    expect(grossFromMarkup(50, 0)).toBe(50);

    // 値入率50%、値引率10% → 粗利率44.44...%
    const result = grossFromMarkup(50, 10);
    expect(result).toBeCloseTo(44.44, 1);
  });

  test('値引率省略時はデフォルト0%で計算', () => {
    // 値入率50%、値引率省略（デフォルト0%） → 粗利率50%
    expect(grossFromMarkup(50)).toBe(50);

    // 値入率30%、値引率省略（デフォルト0%） → 粗利率30%
    expect(grossFromMarkup(30)).toBe(30);
  });

  test('値引率が100%以上は0を返す', () => {
    expect(grossFromMarkup(50, 100)).toBe(0);
    expect(grossFromMarkup(50, 110)).toBe(0);
  });

  test('負の値は0を返す', () => {
    expect(grossFromMarkup(-10, 0)).toBe(0);
    expect(grossFromMarkup(50, -10)).toBe(0);
  });
});

describe('finishedPriceFromAp', () => {
  test('100gあたり価格と仕上がり重量から価格を計算', () => {
    // 100gあたり200円、仕上がり150g → 300円
    expect(finishedPriceFromAp(200, 150)).toBe(300);

    // 100gあたり300円、仕上がり50g → 150円
    expect(finishedPriceFromAp(300, 50)).toBe(150);
  });

  test('0以下の値はnullを返す', () => {
    expect(finishedPriceFromAp(0, 150)).toBeNull();
    expect(finishedPriceFromAp(200, 0)).toBeNull();
    expect(finishedPriceFromAp(-10, 150)).toBeNull();
  });
});

describe('isPositive', () => {
  test('正の数はtrueを返す', () => {
    expect(isPositive(1)).toBe(true);
    expect(isPositive(100)).toBe(true);
    expect(isPositive(0.1)).toBe(true);
  });

  test('0や負の数はfalseを返す', () => {
    expect(isPositive(0)).toBe(false);
    expect(isPositive(-1)).toBe(false);
    expect(isPositive(-100)).toBe(false);
  });

  test('不正な値はfalseを返す', () => {
    expect(isPositive(NaN)).toBe(false);
    expect(isPositive(Infinity)).toBe(false);
    expect(isPositive(undefined)).toBe(false);
    expect(isPositive(null)).toBe(false);
  });
});

describe('isNonNegative', () => {
  test('0以上の数はtrueを返す', () => {
    expect(isNonNegative(0)).toBe(true);
    expect(isNonNegative(1)).toBe(true);
    expect(isNonNegative(100)).toBe(true);
  });

  test('負の数はfalseを返す', () => {
    expect(isNonNegative(-1)).toBe(false);
    expect(isNonNegative(-100)).toBe(false);
  });

  test('不正な値はfalseを返す', () => {
    expect(isNonNegative(NaN)).toBe(false);
    expect(isNonNegative(Infinity)).toBe(false);
    expect(isNonNegative(undefined)).toBe(false);
    expect(isNonNegative(null)).toBe(false);
  });
});
