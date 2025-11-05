/**
 * トースト通知システム
 * alert()に代わるユーザーフレンドリーな通知機能
 */

/**
 * トースト通知を表示
 * @param {string} message - 通知メッセージ
 * @param {string} type - 通知タイプ ('info'|'success'|'warning'|'error')
 * @param {number} duration - 表示時間（ミリ秒）デフォルト3000ms
 */
export function showToast(message, type = 'info', duration = 3000) {
  // 既存のトースト要素があればそれを取得、なければ作成
  let toast = document.getElementById('app-toast');

  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.className = 'toast';
  }

  // モーダルが開いている場合は、モーダルの内側に配置
  // これにより、モーダルのbackdropフィルターの上に確実に表示される
  const openModal = document.querySelector('.modal.is-open, .modal.is-active');
  const toastParent = openModal || document.body;

  // トーストが別の親要素にある場合は移動
  if (toast.parentElement !== toastParent) {
    toastParent.appendChild(toast);
  }

  // トーストのタイプに応じたクラスを設定
  toast.className = `toast toast-${type} toast-show`;

  // メッセージを設定（改行を<br>に変換）
  // null/undefinedの場合は空文字列に変換
  const safeMessage = (message != null) ? String(message) : '';
  const formattedMessage = safeMessage.replace(/\n/g, '<br>');
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-icon">${getToastIcon(type)}</span>
      <span class="toast-message">${formattedMessage}</span>
    </div>
  `;

  // 既存のタイマーをクリア
  if (toast.hideTimer) {
    clearTimeout(toast.hideTimer);
  }

  // 指定時間後に非表示
  toast.hideTimer = setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');

    // アニメーション完了後に完全に非表示
    setTimeout(() => {
      toast.classList.remove('toast-hide');
    }, 300);
  }, duration);
}

/**
 * トーストタイプに応じたアイコンを取得
 * @param {string} type - トーストタイプ
 * @returns {string} アイコンHTML文字列
 */
function getToastIcon(type) {
  const icons = {
    info: '<i class="fa-solid fa-circle-info"></i>',
    success: '<i class="fa-regular fa-circle-check"></i>',
    warning: '<i class="fa-solid fa-triangle-exclamation"></i>',
    error: '<i class="fa-solid fa-circle-xmark"></i>'
  };
  return icons[type] || icons.info;
}

/**
 * 情報通知を表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（省略可）
 */
export function showInfo(message, duration) {
  showToast(message, 'info', duration);
}

/**
 * 成功通知を表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（省略可）
 */
export function showSuccess(message, duration) {
  showToast(message, 'success', duration);
}

/**
 * 警告通知を表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（省略可、デフォルト4000ms）
 */
export function showWarning(message, duration = 4000) {
  // 警告メッセージも重要なので、デフォルトで長めに表示
  showToast(message, 'warning', duration);
}

/**
 * エラー通知を表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（省略可、デフォルト5000ms）
 */
export function showError(message, duration = 5000) {
  // エラーメッセージは重要なので、デフォルトで長めに表示
  showToast(message, 'error', duration);
}
