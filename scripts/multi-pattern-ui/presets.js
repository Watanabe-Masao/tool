/**
 * プリセット・一括操作モジュール
 * Preset management and bulk operations (save, load, delete, import/export, adjustments)
 */

import { toFixed, calcYield, per100FromPerUnit, afterCostPer100, markup, priceFromMarkup, isPositive } from '../calculation.js';
import { showWarning } from '../toast.js';

// 定数
const CSS_HIDDEN = 'is-hidden';
const INITIAL_PATTERN_COUNT = 3;

// DOM要素参照（core.jsから設定される）
let elements = {};

// 現在のモード参照（core.jsから設定される）
let getCurrentYieldMethod = null;

// パターン入力ハンドラー（patterns.jsから設定される）
let handlePatternInputFunc = null;

// パターン追加関数（patterns.jsから設定される）
let addPatternFunc = null;

// パターン管理関数（patterns.jsから設定される）
let clearPatternsFunc = null;
let resetPatternIdCounterFunc = null;

/**
 * DOM要素参照を設定
 * @param {Object} elementsRef - DOM要素の参照
 */
export function setElements(elementsRef) {
  elements = elementsRef;
}

/**
 * 現在のモード取得関数を設定
 * @param {Function} func - 現在のモードを取得する関数
 */
export function setGetCurrentYieldMethod(func) {
  getCurrentYieldMethod = func;
}

/**
 * パターン入力ハンドラーを設定
 * @param {Function} func - パターン入力を処理する関数
 */
export function setHandlePatternInputFunc(func) {
  handlePatternInputFunc = func;
}

/**
 * パターン追加関数を設定
 * @param {Function} func - パターンを追加する関数
 */
export function setAddPatternFunc(func) {
  addPatternFunc = func;
}

/**
 * パターン管理関数を設定
 * @param {Function} clearFunc - パターンをクリアする関数
 * @param {Function} resetFunc - パターンIDカウンターをリセットする関数
 */
export function setPatternManagementFuncs(clearFunc, resetFunc) {
  clearPatternsFunc = clearFunc;
  resetPatternIdCounterFunc = resetFunc;
}

/**
 * 要素から数値を取得
 * @param {HTMLElement} element - HTML要素
 * @returns {number|null} 数値またはnull
 */
function getNumValue(element) {
  if (!element) {return null;}
  const v = parseFloat(element.value);
  return Number.isFinite(v) ? v : null;
}

/**
 * 損益分岐点を一括計算して設定
 * 各パターンの加工後設定売価に、加工前値入率を維持する売価を設定
 */
export function calculateBreakEvenPrices() {
  // ボタンを無効化してローディング表示
  const btn = elements.breakEvenBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 計算中...';
  }

  // 現在のモードに応じて歩留まり率と加工前重量を取得
  let yr, bw;

  const currentYieldMethod = getCurrentYieldMethod ? getCurrentYieldMethod() : 'calculate';

  if (currentYieldMethod === 'calculate') {
    const beforeWeight = getNumValue(elements.beforeWeightCalc);
    const afterWeight = getNumValue(elements.afterWeightCalc);

    if (!isPositive(beforeWeight) || !isPositive(afterWeight)) {
      showWarning('加工前重量と加工後重量を入力してください。');
      if (btn) {
        btn.disabled = false;
        btn.textContent = ' 値入率分岐点を一括挿入';
      }
      return;
    }

    yr = calcYield(beforeWeight, afterWeight);
    bw = beforeWeight;
  } else {
    yr = getNumValue(elements.yieldRateDirect);
    bw = getNumValue(elements.beforeWeightDirect);
  }

  if (!isPositive(yr) || !isPositive(bw)) {
    showWarning('歩留まり率と加工前重量を入力してください。');
    if (btn) {
      btn.disabled = false;
      btn.textContent = ' 値入率分岐点を一括挿入';
    }
    return;
  }

  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  if (rows.length === 0) {
    showWarning('パターンがありません。');
    if (btn) {
      btn.disabled = false;
      btn.textContent = ' 値入率分岐点を一括挿入';
    }
    return;
  }

  let updatedCount = 0;
  const updatedInputs = [];

  // 各パターンの損益分岐点を計算して設定
  rows.forEach(row => {
    const unitCostInput = row.querySelector('.pattern-unit-cost');
    const unitPriceInput = row.querySelector('.pattern-unit-price');
    const afterPriceInput = row.querySelector('.pattern-after-price');

    const unitCost = getNumValue(unitCostInput);
    const unitPrice = getNumValue(unitPriceInput);

    // 1個原価と1個売価が入力されている場合のみ計算
    if (isPositive(unitCost) && isPositive(unitPrice)) {
      // 加工前100g原価を計算
      const beforeCost100 = per100FromPerUnit(unitCost, bw);
      // 加工前100g売価を計算
      const beforePrice100 = per100FromPerUnit(unitPrice, bw);

      if (beforeCost100 && beforePrice100) {
        // 加工前値入率を計算
        const beforeMarkupRate = markup(beforeCost100, beforePrice100);

        if (Number.isFinite(beforeMarkupRate) && beforeMarkupRate >= 0 && beforeMarkupRate < 100) {
          // 加工後100g原価を計算
          const afterCost100 = afterCostPer100(beforeCost100, yr);

          if (afterCost100) {
            // 加工前値入率を維持する加工後100g売価を計算
            const breakEvenPrice = priceFromMarkup(afterCost100, beforeMarkupRate);

            if (isPositive(breakEvenPrice)) {
              // 加工後設定売価に設定
              afterPriceInput.value = toFixed(breakEvenPrice, 2);

              // ハイライト表示のために入力欄を記録
              updatedInputs.push(afterPriceInput);

              // inputイベントを発火して再計算をトリガー
              const patternId = parseInt(row.dataset.patternId);
              if (handlePatternInputFunc) {
                handlePatternInputFunc(patternId);
              }

              updatedCount++;
            }
          }
        }
      }
    }
  });

  // ボタンを元に戻す
  if (btn) {
    btn.disabled = false;
    btn.textContent = ' 値入率分岐点を一括挿入';
  }

  if (updatedCount > 0) {
    // 成功メッセージを表示
    if (btn) {
      btn.innerHTML = '<i class="fa-regular fa-circle-check"></i> 挿入完了！';
      setTimeout(() => {
        btn.textContent = ' 値入率分岐点を一括挿入';
      }, 2000);
    }

    // 更新された入力欄をハイライト表示
    updatedInputs.forEach(input => {
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = '#c8e6c9'; // 緑色のハイライト

      // 2秒後にハイライトを解除
      setTimeout(() => {
        input.style.backgroundColor = '';
      }, 2000);
    });
  } else {
    showWarning('1個原価と1個売価が入力されているパターンがありません。');
  }
}

/**
 * 目標値入率から売価を更新（リアルタイム用）
 * @param {number} targetMarkup - 目標値入率
 * @param {boolean} showHighlight - ハイライトを表示するか
 * @returns {number} - 更新したパターン数
 */
export function updatePricesFromTargetMarkup(targetMarkup, showHighlight = false) {
  // 入力値の検証
  if (!Number.isFinite(targetMarkup) || targetMarkup < 0 || targetMarkup >= 100) {
    return 0;
  }

  // 現在のモードに応じて歩留まり率と加工前重量を取得
  let yr, bw;

  const currentYieldMethod = getCurrentYieldMethod ? getCurrentYieldMethod() : 'calculate';

  if (currentYieldMethod === 'calculate') {
    const beforeWeight = getNumValue(elements.beforeWeightCalc);
    const afterWeight = getNumValue(elements.afterWeightCalc);

    if (!isPositive(beforeWeight) || !isPositive(afterWeight)) {
      return 0;
    }

    yr = calcYield(beforeWeight, afterWeight);
    bw = beforeWeight;
  } else {
    yr = getNumValue(elements.yieldRateDirect);
    bw = getNumValue(elements.beforeWeightDirect);
  }

  if (!isPositive(yr) || !isPositive(bw)) {
    return 0;
  }

  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  if (rows.length === 0) {
    return 0;
  }

  let updatedCount = 0;
  const updatedInputs = [];

  // 各パターンに目標値入率を適用
  rows.forEach((row) => {
    const unitCostInput = row.querySelector('.pattern-unit-cost');
    const afterPriceInput = row.querySelector('.pattern-after-price');

    const unitCost = getNumValue(unitCostInput);

    // 1個原価が入力されている場合のみ計算
    if (isPositive(unitCost)) {
      // 加工前100g原価を計算
      const beforeCost100 = per100FromPerUnit(unitCost, bw);

      if (beforeCost100) {
        // 加工後100g原価を計算
        const afterCost100 = afterCostPer100(beforeCost100, yr);

        if (afterCost100) {
          // 目標値入率を達成する加工後100g売価を計算
          const targetPrice = priceFromMarkup(afterCost100, targetMarkup);

          if (isPositive(targetPrice)) {
            // 加工後設定売価に設定
            afterPriceInput.value = toFixed(targetPrice, 2);

            // ハイライト表示のために入力欄を記録
            if (showHighlight) {
              updatedInputs.push(afterPriceInput);
            }

            // inputイベントを発火して再計算をトリガー
            const patternId = parseInt(row.dataset.patternId);
            if (handlePatternInputFunc) {
              handlePatternInputFunc(patternId);
            }

            updatedCount++;
          }
        }
      }
    }
  });

  // ハイライト表示
  if (showHighlight && updatedInputs.length > 0) {
    updatedInputs.forEach(input => {
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = '#bbdefb'; // 青色のハイライト

      // 2秒後にハイライトを解除
      setTimeout(() => {
        input.style.backgroundColor = '';
      }, 2000);
    });
  }

  return updatedCount;
}

/**
 * 目標値入率から売価を一括計算して設定（ボタンクリック用）
 */
export function applyTargetMarkupPrices() {
  // ボタンを無効化してローディング表示
  const btn = elements.applyTargetMarkupBtn;
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ 計算中...';
  }

  // 目標値入率を取得
  const targetMarkup = getNumValue(elements.targetMarkupRate);

  if (!Number.isFinite(targetMarkup) || targetMarkup < 0 || targetMarkup >= 100) {
    showWarning('目標値入率を0〜99の範囲で入力してください。');
    if (btn) {
      btn.disabled = false;
      btn.textContent = ' 売価を挿入';
    }
    return;
  }

  // 売価を更新（ハイライト表示あり）
  const updatedCount = updatePricesFromTargetMarkup(targetMarkup, true);

  // ボタンを元に戻す
  if (btn) {
    btn.disabled = false;
  }

  if (updatedCount > 0) {
    // 成功メッセージを表示
    if (btn) {
      btn.innerHTML = `<i class="fa-regular fa-circle-check"></i> 挿入完了！（${toFixed(targetMarkup, 1)}%）`;
      setTimeout(() => {
        btn.textContent = ' 売価を挿入';
      }, 2000);
    }
  } else {
    if (btn) {
      btn.textContent = ' 売価を挿入';
    }
    showWarning('1個原価が入力されているパターンがありません。');
  }
}

/**
 * 売価を丸め込み（下一桁を0, 5, 8に調整）
 * @param {number} digit - 下一桁の数字（0, 5, 8）
 */
export function roundPrices(digit) {
  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  if (rows.length === 0) {
    showWarning('パターンがありません。');
    return;
  }

  let updatedCount = 0;
  const updatedInputs = [];

  // 各パターンの加工後設定売価を丸め込み
  rows.forEach((row, index) => {
    const afterPriceInput = row.querySelector('.pattern-after-price');
    const currentValue = getNumValue(afterPriceInput);

    if (isPositive(currentValue)) {
      // 丸め込み処理
      const roundedValue = roundToDigit(currentValue, digit);

      // 値を設定
      afterPriceInput.value = roundedValue;

      // ハイライト表示のために入力欄を記録
      updatedInputs.push(afterPriceInput);

      // inputイベントを発火して再計算をトリガー
      const patternId = parseInt(row.dataset.patternId);
      if (handlePatternInputFunc) {
        handlePatternInputFunc(patternId);
      }

      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    // 更新された入力欄をハイライト表示
    updatedInputs.forEach(input => {
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = '#fff9c4'; // 黄色のハイライト

      // 2秒後にハイライトを解除
      setTimeout(() => {
        input.style.backgroundColor = '';
      }, 2000);
    });
  } else {
    showWarning('加工後設定売価が入力されているパターンがありません。');
  }
}

/**
 * 値を指定した下一桁に丸め込み（小数点なし）
 * @param {number} value - 元の値
 * @param {number} digit - 下一桁の数字（0, 5, 8）
 * @returns {number} - 丸め込み後の値
 */
function roundToDigit(value, digit) {
  // 丸め込みモードを取得
  const roundModeRadio = document.querySelector('input[name="roundMode"]:checked');
  const roundMode = roundModeRadio ? roundModeRadio.value : 'round';

  // 小数点を四捨五入して整数に
  const intValue = Math.round(value);

  // 下一桁を取得
  const lastDigit = intValue % 10;

  // 10の位を計算
  const base = Math.floor(intValue / 10) * 10;

  // モードに応じて処理
  if (roundMode === 'round') {
    // 近接値: 従来の動作（最も近い方）
    if (lastDigit <= digit) {
      return base + digit;
    } 
      return base + 10 + digit;
    
  } else if (roundMode === 'ceil') {
    // 切り上げ: digitより小さければ現在の10の位+digit、それ以外は次の10の位+digit
    if (lastDigit <= digit) {
      return base + digit;
    } 
      return base + 10 + digit;
    
  } else if (roundMode === 'floor') {
    // 切り捨て: digitより大きければ現在の10の位+digit、それ以外は前の10の位+digit
    if (lastDigit >= digit) {
      return base + digit;
    } 
      return base - 10 + digit;
    
  }

  // デフォルト（念のため）
  return base + digit;
}

/**
 * 売価を指定の金額だけ調整（一括加算/減算）
 * @param {number} amount - 調整金額（+10 or -10）
 */
export function adjustPrices(amount) {
  // すべてのパターン行を取得
  const rows = elements.tableBody.querySelectorAll('tr[data-pattern-id]');

  if (rows.length === 0) {
    showWarning('パターンがありません。');
    return;
  }

  let updatedCount = 0;
  const updatedInputs = [];

  // 各パターンの加工後設定売価を調整
  rows.forEach((row, index) => {
    const afterPriceInput = row.querySelector('.pattern-after-price');
    const currentValue = getNumValue(afterPriceInput);

    if (isPositive(currentValue)) {
      // 調整後の値
      const adjustedValue = currentValue + amount;

      // 負の値にならないようにチェック
      if (adjustedValue > 0) {
        // 値を設定
        afterPriceInput.value = toFixed(adjustedValue, 2);

        // ハイライト表示のために入力欄を記録
        updatedInputs.push(afterPriceInput);

        // inputイベントを発火して再計算をトリガー
        const patternId = parseInt(row.dataset.patternId);
        if (handlePatternInputFunc) {
          handlePatternInputFunc(patternId);
        }

        updatedCount++;
      }
    }
  });

  if (updatedCount > 0) {
    // 更新された入力欄をハイライト表示
    const highlightColor = amount > 0 ? '#c8e6c9' : '#ffccbc'; // +は緑、-はオレンジ
    updatedInputs.forEach(input => {
      input.style.transition = 'background-color 0.3s ease';
      input.style.backgroundColor = highlightColor;

      // 2秒後にハイライトを解除
      setTimeout(() => {
        input.style.backgroundColor = '';
      }, 2000);
    });
  } else {
    showWarning('加工後設定売価が入力されているパターンがありません。');
  }
}

/**
 * すべてクリア
 */
export function clearAll() {
  // 商品名をクリア
  const productNameEl = document.getElementById('multiPatternProductName');
  if (productNameEl) {productNameEl.value = '';}

  // 重量から計算モードの入力値をクリア
  if (elements.beforeWeightCalc) {elements.beforeWeightCalc.value = '';}
  if (elements.afterWeightCalc) {elements.afterWeightCalc.value = '';}

  // 歩留まり率直接入力モードの入力値をクリア
  if (elements.beforeWeightDirect) {elements.beforeWeightDirect.value = '';}
  if (elements.yieldRateDirect) {elements.yieldRateDirect.value = '';}

  // パターンテーブルをクリア
  if (elements.tableBody) {elements.tableBody.innerHTML = '';}
  if (clearPatternsFunc) {clearPatternsFunc();}
  if (resetPatternIdCounterFunc) {resetPatternIdCounterFunc();}

  // 結果を非表示
  if (elements.step1ResultCalc) {elements.step1ResultCalc.classList.add(CSS_HIDDEN);}
  if (elements.step1ResultDirect) {elements.step1ResultDirect.classList.add(CSS_HIDDEN);}
  if (elements.step2) {elements.step2.classList.add(CSS_HIDDEN);}
  if (elements.step2Result) {elements.step2Result.classList.add(CSS_HIDDEN);}

  // 初期パターンを追加
  if (addPatternFunc) {
    for (let i = 0; i < INITIAL_PATTERN_COUNT; i++) {
      addPatternFunc();
    }
  }
}

/**
 * モード切替時の初期化
 */
export function resetMultiPatternUI() {
  clearAll();
}

/**
 * 歩留まり統計から値を設定
 * @param {number} yieldRate - 歩留まり率（%）
 * @param {string} productName - 商品名
 */
export function setFromYieldStats(yieldRate, productName = '') {
  // 商品名を設定
  const productNameEl = document.getElementById('multiPatternProductName');
  if (productNameEl && productName) {
    productNameEl.value = productName;
  }

  // 歩留まり率直接入力モードに切り替え
  const directRadio = document.querySelector('input[name="yieldMethodMultiPattern"][value="direct"]');
  if (directRadio) {
    directRadio.checked = true;
    // change イベントを発火
    directRadio.dispatchEvent(new Event('change'));
  }

  // 歩留まり率を設定
  if (elements.yieldRateDirect && Number.isFinite(yieldRate)) {
    elements.yieldRateDirect.value = yieldRate.toFixed(2);
    // input イベントを発火して計算を実行
    // handleDirectModeInput は core.js で定義されているため、イベントで間接的に呼び出し
    elements.yieldRateDirect.dispatchEvent(new Event('input'));
  }
}

/**
 * 統計値を複数パターン分析に設定（汎用関数）
 * 現在のモードを維持したまま、適切なフィールドに値を設定
 * @param {number} value - 設定する値
 * @param {string} statType - 統計タイプ ('yieldRate', 'beforeWeight', 'afterWeight')
 * @param {string} productName - 商品名（オプション）
 */
export function setStatValue(value, statType, productName = '') {
  // 商品名を設定
  const productNameEl = document.getElementById('multiPatternProductName');
  if (productNameEl && productName) {
    productNameEl.value = productName;
    // 歩留まり統計から読み込んだ場合は読み取り専用にして動的連動を有効化
    productNameEl.setAttribute('readonly', 'readonly');
    productNameEl.style.backgroundColor = '#f0f0f0';
    productNameEl.style.cursor = 'not-allowed';
  }

  // 現在のモードを取得（モードは変更しない）
  const currentMode = document.querySelector('input[name="yieldMethodMultiPattern"]:checked')?.value || 'calculate';

  if (statType === 'yieldRate') {
    // 歩留まり率 → 直接入力モードの歩留まり率フィールド
    // （directモードでのみ有効）
    if (currentMode === 'direct' && elements.yieldRateDirect && Number.isFinite(value)) {
      elements.yieldRateDirect.value = value.toFixed(2);
      elements.yieldRateDirect.dispatchEvent(new Event('input'));
    }
  } else if (statType === 'beforeWeight') {
    // 加工前重量 → 現在のモードに応じたフィールド
    if (currentMode === 'calculate' && elements.beforeWeightCalc && Number.isFinite(value)) {
      // 重量から計算モードの加工前重量
      elements.beforeWeightCalc.value = value.toFixed(2);
      elements.beforeWeightCalc.dispatchEvent(new Event('input'));
    } else if (currentMode === 'direct' && elements.beforeWeightDirect && Number.isFinite(value)) {
      // 直接入力モードの加工前重量
      elements.beforeWeightDirect.value = value.toFixed(2);
      elements.beforeWeightDirect.dispatchEvent(new Event('input'));
    }
  } else if (statType === 'afterWeight') {
    // 加工後重量 → 重量から計算モードの加工後重量フィールド
    // （calculateモードでのみ有効）
    if (currentMode === 'calculate' && elements.afterWeightCalc && Number.isFinite(value)) {
      elements.afterWeightCalc.value = value.toFixed(2);
      elements.afterWeightCalc.dispatchEvent(new Event('input'));
    }
  }
}
