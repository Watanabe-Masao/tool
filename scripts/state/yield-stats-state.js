/**
 * 歩留まり統計の状態管理
 *
 * 責務：
 * - 歩留まり統計の生データ管理
 * - 計算結果の管理
 * - UI状態の管理
 * - 外れ値の管理
 * - サンプルサイズ妥当性の管理
 *
 * 設計原則：
 * - 単一責任原則：歩留まり統計の状態のみを管理
 * - カプセル化：状態変更は必ずメソッド経由
 * - テスタビリティ：純粋な状態管理、副作用なし
 */
export class YieldStatsState {
  constructor() {
    this.reset();
  }

  /**
   * すべての状態を初期化
   */
  reset() {
    // 生データ（旧 yieldStatsData から移行）
    this.rawData = null;  // { yieldRate: [...], beforeWeight: [...], afterWeight: [...] }

    // 計算結果（旧 window.statsDataByType から移行）
    this.calculatedStats = {
      yieldRate: null,      // { mean, stdDev, count, min, max, median, mode, ... }
      beforeWeight: null,
      afterWeight: null
    };

    // UI状態（旧 window.yieldStatsState から移行）
    this.ui = {
      currentDisplayType: 'yieldRate',
      isCalculated: false,
      isFromHistory: false,
      hasYieldRateData: false,
      hasBeforeWeightData: false,
      hasAfterWeightData: false,
      isOutlierExcluded: false
    };

    // 外れ値管理（旧 window.yieldStatsState から移行）
    this.outliers = {
      manuallyExcludedIndices: new Set(),
      currentValues: []
    };

    // サンプルサイズ妥当性（旧 window.yieldStatsState.sampleSizeValidation から移行）
    this.validation = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };

    // 最後の計算結果キャッシュ（旧 window.lastCalculatedStats から移行）
    this.lastCalculated = null;
  }

  // ========================================
  // 生データの管理
  // ========================================

  /**
   * 歩留まり統計の生データを取得
   * @returns {Object|null} { yieldRate: [...], beforeWeight: [...], afterWeight: [...] }
   */
  getRawData() {
    return this.rawData;
  }

  /**
   * 歩留まり統計の生データを設定
   * @param {Object|null} data - { yieldRate: [...], beforeWeight: [...], afterWeight: [...] }
   */
  setRawData(data) {
    this.rawData = data;

    // データ有無フラグを自動更新
    if (data) {
      this.ui.hasYieldRateData = Boolean(data.yieldRate && Array.isArray(data.yieldRate) && data.yieldRate.length >= 2);
      this.ui.hasBeforeWeightData = Boolean(data.beforeWeight && Array.isArray(data.beforeWeight) && data.beforeWeight.length >= 2);
      this.ui.hasAfterWeightData = Boolean(data.afterWeight && Array.isArray(data.afterWeight) && data.afterWeight.length >= 2);
    } else {
      this.ui.hasYieldRateData = false;
      this.ui.hasBeforeWeightData = false;
      this.ui.hasAfterWeightData = false;
    }
  }

  // ========================================
  // 計算結果の管理
  // ========================================

  /**
   * 特定タイプの計算結果を取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {Object|null} 統計計算結果
   */
  getCalculatedStats(type) {
    return this.calculatedStats[type];
  }

  /**
   * すべての計算結果を取得
   * @returns {Object} { yieldRate: {...}, beforeWeight: {...}, afterWeight: {...} }
   */
  getAllCalculatedStats() {
    return this.calculatedStats;
  }

  /**
   * 特定タイプの計算結果を設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @param {Object|null} stats - 統計計算結果
   */
  setCalculatedStats(type, stats) {
    this.calculatedStats[type] = stats;

    if (stats) {
      this.ui.isCalculated = true;
      this.lastCalculated = stats;
    }
  }

  /**
   * すべての計算結果を設定
   * @param {Object} statsData - { yieldRate: {...}, beforeWeight: {...}, afterWeight: {...} }
   */
  setAllCalculatedStats(statsData) {
    if (statsData) {
      this.calculatedStats.yieldRate = statsData.yieldRate || null;
      this.calculatedStats.beforeWeight = statsData.beforeWeight || null;
      this.calculatedStats.afterWeight = statsData.afterWeight || null;

      // いずれかのデータがあれば計算完了とみなす
      if (statsData.yieldRate || statsData.beforeWeight || statsData.afterWeight) {
        this.ui.isCalculated = true;
        // 最初に見つかったデータをlastCalculatedに設定
        this.lastCalculated = statsData.yieldRate || statsData.beforeWeight || statsData.afterWeight;
      }
    }
  }

  /**
   * 最後の計算結果を取得
   * @returns {Object|null}
   */
  getLastCalculatedStats() {
    return this.lastCalculated;
  }

  /**
   * 最後の計算結果を設定
   * @param {Object|null} stats
   */
  setLastCalculatedStats(stats) {
    this.lastCalculated = stats;
  }

  // ========================================
  // UI状態の管理
  // ========================================

  /**
   * 現在の表示タイプを取得
   * @returns {string} 'yieldRate' | 'beforeWeight' | 'afterWeight'
   */
  getCurrentDisplayType() {
    return this.ui.currentDisplayType;
  }

  /**
   * 現在の表示タイプを設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   */
  setCurrentDisplayType(type) {
    // タイプが変更された場合、外れ値除外をリセット
    if (this.ui.currentDisplayType !== type) {
      this.clearExcludedOutliers();
    }
    this.ui.currentDisplayType = type;
  }

  /**
   * 計算完了フラグを取得
   * @returns {boolean}
   */
  isCalculated() {
    return this.ui.isCalculated;
  }

  /**
   * 計算完了フラグを設定
   * @param {boolean} value
   */
  setCalculated(value) {
    this.ui.isCalculated = value;
  }

  /**
   * 履歴読込フラグを取得
   * @returns {boolean}
   */
  isFromHistory() {
    return this.ui.isFromHistory;
  }

  /**
   * 履歴読込フラグを設定
   * @param {boolean} value
   */
  setFromHistory(value) {
    this.ui.isFromHistory = value;
  }

  /**
   * データ有無フラグを取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {boolean}
   */
  hasDataByType(type) {
    if (type === 'yieldRate') {
      return this.ui.hasYieldRateData;
    }
    if (type === 'beforeWeight') {
      return this.ui.hasBeforeWeightData;
    }
    if (type === 'afterWeight') {
      return this.ui.hasAfterWeightData;
    }
    return false;
  }

  /**
   * 外れ値除外フラグを取得
   * @returns {boolean}
   */
  isOutlierExcluded() {
    return this.ui.isOutlierExcluded;
  }

  /**
   * 外れ値除外フラグを設定
   * @param {boolean} value
   */
  setOutlierExcluded(value) {
    this.ui.isOutlierExcluded = value;
  }

  // ========================================
  // 外れ値の管理
  // ========================================

  /**
   * 手動除外された外れ値のインデックスセットを取得
   * @returns {Set}
   */
  getManuallyExcludedOutlierIndices() {
    return this.outliers.manuallyExcludedIndices;
  }

  /**
   * 現在の外れ値リストを取得
   * @returns {Array}
   */
  getCurrentOutlierValues() {
    return this.outliers.currentValues;
  }

  /**
   * 現在の外れ値リストを設定
   * @param {Array} values
   */
  setCurrentOutlierValues(values) {
    this.outliers.currentValues = values;
  }

  /**
   * 特定インデックスの外れ値を除外
   * @param {number} index
   */
  excludeOutlierByIndex(index) {
    this.outliers.manuallyExcludedIndices.add(index);
    this.ui.isOutlierExcluded = true;
  }

  /**
   * 外れ値除外をクリア
   */
  clearExcludedOutliers() {
    this.outliers.manuallyExcludedIndices.clear();
    this.outliers.currentValues = [];
    this.ui.isOutlierExcluded = false;
  }

  // ========================================
  // サンプルサイズ妥当性の管理
  // ========================================

  /**
   * サンプルサイズ妥当性情報を取得
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @returns {Object|null} { isValid, actualSize, requiredSize }
   */
  getSampleSizeValidation(type) {
    return this.validation[type];
  }

  /**
   * サンプルサイズ妥当性情報を設定
   * @param {string} type - 'yieldRate' | 'beforeWeight' | 'afterWeight'
   * @param {Object|null} validation - { isValid, actualSize, requiredSize }
   */
  setSampleSizeValidation(type, validation) {
    this.validation[type] = validation;
  }

  // ========================================
  // ユーティリティ
  // ========================================

  /**
   * 状態のスナップショットを取得（デバッグ用）
   * @returns {Object} 現在の状態
   */
  getSnapshot() {
    return {
      hasRawData: this.rawData !== null,
      calculatedStats: {
        yieldRate: this.calculatedStats.yieldRate !== null,
        beforeWeight: this.calculatedStats.beforeWeight !== null,
        afterWeight: this.calculatedStats.afterWeight !== null
      },
      ui: { ...this.ui },
      outliers: {
        excludedCount: this.outliers.manuallyExcludedIndices.size,
        currentValuesCount: this.outliers.currentValues.length
      },
      validation: { ...this.validation }
    };
  }
}
