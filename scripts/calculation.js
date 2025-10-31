// 純粋関数群（副作用なし）
export const toFixed = (n, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : null;

export function calcYield(beforeWeightG, afterWeightG) {
  if (!isPositive(beforeWeightG) || !isPositive(afterWeightG)) return null;
  return (afterWeightG / beforeWeightG) * 100;
}

export function per100FromPerUnit(valuePerUnit, unitWeightG) {
  // 単価(円/個)やコスト(円/個)を100gあたりへ
  if (!isPositive(unitWeightG)) return null;
  return (valuePerUnit / unitWeightG) * 100;
}

export function per100FromBox(totalValue, boxWeightKg) {
  // 箱全体（金額）と箱重量(kg)から100gあたり金額
  if (!isPositive(boxWeightKg)) return null;
  const grams = boxWeightKg * 1000;
  return (totalValue / grams) * 100;
}

export function afterCostPer100(beforeCostPer100, yieldRatePct) {
  if (!isPositive(beforeCostPer100) || !isPositive(yieldRatePct)) return null;
  return beforeCostPer100 / (yieldRatePct / 100);
}

export function markup(costPer100, pricePer100) {
  if (!isPositive(pricePer100) || !isNonNegative(costPer100)) return null;
  return ((pricePer100 - costPer100) / pricePer100) * 100;
}

export function priceFromMarkup(costPer100, markupPct) {
  // 値入率から売価を逆算: price = cost / (1 - markup/100)
  if (!isPositive(costPer100) || !isNonNegative(markupPct) || markupPct >= 100) return null;
  return costPer100 / (1 - (markupPct / 100));
}

export function grossFromMarkup(markupPct, discountPct = 0) {
  const m = markupPct / 100;
  const d = discountPct / 100;
  if (!isNonNegative(m) || !isNonNegative(d) || d >= 1) return 0;
  return ((m - d) / (1 - d)) * 100;
}

export function finishedPriceFromAp(apPer100, finishedWeightG) {
  if (!isPositive(apPer100) || !isPositive(finishedWeightG)) return null;
  return apPer100 * (finishedWeightG / 100);
}

export function isPositive(n) { return Number.isFinite(n) && n > 0; }
export function isNonNegative(n) { return Number.isFinite(n) && n >= 0; }
