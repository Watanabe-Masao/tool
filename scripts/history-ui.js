/**
 * 履歴機能のUI管理
 */

import { getHistory, searchHistory, deleteHistory, updateCalculationName, loadCalculation, saveCalculation, exportData, importData, clearAllHistory, restoreInputFields } from './storage.js';
import { qs } from './dom-utils.js';
import { appState } from './state.js';

/**
 * 履歴モーダルを表示
 */
export async function showHistoryModal() {
  const modal = qs('#historyModal');
  if (!modal) return;

  modal.showModal();
  await renderHistoryList();
}

/**
 * 履歴モーダルを閉じる
 */
export function closeHistoryModal() {
  const modal = qs('#historyModal');
  if (modal) {
    modal.close();
  }
}

/**
 * 履歴一覧を描画
 * @param {Array} items - 履歴データ配列（オプション）
 */
export async function renderHistoryList(items = null) {
  const listContainer = qs('#historyList');
  if (!listContainer) return;

  // データを取得
  const history = items || await getHistory();

  // 空の場合
  if (history.length === 0) {
    listContainer.innerHTML = '<li class="history-empty">保存済みのデータがありません</li>';
    return;
  }

  // リストを生成
  listContainer.innerHTML = history.map(item => createHistoryItemHTML(item)).join('');

  // イベントリスナーをバインド
  bindHistoryItemEvents();
}

/**
 * 履歴アイテムのHTMLを生成
 * @param {Object} item - 履歴データ
 * @returns {string} HTML文字列
 */
function createHistoryItemHTML(item) {
  const date = new Date(item.timestamp);
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const modeLabel = item.mode === 'fixed' ? '定額売価' : '計量売価';
  const categoryIcon = getCategoryIcon(item.category);

  // 計算結果の主要データを表示
  const markup = item.result?.afterMarkup || item.result?.markup || '-';
  const gross = item.result?.afterGross || '-';

  return `
    <li class="history-item" data-id="${item.id}">
      <div class="history-item-header">
        <div class="history-item-title">
          <span class="history-item-icon">${categoryIcon}</span>
          <span class="history-item-name">${escapeHTML(item.name || '無題')}</span>
        </div>
        <div class="history-item-mode">${modeLabel}</div>
      </div>
      <div class="history-item-stats">
        <span class="history-stat">値入率: <strong>${typeof markup === 'number' ? markup.toFixed(1) : markup}%</strong></span>
        <span class="history-stat">粗利率: <strong>${typeof gross === 'number' ? gross.toFixed(1) : gross}%</strong></span>
      </div>
      <div class="history-item-date">${dateStr}</div>
      <div class="history-item-actions">
        <button class="btn-small btn-load" data-id="${item.id}">📂 読込</button>
        <button class="btn-small btn-edit" data-id="${item.id}">✏️ 編集</button>
        <button class="btn-small btn-delete" data-id="${item.id}">🗑️ 削除</button>
      </div>
    </li>
  `;
}

/**
 * カテゴリに応じたアイコンを返す
 * @param {string} category
 * @returns {string}
 */
function getCategoryIcon(category) {
  const icons = {
    'fish': '🐟',
    'meat': '🥩',
    'vegetable': '🥬',
    'other': '📦'
  };
  return icons[category] || '📦';
}

/**
 * HTMLエスケープ
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 履歴アイテムのイベントをバインド
 */
function bindHistoryItemEvents() {
  // 読込ボタン
  document.querySelectorAll('.btn-load').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(e.target.dataset.id);
      await handleLoadCalculation(id);
    });
  });

  // 編集ボタン
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = parseInt(e.target.dataset.id);
      handleEditCalculation(id);
    });
  });

  // 削除ボタン
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(e.target.dataset.id);
      await handleDeleteCalculation(id);
    });
  });
}

/**
 * 計算データを読み込んで入力フィールドに復元
 * @param {number} id
 */
async function handleLoadCalculation(id) {
  try {
    const data = await loadCalculation(id);

    // モードを切り替え
    // TODO: appStateのsetModeメソッドを呼び出し、UIを切り替え

    // 入力フィールドに値を設定
    restoreInputFields(data.mode, data.input);

    // モーダルを閉じる
    closeHistoryModal();

    // 成功メッセージ
    showToast('✅ データを読み込みました');

    // 計算を実行
    // TODO: main.jsの計算関数を呼び出し
  } catch (error) {
    showToast('❌ データの読み込みに失敗しました', 'error');
  }
}

/**
 * 商品名・カテゴリを編集
 * @param {number} id
 */
async function handleEditCalculation(id) {
  try {
    const data = await loadCalculation(id);
    const newName = prompt('商品名を入力してください', data.name);

    if (newName === null) return; // キャンセル
    if (newName.trim() === '') {
      showToast('❌ 商品名は必須です', 'error');
      return;
    }

    await updateCalculationName(id, newName.trim());
    await renderHistoryList();
    showToast('✅ 更新しました');
  } catch (error) {
    showToast('❌ 更新に失敗しました', 'error');
  }
}

/**
 * 計算データを削除
 * @param {number} id
 */
async function handleDeleteCalculation(id) {
  if (!confirm('本当に削除しますか？')) return;

  try {
    await deleteHistory(id);
    await renderHistoryList();
    showToast('✅ 削除しました');
  } catch (error) {
    showToast('❌ 削除に失敗しました', 'error');
  }
}

/**
 * 保存ダイアログを表示
 */
export function showSaveDialog() {
  const dialog = qs('#saveDialog');
  if (!dialog) return;

  // 商品名入力フィールドをクリア
  const nameInput = qs('#saveName');
  if (nameInput) {
    nameInput.value = '';
  }

  dialog.showModal();
}

/**
 * 保存ダイアログを閉じる
 */
export function closeSaveDialog() {
  const dialog = qs('#saveDialog');
  if (dialog) {
    dialog.close();
  }
}

/**
 * 現在の計算を保存
 */
export async function handleSaveCalculation() {
  const nameInput = qs('#saveName');
  const categorySelect = qs('#saveCategory');

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (name === '') {
    showToast('❌ 商品名を入力してください', 'error');
    return;
  }

  const category = categorySelect ? categorySelect.value : null;

  // TODO: 現在の入力値と計算結果を取得
  const mode = appState.getMode();
  const inputData = {}; // TODO: 入力フィールドから値を収集
  const resultData = appState.getSnapshot(); // 計算結果

  try {
    await saveCalculation(name, mode, inputData, resultData, category);
    closeSaveDialog();
    showToast('✅ 保存しました');
  } catch (error) {
    showToast('❌ 保存に失敗しました', 'error');
  }
}

/**
 * 検索機能
 */
export async function handleSearch() {
  const searchInput = qs('#historySearch');
  if (!searchInput) return;

  const query = searchInput.value.trim();

  if (query === '') {
    await renderHistoryList();
  } else {
    const results = await searchHistory(query);
    await renderHistoryList(results);
  }
}

/**
 * データエクスポート
 */
export async function handleExport() {
  try {
    await exportData();
    showToast('✅ エクスポートしました');
  } catch (error) {
    showToast('❌ エクスポートに失敗しました', 'error');
  }
}

/**
 * データインポート
 */
export async function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';

  input.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const count = await importData(file);
      await renderHistoryList();
      showToast(`✅ ${count}件のデータをインポートしました`);
    } catch (error) {
      showToast('❌ インポートに失敗しました', 'error');
    }
  };

  input.click();
}

/**
 * すべての履歴をクリア
 */
export async function handleClearAll() {
  if (!confirm('すべての履歴を削除しますか？この操作は元に戻せません。')) return;

  try {
    await clearAllHistory();
    await renderHistoryList();
    showToast('✅ すべての履歴を削除しました');
  } catch (error) {
    showToast('❌ 削除に失敗しました', 'error');
  }
}

/**
 * トースト通知を表示
 * @param {string} message
 * @param {string} type - 'success' | 'error'
 */
function showToast(message, type = 'success') {
  // トースト要素が存在しない場合は作成
  let toast = qs('#toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = `toast toast--${type} toast--show`;

  setTimeout(() => {
    toast.classList.remove('toast--show');
  }, 3000);
}

/**
 * 履歴機能の初期化
 */
export function initHistoryUI() {
  // 履歴ボタン
  const historyBtn = qs('#historyBtn');
  if (historyBtn) {
    historyBtn.addEventListener('click', showHistoryModal);
  }

  // 履歴モーダルを閉じる
  const closeHistoryBtn = qs('#closeHistoryModal');
  if (closeHistoryBtn) {
    closeHistoryBtn.addEventListener('click', closeHistoryModal);
  }

  // 保存ボタン
  const saveBtn = qs('#saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', showSaveDialog);
  }

  // 保存ダイアログ - 保存
  const confirmSaveBtn = qs('#confirmSaveBtn');
  if (confirmSaveBtn) {
    confirmSaveBtn.addEventListener('click', handleSaveCalculation);
  }

  // 保存ダイアログ - キャンセル
  const cancelSaveBtn = qs('#cancelSaveBtn');
  if (cancelSaveBtn) {
    cancelSaveBtn.addEventListener('click', closeSaveDialog);
  }

  // 検索
  const searchInput = qs('#historySearch');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearch);
  }

  // エクスポート
  const exportBtn = qs('#exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', handleExport);
  }

  // インポート
  const importBtn = qs('#importBtn');
  if (importBtn) {
    importBtn.addEventListener('click', handleImport);
  }

  // すべてクリア
  const clearAllBtn = qs('#clearAllBtn');
  if (clearAllBtn) {
    clearAllBtn.addEventListener('click', handleClearAll);
  }
}
