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
