/**
 * 保存ダイアログの管理
 */

import { loadCalculation, updateCalculation, saveCalculation, getUniqueProductNames } from './storage.js';
import { qs, qsa, num } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, FIXED_FIELDS, WEIGHT_FIELDS, YIELD_STATS_FIELDS, UI_ELEMENTS, RADIO_NAMES } from './constants.js';
import { grossFromMarkup } from './calculation.js';
import { escapeHTML } from './history-item-renderer.js';

/**
 * 保存ダイアログを表示
 */
export async function showSaveDialog(showToastCallback) {
  const dialog = qs('#saveDialog');
  if (!dialog) {
    console.error('[showSaveDialog] エラー: dialog要素が見つかりません!');
    return;
  }

  // 背景のスクロールを無効化
  document.body.classList.add('modal-open');

  // ダイアログのタイトルとボタンテキストを保存モードに応じて変更
  const dialogTitle = qs('#saveDialog .dialog-title');
  const confirmBtn = qs('#confirmSaveBtn');

  if (appState.getSaveDialogMode() === 'new') {
    if (dialogTitle) dialogTitle.textContent = '💾 新規保存';
    if (confirmBtn) confirmBtn.textContent = '新規保存';
  } else {
    if (dialogTitle) dialogTitle.textContent = '💾 計算を保存';
    if (confirmBtn) confirmBtn.textContent = '保存';
  }

  // ダイアログをすぐに表示（UIの応答性を向上）
  try {
    dialog.showModal();
  } catch (error) {
    console.error('[showSaveDialog] ダイアログ表示エラー:', error);
  }

  // 履歴から読み込んだ場合は、そのカテゴリーと商品名を設定
  const categorySelect = qs('#saveCategory');
  const nameInput = qs('#saveName');

  // フラグで履歴から読み込まれたかチェック（一貫性のため）
  if (appState.isFromHistoryRecord() && appState.getSaveDialogMode() !== 'new') {
    // 実際のIDを取得して履歴データを読み込む
    const loadedHistoryId = appState.getLoadedHistoryId();
    try {
      const historyData = await loadCalculation(loadedHistoryId);
      if (categorySelect) {
        categorySelect.value = historyData.category || '';
      }
      if (nameInput) {
        nameInput.value = historyData.name || '';
      }
      // カテゴリーに応じた商品名プリセットを更新
      await updateProductNamePresets(historyData.category);
    } catch (error) {
      console.error('Failed to load history data for dialog:', error);
    }
  } else {
    // 新規保存または履歴IDがない場合
    if (categorySelect) {
      categorySelect.value = '';
    }

    // 現在のモードから品名を取得して商品名入力欄に自動入力
    if (nameInput) {
      const currentMode = appState.getMode();
      let productName = '';

      if (currentMode === MODE.FIXED) {
        const fixedProductNameEl = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
        productName = fixedProductNameEl?.value?.trim() || '';
      } else if (currentMode === MODE.WEIGHT) {
        const weightProductNameEl = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
        productName = weightProductNameEl?.value?.trim() || '';
      } else if (currentMode === MODE.YIELD_STATS) {
        const yieldStatsProductNameEl = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
        productName = yieldStatsProductNameEl?.value?.trim() || '';
      }

      nameInput.value = productName;
    }

    // 商品名プリセットをクリア（カテゴリー未選択のため）
    await updateProductNamePresets();
  }

  // カテゴリー変更時のイベントリスナーを設定
  if (categorySelect) {
    // 既存のリスナーを削除してから新しく追加
    const newCategorySelect = categorySelect.cloneNode(true);
    categorySelect.parentNode.replaceChild(newCategorySelect, categorySelect);

    newCategorySelect.addEventListener('change', async (e) => {
      const selectedCategory = e.target.value;
      // カテゴリー変更時は商品名をクリアせず、プリセットのみ更新
      // これにより、ユーザーが既に入力した商品名が保持される
      // 選択されたカテゴリーに応じて商品名プリセットをフィルタリング
      await updateProductNamePresets(selectedCategory || null);
    });
  }
}

/**
 * 保存ダイアログを閉じる
 */
export function closeSaveDialog() {
  const dialog = qs('#saveDialog');
  if (dialog) {
    dialog.close();
    // 背景のスクロールを再び有効化
    document.body.classList.remove('modal-open');
  }
}

/**
 * 現在のフィールドから商品名を取得
 * @param {string} mode - 計算モード
 * @returns {string} 商品名
 */
export function getCurrentProductNameFromField(mode) {
  if (mode === MODE.FIXED) {
    const el = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
    return el ? el.value.trim() : '';
  } else if (mode === MODE.WEIGHT) {
    const el = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
    return el ? el.value.trim() : '';
  } else if (mode === MODE.YIELD_STATS) {
    const el = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
    return el ? el.value.trim() : '';
  }
  return '';
}

/**
 * フィールドの商品名を更新
 * @param {string} mode - 計算モード
 * @param {string} name - 新しい商品名
 */
export function updateProductNameField(mode, name) {
  if (mode === MODE.FIXED) {
    const el = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
    if (el) el.value = name;
  } else if (mode === MODE.WEIGHT) {
    const el = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
    if (el) el.value = name;
  } else if (mode === MODE.YIELD_STATS) {
    const el = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
    if (el) el.value = name;
  }
}

/**
 * 現在の入力値を全て収集
 * @param {string} mode - 計算モード
 * @returns {Object} 入力値オブジェクト
 */
export function collectInputValues(mode) {
  const inputData = {
    mode: mode
  };

  if (mode === MODE.FIXED) {
    // 定額売価モード
    // 商品名を収集
    const fixedProductNameEl = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
    inputData.productName = fixedProductNameEl ? fixedProductNameEl.value : '';

    // 商品化シミュレーション（定額・計量モードのみ）
    inputData.expWeight = num(UI_ELEMENTS.EXP_WEIGHT);
    inputData.consumable = num(UI_ELEMENTS.CONSUMABLE);

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
  } else if (mode === MODE.WEIGHT) {
    // 計量売価モード
    // 商品名を収集
    const weightProductNameEl = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
    inputData.productName = weightProductNameEl ? weightProductNameEl.value : '';

    // 商品化シミュレーション（定額・計量モードのみ）
    inputData.expWeight = num(UI_ELEMENTS.EXP_WEIGHT);
    inputData.consumable = num(UI_ELEMENTS.CONSUMABLE);

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
  } else if (mode === MODE.YIELD_STATS) {
    // 歩留まり統計モード
    // 商品名を収集
    const productNameEl = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
    inputData.productName = productNameEl ? productNameEl.value : '';

    // テーブルデータを収集
    const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
    const tableData = [];

    if (tbody) {
      const rows = tbody.querySelectorAll('.yield-stats-row');
      rows.forEach((row) => {
        const rowId = row.dataset.rowId;
        if (rowId !== undefined) {
          const beforeWeightInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
          const afterWeightInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);

          const beforeWeight = beforeWeightInput ? beforeWeightInput.value : '';
          const afterWeight = afterWeightInput ? afterWeightInput.value : '';

          // 空の行はスキップ（両方が空の場合）
          if (beforeWeight !== '' || afterWeight !== '') {
            // データ整合性: 数値として保存（文字列のままだと計算エラーの原因）
            tableData.push({
              beforeWeight: beforeWeight !== '' ? parseFloat(beforeWeight) || 0 : '',
              afterWeight: afterWeight !== '' ? parseFloat(afterWeight) || 0 : ''
            });
          }
        }
      });
    }

    inputData.tableData = tableData;
    // 歩留まり統計モードでは商品化シミュレーション機能を使用しないため、expWeightとconsumableは保存しない
  }

  return inputData;
}

/**
 * 商品名プリセットを更新
 */
export async function updateProductNamePresets(category = null) {
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
 * 保存ボタンの表示切り替え
 * isFromHistory と hasUnsavedChanges の2つのフラグで判断
 *
 * | isFromHistory | hasChanges | 表示するボタン |
 * |--------------|-----------|---------------|
 * | false        | false     | 「この計算を保存」（無効化） |
 * | false        | true      | 「この計算を保存」 |
 * | true         | false     | 「上書き保存」「新規保存」（無効化） |
 * | true         | true      | 「上書き保存」「新規保存」 |
 */
export function updateSaveButtonsVisibility() {
  const isFromHistory = appState.isFromHistoryRecord();
  const hasChanges = appState.hasChanges();

  const saveBtns = qsa('.save-btn');
  const overwriteSaveBtns = qsa('.overwrite-save-btn');
  const newSaveBtns = qsa('.new-save-btn');

  if (isFromHistory) {
    // 履歴から読み込んだ場合: 上書き保存と新規保存を表示
    saveBtns.forEach(btn => {
      btn.style.display = 'none';
    });
    overwriteSaveBtns.forEach(btn => {
      btn.style.display = '';
      btn.disabled = !hasChanges;
    });
    newSaveBtns.forEach(btn => {
      btn.style.display = '';
      btn.disabled = !hasChanges;
    });
  } else {
    // 新規計算の場合: 通常の保存ボタンを表示
    saveBtns.forEach(btn => {
      btn.style.display = '';
      btn.disabled = !hasChanges;
    });
    overwriteSaveBtns.forEach(btn => {
      btn.style.display = 'none';
    });
    newSaveBtns.forEach(btn => {
      btn.style.display = 'none';
    });
  }
}

/**
 * 上書き保存（履歴から読み込んだ計算を更新）
 * ダイアログを表示せず、既存の商品名・カテゴリで直接保存
 */
export async function handleOverwriteSave(showToastCallback) {
  // フラグで履歴から読み込まれたかチェック（一貫性のため）
  if (!appState.isFromHistoryRecord()) {
    showToastCallback('❌ 上書き保存できる履歴がありません', 'error');
    return;
  }

  // 実際のIDを取得してバリデーション
  const loadedHistoryId = appState.getLoadedHistoryId();

  if (!loadedHistoryId || (typeof loadedHistoryId !== 'number' && typeof loadedHistoryId !== 'string')) {
    console.error('❌ 無効な履歴ID:', loadedHistoryId);
    showToastCallback('❌ 履歴IDが無効です', 'error');
    return;
  }

  try {
    // 既存の履歴データを取得して商品名とカテゴリを使用
    const existingData = await loadCalculation(loadedHistoryId);

    if (!existingData) {
      showToastCallback('❌ 元の履歴データが見つかりません', 'error');
      return;
    }

    const name = existingData.name;
    const category = existingData.category;

    // 現在の入力値と計算結果を取得
    const mode = appState.getMode();
    const inputData = collectInputValues(mode);

    // 歩留まり統計モードの場合は統計データを保存、それ以外はsnapshotを使用
    let resultData;
    if (mode === MODE.YIELD_STATS) {
      resultData = appState.getYieldStatsData() || {};
    } else {
      resultData = appState.getSnapshot(); // 計算結果
    }

    const productData = appState.getProductData(); // 商品化データ

    // 値引後最終粗利率を計算して追加（歩留まり統計モード以外）
    if (mode !== MODE.YIELD_STATS && productData && Number.isFinite(productData.markup)) {
      const discountRate = num(UI_ELEMENTS.DISC_INPUT) || 0;
      const discountGross = grossFromMarkup(productData.markup, discountRate);
      resultData.discountGross = discountGross;
    }

    await updateCalculation(loadedHistoryId, name, mode, inputData, resultData, category, productData);

    // UI状態フラグを更新：保存済み（変更なし）
    appState.markAsSaved();
    updateSaveButtonsVisibility();

    showToastCallback('✅ 上書き保存しました');
    // 商品名プリセットを更新
    await updateProductNamePresets();
  } catch (error) {
    console.error('Overwrite save error:', error);
    showToastCallback('❌ 上書き保存に失敗しました', 'error');
  }
}

/**
 * 新規保存（履歴から読み込んだ計算を新しいエントリとして保存）
 */
export async function handleNewSave(showToastCallback) {
  const nameInput = qs('#saveName');
  const categorySelect = qs('#saveCategory');

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (name === '') {
    showToastCallback('❌ 商品名を入力してください', 'error');
    return;
  }

  const category = categorySelect ? categorySelect.value : null;
  if (!category) {
    showToastCallback('❌ カテゴリを選択してください', 'error');
    return;
  }

  // 現在の入力値と計算結果を取得
  const mode = appState.getMode();
  const inputData = collectInputValues(mode);

  // 保存ダイアログで変更した商品名をinputDataに反映（重要！）
  // collectInputValues()は画面のフィールドから収集するため、
  // 保存ダイアログで変更した商品名が反映されていない
  inputData.productName = name;

  // 歩留まり統計モードの場合は統計データを保存、それ以外はsnapshotを使用
  let resultData;
  if (mode === MODE.YIELD_STATS) {
    resultData = appState.getYieldStatsData() || {};
  } else {
    resultData = appState.getSnapshot(); // 計算結果
  }

  const productData = appState.getProductData(); // 商品化データ

  // 値引後最終粗利率を計算して追加（歩留まり統計モード以外）
  if (mode !== MODE.YIELD_STATS && productData && Number.isFinite(productData.markup)) {
    const discountRate = num(UI_ELEMENTS.DISC_INPUT) || 0;
    const discountGross = grossFromMarkup(productData.markup, discountRate);
    resultData.discountGross = discountGross;
  }

  try {
    // 保存前に元のフィールドの商品名を取得
    const currentFieldName = getCurrentProductNameFromField(mode);
    const nameChanged = currentFieldName !== name;

    // 新規保存して、新しいIDを取得
    const newId = await saveCalculation(name, mode, inputData, resultData, category, productData);

    // 新規保存した計算を「現在読み込んでいる履歴」として設定
    // これにより、「上書き保存」と「新規保存」のボタンが表示される
    appState.setLoadedHistoryId(newId);
    // UI状態フラグを更新：保存済み（変更なし、履歴から扱う）
    appState.markAsSaved();
    updateSaveButtonsVisibility();
    closeSaveDialog();

    // 保存した商品名を元のフィールドにも反映
    if (nameChanged) {
      updateProductNameField(mode, name);
      showToastCallback('✅ 新規保存しました（商品名も更新しました）');
    } else {
      showToastCallback('✅ 新規保存しました');
    }

    // 商品名プリセットを更新
    await updateProductNamePresets();
  } catch (error) {
    console.error('New save error:', error);
    showToastCallback('❌ 新規保存に失敗しました', 'error');
  }
}

/**
 * 現在の計算を保存（履歴IDがある場合は上書き、なければ新規保存）
 */
export async function handleSaveCalculation(showToastCallback) {
  const nameInput = qs('#saveName');
  const categorySelect = qs('#saveCategory');

  if (!nameInput) return;

  const name = nameInput.value.trim();
  if (name === '') {
    showToastCallback('❌ 商品名を入力してください', 'error');
    return;
  }

  const category = categorySelect ? categorySelect.value : null;
  if (!category) {
    showToastCallback('❌ カテゴリを選択してください', 'error');
    return;
  }

  // 現在の入力値と計算結果を取得
  const mode = appState.getMode();
  const inputData = collectInputValues(mode);

  // 保存ダイアログで変更した商品名をinputDataに反映（重要！）
  // collectInputValues()は画面のフィールドから収集するため、
  // 保存ダイアログで変更した商品名が反映されていない
  inputData.productName = name;

  // 歩留まり統計モードの場合は統計データを保存、それ以外はsnapshotを使用
  let resultData;
  if (mode === MODE.YIELD_STATS) {
    resultData = appState.getYieldStatsData() || {};
  } else {
    resultData = appState.getSnapshot(); // 計算結果
  }

  const productData = appState.getProductData(); // 商品化データ

  // 値引後最終粗利率を計算して追加（歩留まり統計モード以外）
  if (mode !== MODE.YIELD_STATS && productData && Number.isFinite(productData.markup)) {
    const discountRate = num(UI_ELEMENTS.DISC_INPUT) || 0;
    const discountGross = grossFromMarkup(productData.markup, discountRate);
    resultData.discountGross = discountGross;
  }

  try {
    // 保存前に元のフィールドの商品名を取得
    const currentFieldName = getCurrentProductNameFromField(mode);
    const nameChanged = currentFieldName !== name;

    // フラグで履歴から読み込まれたかチェック（一貫性のため）
    if (appState.isFromHistoryRecord()) {
      // 実際のIDを取得してバリデーション
      const loadedHistoryId = appState.getLoadedHistoryId();

      if (!loadedHistoryId || (typeof loadedHistoryId !== 'number' && typeof loadedHistoryId !== 'string')) {
        console.error('❌ 無効な履歴ID:', loadedHistoryId);
        throw new Error('履歴IDが無効です');
      }

      await updateCalculation(loadedHistoryId, name, mode, inputData, resultData, category, productData);

      // UI状態フラグを更新：保存済み（変更なし）
      appState.markAsSaved();
      updateSaveButtonsVisibility();

      // 保存した商品名を元のフィールドにも反映
      if (nameChanged) {
        updateProductNameField(mode, name);
        showToastCallback('✅ 上書き保存しました（商品名も更新しました）');
      } else {
        showToastCallback('✅ 上書き保存しました');
      }
    } else {
      // 新規保存して、新しいIDを取得
      const newId = await saveCalculation(name, mode, inputData, resultData, category, productData);

      // 新規保存した計算を「現在読み込んでいる履歴」として設定
      appState.setLoadedHistoryId(newId);
      // UI状態フラグを更新：保存済み（変更なし、履歴から扱う）
      appState.markAsSaved();
      updateSaveButtonsVisibility();

      // 保存した商品名を元のフィールドにも反映
      if (nameChanged) {
        updateProductNameField(mode, name);
        showToastCallback('✅ 保存しました（商品名も更新しました）');
      } else {
        showToastCallback('✅ 保存しました');
      }
    }
    closeSaveDialog();
    // 商品名プリセットを更新
    await updateProductNamePresets();
  } catch (error) {
    console.error('Save error:', error);
    showToastCallback('❌ 保存に失敗しました', 'error');
  }
}
