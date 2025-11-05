/**
 * AppState のユニットテスト
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AppState } from '../scripts/state.js';
import { MODE } from '../scripts/constants.js';

describe('AppState', () => {
  let state;

  beforeEach(() => {
    state = new AppState();
  });

  describe('初期化', () => {
    it('新しいインスタンスは初期状態である', () => {
      expect(state.mode).toBe(MODE.FIXED);
      expect(state.currentStep).toBe(1);
      expect(state.loadedHistoryId).toBeNull();
      expect(state.isFromHistory).toBe(false);
      expect(state.hasUnsavedChanges).toBe(false);
      expect(state.showYieldStatsWithMultiPattern).toBe(false);
      expect(state.saveDialogMode).toBe('normal');
    });

    it('YieldStatsState がコンポジションされている', () => {
      expect(state._yieldStatsState).toBeDefined();
      expect(state.yieldStats).toBe(state._yieldStatsState); // 後方互換性
    });

    it('CalculationSnapshot が初期化されている', () => {
      expect(state.snapshot).toBeDefined();
      expect(state.snapshot.afterCost).toBeNull();
      expect(state.snapshot.afterPrice).toBeNull();
      expect(state.snapshot.isValid()).toBe(false);
    });

    it('ProductSimulationData が初期化されている', () => {
      expect(state.productData).toBeDefined();
      expect(state.productData.price).toBeNull();
      expect(state.productData.markup).toBeNull();
      expect(state.productData.cost).toBeNull();
      expect(state.productData.isValid()).toBe(false);
    });
  });

  describe('モード管理', () => {
    it('setMode()でモードを変更できる', () => {
      state.setMode(MODE.REVERSE);
      expect(state.getMode()).toBe(MODE.REVERSE);
    });

    it('モード変更時にステップが1にリセットされる', () => {
      state.currentStep = 3;
      state.setMode(MODE.REVERSE);
      expect(state.currentStep).toBe(1);
    });
  });

  describe('ステップ管理', () => {
    it('setStep()でステップを変更できる', () => {
      state.setStep(2);
      expect(state.getCurrentStep()).toBe(2);

      state.setStep(3);
      expect(state.getCurrentStep()).toBe(3);
    });
  });

  describe('履歴ID管理', () => {
    it('setLoadedHistoryId()で履歴IDを設定できる', () => {
      state.setLoadedHistoryId(123);
      expect(state.getLoadedHistoryId()).toBe(123);
    });

    it('clearLoadedHistoryId()でクリアできる', () => {
      state.setLoadedHistoryId(456);
      state.clearLoadedHistoryId();
      expect(state.getLoadedHistoryId()).toBeNull();
    });
  });

  describe('CalculationSnapshot', () => {
    it('update()で計算結果を更新できる', () => {
      state.snapshot.update({
        ac: 100,  // afterCost
        ap: 150,  // afterPrice
        bm: 0.5,  // beforeMarkup
        am: 0.5,  // afterMarkup
        bp: 120,  // beforePrice
        bc: 80,   // beforeCost
        yr: 90    // yieldRate
      });

      expect(state.snapshot.afterCost).toBe(100);
      expect(state.snapshot.afterPrice).toBe(150);
      expect(state.snapshot.beforeMarkup).toBe(0.5);
      expect(state.snapshot.afterMarkup).toBe(0.5);
      expect(state.snapshot.beforePrice).toBe(120);
      expect(state.snapshot.beforeCost).toBe(80);
      expect(state.snapshot.yieldRate).toBe(90);
      expect(state.snapshot.isValid()).toBe(true);
    });

    it('reset()で計算結果をクリアできる', () => {
      state.snapshot.update({ ac: 100, ap: 150 });
      state.snapshot.reset();

      expect(state.snapshot.afterCost).toBeNull();
      expect(state.snapshot.afterPrice).toBeNull();
      expect(state.snapshot.isValid()).toBe(false);
    });

    it('無効な値の場合、isValid()がfalseを返す', () => {
      state.snapshot.update({ ac: NaN, ap: 150 });
      expect(state.snapshot.isValid()).toBe(false);

      state.snapshot.update({ ac: 100, ap: null });
      expect(state.snapshot.isValid()).toBe(false);
    });
  });

  describe('ProductSimulationData', () => {
    it('update()で商品データを更新できる', () => {
      state.productData.update({
        price: 200,
        markup: 0.6,
        cost: 125
      });

      expect(state.productData.price).toBe(200);
      expect(state.productData.markup).toBe(0.6);
      expect(state.productData.cost).toBe(125);
      expect(state.productData.isValid()).toBe(true);
    });

    it('reset()で商品データをクリアできる', () => {
      state.productData.update({ price: 200, markup: 0.6, cost: 125 });
      state.productData.reset();

      expect(state.productData.price).toBeNull();
      expect(state.productData.markup).toBeNull();
      expect(state.productData.cost).toBeNull();
      expect(state.productData.isValid()).toBe(false);
    });

    it('無効な値の場合、isValid()がfalseを返す', () => {
      state.productData.update({ price: null, markup: 0.6 });
      expect(state.productData.isValid()).toBe(false);

      state.productData.update({ price: 200, markup: Infinity });
      expect(state.productData.isValid()).toBe(false);
    });
  });

  describe('UI状態フラグ', () => {
    it('isFromHistory フラグを設定/取得できる', () => {
      state.isFromHistory = true;
      expect(state.isFromHistory).toBe(true);
    });

    it('hasUnsavedChanges フラグを設定/取得できる', () => {
      state.hasUnsavedChanges = true;
      expect(state.hasUnsavedChanges).toBe(true);
    });

    it('showYieldStatsWithMultiPattern フラグを設定/取得できる', () => {
      state.showYieldStatsWithMultiPattern = true;
      expect(state.showYieldStatsWithMultiPattern).toBe(true);
    });

    it('saveDialogMode を設定/取得できる', () => {
      state.saveDialogMode = 'new';
      expect(state.saveDialogMode).toBe('new');
    });
  });

  describe('YieldStatsState との統合', () => {
    it('歩留まり統計の状態にアクセスできる', () => {
      // YieldStatsStateのメソッドにアクセス可能
      expect(typeof state.yieldStats.getRawData).toBe('function');
      expect(typeof state.yieldStats.setRawData).toBe('function');
      expect(typeof state.yieldStats.isCalculated).toBe('function');
    });

    it('歩留まり統計データを設定/取得できる', () => {
      const testData = { yieldRate: [80, 85, 90] };
      state.yieldStats.setRawData(testData);

      expect(state.yieldStats.getRawData()).toEqual(testData);
    });

    it('_yieldStatsState と yieldStats は同じインスタンス', () => {
      expect(state.yieldStats).toBe(state._yieldStatsState);
    });
  });

  describe('全体のリセット', () => {
    it('複数の状態を持つ場合でも独立して管理される', () => {
      // 全ての状態を設定
      state.setMode(MODE.REVERSE);
      state.setStep(3);
      state.setLoadedHistoryId(789);
      state.snapshot.update({ ac: 100, ap: 150 });
      state.productData.update({ price: 200, markup: 0.6 });
      state.isFromHistory = true;
      state.hasUnsavedChanges = true;

      // snapshot のみリセット
      state.snapshot.reset();

      // snapshot はリセットされるが、他の状態は保持される
      expect(state.snapshot.isValid()).toBe(false);
      expect(state.getMode()).toBe(MODE.REVERSE);
      expect(state.getCurrentStep()).toBe(3);
      expect(state.getLoadedHistoryId()).toBe(789);
      expect(state.productData.isValid()).toBe(true);
      expect(state.isFromHistory).toBe(true);
    });
  });

  describe('境界値テスト', () => {
    it('負の値も正しく処理される', () => {
      state.snapshot.update({ ac: -100, ap: -50 });
      expect(state.snapshot.afterCost).toBe(-100);
      expect(state.snapshot.afterPrice).toBe(-50);
      expect(state.snapshot.isValid()).toBe(true); // 負の値でも有限値なのでvalid
    });

    it('0の値も正しく処理される', () => {
      state.snapshot.update({ ac: 0, ap: 0 });
      expect(state.snapshot.afterCost).toBe(0);
      expect(state.snapshot.afterPrice).toBe(0);
      expect(state.snapshot.isValid()).toBe(true);
    });

    it('非常に大きな値も正しく処理される', () => {
      const largeValue = Number.MAX_SAFE_INTEGER;
      state.snapshot.update({ ac: largeValue, ap: largeValue });
      expect(state.snapshot.afterCost).toBe(largeValue);
      expect(state.snapshot.isValid()).toBe(true);
    });
  });
});
