/**
 * 履歴読み込み時のステップ制御バグのテスト
 * ステップ1に値が入っていないデータを読み込んだ際、ステップ1に戻ることを確認
 */

import { restoreCalculationResults } from '../scripts/history-restore.js';
import { appState } from '../scripts/state.js';
import { MODE } from '../scripts/constants.js';

describe('履歴読み込み時のステップ制御', () => {
  beforeEach(() => {
    // appStateをリセット
    appState.setMode(MODE.FIXED);
    appState.setStep(1);
  });

  describe('有効な結果データの場合', () => {
    it('ステップ3に設定される', () => {
      const validResult = {
        afterCost: 200,
        afterPrice: 300,
        yieldRate: 85,
        beforeCost: 100,
        beforePrice: 150,
        beforeMarkup: 50,
        afterMarkup: 33.33
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', validResult, input);

      expect(appState.getCurrentStep()).toBe(3);
    });

    it('snapshotが更新される', () => {
      const validResult = {
        afterCost: 200,
        afterPrice: 300,
        yieldRate: 85,
        beforeCost: 100,
        beforePrice: 150,
        beforeMarkup: 50,
        afterMarkup: 33.33
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', validResult, input);

      const snapshot = appState.getSnapshot();
      expect(snapshot.afterCost).toBe(200);
      expect(snapshot.afterPrice).toBe(300);
      expect(snapshot.yieldRate).toBe(85);
      expect(snapshot.beforeCost).toBe(100);
      expect(snapshot.beforePrice).toBe(150);
    });
  });

  describe('無効な結果データの場合（バグ修正）', () => {
    it('resultがnullの場合、ステップ1に戻る', () => {
      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', null, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('resultがundefinedの場合、ステップ1に戻る', () => {
      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', undefined, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('resultが空オブジェクトの場合、ステップ1に戻る', () => {
      const emptyResult = {};

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', emptyResult, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('必須フィールド（afterCost）が欠けている場合、ステップ1に戻る', () => {
      const invalidResult = {
        // afterCost: 200, // 欠けている
        afterPrice: 300,
        yieldRate: 85,
        beforeCost: 100,
        beforePrice: 150
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', invalidResult, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('必須フィールド（afterPrice）が欠けている場合、ステップ1に戻る', () => {
      const invalidResult = {
        afterCost: 200,
        // afterPrice: 300, // 欠けている
        yieldRate: 85,
        beforeCost: 100,
        beforePrice: 150
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', invalidResult, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('必須フィールド（yieldRate）が欠けている場合、ステップ1に戻る', () => {
      const invalidResult = {
        afterCost: 200,
        afterPrice: 300,
        // yieldRate: 85, // 欠けている
        beforeCost: 100,
        beforePrice: 150
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', invalidResult, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('必須フィールドがnullの場合、ステップ1に戻る', () => {
      const invalidResult = {
        afterCost: null,
        afterPrice: 300,
        yieldRate: 85,
        beforeCost: 100,
        beforePrice: 150
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', invalidResult, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('必須フィールドがNaNの場合、ステップ1に戻る', () => {
      const invalidResult = {
        afterCost: NaN,
        afterPrice: 300,
        yieldRate: 85,
        beforeCost: 100,
        beforePrice: 150
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', invalidResult, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('必須フィールドがInfinityの場合、ステップ1に戻る', () => {
      const invalidResult = {
        afterCost: Infinity,
        afterPrice: 300,
        yieldRate: 85,
        beforeCost: 100,
        beforePrice: 150
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', invalidResult, input);

      expect(appState.getCurrentStep()).toBe(1);
    });

    it('必須フィールドが空文字列の場合、ステップ1に戻る', () => {
      const invalidResult = {
        afterCost: '',
        afterPrice: 300,
        yieldRate: 85,
        beforeCost: 100,
        beforePrice: 150
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', invalidResult, input);

      expect(appState.getCurrentStep()).toBe(1);
    });
  });

  describe('境界値テスト', () => {
    it('0の値は有効な結果として扱われる', () => {
      const validResult = {
        afterCost: 0,  // 0は有効
        afterPrice: 0,  // 0は有効
        yieldRate: 0,  // 0は有効
        beforeCost: 0,  // 0は有効
        beforePrice: 0  // 0は有効
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', validResult, input);

      // 0は有効な数値なので、ステップ3に進む
      expect(appState.getCurrentStep()).toBe(3);
    });

    it('負の値は有効な結果として扱われる（赤字計算可能）', () => {
      const validResult = {
        afterCost: -100,
        afterPrice: -50,
        yieldRate: 85,
        beforeCost: -200,
        beforePrice: -150
      };

      const input = {
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      restoreCalculationResults(MODE.FIXED, 'calculate', validResult, input);

      expect(appState.getCurrentStep()).toBe(3);
    });
  });
});
