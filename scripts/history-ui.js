/**
 * 履歴機能のUI管理
 */

import { getHistory, searchHistory, deleteHistory, updateCalculationName, loadCalculation, exportData, importData, clearAllHistory, getUniqueProductNames } from './storage.js';
import { qs, qsa, num, show, hide, setText, yen, pct, addTapListener } from './dom-utils.js';
import { appState } from './state.js';
import { MODE, FIXED_FIELDS, WEIGHT_FIELDS, YIELD_STATS_FIELDS, UI_ELEMENTS, RADIO_NAMES } from './constants.js';
import { grossFromMarkup, toFixed } from './calculation.js';
import { displayProductSimulation } from './display.js';
import { groupHistoryByProduct, createHistoryGroupHTML, createHistoryItemHTML, getModeIcon, escapeHTML } from './history-item-renderer.js';
import { switchToMode, switchYieldMethod, restoreAllInputFields, restoreCalculationResults } from './history-restore.js';
import {
  showSaveDialog as showSaveDialogBase,
  closeSaveDialog,
  updateSaveButtonsVisibility,
  handleOverwriteSave as handleOverwriteSaveBase,
  handleNewSave as handleNewSaveBase,
  handleSaveCalculation as handleSaveCalculationBase
} from './history-save-dialog.js';
import { initializeCarousels, initHistoryFilterUI, setupHistoryFilterListeners } from './history-ui-controls.js';

// 保存ダイアログモードはappStateで管理（'new', 'overwrite', 'normal'）

// 再エクスポート（main.jsで使用）
export { updateSaveButtonsVisibility, closeSaveDialog };

/**
 * 履歴モーダルを表示
 */
export async function showHistoryModal() {
  const modal = qs('#historyModal');
  if (!modal) {
    console.error('履歴モーダルが見つかりません');
    return;
  }

  try {
    // 背景のスクロールを無効化
    document.body.classList.add('modal-open');

    modal.showModal();

    // 現在のモードと計算方法を取得
    let currentMode = appState.getMode();
    let currentYieldMethod = null;

    // 複数パターン分析モードから呼び出された場合は、歩留まり統計モードのデータを表示
    if (currentMode === MODE.MULTI_PATTERN) {
      currentMode = MODE.YIELD_STATS;
    }

    // 定額モードまたは計量モードの場合、現在選択されている計算方法を取得
    if (currentMode === MODE.FIXED) {
      const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]:checked`);
      currentYieldMethod = methodRadio ? methodRadio.value : 'calculate';
    } else if (currentMode === MODE.WEIGHT) {
      const methodRadio = document.querySelector(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]:checked`);
      currentYieldMethod = methodRadio ? methodRadio.value : 'calculate';
    }

    // フィルタリングUIを初期化
    initHistoryFilterUI(currentMode, currentYieldMethod);

    // フィルタリングUIのイベントリスナーを設定（初回のみ）
    setupHistoryFilterListeners(renderHistoryList);

    await renderHistoryList(null, currentMode, currentYieldMethod);
  } catch (error) {
    console.error('履歴モーダルを開く際にエラーが発生しました:', error);
    showToast('❌ 履歴を読み込めませんでした', 'error');
  }
}

/**
 * 履歴モーダルを閉じる
 */
export function closeHistoryModal() {
  const modal = qs('#historyModal');
  if (modal) {
    modal.close();
    // 背景のスクロールを再び有効化
    document.body.classList.remove('modal-open');
  }
}

/**
 * 履歴一覧を描画
 * @param {Array} items - 履歴データ配列（オプション）
 * @param {string} filterMode - フィルタするモード（オプション）
 * @param {string} filterYieldMethod - フィルタする歩留まり率入力方法（オプション）
 */
export async function renderHistoryList(items = null, filterMode = null, filterYieldMethod = null) {
  const listContainer = qs('#historyList');
  if (!listContainer) return;

  // フィルタ条件が渡されていない場合、現在のUIの状態から取得
  if (filterMode === null) {
    const activeBtn = qs('.btn-mode.is-active[data-mode]');
    const modeValue = activeBtn ? activeBtn.dataset.mode : null;
    // 'all'の場合はnullとして扱う（全データ表示）
    filterMode = (modeValue === 'all') ? null : modeValue;
  }

  if (filterYieldMethod === null && filterMode && filterMode !== MODE.YIELD_STATS) {
    const methodRadio = document.querySelector('input[name="historyFilterMethod"]:checked');
    filterYieldMethod = methodRadio ? methodRadio.value : null;
  }

  // データを取得
  let history = items || await getHistory();

  // モードと計算方法でフィルタリング
  if (filterMode) {
    history = history.filter(item => {
      // モードが一致するかチェック
      if (item.mode !== filterMode) return false;

      // 歩留まり統計モードの場合は、モードのみでフィルタリング
      if (filterMode === MODE.YIELD_STATS) return true;

      // 定額・計量モードの場合、yieldMethodでもフィルタリング
      if (filterYieldMethod) {
        // 古いデータでyieldMethodが保存されていない場合はデフォルトで'calculate'と見なす
        const itemYieldMethod = item.input?.yieldMethod || 'calculate';
        return itemYieldMethod === filterYieldMethod;
      }

      return true;
    });
  }

  // 商品名候補を更新するために常に全履歴を取得（フィルタリング前）
  const allHistory = await getHistory();

  // 全履歴が空の場合
  if (allHistory.length === 0) {
    listContainer.innerHTML = '<li class="history-empty">保存済みのデータがありません</li>';
    updateProductNameSuggestions([]);
    return;
  }

  // 絞り込み結果が空の場合
  if (history.length === 0) {
    // フィルタ条件に応じた詳細なメッセージを生成
    let message = '該当するデータがありません';
    if (filterMode) {
      const modeLabel = filterMode === MODE.FIXED ? '定額売価' :
                       filterMode === MODE.WEIGHT ? '計量売価' :
                       '歩留まり統計';
      // 歩留まり統計モードには計算方法がないため、ラベルを付けない
      const methodLabel = (filterMode !== MODE.YIELD_STATS && filterYieldMethod === 'direct') ? '（歩留まり率直接入力）' :
                         (filterMode !== MODE.YIELD_STATS && filterYieldMethod === 'calculate') ? '（重量から計算）' : '';
      message = `${modeLabel}${methodLabel}モードのデータがありません（全${allHistory.length}件中0件）`;
    }
    listContainer.innerHTML = `<li class="history-empty">${message}</li>`;
    // 商品名候補は現在のフィルタ条件の履歴から生成
    const filteredHistory = filterMode ? allHistory.filter(item => {
      if (item.mode !== filterMode) return false;
      if (filterMode === MODE.YIELD_STATS) return true;
      if (filterYieldMethod) {
        const itemYieldMethod = item.input?.yieldMethod || 'calculate';
        return itemYieldMethod === filterYieldMethod;
      }
      return true;
    }) : allHistory;
    updateProductNameSuggestions(filteredHistory);
    return;
  }

  // 商品名とカテゴリーでグループ化
  const groups = groupHistoryByProduct(history);

  // グループごとにHTMLを生成
  listContainer.innerHTML = groups.map(group => createHistoryGroupHTML(group)).join('');

  // 商品名候補を更新（現在のフィルタ条件の履歴から生成）
  const filteredHistory = filterMode ? allHistory.filter(item => {
    if (item.mode !== filterMode) return false;
    if (filterMode === MODE.YIELD_STATS) return true;
    if (filterYieldMethod) {
      const itemYieldMethod = item.input?.yieldMethod || 'calculate';
      return itemYieldMethod === filterYieldMethod;
    }
    return true;
  }) : allHistory;
  updateProductNameSuggestions(filteredHistory);

  // イベントリスナーをバインド
  bindHistoryItemEvents();
  initializeCarousels();
}

/**
 * 商品名の候補をselectタグに設定
 * @param {Array} history - 履歴データ配列
 */
function updateProductNameSuggestions(history) {
  const selectElement = qs('#historySearch');
  if (!selectElement) return;

  // 現在の選択値を保存
  const currentValue = selectElement.value;

  // ユニークな商品名を抽出
  const uniqueNames = [...new Set(history.map(item => item.name).filter(Boolean))];

  // selectの選択肢を更新（最初のプレースホルダーオプションは保持）
  selectElement.innerHTML = '<option value="">🔍 商品名で絞り込み...</option>' +
    uniqueNames
      .sort((a, b) => a.localeCompare(b, 'ja'))
      .map(name => `<option value="${escapeHTML(name)}">${escapeHTML(name)}</option>`)
      .join('');

  // 以前の選択値を復元
  if (currentValue && uniqueNames.includes(currentValue)) {
    selectElement.value = currentValue;
  }
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
    btn.addEventListener('touchend', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      await handleLoadCalculation(id);
    }, { passive: false });
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
    btn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      handleEditCalculation(id);
    }, { passive: false });
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
    btn.addEventListener('touchend', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = parseInt(e.target.dataset.id);
      await handleDeleteCalculation(id);
    }, { passive: false });
  });
}

/**
 * 計算データを読み込んで入力フィールドに復元
 * @param {number} id
 */
async function handleLoadCalculation(id) {
  try {
    const data = await loadCalculation(id);

    // 履歴から読み込んだ計算のIDを保存（上書き保存用）
    appState.setLoadedHistoryId(id);
    // UI状態フラグを更新：履歴から呼び出された、変更なし
    appState.markAsFromHistory();

    // モーダルを閉じる（先に閉じる）
    closeHistoryModal();

    // モードを切り替え
    switchToMode(data.mode);

    // 入力方法を切り替え
    switchYieldMethod(data.mode, data.input.yieldMethod);

    // 少し待ってからフィールドに値を復元（UIの切り替えが完了するまで）
    setTimeout(() => {
      // 履歴の商品名を商品名フィールドに設定
      restoreAllInputFields(data.mode, data.input, data.name);

      // 結果データがある場合はappStateに復元（歩留まり統計モードは除く）
      if (data.result && data.mode !== MODE.YIELD_STATS) {
        restoreCalculationResults(data.mode, data.input.yieldMethod, data.result, data.input);
      }

      // 商品化データがある場合は復元
      if (data.product && data.product.price != null) {
        appState.updateProductData(data.product);
        displayProductSimulation(data.product);
      }

      // 商品化シミュレーションのフィールドが入力されている場合、計算を実行
      // snapshotが有効で、expWeightが入力されている場合のみトリガー
      const snapshot = appState.getSnapshot();
      if (snapshot.isValid() && data.input.expWeight != null) {
        // inputイベントをトリガーして商品化シミュレーションを再計算
        const expWeightEl = qs(`#${UI_ELEMENTS.EXP_WEIGHT}`);
        if (expWeightEl && expWeightEl.value) {
          expWeightEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }

      // 値の復元でinputイベントが発火してmarkAsChanged()が呼ばれている可能性があるため、
      // 明示的にmarkAsFromHistory()を呼び直して「変更なし」状態に戻す
      appState.markAsFromHistory();

      // 保存ボタンの表示を更新
      updateSaveButtonsVisibility();

      // 歩留まり統計データを読み込んだ場合、統計を表示
      if (data.mode === MODE.YIELD_STATS) {
        // restoreYieldStatsTableが既に統計を計算しているが、
        // タイミングの問題で表示されない場合があるため、明示的に呼び出す
        if (window.displayCurrentStatistics) {
          setTimeout(() => {
            const yieldStatsData = appState.getYieldStatsData();
            if (yieldStatsData && (
              (yieldStatsData.yieldRate && yieldStatsData.yieldRate.length >= 2) ||
              (yieldStatsData.beforeWeight && yieldStatsData.beforeWeight.length >= 2) ||
              (yieldStatsData.afterWeight && yieldStatsData.afterWeight.length >= 2)
            )) {
              window.displayCurrentStatistics();
            }
          }, 250);
        }
        // 複数パターン分析の読み込みボタンを更新
        if (window.updateLoadStatsButtons) {
          setTimeout(() => {
            window.updateLoadStatsButtons();
          }, 350);
        }
      }

      showToast('✅ データを読み込みました');
    }, 100);

  } catch (error) {
    console.error('Load error:', error);
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

    // 編集した履歴が現在読み込まれているものと同じ場合、商品名フィールドも更新
    const loadedHistoryId = appState.getLoadedHistoryId();
    if (loadedHistoryId === id) {
      const currentMode = appState.getMode();
      if (currentMode === MODE.FIXED) {
        const fixedProductNameEl = qs(`#${UI_ELEMENTS.FIXED_PRODUCT_NAME}`);
        if (fixedProductNameEl) fixedProductNameEl.value = newName.trim();
      } else if (currentMode === MODE.WEIGHT) {
        const weightProductNameEl = qs(`#${UI_ELEMENTS.WEIGHT_PRODUCT_NAME}`);
        if (weightProductNameEl) weightProductNameEl.value = newName.trim();
      } else if (currentMode === MODE.YIELD_STATS) {
        const yieldStatsProductNameEl = qs(`#${UI_ELEMENTS.YIELD_STATS_PRODUCT_NAME}`);
        if (yieldStatsProductNameEl) yieldStatsProductNameEl.value = newName.trim();
      }
    }

    // 商品名検索フィルタをクリア（商品名が変わった場合、以前の検索条件は無効）
    const searchInput = qs('#historySearch');
    if (searchInput) {
      searchInput.value = '';
    }

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

    // 商品名検索フィルタをクリア（削除後は全体を表示）
    const searchInput = qs('#historySearch');
    if (searchInput) {
      searchInput.value = '';
    }

    await renderHistoryList();
    showToast('✅ 削除しました');
  } catch (error) {
    // エラーメッセージを表示（オンラインチェックのエラーを含む）
    const errorMessage = error.message || '削除に失敗しました';
    showToast(`❌ ${errorMessage}`, 'error');
    console.error('Delete error:', error);
  }
}

/**
 * 保存ダイアログを表示（wrapper）
 */
export async function showSaveDialog() {
  await showSaveDialogBase(showToast);
}

/**
 * 上書き保存（wrapper）
 */
export async function handleOverwriteSave() {
  await handleOverwriteSaveBase(showToast);
}

/**
 * 新規保存（wrapper）
 */
export async function handleNewSave() {
  await handleNewSaveBase(showToast);
}

/**
 * 計算を保存（wrapper）
 */
export async function handleSaveCalculation() {
  await handleSaveCalculationBase(showToast);
}

/**
 * 検索機能
 */
export async function handleSearch() {
  const searchInput = qs('#historySearch');
  if (!searchInput) return;

  const query = searchInput.value.trim();

  // 現在選択されている計算モードと歩留まり入力方法を取得
  const activeBtn = qs('.btn-mode.is-active[data-mode]');
  const modeValue = activeBtn ? activeBtn.dataset.mode : null;
  // 'all'の場合はnullとして扱う（全データ表示）
  const mode = (modeValue === 'all') ? null : modeValue;

  let yieldMethod = null;
  if (mode && mode !== MODE.YIELD_STATS) {
    const methodRadio = document.querySelector('input[name="historyFilterMethod"]:checked');
    yieldMethod = methodRadio ? methodRadio.value : 'calculate';
  }

  if (query === '') {
    // 商品名検索を解除した場合、計算モードと歩留まり入力方法のフィルタは維持
    await renderHistoryList(null, mode, yieldMethod);
  } else {
    const results = await searchHistory(query);
    // 商品名で検索した結果をさらに計算モードと歩留まり入力方法でフィルタ
    await renderHistoryList(results, mode, yieldMethod);
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
 * 履歴メニューの表示/非表示を切り替え
 */
function toggleHistoryMenu() {
  const menu = qs('#historyMenu');
  if (!menu) {
    console.error('履歴メニューが見つかりません');
    return;
  }

  menu.classList.toggle('is-hidden');
  console.log('メニュー表示切り替え:', !menu.classList.contains('is-hidden'));
}

/**
 * 履歴メニューを非表示にする
 */
function hideHistoryMenu() {
  const menu = qs('#historyMenu');
  if (menu) {
    menu.classList.add('is-hidden');
  }
}

/**
 * 履歴機能の初期化
 */
export function initHistoryUI() {
  // 履歴ボタン
  const historyBtn = qs('#historyBtn');
  if (historyBtn) {
    historyBtn.addEventListener('click', () => {
      showHistoryModal();
    });
  }

  const historyBtnWeight = qs('#historyBtnWeight');
  if (historyBtnWeight) {
    historyBtnWeight.addEventListener('click', () => {
      showHistoryModal();
    });
  }

  const historyBtnYieldStats = qs('#historyBtnYieldStats');
  if (historyBtnYieldStats) {
    historyBtnYieldStats.addEventListener('click', () => {
      showHistoryModal();
    });
  }

  // 履歴モーダルを閉じる
  const closeHistoryBtn = qs('#closeHistoryModal');
  if (closeHistoryBtn) {
    addTapListener(closeHistoryBtn, closeHistoryModal);
  }

  // 履歴メニューボタン（⋮）
  const historyMenuBtn = qs('#historyMenuBtn');
  const historyMenu = qs('#historyMenu');
  if (historyMenuBtn && historyMenu) {
    historyMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleHistoryMenu();
    });
    historyMenuBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleHistoryMenu();
    }, { passive: false });

    // メニュー外をクリック/タッチしたら閉じる
    const closeMenuOnOutsideInteraction = (e) => {
      if (!historyMenu.contains(e.target) && e.target !== historyMenuBtn) {
        hideHistoryMenu();
      }
    };

    // クリックイベント（PC、タップ）
    document.addEventListener('click', closeMenuOnOutsideInteraction);

    // タッチイベント（スワイプ操作を含む）
    document.addEventListener('touchstart', closeMenuOnOutsideInteraction);
  }

  // 保存ボタン
  const saveBtns = qsa('.save-btn');
  saveBtns.forEach((saveBtn) => {
    saveBtn.addEventListener('click', () => {
      appState.setSaveDialogMode('normal');
      showSaveDialog();
    });
  });

  // 上書き保存ボタン（クラスベースで全てのボタンに設定）
  const overwriteSaveBtns = qsa('.overwrite-save-btn');
  overwriteSaveBtns.forEach(overwriteSaveBtn => {
    addTapListener(overwriteSaveBtn, handleOverwriteSave);
  });

  // 新規保存ボタン（クラスベースで全てのボタンに設定）
  const newSaveBtns = qsa('.new-save-btn');
  newSaveBtns.forEach(newSaveBtn => {
    addTapListener(newSaveBtn, () => {
      appState.setSaveDialogMode('new');
      showSaveDialog();
    });
  });

  // 保存ダイアログ - 保存
  const confirmSaveBtn = qs('#confirmSaveBtn');
  if (confirmSaveBtn) {
    addTapListener(confirmSaveBtn, () => {
      // 保存モードに応じて適切なハンドラを呼び出す
      // 上書き保存はダイアログを表示しないので、ここではnewとnormalのみ
      if (appState.getSaveDialogMode() === 'new') {
        handleNewSave();
      } else {
        handleSaveCalculation();
      }
    });
  }

  // 保存ダイアログ - キャンセル
  const cancelSaveBtn = qs('#cancelSaveBtn');
  if (cancelSaveBtn) {
    addTapListener(cancelSaveBtn, closeSaveDialog);
  }

  // 検索（selectタグなのでchangeイベントを使用）
  const searchInput = qs('#historySearch');
  if (searchInput) {
    searchInput.addEventListener('change', handleSearch);
  }

  // 選択解除ボタン
  const clearSearchBtn = qs('#clearSearchBtn');
  if (clearSearchBtn) {
    const clearSearchHandler = async () => {
      const searchInput = qs('#historySearch');
      if (searchInput) {
        searchInput.value = ''; // 商品名選択を解除

        // 現在選択されている計算モードと歩留まり入力方法を取得
        const activeBtn = qs('.btn-mode.is-active[data-mode]');
        const modeValue = activeBtn ? activeBtn.dataset.mode : null;
        // 'all'の場合はnullとして扱う（全データ表示）
        const mode = (modeValue === 'all') ? null : modeValue;

        let yieldMethod = null;
        if (mode && mode !== MODE.YIELD_STATS) {
          const methodRadio = document.querySelector('input[name="historyFilterMethod"]:checked');
          yieldMethod = methodRadio ? methodRadio.value : 'calculate';
        }

        // 計算モードと歩留まり入力方法のフィルタを維持して再表示
        await renderHistoryList(null, mode, yieldMethod);
      }
    };
    clearSearchBtn.addEventListener('click', clearSearchHandler);
    clearSearchBtn.addEventListener('touchend', (e) => { e.preventDefault(); clearSearchHandler(); }, { passive: false });
  }

  // エクスポート
  const exportBtn = qs('#exportBtn');
  if (exportBtn) {
    const exportHandler = () => {
      hideHistoryMenu();
      handleExport();
    };
    exportBtn.addEventListener('click', exportHandler);
    exportBtn.addEventListener('touchend', (e) => { e.preventDefault(); exportHandler(); }, { passive: false });
  }

  // インポート
  const importBtn = qs('#importBtn');
  if (importBtn) {
    const importHandler = () => {
      hideHistoryMenu();
      handleImport();
    };
    importBtn.addEventListener('click', importHandler);
    importBtn.addEventListener('touchend', (e) => { e.preventDefault(); importHandler(); }, { passive: false });
  }

  // すべてクリア
  const clearAllBtn = qs('#clearAllBtn');
  if (clearAllBtn) {
    const clearAllHandler = () => {
      hideHistoryMenu();
      handleClearAll();
    };
    clearAllBtn.addEventListener('click', clearAllHandler);
    clearAllBtn.addEventListener('touchend', (e) => { e.preventDefault(); clearAllHandler(); }, { passive: false });
  }
}

/**
 * 履歴フィルタリングUIを初期化
 * @param {string} mode - 現在のモード
 * @param {string} yieldMethod - 現在の計算方法
 */
