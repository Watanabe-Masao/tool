/**
 * 論理削除データ管理UI
 */

import { getDeletedHistory, hardDeleteHistory } from './storage.js';
import { qs } from './dom-utils.js';
import { showToast } from './toast.js';
import { escapeHTML, getModeIcon } from './history-item-renderer.js';
import { isSignedIn } from './firebase-auth.js';

/**
 * 論理削除データ管理モーダルを表示
 */
export async function showDeletedDataModal() {
  const modal = qs('#deletedDataModal');
  if (!modal) {
    console.error('論理削除データ管理モーダルが見つかりません');
    return;
  }

  try {
    // ログインチェック
    if (!isSignedIn()) {
      showToast('ログインしてください', 'warning');
      return;
    }

    // 背景のスクロールを無効化
    document.body.classList.add('modal-open');

    modal.showModal();

    // 論理削除データを取得して表示
    await renderDeletedDataList();
  } catch (error) {
    console.error('論理削除データ管理モーダルを開く際にエラーが発生しました:', error);
    showToast('[エラー]  論理削除データを読み込めませんでした', 'error');
  }
}

/**
 * 論理削除データ管理モーダルを閉じる
 */
export function closeDeletedDataModal() {
  const modal = qs('#deletedDataModal');
  if (modal) {
    modal.close();
    // 背景のスクロールを再び有効化
    document.body.classList.remove('modal-open');
  }
}

/**
 * 論理削除データの一覧を描画
 */
async function renderDeletedDataList() {
  const listContainer = qs('#deletedDataList');
  if (!listContainer) return;

  try {
    // 論理削除データを取得
    const deletedData = await getDeletedHistory();

    if (deletedData.length === 0) {
      listContainer.innerHTML = '<div class="empty-message">論理削除されたデータはありません</div>';
      return;
    }

    // データをHTML化
    const itemsHTML = deletedData.map(item => createDeletedDataItemHTML(item)).join('');
    listContainer.innerHTML = `<ul class="deleted-data-items">${itemsHTML}</ul>`;

    // 物理削除ボタンのイベントリスナーを設定
    const hardDeleteButtons = listContainer.querySelectorAll('.btn-hard-delete');
    hardDeleteButtons.forEach(button => {
      button.addEventListener('click', async (e) => {
        const id = parseInt(e.target.dataset.id, 10);
        await handleHardDelete(id);
      });
    });
  } catch (error) {
    console.error('論理削除データの描画エラー:', error);
    listContainer.innerHTML = '<div class="error-message">[エラー]  データの読み込みに失敗しました</div>';
  }
}

/**
 * 論理削除データアイテムのHTMLを生成
 */
function createDeletedDataItemHTML(item) {
  const modeIcon = getModeIcon(item.mode);
  const productName = escapeHTML(item.name || '（商品名なし）');
  const deletedAt = item.deletedAt ? new Date(item.deletedAt).toLocaleString('ja-JP') : '不明';
  const timestamp = item.timestamp ? new Date(item.timestamp).toLocaleString('ja-JP') : '不明';

  // カテゴリーがあれば表示
  const categoryHTML = item.category ? `<span class="item-category">${escapeHTML(item.category)}</span>` : '';

  return `
    <li class="deleted-data-item">
      <div class="item-info">
        <div class="item-header">
          <span class="item-mode">${modeIcon}</span>
          <span class="item-name">${productName}</span>
          ${categoryHTML}
        </div>
        <div class="item-details">
          <span class="item-timestamp">作成: ${timestamp}</span>
          <span class="item-deleted-at">削除: ${deletedAt}</span>
        </div>
      </div>
      <div class="item-actions">
        <button type="button" class="btn btn-danger btn-hard-delete" data-id="${item.id}">
          [削除]  完全削除
        </button>
      </div>
    </li>
  `;
}

/**
 * 物理削除（完全削除）を実行
 */
async function handleHardDelete(id) {
  if (!confirm('本当に完全削除しますか？\nこの操作は取り消せません。')) {
    return;
  }

  try {
    await hardDeleteHistory(id);
    showToast('[成功]  完全削除しました', 'success');

    // リストを再描画
    await renderDeletedDataList();
  } catch (error) {
    console.error('完全削除エラー:', error);
    showToast('[エラー]  完全削除に失敗しました', 'error');
  }
}

/**
 * 論理削除データ管理UIを初期化
 */
export function initializeDeletedDataUI() {
  const openButton = qs('#deleted-data-button');
  const closeButton = qs('#closeDeletedDataModal');

  if (openButton) {
    openButton.addEventListener('click', showDeletedDataModal);
  }

  if (closeButton) {
    closeButton.addEventListener('click', closeDeletedDataModal);
  }

  // モーダルの背景クリックで閉じる
  const modal = qs('#deletedDataModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      // モーダルの背景（::backdrop）をクリックした場合
      if (e.target === modal) {
        closeDeletedDataModal();
      }
    });
  }
}
