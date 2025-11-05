/**
 * AppState の歩留まり統計メソッドのユニットテスト
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { AppState } from '../scripts/state.js';

describe('AppState - 歩留まり統計メソッド', () => {
  let appState;

  beforeEach(() => {
    appState = new AppState();
  });

  describe('生データ管理', () => {
    test('getYieldStatsRawData() は初期状態でnullを返す', () => {
      expect(appState.getYieldStatsRawData()).toBeNull();
    });

    test('setYieldStatsRawData() でデータを設定できる', () => {
      const data = {
        yieldRate: [80, 82, 85],
        beforeWeight: [100, 105, 102],
        afterWeight: [80, 86, 85]
      };

      appState.setYieldStatsRawData(data);
      expect(appState.getYieldStatsRawData()).toEqual(data);
    });

    test('setYieldStatsRawData() はデータ有無フラグを自動更新する', () => {
      const data = {
        yieldRate: [80, 82, 85],
        beforeWeight: [100, 105, 102],
        afterWeight: [80, 86, 85]
      };

      appState.setYieldStatsRawData(data);

      expect(appState.hasYieldStatsDataByType('yieldRate')).toBe(true);
      expect(appState.hasYieldStatsDataByType('beforeWeight')).toBe(true);
      expect(appState.hasYieldStatsDataByType('afterWeight')).toBe(true);
    });

    test('setYieldStatsRawData(null) でデータ有無フラグもクリアされる', () => {
      const data = {
        yieldRate: [80, 82, 85],
        beforeWeight: [100, 105, 102],
        afterWeight: [80, 86, 85]
      };

      appState.setYieldStatsRawData(data);
      expect(appState.hasYieldStatsDataByType('yieldRate')).toBe(true);

      appState.setYieldStatsRawData(null);
      expect(appState.hasYieldStatsDataByType('yieldRate')).toBe(false);
      expect(appState.hasYieldStatsDataByType('beforeWeight')).toBe(false);
      expect(appState.hasYieldStatsDataByType('afterWeight')).toBe(false);
    });

    test('データが1件以下の場合、データ有無フラグはfalse', () => {
      const data = {
        yieldRate: [80],  // 1件のみ
        beforeWeight: [],
        afterWeight: null
      };

      appState.setYieldStatsRawData(data);

      expect(appState.hasYieldStatsDataByType('yieldRate')).toBe(false);
      expect(appState.hasYieldStatsDataByType('beforeWeight')).toBe(false);
      expect(appState.hasYieldStatsDataByType('afterWeight')).toBe(false);
    });
  });

  describe('計算結果管理', () => {
    test('getCalculatedStats() は初期状態でnullを返す', () => {
      expect(appState.getCalculatedStats('yieldRate')).toBeNull();
    });

    test('setCalculatedStats() で計算結果を設定できる', () => {
      const stats = {
        mean: 82.33,
        stdDev: 2.05,
        count: 3,
        min: 80,
        max: 85
      };

      appState.setCalculatedStats('yieldRate', stats);
      expect(appState.getCalculatedStats('yieldRate')).toEqual(stats);
    });

    test('setCalculatedStats() は計算完了フラグを自動更新する', () => {
      const stats = { mean: 82.33, stdDev: 2.05, count: 3 };

      appState.setCalculatedStats('yieldRate', stats);

      expect(appState.isYieldStatsCalculated()).toBe(true);
    });

    test('setCalculatedStats() は lastCalculated を自動更新する', () => {
      const stats = { mean: 82.33, stdDev: 2.05, count: 3 };

      appState.setCalculatedStats('yieldRate', stats);

      expect(appState.getLastCalculatedStats()).toEqual(stats);
    });

    test('getAllCalculatedStats() ですべての計算結果を取得できる', () => {
      const yieldRateStats = { mean: 82, stdDev: 2, count: 3 };
      const beforeWeightStats = { mean: 102, stdDev: 2.5, count: 3 };

      appState.setCalculatedStats('yieldRate', yieldRateStats);
      appState.setCalculatedStats('beforeWeight', beforeWeightStats);

      const all = appState.getAllCalculatedStats();
      expect(all.yieldRate).toEqual(yieldRateStats);
      expect(all.beforeWeight).toEqual(beforeWeightStats);
      expect(all.afterWeight).toBeNull();
    });

    test('setAllCalculatedStats() で一度に設定できる', () => {
      const statsData = {
        yieldRate: { mean: 82, stdDev: 2, count: 3 },
        beforeWeight: { mean: 102, stdDev: 2.5, count: 3 },
        afterWeight: { mean: 84, stdDev: 2, count: 3 }
      };

      appState.setAllCalculatedStats(statsData);

      expect(appState.getCalculatedStats('yieldRate')).toEqual(statsData.yieldRate);
      expect(appState.getCalculatedStats('beforeWeight')).toEqual(statsData.beforeWeight);
      expect(appState.getCalculatedStats('afterWeight')).toEqual(statsData.afterWeight);
      expect(appState.isYieldStatsCalculated()).toBe(true);
    });
  });

  describe('表示タイプ管理', () => {
    test('getCurrentDisplayType() は初期状態で"yieldRate"を返す', () => {
      expect(appState.getCurrentDisplayType()).toBe('yieldRate');
    });

    test('setCurrentDisplayType() で表示タイプを変更できる', () => {
      appState.setCurrentDisplayType('beforeWeight');
      expect(appState.getCurrentDisplayType()).toBe('beforeWeight');
    });

    test('表示タイプ変更時に外れ値除外がクリアされる', () => {
      appState.excludeOutlierByIndex(0);
      expect(appState.getManuallyExcludedOutlierIndices().size).toBe(1);

      appState.setCurrentDisplayType('beforeWeight');
      expect(appState.getManuallyExcludedOutlierIndices().size).toBe(0);
      expect(appState.getCurrentOutlierValues()).toEqual([]);
      expect(appState.isOutlierExcluded()).toBe(false);
    });

    test('同じタイプに変更しても外れ値除外はクリアされない', () => {
      appState.excludeOutlierByIndex(0);
      expect(appState.getManuallyExcludedOutlierIndices().size).toBe(1);

      appState.setCurrentDisplayType('yieldRate'); // 同じタイプ
      expect(appState.getManuallyExcludedOutlierIndices().size).toBe(1);
    });
  });

  describe('外れ値管理', () => {
    test('excludeOutlierByIndex() でインデックスを追加できる', () => {
      appState.excludeOutlierByIndex(0);
      appState.excludeOutlierByIndex(2);

      const indices = appState.getManuallyExcludedOutlierIndices();
      expect(indices.has(0)).toBe(true);
      expect(indices.has(2)).toBe(true);
      expect(appState.isOutlierExcluded()).toBe(true);
    });

    test('setCurrentOutlierValues() で外れ値リストを設定できる', () => {
      const outliers = [75, 95, 100];
      appState.setCurrentOutlierValues(outliers);

      expect(appState.getCurrentOutlierValues()).toEqual(outliers);
    });

    test('clearExcludedOutliers() ですべての外れ値情報をクリアできる', () => {
      appState.excludeOutlierByIndex(0);
      appState.setCurrentOutlierValues([75, 95]);
      appState.setOutlierExcluded(true);

      appState.clearExcludedOutliers();

      expect(appState.getManuallyExcludedOutlierIndices().size).toBe(0);
      expect(appState.getCurrentOutlierValues()).toEqual([]);
      expect(appState.isOutlierExcluded()).toBe(false);
    });
  });

  describe('フラグ管理', () => {
    test('isYieldStatsCalculated() は初期状態でfalse', () => {
      expect(appState.isYieldStatsCalculated()).toBe(false);
    });

    test('setYieldStatsCalculated() でフラグを変更できる', () => {
      appState.setYieldStatsCalculated(true);
      expect(appState.isYieldStatsCalculated()).toBe(true);
    });

    test('isYieldStatsFromHistory() は初期状態でfalse', () => {
      expect(appState.isYieldStatsFromHistory()).toBe(false);
    });

    test('setYieldStatsFromHistory() でフラグを変更できる', () => {
      appState.setYieldStatsFromHistory(true);
      expect(appState.isYieldStatsFromHistory()).toBe(true);
    });
  });

  describe('サンプルサイズ妥当性', () => {
    test('getSampleSizeValidation() は初期状態でnull', () => {
      expect(appState.getSampleSizeValidation('yieldRate')).toBeNull();
    });

    test('setSampleSizeValidation() で妥当性情報を設定できる', () => {
      const validation = {
        isValid: true,
        actualSize: 10,
        requiredSize: 8
      };

      appState.setSampleSizeValidation('yieldRate', validation);
      expect(appState.getSampleSizeValidation('yieldRate')).toEqual(validation);
    });
  });

  describe('すべてクリア', () => {
    test('clearAllYieldStats() ですべての歩留まり統計データをクリアできる', () => {
      // データを設定
      appState.setYieldStatsRawData({ yieldRate: [80, 82, 85] });
      appState.setCalculatedStats('yieldRate', { mean: 82, stdDev: 2, count: 3 });
      appState.setCurrentDisplayType('beforeWeight');
      appState.excludeOutlierByIndex(0);
      appState.setYieldStatsCalculated(true);
      appState.setYieldStatsFromHistory(true);
      appState.setSampleSizeValidation('yieldRate', { isValid: true, actualSize: 3, requiredSize: 2 });

      // クリア
      appState.clearAllYieldStats();

      // すべてリセットされているか確認
      expect(appState.getYieldStatsRawData()).toBeNull();
      expect(appState.getCalculatedStats('yieldRate')).toBeNull();
      expect(appState.getCurrentDisplayType()).toBe('yieldRate');
      expect(appState.getManuallyExcludedOutlierIndices().size).toBe(0);
      expect(appState.isYieldStatsCalculated()).toBe(false);
      expect(appState.isYieldStatsFromHistory()).toBe(false);
      expect(appState.getSampleSizeValidation('yieldRate')).toBeNull();
    });

    test('resetAll() は歩留まり統計データもクリアする', () => {
      appState.setYieldStatsRawData({ yieldRate: [80, 82, 85] });
      appState.setCalculatedStats('yieldRate', { mean: 82, stdDev: 2, count: 3 });

      appState.resetAll();

      expect(appState.getYieldStatsRawData()).toBeNull();
      expect(appState.getCalculatedStats('yieldRate')).toBeNull();
    });
  });

  // Phase 0で後方互換性コードを削除したため、関連テストも削除
});
