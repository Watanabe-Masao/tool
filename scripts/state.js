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
  }

  update({ ac, ap, bm, am, bp, bc }) {
    this.afterCost = ac;
    this.afterPrice = ap;
    this.beforeMarkup = bm;
    this.afterMarkup = am;
    this.beforePrice = bp;
    this.beforeCost = bc;
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

  resetAll() {
    this.snapshot.reset();
    this.productData.reset();
    this.currentStep = 1;
  }
}

// シングルトンインスタンスをエクスポート
export const appState = new AppState();
