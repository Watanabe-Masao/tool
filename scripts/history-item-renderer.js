/**
 * 履歴アイテムのHTML生成
 */

import { MODE } from './constants.js';

/**
 * 履歴を商品名とカテゴリーでグループ化
 * @param {Array} history - 履歴データ配列
 * @returns {Array} グループ化された配列
 */
export function groupHistoryByProduct(history) {
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
export function createHistoryGroupHTML(group) {
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
export function createHistoryItemHTML(item, isFirst = true) {
  const date = new Date(item.timestamp);
  const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  const yieldMethod = item.input?.yieldMethod;
  const modeIcon = getModeIcon(item.mode, yieldMethod);

  // 歩留まり統計モードの場合は異なる表示
  if (item.mode === MODE.YIELD_STATS) {
    const productName = item.input?.productName || '商品名なし';
    const tableDataCount = item.input?.tableData?.length || 0;

    // 統計データを取得
    const avgYieldRate = item.result?.avgYieldRate;
    const medianYieldRate = item.result?.medianYieldRate;
    const stdDevYieldRate = item.result?.stdDevYieldRate;
    const minYieldRate = item.result?.minYieldRate;
    const maxYieldRate = item.result?.maxYieldRate;

    // 同期ステータスを取得（仮実装）
    const syncStatus = getSyncStatus(item);

    return `
      <div class="history-item ${isFirst ? 'active' : ''}" data-id="${item.id}">
        <div class="history-item-header">
          <span class="sync-status" title="${syncStatus.tooltip}">${syncStatus.icon}</span>
          <div class="history-item-title">
            <span class="history-item-mode-label">${modeIcon}</span>
            <span class="history-item-name">${escapeHTML(productName)}</span>
          </div>
        </div>
        <div class="history-item-stats">
          <div class="history-stats-row">
            <span class="history-stat">データ数: <strong>${tableDataCount}件</strong></span>
            <span class="history-stat">平均歩留まり率: <strong>${typeof avgYieldRate === 'number' ? avgYieldRate.toFixed(1) : '-'}%</strong></span>
          </div>
          <div class="history-stats-row">
            <span class="history-stat">中央値: <strong>${typeof medianYieldRate === 'number' ? medianYieldRate.toFixed(1) : '-'}%</strong></span>
            <span class="history-stat">標準偏差: <strong>${typeof stdDevYieldRate === 'number' ? stdDevYieldRate.toFixed(1) : '-'}%</strong></span>
          </div>
          <div class="history-stats-row">
            <span class="history-stat">範囲: <strong>${typeof minYieldRate === 'number' ? minYieldRate.toFixed(1) : '-'}% ~ ${typeof maxYieldRate === 'number' ? maxYieldRate.toFixed(1) : '-'}%</strong></span>
          </div>
        </div>
        <div class="history-item-date">${dateStr}</div>
        <div class="history-item-actions">
          <button type="button" class="btn-small btn-load" data-id="${item.id}">📂 読込</button>
          <div class="history-item-actions-secondary">
            <button type="button" class="btn-small btn-edit" data-id="${item.id}">✏️ 編集</button>
            <button type="button" class="btn-small btn-delete" data-id="${item.id}">🗑️ 削除</button>
          </div>
        </div>
      </div>
    `;
  }

  // 定額売価・計量売価モードの表示
  const isFixedMode = item.mode === 'fixed';
  const costLabel = isFixedMode ? '1個あたりの原価' : '1箱あたりの原価';
  const priceLabel = isFixedMode ? '1個あたりの売価' : '1箱あたりの売価';

  // 原価・売価を取得
  const cost = isFixedMode ? item.input?.unitCost : item.input?.boxCost;
  const price = isFixedMode ? item.input?.unitPrice : item.input?.boxPrice;

  // 加工前値入率を取得
  const beforeMarkup = item.result?.beforeMarkup ?? item.result?.bm ?? item.result?.markup;

  // 加工後値入率を取得
  const afterMarkup = item.result?.afterMarkup ?? item.result?.am;

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

  // 同期ステータスを取得
  const syncStatus = getSyncStatus(item);

  return `
    <div class="history-item ${isFirst ? 'active' : ''}" data-id="${item.id}">
      <div class="history-item-header">
        <span class="sync-status" title="${syncStatus.tooltip}">${syncStatus.icon}</span>
        <div class="history-item-title">
          <span class="history-item-mode-label">${modeIcon}</span>
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
        <div class="history-item-actions-secondary">
          <button class="btn-small btn-edit" data-id="${item.id}">✏️ 編集</button>
          <button class="btn-small btn-delete" data-id="${item.id}">🗑️ 削除</button>
        </div>
      </div>
    </div>
  `;
}

/**
 * 同期ステータスを取得
 * @param {Object} item - 履歴データ
 * @returns {Object} - {icon: string, tooltip: string}
 */
function getSyncStatus(item) {
  // Firestoreにデータが保存されているか確認
  const hasFirestoreId = !!item.firestoreId;
  const hasUuid = !!item.uuid;

  // 更新時刻をチェック
  const updatedAt = item.updatedAt;
  const now = Date.now();
  const isRecent = updatedAt && (now - updatedAt < 5000); // 5秒以内の更新

  if (hasFirestoreId && hasUuid) {
    // Firestoreと同期済み
    return {
      icon: '🟢',
      tooltip: '同期済み'
    };
  } else if (isRecent) {
    // 最近更新されたが、まだ同期されていない
    return {
      icon: '🟡',
      tooltip: '更新確認中'
    };
  } else if (!hasFirestoreId) {
    // Firestoreに保存されていない（ローカルのみ）
    return {
      icon: '🔴',
      tooltip: '未同期'
    };
  } else {
    // その他のエラー状態
    return {
      icon: '🔴',
      tooltip: 'エラー'
    };
  }
}

/**
 * モードと計算方法に応じたラベルを返す
 * @param {string} mode
 * @param {string} yieldMethod
 * @returns {string}
 */
export function getModeIcon(mode, yieldMethod = null) {
  if (mode === MODE.FIXED) {
    if (yieldMethod === 'direct') return '定額（直接）';
    return '定額（計算）';
  }
  if (mode === MODE.WEIGHT) {
    if (yieldMethod === 'direct') return '計量（直接）';
    return '計量（計算）';
  }
  if (mode === MODE.YIELD_STATS) return '統計';
  return '不明';
}

/**
 * HTMLエスケープ
 * @param {string} str
 * @returns {string}
 */
export function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
