# 状態管理フロー図

## 現在の状態（問題あり）

```
┌─────────────────────────────────────────────────────────────────┐
│                    グローバルスコープ (window)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐      ┌──────────────────┐                │
│  │   appState      │      │  window.         │                │
│  │                 │      │  statsDataByType │                │
│  │ - mode          │      │                  │                │
│  │ - yieldStatsData│◀────▶│ - yieldRate: {}  │◀───┐          │
│  │   (生データ)      │      │ - beforeWeight:{}│    │          │
│  │                 │      │ - afterWeight: {}│    │          │
│  │ - showYield...  │      └──────────────────┘    │ 重複・同期 │
│  │   WithMulti...  │                              │ の問題     │
│  └─────────────────┘                              │          │
│         ▲                                          │          │
│         │                                          │          │
│         │ データ                                    │          │
│         │ 取得/設定                                 ▼          │
│         │                    ┌──────────────────────────┐    │
│         │                    │  window.yieldStatsState  │    │
│         │                    │                          │    │
│         │                    │ - currentDisplayType     │    │
│         │                    │ - manuallyExcluded...    │    │
│         └────────────────────│ - currentOutlierValues   │    │
│                              │ - isCalculated           │    │
│                              │ - isFromHistory          │    │
│                              │ - hasYieldRateData       │◀───┤
│                              │ - hasBeforeWeightData    │    │
│                              │ - hasAfterWeightData     │    │
│                              │ - isOutlierExcluded      │    │
│                              │ - sampleSizeValidation   │    │
│                              └──────────────────────────┘    │
│                                         ▲                     │
│                                         │                     │
│                                         │ 参照               │
│                                         │                     │
│                              ┌──────────────────────────┐    │
│                              │  window.                 │    │
│                              │  lastCalculatedStats     │────┘
│                              │                          │
│                              │ (最後の計算結果キャッシュ)   │
│                              └──────────────────────────┘
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

問題点:
❌ 4つのグローバルオブジェクトが分散
❌ データの重複（yieldStatsData と statsDataByType）
❌ 同期の問題（hasYieldRateData と statsDataByType.yieldRate）
❌ 初期化順序の依存
❌ デバッグが困難
```

---

## 統合後の状態（理想）

```
┌─────────────────────────────────────────────────────────────────┐
│                    グローバルスコープ (window)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                     appState                               │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────┐         │ │
│  │  │ 一般状態                                       │         │ │
│  │  │ - mode                                        │         │ │
│  │  │ - isHistoryLoaded                             │         │ │
│  │  │ - loadedHistoryId                             │         │ │
│  │  │ - showYieldStatsWithMultiPattern              │         │ │
│  │  └──────────────────────────────────────────────┘         │ │
│  │                                                            │ │
│  │  ┌──────────────────────────────────────────────┐         │ │
│  │  │ yieldStats (歩留まり統計の一元管理)             │         │ │
│  │  │                                               │         │ │
│  │  │  ┌─────────────────────────────────┐         │         │ │
│  │  │  │ rawData (生データ)                │         │         │ │
│  │  │  │ - yieldRate: [...]               │         │         │ │
│  │  │  │ - beforeWeight: [...]            │         │         │ │
│  │  │  │ - afterWeight: [...]             │         │         │ │
│  │  │  └─────────────────────────────────┘         │         │ │
│  │  │                                               │         │ │
│  │  │  ┌─────────────────────────────────┐         │         │ │
│  │  │  │ calculatedStats (計算結果)        │         │         │ │
│  │  │  │ - yieldRate: { mean, stdDev, ...}│         │         │ │
│  │  │  │ - beforeWeight: { ... }          │         │         │ │
│  │  │  │ - afterWeight: { ... }           │         │         │ │
│  │  │  └─────────────────────────────────┘         │         │ │
│  │  │                                               │         │ │
│  │  │  ┌─────────────────────────────────┐         │         │ │
│  │  │  │ ui (UI状態)                       │         │         │ │
│  │  │  │ - currentDisplayType             │         │         │ │
│  │  │  │ - isCalculated                   │         │         │ │
│  │  │  │ - isFromHistory                  │         │         │ │
│  │  │  │ - hasYieldRateData               │         │         │ │
│  │  │  │ - hasBeforeWeightData            │         │         │ │
│  │  │  │ - hasAfterWeightData             │         │         │ │
│  │  │  │ - isOutlierExcluded              │         │         │ │
│  │  │  └─────────────────────────────────┘         │         │ │
│  │  │                                               │         │ │
│  │  │  ┌─────────────────────────────────┐         │         │ │
│  │  │  │ outliers (外れ値管理)             │         │         │ │
│  │  │  │ - manuallyExcludedIndices: Set() │         │         │ │
│  │  │  │ - currentValues: []              │         │         │ │
│  │  │  └─────────────────────────────────┘         │         │ │
│  │  │                                               │         │ │
│  │  │  ┌─────────────────────────────────┐         │         │ │
│  │  │  │ validation (サンプルサイズ妥当性)   │         │         │ │
│  │  │  │ - yieldRate: { isValid, ... }    │         │         │ │
│  │  │  │ - beforeWeight: { ... }          │         │         │ │
│  │  │  │ - afterWeight: { ... }           │         │         │ │
│  │  │  └─────────────────────────────────┘         │         │ │
│  │  │                                               │         │ │
│  │  │  ┌─────────────────────────────────┐         │         │ │
│  │  │  │ lastCalculated (最後の計算結果)    │         │         │ │
│  │  │  │ { mean, stdDev, count, ... }     │         │         │ │
│  │  │  └─────────────────────────────────┘         │         │ │
│  │  │                                               │         │ │
│  │  └──────────────────────────────────────────────┘         │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

改善点:
✅ すべての状態がappStateに集約
✅ データ重複の解消
✅ 階層構造で見通しが良い
✅ メソッド経由でアクセス（カプセル化）
✅ デバッグが容易
```

---

## データフローの比較

### 現在（複雑・分散）

```
歩留まり統計を計算する場合:

1. ユーザー入力
   ↓
2. 生データを収集
   ↓
3. appState.setYieldStatsData(data) ← 生データを保存
   ↓
4. 統計を計算
   ↓
5. window.statsDataByType[type] = stats ← 計算結果を保存
   ↓
6. window.yieldStatsState.isCalculated = true ← フラグ更新
   ↓
7. window.yieldStatsState.hasYieldRateData = true ← データ有無更新
   ↓
8. window.lastCalculatedStats = stats ← キャッシュ保存
   ↓
9. 結果を表示

❌ 4箇所に分散して保存
❌ 同期漏れのリスク
```

### 統合後（シンプル・一元化）

```
歩留まり統計を計算する場合:

1. ユーザー入力
   ↓
2. 生データを収集
   ↓
3. appState.setYieldStatsRawData(data)
   ├─ rawData を保存
   └─ hasYieldRateData など自動更新 ✨
   ↓
4. 統計を計算
   ↓
5. appState.setCalculatedStats(type, stats)
   ├─ calculatedStats[type] を保存
   ├─ lastCalculated を自動更新 ✨
   └─ isCalculated を自動更新 ✨
   ↓
6. 結果を表示

✅ 1箇所に集約
✅ 自動同期
✅ シンプル
```

---

## メソッド呼び出しの比較

### 外れ値を除外する場合

#### 現在（グローバル変数を直接操作）

```javascript
// ❌ 複数のグローバル変数を直接操作
window.yieldStatsState.manuallyExcludedOutlierIndices.add(index);
window.yieldStatsState.isOutlierExcluded = true;

// ❌ 別の場所で同期を忘れると不整合が発生
if (window.yieldStatsState.manuallyExcludedOutlierIndices.size > 0) {
  // ...
}
```

#### 統合後（メソッド経由で操作）

```javascript
// ✅ メソッド1つで完結
appState.excludeOutlierByIndex(index);

// ✅ 内部で自動的にフラグも更新される
// this.yieldStats.ui.isOutlierExcluded = true;
```

---

## ファイル別の変更量

```
┌─────────────────────────────────────────────────────────┐
│ ファイル                               変更箇所  難易度   │
├─────────────────────────────────────────────────────────┤
│ scripts/yield-stats-display.js         41箇所   ★★★★★ │
│ scripts/yield-stats-transition.js      17箇所   ★★★★☆ │
│ scripts/mode-manager.js                13箇所   ★★★☆☆ │
│ scripts/multi-pattern-stats-loader.js   9箇所   ★★★☆☆ │
│ scripts/yield-stats-table.js            7箇所   ★★☆☆☆ │
│ scripts/sample-size-validator.js        6箇所   ★★☆☆☆ │
│ scripts/event-handlers-setup.js         3箇所   ★☆☆☆☆ │
│ scripts/history-save-dialog.js          3箇所   ★☆☆☆☆ │
│ scripts/history-restore.js              4箇所   ★☆☆☆☆ │
│ scripts/history-ui.js                   1箇所   ★☆☆☆☆ │
│ __tests__/yield-stats-transition.test.js 6箇所  ★★☆☆☆ │
└─────────────────────────────────────────────────────────┘

合計: 110箇所の変更
```

---

## 段階的移行の流れ

```
Step 1: 新しい構造を追加（1時間）
┌──────────────────────────────────────┐
│ scripts/state.js                     │
│                                      │
│ ✚ yieldStats オブジェクト追加        │
│ ✚ 20個の新しいメソッド実装           │
│                                      │
│ ※既存コードは動作し続ける             │
└──────────────────────────────────────┘
              ↓
Step 2a: 最重要ファイルを移行（1.5時間）
┌──────────────────────────────────────┐
│ scripts/yield-stats-display.js       │
│                                      │
│ 📝 41箇所を置き換え                   │
│ 🧪 ブラウザでテスト                   │
│ ✅ コミット                          │
└──────────────────────────────────────┘
              ↓
Step 2b: 重要ファイルを移行（2時間）
┌──────────────────────────────────────┐
│ scripts/yield-stats-transition.js    │
│ scripts/mode-manager.js              │
│ scripts/multi-pattern-stats-loader.js│
│                                      │
│ 📝 各ファイルを順次変更               │
│ 🧪 その都度ブラウザでテスト           │
│ ✅ 各ファイル変更後にコミット         │
└──────────────────────────────────────┘
              ↓
Step 2c: 残りのファイルを移行（1時間）
┌──────────────────────────────────────┐
│ 残りの6ファイル                       │
│                                      │
│ 📝 一括で変更                        │
│ 🧪 まとめてテスト                    │
│ ✅ コミット                          │
└──────────────────────────────────────┘
              ↓
Step 3: 検証とクリーンアップ（1時間）
┌──────────────────────────────────────┐
│ 🧪 全機能のリグレッションテスト       │
│ 📝 ドキュメント更新                   │
│ 🗑️ 非推奨コードの削除（オプション）   │
│ ✅ 最終コミット & プッシュ            │
└──────────────────────────────────────┘
```

---

## コード例：Before / After

### 例1: 統計データの保存

#### Before（分散・複雑）
```javascript
// yield-stats-display.js

// ❌ 4箇所に分散して保存
appState.setYieldStatsData(data);  // 生データ
window.statsDataByType = {          // 計算結果
  yieldRate: yieldRateStats,
  beforeWeight: beforeWeightStats,
  afterWeight: afterWeightStats
};
window.yieldStatsState.hasYieldRateData = true;     // フラグ
window.yieldStatsState.hasBeforeWeightData = true;  // フラグ
window.yieldStatsState.hasAfterWeightData = true;   // フラグ
window.yieldStatsState.isCalculated = true;         // フラグ
window.lastCalculatedStats = yieldRateStats;        // キャッシュ
```

#### After（一元化・シンプル）
```javascript
// yield-stats-display.js

// ✅ 2箇所に集約（フラグは自動更新）
appState.setYieldStatsRawData(data);  // 生データ + フラグ自動更新
appState.setCalculatedStats('yieldRate', yieldRateStats);       // ✨
appState.setCalculatedStats('beforeWeight', beforeWeightStats); // ✨
appState.setCalculatedStats('afterWeight', afterWeightStats);   // ✨
// isCalculated, lastCalculated は自動更新される
```

---

### 例2: 外れ値の除外

#### Before（直接操作・冗長）
```javascript
// yield-stats-display.js

// ❌ 直接操作、複数行
window.yieldStatsState.manuallyExcludedOutlierIndices.clear();
window.yieldStatsState.currentOutlierValues = [];
window.yieldStatsState.isOutlierExcluded = false;
```

#### After（メソッド経由・簡潔）
```javascript
// yield-stats-display.js

// ✅ メソッド1つで完結
appState.clearExcludedOutliers();
```

---

### 例3: 統計データの取得

#### Before（長い・冗長）
```javascript
// multi-pattern-stats-loader.js

// ❌ 長いパス
const statsData = window.statsDataByType?.[selectedStatsType];
const validation = window.yieldStatsState?.sampleSizeValidation?.[selectedStatsType];
const hasYieldRateData = window.yieldStatsState.hasYieldRateData;
```

#### After（短い・明確）
```javascript
// multi-pattern-stats-loader.js

// ✅ メソッド経由
const statsData = appState.getCalculatedStats(selectedStatsType);
const validation = appState.yieldStats.validation[selectedStatsType];
const hasYieldRateData = appState.yieldStats.ui.hasYieldRateData;
```

---

## まとめ

### 現在の問題点
❌ **分散**: 4つのグローバルオブジェクト
❌ **重複**: データが2箇所に存在
❌ **同期**: 手動で同期が必要
❌ **複雑**: 初期化順序に依存
❌ **デバッグ困難**: 状態がどこにあるか不明

### 統合後の改善
✅ **一元化**: appState 1箇所に集約
✅ **重複解消**: データは1箇所のみ
✅ **自動同期**: メソッド内で自動更新
✅ **シンプル**: 階層構造で見通し良好
✅ **デバッグ容易**: すべてappState配下

### 移行コスト
⏱️ **時間**: 5-6時間
🔧 **変更**: 11ファイル、110箇所
⚠️ **リスク**: 中〜高（段階的移行で軽減可能）

### 推奨
✅ **段階的移行**: ファイル単位で移行、その都度テスト
✅ **後方互換性**: 非推奨メソッドを残して段階的に削除
✅ **コミット**: 各ステップでコミットしてロールバック可能に
