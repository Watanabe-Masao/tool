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

/**
 * タップイベントを確実に処理するヘルパー関数
 * タップとスワイプを区別して、タップのみを処理
 * @param {HTMLElement} element - イベントを追加する要素
 * @param {Function} handler - タップ時に実行する関数
 */
export function addTapListener(element, handler) {
  if (!element) return;

  let startX = 0, startY = 0, moved = false;
  const MOVE_THRESHOLD = 10; // 10px以上動いたらスワイプとみなす

  element.addEventListener('touchstart', (e) => {
    moved = false;
    if (e.touches && e.touches.length > 0) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }
  }, { passive: true });

  element.addEventListener('touchmove', (e) => {
    if (moved || !e.touches || e.touches.length === 0) return;
    const deltaX = Math.abs(e.touches[0].clientX - startX);
    const deltaY = Math.abs(e.touches[0].clientY - startY);
    if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
      moved = true;
    }
  }, { passive: true });

  element.addEventListener('touchend', (e) => {
    if (!moved) {
      e.preventDefault();
      handler(e);
    }
  }, { passive: false });

  // PC環境用のフォールバック
  element.addEventListener('click', handler);
}
