/**
 * 履歴機能のUI管理
 */

import { getHistory, searchHistory, deleteHistory, updateCalculationName, loadCalculation, saveCalculation, exportData, importData, clearAllHistory, restoreInputFields, getUniqueProductNames } from './storage.js';
import { qs, num } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, FIXED_FIELDS, WEIGHT_FIELDS, UI_ELEMENTS, RADIO_NAMES } from './constants.js';

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
    'vegetable': '🥬',
    'fruit': '🍎'
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

    // モーダルを閉じる（先に閉じる）
    closeHistoryModal();

    // モードを切り替え
    switchToMode(data.mode);

    // 入力方法を切り替え
    switchYieldMethod(data.mode, data.input.yieldMethod);

    // 少し待ってからフィールドに値を復元（UIの切り替えが完了するまで）
    setTimeout(() => {
      restoreAllInputFields(data.mode, data.input);
      // 計算を強制的にトリガー
      triggerCalculation(data.mode, data.input.yieldMethod);
      showToast('✅ データを読み込みました');
    }, 100);

  } catch (error) {
    console.error('Load error:', error);
    showToast('❌ データの読み込みに失敗しました', 'error');
  }
}

/**
 * モードを切り替え
 * @param {string} mode
 */
function switchToMode(mode) {
  // モードボタンをクリックしてUIを切り替え
  const modeBtn = qs(mode === MODE.FIXED ? '#fixedBtn' : '#weightBtn');
  if (modeBtn) {
    modeBtn.click();
  }
}

/**
 * 歩留まり計算方法を切り替え
 * @param {string} mode
 * @param {string} yieldMethod
 */
function switchYieldMethod(mode, yieldMethod) {
  const radioName = mode === MODE.FIXED ? RADIO_NAMES.YIELD_METHOD_FIXED : RADIO_NAMES.YIELD_METHOD_WEIGHT;
  const radio = document.querySelector(`input[name="${radioName}"][value="${yieldMethod}"]`);
  if (radio) {
    radio.checked = true;
    // changeイベントをトリガー
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/**
 * 全ての入力フィールドに値を復元
 * @param {string} mode
 * @param {Object} input
 */
function restoreAllInputFields(mode, input) {
  // 商品化シミュレーション
  const expWeightEl = qs(`#${UI_ELEMENTS.EXP_WEIGHT}`);
  if (expWeightEl && input.expWeight != null) expWeightEl.value = input.expWeight;

  const consumableEl = qs(`#${UI_ELEMENTS.CONSUMABLE}`);
  if (consumableEl && input.consumable != null) consumableEl.value = input.consumable;

  if (mode === MODE.FIXED) {
    if (input.yieldMethod === 'calculate') {
      // 重量から計算モード
      const unitCostEl = qs(`#${FIXED_FIELDS.CALCULATE.UNIT_COST}`);
      if (unitCostEl && input.unitCost != null) unitCostEl.value = input.unitCost;

      const unitPriceEl = qs(`#${FIXED_FIELDS.CALCULATE.UNIT_PRICE}`);
      if (unitPriceEl && input.unitPrice != null) unitPriceEl.value = input.unitPrice;

      const beforeWeightEl = qs(`#${FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT}`);
      if (beforeWeightEl && input.beforeWeight != null) beforeWeightEl.value = input.beforeWeight;

      const afterWeightEl = qs(`#${FIXED_FIELDS.CALCULATE.AFTER_WEIGHT}`);
      if (afterWeightEl && input.afterWeight != null) afterWeightEl.value = input.afterWeight;

      const afterPrice100El = qs(`#${FIXED_FIELDS.CALCULATE.AFTER_PRICE_100}`);
      if (afterPrice100El && input.afterPrice100 != null) afterPrice100El.value = input.afterPrice100;
    } else {
      // 歩留まり率直接入力モード
      const unitCostEl = qs(`#${FIXED_FIELDS.DIRECT.UNIT_COST}`);
      if (unitCostEl && input.unitCost != null) unitCostEl.value = input.unitCost;

      const unitPriceEl = qs(`#${FIXED_FIELDS.DIRECT.UNIT_PRICE}`);
      if (unitPriceEl && input.unitPrice != null) unitPriceEl.value = input.unitPrice;

      const beforeWeightEl = qs(`#${FIXED_FIELDS.DIRECT.BEFORE_WEIGHT}`);
      if (beforeWeightEl && input.beforeWeight != null) beforeWeightEl.value = input.beforeWeight;

      const yieldRateEl = qs(`#${FIXED_FIELDS.DIRECT.YIELD_RATE}`);
      if (yieldRateEl && input.yieldRate != null) yieldRateEl.value = input.yieldRate;

      const afterPrice100El = qs(`#${FIXED_FIELDS.DIRECT.AFTER_PRICE_100}`);
      if (afterPrice100El && input.afterPrice100 != null) afterPrice100El.value = input.afterPrice100;
    }
  } else {
    if (input.yieldMethod === 'calculate') {
      // 重量から計算モード
      const boxCostEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_COST}`);
      if (boxCostEl && input.boxCost != null) boxCostEl.value = input.boxCost;

      const boxPriceEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_PRICE}`);
      if (boxPriceEl && input.boxPrice != null) boxPriceEl.value = input.boxPrice;

      const boxWeightEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT}`);
      if (boxWeightEl && input.boxWeight != null) boxWeightEl.value = input.boxWeight;

      const beforeSampleEl = qs(`#${WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE}`);
      if (beforeSampleEl && input.beforeSample != null) beforeSampleEl.value = input.beforeSample;

      const afterWeightEl = qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT}`);
      if (afterWeightEl && input.afterWeight != null) afterWeightEl.value = input.afterWeight;

      const afterPrice100El = qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100}`);
      if (afterPrice100El && input.afterPrice100 != null) afterPrice100El.value = input.afterPrice100;
    } else {
      // 歩留まり率直接入力モード
      const boxCostEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_COST}`);
      if (boxCostEl && input.boxCost != null) boxCostEl.value = input.boxCost;

      const boxPriceEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_PRICE}`);
      if (boxPriceEl && input.boxPrice != null) boxPriceEl.value = input.boxPrice;

      const boxWeightEl = qs(`#${WEIGHT_FIELDS.DIRECT.BOX_WEIGHT}`);
      if (boxWeightEl && input.boxWeight != null) boxWeightEl.value = input.boxWeight;

      const yieldRateEl = qs(`#${WEIGHT_FIELDS.DIRECT.YIELD_RATE}`);
      if (yieldRateEl && input.yieldRate != null) yieldRateEl.value = input.yieldRate;

      const afterPrice100El = qs(`#${WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100}`);
      if (afterPrice100El && input.afterPrice100 != null) afterPrice100El.value = input.afterPrice100;
    }
  }
}

/**
 * 計算をトリガー（inputイベントを発火）
 * @param {string} mode
 * @param {string} yieldMethod
 */
function triggerCalculation(mode, yieldMethod) {
  // 最後の入力フィールドでinputイベントをトリガーして計算を実行
  let lastField;
  if (mode === MODE.FIXED) {
    lastField = yieldMethod === 'calculate' ?
      qs(`#${FIXED_FIELDS.CALCULATE.AFTER_PRICE_100}`) :
      qs(`#${FIXED_FIELDS.DIRECT.AFTER_PRICE_100}`);
  } else {
    lastField = yieldMethod === 'calculate' ?
      qs(`#${WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100}`) :
      qs(`#${WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100}`);
  }

  if (lastField) {
    lastField.dispatchEvent(new Event('input', { bubbles: true }));
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
export async function showSaveDialog() {
  const dialog = qs('#saveDialog');
  if (!dialog) return;

  // カテゴリー選択をクリア
  const categorySelect = qs('#saveCategory');
  if (categorySelect) {
    categorySelect.value = '';
  }

  // 商品名入力フィールドをクリア
  const nameInput = qs('#saveName');
  if (nameInput) {
    nameInput.value = '';
  }

  // 商品名プリセットをクリア（カテゴリー未選択のため）
  await updateProductNamePresets();

  // カテゴリー変更時のイベントリスナーを設定
  if (categorySelect) {
    // 既存のリスナーを削除してから新しく追加
    const newCategorySelect = categorySelect.cloneNode(true);
    categorySelect.parentNode.replaceChild(newCategorySelect, categorySelect);

    newCategorySelect.addEventListener('change', async (e) => {
      const selectedCategory = e.target.value;
      // 商品名をクリア
      const nameInput = qs('#saveName');
      if (nameInput) {
        nameInput.value = '';
      }
      // 選択されたカテゴリーに応じて商品名をフィルタリング
      await updateProductNamePresets(selectedCategory || null);
    });
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
 * 現在の入力値を全て収集
 * @param {string} mode - 計算モード
 * @returns {Object} 入力値オブジェクト
 */
function collectInputValues(mode) {
  const inputData = {
    mode: mode,
    // 商品化シミュレーション
    expWeight: num(UI_ELEMENTS.EXP_WEIGHT),
    consumable: num(UI_ELEMENTS.CONSUMABLE)
  };

  if (mode === MODE.FIXED) {
    // 定額売価モード
    const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
    inputData.yieldMethod = methodRadio ? methodRadio.value : 'calculate';

    if (inputData.yieldMethod === 'calculate') {
      // 重量から計算モード
      inputData.unitCost = num(FIXED_FIELDS.CALCULATE.UNIT_COST);
      inputData.unitPrice = num(FIXED_FIELDS.CALCULATE.UNIT_PRICE);
      inputData.beforeWeight = num(FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT);
      inputData.afterWeight = num(FIXED_FIELDS.CALCULATE.AFTER_WEIGHT);
      inputData.afterPrice100 = num(FIXED_FIELDS.CALCULATE.AFTER_PRICE_100);
    } else {
      // 歩留まり率直接入力モード
      inputData.unitCost = num(FIXED_FIELDS.DIRECT.UNIT_COST);
      inputData.unitPrice = num(FIXED_FIELDS.DIRECT.UNIT_PRICE);
      inputData.beforeWeight = num(FIXED_FIELDS.DIRECT.BEFORE_WEIGHT);
      inputData.yieldRate = num(FIXED_FIELDS.DIRECT.YIELD_RATE);
      inputData.afterPrice100 = num(FIXED_FIELDS.DIRECT.AFTER_PRICE_100);
    }
  } else {
    // 計量売価モード
    const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
    inputData.yieldMethod = methodRadio ? methodRadio.value : 'calculate';

    if (inputData.yieldMethod === 'calculate') {
      // 重量から計算モード
      inputData.boxCost = num(WEIGHT_FIELDS.CALCULATE.BOX_COST);
      inputData.boxPrice = num(WEIGHT_FIELDS.CALCULATE.BOX_PRICE);
      inputData.boxWeight = num(WEIGHT_FIELDS.CALCULATE.BOX_WEIGHT);
      inputData.beforeSample = num(WEIGHT_FIELDS.CALCULATE.BEFORE_SAMPLE);
      inputData.afterWeight = num(WEIGHT_FIELDS.CALCULATE.AFTER_WEIGHT);
      inputData.afterPrice100 = num(WEIGHT_FIELDS.CALCULATE.AFTER_PRICE_100);
    } else {
      // 歩留まり率直接入力モード
      inputData.boxCost = num(WEIGHT_FIELDS.DIRECT.BOX_COST);
      inputData.boxPrice = num(WEIGHT_FIELDS.DIRECT.BOX_PRICE);
      inputData.boxWeight = num(WEIGHT_FIELDS.DIRECT.BOX_WEIGHT);
      inputData.yieldRate = num(WEIGHT_FIELDS.DIRECT.YIELD_RATE);
      inputData.afterPrice100 = num(WEIGHT_FIELDS.DIRECT.AFTER_PRICE_100);
    }
  }

  return inputData;
}

/**
 * 商品名プリセットを更新
 */
async function updateProductNamePresets(category = null) {
  try {
    const productNames = await getUniqueProductNames(category);
    const datalist = qs('#productNameList');
    if (datalist) {
      if (productNames.length > 0) {
        datalist.innerHTML = productNames
          .map(name => `<option value="${escapeHTML(name)}">`)
          .join('');
      } else {
        // カテゴリーが選択されているが商品がない場合
        datalist.innerHTML = '';
      }
    }
  } catch (error) {
    console.error('Failed to update product name presets:', error);
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
  if (!category) {
    showToast('❌ カテゴリを選択してください', 'error');
    return;
  }

  // 現在の入力値と計算結果を取得
  const mode = appState.getMode();
  const inputData = collectInputValues(mode);
  const resultData = appState.getSnapshot(); // 計算結果
  const productData = appState.getProductData(); // 商品化データ

  try {
    await saveCalculation(name, mode, inputData, resultData, category, productData);
    closeSaveDialog();
    showToast('✅ 保存しました');
    // 商品名プリセットを更新
    await updateProductNamePresets();
  } catch (error) {
    console.error('Save error:', error);
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
