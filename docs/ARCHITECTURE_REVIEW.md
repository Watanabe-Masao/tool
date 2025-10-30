# 🏗️ アーキテクチャレビュー報告書

**レビュー日時**: 2025-10-30
**プロジェクト**: 歩留まり計算ツール
**レビュアー**: Claude Code

---

## 📊 プロジェクト概要

**技術スタック**: Vanilla JavaScript (ES6+), IndexedDB, Service Worker
**総コード量**: 約10,722行（JavaScript）、50,000行（CSS）
**モジュール数**: 17ファイル

---

## ✅ 評価できる点（強み）

### 1. 優れたレイヤー分離
- プレゼンテーション層、アプリケーション層、ビジネスロジック層、データアクセス層、インフラ層が明確に分離されている
- ARCHITECTURE.mdに詳細なドキュメントが整備されている

### 2. 純粋関数の適切な分離
```javascript
// calculation.js - 副作用なし、テスト容易
export function calcYield(beforeWeightG, afterWeightG) {
  if (!isPositive(beforeWeightG) || !isPositive(afterWeightG)) return null;
  return (afterWeightG / beforeWeightG) * 100;
}
```
- 計算ロジックが純粋関数として実装されている
- 単体テストが容易で、バグの混入が少ない

### 3. 適切なデザインパターンの適用
- **Singleton**: AppState、Database（適切）
- **Strategy**: 計算モード別の処理切り替え
- **Facade**: IndexedDBラッパー（db.js）
- **Module**: ES6モジュールによる名前空間管理

### 4. データベース設計の工夫
```javascript
// db.js - Race Condition対策
async open() {
  if (this.db) return Promise.resolve(this.db);
  if (this.openPromise) return this.openPromise; // 重複open防止
  this.openPromise = new Promise(...);
}
```
- IndexedDBの複雑性を適切にカプセル化
- トランザクション管理が適切

### 5. PWAアーキテクチャの実装
- Service Workerによる完全オフライン対応
- 自動バージョニング（GitHub Actions連携）
- Network-Firstキャッシュ戦略

---

## ⚠️ 重大な問題点

### 🔴 問題1: God Object Anti-pattern（main.js: 5,621行）

**現状**:
```
main.js (5,621行)
├─ イベント処理
├─ モード切替ロジック
├─ 入力値のクリア処理
├─ フォーム初期化
├─ セッション管理連携
├─ 履歴UI連携
├─ 計算トリガー
└─ 商品化シミュレーション連携
```

**問題点**:
- 単一責任原則（SRP）の重大な違反
- 保守性が著しく低い（変更時の影響範囲が不明確）
- テストが困難
- コードレビューが困難
- 新規メンバーのオンボーディングが困難

**影響**:
- バグ混入リスク: **高**
- 保守コスト: **高**
- 拡張性: **低**

**推奨される改善策**:

#### 1️⃣ イベントハンドラーの分離
```
新規ファイル: event-handlers.js (推定 800行)
├─ setupModeChangeHandlers()
├─ setupInputChangeHandlers()
├─ setupSaveHandlers()
└─ setupHistoryHandlers()
```

#### 2️⃣ モード管理の分離
```
新規ファイル: mode-manager.js (推定 600行)
├─ switchToFixedMode()
├─ switchToWeightMode()
├─ switchToYieldStatsMode()
├─ switchToMultiPatternMode()
└─ clearModeInputs(mode)
```

#### 3️⃣ フォーム管理の分離
```
新規ファイル: form-manager.js (推定 500行)
├─ initializeForms()
├─ validateForm(mode)
├─ clearForm(mode)
└─ populateForm(data)
```

#### 4️⃣ アプリケーション初期化の分離
```
新規ファイル: app-initializer.js (推定 300行)
├─ initializeApp()
├─ setupGlobalEventListeners()
├─ restoreLastSession()
└─ registerServiceWorker()
```

**リファクタリング後の構造**:
```javascript
// main.js (推定 400行) ← オーケストレーターのみ
import { initializeApp } from './app-initializer.js';
import { setupEventHandlers } from './event-handlers.js';
import { ModeManager } from './mode-manager.js';
import { FormManager } from './form-manager.js';

// エントリーポイント
document.addEventListener('DOMContentLoaded', async () => {
  await initializeApp();
  setupEventHandlers();
});
```

**期待される効果**:
- 各ファイルが400-800行に収まる
- 単一責任原則に準拠
- 個別のユニットテストが可能
- 保守性が大幅に向上

---

### 🟡 問題2: history-ui.js の肥大化（2,079行）

**現状**:
```
history-ui.js (2,079行)
├─ 履歴モーダルの表示制御
├─ 履歴一覧のレンダリング
├─ フィルタリング機能
├─ 商品名候補の管理
├─ カルーセル機能
├─ 保存ダイアログ
├─ エクスポート/インポート
├─ 編集/削除機能
└─ トースト通知
```

**推奨される改善策**:

#### 分割案:
```
history-ui/
├─ history-modal.js (推定 600行) - メインコントローラー
│   ├─ showHistoryModal()
│   ├─ closeHistoryModal()
│   └─ renderHistoryList()
│
├─ history-filter.js (推定 400行) - フィルタリング
│   ├─ initHistoryFilterUI()
│   ├─ applyFilters()
│   └─ updateProductNameSuggestions()
│
├─ history-item.js (推定 400行) - アイテム操作
│   ├─ bindHistoryItemEvents()
│   ├─ handleEdit()
│   ├─ handleDelete()
│   └─ handleLoad()
│
├─ history-carousel.js (推定 300行) - カルーセル
│   ├─ initializeCarousels()
│   ├─ handleSwipe()
│   └─ navigateItems()
│
└─ history-save-dialog.js (推定 300行) - 保存ダイアログ
    ├─ showSaveDialog()
    ├─ handleSave()
    └─ handleCategoryInput()
```

---

### 🟡 問題3: constants.js の膨張（257行）

**現状**:
すべての定数が1ファイルに集約されている

**問題点**:
- 関連性の低い定数が混在
- import時に不要な定数も読み込まれる

**推奨される改善策**:

```
constants/
├─ ui-elements.js     - UI要素のID
├─ modes.js           - モード定義
├─ field-ids.js       - 入力フィールドID
├─ calculation.js     - 計算定数
└─ index.js           - 統合エクスポート
```

---

## 📐 設計原則への準拠評価

### SOLID原則

| 原則 | 準拠度 | 評価 |
|------|--------|------|
| **S**ingle Responsibility | 🟡 60% | main.js、history-ui.jsが違反 |
| **O**pen/Closed | ✅ 85% | 計算モジュールは拡張可能 |
| **L**iskov Substitution | ✅ 90% | 計算関数の互換性が高い |
| **I**nterface Segregation | ✅ 80% | 適切なAPI設計 |
| **D**ependency Inversion | ✅ 75% | db.jsがFacadeとして機能 |

### DRY原則（Don't Repeat Yourself）

**評価**: 🟢 **85%**

**良い点**:
- calculation.jsで計算ロジックを共通化
- dom-utils.jsでDOM操作を共通化
- constants.jsで定数を一元管理

**改善点**:
```javascript
// main.js内に重複するクリア処理が多数存在
// 推奨: 共通のフィールドクリア関数を作成
// 新規: field-utils.js
export function clearFields(fieldIds) {
  fieldIds.forEach(id => {
    const el = qs(`#${id}`);
    if (el) el.value = '';
  });
}
```

### KISS原則（Keep It Simple, Stupid）

**評価**: 🟡 **70%**

**良い点**:
- 計算関数がシンプル
- 依存ライブラリがゼロ（Vanilla JS）

**改善点**:
- main.jsの複雑性が高すぎる
- ネストが深い関数が散見される

---

## 🔗 依存関係の評価

### 依存関係グラフ分析

```
依存関係の深さ:

Level 0 (依存なし):
  - calculation.js
  - constants.js
  - dom-utils.js

Level 1 (Level 0のみに依存):
  - state.js → constants.js
  - db.js (依存なし)

Level 2:
  - calculator-fixed.js → calculation.js, constants.js, dom-utils.js
  - calculator-weight.js → calculation.js, constants.js, dom-utils.js
  - display.js → dom-utils.js, calculation.js, constants.js
  - storage.js → db.js, dom-utils.js
  - session.js → dom-utils.js, constants.js

Level 3:
  - product-simulator.js → dom-utils.js, constants.js, display.js
  - history-ui.js → storage.js, dom-utils.js, state.js, constants.js, calculation.js, display.js

Level 4:
  - main.js → すべてのモジュール
```

### 結合度評価

| モジュール | 結合度 | 評価 |
|-----------|--------|------|
| calculation.js | **疎結合** ✅ | 依存なし、純粋関数 |
| db.js | **疎結合** ✅ | 依存なし、カプセル化が適切 |
| main.js | **密結合** ⚠️ | 多数のモジュールに依存 |
| history-ui.js | **密結合** ⚠️ | 6モジュールに依存 |

### 循環依存の検査

**検査結果**: ✅ **循環依存なし**

すべてのモジュールが一方向の依存関係を持っており、循環は発生していません。

---

## 🧪 テスト可能性の評価

### 現状のテストカバレッジ

```
テスト済み:
✅ calculation.js (test-calculations.js)
✅ calculator-*.js (test-calculations.js)
✅ calculator-yield-stats.js (test-statistics.js)
✅ バグフィックス (test-bug-fixes.js)

未テスト:
❌ main.js (テスト困難)
❌ history-ui.js (テスト困難)
❌ display.js
❌ storage.js
❌ db.js (実際のIndexedDBが必要)
❌ product-simulator.js
```

**カバレッジ推定**: 🟡 **約40%**

### テスト困難性の原因

1. **main.jsの肥大化**: 単一ファイルで多数の責務を持つため、モック化が困難
2. **DOM依存**: 多くの関数がDOMに直接アクセス
3. **グローバル状態**: appStateへの暗黙的な依存

### 改善提案

#### 1️⃣ 依存性注入（DI）の導入

**現状**:
```javascript
// display.js - DOMに直接依存
export function displayResults(data) {
  setText(UI_ELEMENTS.YIELD_RATE, pct(toFixed(data.yr)));
  // ...
}
```

**改善後**:
```javascript
// テスト可能な設計
export function displayResults(data, renderer = defaultRenderer) {
  renderer.setText(UI_ELEMENTS.YIELD_RATE, pct(toFixed(data.yr)));
  // ...
}

// テスト時
const mockRenderer = { setText: jest.fn() };
displayResults(testData, mockRenderer);
```

#### 2️⃣ E2Eテストの導入

推奨ツール: Playwright、Cypress

```javascript
// 例: history-ui.spec.js
test('履歴モーダルが表示される', async ({ page }) => {
  await page.click('#historyBtn');
  await expect(page.locator('#historyModal')).toBeVisible();
});
```

---

## 🎯 優先度別改善提案

### 🔴 高優先度（即座に対処すべき）

#### 1. main.jsの分割（推定工数: 20-30時間）
- **理由**: 最大のボトルネック、保守性への影響大
- **アプローチ**: 段階的リファクタリング
  1. イベントハンドラーを分離（5-8時間）
  2. モード管理を分離（5-8時間）
  3. フォーム管理を分離（5-8時間）
  4. 統合テスト（5-6時間）

#### 2. history-ui.jsの分割（推定工数: 10-15時間）
- **理由**: 2番目に大きなファイル、機能追加時の複雑性
- **アプローチ**: 機能別に分割
  1. フィルタリング機能の分離（3-4時間）
  2. カルーセル機能の分離（3-4時間）
  3. 保存ダイアログの分離（4-5時間）

### 🟡 中優先度（計画的に対処）

#### 3. テストカバレッジの向上（推定工数: 15-20時間）
- E2Eテストフレームワークの導入（5時間）
- 主要フローのE2Eテスト作成（10-15時間）

#### 4. 型安全性の導入（推定工数: 20-30時間）
- JSDocによる型注釈の追加（10-15時間）
- または、TypeScriptへの段階的移行（20-30時間）

#### 5. エラーハンドリングの統一（推定工数: 5-8時間）
- エラーバウンダリーの導入
- 統一的なエラー通知機構

### 🟢 低優先度（必要に応じて）

#### 6. パフォーマンス最適化
- 履歴リストの仮想スクロール化
- 大量データの遅延レンダリング

#### 7. アクセシビリティの向上
- ARIA属性の追加
- キーボードナビゲーションの強化

---

## 📋 具体的なリファクタリング計画

### Phase 1: main.jsの分割（Week 1-2）

```
Week 1:
  Day 1-2: event-handlers.js の作成と移行
  Day 3-4: mode-manager.js の作成と移行
  Day 5: テストと動作確認

Week 2:
  Day 1-2: form-manager.js の作成と移行
  Day 3-4: app-initializer.js の作成と移行
  Day 5: 統合テストとドキュメント更新
```

### Phase 2: history-ui.jsの分割（Week 3）

```
Week 3:
  Day 1: history-filter.js の分離
  Day 2: history-carousel.js の分離
  Day 3: history-save-dialog.js の分離
  Day 4-5: テストと動作確認
```

### Phase 3: テスト環境の整備（Week 4）

```
Week 4:
  Day 1-2: Playwrightのセットアップ
  Day 3-5: 主要フローのE2Eテスト作成
```

---

## 📊 コードメトリクス

### ファイルサイズ分布

| ファイル | 行数 | 評価 |
|---------|------|------|
| main.js | 5,621行 | ⚠️ 要分割 |
| history-ui.js | 2,079行 | ⚠️ 要分割 |
| multi-pattern-ui.js | 551行 | ✅ 適切 |
| product-simulator.js | 377行 | ✅ 適切 |
| db.js | 311行 | ✅ 適切 |
| storage.js | 277行 | ✅ 適切 |
| その他 | <300行 | ✅ 適切 |

### 推奨されるファイルサイズ

- **理想**: 200-400行
- **許容**: 400-600行
- **要検討**: 600行以上
- **要分割**: 1,000行以上

---

## 🎓 学習ポイントとベストプラクティス

### 優れている点から学ぶ

1. **純粋関数の分離**: calculation.jsは模範的
2. **Facadeパターン**: db.jsのIndexedDBラッパーが優秀
3. **ドキュメント**: ARCHITECTURE.mdが詳細で素晴らしい
4. **PWA実装**: Service Workerの実装が適切

### 改善すべき点から学ぶ

1. **God Objectの回避**: 1ファイル1,000行を超えたら分割を検討
2. **単一責任**: 各モジュールは1つの責務のみ
3. **テスタビリティ**: 設計段階からテストを意識

---

## 📝 まとめ

### 総合評価: 🟡 **B+ (良好だが改善の余地あり)**

| 項目 | スコア | コメント |
|------|--------|----------|
| アーキテクチャ設計 | 80% | レイヤー分離は優秀 |
| モジュール分割 | 60% | main.js、history-ui.jsが課題 |
| SOLID原則 | 70% | SRPに課題 |
| DRY原則 | 85% | 良好 |
| テスト可能性 | 65% | 純粋関数は優秀、UIロジックに課題 |
| ドキュメント | 95% | 非常に優秀 |
| **総合** | **76%** | **良好** |

### 最重要アクション

1. ✅ **main.jsの分割**: これが最大のボトルネック
2. ✅ **テストの拡充**: 信頼性向上のため
3. ✅ **history-ui.jsの分割**: 保守性向上のため

### 結論

このアーキテクチャは全体として**よく設計されており**、特に以下の点が優秀です：

- ✅ 純粋関数の分離
- ✅ レイヤー構造
- ✅ PWA実装
- ✅ ドキュメント

ただし、**main.jsとhistory-ui.jsの肥大化**が最大の課題です。これらを分割することで、保守性、テスタビリティ、拡張性が大幅に向上します。

---

**レビュー完了日**: 2025-10-30
**次回レビュー推奨時期**: Phase 1完了後（2週間後）
