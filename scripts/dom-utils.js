// DOMユーティリティ（表示・取得・クラス操作）
export const qs  = (sel, root=document) => root.querySelector(sel);
export const qsa = (sel, root=document) => Array.from(root.querySelectorAll(sel));

export function num(id) {
  const el = qs(`#${id}`);
  if (!el) return null;
  const v = parseFloat(el.value);
  return Number.isFinite(v) ? v : null;
}

export const setText = (id, text) => { const el = qs(`#${id}`); if (el) el.textContent = text; };

// 数値フォーマット関数
export const toFixed = (n, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : null;
export const yen = (n) => (Number.isFinite(n) ? `¥${n.toFixed(2)}` : '-');
export const pct = (n) => (Number.isFinite(n) ? `${n.toFixed(2)}%` : '-');

export const show = (id) => qs(`#${id}`)?.classList.remove('is-hidden');
export const hide = (id) => qs(`#${id}`)?.classList.add('is-hidden');

export function bind(keys, handler) {
  keys.forEach((id) => qs(`#${id}`)?.addEventListener('input', handler));
}

export function toggleActive(btnActive, btnInactive) {
  btnActive.classList.add('is-active');
  btnInactive.classList.remove('is-active');
}

/**
 * クリック/タップイベントを確実に処理するヘルパー関数
 * CSSのtouch-action: manipulationと組み合わせて使用
 * @param {HTMLElement} element - イベントを追加する要素
 * @param {Function} handler - クリック/タップ時に実行する関数
 */
export function addTapListener(element, handler) {
  if (!element) return;

  // シンプルにclickイベントのみ使用
  // CSSでtouch-action: manipulationが設定されているため、
  // モバイルでの300msディレイは発生しない
  element.addEventListener('click', handler);
}
