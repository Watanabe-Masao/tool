/**
 * 歩留まり統計遷移ユーティリティのテスト
 *
 * このテストは、リファクタリングで抽出された関数が
 * 正しく動作することを確認します。
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

// モジュールをモックする前にimport
const mockQs = jest.fn();
const mockHide = jest.fn();
const mockClearYieldStatsInputs = jest.fn();
const mockAddYieldStatsRow = jest.fn();
const mockUpdateLoadStatsButtons = jest.fn();
const mockDisplayCurrentStatistics = jest.fn();
const mockAppState = {
  showYieldStatsWithMultiPattern: false,
  setYieldStatsData: jest.fn(),
  getYieldStatsData: jest.fn(),
  getYieldStatsRawData: jest.fn(),
  getMode: jest.fn(),
  getCalculatedStats: jest.fn(),
  isYieldStatsFromHistory: jest.fn(),
  clearAllYieldStats: jest.fn()
};

// モジュールモック
jest.unstable_mockModule('../scripts/dom-utils.js', () => ({
  qs: mockQs,
  hide: mockHide
}));

jest.unstable_mockModule('../scripts/state.js', () => ({
  appState: mockAppState
}));

jest.unstable_mockModule('../scripts/mode-manager.js', () => ({
  clearYieldStatsInputs: mockClearYieldStatsInputs
}));

jest.unstable_mockModule('../scripts/yield-stats-table.js', () => ({
  addYieldStatsRow: mockAddYieldStatsRow
}));

jest.unstable_mockModule('../scripts/yield-stats-display.js', () => ({
  updateLoadStatsButtons: mockUpdateLoadStatsButtons,
  displayCurrentStatistics: mockDisplayCurrentStatistics
}));

jest.unstable_mockModule('../scripts/constants.js', () => ({
  MODE: {
    FIXED: 'FIXED',
    WEIGHT: 'WEIGHT',
    YIELD_STATS: 'YIELD_STATS',
    MULTI_PATTERN: 'MULTI_PATTERN'
  },
  UI_ELEMENTS: {
    YIELD_STATS_INPUTS: 'yieldStatsInputs'
  }
}));

// モックをセットアップした後にテスト対象のモジュールをインポート
const { checkStatsDataExists, clearAllYieldStatsData, handleYieldStatsTransition } = await import('../scripts/yield-stats-transition.js');

// グローバル変数のモック
let mockWindow;

beforeEach(() => {
  // appStateをリセット
  mockAppState.showYieldStatsWithMultiPattern = false;
  mockAppState.setYieldStatsData.mockClear();
  mockAppState.getYieldStatsData.mockClear();
  mockAppState.getYieldStatsRawData.mockClear();
  mockAppState.getMode.mockClear();
  mockAppState.getCalculatedStats.mockClear();
  mockAppState.isYieldStatsFromHistory.mockClear();
  mockAppState.clearAllYieldStats.mockClear();

  // DOM操作関数のモックをリセット
  mockQs.mockClear();
  mockHide.mockClear();
  mockClearYieldStatsInputs.mockClear();
  mockAddYieldStatsRow.mockClear();
  mockUpdateLoadStatsButtons.mockClear();

  // windowオブジェクトのモック
  mockWindow = {
    statsDataByType: {},
    lastCalculatedStats: null,
    yieldStatsState: {
      currentDisplayType: 'yieldRate',
      isFromHistory: false,
      isCalculated: false,
      hasYieldRateData: false,
      hasBeforeWeightData: false,
      hasAfterWeightData: false,
      isOutlierExcluded: false,
      manuallyExcludedOutlierIndices: new Set(),
      currentOutlierValues: [],
      sampleSizeValidation: {
        yieldRate: null,
        beforeWeight: null,
        afterWeight: null
      },
      shouldShowMultiPatternLink: false
    },
    confirm: jest.fn()
  };

  // グローバル変数を設定
  global.window = mockWindow;
  global.appState = mockAppState;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('checkStatsDataExists', () => {
  test('統計データが存在する場合、hasValidStatsがtrueを返す', () => {
    // Arrange
    mockWindow.statsDataByType = {
      yieldRate: { count: 5, mean: 85.5 }
    };

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.hasValidStats).toBe(true);
    expect(result.hasAnyStats).toBe(true);
  });

  test('統計データが2件未満の場合、hasValidStatsがfalseを返す', () => {
    // Arrange
    mockWindow.statsDataByType = {
      yieldRate: { count: 1, mean: 85.5 }
    };

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.hasValidStats).toBe(false);
  });

  test('統計データが存在しない場合、hasValidStatsとhasAnyStatsがfalseを返す', () => {
    // Arrange
    mockWindow.statsDataByType = {};

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.hasValidStats).toBe(false);
    expect(result.hasAnyStats).toBe(false);
  });

  test('履歴から読み込まれたデータがある場合、hasAnyStatsがtrueを返す', () => {
    // Arrange
    mockWindow.statsDataByType = {};
    mockWindow.yieldStatsState.isFromHistory = true;
    mockAppState.getYieldStatsData.mockReturnValue({
      yieldRate: [85, 86, 87, 88, 89] // 5件のデータ
    });

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.isFromHistory).toBe(true);
    expect(result.hasYieldStatsData).toBe(true);
    expect(result.hasAnyStats).toBe(true);
  });

  test('加工前重量データのみがある場合、hasYieldStatsDataがtrueを返す', () => {
    // Arrange
    mockWindow.statsDataByType = {};
    mockWindow.yieldStatsState.isFromHistory = true;
    mockAppState.getYieldStatsData.mockReturnValue({
      beforeWeight: [100, 101, 102, 103, 104]
    });

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.hasYieldStatsData).toBe(true);
    expect(result.hasAnyStats).toBe(true);
  });

  test('加工後重量データのみがある場合、hasYieldStatsDataがtrueを返す', () => {
    // Arrange
    mockWindow.statsDataByType = {};
    mockWindow.yieldStatsState.isFromHistory = true;
    mockAppState.getYieldStatsData.mockReturnValue({
      afterWeight: [85, 86, 87, 88, 89]
    });

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.hasYieldStatsData).toBe(true);
    expect(result.hasAnyStats).toBe(true);
  });
});

describe('clearAllYieldStatsData', () => {
  test('全てのデータが正しくクリアされる', () => {
    // Arrange
    const yieldStatsCallbacks = {
      addYieldStatsRow: mockAddYieldStatsRow
    };

    mockAppState.showYieldStatsWithMultiPattern = true;
    mockWindow.statsDataByType = { yieldRate: { count: 5 } };
    mockWindow.lastCalculatedStats = { mean: 85 };
    mockWindow.yieldStatsState.hasYieldRateData = true;
    mockWindow.yieldStatsState.isCalculated = true;

    const mockElement = { classList: { add: jest.fn() } };
    mockQs.mockReturnValue(mockElement);

    // Act
    clearAllYieldStatsData(yieldStatsCallbacks);

    // Assert
    // appStateのクリア
    expect(mockAppState.showYieldStatsWithMultiPattern).toBe(false);
    expect(mockAppState.setYieldStatsData).toHaveBeenCalledWith(null);

    // windowグローバル変数のクリア
    expect(mockWindow.statsDataByType).toEqual({});
    expect(mockWindow.lastCalculatedStats).toBeNull();

    // yieldStatsStateのリセット
    expect(mockWindow.yieldStatsState.currentDisplayType).toBe('yieldRate');
    expect(mockWindow.yieldStatsState.isFromHistory).toBe(false);
    expect(mockWindow.yieldStatsState.isCalculated).toBe(false);
    expect(mockWindow.yieldStatsState.hasYieldRateData).toBe(false);
    expect(mockWindow.yieldStatsState.manuallyExcludedOutlierIndices.size).toBe(0);
    expect(mockWindow.yieldStatsState.currentOutlierValues).toEqual([]);

    // DOM操作
    expect(mockClearYieldStatsInputs).toHaveBeenCalled();
    expect(mockHide).toHaveBeenCalledWith('yieldStatsResults');
    expect(mockUpdateLoadStatsButtons).toHaveBeenCalled();
  });

  test('yieldStatsStateがundefinedの場合でもエラーが発生しない', () => {
    // Arrange
    const yieldStatsCallbacks = {
      addYieldStatsRow: mockAddYieldStatsRow
    };

    mockWindow.yieldStatsState = undefined;

    // Act & Assert (エラーが発生しないことを確認)
    expect(() => {
      clearAllYieldStatsData(yieldStatsCallbacks);
    }).not.toThrow();
  });

  test('manuallyExcludedOutlierIndicesが正しくクリアされる', () => {
    // Arrange
    const yieldStatsCallbacks = {
      addYieldStatsRow: mockAddYieldStatsRow
    };

    // 外れ値インデックスを設定
    mockWindow.yieldStatsState.manuallyExcludedOutlierIndices.add(0);
    mockWindow.yieldStatsState.manuallyExcludedOutlierIndices.add(2);
    mockWindow.yieldStatsState.manuallyExcludedOutlierIndices.add(5);
    expect(mockWindow.yieldStatsState.manuallyExcludedOutlierIndices.size).toBe(3);

    // Act
    clearAllYieldStatsData(yieldStatsCallbacks);

    // Assert
    expect(mockWindow.yieldStatsState.manuallyExcludedOutlierIndices.size).toBe(0);
  });
});

describe('handleYieldStatsTransition', () => {
  let mockHandleModeSwitch;
  let mockLoadAllStatsToMultiPattern;
  let modeSwitchCallbacks;
  let yieldStatsCallbacks;

  beforeEach(() => {
    mockHandleModeSwitch = jest.fn();
    mockLoadAllStatsToMultiPattern = jest.fn();

    modeSwitchCallbacks = {
      handleModeSwitch: mockHandleModeSwitch,
      resetSteps: jest.fn(),
      resetWeightSteps: jest.fn()
    };

    yieldStatsCallbacks = {
      addYieldStatsRow: mockAddYieldStatsRow
    };

    // setTimeoutを即座に実行するようにモック
    global.setTimeout = jest.fn((fn, delay) => fn());
  });

  test('歩留まり統計モード以外からの遷移は通常処理を返す', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('FIXED'); // MODE.YIELD_STATS以外

    // Act
    const result = handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // Assert
    expect(result).toBe(false); // 通常遷移を示す
    expect(mockHandleModeSwitch).not.toHaveBeenCalled();
    expect(mockWindow.confirm).not.toHaveBeenCalled();
  });

  test('統計データがない場合は通常処理を返す', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('YIELD_STATS');
    mockWindow.statsDataByType = {}; // データなし

    // Act
    const result = handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // Assert
    expect(result).toBe(false); // 通常遷移を示す
    expect(mockHandleModeSwitch).not.toHaveBeenCalled();
    expect(mockWindow.confirm).not.toHaveBeenCalled();
  });

  test('統計データがある場合、確認ダイアログを表示して「はい」を選択すると統計値を読み込む', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('YIELD_STATS');
    mockWindow.statsDataByType = {
      yieldRate: { count: 5, mean: 85.5 }
    };
    mockWindow.confirm.mockReturnValue(true); // 「はい」を選択

    // Act
    const result = handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // Assert
    expect(result).toBe(true); // 確認ダイアログを表示した
    expect(mockWindow.confirm).toHaveBeenCalledWith('歩留まり統計の推奨値を複数パターン分析で使用しますか？');
    expect(mockHandleModeSwitch).toHaveBeenCalledWith('MULTI_PATTERN', modeSwitchCallbacks);
    expect(mockLoadAllStatsToMultiPattern).toHaveBeenCalledWith(true);
  });

  test('統計データがある場合、確認ダイアログで「いいえ」を選択するとデータをクリアする', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('YIELD_STATS');
    mockWindow.statsDataByType = {
      yieldRate: { count: 5, mean: 85.5 }
    };
    mockAppState.showYieldStatsWithMultiPattern = true;
    mockWindow.lastCalculatedStats = { mean: 85 };
    mockWindow.confirm.mockReturnValue(false); // 「いいえ」を選択

    // Act
    const result = handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // Assert
    expect(result).toBe(true); // 確認ダイアログを表示した
    expect(mockWindow.confirm).toHaveBeenCalled();
    expect(mockHandleModeSwitch).toHaveBeenCalledWith('MULTI_PATTERN', modeSwitchCallbacks);
    expect(mockLoadAllStatsToMultiPattern).not.toHaveBeenCalled();

    // データがクリアされていることを確認
    expect(mockAppState.showYieldStatsWithMultiPattern).toBe(false);
    expect(mockAppState.setYieldStatsData).toHaveBeenCalledWith(null);
    expect(mockWindow.statsDataByType).toEqual({});
    expect(mockWindow.lastCalculatedStats).toBeNull();
    expect(mockUpdateLoadStatsButtons).toHaveBeenCalled();
  });

  test('beforeTransitionコールバックが実行される', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('YIELD_STATS');
    mockWindow.statsDataByType = {
      yieldRate: { count: 5, mean: 85.5 }
    };
    mockWindow.confirm.mockReturnValue(true);

    const beforeTransition = jest.fn();

    // Act
    handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks,
      { beforeTransition }
    );

    // Assert
    expect(beforeTransition).toHaveBeenCalled();
  });

  test('履歴から読み込まれた場合、遅延時間が400msになる', () => {
    // Arrange
    const mockSetTimeout = jest.fn();
    global.setTimeout = mockSetTimeout;

    mockAppState.getMode.mockReturnValue('YIELD_STATS');
    mockWindow.statsDataByType = {};
    mockWindow.yieldStatsState.isFromHistory = true;
    mockAppState.getYieldStatsData.mockReturnValue({
      yieldRate: [85, 86, 87, 88, 89]
    });
    mockWindow.confirm.mockReturnValue(true);

    // Act
    handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // Assert
    expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 400);
  });

  test('通常の遷移の場合、遅延時間が100msになる', () => {
    // Arrange
    const mockSetTimeout = jest.fn();
    global.setTimeout = mockSetTimeout;

    mockAppState.getMode.mockReturnValue('YIELD_STATS');
    mockWindow.statsDataByType = {
      yieldRate: { count: 5, mean: 85.5 }
    };
    mockWindow.yieldStatsState.isFromHistory = false;
    mockWindow.confirm.mockReturnValue(true);

    // Act
    handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // Assert
    expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
  });
});
