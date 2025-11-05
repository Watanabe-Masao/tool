/**
 * ステップ1必須フィールドのバリデーションテスト
 * 保存時にステップ1の値が入っていることを確認する
 */

import { validateInputData } from '../scripts/validation.js';
import { ValidationError } from '../scripts/errors.js';
import { MODE } from '../scripts/constants.js';

describe('保存時のバリデーション - ステップ1必須フィールド', () => {
  describe('Fixed モード (calculate)', () => {
    it('正常な入力データは検証を通過する', () => {
      const inputData = {
        yieldMethod: 'calculate',
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      expect(() => validateInputData(inputData, MODE.FIXED)).not.toThrow();
    });

    it('unitCostが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('単価コスト');
      }
    });

    it('unitPriceが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        unitCost: 100,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('単価売価');
      }
    });

    it('beforeWeightが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        unitCost: 100,
        unitPrice: 150,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('加工前重量');
      }
    });

    it('afterWeightが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('加工後重量');
      }
    });

    it('afterPrice100が欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('加工後売価');
      }
    });

    it('0や負の値の場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        unitCost: 0,
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('正の数値');
      }
    });

    it('無効な数値（文字列）の場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        unitCost: 'abc',
        unitPrice: 150,
        beforeWeight: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('有効な数値');
      }
    });
  });

  describe('Fixed モード (direct)', () => {
    it('正常な入力データは検証を通過する', () => {
      const inputData = {
        yieldMethod: 'direct',
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        yieldRate: 85,
        afterPrice100: 200
      };

      expect(() => validateInputData(inputData, MODE.FIXED)).not.toThrow();
    });

    it('yieldRateが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'direct',
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('歩留まり率');
      }
    });

    it('afterWeightは不要（directモード）', () => {
      const inputData = {
        yieldMethod: 'direct',
        unitCost: 100,
        unitPrice: 150,
        beforeWeight: 100,
        yieldRate: 85,
        afterPrice100: 200
        // afterWeightは不要
      };

      expect(() => validateInputData(inputData, MODE.FIXED)).not.toThrow();
    });
  });

  describe('Weight モード (calculate)', () => {
    it('正常な入力データは検証を通過する', () => {
      const inputData = {
        yieldMethod: 'calculate',
        boxCost: 1000,
        boxPrice: 1500,
        boxWeight: 5,
        beforeSample: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      expect(() => validateInputData(inputData, MODE.WEIGHT)).not.toThrow();
    });

    it('boxCostが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        boxPrice: 1500,
        boxWeight: 5,
        beforeSample: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.WEIGHT);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('箱コスト');
      }
    });

    it('boxPriceが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        boxCost: 1000,
        boxWeight: 5,
        beforeSample: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.WEIGHT);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('箱売価');
      }
    });

    it('boxWeightが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        boxCost: 1000,
        boxPrice: 1500,
        beforeSample: 100,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.WEIGHT);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('箱重量');
      }
    });

    it('beforeSampleが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        boxCost: 1000,
        boxPrice: 1500,
        boxWeight: 5,
        afterWeight: 85,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.WEIGHT);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('サンプル重量');
      }
    });

    it('afterWeightが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        boxCost: 1000,
        boxPrice: 1500,
        boxWeight: 5,
        beforeSample: 100,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.WEIGHT);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('加工後重量');
      }
    });

    it('afterPrice100が欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'calculate',
        boxCost: 1000,
        boxPrice: 1500,
        boxWeight: 5,
        beforeSample: 100,
        afterWeight: 85
      };

      try {
        validateInputData(inputData, MODE.WEIGHT);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('加工後売価');
      }
    });
  });

  describe('Weight モード (direct)', () => {
    it('正常な入力データは検証を通過する', () => {
      const inputData = {
        yieldMethod: 'direct',
        boxCost: 1000,
        boxPrice: 1500,
        boxWeight: 5,
        yieldRate: 85,
        afterPrice100: 200
      };

      expect(() => validateInputData(inputData, MODE.WEIGHT)).not.toThrow();
    });

    it('yieldRateが欠けている場合はエラーをスローする', () => {
      const inputData = {
        yieldMethod: 'direct',
        boxCost: 1000,
        boxPrice: 1500,
        boxWeight: 5,
        afterPrice100: 200
      };

      try {
        validateInputData(inputData, MODE.WEIGHT);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect(error.getUserMessage()).toContain('歩留まり率');
      }
    });

    it('beforeSampleとafterWeightは不要（directモード）', () => {
      const inputData = {
        yieldMethod: 'direct',
        boxCost: 1000,
        boxPrice: 1500,
        boxWeight: 5,
        yieldRate: 85,
        afterPrice100: 200
        // beforeSampleとafterWeightは不要
      };

      expect(() => validateInputData(inputData, MODE.WEIGHT)).not.toThrow();
    });
  });

  describe('複数のエラーが同時に発生する場合', () => {
    it('複数のフィールドが欠けている場合、すべてのエラーを含む', () => {
      const inputData = {
        yieldMethod: 'calculate',
        // unitCost, unitPrice, beforeWeight, afterWeight, afterPrice100 すべて欠けている
      };

      try {
        validateInputData(inputData, MODE.FIXED);
        fail('ValidationErrorがスローされるべき');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        const errors = error.getErrors();
        expect(errors.length).toBeGreaterThanOrEqual(5); // 5つのフィールドが欠けている
        const errorMessage = error.getUserMessage();
        expect(errorMessage).toContain('単価コスト');
        expect(errorMessage).toContain('単価売価');
        expect(errorMessage).toContain('加工前重量');
        expect(errorMessage).toContain('加工後重量');
        expect(errorMessage).toContain('加工後売価');
      }
    });
  });
});
