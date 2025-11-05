/**
 * アプリケーションの状態管理
 */

import { MODE } from './constants.js';
import { YieldStatsState } from './state/yield-stats-state.js';

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
    this.saveDialogMode = 'normal'; // 保存ダイアログのモード（'normal' or 'new'）

    // 歩留まり統計の状態管理（コンポジション）
    this._yieldStatsState = new YieldStatsState();

    // 後方互換性のため、yieldStats オブジェクトとして直接アクセス可能にする
    // ただし、メソッド経由でのアクセスを推奨
    this.yieldStats = this._yieldStatsState;
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
    return this._yieldStatsState.getRawData();
  }

  /**
   * 歩留まり統計の生データを設定
   * @param {Object|null} data - { yieldRate: [...], beforeWeight: [...], afterWeight: [...] }
   */
  setYieldStatsRawData(data) {
    this._yieldStatsState.setRawData(data);
  }

  /**
   * 特定タイプの計算結果を取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {Object|null} 統計計算結果
   */
  getCalculatedStats(type) {
    return this._yieldStatsState.getCalculatedStats(type);
  }

  /**
   * すべての計算結果を取得
   * @returns {Object} { yieldRate: {...}, beforeWeight: {...}, afterWeight: {...} }
   */
  getAllCalculatedStats() {
    return this._yieldStatsState.getAllCalculatedStats();
  }

  /**
   * 特定タイプの計算結果を設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @param {Object|null} stats - 統計計算結果
   */
  setCalculatedStats(type, stats) {
    this._yieldStatsState.setCalculatedStats(type, stats);
  }

  /**
   * すべての計算結果を設定
   * @param {Object} statsData - { yieldRate: {...}, beforeWeight: {...}, afterWeight: {...} }
   */
  setAllCalculatedStats(statsData) {
    this._yieldStatsState.setAllCalculatedStats(statsData);
  }

  /**
   * 最後の計算結果を取得
   * @returns {Object|null}
   */
  getLastCalculatedStats() {
    return this._yieldStatsState.getLastCalculatedStats();
  }

  /**
   * 最後の計算結果を設定
   * @param {Object|null} stats
   */
  setLastCalculatedStats(stats) {
    this._yieldStatsState.setLastCalculatedStats(stats);
  }

  /**
   * 現在の表示タイプを取得
   * @returns {string} 'yieldRate' | 'beforeWeight' | 'afterWeight'
   */
  getCurrentDisplayType() {
    return this._yieldStatsState.getCurrentDisplayType();
  }

  /**
   * 現在の表示タイプを設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   */
  setCurrentDisplayType(type) {
    this._yieldStatsState.setCurrentDisplayType(type);
  }

  /**
   * 計算完了フラグを取得
   * @returns {boolean}
   */
  isYieldStatsCalculated() {
    return this._yieldStatsState.isCalculated();
  }

  /**
   * 計算完了フラグを設定
   * @param {boolean} value
   */
  setYieldStatsCalculated(value) {
    this._yieldStatsState.setCalculated(value);
  }

  /**
   * 履歴読込フラグを取得
   * @returns {boolean}
   */
  isYieldStatsFromHistory() {
    return this._yieldStatsState.isFromHistory();
  }

  /**
   * 履歴読込フラグを設定
   * @param {boolean} value
   */
  setYieldStatsFromHistory(value) {
    this._yieldStatsState.setFromHistory(value);
  }

  /**
   * データ有無フラグを取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {boolean}
   */
  hasYieldStatsDataByType(type) {
    return this._yieldStatsState.hasDataByType(type);
  }

  /**
   * 外れ値除外フラグを取得
   * @returns {boolean}
   */
  isOutlierExcluded() {
    return this._yieldStatsState.isOutlierExcluded();
  }

  /**
   * 外れ値除外フラグを設定
   * @param {boolean} value
   */
  setOutlierExcluded(value) {
    this._yieldStatsState.setOutlierExcluded(value);
  }

  /**
   * 手動除外された外れ値のインデックスセットを取得
   * @returns {Set}
   */
  getManuallyExcludedOutlierIndices() {
    return this._yieldStatsState.getManuallyExcludedOutlierIndices();
  }

  /**
   * 現在の外れ値リストを取得
   * @returns {Array}
   */
  getCurrentOutlierValues() {
    return this._yieldStatsState.getCurrentOutlierValues();
  }

  /**
   * 現在の外れ値リストを設定
   * @param {Array} values
   */
  setCurrentOutlierValues(values) {
    this._yieldStatsState.setCurrentOutlierValues(values);
  }

  /**
   * 特定インデックスの外れ値を除外
   * @param {number} index
   */
  excludeOutlierByIndex(index) {
    this._yieldStatsState.excludeOutlierByIndex(index);
  }

  /**
   * 外れ値除外をクリア
   */
  clearExcludedOutliers() {
    this._yieldStatsState.clearExcludedOutliers();
  }

  /**
   * サンプルサイズ妥当性情報を取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {Object|null} { isValid, actualSize, requiredSize }
   */
  getSampleSizeValidation(type) {
    return this._yieldStatsState.getSampleSizeValidation(type);
  }

  /**
   * サンプルサイズ妥当性情報を設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @param {Object|null} validation - { isValid, actualSize, requiredSize }
   */
  setSampleSizeValidation(type, validation) {
    this._yieldStatsState.setSampleSizeValidation(type, validation);
  }

  /**
   * すべての歩留まり統計データをクリア
   */
  clearAllYieldStats() {
    this._yieldStatsState.reset();
  }

  resetAll() {
    this.snapshot.reset();
    this.productData.reset();
    this.currentStep = 1;
    this.loadedHistoryId = null;  // 履歴IDもリセット
    this.isFromHistory = false;
    this.hasUnsavedChanges = false;
    this.saveDialogMode = 'normal'; // ダイアログモードもリセット
    this.showYieldStatsWithMultiPattern = false; // 歩留まり統計表示フラグもリセット

    // 歩留まり統計もリセット
    this.clearAllYieldStats();
  }
}

// シングルトンインスタンスをエクスポート
export const appState = new AppState();
