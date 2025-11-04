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
    document.body.appendChild(toast);
  }

  // トーストのタイプに応じたクラスを設定
  toast.className = `toast toast-${type} toast-show`;

  // メッセージを設定（改行を<br>に変換）
  const formattedMessage = message.replace(/\n/g, '<br>');
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
 * @returns {string} アイコン文字列
 */
function getToastIcon(type) {
  const icons = {
    info: 'ℹ️',
    success: '[成功] ',
    warning: '[警告] ️',
    error: '[エラー] '
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
 * @param {number} duration - 表示時間（省略可）
 */
export function showWarning(message, duration) {
  showToast(message, 'warning', duration);
}

/**
 * エラー通知を表示
 * @param {string} message - メッセージ
 * @param {number} duration - 表示時間（省略可）
 */
export function showError(message, duration) {
  showToast(message, 'error', duration);
}
