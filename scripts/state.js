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
    this.yieldStatsData = null;     // 歩留まり統計データ（旧 window.yieldStatsData）
    this.saveDialogMode = 'normal'; // 保存ダイアログのモード（'normal' or 'new'）
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

  resetAll() {
    this.snapshot.reset();
    this.productData.reset();
    this.currentStep = 1;
    this.loadedHistoryId = null;  // 履歴IDもリセット
    this.isFromHistory = false;
    this.hasUnsavedChanges = false;
    this.yieldStatsData = null;     // 歩留まり統計データもリセット
    this.saveDialogMode = 'normal'; // ダイアログモードもリセット
  }
}

// シングルトンインスタンスをエクスポート
export const appState = new AppState();
