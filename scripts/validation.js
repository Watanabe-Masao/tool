/**
 * データ検証レイヤー
 * 入力データの妥当性をチェックし、一貫性のあるエラーメッセージを提供
 */

import { ValidationError } from './errors.js';
import { MODE, YIELD_METHOD } from './constants.js';

/**
 * 文字列の長さを検証
 */
function validateStringLength(value, fieldName, minLength = 0, maxLength = 255) {
  const errors = [];

  if (typeof value !== 'string') {
    errors.push(`${fieldName}は文字列である必要があります`);
    return errors;
  }

  const trimmed = value.trim();

  if (minLength > 0 && trimmed.length < minLength) {
    errors.push(`${fieldName}は${minLength}文字以上で入力してください`);
  }

  if (maxLength && trimmed.length > maxLength) {
    errors.push(`${fieldName}は${maxLength}文字以内で入力してください`);
  }

  return errors;
}

/**
 * 必須フィールドを検証
 */
function validateRequired(value, fieldName) {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return [`${fieldName}は必須です`];
  }
  return [];
}

/**
 * オブジェクト型を検証
 */
function validateObject(value, fieldName) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [`${fieldName}はオブジェクトである必要があります`];
  }
  return [];
}

/**
 * 計算データ名を検証
 */
export function validateName(name) {
  const errors = [];

  errors.push(...validateRequired(name, '計算名'));

  if (typeof name === 'string') {
    errors.push(...validateStringLength(name, '計算名', 1, 100));
  }

  if (errors.length > 0) {
    throw new ValidationError('計算名が不正です', errors);
  }

  return true;
}

/**
 * モードを検証
 */
export function validateMode(mode) {
  const errors = [];

  errors.push(...validateRequired(mode, 'モード'));

  const validModes = Object.values(MODE);
  if (!validModes.includes(mode)) {
    errors.push(`モードは次のいずれかである必要があります: ${validModes.join(', ')}`);
  }

  if (errors.length > 0) {
    throw new ValidationError('モードが不正です', errors);
  }

  return true;
}

/**
 * 入力データを検証
 */
export function validateInputData(inputData, mode) {
  const errors = [];

  errors.push(...validateRequired(inputData, '入力データ'));
  errors.push(...validateObject(inputData, '入力データ'));

  if (errors.length > 0) {
    throw new ValidationError('入力データが不正です', errors);
  }

  // モード固有の検証
  switch (mode) {
    case MODE.FIXED:
      errors.push(...validateFixedModeInput(inputData));
      break;
    case MODE.WEIGHT:
      errors.push(...validateWeightModeInput(inputData));
      break;
    case MODE.YIELD_STATS:
      errors.push(...validateYieldStatsInput(inputData));
      break;
    case MODE.MULTI_PATTERN:
      errors.push(...validateMultiPatternInput(inputData));
      break;
  }

  if (errors.length > 0) {
    throw new ValidationError('入力データが不正です', errors);
  }

  return true;
}

/**
 * 定額モードの入力データを検証
 */
function validateFixedModeInput(inputData) {
  const errors = [];

  // yieldMethodの検証
  if (inputData.yieldMethod) {
    const validMethods = Object.values(YIELD_METHOD);
    if (!validMethods.includes(inputData.yieldMethod)) {
      errors.push(`歩留まり計算方法は次のいずれかである必要があります: ${validMethods.join(', ')}`);
    }
  }

  return errors;
}

/**
 * 計量モードの入力データを検証
 */
function validateWeightModeInput(inputData) {
  const errors = [];

  // yieldMethodの検証
  if (inputData.yieldMethod) {
    const validMethods = Object.values(YIELD_METHOD);
    if (!validMethods.includes(inputData.yieldMethod)) {
      errors.push(`歩留まり計算方法は次のいずれかである必要があります: ${validMethods.join(', ')}`);
    }
  }

  return errors;
}

/**
 * 歩留まり率統計モードの入力データを検証
 */
function validateYieldStatsInput(inputData) {
  const errors = [];

  // 歩留まり率統計の場合は rows が必要
  if (!inputData.rows || !Array.isArray(inputData.rows)) {
    errors.push('歩留まり率統計モードでは行データ（rows）が必要です');
  }

  return errors;
}

/**
 * 複数パターンモードの入力データを検証
 */
function validateMultiPatternInput(inputData) {
  const errors = [];

  // 複数パターンの場合は patterns が必要
  if (!inputData.patterns || !Array.isArray(inputData.patterns)) {
    errors.push('複数パターンモードではパターンデータ（patterns）が必要です');
  }

  return errors;
}

/**
 * 結果データを検証
 */
export function validateResultData(resultData) {
  const errors = [];

  errors.push(...validateRequired(resultData, '結果データ'));
  errors.push(...validateObject(resultData, '結果データ'));

  if (errors.length > 0) {
    throw new ValidationError('結果データが不正です', errors);
  }

  return true;
}

/**
 * カテゴリを検証（オプション）
 */
export function validateCategory(category) {
  if (category === null || category === undefined) {
    return true; // オプションのためnull/undefinedは許可
  }

  const errors = [];

  if (typeof category !== 'string') {
    errors.push('カテゴリは文字列である必要があります');
  } else {
    errors.push(...validateStringLength(category, 'カテゴリ', 0, 50));
  }

  if (errors.length > 0) {
    throw new ValidationError('カテゴリが不正です', errors);
  }

  return true;
}

/**
 * 製品データを検証（オプション）
 */
export function validateProductData(productData) {
  if (productData === null || productData === undefined) {
    return true; // オプションのためnull/undefinedは許可
  }

  const errors = [];

  errors.push(...validateObject(productData, '製品データ'));

  if (errors.length > 0) {
    throw new ValidationError('製品データが不正です', errors);
  }

  return true;
}

/**
 * 計算データ全体を検証
 */
export function validateCalculationData(data) {
  const errors = [];

  try {
    validateName(data.name);
  } catch (error) {
    if (error instanceof ValidationError) {
      errors.push(...error.getErrors());
    } else {
      errors.push(error.message);
    }
  }

  try {
    validateMode(data.mode);
  } catch (error) {
    if (error instanceof ValidationError) {
      errors.push(...error.getErrors());
    } else {
      errors.push(error.message);
    }
  }

  try {
    validateInputData(data.inputData, data.mode);
  } catch (error) {
    if (error instanceof ValidationError) {
      errors.push(...error.getErrors());
    } else {
      errors.push(error.message);
    }
  }

  try {
    validateResultData(data.resultData);
  } catch (error) {
    if (error instanceof ValidationError) {
      errors.push(...error.getErrors());
    } else {
      errors.push(error.message);
    }
  }

  if (data.category !== null && data.category !== undefined) {
    try {
      validateCategory(data.category);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(...error.getErrors());
      } else {
        errors.push(error.message);
      }
    }
  }

  if (data.productData !== null && data.productData !== undefined) {
    try {
      validateProductData(data.productData);
    } catch (error) {
      if (error instanceof ValidationError) {
        errors.push(...error.getErrors());
      } else {
        errors.push(error.message);
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('入力データが不正です', errors);
  }

  return true;
}

/**
 * IDを検証
 */
export function validateId(id, fieldName = 'ID') {
  const errors = [];

  if (id === null || id === undefined) {
    errors.push(`${fieldName}は必須です`);
  }

  if (typeof id !== 'number' || !Number.isInteger(id) || id <= 0) {
    errors.push(`${fieldName}は正の整数である必要があります`);
  }

  if (errors.length > 0) {
    throw new ValidationError(`${fieldName}が不正です`, errors);
  }

  return true;
}

/**
 * UUIDを検証
 */
export function validateUUID(uuid, fieldName = 'UUID') {
  const errors = [];

  if (!uuid) {
    errors.push(`${fieldName}は必須です`);
    throw new ValidationError(`${fieldName}が不正です`, errors);
  }

  if (typeof uuid !== 'string') {
    errors.push(`${fieldName}は文字列である必要があります`);
  } else {
    // UUID v4フォーマットを検証
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(uuid)) {
      errors.push(`${fieldName}の形式が正しくありません（UUID v4形式が必要です）`);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError(`${fieldName}が不正です`, errors);
  }

  return true;
}

/**
 * 更新用の計算データを検証
 */
export function validateUpdateData(id, name, mode, inputData, resultData, category, productData) {
  const errors = [];

  // IDの検証
  try {
    validateId(id);
  } catch (error) {
    if (error instanceof ValidationError) {
      errors.push(...error.getErrors());
    } else {
      errors.push(error.message);
    }
  }

  // その他のフィールドの検証
  try {
    validateCalculationData({
      name,
      mode,
      input: inputData,
      result: resultData,
      category,
      productData
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      errors.push(...error.getErrors());
    } else {
      errors.push(error.message);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('更新データが不正です', errors);
  }

  return true;
}
