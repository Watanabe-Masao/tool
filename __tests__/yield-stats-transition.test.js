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
  global.confirm = mockWindow.confirm; // confirm()を直接呼ぶためのモック
  global.appState = mockAppState;
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('checkStatsDataExists', () => {
  test('統計データが存在する場合、hasValidStatsがtrueを返す', () => {
    // Arrange
    mockAppState.getCalculatedStats.mockReturnValue({ count: 5, mean: 85.5 });
    mockAppState.getYieldStatsRawData.mockReturnValue({ yieldRate: [80, 82, 85, 87, 90] });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(false);

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.hasValidStats).toBe(true);
    expect(result.hasAnyStats).toBe(true);
  });

  test('統計データが2件未満の場合、hasValidStatsがfalseを返す', () => {
    // Arrange
    mockAppState.getCalculatedStats.mockReturnValue({ count: 1, mean: 85.5 });
    mockAppState.getYieldStatsRawData.mockReturnValue({ yieldRate: [80] });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(false);

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.hasValidStats).toBe(false);
  });

  test('統計データが存在しない場合、hasValidStatsとhasAnyStatsがfalseを返す', () => {
    // Arrange
    mockAppState.getCalculatedStats.mockReturnValue(null);
    mockAppState.getYieldStatsRawData.mockReturnValue(null);
    mockAppState.isYieldStatsFromHistory.mockReturnValue(false);

    // Act
    const result = checkStatsDataExists();

    // Assert
    // null && ... の結果はnullになるため、falsyであることを確認
    expect(result.hasValidStats).toBeFalsy();
    expect(result.hasAnyStats).toBeFalsy();
  });

  test('履歴から読み込まれたデータがある場合、hasAnyStatsがtrueを返す', () => {
    // Arrange
    mockAppState.getCalculatedStats.mockReturnValue(null); // 計算済み統計はない
    mockAppState.getYieldStatsRawData.mockReturnValue({
      yieldRate: [85, 86, 87, 88, 89] // 5件のデータ
    });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(true);

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.isFromHistory).toBe(true);
    expect(result.hasYieldStatsData).toBe(true);
    expect(result.hasAnyStats).toBe(true);
  });

  test('加工前重量データのみがある場合、hasYieldStatsDataがtrueを返す', () => {
    // Arrange
    mockAppState.getCalculatedStats.mockReturnValue(null); // 計算済み統計はない
    mockAppState.getYieldStatsRawData.mockReturnValue({
      beforeWeight: [100, 101, 102, 103, 104]
    });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(true);

    // Act
    const result = checkStatsDataExists();

    // Assert
    expect(result.hasYieldStatsData).toBe(true);
    expect(result.hasAnyStats).toBe(true);
  });

  test('加工後重量データのみがある場合、hasYieldStatsDataがtrueを返す', () => {
    // Arrange
    mockAppState.getCalculatedStats.mockReturnValue(null); // 計算済み統計はない
    mockAppState.getYieldStatsRawData.mockReturnValue({
      afterWeight: [85, 86, 87, 88, 89]
    });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(true);

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

    const mockElement = { classList: { add: jest.fn() } };
    mockQs.mockReturnValue(mockElement);

    // Act
    clearAllYieldStatsData(yieldStatsCallbacks);

    // Assert
    // appStateのクリア
    expect(mockAppState.showYieldStatsWithMultiPattern).toBe(false);
    expect(mockAppState.clearAllYieldStats).toHaveBeenCalled();

    // DOM操作
    expect(mockClearYieldStatsInputs).toHaveBeenCalled();
    expect(mockHide).toHaveBeenCalledWith('yieldStatsResults');
    expect(mockUpdateLoadStatsButtons).toHaveBeenCalled();
    expect(mockElement.classList.add).toHaveBeenCalledWith('is-hidden');
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

  test('clearAllYieldStats()が呼ばれることを確認', () => {
    // Arrange
    const yieldStatsCallbacks = {
      addYieldStatsRow: mockAddYieldStatsRow
    };

    // Act
    clearAllYieldStatsData(yieldStatsCallbacks);

    // Assert
    // clearAllYieldStats()が呼ばれて、内部的に外れ値インデックスなどもクリアされる
    expect(mockAppState.clearAllYieldStats).toHaveBeenCalled();
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

    // checkStatsDataExists()がデータなしを返すようにモック
    mockAppState.getCalculatedStats.mockReturnValue(null);
    mockAppState.getYieldStatsRawData.mockReturnValue(null);
    mockAppState.isYieldStatsFromHistory.mockReturnValue(false);

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

    // checkStatsDataExists()が有効なデータを返すようにモック
    mockAppState.getCalculatedStats.mockReturnValue({ count: 5, mean: 85.5 });
    mockAppState.getYieldStatsRawData.mockReturnValue({ yieldRate: [80, 82, 85, 87, 90] });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(false);

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
    // loadAllStatsToMultiPatternは非同期で呼ばれるため、この時点では呼ばれていない可能性がある
  });

  test('統計データがある場合、確認ダイアログで「いいえ」を選択するとデータをクリアする', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('YIELD_STATS');

    // checkStatsDataExists()が有効なデータを返すようにモック
    mockAppState.getCalculatedStats.mockReturnValue({ count: 5, mean: 85.5 });
    mockAppState.getYieldStatsRawData.mockReturnValue({ yieldRate: [80, 82, 85, 87, 90] });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(false);

    mockAppState.showYieldStatsWithMultiPattern = true;
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

    // clearAllYieldStats()が呼ばれることを確認
    expect(mockAppState.clearAllYieldStats).toHaveBeenCalled();
    expect(mockAppState.showYieldStatsWithMultiPattern).toBe(false);
    expect(mockUpdateLoadStatsButtons).toHaveBeenCalled();
  });

  test('beforeTransitionコールバックが実行される', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('YIELD_STATS');

    // checkStatsDataExists()が有効なデータを返すようにモック
    mockAppState.getCalculatedStats.mockReturnValue({ count: 5, mean: 85.5 });
    mockAppState.getYieldStatsRawData.mockReturnValue({ yieldRate: [80, 82, 85, 87, 90] });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(false);

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

  test('履歴から読み込まれた場合、統計データ待機処理が実行される', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('YIELD_STATS');

    // checkStatsDataExists()が履歴データを返すようにモック
    mockAppState.getCalculatedStats.mockReturnValue(null);
    mockAppState.getYieldStatsRawData.mockReturnValue({
      yieldRate: [85, 86, 87, 88, 89]
    });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(true); // 履歴から読み込まれた

    mockWindow.confirm.mockReturnValue(true);

    // Act
    const result = handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // Assert
    expect(result).toBe(true); // 確認ダイアログを表示した
    expect(mockHandleModeSwitch).toHaveBeenCalled();
    // 履歴データの場合、waitForStatsDataReady()が非同期で統計データ準備を待つ
  });

  test('通常の遷移の場合、UI遷移待機処理が実行される', () => {
    // Arrange
    mockAppState.getMode.mockReturnValue('YIELD_STATS');

    // checkStatsDataExists()が通常の統計データを返すようにモック
    mockAppState.getCalculatedStats.mockReturnValue({ count: 5, mean: 85.5 });
    mockAppState.getYieldStatsRawData.mockReturnValue({ yieldRate: [80, 82, 85, 87, 90] });
    mockAppState.isYieldStatsFromHistory.mockReturnValue(false); // 履歴ではない

    mockWindow.confirm.mockReturnValue(true);

    // Act
    const result = handleYieldStatsTransition(
      'MULTI_PATTERN',
      modeSwitchCallbacks,
      mockLoadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // Assert
    expect(result).toBe(true); // 確認ダイアログを表示した
    expect(mockHandleModeSwitch).toHaveBeenCalled();
    // 通常の場合、waitForStatsDataReady()がUI遷移を待つ
  });
});
