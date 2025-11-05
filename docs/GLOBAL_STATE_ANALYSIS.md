# 4つのグローバルオブジェクトの役割と成り立ち

## 📋 概要

歩留まり統計機能において、状態管理が**4つのグローバルオブジェクト**に分散しています：

1. **`appState`** (state.js)
2. **`window.statsDataByType`** (yield-stats-display.js)
3. **`window.lastCalculatedStats`** (yield-stats-display.js)
4. **`window.yieldStatsState`** (yield-stats-display.js)

この分散は**機能追加の歴史的経緯**によるもので、**計画的な設計ではありません**。

---

## 🔍 各オブジェクトの詳細分析

### 1. **`appState`** - アプリケーション全体の状態管理

**場所**: `scripts/state.js` (AppStateクラスのシングルトン)

**作成時期**: アプリケーション初期から存在

**役割**:
```javascript
export class AppState {
  constructor() {
    // ✅ コアな状態
    this.mode = MODE.FIXED;           // 現在のモード
    this.currentStep = 1;             // 現在のステップ
    this.snapshot = new CalculationSnapshot();  // 計算結果
    this.productData = new ProductSimulationData();  // 商品データ

    // ✅ 履歴管理
    this.loadedHistoryId = null;      // 履歴から読み込んだID
    this.isFromHistory = false;       // 履歴から読み込まれたか
    this.hasUnsavedChanges = false;   // 未保存の変更があるか

    // ✅ 歩留まり統計（後から追加）
    this.yieldStatsData = null;       // 生データ（配列）
    this.showYieldStatsWithMultiPattern = false;  // 表示フラグ
  }
}
```

**保持するデータ**:
- ✅ **歩留まり統計の生データ**: `yieldStatsData`
  ```javascript
  {
    yieldRate: [85.5, 86.2, 84.8, ...],      // 歩留まり率の配列
    beforeWeight: [120, 118, 122, ...],       // 加工前重量の配列
    afterWeight: [102, 100, 104, ...]         // 加工後重量の配列
  }
  ```

**特徴**:
- ✅ **クラスベース**: 構造化された状態管理
- ✅ **シングルトン**: アプリケーション全体で1インスタンス
- ✅ **永続化対象**: 履歴保存時にこのデータが保存される
- ⚠️ **限定的**: 統計**計算結果**は保持しない（生データのみ）

**なぜこの構造？**
- 元々は定額/計量モードの状態管理のために作られた
- 歩留まり統計機能が後から追加され、`yieldStatsData`が継ぎ足された
- **統計計算結果**（平均、標準偏差など）は保存する必要がないため、appStateには含まれていない

---

### 2. **`window.statsDataByType`** - 統計タイプ別の計算結果

**場所**: `scripts/yield-stats-display.js` (グローバルwindowオブジェクト)

**作成時期**: 歩留まり統計機能の実装時

**役割**:
```javascript
window.statsDataByType = {
  yieldRate: {
    count: 10,           // データ数
    mean: 85.5,          // 平均値
    median: 85.8,        // 中央値
    stdDev: 2.3,         // 標準偏差
    cv: 2.69,            // 変動係数
    min: 82.1,           // 最小値
    max: 89.2,           // 最大値
    range: 7.1,          // 範囲
    q1: 84.2,            // 第1四分位数
    q3: 87.1,            // 第3四分位数
    iqr: 2.9,            // 四分位範囲
    skewness: 0.15,      // 歪度
    kurtosis: -0.52,     // 尖度
    sigma1: {...},       // ±1σ範囲
    sigma2: {...},       // ±2σ範囲
    sigma3: {...}        // ±3σ範囲
  },
  beforeWeight: { ... },  // 加工前重量の統計
  afterWeight: { ... }    // 加工後重量の統計
}
```

**生成タイミング**:
```javascript
// yield-stats-display.js の displayCurrentStatistics() 内
['yieldRate', 'beforeWeight', 'afterWeight'].forEach(type => {
  if (data[type] && Array.isArray(data[type]) && data[type].length >= 2) {
    window.statsDataByType[type] = calculateStatistics(data[type]);
    //                              ^^^^^^^^^^^^^^^^^^^
    //                              統計計算関数
  } else {
    window.statsDataByType[type] = null;
  }
});
```

**使用場所**:
- ✅ **複数パターン分析の読み込みボタン**: 統計値の表示と取り込み
- ✅ **統計データ存在チェック**: `checkStatsDataExists()`
- ✅ **データ待機**: `waitForStatsDataReady()`

**なぜグローバル変数？**
- **複数のモジュール間で共有**する必要があった
  - `yield-stats-display.js`: 計算と表示
  - `multi-pattern-stats-loader.js`: 値の読み込み
  - `yield-stats-transition.js`: データ存在チェック
- **計算コストが高い**: 毎回再計算せず、キャッシュとして使用
- **3つのタイプを一元管理**: yieldRate, beforeWeight, afterWeightを1つのオブジェクトで管理

**問題点**:
- ⚠️ **appStateに含まれていない**: 状態管理が分散
- ⚠️ **永続化されない**: リロードすると消える（生データから再計算）
- ⚠️ **グローバル汚染**: windowオブジェクトに直接追加

---

### 3. **`window.lastCalculatedStats`** - 最後に表示した統計結果

**場所**: `scripts/yield-stats-display.js` (グローバルwindowオブジェクト)

**作成時期**: 歩留まり統計の実装初期

**役割**:
```javascript
// 現在表示中の統計タイプ（yieldRate, beforeWeight, afterWeight のいずれか）の
// 統計計算結果を保持

window.lastCalculatedStats = {
  count: 10,
  mean: 85.5,
  median: 85.8,
  // ... 他の統計値
}
```

**設定タイミング**:
```javascript
// yield-stats-display.js の displayCurrentStatistics() 内
const validation = window.yieldStatsState?.sampleSizeValidation?.[actualSelectedType];
const isSampleSizeValid = validation ? validation.isValid : true;

if (isSampleSizeValid) {
  window.lastCalculatedStats = finalStats;  // ✅ サンプルサイズが妥当な場合
} else {
  window.lastCalculatedStats = null;        // ❌ サンプルサイズ不十分な場合
}
```

**使用目的**:
- ⚠️ **後方互換性**: 古いコードとの互換性のために残されている
- 🤔 **用途不明確**: `window.statsDataByType`と重複する情報
- 📊 **表示用**: 現在選択されている統計タイプのみ

**なぜ存在する？**
1. **初期実装**: 歩留まり統計機能の最初のバージョンで作成
2. **単一統計タイプ**: 当初は1つの統計タイプしか想定していなかった
3. **後に拡張**: 複数タイプ対応で`statsDataByType`が追加されたが、`lastCalculatedStats`も残った

**問題点**:
- ⚠️ **重複**: `window.statsDataByType[currentType]` と同じ情報
- ⚠️ **混乱**: どちらを使うべきか不明確
- ⚠️ **サンプルサイズフィルタ**: 妥当な場合のみ設定されるという独自ルール

---

### 4. **`window.yieldStatsState`** - UI状態とメタデータ

**場所**: `scripts/yield-stats-display.js` (グローバルwindowオブジェクト)

**作成時期**: 外れ値機能、サンプルサイズ検証などの機能追加時

**役割**:
```javascript
window.yieldStatsState = {
  // 表示関連の状態
  currentDisplayType: 'yieldRate',        // 現在表示中の統計タイプ

  // データソース関連の状態
  isFromHistory: false,                   // 履歴から読み込まれたか
  isCalculated: false,                    // 計算済みか

  // データ存在フラグ
  hasYieldRateData: false,                // 歩留まり率データが存在するか
  hasBeforeWeightData: false,             // 加工前重量データが存在するか
  hasAfterWeightData: false,              // 加工後重量データが存在するか

  // 外れ値管理（リファクタリング済み）
  isOutlierExcluded: false,               // 外れ値除外が適用されているか
  manuallyExcludedOutlierIndices: new Set(),  // 手動除外された外れ値
  currentOutlierValues: [],               // 現在の外れ値リスト

  // サンプルサイズ妥当性（統計タイプ別）
  sampleSizeValidation: {
    yieldRate: null,      // { isValid: boolean, actualSize: number, requiredSize: number }
    beforeWeight: null,
    afterWeight: null
  },

  // UI制御
  shouldShowMultiPatternLink: false       // 複数パターン分析リンクを表示すべきか
};
```

**特徴**:
- ✅ **UI状態**: 画面表示に関する情報
- ✅ **メタデータ**: データの属性（履歴から読み込まれたか、など）
- ✅ **検証情報**: サンプルサイズの妥当性
- ⚠️ **appStateと重複**: `isFromHistory`など、appStateにも類似の情報がある

**なぜこの構造？**
1. **段階的な機能追加**:
   - 外れ値機能追加 → `currentOutlierValues`
   - サンプルサイズ検証追加 → `sampleSizeValidation`
   - 複数統計タイプ対応 → `currentDisplayType`
2. **スコープの問題**: `yield-stats-display.js`内でのみ使用される状態
3. **appStateに追加しづらい**: クラス構造の変更を避けたかった

**問題点**:
- ⚠️ **appStateと重複**: `isFromHistory`が両方に存在
- ⚠️ **11個のプロパティ**: 管理が複雑
- ⚠️ **グローバル汚染**: windowオブジェクトに直接追加

---

## 🕰️ 歴史的経緯: なぜ4つに分散したのか？

### タイムライン

```
【Phase 1: アプリケーション初期】
┌─────────────────────────┐
│ appState                │
│ - mode                  │  ← 定額/計量モードのみ
│ - snapshot              │
│ - productData           │
└─────────────────────────┘

【Phase 2: 歩留まり統計機能追加】
┌─────────────────────────┐
│ appState                │
│ + yieldStatsData        │  ← 生データ追加
└─────────────────────────┘
            +
┌─────────────────────────┐
│ window.lastCalculatedStats  ← 統計結果（1タイプのみ想定）
└─────────────────────────┘

【Phase 3: 外れ値機能追加】
┌─────────────────────────┐
│ let currentOutlierValues    ← ローカル変数で開始
│ let manuallyExcluded...     ← ローカル変数で開始
└─────────────────────────┘

【Phase 4: 複数統計タイプ対応】
┌─────────────────────────┐
│ window.statsDataByType  │  ← 3タイプ対応のため新設
│ - yieldRate             │
│ - beforeWeight          │
│ - afterWeight           │
└─────────────────────────┘

【Phase 5: サンプルサイズ検証追加】
┌─────────────────────────┐
│ window.yieldStatsState  │  ← 増え続ける状態を整理
│ - sampleSizeValidation  │
│ - hasYieldRateData      │
│ - isFromHistory         │
│ - ...（11プロパティ）   │
└─────────────────────────┘
```

### なぜ統合されなかったのか？

#### 理由1: **段階的な機能追加**
- 各機能追加時に「最小限の変更」で実装
- 既存のappStateクラス構造を変更したくなかった
- 「動けばOK」で次の機能へ

#### 理由2: **スコープの違い**
- `appState`: 全モード共通
- `window.statsDataByType`: 歩留まり統計 + 複数パターン分析
- `window.yieldStatsState`: 歩留まり統計のみ

#### 理由3: **永続化の違い**
- `appState.yieldStatsData`: **保存が必要**（生データ）
- `window.statsDataByType`: **保存不要**（計算すれば復元可能）
- `window.yieldStatsState`: **保存不要**（UI状態）

#### 理由4: **リファクタリングのリスク**
- 複数ファイルに影響
- テストが不十分
- 動作している機能を壊したくない

---

## 🔴 現在の問題点

### 1. **データの重複**
```javascript
// ❌ 同じ情報が複数箇所に
appState.isFromHistory = true;
window.yieldStatsState.isFromHistory = true;
```

### 2. **更新の同期**
```javascript
// ❌ 複数箇所を更新する必要
appState.setYieldStatsData(null);
window.statsDataByType = {};
window.lastCalculatedStats = null;
window.yieldStatsState.hasYieldRateData = false;
// ... 8箇所以上を更新
```

### 3. **真実の情報源が不明**
```javascript
// ❓ どちらを信じるべき？
const isFromHistory1 = appState.isFromHistory;
const isFromHistory2 = window.yieldStatsState.isFromHistory;

// ❓ どれを使うべき？
const stats1 = window.statsDataByType.yieldRate;
const stats2 = window.lastCalculatedStats;
```

### 4. **デバッグの困難さ**
```javascript
// ❌ 状態を確認するために4箇所をチェック
console.log(appState.yieldStatsData);
console.log(window.statsDataByType);
console.log(window.lastCalculatedStats);
console.log(window.yieldStatsState);
```

---

## 💡 理想的な構造（将来の改善案）

### オプションA: appStateに統合
```javascript
export class AppState {
  constructor() {
    // 既存のプロパティ...

    // ✅ 歩留まり統計を1箇所に
    this.yieldStats = {
      // 生データ（永続化対象）
      rawData: {
        yieldRate: [],
        beforeWeight: [],
        afterWeight: []
      },

      // 計算結果（キャッシュ）
      calculatedStats: {
        yieldRate: null,
        beforeWeight: null,
        afterWeight: null
      },

      // UI状態
      ui: {
        currentDisplayType: 'yieldRate',
        isFromHistory: false,
        hasUnsavedChanges: false
      },

      // 検証情報
      validation: {
        yieldRate: null,
        beforeWeight: null,
        afterWeight: null
      },

      // 外れ値管理
      outliers: {
        manuallyExcluded: new Set(),
        currentValues: []
      }
    };
  }

  // ✅ 単一のリセット関数
  resetYieldStats() {
    this.yieldStats = { ... };
  }
}
```

### オプションB: 専用の状態管理クラス
```javascript
// yield-stats-state.js
export class YieldStatsState {
  constructor() {
    this.rawData = { ... };
    this.calculatedStats = { ... };
    this.ui = { ... };
    this.validation = { ... };
    this.outliers = { ... };
  }

  reset() { ... }
  calculateStats() { ... }
  isDataReady() { ... }
}

// state.js
export class AppState {
  constructor() {
    this.yieldStats = new YieldStatsState();  // ✅ 委譲
  }
}
```

---

## 📋 まとめ

### 4つのグローバルオブジェクトの役割

| オブジェクト | 主な役割 | データ例 | 永続化 |
|-------------|---------|---------|--------|
| **appState** | 全アプリの状態、生データ | `yieldStatsData: [85, 86, ...]` | ✅ Yes |
| **window.statsDataByType** | 統計計算結果（3タイプ） | `{ yieldRate: { mean: 85.5, ... }}` | ❌ No |
| **window.lastCalculatedStats** | 現在表示中の統計 | `{ mean: 85.5, ... }` | ❌ No |
| **window.yieldStatsState** | UI状態、メタデータ | `{ currentDisplayType, isFromHistory, ... }` | ❌ No |

### なぜ分散したのか
1. ✅ **段階的な機能追加**: 最小限の変更で実装
2. ✅ **スコープの違い**: 全モード vs 歩留まり統計のみ
3. ✅ **永続化の違い**: 保存が必要 vs 不要
4. ❌ **計画不足**: 長期的な設計がなかった
5. ❌ **リファクタリング回避**: リスクを恐れて統合しなかった

### 現在の状況
- ⚠️ **動作はしている**: 機能的には問題ない
- ⚠️ **保守性が低い**: 複数箇所の更新が必要
- ⚠️ **バグのリスク**: 同期漏れの可能性
- ⚠️ **理解が困難**: 新しい開発者にとって複雑

次のステップとして、これを統合するリファクタリングを行うかどうかご検討ください。
