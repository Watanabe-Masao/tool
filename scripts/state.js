/**
 * アプリケーションの状態管理
 */

import { MODE } from './constants.js';

/**
 * 計算結果のスナップショット
 */
class CalculationSnapshot {
  constructor() {
    this.reset();
  }

  reset() {
    this.afterCost = null;
    this.afterPrice = null;
    this.beforeMarkup = null;
    this.afterMarkup = null;
    this.beforePrice = null;
    this.beforeCost = null;
    // 逆算で必要になる歩留まり率（%）
    this.yieldRate = null;
  }

  update({ ac, ap, bm, am, bp, bc, yr }) {
    this.afterCost = ac;
    this.afterPrice = ap;
    this.beforeMarkup = bm;
    this.afterMarkup = am;
    this.beforePrice = bp;
    this.beforeCost = bc;
    this.yieldRate = yr;
  }

  isValid() {
    return Number.isFinite(this.afterCost) && Number.isFinite(this.afterPrice);
  }
}

/**
 * 商品化シミュレーションデータ
 */
class ProductSimulationData {
  constructor() {
    this.reset();
  }

  reset() {
    this.price = null;
    this.markup = null;
    this.cost = null;
  }

  update({ price, markup, cost }) {
    this.price = price;
    this.markup = markup;
    this.cost = cost;
  }

  isValid() {
    return Number.isFinite(this.price) && Number.isFinite(this.markup);
  }
}

/**
 * アプリケーション全体の状態管理
 */
export class AppState {
  constructor() {
    this.mode = MODE.FIXED;
    this.currentStep = 1;  // 現在のステップ（1, 2, 3）
    this.snapshot = new CalculationSnapshot();
    this.productData = new ProductSimulationData();
    this.loadedHistoryId = null;  // 履歴から読み込んだ計算のID（上書き保存用）

    // UI状態フラグ（データベースには保存されない、ランタイムのみ）
    this.isFromHistory = false;     // 履歴から呼び出されたものか
    this.hasUnsavedChanges = false; // 未保存の変更があるか
    this.showYieldStatsWithMultiPattern = false; // 複数パターン分析モード時に歩留まり統計を表示するか

    // 一元化された状態管理
    this.yieldStatsData = null;     // 歩留まり統計データ（旧 window.yieldStatsData）【非推奨：yieldStats.rawDataを使用】
    this.saveDialogMode = 'normal'; // 保存ダイアログのモード（'normal' or 'new'）

    // 歩留まり統計の一元管理（新規）
    this.yieldStats = {
      // 生データ（旧 yieldStatsData から移行）
      rawData: null,  // { yieldRate: [...], beforeWeight: [...], afterWeight: [...] }

      // 計算結果（旧 window.statsDataByType から移行）
      calculatedStats: {
        yieldRate: null,      // { mean, stdDev, count, min, max, median, mode, ... }
        beforeWeight: null,
        afterWeight: null
      },

      // UI状態（旧 window.yieldStatsState から移行）
      ui: {
        currentDisplayType: 'yieldRate',
        isCalculated: false,
        isFromHistory: false,
        hasYieldRateData: false,
        hasBeforeWeightData: false,
        hasAfterWeightData: false,
        isOutlierExcluded: false
      },

      // 外れ値管理（旧 window.yieldStatsState から移行）
      outliers: {
        manuallyExcludedIndices: new Set(),
        currentValues: []
      },

      // サンプルサイズ妥当性（旧 window.yieldStatsState.sampleSizeValidation から移行）
      validation: {
        yieldRate: null,
        beforeWeight: null,
        afterWeight: null
      },

      // 最後の計算結果キャッシュ（旧 window.lastCalculatedStats から移行）
      lastCalculated: null
    };
  }

  setMode(mode) {
    this.mode = mode;
    this.currentStep = 1;  // モード変更時はステップ1に戻る
  }

  getMode() {
    return this.mode;
  }

  // ステップ管理
  getCurrentStep() {
    return this.currentStep;
  }

  setStep(step) {
    this.currentStep = step;
  }

  nextStep() {
    if (this.currentStep < 3) {
      this.currentStep++;
    }
  }

  resetStep() {
    this.currentStep = 1;
  }

  updateSnapshot(data) {
    this.snapshot.update(data);
  }

  getSnapshot() {
    return this.snapshot;
  }

  updateProductData(data) {
    this.productData.update(data);
  }

  getProductData() {
    return this.productData;
  }

  // 履歴ID管理
  setLoadedHistoryId(id) {
    this.loadedHistoryId = id;
  }

  getLoadedHistoryId() {
    return this.loadedHistoryId;
  }

  clearLoadedHistoryId() {
    this.loadedHistoryId = null;
  }

  // UI状態フラグの管理
  markAsFromHistory() {
    this.isFromHistory = true;
    this.hasUnsavedChanges = false;
  }

  markAsNewCalculation() {
    this.isFromHistory = false;
    this.hasUnsavedChanges = false;
  }

  markAsChanged() {
    this.hasUnsavedChanges = true;
  }

  markAsSaved() {
    this.hasUnsavedChanges = false;
    // 保存後は履歴から呼び出したものとして扱う
    this.isFromHistory = true;
  }

  isFromHistoryRecord() {
    return this.isFromHistory;
  }

  hasChanges() {
    return this.hasUnsavedChanges;
  }

  // 歩留まり統計データの管理
  setYieldStatsData(data) {
    this.yieldStatsData = data;
  }

  getYieldStatsData() {
    return this.yieldStatsData;
  }

  // 保存ダイアログモードの管理
  setSaveDialogMode(mode) {
    this.saveDialogMode = mode;
  }

  getSaveDialogMode() {
    return this.saveDialogMode;
  }

  // ========================================
  // 歩留まり統計の新しいメソッド群
  // ========================================

  /**
   * 歩留まり統計の生データを取得
   * @returns {Object|null} { yieldRate: [...], beforeWeight: [...], afterWeight: [...] }
   */
  getYieldStatsRawData() {
    return this.yieldStats.rawData;
  }

  /**
   * 歩留まり統計の生データを設定
   * @param {Object|null} data - { yieldRate: [...], beforeWeight: [...], afterWeight: [...] }
   */
  setYieldStatsRawData(data) {
    this.yieldStats.rawData = data;

    // データ有無フラグを自動更新
    if (data) {
      this.yieldStats.ui.hasYieldRateData = !!(data.yieldRate && Array.isArray(data.yieldRate) && data.yieldRate.length >= 2);
      this.yieldStats.ui.hasBeforeWeightData = !!(data.beforeWeight && Array.isArray(data.beforeWeight) && data.beforeWeight.length >= 2);
      this.yieldStats.ui.hasAfterWeightData = !!(data.afterWeight && Array.isArray(data.afterWeight) && data.afterWeight.length >= 2);
    } else {
      this.yieldStats.ui.hasYieldRateData = false;
      this.yieldStats.ui.hasBeforeWeightData = false;
      this.yieldStats.ui.hasAfterWeightData = false;
    }

    // 後方互換性のため、旧プロパティも更新
    this.yieldStatsData = data;
  }

  /**
   * 特定タイプの計算結果を取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {Object|null} 統計計算結果
   */
  getCalculatedStats(type) {
    return this.yieldStats.calculatedStats[type];
  }

  /**
   * すべての計算結果を取得
   * @returns {Object} { yieldRate: {...}, beforeWeight: {...}, afterWeight: {...} }
   */
  getAllCalculatedStats() {
    return this.yieldStats.calculatedStats;
  }

  /**
   * 特定タイプの計算結果を設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @param {Object|null} stats - 統計計算結果
   */
  setCalculatedStats(type, stats) {
    this.yieldStats.calculatedStats[type] = stats;

    if (stats) {
      this.yieldStats.ui.isCalculated = true;
      this.yieldStats.lastCalculated = stats;
    }
  }

  /**
   * すべての計算結果を設定
   * @param {Object} statsData - { yieldRate: {...}, beforeWeight: {...}, afterWeight: {...} }
   */
  setAllCalculatedStats(statsData) {
    if (statsData) {
      this.yieldStats.calculatedStats.yieldRate = statsData.yieldRate || null;
      this.yieldStats.calculatedStats.beforeWeight = statsData.beforeWeight || null;
      this.yieldStats.calculatedStats.afterWeight = statsData.afterWeight || null;

      // いずれかのデータがあれば計算完了とみなす
      if (statsData.yieldRate || statsData.beforeWeight || statsData.afterWeight) {
        this.yieldStats.ui.isCalculated = true;
        // 最初に見つかったデータをlastCalculatedに設定
        this.yieldStats.lastCalculated = statsData.yieldRate || statsData.beforeWeight || statsData.afterWeight;
      }
    }
  }

  /**
   * 最後の計算結果を取得
   * @returns {Object|null}
   */
  getLastCalculatedStats() {
    return this.yieldStats.lastCalculated;
  }

  /**
   * 最後の計算結果を設定
   * @param {Object|null} stats
   */
  setLastCalculatedStats(stats) {
    this.yieldStats.lastCalculated = stats;
  }

  /**
   * 現在の表示タイプを取得
   * @returns {string} 'yieldRate' | 'beforeWeight' | 'afterWeight'
   */
  getCurrentDisplayType() {
    return this.yieldStats.ui.currentDisplayType;
  }

  /**
   * 現在の表示タイプを設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   */
  setCurrentDisplayType(type) {
    // タイプが変更された場合、外れ値除外をリセット
    if (this.yieldStats.ui.currentDisplayType !== type) {
      this.clearExcludedOutliers();
    }
    this.yieldStats.ui.currentDisplayType = type;
  }

  /**
   * 計算完了フラグを取得
   * @returns {boolean}
   */
  isYieldStatsCalculated() {
    return this.yieldStats.ui.isCalculated;
  }

  /**
   * 計算完了フラグを設定
   * @param {boolean} value
   */
  setYieldStatsCalculated(value) {
    this.yieldStats.ui.isCalculated = value;
  }

  /**
   * 履歴読込フラグを取得
   * @returns {boolean}
   */
  isYieldStatsFromHistory() {
    return this.yieldStats.ui.isFromHistory;
  }

  /**
   * 履歴読込フラグを設定
   * @param {boolean} value
   */
  setYieldStatsFromHistory(value) {
    this.yieldStats.ui.isFromHistory = value;
  }

  /**
   * データ有無フラグを取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {boolean}
   */
  hasYieldStatsDataByType(type) {
    if (type === 'yieldRate') return this.yieldStats.ui.hasYieldRateData;
    if (type === 'beforeWeight') return this.yieldStats.ui.hasBeforeWeightData;
    if (type === 'afterWeight') return this.yieldStats.ui.hasAfterWeightData;
    return false;
  }

  /**
   * 外れ値除外フラグを取得
   * @returns {boolean}
   */
  isOutlierExcluded() {
    return this.yieldStats.ui.isOutlierExcluded;
  }

  /**
   * 外れ値除外フラグを設定
   * @param {boolean} value
   */
  setOutlierExcluded(value) {
    this.yieldStats.ui.isOutlierExcluded = value;
  }

  /**
   * 手動除外された外れ値のインデックスセットを取得
   * @returns {Set}
   */
  getManuallyExcludedOutlierIndices() {
    return this.yieldStats.outliers.manuallyExcludedIndices;
  }

  /**
   * 現在の外れ値リストを取得
   * @returns {Array}
   */
  getCurrentOutlierValues() {
    return this.yieldStats.outliers.currentValues;
  }

  /**
   * 現在の外れ値リストを設定
   * @param {Array} values
   */
  setCurrentOutlierValues(values) {
    this.yieldStats.outliers.currentValues = values;
  }

  /**
   * 特定インデックスの外れ値を除外
   * @param {number} index
   */
  excludeOutlierByIndex(index) {
    this.yieldStats.outliers.manuallyExcludedIndices.add(index);
    this.yieldStats.ui.isOutlierExcluded = true;
  }

  /**
   * 外れ値除外をクリア
   */
  clearExcludedOutliers() {
    this.yieldStats.outliers.manuallyExcludedIndices.clear();
    this.yieldStats.outliers.currentValues = [];
    this.yieldStats.ui.isOutlierExcluded = false;
  }

  /**
   * サンプルサイズ妥当性情報を取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {Object|null} { isValid, actualSize, requiredSize }
   */
  getSampleSizeValidation(type) {
    return this.yieldStats.validation[type];
  }

  /**
   * サンプルサイズ妥当性情報を設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @param {Object|null} validation - { isValid, actualSize, requiredSize }
   */
  setSampleSizeValidation(type, validation) {
    this.yieldStats.validation[type] = validation;
  }

  /**
   * すべての歩留まり統計データをクリア
   */
  clearAllYieldStats() {
    this.yieldStats.rawData = null;
    this.yieldStats.calculatedStats = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };
    this.yieldStats.ui = {
      currentDisplayType: 'yieldRate',
      isCalculated: false,
      isFromHistory: false,
      hasYieldRateData: false,
      hasBeforeWeightData: false,
      hasAfterWeightData: false,
      isOutlierExcluded: false
    };
    this.yieldStats.outliers = {
      manuallyExcludedIndices: new Set(),
      currentValues: []
    };
    this.yieldStats.validation = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };
    this.yieldStats.lastCalculated = null;

    // 後方互換性のため、旧プロパティもクリア
    this.yieldStatsData = null;
  }

  resetAll() {
    this.snapshot.reset();
    this.productData.reset();
    this.currentStep = 1;
    this.loadedHistoryId = null;  // 履歴IDもリセット
    this.isFromHistory = false;
    this.hasUnsavedChanges = false;
    this.yieldStatsData = null;     // 歩留まり統計データもリセット（後方互換）
    this.saveDialogMode = 'normal'; // ダイアログモードもリセット
    this.showYieldStatsWithMultiPattern = false; // 歩留まり統計表示フラグもリセット

    // 新しいyieldStats構造もリセット
    this.clearAllYieldStats();
  }
}

// シングルトンインスタンスをエクスポート
export const appState = new AppState();
