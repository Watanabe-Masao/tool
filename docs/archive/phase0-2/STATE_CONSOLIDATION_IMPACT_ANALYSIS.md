# グローバル状態統合: 影響範囲分析と移行計画

## 📅 作成日
2025-11-05

## 🎯 目的
4つのグローバルオブジェクトを統合し、状態管理を一元化する影響範囲を分析する

---

## 📊 現状の使用状況

### 使用統計

| グローバルオブジェクト | 出現回数 | ファイル数 | 主な役割 |
|---------------------|---------|----------|---------|
| `window.yieldStatsState` | 72回 | 6ファイル | UI状態・外れ値管理 |
| `window.statsDataByType` | 21回 | 5ファイル | 統計計算結果 |
| `appState.showYieldStatsWithMultiPattern` | 20回 | 6ファイル | 2画面モード制御 |
| `appState.YieldStats*` メソッド | 14回 | 8ファイル | 生データ管理 |
| `window.lastCalculatedStats` | 8回 | 4ファイル | 最後の計算結果キャッシュ |

**合計**: 135回の参照 / 11ファイル

---

## 📁 影響を受けるファイル

### 最重要ファイル（多数の変更が必要）

#### 1. `scripts/yield-stats-display.js`
**影響度: 🔴 極大 (41箇所)**

**主な使用箇所**:
- `window.yieldStatsState`の初期化 (line 560)
- `currentDisplayType`: 統計タイプの切り替え
- `manuallyExcludedOutlierIndices`: 手動除外された外れ値
- `currentOutlierValues`: 現在の外れ値リスト
- `isCalculated`, `isFromHistory`: 計算状態フラグ
- `hasYieldRateData`, `hasBeforeWeightData`, `hasAfterWeightData`: データ存在フラグ
- `sampleSizeValidation`: サンプルサイズ妥当性情報

**構造**:
```javascript
window.yieldStatsState = {
  currentDisplayType: 'yieldRate',           // 現在表示中の統計タイプ
  manuallyExcludedOutlierIndices: new Set(), // 手動除外インデックス
  currentOutlierValues: [],                  // 外れ値リスト
  isCalculated: false,                       // 計算完了フラグ
  isFromHistory: false,                      // 履歴読込フラグ
  hasYieldRateData: false,                   // 歩留まり率データ有無
  hasBeforeWeightData: false,                // 加工前重量データ有無
  hasAfterWeightData: false,                 // 加工後重量データ有無
  isOutlierExcluded: false,                  // 外れ値除外フラグ
  sampleSizeValidation: {                    // サンプルサイズ妥当性
    yieldRate: null,
    beforeWeight: null,
    afterWeight: null
  }
};
```

#### 2. `scripts/mode-manager.js`
**影響度: 🟠 大 (13箇所)**

**主な使用箇所**:
- `appState.showYieldStatsWithMultiPattern` (6箇所): 2画面モード制御
- `window.statsDataByType` (1箇所): 統計データクリア
- `window.lastCalculatedStats` (1箇所): 計算結果クリア
- `window.yieldStatsState.sampleSizeValidation` (2箇所): 妥当性情報クリア

**機能**:
- 歩留まり統計⇔複数パターン分析のモード切替
- データ保持判定
- 統計データのクリア

#### 3. `scripts/yield-stats-transition.js`
**影響度: 🟠 大 (17箇所)**

**主な使用箇所**:
- `window.statsDataByType` (4箇所): データ存在チェック
- `window.yieldStatsState` (14箇所): 状態チェックとリセット
- `appState.showYieldStatsWithMultiPattern` (1箇所): フラグ管理
- `window.lastCalculatedStats` (1箇所): 計算結果リセット

**機能**:
- 統計データ存在チェック
- 統計データ全クリア
- Promise待機（ポーリング）

### 重要ファイル（中程度の変更が必要）

#### 4. `scripts/sample-size-validator.js`
**影響度: 🟡 中 (6箇所)**

**主な使用箇所**:
- `window.yieldStatsState.sampleSizeValidation` (3箇所): 妥当性情報の保存
- `window.lastCalculatedStats` (2箇所): 計算結果キャッシュ
- `appState.getYieldStatsData()` (1箇所): 生データ取得

**機能**:
- サンプルサイズ妥当性の計算と保存
- 統計結果のキャッシング

#### 5. `scripts/multi-pattern-stats-loader.js`
**影響度: 🟡 中 (9箇所)**

**主な使用箇所**:
- `window.yieldStatsState` (5箇所): 表示タイプ、サンプルサイズ妥当性
- `window.statsDataByType` (4箇所): 統計データ取得

**機能**:
- 推奨値の複数パターン分析への転記
- サンプルサイズチェック

#### 6. `scripts/yield-stats-table.js`
**影響度: 🟡 中 (7箇所)**

**主な使用箇所**:
- `window.yieldStatsState` (7箇所): 外れ値インデックス、履歴フラグ

**機能**:
- テーブルのクリア
- 履歴復元時のフラグ設定

### 軽微な変更ファイル

#### 7. `scripts/event-handlers-setup.js`
**影響度: 🟢 小 (3箇所)**
- `window.statsDataByType`: 統計データチェック

#### 8. `scripts/history-save-dialog.js`
**影響度: 🟢 小 (3箇所)**
- `appState.getYieldStatsData()`: 生データ取得

#### 9. `scripts/history-restore.js`
**影響度: 🟢 小 (4箇所)**
- `appState.showYieldStatsWithMultiPattern`: フラグ設定

#### 10. `scripts/history-ui.js`
**影響度: 🟢 小 (1箇所)**
- `appState.getYieldStatsData()`: 生データ取得

#### 11. `__tests__/yield-stats-transition.test.js`
**影響度: 🟢 小 (6箇所)**
- テストコードのモック設定

---

## 🏗️ 統合設計案

### オプションA: appStateへの統合（推奨）

#### 新しい状態構造

```javascript
// scripts/state.js

class AppState {
  constructor() {
    // 既存のプロパティ...
    this.mode = MODE.FIXED;
    this.isHistoryLoaded = false;
    this.loadedHistoryId = null;
    this.showYieldStatsWithMultiPattern = false;

    // ✨ 新規追加: 歩留まり統計の状態を一元管理
    this.yieldStats = {
      // 生データ（既存のyieldStatsDataを移行）
      rawData: null,  // { yieldRate: [...], beforeWeight: [...], afterWeight: [...] }

      // 計算結果（window.statsDataByType を移行）
      calculatedStats: {
        yieldRate: null,      // { mean, stdDev, count, min, max, median, mode, ... }
        beforeWeight: null,
        afterWeight: null
      },

      // UI状態（window.yieldStatsState を移行）
      ui: {
        currentDisplayType: 'yieldRate',
        isCalculated: false,
        isFromHistory: false,
        hasYieldRateData: false,
        hasBeforeWeightData: false,
        hasAfterWeightData: false,
        isOutlierExcluded: false
      },

      // 外れ値管理（window.yieldStatsState から移行）
      outliers: {
        manuallyExcludedIndices: new Set(),
        currentValues: []
      },

      // サンプルサイズ妥当性（window.yieldStatsState.sampleSizeValidation を移行）
      validation: {
        yieldRate: null,
        beforeWeight: null,
        afterWeight: null
      },

      // 最後の計算結果キャッシュ（window.lastCalculatedStats を移行）
      lastCalculated: null
    };
  }

  // ✨ 新規メソッド: 歩留まり統計データの取得
  getYieldStatsRawData() {
    return this.yieldStats.rawData;
  }

  // ✨ 新規メソッド: 歩留まり統計データの設定
  setYieldStatsRawData(data) {
    this.yieldStats.rawData = data;
    // データ有無フラグを自動更新
    this.yieldStats.ui.hasYieldRateData = !!(data?.yieldRate?.length >= 2);
    this.yieldStats.ui.hasBeforeWeightData = !!(data?.beforeWeight?.length >= 2);
    this.yieldStats.ui.hasAfterWeightData = !!(data?.afterWeight?.length >= 2);
  }

  // ✨ 新規メソッド: 計算結果の取得
  getCalculatedStats(type) {
    return this.yieldStats.calculatedStats[type];
  }

  // ✨ 新規メソッド: 計算結果の設定
  setCalculatedStats(type, stats) {
    this.yieldStats.calculatedStats[type] = stats;
    this.yieldStats.ui.isCalculated = true;
  }

  // ✨ 新規メソッド: すべての統計データをクリア
  clearAllYieldStats() {
    this.yieldStats.rawData = null;
    this.yieldStats.calculatedStats = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };
    this.yieldStats.ui = {
      currentDisplayType: 'yieldRate',
      isCalculated: false,
      isFromHistory: false,
      hasYieldRateData: false,
      hasBeforeWeightData: false,
      hasAfterWeightData: false,
      isOutlierExcluded: false
    };
    this.yieldStats.outliers = {
      manuallyExcludedIndices: new Set(),
      currentValues: []
    };
    this.yieldStats.validation = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };
    this.yieldStats.lastCalculated = null;
  }

  // ✨ 新規メソッド: 外れ値の手動除外
  excludeOutlierByIndex(index) {
    this.yieldStats.outliers.manuallyExcludedIndices.add(index);
  }

  // ✨ 新規メソッド: 外れ値除外をクリア
  clearExcludedOutliers() {
    this.yieldStats.outliers.manuallyExcludedIndices.clear();
    this.yieldStats.outliers.currentValues = [];
    this.yieldStats.ui.isOutlierExcluded = false;
  }

  // ✨ 新規メソッド: サンプルサイズ妥当性の設定
  setSampleSizeValidation(type, validation) {
    this.yieldStats.validation[type] = validation;
  }

  // ✨ 新規メソッド: 現在の表示タイプを取得
  getCurrentDisplayType() {
    return this.yieldStats.ui.currentDisplayType;
  }

  // ✨ 新規メソッド: 現在の表示タイプを設定
  setCurrentDisplayType(type) {
    if (this.yieldStats.ui.currentDisplayType !== type) {
      // タイプが変更された場合、外れ値除外をリセット
      this.clearExcludedOutliers();
    }
    this.yieldStats.ui.currentDisplayType = type;
  }

  // 既存メソッドを非推奨化（互換性のため残す）
  getYieldStatsData() {
    console.warn('[Deprecated] getYieldStatsData() は非推奨です。getYieldStatsRawData() を使用してください。');
    return this.getYieldStatsRawData();
  }

  setYieldStatsData(data) {
    console.warn('[Deprecated] setYieldStatsData() は非推奨です。setYieldStatsRawData() を使用してください。');
    this.setYieldStatsRawData(data);
  }
}

export const appState = new AppState();
```

---

## 🔄 移行マッピング

### グローバル変数 → appState プロパティ

| 現在のグローバル変数 | 新しいappStateプロパティ | 備考 |
|---------------------|------------------------|------|
| `appState.yieldStatsData` | `appState.yieldStats.rawData` | 生データ |
| `window.statsDataByType.yieldRate` | `appState.yieldStats.calculatedStats.yieldRate` | 計算結果 |
| `window.statsDataByType.beforeWeight` | `appState.yieldStats.calculatedStats.beforeWeight` | 計算結果 |
| `window.statsDataByType.afterWeight` | `appState.yieldStats.calculatedStats.afterWeight` | 計算結果 |
| `window.yieldStatsState.currentDisplayType` | `appState.yieldStats.ui.currentDisplayType` | 表示タイプ |
| `window.yieldStatsState.manuallyExcludedOutlierIndices` | `appState.yieldStats.outliers.manuallyExcludedIndices` | 除外インデックス |
| `window.yieldStatsState.currentOutlierValues` | `appState.yieldStats.outliers.currentValues` | 外れ値リスト |
| `window.yieldStatsState.isCalculated` | `appState.yieldStats.ui.isCalculated` | 計算完了フラグ |
| `window.yieldStatsState.isFromHistory` | `appState.yieldStats.ui.isFromHistory` | 履歴読込フラグ |
| `window.yieldStatsState.hasYieldRateData` | `appState.yieldStats.ui.hasYieldRateData` | データ有無 |
| `window.yieldStatsState.hasBeforeWeightData` | `appState.yieldStats.ui.hasBeforeWeightData` | データ有無 |
| `window.yieldStatsState.hasAfterWeightData` | `appState.yieldStats.ui.hasAfterWeightData` | データ有無 |
| `window.yieldStatsState.isOutlierExcluded` | `appState.yieldStats.ui.isOutlierExcluded` | 外れ値除外フラグ |
| `window.yieldStatsState.sampleSizeValidation` | `appState.yieldStats.validation` | 妥当性情報 |
| `window.lastCalculatedStats` | `appState.yieldStats.lastCalculated` | 最後の計算結果 |

---

## 📝 移行手順

### フェーズ1: 新しい状態構造の追加（1時間）

1. **scripts/state.js を更新**
   - `yieldStats` オブジェクトを追加
   - 新しいメソッドを実装
   - 既存メソッドを非推奨化（後方互換性のため）

2. **テストコードの作成**
   - `__tests__/state-yield-stats.test.js` を作成
   - 新しいメソッドのユニットテスト

### フェーズ2: 各ファイルの移行（3-4時間）

#### ステップ1: yield-stats-display.js（最重要、1.5時間）
- [ ] `window.yieldStatsState` 初期化を削除
- [ ] 41箇所の参照を `appState.yieldStats.*` に置き換え
- [ ] `window.statsDataByType` の参照を `appState.yieldStats.calculatedStats` に置き換え

**置き換え例**:
```javascript
// Before:
window.yieldStatsState.currentDisplayType = selectedType;
window.statsDataByType[selectedType] = stats;

// After:
appState.setCurrentDisplayType(selectedType);
appState.setCalculatedStats(selectedType, stats);
```

#### ステップ2: yield-stats-transition.js（30分）
- [ ] 17箇所の参照を置き換え
- [ ] `clearAllYieldStatsData()` を `appState.clearAllYieldStats()` を使用するように更新

#### ステップ3: mode-manager.js（30分）
- [ ] 13箇所の参照を置き換え
- [ ] `clearYieldStatsInputs()` を更新

#### ステップ4: sample-size-validator.js（20分）
- [ ] 6箇所の参照を置き換え
- [ ] `appState.setSampleSizeValidation()` を使用

#### ステップ5: multi-pattern-stats-loader.js（20分）
- [ ] 9箇所の参照を置き換え

#### ステップ6: yield-stats-table.js（20分）
- [ ] 7箇所の参照を置き換え

#### ステップ7: その他のファイル（30分）
- [ ] event-handlers-setup.js (3箇所)
- [ ] history-save-dialog.js (3箇所)
- [ ] history-restore.js (4箇所)
- [ ] history-ui.js (1箇所)

### フェーズ3: テストと検証（1時間）

1. **ユニットテストの更新**
   - `__tests__/yield-stats-transition.test.js` を更新
   - モック設定を新しいappState構造に合わせる

2. **ブラウザでの動作確認**
   - 歩留まり統計の計算
   - 外れ値の検出と除外
   - 複数パターン分析への遷移
   - 履歴の保存と読み込み

3. **リグレッションテスト**
   - すべてのモードでの動作確認
   - データの保持と消去の動作確認

---

## ⚠️ リスクと対策

### 高リスク

1. **データ同期の問題**
   - **リスク**: 複数箇所で状態を変更するとデータの整合性が崩れる
   - **対策**: すべての変更をappStateのメソッド経由にする

2. **後方互換性**
   - **リスク**: 既存のコードが動かなくなる
   - **対策**: 非推奨メソッドを残し、段階的に移行

### 中リスク

3. **テストコードの更新漏れ**
   - **リスク**: テストが失敗する
   - **対策**: 移行後にすべてのテストを実行

4. **Set型のシリアライゼーション**
   - **リスク**: `manuallyExcludedOutlierIndices` (Set) を履歴保存する際の問題
   - **対策**: 保存時にArray変換、復元時にSet変換

---

## 📈 期待される効果

### コード品質の向上

1. **状態の一元管理**
   - ✅ すべての歩留まり統計データがappStateに集約
   - ✅ データの流れが明確になる

2. **保守性の向上**
   - ✅ 状態変更がメソッド経由で行われる
   - ✅ デバッグが容易になる

3. **テスト容易性**
   - ✅ appStateをモックすればすべての状態をコントロール可能
   - ✅ ユニットテストが書きやすくなる

### 削減される問題

1. **データ重複の解消**
   - ❌ 削除: `window.statsDataByType` と `appState.yieldStatsData` の重複
   - ❌ 削除: `window.lastCalculatedStats` の中途半端なキャッシュ

2. **グローバル汚染の削減**
   - ❌ 削除: `window.statsDataByType`
   - ❌ 削除: `window.lastCalculatedStats`
   - ❌ 削除: `window.yieldStatsState`
   - ✅ 残存: `appState` のみ

3. **初期化順序の問題解消**
   - ✅ appStateのコンストラクタで一括初期化
   - ✅ 初期化漏れがなくなる

---

## 🎯 移行の優先順位

### 推奨順序

1. **フェーズ1: 新しい構造の追加** (1時間)
   - リスク: 低
   - 影響: なし（既存コードは動作し続ける）

2. **フェーズ2: 段階的な移行** (3-4時間)
   - リスク: 中〜高
   - 推奨: ファイル単位で移行し、その都度ブラウザテスト

3. **フェーズ3: 検証とクリーンアップ** (1時間)
   - リスク: 低
   - 最終確認とドキュメント更新

**合計見積もり時間**: 5-6時間

---

## ✅ チェックリスト

### フェーズ1: 新しい構造の追加
- [ ] scripts/state.js に `yieldStats` オブジェクトを追加
- [ ] 新しいメソッドを実装（20個程度）
- [ ] ユニットテストを作成

### フェーズ2: 移行作業
- [ ] yield-stats-display.js (41箇所)
- [ ] yield-stats-transition.js (17箇所)
- [ ] mode-manager.js (13箇所)
- [ ] multi-pattern-stats-loader.js (9箇所)
- [ ] yield-stats-table.js (7箇所)
- [ ] sample-size-validator.js (6箇所)
- [ ] event-handlers-setup.js (3箇所)
- [ ] history-save-dialog.js (3箇所)
- [ ] history-restore.js (4箇所)
- [ ] history-ui.js (1箇所)

### フェーズ3: テストと検証
- [ ] ユニットテストの更新
- [ ] ブラウザでの動作確認
- [ ] すべてのモードでのリグレッションテスト

### フェーズ4: クリーンアップ
- [ ] 非推奨メソッドの削除（オプション）
- [ ] ドキュメントの更新
- [ ] コミット & プッシュ

---

## 🤔 決定が必要な事項

### 質問1: 移行を実施するか？

**オプションA**: 今すぐ実施する（5-6時間）
- **メリット**: コードがクリーンになる、将来のメンテナンスが楽
- **デメリット**: 時間がかかる、バグのリスク

**オプションB**: 後回しにする
- **メリット**: 今は時間を節約できる
- **デメリット**: 技術的負債が残る

### 質問2: 段階的に移行するか、一括で移行するか？

**オプションA**: 段階的（ファイル単位で移行、その都度コミット）
- **メリット**: リスク分散、ロールバックが容易
- **デメリット**: 時間がかかる

**オプションB**: 一括（すべてのファイルを一度に変更）
- **メリット**: 速い
- **デメリット**: リスクが高い、バグが見つけにくい

### 質問3: 後方互換性をどこまで保つか？

**オプションA**: 非推奨メソッドを残す（1-2ヶ月後に削除）
- **メリット**: 段階的移行が可能
- **デメリット**: コードが増える

**オプションB**: 即座に削除
- **メリット**: クリーン
- **デメリット**: 一括で移行する必要がある

---

## 📚 関連ファイル

### 新規作成予定
- `docs/STATE_CONSOLIDATION_IMPACT_ANALYSIS.md` (このファイル)
- `__tests__/state-yield-stats.test.js` (新しい状態構造のテスト)

### 変更予定
- `scripts/state.js` (新しい状態構造)
- `scripts/yield-stats-display.js` (最大の変更)
- `scripts/yield-stats-transition.js`
- `scripts/mode-manager.js`
- `scripts/sample-size-validator.js`
- `scripts/multi-pattern-stats-loader.js`
- `scripts/yield-stats-table.js`
- `scripts/event-handlers-setup.js`
- `scripts/history-save-dialog.js`
- `scripts/history-restore.js`
- `scripts/history-ui.js`
- `__tests__/yield-stats-transition.test.js`

---

## 💡 推奨アクション

**私からの推奨**:

1. **今すぐ実施するなら**: オプションA（段階的移行）を推奨
   - フェーズ1だけ先に実施（1時間）
   - ブラウザテスト後、問題なければフェーズ2に進む
   - 各ファイル変更後にコミット

2. **後回しにするなら**:
   - このドキュメントを保存
   - 次回のリファクタリング時に実施
   - 現状のコードは動作しているため急ぐ必要はない

**ユーザーの判断を待ちます**:
- 今すぐ実施しますか？
- 後回しにしますか？
- さらに詳しい情報が必要ですか？
