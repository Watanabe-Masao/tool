/**
 * 歩留まり統計: ボタン管理モジュール
 *
 * 複数パターン分析への読み込みボタンの表示・制御を担当します。
 * タッチデバイスとマウスデバイスの両方に対応したイベント処理を提供します。
 */

import { logger } from '../core/logger.js';
import { qs, qsa, toFixed } from '../dom-utils.js';
import { appState } from '../state.js';
import { getRecommendedValue } from './recommended.js';

/**
 * ボタンにタッチとクリックのイベントハンドラーを設定
 * タッチデバイスとマウスデバイスの両方に対応
 * @param {HTMLElement} button - ボタン要素
 * @param {Function} handler - クリック/タッチ時のハンドラー関数
 */
export function attachButtonHandler(button, handler) {
  let touchStarted = false;

  button.addEventListener('touchstart', () => {
    touchStarted = true;
  }, { passive: true });

  button.addEventListener('touchend', (e) => {
    if (touchStarted) {
      e.preventDefault();
      touchStarted = false;
      handler();
    }
  }, { passive: false });

  button.addEventListener('click', () => {
    if (!touchStarted) {
      handler();
    }
  });
}

/**
 * 歩留まり統計から読み込むボタンの状態を更新
 * ボタンのイベントハンドラーは動的に生成時に直接設定されます。
 */
export function updateLoadStatsButtons() {
  const loadStatsButtons = qs('#loadStatsButtons');
  const loadStatsNoData = qs('#loadStatsNoData');
  const loadMeanValueDisplay = qs('#loadMeanValueDisplay');
  const loadMedianValueDisplay = qs('#loadMedianValueDisplay');
  const loadRecommendedValueDisplay = qs('#loadRecommendedValueDisplay');
  const generateSigmaPatternsSection = qs('#generateSigmaPatternsSection');
  const loadStatsTypeSelect = qs('#loadStatsTypeSelect');

  if (!loadStatsButtons || !loadStatsNoData || !loadStatsTypeSelect) {
    return;
  }

  // 現在の複数パターン分析のモードを取得
  const currentMode = document.querySelector('input[name="yieldMethodMultiPattern"]:checked')?.value || 'calculate';

  // 現在選択されている値を保存
  const previousValue = loadStatsTypeSelect.value;

  // モードに応じてプルダウンの選択肢を更新
  loadStatsTypeSelect.innerHTML = '';
  if (currentMode === 'direct') {
    // 歩留まり率直接入力モード：歩留まり率と加工前重量のみ
    loadStatsTypeSelect.innerHTML = `
      <option value="bulk">一括取り込み（推奨値をステップ1に転記）</option>
      <option value="yieldRate">歩留まり率（%）</option>
      <option value="beforeWeight">加工前重量（g）</option>
    `;
  } else {
    // 重量から計算モード：加工前重量と加工後重量のみ
    loadStatsTypeSelect.innerHTML = `
      <option value="bulk">一括取り込み（推奨値をステップ1に転記）</option>
      <option value="beforeWeight">加工前重量（g）</option>
      <option value="afterWeight">加工後重量（g）</option>
    `;
  }

  // 以前の選択値が新しいオプションに存在すれば復元
  if (previousValue && Array.from(loadStatsTypeSelect.options).some(opt => opt.value === previousValue)) {
    loadStatsTypeSelect.value = previousValue;
  }

  // 複数パターン分析画面のプルダウンで選択された統計タイプを取得
  const selectedStatsType = loadStatsTypeSelect.value;

  // 一括取り込みモードの場合
  if (selectedStatsType === 'bulk') {
    const yieldRateStats = appState.getCalculatedStats('yieldRate');
    const beforeWeightStats = appState.getCalculatedStats('beforeWeight');
    const afterWeightStats = appState.getCalculatedStats('afterWeight');

    // サンプルサイズの妥当性をチェック
    const yieldRateValidation = appState.getSampleSizeValidation('yieldRate');
    const beforeWeightValidation = appState.getSampleSizeValidation('beforeWeight');
    const afterWeightValidation = appState.getSampleSizeValidation('afterWeight');

    // 歩留まり率の統計データが必須かつサンプルサイズが妥当である必要がある
    if (!yieldRateStats || yieldRateStats.count < 2 || (yieldRateValidation && !yieldRateValidation.isValid)) {
      loadStatsButtons.classList.add('is-hidden');
      loadStatsNoData.classList.remove('is-hidden');

      // サンプルサイズ不十分の場合は専用メッセージを表示
      if (yieldRateStats && yieldRateValidation && !yieldRateValidation.isValid) {
        loadStatsNoData.innerHTML = `
          <div class="no-data-message" style="padding: 1em; text-align: center; color: #dc3545;">
            <p style="margin: 0 0 0.5em 0; font-weight: bold;">⚠️ サンプルサイズが不十分です</p>
            <p style="margin: 0; font-size: 0.9em;">実際のサンプル数: ${yieldRateValidation.actualSize}、必要なサンプル数: ${yieldRateValidation.requiredSize}</p>
            <p style="margin: 0.5em 0 0 0; font-size: 0.9em;">より多くのデータを収集してから推奨値を使用してください。</p>
          </div>`;
      } else {
        loadStatsNoData.innerHTML = '<p style="text-align: center; padding: 1em; color: #6c757d;">歩留まり統計のデータがありません。<br>先に歩留まり統計で計算を実行してください。</p>';
      }

      if (generateSigmaPatternsSection) {
        generateSigmaPatternsSection.classList.add('is-hidden');
      }
      return;
    }

    // 推奨値を取得（妥当性チェック済み）
    const yieldRateRecommended = getRecommendedValue(yieldRateStats);
    const beforeWeightRecommended = beforeWeightStats && beforeWeightStats.count >= 2
      && (!beforeWeightValidation || beforeWeightValidation.isValid)
      ? getRecommendedValue(beforeWeightStats)
      : null;
    const afterWeightRecommended = afterWeightStats && afterWeightStats.count >= 2
      && (!afterWeightValidation || afterWeightValidation.isValid)
      ? getRecommendedValue(afterWeightStats)
      : null;

    // テーブル全体を書き換え（2列レイアウト）
    const table = loadStatsButtons.querySelector('table');
    if (table) {
      let rows = '';

      // モードに応じて表示する項目を変更
      if (currentMode === 'direct') {
        // 歩留まり率直接入力モード
        rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">歩留まり率</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${yieldRateRecommended ? toFixed(yieldRateRecommended.value, 2) + '%' : '-'}</td>
          </tr>`;
        if (beforeWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工前重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(beforeWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
      } else {
        // 重量から計算モード
        if (beforeWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工前重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(beforeWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
        if (afterWeightRecommended) {
          rows += `
          <tr>
            <td class="stats-label" style="width: 50%; text-align: left; padding: 0.6em;">加工後重量</td>
            <td class="stats-value" style="width: 50%; text-align: right; padding: 0.6em; font-weight: bold;">${toFixed(afterWeightRecommended.value, 2)}g</td>
          </tr>`;
        }
      }

      table.innerHTML = `
        <thead>
          <tr>
            <th style="text-align: left; padding: 0.6em;">項目</th>
            <th style="text-align: right; padding: 0.6em;">推奨値</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>`;
    }

    // ボタンを表示、メッセージを非表示
    loadStatsButtons.classList.remove('is-hidden');
    loadStatsNoData.classList.add('is-hidden');

    // σパターン生成セクションを非表示（一括取り込みモードでは不要）
    if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }

    // 一括取り込みボタンをテーブルの外に配置
    // 既存のボタンコンテナを探すか、新規作成
    let bulkImportBtnContainer = qs('#bulkImportBtnContainer');
    if (!bulkImportBtnContainer) {
      bulkImportBtnContainer = document.createElement('div');
      bulkImportBtnContainer.id = 'bulkImportBtnContainer';
      bulkImportBtnContainer.style.cssText = 'text-align: center; margin-top: 0.8em;';
      loadStatsButtons.appendChild(bulkImportBtnContainer);
    }

    // ボタンを直接イベントハンドラーと共に作成
    bulkImportBtnContainer.innerHTML = '';
    const bulkImportBtn = document.createElement('button');
    bulkImportBtn.type = 'button';
    bulkImportBtn.id = 'bulkImportBtn';
    bulkImportBtn.className = 'btn btn-recommended btn-sm';
    bulkImportBtn.style.cssText = 'font-size: 0.9em; padding: 0.5em 1.2em;';
    bulkImportBtn.textContent = ' 推奨値を一括転記';

    // イベントハンドラを設定
    attachButtonHandler(bulkImportBtn, () => {
      if (window.loadAllStatsToMultiPattern) {
        window.loadAllStatsToMultiPattern();
      } else {
        logger.error('[ERROR] loadAllStatsToMultiPattern関数が見つかりません');
      }
    });

    bulkImportBtnContainer.appendChild(bulkImportBtn);

    return;
  }

  // 通常モード（個別の統計タイプ）
  const stats = appState.getCalculatedStats(selectedStatsType);

  // 一括取り込みボタンコンテナを削除（通常モードでは不要）
  const bulkImportBtnContainer = qs('#bulkImportBtnContainer');
  if (bulkImportBtnContainer) {
    bulkImportBtnContainer.remove();
  }

  // サンプルサイズの妥当性をチェック
  const validation = appState.getSampleSizeValidation(selectedStatsType);

  if (stats && stats.count >= 2 && (!validation || validation.isValid)) {
    // 推奨値を取得
    const recommended = getRecommendedValue(stats);

    // 単位を取得
    const unit = selectedStatsType === 'yieldRate' ? '%' : 'g';

    // テーブル全体を通常表示（3列）に戻す
    const table = loadStatsButtons.querySelector('table');
    if (table) {
      // テーブルのthead/tbodyを作成
      table.innerHTML = `
        <thead>
          <tr>
            <th>統計種別</th>
            <th>値</th>
            <th>読み込み</th>
          </tr>
        </thead>
        <tbody></tbody>`;

      const tbody = table.querySelector('tbody');

      // 平均値の行を作成
      const meanRow = tbody.insertRow();
      meanRow.innerHTML = `
        <td class="stats-label">平均値</td>
        <td class="stats-value">${toFixed(stats.mean, 2)}${unit}</td>
        <td class="stats-action"></td>`;
      const meanBtn = document.createElement('button');
      meanBtn.type = 'button';
      meanBtn.className = 'btn btn-primary btn-sm';
      meanBtn.textContent = '読み込む';
      attachButtonHandler(meanBtn, () => {
        if (window.loadStatsValueToMultiPattern) {
          window.loadStatsValueToMultiPattern(stats.mean, selectedStatsType, false);
          window.showTransferNotification('平均値を転記しました');
          window.focusFirstPatternInput();
        }
      });
      meanRow.cells[2].appendChild(meanBtn);

      // 中央値の行を作成
      const medianRow = tbody.insertRow();
      medianRow.innerHTML = `
        <td class="stats-label">中央値</td>
        <td class="stats-value">${toFixed(stats.median, 2)}${unit}</td>
        <td class="stats-action"></td>`;
      const medianBtn = document.createElement('button');
      medianBtn.type = 'button';
      medianBtn.className = 'btn btn-secondary btn-sm';
      medianBtn.textContent = '読み込む';
      attachButtonHandler(medianBtn, () => {
        if (window.loadStatsValueToMultiPattern) {
          window.loadStatsValueToMultiPattern(stats.median, selectedStatsType, false);
          window.showTransferNotification('中央値を転記しました');
          window.focusFirstPatternInput();
        }
      });
      medianRow.cells[2].appendChild(medianBtn);

      // 推奨値の行を作成
      if (recommended) {
        const recommendedRow = tbody.insertRow();
        recommendedRow.className = 'recommended-row';
        recommendedRow.innerHTML = `
          <td class="stats-label">📌 推奨値</td>
          <td class="stats-value">${toFixed(recommended.value, 2)}${unit}</td>
          <td class="stats-action"></td>`;
        const recommendedBtn = document.createElement('button');
        recommendedBtn.type = 'button';
        recommendedBtn.className = 'btn btn-recommended btn-sm';
        recommendedBtn.textContent = '読み込む';
        attachButtonHandler(recommendedBtn, () => {
          if (window.loadStatsValueToMultiPattern) {
            window.loadStatsValueToMultiPattern(recommended.value, selectedStatsType, false);
            window.showTransferNotification('推奨値を転記しました');
            window.focusFirstPatternInput();
          }
        });
        recommendedRow.cells[2].appendChild(recommendedBtn);
      }
    }

    // ボタンを表示、メッセージを非表示
    loadStatsButtons.classList.remove('is-hidden');
    loadStatsNoData.classList.add('is-hidden');

    // σパターン生成セクションを表示（歩留まり率の場合のみ）
    if (generateSigmaPatternsSection && selectedStatsType === 'yieldRate') {
      generateSigmaPatternsSection.classList.remove('is-hidden');
    } else if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }
  } else {
    // データがない、またはサンプルサイズが不十分な場合、メッセージを表示
    loadStatsButtons.classList.add('is-hidden');
    loadStatsNoData.classList.remove('is-hidden');

    // サンプルサイズ不十分の場合は専用メッセージ
    if (stats && stats.count >= 2 && validation && !validation.isValid) {
      loadStatsNoData.innerHTML = `
        <div class="no-data-message" style="padding: 1em; text-align: center; color: #dc3545;">
          <p style="margin: 0 0 0.5em 0; font-weight: bold;">⚠️ サンプルサイズが不十分です</p>
          <p style="margin: 0; font-size: 0.9em;">実際のサンプル数: ${validation.actualSize}、必要なサンプル数: ${validation.requiredSize}</p>
          <p style="margin: 0.5em 0 0 0; font-size: 0.9em;">より多くのデータを収集してから推奨値を使用してください。</p>
        </div>`;
    } else {
      loadStatsNoData.innerHTML = '<p style="text-align: center; padding: 1em; color: #6c757d;">歩留まり統計のデータがありません。<br>先に歩留まり統計で計算を実行してください。</p>';
    }

    // σパターン生成セクションを非表示
    if (generateSigmaPatternsSection) {
      generateSigmaPatternsSection.classList.add('is-hidden');
    }
  }
}
