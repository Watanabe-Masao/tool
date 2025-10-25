/**
 * 履歴機能のUI管理
 */

import { getHistory, searchHistory, deleteHistory, updateCalculationName, loadCalculation, saveCalculation, exportData, importData, clearAllHistory, restoreInputFields, getUniqueProductNames } from './storage.js';
import { qs, num } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, FIXED_FIELDS, WEIGHT_FIELDS, UI_ELEMENTS, RADIO_NAMES } from './constants.js';
import { grossFromMarkup } from './calculation.js';

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

  // 商品名とカテゴリーでグループ化
  const groups = groupHistoryByProduct(history);

  // グループごとにHTMLを生成
  listContainer.innerHTML = groups.map(group => createHistoryGroupHTML(group)).join('');

  // イベントリスナーをバインド
  bindHistoryItemEvents();
  initializeCarousels();
}

/**
 * 履歴を商品名とカテゴリーでグループ化
 * @param {Array} history - 履歴データ配列
 * @returns {Array} グループ化された配列
 */
function groupHistoryByProduct(history) {
  const groupMap = new Map();

  history.forEach(item => {
    const key = `${item.name || '無題'}_${item.category || 'unknown'}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key).push(item);
  });

  // Map を配列に変換
  return Array.from(groupMap.values());
}

/**
 * 履歴グループのHTMLを生成（カルーセル対応）
 * @param {Array} group - 同一商品名の履歴アイテム配列
 * @returns {string} HTML文字列
 */
function createHistoryGroupHTML(group) {
  if (group.length === 0) return '';

  const hasMultiple = group.length > 1;
  const groupId = `group-${group[0].id}`;

  return `
    <li class="history-group">
      <div class="history-carousel" id="${groupId}">
        <div class="history-carousel-track">
          ${group.map((item, index) => createHistoryItemHTML(item, index === 0)).join('')}
        </div>
        ${hasMultiple ? `
          <div class="history-carousel-indicators">
            ${group.map((_, index) => `
              <button class="carousel-indicator ${index === 0 ? 'active' : ''}" data-index="${index}"></button>
            `).join('')}
          </div>
          <div class="history-carousel-count">${group.length}件の履歴</div>
        ` : ''}
      </div>
    </li>
  `;
}

/**
 * 履歴アイテムのHTMLを生成
 * @param {Object} item - 履歴データ
 * @param {boolean} isFirst - 最初のアイテムかどうか
 * @returns {string} HTML文字列
 */
function createHistoryItemHTML(item, isFirst = true) {
  const date = new Date(item.timestamp);
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const modeLabel = item.mode === 'fixed' ? '定額売価' : '計量売価';
  const modeIcon = getModeIcon(item.mode);

  // モードに応じて表示ラベルと値を取得
  const isFixedMode = item.mode === 'fixed';
  const costLabel = isFixedMode ? '1個あたりの原価' : '1箱あたりの原価';
  const priceLabel = isFixedMode ? '1個あたりの売価' : '1箱あたりの売価';

  // 原価・売価を取得
  const cost = isFixedMode ? item.input?.unitCost : item.input?.boxCost;
  const price = isFixedMode ? item.input?.unitPrice : item.input?.boxPrice;

  // 加工前値入率を取得（result.bmまたはresult.markup）
  const beforeMarkup = item.result?.bm ?? item.result?.markup;

  // 加工後値入率を取得
  const afterMarkup = item.result?.am ?? item.result?.afterMarkup;

  // 歩留まり率を取得（result.yieldRate が優先、なければ input.yieldRate）
  const yieldRate = item.result?.yieldRate ?? item.input?.yieldRate;

  // 最終粗利率を取得（値引後最終粗利率）
  let finalGross = '-';
  if (item.result?.discountGross != null && typeof item.result.discountGross === 'number') {
    // 保存されている値引後粗利率を使用
    finalGross = item.result.discountGross.toFixed(1);
  } else if (typeof afterMarkup === 'number') {
    // 値引後粗利率がない場合は加工後値入率を使用（後方互換性）
    finalGross = afterMarkup.toFixed(1);
  }

  return `
    <div class="history-item ${isFirst ? 'active' : ''}" data-id="${item.id}">
      <div class="history-item-header">
        <div class="history-item-title">
          <span class="history-item-icon">${modeIcon}</span>
          <span class="history-item-name">${escapeHTML(item.name || '無題')}</span>
        </div>
      </div>
      <div class="history-item-stats">
        <div class="history-stats-row">
          <span class="history-stat">${costLabel}: <strong>${typeof cost === 'number' ? cost.toFixed(0) : '-'}円</strong></span>
          <span class="history-stat">${priceLabel}: <strong>${typeof price === 'number' ? price.toFixed(0) : '-'}円</strong></span>
          <span class="history-stat">加工前値入率: <strong>${typeof beforeMarkup === 'number' ? beforeMarkup.toFixed(1) : '-'}%</strong></span>
          <span class="history-stat">加工後値入率: <strong>${typeof afterMarkup === 'number' ? afterMarkup.toFixed(1) : '-'}%</strong></span>
        </div>
        <div class="history-stats-row">
          <span class="history-stat">歩留まり率: <strong>${typeof yieldRate === 'number' ? yieldRate.toFixed(1) : '-'}%</strong></span>
          <span class="history-stat">最終粗利率: <strong>${finalGross}%</strong></span>
        </div>
      </div>
      <div class="history-item-date">${dateStr}</div>
      <div class="history-item-actions">
        <button class="btn-small btn-load" data-id="${item.id}">📂 読込</button>
        <button class="btn-small btn-edit" data-id="${item.id}">✏️ 編集</button>
        <button class="btn-small btn-delete" data-id="${item.id}">🗑️ 削除</button>
      </div>
    </div>
  `;
}

/**
 * モードに応じたラベルを返す
 * @param {string} mode
 * @returns {string}
 */
function getModeIcon(mode) {
  return mode === 'fixed' ? '定額売価' : '計量売価';
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
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      await handleLoadCalculation(id);
    });
    // タッチイベントでもスワイプを防止
    btn.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    });
  });

  // 編集ボタン
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      handleEditCalculation(id);
    });
    btn.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    });
  });

  // 削除ボタン
  document.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      await handleDeleteCalculation(id);
    });
    btn.addEventListener('touchstart', (e) => {
      e.stopPropagation();
    });
  });
}

/**
 * カルーセルを初期化（スワイプ対応）
 */
function initializeCarousels() {
  document.querySelectorAll('.history-carousel').forEach(carousel => {
    const track = carousel.querySelector('.history-carousel-track');
    const items = Array.from(track.children);
    const indicators = Array.from(carousel.querySelectorAll('.carousel-indicator'));

    if (items.length <= 1) return; // 1件のみの場合はスワイプ不要

    let currentIndex = 0;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startTime = 0;
    let touchStartedOnButton = false;

    // スワイプでアイテムを切り替え
    function showItem(index, smooth = true) {
      if (index < 0 || index >= items.length) return;

      currentIndex = index;
      const offset = -index * 100;
      track.style.transition = smooth ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
      track.style.transform = `translateX(${offset}%)`;

      // アクティブ状態を更新
      items.forEach((item, i) => {
        item.classList.toggle('active', i === index);
      });

      indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === index);
      });
    }

    // タッチ開始 - カルーセル全体で検出
    carousel.addEventListener('touchstart', (e) => {
      // ボタン上でのタッチはスワイプを無効化
      const target = e.target;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        touchStartedOnButton = true;
        isDragging = false;
        return;
      }

      touchStartedOnButton = false;
      startX = e.touches[0].clientX;
      currentX = startX;
      startTime = Date.now();
      isDragging = true;
    }, { passive: true });

    // タッチ移動 - カルーセル全体で検出
    carousel.addEventListener('touchmove', (e) => {
      if (!isDragging || touchStartedOnButton) return;
      currentX = e.touches[0].clientX;
    }, { passive: true });

    // タッチ終了
    const handleTouchEnd = () => {
      if (!isDragging || touchStartedOnButton) {
        touchStartedOnButton = false;
        isDragging = false;
        return;
      }
      isDragging = false;

      const diff = currentX - startX;
      const duration = Date.now() - startTime;
      const velocity = Math.abs(diff) / duration; // ピクセル/ミリ秒

      // より敏感な設定：5%の移動または速度0.2で反応
      const threshold = carousel.offsetWidth * 0.05;
      const isQuickSwipe = velocity > 0.2;

      // スワイプ方向を判定
      if ((Math.abs(diff) > threshold || isQuickSwipe) && Math.abs(diff) > 10) {
        if (diff > 0 && currentIndex > 0) {
          // 右スワイプ（戻る）
          showItem(currentIndex - 1);
        } else if (diff < 0 && currentIndex < items.length - 1) {
          // 左スワイプ（進む）
          showItem(currentIndex + 1);
        } else {
          // 端に到達している場合は元の位置に戻る
          showItem(currentIndex);
        }
      } else {
        // 閾値未満の場合は元の位置に戻る
        showItem(currentIndex);
      }
    };

    carousel.addEventListener('touchend', handleTouchEnd, { passive: true });
    carousel.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // マウスでもスワイプ可能に - カルーセル全体で検出
    let mouseDown = false;
    let mouseStartedOnButton = false;

    carousel.addEventListener('mousedown', (e) => {
      // ボタン上でのマウスダウンはスワイプを無効化
      const target = e.target;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        mouseStartedOnButton = true;
        mouseDown = false;
        return;
      }

      mouseStartedOnButton = false;
      startX = e.clientX;
      currentX = startX;
      startTime = Date.now();
      mouseDown = true;
      isDragging = true;
      e.preventDefault();
    });

    carousel.addEventListener('mousemove', (e) => {
      if (!mouseDown || mouseStartedOnButton) return;
      currentX = e.clientX;
    });

    const handleMouseEnd = () => {
      if (!mouseDown || mouseStartedOnButton) {
        mouseStartedOnButton = false;
        mouseDown = false;
        return;
      }
      mouseDown = false;
      isDragging = false;

      const diff = currentX - startX;
      const duration = Date.now() - startTime;
      const velocity = Math.abs(diff) / duration;

      const threshold = carousel.offsetWidth * 0.05;
      const isQuickSwipe = velocity > 0.2;

      // スワイプ方向を判定
      if ((Math.abs(diff) > threshold || isQuickSwipe) && Math.abs(diff) > 10) {
        if (diff > 0 && currentIndex > 0) {
          showItem(currentIndex - 1);
        } else if (diff < 0 && currentIndex < items.length - 1) {
          showItem(currentIndex + 1);
        } else {
          showItem(currentIndex);
        }
      } else {
        // 閾値未満の場合は元の位置に戻る
        showItem(currentIndex);
      }
    };

    carousel.addEventListener('mouseup', handleMouseEnd);
    carousel.addEventListener('mouseleave', () => {
      if (mouseDown) {
        handleMouseEnd();
      }
    });

    // インジケータークリック
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        showItem(index);
      });
    });

    // 初期化時にトランジションを設定
    track.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
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

  // 値引後最終粗利率を計算して追加
  if (productData && Number.isFinite(productData.markup)) {
    const discountRate = num(UI_ELEMENTS.DISC_INPUT) || 0;
    const discountGross = grossFromMarkup(productData.markup, discountRate);
    resultData.discountGross = discountGross;
  }

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
