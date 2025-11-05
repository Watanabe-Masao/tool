/**
import { logger } from './core/logger.js';
 * 複数パターン分析: プリセット管理モジュール
 *
 * プリセットの作成、編集、削除、適用を管理します。
 */

import { qs, qsa } from './dom-utils.js';
import { showError, showWarning } from './toast.js';

const PRESET_STORAGE_KEY = 'multiPatternPresets';
let currentEditingPreset = null; // 編集中のプリセット
let tempPairs = []; // 一時的な原価・売価ペア配列

/**
 * プリセットをlocalStorageから読み込む
 * @returns {Array} プリセット配列
 */
export function loadPresets() {
  const presets = localStorage.getItem(PRESET_STORAGE_KEY);
  if (!presets) return [];

  try {
    const parsedPresets = JSON.parse(presets);

    // 古いデータとの互換性のため、patternsプロパティがない場合は空配列を設定
    return parsedPresets.map(preset => ({
      ...preset,
      patterns: Array.isArray(preset.patterns) ? preset.patterns : []
    }));
  } catch (error) {
    logger.error('Failed to parse presets from localStorage:', error);
    // 破損したデータをクリア
    localStorage.removeItem(PRESET_STORAGE_KEY);
    return [];
  }
}

/**
 * プリセットをlocalStorageに保存
 * @param {Array} presets - プリセット配列
 */
function savePresetsData(presets) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presets));
}

/**
 * モーダルを開く（一覧表示）
 */
export function openPresetModal() {
  renderPresetList();
  showPresetList();

  const modal = qs('#presetModal');
  if (modal) {
    modal.classList.add('is-open');
  }
}

/**
 * モーダルを閉じる
 */
export function closePresetModal() {
  qs('#presetModal').classList.remove('is-open');
  currentEditingPreset = null;
  tempPairs = [];
}

/**
 * プリセット一覧を表示
 */
function showPresetList() {
  const editor = qs('.preset-editor');
  const listSection = qs('.preset-list-section');

  if (editor) editor.style.display = 'none';
  if (listSection) listSection.style.display = 'block';
}

/**
 * プリセット編集画面を表示
 */
function showPresetEditor() {
  const editor = qs('.preset-editor');
  const listSection = qs('.preset-list-section');

  if (editor) editor.style.display = 'block';
  if (listSection) listSection.style.display = 'none';
}

/**
 * 新規プリセット作成画面を開く
 */
function openNewPresetEditor() {
  currentEditingPreset = null;
  tempPairs = [];

  const editorTitle = qs('#presetEditorTitle');
  if (editorTitle) {
    editorTitle.textContent = '新規プリセット作成';
  }

  const presetName = qs('#presetName');
  if (presetName) {
    presetName.value = '';
  }

  const tempUnitCost = qs('#tempUnitCost');
  if (tempUnitCost) {
    tempUnitCost.value = '';
  }

  const tempUnitPrice = qs('#tempUnitPrice');
  if (tempUnitPrice) {
    tempUnitPrice.value = '';
  }

  renderTempPairs();
  showPresetEditor();
}

/**
 * 一時ペアをテーブルに表示
 */
function renderTempPairs() {
  const tbody = qs('#presetPairsTableBody');
  if (!tbody) return;

  if (tempPairs.length === 0) {
    tbody.innerHTML = '<tr class="empty-message"><td colspan="3" style="text-align: center; color: #999; padding: 2em;">原価・売価を追加してください</td></tr>';
    return;
  }

  // 売価基準で降順ソート
  const sorted = [...tempPairs].sort((a, b) => b.unitPrice - a.unitPrice);

  tbody.innerHTML = sorted.map((pair, index) => `
    <tr>
      <td>${pair.unitCost}</td>
      <td>${pair.unitPrice}</td>
      <td><button type="button" class="btn-remove-pair" data-pair-index="${index}">削除</button></td>
    </tr>
  `).join('');
}

/**
 * 原価・売価ペアを追加
 */
function addPairToTemp() {
  const unitCost = parseFloat(qs('#tempUnitCost')?.value);
  const unitPrice = parseFloat(qs('#tempUnitPrice')?.value);

  if (!Number.isFinite(unitCost) || !Number.isFinite(unitPrice) || unitCost <= 0 || unitPrice <= 0) {
    showWarning('原価と売価を正しく入力してください。');
    return;
  }

  // 原価が売価を上回っている場合のチェック
  if (unitCost > unitPrice) {
    showError('原価が売価を上回っています。\n通常、売価は原価よりも高く設定されます。\n入力内容を確認してください。');
    return;
  }

  tempPairs.push({ unitCost, unitPrice });
  qs('#tempUnitCost').value = '';
  qs('#tempUnitPrice').value = '';
  renderTempPairs();
}

/**
 * 一時ペアを削除
 * @param {number} index - 削除するペアのインデックス
 */
function removeTempPair(index) {
  // ソート済みの配列から実際のインデックスを見つける
  const sorted = [...tempPairs].sort((a, b) => b.unitPrice - a.unitPrice);

  // 境界チェックを追加
  if (index < 0 || index >= sorted.length) {
    logger.error('Invalid index:', index);
    return;
  }

  const pairToRemove = sorted[index];
  const realIndex = tempPairs.findIndex(p => p.unitCost === pairToRemove.unitCost && p.unitPrice === pairToRemove.unitPrice);

  if (realIndex !== -1) {
    tempPairs.splice(realIndex, 1);
  }
  renderTempPairs();
}

/**
 * プリセットを保存
 */
function savePresetFromModal() {
  const name = qs('#presetName')?.value.trim();

  if (!name) {
    showWarning('プリセット名を入力してください。');
    return;
  }

  if (tempPairs.length === 0) {
    showWarning('少なくとも1つの原価・売価ペアを追加してください。');
    return;
  }

  const presets = loadPresets();
  const patterns = [...tempPairs].sort((a, b) => b.unitPrice - a.unitPrice);

  if (currentEditingPreset) {
    // 編集モード
    const index = presets.findIndex(p => p.id === currentEditingPreset.id);
    if (index !== -1) {
      presets[index] = { id: currentEditingPreset.id, name, patterns };
    }
  } else {
    // 新規追加
    const newPreset = {
      id: Date.now(),
      name,
      patterns
    };
    presets.push(newPreset);
  }

  savePresetsData(presets);
  renderPresetList();
  showPresetList();
}

/**
 * プリセット一覧を表示
 */
function renderPresetList() {
  const presetList = qs('#presetList');
  if (!presetList) return;

  const presets = loadPresets();

  if (presets.length === 0) {
    presetList.innerHTML = '<p style="color: #999; text-align: center; padding: 2em;">保存されたプリセットはありません</p>';
    return;
  }

  presetList.innerHTML = presets.map(preset => {
    // patternsが存在しない場合は空配列として扱う（データの互換性対策）
    const patterns = Array.isArray(preset.patterns) ? preset.patterns : [];

    const patternsDisplay = patterns
      .slice(0, 3)
      .map(p => `<span class="preset-pattern-badge">${p.unitCost || 0}円→${p.unitPrice || 0}円</span>`)
      .join('');
    const moreText = patterns.length > 3 ? ` <span style="color: #999;">他${patterns.length - 3}件</span>` : '';

    return `
      <div class="preset-item" data-preset-id="${preset.id}">
        <input type="checkbox" class="preset-checkbox" data-preset-id="${preset.id}">
        <div class="preset-info">
          <div class="preset-name">${preset.name || '名称未設定'}</div>
          <div class="preset-item-patterns">${patternsDisplay}${moreText}</div>
        </div>
        <button class="preset-btn preset-btn-edit" data-preset-id="${preset.id}">編集</button>
        <button class="preset-btn preset-btn-delete" data-preset-id="${preset.id}">削除</button>
      </div>
    `;
  }).join('');
}

/**
 * プリセットを編集
 * @param {number} id - プリセットID
 */
function editPresetFromModal(id) {
  const presets = loadPresets();
  const preset = presets.find(p => p.id === id);

  if (!preset) return;

  currentEditingPreset = preset;
  // preset.patternsが存在しない場合は空配列として扱う
  tempPairs = Array.isArray(preset.patterns) ? [...preset.patterns] : [];
  qs('#presetEditorTitle').textContent = 'プリセット編集';
  qs('#presetName').value = preset.name;
  qs('#tempUnitCost').value = '';
  qs('#tempUnitPrice').value = '';
  renderTempPairs();

  // 編集画面を表示
  showPresetEditor();
}

/**
 * プリセットを削除
 * @param {number} id - プリセットID
 */
function deletePresetFromModal(id) {
  if (!confirm('このプリセットを削除してもよろしいですか？')) return;

  const presets = loadPresets();
  const filtered = presets.filter(p => p.id !== id);
  savePresetsData(filtered);
  renderPresetList();
}

/**
 * テーブル内の空欄行を削除する
 */
function removeEmptyRows() {
  const tableBody = qs('#multiPatternTableBody');
  if (!tableBody) return;

  const rows = Array.from(tableBody.querySelectorAll('tr'));

  rows.forEach(row => {
    const unitCostInput = row.querySelector('.pattern-unit-cost');
    const unitPriceInput = row.querySelector('.pattern-unit-price');

    // 両方の入力が空欄の場合、行を削除
    if (unitCostInput && unitPriceInput) {
      const costValue = unitCostInput.value.trim();
      const priceValue = unitPriceInput.value.trim();

      if (costValue === '' && priceValue === '') {
        row.remove();
      }
    }
  });

  // 行がすべて削除された場合、最低1行は残す
  if (tableBody.querySelectorAll('tr').length === 0) {
    const addBtn = qs('#addPatternBtn');
    if (addBtn) {
      addBtn.click();
    }
  }
}

/**
 * 選択したプリセットをパターンテーブルに追加
 */
function addSelectedPresetsToTable() {
  const checkedBoxes = qsa('.preset-checkbox:checked');

  if (checkedBoxes.length === 0) {
    showWarning('追加するプリセットを選択してください。');
    return;
  }

  const presets = loadPresets();
  const tableBody = qs('#multiPatternTableBody');
  if (!tableBody) return;

  // プリセット追加前に空欄行を削除
  removeEmptyRows();

  // 全てのパターンを配列にまとめる
  const allPatterns = [];
  checkedBoxes.forEach(checkbox => {
    const presetId = parseInt(checkbox.dataset.presetId);
    const preset = presets.find(p => p.id === presetId);
    if (preset && Array.isArray(preset.patterns)) {
      allPatterns.push(...preset.patterns);
    }
  });

  // 既存の空欄行を取得
  const existingRows = Array.from(tableBody.querySelectorAll('tr'));
  const firstEmptyRow = existingRows.find(row => {
    const costInput = row.querySelector('.pattern-unit-cost');
    const priceInput = row.querySelector('.pattern-unit-price');
    return costInput && priceInput && costInput.value.trim() === '' && priceInput.value.trim() === '';
  });

  // パターンを追加
  allPatterns.forEach((pattern, index) => {
    let targetRow;

    if (index === 0 && firstEmptyRow) {
      // 最初のパターンで空行が存在する場合、その行を使う
      targetRow = firstEmptyRow;
    } else {
      // それ以外は新しい行を追加
      const addBtn = qs('#addPatternBtn');
      if (addBtn) {
        addBtn.click();
        const rows = tableBody.querySelectorAll('tr');
        targetRow = rows[rows.length - 1];
      }
    }

    // 行に値を設定
    if (targetRow) {
      const unitCostInput = targetRow.querySelector('.pattern-unit-cost');
      const unitPriceInput = targetRow.querySelector('.pattern-unit-price');

      if (unitCostInput) {
        unitCostInput.value = pattern.unitCost;
        unitCostInput.dispatchEvent(new Event('input'));
      }
      if (unitPriceInput) {
        unitPriceInput.value = pattern.unitPrice;
        unitPriceInput.dispatchEvent(new Event('input'));
      }
    }
  });

  // パターン番号を更新（念のため）
  if (window.multiPatternUI && typeof window.multiPatternUI.updatePatternNumbers === 'function') {
    window.multiPatternUI.updatePatternNumbers();
  }

  // モーダルを閉じる
  closePresetModal();

  // チェックを解除
  qsa('.preset-checkbox').forEach(cb => cb.checked = false);
}

/**
 * プリセット管理のイベントリスナーを初期化
 */
export function setupPresetEventListeners() {
  // モーダルを開くボタン（複数のIDに対応）
  const openModalBtn = qs('#openPresetModalBtn') || qs('#showPresetManagerBtn');
  if (openModalBtn) {
    openModalBtn.addEventListener('click', openPresetModal);
  }

  // モーダルを閉じるボタン
  const closeBtn = qs('#closePresetModalBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closePresetModal);
  }

  // バックドロップをクリックで閉じる
  const modal = qs('#presetModal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closePresetModal();
      }
    });
  }

  // 新規作成ボタン
  const newBtn = qs('#newPresetBtn');
  if (newBtn) {
    newBtn.addEventListener('click', openNewPresetEditor);
  }

  // 一覧に戻るボタン
  const backBtn = qs('#backToListBtn');
  if (backBtn) {
    backBtn.addEventListener('click', showPresetList);
  }

  // ペアを追加ボタン
  const addPairBtn = qs('#addPairBtn');
  if (addPairBtn) {
    addPairBtn.addEventListener('click', addPairToTemp);
  }

  // Enter キーでペアを追加
  const tempUnitCost = qs('#tempUnitCost');
  const tempUnitPrice = qs('#tempUnitPrice');
  if (tempUnitCost) {
    tempUnitCost.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addPairToTemp();
      }
    });
  }
  if (tempUnitPrice) {
    tempUnitPrice.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addPairToTemp();
      }
    });
  }

  // プリセットを保存ボタン
  const saveBtn = qs('#savePresetBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', savePresetFromModal);
  }

  // プリセットリストのイベント（委任）
  const presetList = qs('#presetList');
  if (presetList) {
    const handlePresetListEvent = (e) => {
      const target = e.target;

      // 編集ボタン
      if (target.classList.contains('preset-btn-edit')) {
        const id = parseInt(target.dataset.presetId);
        editPresetFromModal(id);
        return;
      }

      // 削除ボタン
      if (target.classList.contains('preset-btn-delete')) {
        const id = parseInt(target.dataset.presetId);
        deletePresetFromModal(id);
        return;
      }
    };

    // clickイベントのみを使用（タッチデバイスでも正しく動作）
    presetList.addEventListener('click', handlePresetListEvent);
  }

  // ペアテーブルのイベント（委任）
  const pairsTableBody = qs('#presetPairsTableBody');
  if (pairsTableBody) {
    const handlePairsTableEvent = (e) => {
      if (e.target.classList.contains('btn-remove-pair')) {
        const index = parseInt(e.target.dataset.pairIndex);
        removeTempPair(index);
      }
    };

    // clickイベントのみを使用（タッチデバイスでも正しく動作）
    pairsTableBody.addEventListener('click', handlePairsTableEvent);
  }

  // 選択したプリセットを追加ボタン
  const addSelectedBtn = qs('#addSelectedPresetsBtn');
  if (addSelectedBtn) {
    addSelectedBtn.addEventListener('click', addSelectedPresetsToTable);
  }
}
