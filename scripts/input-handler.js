/**
 * 入力フィールド管理とバリデーション
 */

import { qs, qsa, bind } from './dom-utils.js';
import {
  RADIO_NAMES,
  FIXED_FIELDS,
  WEIGHT_FIELDS,
  UI_ELEMENTS,
  DISCOUNT
} from './constants.js';
import { debounce } from './debounce.js';

/**
 * 定額モードの入力フィールドリストを取得
 */
export function getFixedFieldIds() {
  const method = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`)?.value;
  const fields = method === 'direct' ? FIXED_FIELDS.DIRECT : FIXED_FIELDS.CALCULATE;
  return Object.values(fields);
}

/**
 * 計量モードの入力フィールドリストを取得
 */
export function getWeightFieldIds() {
  const method = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`)?.value;
  const fields = method === 'direct' ? WEIGHT_FIELDS.DIRECT : WEIGHT_FIELDS.CALCULATE;
  return Object.values(fields);
}

/**
 * 選択中の歩留まり計算方法を取得（定額モード）
 */
export function getFixedYieldMethod() {
  return qs(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`)?.value;
}

/**
 * 選択中の歩留まり計算方法を取得（計量モード）
 */
export function getWeightYieldMethod() {
  return qs(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`)?.value;
}

/**
 * 定額モードのラジオ切替ハンドラーを設定
 */
export function setupFixedRadioHandlers(callback) {
  qsa(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]`).forEach(r => {
    r.addEventListener('change', () => {
      const direct = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`)?.value === 'direct';
      qs(`#${UI_ELEMENTS.FIXED_CALCULATE_INPUTS}`).classList.toggle('is-hidden', direct);
      qs(`#${UI_ELEMENTS.FIXED_DIRECT_INPUTS}`).classList.toggle('is-hidden', !direct);
      callback();
    });
  });
}

/**
 * 計量モードのラジオ切替ハンドラーを設定
 */
export function setupWeightRadioHandlers(callback) {
  qsa(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]`).forEach(r => {
    r.addEventListener('change', () => {
      const direct = qs(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`)?.value === 'direct';
      qs(`#${UI_ELEMENTS.WEIGHT_CALCULATE_INPUTS}`).classList.toggle('is-hidden', direct);
      qs(`#${UI_ELEMENTS.WEIGHT_DIRECT_INPUTS}`).classList.toggle('is-hidden', !direct);
      callback();
    });
  });
}

/**
 * 定額モードの入力フィールドにイベントリスナーをバインド
 */
export function bindFixedInputs(callback) {
  // 計算モード
  bind(Object.values(FIXED_FIELDS.CALCULATE), callback);
  // 直接入力モード
  bind(
    [
      FIXED_FIELDS.DIRECT.UNIT_COST,
      FIXED_FIELDS.DIRECT.UNIT_PRICE,
      FIXED_FIELDS.DIRECT.BEFORE_WEIGHT,
      FIXED_FIELDS.DIRECT.YIELD_RATE,
      FIXED_FIELDS.DIRECT.AFTER_PRICE_100
    ],
    callback
  );
}

/**
 * 計量モードの入力フィールドにイベントリスナーをバインド
 */
export function bindWeightInputs(callback) {
  // 計算モード
  bind(Object.values(WEIGHT_FIELDS.CALCULATE), callback);
  // 直接入力モード
  bind(
    [
      WEIGHT_FIELDS.DIRECT.BOX_COST,
      WEIGHT_FIELDS.DIRECT.BOX_PRICE,
      WEIGHT_FIELDS.DIRECT.BOX_WEIGHT,
      WEIGHT_FIELDS.DIRECT.YIELD_RATE,
      WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100
    ],
    callback
  );
}

/**
 * 値引きスライダーの設定
 */
export function setupDiscountSlider(onChangeCallback) {
  const slider = qs(`#${UI_ELEMENTS.DISC_SLIDER}`);
  const input = qs(`#${UI_ELEMENTS.DISC_INPUT}`);

  // コールバックをデバウンスしてパフォーマンスを向上
  const debouncedCallback = debounce(onChangeCallback, 300);

  slider?.addEventListener('input', (e) => {
    // 値の同期は即座に実行（UI応答性のため）
    input.value = e.target.value;
    // 計算などの重い処理はデバウンス
    debouncedCallback();
  });

  input?.addEventListener('input', (e) => {
    let v = parseFloat(e.target.value) || 0;
    v = Math.max(DISCOUNT.MIN, Math.min(DISCOUNT.MAX, v));
    // 値の同期は即座に実行
    e.target.value = v;
    slider.value = Math.min(v, DISCOUNT.SLIDER_MAX);
    // 計算などの重い処理はデバウンス
    debouncedCallback();
  });
}

/**
 * すべての入力フィールドをクリア
 */
export function clearAllInputs() {
  qsa('input[type="number"]').forEach(i => i.value = '');
}
