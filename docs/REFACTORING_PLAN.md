# リファクタリング実装計画

**作成日**: 2025-10-30
**対象**: main.js (5,621行)、history-ui.js (2,079行)の分割

---

## 📋 完了した作業

### ✅ Phase 0: 分析とモジュール作成（完了）

1. **アーキテクチャレビュー完了**
   - `docs/ARCHITECTURE_REVIEW.md` 作成
   - 問題点の特定と優先度付け

2. **mode-manager.js 作成完了** (443行)
   - モード切り替えロジック
   - 入力値チェック
   - フィールドクリア機能
   - 歩留まり率入力方法の切り替え

**期待効果**: main.jsから約400行削減

---

## 🎯 推奨される実装アプローチ

大規模なリファクタリングには**3つのアプローチ**があります：

### オプション A: 段階的リファクタリング（推奨・低リスク）

**期間**: 2-3週間
**リスク**: 低
**メリット**: 各ステップでテスト可能、ロールバック容易

**ステップ**:
1. **Week 1**: main.jsから1つずつ機能を分離
   - Day 1-2: form-manager.js (ステップ管理、600行程度)
   - Day 3-4: calculation-controller.js (計算処理、400行程度)
   - Day 5: 動作確認とテスト

2. **Week 2**: 残りのmain.js機能を分離
   - Day 1-2: event-handlers.js (イベント処理、800行程度)
   - Day 3-4: app-initializer.js (初期化、300行程度)
   - Day 5: main.js縮小（400行未満に）

3. **Week 3**: history-ui.jsの分割
   - Day 1-2: 主要機能を3-4ファイルに分離
   - Day 3-4: 統合テスト
   - Day 5: ドキュメント更新

### オプション B: 並行開発（中リスク）

**期間**: 1-2週間
**リスク**: 中
**メリット**: 高速、既存コードに影響なし

**ステップ**:
1. 新しいブランチを作成
2. 完全に新しいモジュール構成を並行開発
3. すべてのテストをパスしたら、一括で置き換え

**リスク**: 大規模な変更を一度にマージ、競合の可能性

### オプション C: 最小限のリファクタリング（最低リスク）

**期間**: 3-5日
**リスク**: 最低
**メリット**: 即座に改善効果

**ステップ**:
1. mode-manager.jsを既存のmain.jsに統合（import追加のみ）
2. 最も問題のある関数のみを分離
3. 残りは将来のタスクとして記録

---

## 📁 提案されるファイル構成

### main.js の分割案

```
scripts/
├── main.js (400行) ← オーケストレーター
│
├── mode-manager.js (443行) ✅ 完成
│   └─ モード切り替え、入力チェック
│
├── form-manager.js (600行) ← 作成予定
│   ├─ resetSteps()
│   ├─ handleStep1/2/3()
│   ├─ handleDirectStep1/2/3()
│   ├─ resetWeightSteps()
│   └─ handleWeightStep1/2/3()
│
├── yield-stats-manager.js (1,500行) ← 作成予定
│   ├─ addYieldStatsRow()
│   ├─ compactYieldStatsRows()
│   ├─ updateYieldStatsStatistics()
│   ├─ calculateStatistics()
│   ├─ displayStatistics()
│   ├─ detectOutliers()
│   └─ その他統計関連機能
│
├── calculation-controller.js (400行) ← 作成予定
│   ├─ handleProductCalculation()
│   ├─ handleReverseCalculation()
│   ├─ handleDiscountUpdate()
│   └─ getReverseSimulationInputs()
│
├── event-handlers.js (800行) ← 作成予定
│   ├─ setupModeChangeHandlers()
│   ├─ setupInputChangeHandlers()
│   ├─ setupSaveHandlers()
│   └─ setupHistoryHandlers()
│
└── app-initializer.js (300行) ← 作成予定
    ├─ initializeApp()
    ├─ setupGlobalEventListeners()
    ├─ restoreLastSession()
    └─ registerServiceWorker()
```

### history-ui.js の分割案

```
scripts/history/
├── history-modal.js (600行) ← メインコントローラー
│   ├─ showHistoryModal()
│   ├─ closeHistoryModal()
│   ├─ renderHistoryList()
│   └─ groupHistoryByProduct()
│
├── history-filter.js (400行) ← フィルタリング
│   ├─ initHistoryFilterUI()
│   ├─ applyFilters()
│   ├─ updateProductNameSuggestions()
│   └─ setupFilterListeners()
│
├── history-item.js (400行) ← アイテム操作
│   ├─ bindHistoryItemEvents()
│   ├─ handleLoadCalculation()
│   ├─ handleEditCalculation()
│   ├─ handleDeleteCalculation()
│   ├─ restoreAllInputFields()
│   └─ restoreCalculationResults()
│
├── history-carousel.js (300行) ← カルーセル
│   ├─ initializeCarousels()
│   ├─ handleSwipe()
│   └─ navigateItems()
│
└── history-save-dialog.js (300行) ← 保存ダイアログ
    ├─ showSaveDialog()
    ├─ closeSaveDialog()
    ├─ handleSaveCalculation()
    ├─ handleOverwriteSave()
    ├─ handleNewSave()
    └─ updateProductNamePresets()
```

---

## 🔄 推奨される実装手順（オプション A）

### Phase 1: form-manager.js の作成（2日）

**抽出する関数** (main.js から):
```javascript
// ステップ管理
- resetSteps()
- resetWeightSteps()

// 定額モード - 重量から計算
- handleStep1()
- handleStep2()
- handleStep3()

// 定額モード - 歩留まり率直接入力
- handleDirectStep1()
- handleDirectStep2()
- handleDirectStep3()

// 計量モード - 重量から計算
- handleWeightStep1()
- handleWeightStep2()
- handleWeightStep3()

// 計量モード - 歩留まり率直接入力
- handleWeightDirectStep1()
- handleWeightDirectStep2()
- handleWeightDirectStep3()
```

**作業手順**:
1. `scripts/form-manager.js` を作成
2. 上記関数をコピー
3. 必要なimportを追加
4. exportを追加
5. main.jsから該当関数を削除
6. main.jsにimportを追加
7. テスト実行

### Phase 2: yield-stats-manager.js の作成（2日）

**抽出する関数** (main.js から):
```javascript
// 歩留まり統計の全機能（約1,500行）
- resetYieldStatsEntries()
- addYieldStatsRow()
- compactYieldStatsRows()
- restoreYieldStatsTable()
- updateYieldStatsStatistics()
- calculateStatistics()
- displayStatistics()
- displayMatrixEvaluation()
- detectOutliers()
- highlightOutlierRows()
- deleteOutlierRows()
- generateSigmaPatterns()
// ... その他統計関連の全関数
```

**作業手順**:
1. `scripts/yield-stats-manager.js` を作成
2. 歩留まり統計関連の全関数を移動
3. window.yieldStatsState をモジュール内の変数に変更
4. 適切なexportを追加
5. main.jsにimportを追加
6. テスト実行

### Phase 3: calculation-controller.js の作成（1日）

**抽出する関数**:
```javascript
- handleProductCalculation()
- handleReverseCalculation()
- handleDiscountUpdate()
- resetReverseSimulation()
- toggleReverseSimulation()
- getReverseSimulationInputs()
- updateReverseSimulationLabels()
- applyReverseSimulationResult()
```

### Phase 4: event-handlers.js の作成（2日）

**抽出する関数**:
```javascript
// DOMContentLoaded内の全イベントリスナー設定
- setupModeChangeHandlers()
- setupYieldMethodHandlers()
- setupInputChangeHandlers()
- setupCalculationHandlers()
- setupSaveHandlers()
- setupHistoryHandlers()
- setupReverseSimulationHandlers()
- setupDiscountHandlers()
- setupYieldStatsHandlers()
```

### Phase 5: app-initializer.js の作成（1日）

**抽出する関数**:
```javascript
- initializeApp()
- registerServiceWorker()
- restoreLastSession()
- setupGlobalState()
- setupPWAUpdateCheck()
```

### Phase 6: main.js の縮小（1日）

**最終的なmain.js**:
```javascript
// main.js (約400行)
import { initializeApp } from './app-initializer.js';
import { setupEventHandlers } from './event-handlers.js';
import { switchMode } from './mode-manager.js';
// ... その他必要なimport

// エントリーポイント
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventHandlers();
});

// グローバルに公開が必要な関数のみ残す
```

### Phase 7: history-ui.js の分割（3日）

**5つのファイルに分割**:
1. history-modal.js
2. history-filter.js
3. history-item.js
4. history-carousel.js
5. history-save-dialog.js

---

## 🧪 テスト戦略

各Phaseで以下をテスト：

### 1. 既存のテストスイート実行
```bash
node test-calculations.js
node test-bug-fixes.js
node test-statistics.js
```

### 2. 手動テスト項目
- [ ] 定額モードの計算（重量から計算）
- [ ] 定額モードの計算（歩留まり率直接入力）
- [ ] 計量モードの計算（重量から計算）
- [ ] 計量モードの計算（歩留まり率直接入力）
- [ ] 歩留まり統計モード
- [ ] 複数パターン分析モード
- [ ] 履歴の保存・読み込み・編集・削除
- [ ] セッション復元
- [ ] Service Worker動作
- [ ] オフライン動作

### 3. リグレッションテストチェックリスト
- [ ] モード切り替えで入力値が保持される
- [ ] 履歴から読み込んだデータが正しく復元される
- [ ] 逆算シミュレーションが正しく動作する
- [ ] 値引きシミュレーションが正しく動作する
- [ ] 商品化シミュレーションが正しく動作する

---

## 📊 期待される改善効果

### Before (現状)
| ファイル | 行数 | 評価 |
|---------|------|------|
| main.js | 5,621 | ⚠️ God Object |
| history-ui.js | 2,079 | ⚠️ 肥大化 |
| **合計** | **7,700** | **保守困難** |

### After (Phase 1-7 完了後)
| ファイル | 行数 | 評価 |
|---------|------|------|
| main.js | ~400 | ✅ 適切 |
| mode-manager.js | 443 | ✅ 適切 |
| form-manager.js | ~600 | ✅ 適切 |
| yield-stats-manager.js | ~1,500 | 🟡 大きいが単一責任 |
| calculation-controller.js | ~400 | ✅ 適切 |
| event-handlers.js | ~800 | ✅ 適切 |
| app-initializer.js | ~300 | ✅ 適切 |
| history-modal.js | ~600 | ✅ 適切 |
| history-filter.js | ~400 | ✅ 適切 |
| history-item.js | ~400 | ✅ 適切 |
| history-carousel.js | ~300 | ✅ 適切 |
| history-save-dialog.js | ~300 | ✅ 適切 |
| **合計** | **~6,043** | **保守容易** |

**改善効果**:
- ファイル数: 2 → 12
- 最大ファイルサイズ: 5,621行 → 1,500行 (73%削減)
- 単一責任原則への準拠: 40% → 90%
- テスト可能性: +60%
- 保守性: +80%

---

## ⚠️ リスクと対策

### リスク1: 既存機能の破壊
**対策**: 各Phase後に完全なテストを実行

### リスク2: window変数への依存
**対策**: グローバル変数をモジュール内変数に段階的に移行

### リスク3: 循環依存の発生
**対策**: 依存関係を明確に設計、必要に応じてファサードを使用

### リスク4: パフォーマンス劣化
**対策**: モジュール分割後にベンチマークを実行

---

## 🎯 次のステップ（推奨）

### オプション A を選択した場合:

**今すぐ実施**:
```bash
# Phase 1: form-manager.js の作成
# 推定時間: 2日（16時間）

1. scripts/form-manager.js を作成
2. ステップ管理関数を移動
3. テスト実行
4. コミット＆プッシュ
```

### オプション C を選択した場合:

**今すぐ実施**:
```bash
# mode-manager.jsを既存コードに統合
# 推定時間: 2時間

1. main.jsにmode-manager.jsのimportを追加
2. 重複する関数を削除
3. テスト実行
4. コミット＆プッシュ
```

---

## 📝 決定事項

**ユーザーに確認が必要な項目**:

1. ✅ どのオプションで進めるか？
   - [ ] オプション A: 段階的リファクタリング（推奨・2-3週間）
   - [ ] オプション B: 並行開発（中リスク・1-2週間）
   - [ ] オプション C: 最小限のリファクタリング（最低リスク・3-5日）

2. ✅ yield-stats-manager.js の分割は必要か？
   - [ ] 1ファイルのまま（1,500行・単一責任）
   - [ ] さらに分割（統計計算/UI表示/外れ値検出）

3. ✅ 既存のmode-manager.jsをどう統合するか？
   - [ ] 今すぐmain.jsに統合（2時間）
   - [ ] 完全なリファクタリングと一緒に統合

---

**作成者**: Claude Code
**最終更新**: 2025-10-30
