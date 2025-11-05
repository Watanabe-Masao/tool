/**
 * YieldStatsState クラスのユニットテスト
 *
 * テスト対象：
 * - 初期化状態
 * - 生データの管理
 * - 計算結果の管理
 * - UI状態の管理
 * - 外れ値の管理
 * - サンプルサイズ妥当性
 * - リセット機能
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { YieldStatsState } from '../scripts/state/yield-stats-state.js';

describe('YieldStatsState', () => {
  let state;

  beforeEach(() => {
    state = new YieldStatsState();
  });

  describe('初期化', () => {
    it('新しいインスタンスは初期状態である', () => {
      expect(state.getRawData()).toBeNull();
      expect(state.getAllCalculatedStats()).toEqual({
        yieldRate: null,
        beforeWeight: null,
        afterWeight: null
      });
      expect(state.getCurrentDisplayType()).toBe('yieldRate');
      expect(state.isCalculated()).toBe(false);
      expect(state.isFromHistory()).toBe(false);
    });
  });

  describe('生データの管理', () => {
    it('生データを設定・取得できる', () => {
      const data = {
        yieldRate: [80, 85, 90],
        beforeWeight: [100, 110, 120],
        afterWeight: [80, 90, 100]
      };

      state.setRawData(data);
      expect(state.getRawData()).toEqual(data);
    });

    it('生データ設定時にデータ有無フラグが自動更新される', () => {
      const data = {
        yieldRate: [80, 85],
        beforeWeight: [100, 110],
        afterWeight: [80, 90]
      };

      state.setRawData(data);

      expect(state.hasDataByType('yieldRate')).toBe(true);
      expect(state.hasDataByType('beforeWeight')).toBe(true);
      expect(state.hasDataByType('afterWeight')).toBe(true);
    });

    it('データが不十分な場合（<2件）、フラグがfalseになる', () => {
      const data = {
        yieldRate: [80], // 1件のみ
        beforeWeight: [],
        afterWeight: null
      };

      state.setRawData(data);

      expect(state.hasDataByType('yieldRate')).toBe(false);
      expect(state.hasDataByType('beforeWeight')).toBe(false);
      expect(state.hasDataByType('afterWeight')).toBe(false);
    });

    it('データをnullに設定すると全フラグがfalseになる', () => {
      // まずデータを設定
      state.setRawData({
        yieldRate: [80, 85],
        beforeWeight: [100, 110],
        afterWeight: [80, 90]
      });

      // nullを設定
      state.setRawData(null);

      expect(state.hasDataByType('yieldRate')).toBe(false);
      expect(state.hasDataByType('beforeWeight')).toBe(false);
      expect(state.hasDataByType('afterWeight')).toBe(false);
    });
  });

  describe('計算結果の管理', () => {
    it('特定タイプの計算結果を設定・取得できる', () => {
      const stats = {
        mean: 85.5,
        stdDev: 5.2,
        count: 10,
        min: 75,
        max: 95
      };

      state.setCalculatedStats('yieldRate', stats);
      expect(state.getCalculatedStats('yieldRate')).toEqual(stats);
      expect(state.isCalculated()).toBe(true);
    });

    it('すべての計算結果を一度に設定できる', () => {
      const allStats = {
        yieldRate: { mean: 85.5, stdDev: 5.2, count: 10 },
        beforeWeight: { mean: 105.0, stdDev: 10.0, count: 10 },
        afterWeight: { mean: 90.0, stdDev: 8.0, count: 10 }
      };

      state.setAllCalculatedStats(allStats);

      expect(state.getCalculatedStats('yieldRate')).toEqual(allStats.yieldRate);
      expect(state.getCalculatedStats('beforeWeight')).toEqual(allStats.beforeWeight);
      expect(state.getCalculatedStats('afterWeight')).toEqual(allStats.afterWeight);
      expect(state.isCalculated()).toBe(true);
    });

    it('最後の計算結果が記録される', () => {
      const stats1 = { mean: 85.5, stdDev: 5.2 };
      const stats2 = { mean: 105.0, stdDev: 10.0 };

      state.setCalculatedStats('yieldRate', stats1);
      expect(state.getLastCalculatedStats()).toEqual(stats1);

      state.setCalculatedStats('beforeWeight', stats2);
      expect(state.getLastCalculatedStats()).toEqual(stats2);
    });
  });

  describe('UI状態の管理', () => {
    it('表示タイプを変更できる', () => {
      expect(state.getCurrentDisplayType()).toBe('yieldRate');

      state.setCurrentDisplayType('beforeWeight');
      expect(state.getCurrentDisplayType()).toBe('beforeWeight');
    });

    it('表示タイプ変更時に外れ値除外がクリアされる', () => {
      // 外れ値を除外
      state.excludeOutlierByIndex(0);
      state.excludeOutlierByIndex(1);
      expect(state.getManuallyExcludedOutlierIndices().size).toBe(2);

      // 表示タイプを変更
      state.setCurrentDisplayType('beforeWeight');

      // 外れ値除外がクリアされる
      expect(state.getManuallyExcludedOutlierIndices().size).toBe(0);
      expect(state.isOutlierExcluded()).toBe(false);
    });

    it('計算完了フラグを設定・取得できる', () => {
      expect(state.isCalculated()).toBe(false);

      state.setCalculated(true);
      expect(state.isCalculated()).toBe(true);
    });

    it('履歴読込フラグを設定・取得できる', () => {
      expect(state.isFromHistory()).toBe(false);

      state.setFromHistory(true);
      expect(state.isFromHistory()).toBe(true);
    });
  });

  describe('外れ値の管理', () => {
    it('外れ値を除外できる', () => {
      state.excludeOutlierByIndex(0);
      state.excludeOutlierByIndex(2);
      state.excludeOutlierByIndex(5);

      const excluded = state.getManuallyExcludedOutlierIndices();
      expect(excluded.size).toBe(3);
      expect(excluded.has(0)).toBe(true);
      expect(excluded.has(2)).toBe(true);
      expect(excluded.has(5)).toBe(true);
      expect(state.isOutlierExcluded()).toBe(true);
    });

    it('外れ値の値リストを設定・取得できる', () => {
      const outliers = [
        { index: 0, value: 50 },
        { index: 5, value: 120 }
      ];

      state.setCurrentOutlierValues(outliers);
      expect(state.getCurrentOutlierValues()).toEqual(outliers);
    });

    it('外れ値除外をクリアできる', () => {
      state.excludeOutlierByIndex(0);
      state.setCurrentOutlierValues([{ index: 0, value: 50 }]);

      state.clearExcludedOutliers();

      expect(state.getManuallyExcludedOutlierIndices().size).toBe(0);
      expect(state.getCurrentOutlierValues()).toEqual([]);
      expect(state.isOutlierExcluded()).toBe(false);
    });
  });

  describe('サンプルサイズ妥当性', () => {
    it('妥当性情報を設定・取得できる', () => {
      const validation = {
        isValid: true,
        actualSize: 30,
        requiredSize: 25
      };

      state.setSampleSizeValidation('yieldRate', validation);
      expect(state.getSampleSizeValidation('yieldRate')).toEqual(validation);
    });

    it('タイプごとに独立して管理される', () => {
      const validationYield = { isValid: true, actualSize: 30, requiredSize: 25 };
      const validationBefore = { isValid: false, actualSize: 10, requiredSize: 25 };

      state.setSampleSizeValidation('yieldRate', validationYield);
      state.setSampleSizeValidation('beforeWeight', validationBefore);

      expect(state.getSampleSizeValidation('yieldRate')).toEqual(validationYield);
      expect(state.getSampleSizeValidation('beforeWeight')).toEqual(validationBefore);
    });
  });

  describe('リセット機能', () => {
    it('reset()で全ての状態がクリアされる', () => {
      // 様々な状態を設定
      state.setRawData({ yieldRate: [80, 85, 90] });
      state.setCalculatedStats('yieldRate', { mean: 85, stdDev: 5 });
      state.setCurrentDisplayType('beforeWeight');
      state.setCalculated(true);
      state.setFromHistory(true);
      state.excludeOutlierByIndex(0);
      state.setSampleSizeValidation('yieldRate', { isValid: true, actualSize: 30 });

      // リセット
      state.reset();

      // 全て初期状態に戻る
      expect(state.getRawData()).toBeNull();
      expect(state.getCalculatedStats('yieldRate')).toBeNull();
      expect(state.getCurrentDisplayType()).toBe('yieldRate');
      expect(state.isCalculated()).toBe(false);
      expect(state.isFromHistory()).toBe(false);
      expect(state.getManuallyExcludedOutlierIndices().size).toBe(0);
      expect(state.getSampleSizeValidation('yieldRate')).toBeNull();
    });
  });

  describe('スナップショット機能', () => {
    it('getSnapshot()で現在の状態概要を取得できる', () => {
      state.setRawData({ yieldRate: [80, 85, 90] });
      state.setCalculatedStats('yieldRate', { mean: 85 });
      state.excludeOutlierByIndex(0);

      const snapshot = state.getSnapshot();

      expect(snapshot.hasRawData).toBe(true);
      expect(snapshot.calculatedStats.yieldRate).toBe(true);
      expect(snapshot.calculatedStats.beforeWeight).toBe(false);
      expect(snapshot.outliers.excludedCount).toBe(1);
    });
  });
});
