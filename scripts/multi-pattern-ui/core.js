/**
 * コアUIモジュール
 * Main orchestrator, UI initialization, and event handlers
 */

import { logger } from '../core/logger.js';
import { toFixed, calcYield } from '../calculation.js';
import { PERCENT_MULTIPLIER } from '../constants.js';
import { debounce } from '../debounce.js';

// パターン管理モジュール
import {
  setElements as setPatternsElements,
  setRecalculateCallback,
  getPatterns,
  getPatternIdCounter,
  resetPatternIdCounter,
  clearPatterns,
  addPattern,
  updatePatternNumbers,
  handlePatternInput,
  replaceAllPatterns
} from './patterns.js';

// 計算モジュール
import {
  setElements as setCalculationsElements,
  setGetCurrentYieldMethod,
  setGetPatternsFunc,
  recalculateAll
} from './calculations.js';

// プリセット・一括操作モジュール
import {
  setElements as setPresetsElements,
  setGetCurrentYieldMethod as setPresetsGetCurrentYieldMethod,
  setHandlePatternInputFunc,
  setAddPatternFunc,
  setPatternManagementFuncs,
  calculateBreakEvenPrices,
  updatePricesFromTargetMarkup,
  applyTargetMarkupPrices,
  roundPrices,
  adjustPrices,
  clearAll,
  resetMultiPatternUI,
  setFromYieldStats,
  setStatValue
} from './presets.js';

// 定数
const INITIAL_PATTERN_COUNT = 3;
const CSS_HIDDEN = 'is-hidden';

// 状態管理
let currentYieldMethod = 'calculate'; // 'calculate' or 'direct'

// DOM要素（初期化時に取得）
let elements = {};

/**
 * 現在の歩留まり率入力方法を取得
 * @returns {string} 現在のモード ('calculate' or 'direct')
 */
function getCurrentYieldMethod() {
  return currentYieldMethod;
}

/**
 * 要素から数値を取得
 * @param {HTMLElement} element - HTML要素
 * @returns {number|null} 数値またはnull
 */
function getNumValue(element) {
  if (!element) return null;
  const v = parseFloat(element.value);
  return Number.isFinite(v) ? v : null;
}

/**
 * 歩留まり率入力方法の切り替え
 * @param {Event} e - イベントオブジェクト
 */
function handleYieldMethodChange(e) {
  currentYieldMethod = e.target.value;
  const isDirect = currentYieldMethod === 'direct';

  // モードの表示切り替え
  if (elements.calculateMode) elements.calculateMode.classList.toggle(CSS_HIDDEN, isDirect);
  if (elements.directMode) elements.directMode.classList.toggle(CSS_HIDDEN, !isDirect);

  // 結果を非表示
  if (elements.step2) elements.step2.classList.add(CSS_HIDDEN);
  if (elements.step2Result) elements.step2Result.classList.add(CSS_HIDDEN);
  if (elements.step1ResultCalc) elements.step1ResultCalc.classList.add(CSS_HIDDEN);
  if (elements.step1ResultDirect) elements.step1ResultDirect.classList.add(CSS_HIDDEN);
}

/**
 * 重量から計算モードの入力処理
 */
function handleCalculateModeInput() {
  const bw = getNumValue(elements.beforeWeightCalc);
  const aw = getNumValue(elements.afterWeightCalc);

  if (!Number.isFinite(bw) || !Number.isFinite(aw) || bw <= 0 || aw <= 0) {
    elements.step1ResultCalc.classList.add(CSS_HIDDEN);
    elements.step2.classList.add(CSS_HIDDEN);
    elements.step2Result.classList.add(CSS_HIDDEN);
    return;
  }

  // 歩留まり率を計算
  const yr = calcYield(bw, aw);
  if (!Number.isFinite(yr)) {
    elements.step1ResultCalc.classList.add(CSS_HIDDEN);
    elements.step2.classList.add(CSS_HIDDEN);
    elements.step2Result.classList.add(CSS_HIDDEN);
    return;
  }

  // 歩留まり率を表示
  elements.yieldRateDisplayCalc.textContent = `${toFixed(yr, 2)}%`;
  elements.step1ResultCalc.classList.remove(CSS_HIDDEN);
  elements.step2.classList.remove(CSS_HIDDEN);

  // パターンが入力されていれば計算を更新
  recalculateAll();
}

/**
 * 歩留まり率直接入力モードの入力処理
 */
function handleDirectModeInput() {
  const bw = getNumValue(elements.beforeWeightDirect);
  const yr = getNumValue(elements.yieldRateDirect);

  if (!Number.isFinite(bw) || !Number.isFinite(yr) || bw <= 0 || yr <= 0) {
    elements.step1ResultDirect.classList.add(CSS_HIDDEN);
    elements.step2.classList.add(CSS_HIDDEN);
    elements.step2Result.classList.add(CSS_HIDDEN);
    return;
  }

  // 加工後重量を計算
  const aw = bw * (yr / PERCENT_MULTIPLIER);

  // 結果を表示
  elements.yieldRateDisplayDirect.textContent = `${toFixed(yr, 2)}%`;
  elements.afterWeightDisplayDirect.textContent = `${toFixed(aw, 2)}g`;
  elements.step1ResultDirect.classList.remove(CSS_HIDDEN);
  elements.step2.classList.remove(CSS_HIDDEN);

  // パターンが入力されていれば計算を更新
  recalculateAll();
}

/**
 * ヘルプアイコンのモバイル対応を初期化
 */
function initHelpIconMobile() {
  // タッチデバイスの検出
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isTouchDevice) {
    // 全てのヘルプアイコンにタップイベントを設定
    document.addEventListener('click', (e) => {
      const helpIcon = e.target.closest('.help-icon');

      if (helpIcon) {
        // クリックされたヘルプアイコンのトグル
        e.stopPropagation();
        helpIcon.classList.toggle('active');
      } else {
        // ヘルプアイコン以外をクリックしたら全て閉じる
        document.querySelectorAll('.help-icon.active').forEach(icon => {
          icon.classList.remove('active');
        });
      }
    });
  }
}

/**
 * 比較結果のヘルプモーダルを初期化
 */
function initResultsHelpModal() {
  const helpBtn = document.getElementById('resultsHelpBtn');
  const modal = document.getElementById('resultsHelpModal');
  const closeBtn = document.getElementById('resultsHelpModalClose');
  const overlay = modal?.querySelector('.modal-overlay');

  if (!helpBtn || !modal || !closeBtn || !overlay) {
    return;
  }

  // ヘルプボタンをクリックでモーダルを開く
  helpBtn.addEventListener('click', () => {
    modal.classList.add('is-active');
    document.body.style.overflow = 'hidden'; // 背景のスクロールを無効化
  });

  // 閉じるボタンをクリックでモーダルを閉じる
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('is-active');
    document.body.style.overflow = ''; // スクロールを復元
  });

  // オーバーレイをクリックでモーダルを閉じる
  overlay.addEventListener('click', () => {
    modal.classList.remove('is-active');
    document.body.style.overflow = '';
  });

  // ESCキーでモーダルを閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-active')) {
      modal.classList.remove('is-active');
      document.body.style.overflow = '';
    }
  });
}

/**
 * 初期化
 */
export function initMultiPatternUI() {
  // DOM要素を取得
  elements = {
    // モード切り替え
    calculateMode: document.getElementById('multiPatternCalculateMode'),
    directMode: document.getElementById('multiPatternDirectMode'),

    // 重量から計算モード
    beforeWeightCalc: document.getElementById('multiBeforeWeightCalc'),
    afterWeightCalc: document.getElementById('multiAfterWeightCalc'),
    step1ResultCalc: document.getElementById('multiPatternStep1ResultCalc'),
    yieldRateDisplayCalc: document.getElementById('multiYieldRateDisplayCalc'),

    // 歩留まり率直接入力モード
    beforeWeightDirect: document.getElementById('multiBeforeWeightDirect'),
    yieldRateDirect: document.getElementById('multiYieldRateDirect'),
    step1ResultDirect: document.getElementById('multiPatternStep1ResultDirect'),
    yieldRateDisplayDirect: document.getElementById('multiYieldRateDisplayDirect'),
    afterWeightDisplayDirect: document.getElementById('multiAfterWeightDisplayDirect'),

    // ステップ2
    step2: document.getElementById('multiPatternStep2'),
    tableBody: document.getElementById('multiPatternTableBody'),
    addPatternBtn: document.getElementById('addPatternBtn'),
    breakEvenBtn: document.getElementById('breakEvenBtn'),

    // 目標値入率
    targetMarkupRate: document.getElementById('targetMarkupRate'),
    targetMarkupSlider: document.getElementById('targetMarkupSlider'),
    applyTargetMarkupBtn: document.getElementById('applyTargetMarkupBtn'),

    // 微調整ボタン
    adjustMinus10Btn: document.getElementById('adjustMinus10Btn'),
    adjustPlus10Btn: document.getElementById('adjustPlus10Btn'),

    // 丸め込みボタン
    roundTo0Btn: document.getElementById('roundTo0Btn'),
    roundTo5Btn: document.getElementById('roundTo5Btn'),
    roundTo8Btn: document.getElementById('roundTo8Btn'),

    // 結果
    step2Result: document.getElementById('multiPatternStep2Result'),
    resultsTableBody: document.getElementById('multiPatternResultsTableBody'),

    // クリアボタン
    clearBtn: document.getElementById('multiPatternClearBtn')
  };

  // 要素が存在しない場合は初期化しない
  if (!elements.beforeWeightCalc || !elements.beforeWeightDirect) {
    logger.warn('[MultiPattern] Required elements not found');
    return;
  }

  // モジュール間の依存関係を設定
  setPatternsElements(elements);
  setCalculationsElements(elements);
  setPresetsElements(elements);

  setRecalculateCallback(recalculateAll);
  setGetCurrentYieldMethod(getCurrentYieldMethod);
  setPresetsGetCurrentYieldMethod(getCurrentYieldMethod);
  setGetPatternsFunc(getPatterns);
  setHandlePatternInputFunc(handlePatternInput);
  setAddPatternFunc(addPattern);
  setPatternManagementFuncs(clearPatterns, resetPatternIdCounter);

  // モード切り替えラジオボタン
  const yieldMethodRadios = document.querySelectorAll('input[name="yieldMethodMultiPattern"]');
  yieldMethodRadios.forEach(radio => {
    radio.addEventListener('change', handleYieldMethodChange);
  });

  // 重量から計算モードの入力イベント
  const debouncedHandleCalculateModeInput = debounce(handleCalculateModeInput);
  elements.beforeWeightCalc.addEventListener('input', debouncedHandleCalculateModeInput);
  elements.afterWeightCalc.addEventListener('input', debouncedHandleCalculateModeInput);

  // 歩留まり率直接入力モードの入力イベント
  const debouncedHandleDirectModeInput = debounce(handleDirectModeInput);
  elements.beforeWeightDirect.addEventListener('input', debouncedHandleDirectModeInput);
  elements.yieldRateDirect.addEventListener('input', debouncedHandleDirectModeInput);

  // パターン追加ボタン
  if (elements.addPatternBtn) {
    elements.addPatternBtn.addEventListener('click', addPattern);
  }

  // 損益分岐点一括計算ボタン
  if (elements.breakEvenBtn) {
    elements.breakEvenBtn.addEventListener('click', calculateBreakEvenPrices);
  }

  // 目標値入率のスライダーと入力ボックスの連携
  if (elements.targetMarkupRate && elements.targetMarkupSlider) {
    const debouncedUpdatePricesFromTargetMarkup = debounce((value) => {
      updatePricesFromTargetMarkup(value, false);
    });

    // スライダーを動かしたら入力ボックス、売価を自動更新
    elements.targetMarkupSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value);
      elements.targetMarkupRate.value = toFixed(value, 1);
      // 売価をリアルタイムで自動更新（ハイライトなし）
      debouncedUpdatePricesFromTargetMarkup(value);
    });

    // 入力ボックスを変更したらスライダー、売価を自動更新
    elements.targetMarkupRate.addEventListener('input', (e) => {
      let value = parseFloat(e.target.value);
      if (isNaN(value)) value = 0;
      if (value < 0) value = 0;
      if (value > 99) value = 99;
      elements.targetMarkupRate.value = toFixed(value, 1);
      elements.targetMarkupSlider.value = value;
      // スライダーのカスタムプロパティを更新
      elements.targetMarkupSlider.style.setProperty('--slider-percent', `${value}%`);
      // 売価をリアルタイムで自動更新（ハイライトなし）
      debouncedUpdatePricesFromTargetMarkup(value);
    });
  }

  // 目標値入率から売価を挿入ボタン
  if (elements.applyTargetMarkupBtn) {
    elements.applyTargetMarkupBtn.addEventListener('click', applyTargetMarkupPrices);
  }

  // 微調整ボタン
  if (elements.adjustMinus10Btn) {
    elements.adjustMinus10Btn.addEventListener('click', () => adjustPrices(-10));
  }
  if (elements.adjustPlus10Btn) {
    elements.adjustPlus10Btn.addEventListener('click', () => adjustPrices(10));
  }

  // 丸め込みボタン
  if (elements.roundTo0Btn) {
    elements.roundTo0Btn.addEventListener('click', () => roundPrices(0));
  }
  if (elements.roundTo5Btn) {
    elements.roundTo5Btn.addEventListener('click', () => roundPrices(5));
  }
  if (elements.roundTo8Btn) {
    elements.roundTo8Btn.addEventListener('click', () => roundPrices(8));
  }

  // クリアボタン
  if (elements.clearBtn) {
    elements.clearBtn.addEventListener('click', clearAll);
  }

  // 初期パターンを追加
  for (let i = 0; i < INITIAL_PATTERN_COUNT; i++) {
    addPattern();
  }

  // ヘルプアイコンのモバイル対応（タップで表示/非表示）
  initHelpIconMobile();

  // 比較結果のヘルプモーダル
  initResultsHelpModal();
}

// グローバルアクセス用のAPI
if (typeof window !== 'undefined') {
  window.multiPatternUI = {
    replaceAllPatterns,
    updatePatternNumbers
  };
}

// 公開API
export {
  resetMultiPatternUI,
  setFromYieldStats,
  setStatValue,
  replaceAllPatterns
};
