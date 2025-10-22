/**
 * 表示処理
 */

import { setText, yen, pct, show, hide, qs } from './dom-utils.js';
import { toFixed } from './calculation.js';
import { grossFromMarkup } from './calculation.js';
import { UI_ELEMENTS, GRAMS_PER_100G } from './constants.js';

/**
 * 警告メッセージを表示
 */
export function showWarning() {
  show(UI_ELEMENTS.WARNING);
  hide(UI_ELEMENTS.RESULTS);
}

/**
 * 計算結果を表示
 */
export function displayResults({ yr, bc, bp, ac, ap, bm, am, finishedPrice, priceDiff, finishedLabel }, isDirectMode = false) {
  hide(UI_ELEMENTS.WARNING);

  // 基本結果の表示
  setText(UI_ELEMENTS.YIELD_RATE, pct(toFixed(yr)));
  setText(UI_ELEMENTS.BEFORE_COST, yen(toFixed(bc)));
  setText(UI_ELEMENTS.BEFORE_PRICE, yen(toFixed(bp)));
  setText(UI_ELEMENTS.AFTER_COST, yen(toFixed(ac)));
  setText(UI_ELEMENTS.AFTER_PRICE, yen(toFixed(ap)));
  setText(UI_ELEMENTS.BEFORE_MARKUP, pct(toFixed(bm)));
  setText(UI_ELEMENTS.AFTER_MARKUP, pct(toFixed(am)));

  // 直接入力モードの場合は歩留まり率と加工前のセクションを非表示
  if (isDirectMode) {
    hide(UI_ELEMENTS.YIELD_RATE_SECTION);
    hide(UI_ELEMENTS.BEFORE_SECTION);
  } else {
    show(UI_ELEMENTS.YIELD_RATE_SECTION);
    show(UI_ELEMENTS.BEFORE_SECTION);
  }

  // 粗利率の計算と表示
  const beforeGross = grossFromMarkup(bm, 0);
  const afterGross = grossFromMarkup(am, 0);
  setText(UI_ELEMENTS.BEFORE_GROSS, pct(toFixed(beforeGross)));
  setText(UI_ELEMENTS.AFTER_GROSS, pct(toFixed(afterGross)));

  // 仕上がり価格と差額の表示
  setText(UI_ELEMENTS.FINISHED_LABEL, finishedLabel);
  setText(UI_ELEMENTS.FINISHED_PRICE, yen(toFixed(finishedPrice)));
  setText(UI_ELEMENTS.PRICE_DIFF, yen(toFixed(priceDiff)));
  show(UI_ELEMENTS.FINISHED_ITEM);
  show(UI_ELEMENTS.DIFF_ITEM);

  // 値引きスライダーとインプットを初期化
  resetDiscountInputs();

  show(UI_ELEMENTS.RESULTS);

  return { ac, ap, bm, am, bp, bc };
}

/**
 * 値引きスライダーとインプットをリセット
 */
function resetDiscountInputs() {
  const slider = qs(`#${UI_ELEMENTS.DISC_SLIDER}`);
  const input = qs(`#${UI_ELEMENTS.DISC_INPUT}`);
  if (slider) slider.value = 0;
  if (input) input.value = 0;
}

/**
 * 商品化シミュレーション結果を表示
 */
export function displayProductSimulation({ cost, price, markup }) {
  setText(UI_ELEMENTS.EXP_COST, yen(toFixed(cost)));
  setText(UI_ELEMENTS.EXP_PRICE, yen(toFixed(price)));
  setText(UI_ELEMENTS.EXP_MARKUP, pct(toFixed(markup)));
  show(UI_ELEMENTS.EXP_RESULTS);
}

/**
 * 商品化シミュレーション結果を非表示
 */
export function hideProductSimulation() {
  hide(UI_ELEMENTS.EXP_RESULTS);
  hide(UI_ELEMENTS.DISC_RESULTS);
}

/**
 * 値引き後粗利率を表示
 */
export function displayDiscountGross(discountRate, markup) {
  const discGross = grossFromMarkup(markup, discountRate);
  setText(UI_ELEMENTS.DISC_GROSS, pct(toFixed(discGross)));
  show(UI_ELEMENTS.DISC_RESULTS);
}

/**
 * 値引き後粗利率を非表示
 */
export function hideDiscountResults() {
  hide(UI_ELEMENTS.DISC_RESULTS);
}

/**
 * 100gあたり売価を更新（計量モード）
 */
export function updatePer100gDisplay(elementId, value) {
  const el = qs(`#${elementId}`);
  if (el) {
    el.textContent = Number.isFinite(value) ? yen(value) : '-';
  }
}

/**
 * すべての表示をクリア
 */
export function clearAllDisplays() {
  setText(UI_ELEMENTS.PER_100G_DISPLAY, '-');
  setText(UI_ELEMENTS.PER_100G_DISPLAY_DIRECT, '-');
  hide(UI_ELEMENTS.RESULTS);
  hide(UI_ELEMENTS.WARNING);
  hide(UI_ELEMENTS.EXP_RESULTS);
  hide(UI_ELEMENTS.DISC_RESULTS);
}
