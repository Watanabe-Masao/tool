/**
 * アプリケーション定数
 */

// 計算定数
export const GRAMS_PER_100G = 100;
export const GRAMS_PER_KG = 1000;
export const PERCENT_MULTIPLIER = 100;

// 計算モード
export const MODE = {
  FIXED: 'fixed',
  WEIGHT: 'weight'
};

// 歩留まり計算方法
export const YIELD_METHOD = {
  CALCULATE: 'calculate',
  DIRECT: 'direct'
};

// 入力フィールドID（定額モード）
export const FIXED_FIELDS = {
  CALCULATE: {
    UNIT_COST: 'unitCost',
    UNIT_PRICE: 'unitPrice',
    BEFORE_WEIGHT: 'beforeWeight',
    AFTER_WEIGHT: 'afterWeight',
    AFTER_PRICE_100: 'afterPrice100'
  },
  DIRECT: {
    UNIT_COST: 'unitCostDirect',
    UNIT_PRICE: 'unitPriceDirect',
    BEFORE_WEIGHT: 'beforeWeightDirect',
    YIELD_RATE: 'yieldRateDirect',
    AFTER_PRICE_100: 'afterPrice100'
  }
};

// 入力フィールドID（計量モード）
export const WEIGHT_FIELDS = {
  CALCULATE: {
    BOX_COST: 'boxCost',
    BOX_PRICE: 'boxPrice',
    BOX_WEIGHT: 'boxWeight',
    BEFORE_SAMPLE: 'beforeSample',
    AFTER_WEIGHT: 'afterWeightW',
    AFTER_PRICE_100: 'afterPrice100W'
  },
  DIRECT: {
    BOX_COST: 'boxCostDirect',
    BOX_PRICE: 'boxPriceDirect',
    BOX_WEIGHT: 'boxWeightDirect',
    YIELD_RATE: 'yieldRateDirectW',
    AFTER_PRICE_100: 'afterPrice100W'
  }
};

// 表示用ラベル
export const LABELS = {
  FINISHED_PRICE_FIXED: '1個あたりの仕上がり売価',
  FINISHED_PRICE_WEIGHT: '1箱あたりの仕上がり売価'
};

// UI要素ID
export const UI_ELEMENTS = {
  // モード切替ボタン
  FIXED_BTN: 'fixedBtn',
  WEIGHT_BTN: 'weightBtn',
  CLEAR_BTN: 'clearBtn',

  // セクション
  FIXED_INPUTS: 'fixedInputs',
  WEIGHT_INPUTS: 'weightInputs',
  FIXED_CALCULATE_INPUTS: 'fixedCalculateInputs',
  FIXED_DIRECT_INPUTS: 'fixedDirectInputs',
  WEIGHT_CALCULATE_INPUTS: 'weightCalculateInputs',
  WEIGHT_DIRECT_INPUTS: 'weightDirectInputs',

  // 表示エリア
  RESULTS: 'results',
  WARNING: 'warning',
  EXP_RESULTS: 'expResults',
  DISC_RESULTS: 'discResults',

  // 100gあたり売価表示
  PER_100G_DISPLAY: 'per100gDisplay',
  PER_100G_DISPLAY_DIRECT: 'per100gDisplayDirect',

  // 結果表示
  YIELD_RATE: 'yieldRate',
  BEFORE_COST: 'beforeCost',
  BEFORE_PRICE: 'beforePrice',
  AFTER_COST: 'afterCost',
  AFTER_PRICE: 'afterPrice',
  BEFORE_MARKUP: 'beforeMarkup',
  AFTER_MARKUP: 'afterMarkup',
  BEFORE_GROSS: 'beforeGross',
  AFTER_GROSS: 'afterGross',
  FINISHED_LABEL: 'finishedLabel',
  FINISHED_PRICE: 'finishedPrice',
  PRICE_DIFF: 'priceDiff',
  FINISHED_ITEM: 'finishedItem',
  DIFF_ITEM: 'diffItem',

  // 商品化シミュレーション
  EXP_WEIGHT: 'expWeight',
  CONSUMABLE: 'consumable',
  EXP_COST: 'expCost',
  EXP_PRICE: 'expPrice',
  EXP_MARKUP: 'expMarkup',

  // 値引きシミュレーション
  DISC_SLIDER: 'discSlider',
  DISC_INPUT: 'discInput',
  DISC_GROSS: 'discGross'
};

// ラジオボタン名
export const RADIO_NAMES = {
  YIELD_METHOD_FIXED: 'yieldMethodFixed',
  YIELD_METHOD_WEIGHT: 'yieldMethodWeight'
};

// 値引きシミュレーション設定
export const DISCOUNT = {
  MIN: 0,
  MAX: 100,
  SLIDER_MAX: 50
};
