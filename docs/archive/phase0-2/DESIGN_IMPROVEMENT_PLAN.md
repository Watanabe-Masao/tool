# 設計改善計画書

**プロジェクト名**: 歩留まり計算ツール
**作成日**: 2025-11-05
**ステータス**: Phase 1 実施中
**総合評価**: 54/150点（36%）🟠

---

## 📋 目次

1. [エグゼクティブサマリー](#エグゼクティブサマリー)
2. [Phase 1: セキュリティ対応（即座実施）](#phase-1-セキュリティ対応即座実施)
3. [Phase 2: アーキテクチャ改善（1-2ヶ月）](#phase-2-アーキテクチャ改善1-2ヶ月)
4. [Phase 3: 品質向上（2-3ヶ月）](#phase-3-品質向上2-3ヶ月)
5. [Phase 4: 拡張性確保（3-6ヶ月）](#phase-4-拡張性確保3-6ヶ月)
6. [Phase 5: パフォーマンス最適化（6ヶ月以降）](#phase-5-パフォーマンス最適化6ヶ月以降)
7. [実施ガイドライン](#実施ガイドライン)
8. [リスク管理](#リスク管理)
9. [成功指標（KPI）](#成功指標kpi)

---

## エグゼクティブサマリー

### 現状の問題点

| カテゴリ | 重大度 | 問題数 | 影響範囲 |
|---------|--------|--------|----------|
| **セキュリティ** | 🔴 Critical | 2 | 全体 |
| **アーキテクチャ** | 🟠 High | 6 | 30ファイル |
| **品質・テスト** | 🟠 High | 3 | 全体 |
| **保守性** | 🟡 Medium | 4 | 20ファイル |

### 改善の優先順位

1. **即座対応**: セキュリティ（APIキー露出、デバッグコード削除）
2. **1-2ヶ月**: アーキテクチャ改善（状態管理、依存性注入）
3. **2-3ヶ月**: 品質向上（テスト、エラーハンドリング）
4. **3-6ヶ月**: 拡張性確保（Strategyパターン、コンポーネント化）

---

## Phase 1: セキュリティ対応（即座実施）

**期間**: 1日
**優先度**: 🔴 Critical
**担当者**: 全員必須

### 1.1 Firebase APIキーの保護 ✅ 完了

**問題**: APIキーがソースコードに直接ハードコード

**対策**:
```bash
# 実施済み
✅ scripts/firebase-config.example.js を作成（テンプレート）
✅ .gitignore に scripts/firebase-config.js を追加
✅ firebase-config.js にセキュリティ警告を追加
```

**次のステップ**:
```bash
# Gitから既存のfirebase-config.jsを削除（歴史から完全削除）
git rm --cached scripts/firebase-config.js
git commit -m "security: Remove firebase-config.js from Git tracking"

# Firebase APIキーをローテーション（推奨）
# 1. Firebaseコンソールで新しいウェブアプリを作成
# 2. 古いAPIキーを無効化
# 3. 新しいAPIキーで firebase-config.js を更新
```

**セットアップ手順書** (`docs/FIREBASE_SETUP.md` に追記):
```markdown
## 新規開発者向けセットアップ

1. firebase-config.example.js をコピー:
   ```bash
   cp scripts/firebase-config.example.js scripts/firebase-config.js
   ```

2. Firebaseコンソールから設定値を取得して貼り付け

3. 絶対にコミットしないこと（.gitignore で保護済み）
```

**検証**:
- [ ] `git status` で firebase-config.js が表示されないこと
- [ ] firebase-config.example.js にはダミー値のみ含まれること
- [ ] アプリが正常に動作すること

---

### 1.2 本番環境デバッグコードの削除

**問題**: console.log/warn/error が406回残存

**影響範囲**: 22ファイル

#### 実施計画

**Step 1: ロギングフレームワークの導入**

新規ファイル: `scripts/logger.js`

```javascript
/**
 * アプリケーション統一ロガー
 * 環境に応じてログレベルを制御
 */

const LOG_LEVELS = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
};

class Logger {
  constructor() {
    // 本番環境では ERROR のみ
    // 開発環境では DEBUG まで
    this.level = this.getLogLevel();
  }

  getLogLevel() {
    // サービスワーカーのビルドタイムスタンプで判定
    const isDevelopment = location.hostname === 'localhost' ||
                         location.hostname === '127.0.0.1';

    return isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
  }

  error(message, ...args) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(`[ERROR] ${message}`, ...args);
    }
  }

  warn(message, ...args) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(`[WARN] ${message}`, ...args);
    }
  }

  info(message, ...args) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.info(`[INFO] ${message}`, ...args);
    }
  }

  debug(message, ...args) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }
}

export const logger = new Logger();
```

**Step 2: 段階的な置き換え**

優先順位の高いファイルから置き換え:

1. **scripts/db.js** (80回) - 最優先
2. **scripts/firebase-sync.js** (105回)
3. **scripts/storage.js** (44回)

置き換え例:
```javascript
// Before
console.log('✅ 保存完了 (ID:', result.id, ')');
console.error('Failed to save calculation:', error);

// After
import { logger } from './logger.js';
logger.info('保存完了', { id: result.id });
logger.error('計算データの保存に失敗', error);
```

**Step 3: ESLintルールの追加**

`.eslintrc.json` を作成:
```json
{
  "rules": {
    "no-console": ["error", {
      "allow": []
    }]
  }
}
```

これにより、今後の `console.*` の使用を防止。

**実施スケジュール**:
- Day 1: logger.js の作成とテスト
- Day 2-3: db.js, firebase-sync.js の置き換え
- Day 4-5: 残りの20ファイルの置き換え

**検証**:
```bash
# 本番ビルドでconsole.*が残っていないことを確認
grep -r "console\." scripts/ --exclude="logger.js"
```

---

### 1.3 セキュリティレビューチェックリスト

実施前に以下を確認:

- [ ] **機密情報のハードコード**: APIキー、パスワード、トークン
- [ ] **XSS脆弱性**: ユーザー入力のサニタイズ
- [ ] **CSRF対策**: Firebase認証で対応済み
- [ ] **依存関係の脆弱性**: `npm audit` 実行
- [ ] **Firebaseセキュリティルール**: ユーザーごとのアクセス制御

**実行コマンド**:
```bash
# 依存関係の脆弱性チェック
npm audit

# 機密情報スキャン
git secrets --scan
```

---

## Phase 2: アーキテクチャ改善（1-2ヶ月）

**期間**: 6-8週間
**優先度**: 🟠 High
**担当者**: シニア開発者推奨

### 2.1 状態管理の分割

**問題**: `state.js` が525行で肥大化、複数の責務を持つ

#### 実施計画

**現在の構造**:
```
state.js (525行)
├── AppState (全体管理)
├── CalculationSnapshot (計算結果)
├── ProductSimulationData (商品シミュレーション)
└── yieldStats (歩留まり統計 - 400行以上!)
```

**改善後の構造**:
```
states/
├── app-state.js (150行) - コア状態管理
├── calculation-state.js (100行) - 計算結果管理
├── yield-stats-state.js (250行) - 歩留まり統計専用
└── ui-state.js (50行) - UI状態フラグ
```

**Step 1: yield-stats-state.js の分離**

新規ファイル: `scripts/states/yield-stats-state.js`

```javascript
/**
 * 歩留まり統計の状態管理
 * 旧: state.js の yieldStats セクション (87-505行)
 */

export class YieldStatsState {
  constructor() {
    this.rawData = null;
    this.calculatedStats = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };
    this.ui = {
      currentDisplayType: 'yieldRate',
      isCalculated: false,
      isFromHistory: false,
      hasYieldRateData: false,
      hasBeforeWeightData: false,
      hasAfterWeightData: false,
      isOutlierExcluded: false
    };
    this.outliers = {
      manuallyExcludedIndices: new Set(),
      currentValues: []
    };
    this.validation = {
      yieldRate: null,
      beforeWeight: null,
      afterWeight: null
    };
    this.lastCalculated = null;
  }

  // メソッドを state.js から移動
  getRawData() {
    return this.rawData;
  }

  setRawData(data) {
    this.rawData = data;
    this.updateDataFlags(data);
  }

  updateDataFlags(data) {
    if (data) {
      this.ui.hasYieldRateData = !!(data.yieldRate?.length >= 2);
      this.ui.hasBeforeWeightData = !!(data.beforeWeight?.length >= 2);
      this.ui.hasAfterWeightData = !!(data.afterWeight?.length >= 2);
    } else {
      this.ui.hasYieldRateData = false;
      this.ui.hasBeforeWeightData = false;
      this.ui.hasAfterWeightData = false;
    }
  }

  // ... 他のメソッド
}
```

**Step 2: app-state.js のリファクタリング**

```javascript
/**
 * アプリケーション全体の状態管理（リファクタリング版）
 */

import { YieldStatsState } from './yield-stats-state.js';
import { CalculationSnapshot } from './calculation-state.js';
import { UIState } from './ui-state.js';

export class AppState {
  constructor() {
    this.mode = MODE.FIXED;
    this.currentStep = 1;

    // 分離された状態管理クラス
    this.snapshot = new CalculationSnapshot();
    this.yieldStats = new YieldStatsState();
    this.ui = new UIState();

    this.loadedHistoryId = null;
  }

  // シンプルなメソッドのみ残す
  setMode(mode) {
    this.mode = mode;
    this.currentStep = 1;
  }

  getMode() {
    return this.mode;
  }
}

export const appState = new AppState();
```

**Step 3: 影響範囲の修正**

以下の12ファイルで `appState` の使用箇所を修正:

1. scripts/yield-stats-display.js
2. scripts/sample-size-validator.js
3. scripts/history-restore.js
4. scripts/history-ui.js
5. scripts/yield-stats-table.js
6. scripts/event-handlers-setup.js
7. scripts/mode-manager.js
8. scripts/reverse-simulation.js
9. scripts/history-save-dialog.js
10. scripts/form-manager.js
11. scripts/multi-pattern-stats-loader.js
12. scripts/yield-stats-transition.js

修正例:
```javascript
// Before
import { appState } from './state.js';
const data = appState.getYieldStatsRawData();

// After
import { appState } from './states/app-state.js';
const data = appState.yieldStats.getRawData();
```

**実施スケジュール**:
- Week 1: yield-stats-state.js の作成とユニットテスト
- Week 2: app-state.js のリファクタリング
- Week 3-4: 12ファイルの段階的修正とテスト

**検証**:
```bash
# 既存のテストが全て通ることを確認
npm test

# 手動テスト
# - 歩留まり統計モードが正常動作すること
# - 履歴の保存/読み込みが正常動作すること
```

---

### 2.2 依存性注入パターンの導入

**問題**: グローバルシングルトン `appState` への過度な依存

**影響**: 12ファイルが密結合、単体テストが困難

#### 実施計画

**Step 1: StateManager インターフェースの定義**

新規ファイル: `scripts/core/state-manager.interface.js`

```javascript
/**
 * 状態管理のインターフェース
 * テスト時にモックを注入可能にする
 */

export class StateManager {
  getMode() { throw new Error('Not implemented'); }
  setMode(mode) { throw new Error('Not implemented'); }
  getSnapshot() { throw new Error('Not implemented'); }
  // ... 他の必須メソッド
}
```

**Step 2: 関数への依存性注入**

```javascript
// Before (グローバル依存)
import { appState } from './state.js';

export function handleStep1() {
  const mode = appState.getMode();
  const snapshot = appState.getSnapshot();
  // ...
}

// After (依存性注入)
export function handleStep1(stateManager = appState) {
  const mode = stateManager.getMode();
  const snapshot = stateManager.getSnapshot();
  // ...
}
```

**Step 3: テストでのモック注入**

```javascript
// __tests__/form-manager.test.js

import { handleStep1 } from '../scripts/form-manager.js';

class MockStateManager {
  getMode() { return 'fixed'; }
  getSnapshot() { return { afterCost: 100 }; }
}

describe('handleStep1', () => {
  it('固定モードで正常に動作', () => {
    const mockState = new MockStateManager();
    handleStep1(mockState);
    // アサーション
  });
});
```

**実施スケジュール**:
- Week 5: StateManager インターフェース定義
- Week 6-7: form-manager.js, mode-manager.js への適用
- Week 8: 残りの10ファイルへの適用

**検証**:
- [ ] 全テストが通ること
- [ ] モックを使った単体テストが追加されていること
- [ ] 既存機能が正常動作すること

---

### 2.3 イベントハンドラーの分割

**問題**: `event-handlers-setup.js` が27個のimport、800行以上

**改善後の構造**:
```
events/
├── fixed-mode-events.js (200行)
├── weight-mode-events.js (200行)
├── yield-stats-events.js (250行)
├── multi-pattern-events.js (150行)
└── common-events.js (100行)
```

**実施例**: `events/fixed-mode-events.js`

```javascript
/**
 * 定額モード専用イベントハンドラー
 */

import { qs } from '../dom-utils.js';
import { handleStep1, handleStep2, handleStep3 } from '../form-manager.js';
import { MODE } from '../constants.js';

export function setupFixedModeEvents(stateManager) {
  // モードボタン
  qs('#fixedBtn').addEventListener('click', () => {
    stateManager.setMode(MODE.FIXED);
    // ...
  });

  // Step 1 入力フィールド
  const step1Fields = ['unitCost', 'unitPrice', 'beforeWeight'];
  step1Fields.forEach(id => {
    qs(`#${id}`).addEventListener('input', debounce(() => {
      handleStep1(stateManager);
    }, 300));
  });

  // ... 他のイベント
}
```

**メインファイル**: `scripts/main.js`

```javascript
import { setupFixedModeEvents } from './events/fixed-mode-events.js';
import { setupWeightModeEvents } from './events/weight-mode-events.js';
import { setupYieldStatsEvents } from './events/yield-stats-events.js';
import { setupMultiPatternEvents } from './events/multi-pattern-events.js';
import { setupCommonEvents } from './events/common-events.js';
import { appState } from './states/app-state.js';

// 各モードのイベントを初期化
setupFixedModeEvents(appState);
setupWeightModeEvents(appState);
setupYieldStatsEvents(appState);
setupMultiPatternEvents(appState);
setupCommonEvents(appState);
```

**実施スケジュール**:
- Week 5-6: イベントハンドラーの分類と分割
- Week 7: テストと統合

---

## Phase 3: 品質向上（2-3ヶ月）

**期間**: 8-12週間
**優先度**: 🟠 High
**目標**: テストカバレッジ 70%

### 3.1 テストカバレッジの拡充

**現状**: 5テストファイル（10.6%）

**目標**: 47ファイル中 33ファイルでテスト（70%）

#### 優先順位

**Tier 1 - 最優先（週1-2）**:
1. `calculation.js` - コア計算ロジック
2. `calculator-fixed.js` - 定額モード計算
3. `calculator-weight.js` - 計量モード計算
4. `validation.js` - データ検証

**Tier 2 - 高優先（週3-4）**:
5. `yield-stats-calc.js` - 統計計算
6. `db.js` - IndexedDBラッパー
7. `errors.js` - エラークラス
8. `form-manager.js` - フォーム管理

**Tier 3 - 中優先（週5-8）**:
9-16. その他のビジネスロジック

**Tier 4 - 低優先（週9-12）**:
17-33. UIコンポーネント

#### テンプレート

**純粋関数のテスト**: `__tests__/calculation.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { calcYield, per100FromPerUnit, markup, isPositive } from '../scripts/calculation.js';

describe('calculation.js - 純粋関数群', () => {
  describe('calcYield - 歩留まり率計算', () => {
    it('正常な歩留まり率を計算', () => {
      expect(calcYield(1000, 800)).toBe(80);
      expect(calcYield(500, 400)).toBe(80);
    });

    it('100%を超える歩留まり率を計算（データ入力ミスケース）', () => {
      expect(calcYield(800, 1000)).toBe(125);
    });

    it('0以下の値でnullを返す', () => {
      expect(calcYield(0, 800)).toBe(null);
      expect(calcYield(-1000, 800)).toBe(null);
      expect(calcYield(1000, 0)).toBe(null);
      expect(calcYield(1000, -800)).toBe(null);
    });

    it('NaN/Infinity/undefinedでnullを返す', () => {
      expect(calcYield(NaN, 800)).toBe(null);
      expect(calcYield(1000, NaN)).toBe(null);
      expect(calcYield(Infinity, 800)).toBe(null);
      expect(calcYield(undefined, 800)).toBe(null);
    });
  });

  describe('per100FromPerUnit - 単価から100g換算', () => {
    it('正常な換算', () => {
      expect(per100FromPerUnit(200, 100)).toBe(200); // 100g=200円 → 200円/100g
      expect(per100FromPerUnit(200, 200)).toBe(100); // 200g=200円 → 100円/100g
      expect(per100FromPerUnit(150, 50)).toBe(300);  // 50g=150円 → 300円/100g
    });

    it('重量0以下でnullを返す', () => {
      expect(per100FromPerUnit(200, 0)).toBe(null);
      expect(per100FromPerUnit(200, -100)).toBe(null);
    });
  });

  describe('markup - 値入率計算', () => {
    it('正常な値入率を計算', () => {
      expect(markup(80, 100)).toBe(20); // コスト80円、売価100円 → 20%
      expect(markup(50, 100)).toBe(50); // コスト50円、売価100円 → 50%
    });

    it('コストが売価より高い場合（マイナス値入）', () => {
      expect(markup(120, 100)).toBe(-20); // コスト120円、売価100円 → -20%
    });

    it('売価0以下でnullを返す', () => {
      expect(markup(80, 0)).toBe(null);
      expect(markup(80, -100)).toBe(null);
    });
  });

  describe('isPositive - 正の数判定', () => {
    it('正の数でtrueを返す', () => {
      expect(isPositive(1)).toBe(true);
      expect(isPositive(0.01)).toBe(true);
      expect(isPositive(1000)).toBe(true);
    });

    it('0以下でfalseを返す', () => {
      expect(isPositive(0)).toBe(false);
      expect(isPositive(-1)).toBe(false);
      expect(isPositive(-0.01)).toBe(false);
    });

    it('NaN/Infinity/undefinedでfalseを返す', () => {
      expect(isPositive(NaN)).toBe(false);
      expect(isPositive(Infinity)).toBe(false);
      expect(isPositive(undefined)).toBe(false);
      expect(isPositive(null)).toBe(false);
    });
  });
});
```

**非同期処理のテスト**: `__tests__/db.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { YieldCalculatorDB } from '../scripts/db.js';

describe('YieldCalculatorDB - IndexedDBラッパー', () => {
  let db;

  beforeEach(async () => {
    db = new YieldCalculatorDB();
    await db.open();
  });

  afterEach(async () => {
    await db.clear(); // テストデータクリーンアップ
  });

  describe('add - データ追加', () => {
    it('新規データを追加できる', async () => {
      const data = {
        name: 'テスト商品',
        mode: 'fixed',
        input: { unitCost: 100 },
        result: { afterCost: 120 }
      };

      const id = await db.add(data);
      expect(id).toBeGreaterThan(0);

      const saved = await db.getById(id);
      expect(saved.name).toBe('テスト商品');
      expect(saved.uuid).toBeDefined();
    });

    it('UUIDが自動生成される', async () => {
      const data = { name: 'テスト', mode: 'fixed', input: {}, result: {} };
      const id = await db.add(data);
      const saved = await db.getById(id);

      expect(saved.uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('getById - データ取得', () => {
    it('存在するIDで取得できる', async () => {
      const data = { name: '商品A', mode: 'weight', input: {}, result: {} };
      const id = await db.add(data);
      const retrieved = await db.getById(id);

      expect(retrieved.name).toBe('商品A');
      expect(retrieved.mode).toBe('weight');
    });

    it('存在しないIDでnullを返す', async () => {
      const result = await db.getById(99999);
      expect(result).toBe(null);
    });
  });

  describe('delete - ソフトデリート', () => {
    it('deletedフラグがtrueになる', async () => {
      const id = await db.add({ name: '削除テスト', mode: 'fixed', input: {}, result: {} });
      await db.delete(id);

      const deleted = await db.getById(id);
      expect(deleted.deleted).toBe(true);
    });

    it('getAll()では削除済みデータが除外される', async () => {
      const id1 = await db.add({ name: '商品1', mode: 'fixed', input: {}, result: {} });
      const id2 = await db.add({ name: '商品2', mode: 'fixed', input: {}, result: {} });

      await db.delete(id1);

      const all = await db.getAll();
      expect(all.length).toBe(1);
      expect(all[0].name).toBe('商品2');
    });
  });
});
```

**実施スケジュール**:
- Week 1-2: Tier 1（4ファイル）
- Week 3-4: Tier 2（4ファイル）
- Week 5-8: Tier 3（8ファイル）
- Week 9-12: Tier 4（17ファイル）

**継続的インテグレーション**:

`.github/workflows/test.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm test
      - run: npm run test:coverage

      # カバレッジが70%未満で失敗
      - name: Check coverage
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "Coverage $COVERAGE% is below 70%"
            exit 1
          fi
```

---

### 3.2 統一エラーハンドリング

**問題**: try-catch 263回あるが、処理が不統一

#### 実施計画

**Step 1: ErrorHandler クラスの作成**

新規ファイル: `scripts/core/error-handler.js`

```javascript
/**
 * 統一エラーハンドラー
 * アプリケーション全体で一貫したエラー処理を提供
 */

import { logger } from './logger.js';
import { showError, showWarning } from './toast.js';
import { isRetryableError } from './errors.js';

export class ErrorHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1秒
    this.notifyUser = options.notifyUser !== false; // デフォルトtrue
  }

  /**
   * 操作を実行し、エラー時は適切に処理
   * @param {Function} operation - 実行する非同期操作
   * @param {Object} options - オプション
   * @returns {Promise<any>} 操作の結果
   */
  async execute(operation, options = {}) {
    const {
      operationName = 'operation',
      retryable = false,
      userMessage = null,
      onError = null
    } = options;

    let lastError;
    let attempt = 0;

    while (attempt < (retryable ? this.maxRetries : 1)) {
      try {
        logger.debug(`${operationName} 実行中 (試行 ${attempt + 1}/${retryable ? this.maxRetries : 1})`);
        const result = await operation();
        logger.debug(`${operationName} 成功`);
        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        logger.error(`${operationName} 失敗 (試行 ${attempt}/${retryable ? this.maxRetries : 1})`, error);

        // リトライ可能かチェック
        if (retryable && isRetryableError(error) && attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1); // 指数バックオフ
          logger.warn(`${delay}ms後に再試行します...`);
          await this.sleep(delay);
          continue;
        }

        break; // リトライ不可またはリトライ上限
      }
    }

    // エラーハンドリング
    return this.handleError(lastError, operationName, userMessage, onError);
  }

  /**
   * エラーを処理
   */
  handleError(error, operationName, userMessage, onError) {
    // カスタムエラーハンドラーがあれば実行
    if (onError) {
      try {
        onError(error);
      } catch (e) {
        logger.error('カスタムエラーハンドラーで例外', e);
      }
    }

    // ユーザーに通知
    if (this.notifyUser) {
      const message = userMessage || this.getDefaultUserMessage(error, operationName);

      if (error.retryable) {
        showWarning(message);
      } else {
        showError(message);
      }
    }

    // エラーを再スロー
    throw error;
  }

  /**
   * デフォルトのユーザー向けメッセージ
   */
  getDefaultUserMessage(error, operationName) {
    if (error.getUserMessage) {
      return error.getUserMessage();
    }

    // エラータイプに応じたメッセージ
    const messages = {
      'NetworkError': 'ネットワーク接続を確認してください',
      'NotFoundError': 'データが見つかりませんでした',
      'PermissionError': 'アクセス権限がありません',
      'ValidationError': '入力内容を確認してください',
      'DatabaseError': 'データベースエラーが発生しました',
      'OfflineError': 'オフライン状態では実行できません'
    };

    return messages[error.name] || `${operationName}に失敗しました`;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// シングルトンインスタンス
export const errorHandler = new ErrorHandler();
```

**Step 2: 既存コードの置き換え**

**Before**: `scripts/storage.js`
```javascript
export async function saveCalculation(name, mode, inputData, resultData, category, productData) {
  try {
    validateCalculationData(...);
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('[エラー] バリデーションエラー:', error.getUserMessage());
      throw error;
    }
    throw error;
  }

  if (!isSignedIn()) {
    throw new OfflineError('save');
  }

  try {
    const result = await saveToCloud(data);
    console.log(`✅ 保存完了 (ID: ${result.id})`);
    return result.id;
  } catch (error) {
    console.error('Failed to save calculation:', error);
    throw mapFirebaseError(error, 'save');
  }
}
```

**After**:
```javascript
import { errorHandler } from './core/error-handler.js';
import { logger } from './core/logger.js';

export async function saveCalculation(name, mode, inputData, resultData, category, productData) {
  return errorHandler.execute(
    async () => {
      // バリデーション
      validateCalculationData(...);

      // オンラインチェック
      if (!isSignedIn()) {
        throw new OfflineError('save');
      }

      // 保存実行
      const data = { name, mode, category, input: inputData, result: resultData, product: productData, timestamp: Date.now() };
      const result = await saveToCloud(data);

      logger.info('保存完了', { id: result.id, uuid: result.uuid });
      return result.id;
    },
    {
      operationName: 'データ保存',
      retryable: true,
      userMessage: 'データの保存に失敗しました。もう一度お試しください。'
    }
  );
}
```

**メリット**:
- エラーハンドリングロジックが1箇所に集約
- リトライロジックが自動適用
- ログとユーザー通知が統一
- テストが容易

**実施スケジュール**:
- Week 1: ErrorHandler クラスの作成とテスト
- Week 2-3: storage.js, db.js, firebase-sync.js の置き換え
- Week 4-6: 残りの16ファイルの置き換え

---

### 3.3 コードレビュープロセスの確立

**目的**: 今後の品質劣化を防ぐ

#### チェックリスト

**プルリクエスト作成時**:

```markdown
## PR Checklist

### コード品質
- [ ] ESLintエラーが0件
- [ ] console.* を使用していない（logger.* を使用）
- [ ] ハードコードされた機密情報がない
- [ ] 新規関数にJSDocコメントがある

### テスト
- [ ] 新規機能にユニットテストがある
- [ ] 既存テストが全て通る
- [ ] カバレッジが低下していない（70%以上維持）

### 設計
- [ ] 単一責任原則に従っている（関数は1つの責務）
- [ ] 新規グローバル変数を追加していない
- [ ] 依存性注入パターンを使用している

### ドキュメント
- [ ] READMEを更新（必要な場合）
- [ ] CHANGELOG.mdに変更を記載
```

**自動チェック**: `.github/workflows/pr-check.yml`

```yaml
name: PR Quality Check

on: [pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3

      # ESLint
      - name: Lint
        run: npm run lint

      # Tests
      - name: Run tests
        run: npm test

      # Coverage check
      - name: Check coverage
        run: |
          npm run test:coverage
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Coverage: $COVERAGE%"
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "❌ Coverage below 70%"
            exit 1
          fi

      # Security scan
      - name: Security audit
        run: npm audit --audit-level=moderate

      # Check for console.*
      - name: Check for console statements
        run: |
          if grep -r "console\." scripts/ --exclude="logger.js" --exclude-dir=node_modules; then
            echo "❌ Found console.* statements"
            exit 1
          fi

      # Check for hardcoded secrets
      - name: Check for secrets
        run: |
          if grep -r "AIzaSy" scripts/ --exclude="firebase-config.example.js"; then
            echo "❌ Found hardcoded API key"
            exit 1
          fi
```

---

## Phase 4: 拡張性確保（3-6ヶ月）

**期間**: 12-24週間
**優先度**: 🟡 Medium
**目標**: 新機能追加のコスト削減

### 4.1 Strategy パターンでモード管理をリファクタリング

**問題**: 新しい計算モード追加時に8箇所以上の修正が必要

#### 現在の問題点

新モード追加時の影響範囲:
1. `scripts/constants.js` - MODE定数追加
2. `scripts/states/app-state.js` - モード対応追加
3. `scripts/mode-manager.js` - スイッチング処理追加
4. `scripts/events/*.js` - イベントハンドラ追加
5. `scripts/form-manager.js` - フォーム処理追加
6. `scripts/calculator-*.js` - 新しい計算エンジン追加
7. `index.html` - UI追加
8. `styles/main.css` - スタイル追加

#### 改善後の構造

**Step 1: CalculationMode インターフェースの定義**

新規ファイル: `scripts/modes/calculation-mode.interface.js`

```javascript
/**
 * 計算モードの基底クラス
 * 全ての計算モードが実装すべきインターフェース
 */

export class CalculationMode {
  constructor() {
    if (new.target === CalculationMode) {
      throw new Error('Cannot instantiate abstract class');
    }
  }

  /**
   * モード名を取得
   * @returns {string} 'fixed', 'weight', etc.
   */
  getName() {
    throw new Error('Must implement getName()');
  }

  /**
   * モードの表示名を取得
   * @returns {string} '定額モード', '計量モード', etc.
   */
  getDisplayName() {
    throw new Error('Must implement getDisplayName()');
  }

  /**
   * 計算を実行
   * @param {Object} input - 入力データ
   * @returns {Object} 計算結果
   */
  calculate(input) {
    throw new Error('Must implement calculate()');
  }

  /**
   * 入力データを検証
   * @param {Object} input - 入力データ
   * @returns {boolean} 検証結果
   */
  validate(input) {
    throw new Error('Must implement validate()');
  }

  /**
   * フォームUIを初期化
   * @param {HTMLElement} container - コンテナ要素
   */
  renderForm(container) {
    throw new Error('Must implement renderForm()');
  }

  /**
   * 結果を表示
   * @param {Object} result - 計算結果
   * @param {HTMLElement} container - コンテナ要素
   */
  renderResult(result, container) {
    throw new Error('Must implement renderResult()');
  }

  /**
   * 入力値をクリア
   */
  clearInput() {
    throw new Error('Must implement clearInput()');
  }

  /**
   * イベントリスナーをセットアップ
   * @param {StateManager} stateManager - 状態管理
   */
  setupEvents(stateManager) {
    throw new Error('Must implement setupEvents()');
  }
}
```

**Step 2: 既存モードの実装**

新規ファイル: `scripts/modes/fixed-mode.js`

```javascript
/**
 * 定額モードの実装
 */

import { CalculationMode } from './calculation-mode.interface.js';
import { calculateFixed } from '../calculator-fixed.js';
import { qs, num, show, hide } from '../dom-utils.js';
import { FIXED_FIELDS } from '../constants.js';

export class FixedMode extends CalculationMode {
  getName() {
    return 'fixed';
  }

  getDisplayName() {
    return '定額モード';
  }

  calculate(input) {
    return calculateFixed(input.method, input);
  }

  validate(input) {
    const { unitCost, unitPrice, beforeWeight } = input;
    return unitCost > 0 && unitPrice > 0 && beforeWeight > 0;
  }

  renderForm(container) {
    // 定額モードのフォームを表示
    show('fixedModeForm');
    hide('weightModeForm');
    hide('yieldStatsModeForm');
    hide('multiPatternModeForm');
  }

  renderResult(result, container) {
    // 結果表示ロジック
    qs('#result-afterCost').textContent = result.afterCost.toFixed(2);
    qs('#result-afterPrice').textContent = result.afterPrice.toFixed(2);
    qs('#result-markup').textContent = result.markup.toFixed(2);
  }

  clearInput() {
    const fields = Object.values(FIXED_FIELDS.CALCULATE);
    fields.forEach(id => {
      const el = qs(`#${id}`);
      if (el) el.value = '';
    });
  }

  setupEvents(stateManager) {
    // 定額モード専用イベント
    qs('#fixedBtn').addEventListener('click', () => {
      stateManager.setMode(this.getName());
      this.renderForm();
    });

    // 入力フィールドのイベント
    const fields = Object.values(FIXED_FIELDS.CALCULATE);
    fields.forEach(id => {
      qs(`#${id}`).addEventListener('input', () => {
        const input = this.getInputData();
        if (this.validate(input)) {
          const result = this.calculate(input);
          this.renderResult(result);
        }
      });
    });
  }

  getInputData() {
    return {
      unitCost: num(FIXED_FIELDS.CALCULATE.UNIT_COST),
      unitPrice: num(FIXED_FIELDS.CALCULATE.UNIT_PRICE),
      beforeWeight: num(FIXED_FIELDS.CALCULATE.BEFORE_WEIGHT),
      afterWeight: num(FIXED_FIELDS.CALCULATE.AFTER_WEIGHT),
      afterPrice100: num(FIXED_FIELDS.CALCULATE.AFTER_PRICE_100)
    };
  }
}
```

同様に:
- `scripts/modes/weight-mode.js`
- `scripts/modes/yield-stats-mode.js`
- `scripts/modes/multi-pattern-mode.js`

**Step 3: モードレジストリの作成**

新規ファイル: `scripts/modes/mode-registry.js`

```javascript
/**
 * 計算モードのレジストリ
 * 全モードを一元管理
 */

import { FixedMode } from './fixed-mode.js';
import { WeightMode } from './weight-mode.js';
import { YieldStatsMode } from './yield-stats-mode.js';
import { MultiPatternMode } from './multi-pattern-mode.js';

class ModeRegistry {
  constructor() {
    this.modes = new Map();
    this.registerDefaultModes();
  }

  /**
   * デフォルトモードを登録
   */
  registerDefaultModes() {
    this.register(new FixedMode());
    this.register(new WeightMode());
    this.register(new YieldStatsMode());
    this.register(new MultiPatternMode());
  }

  /**
   * モードを登録
   * @param {CalculationMode} mode - モードインスタンス
   */
  register(mode) {
    this.modes.set(mode.getName(), mode);
  }

  /**
   * モードを取得
   * @param {string} name - モード名
   * @returns {CalculationMode} モードインスタンス
   */
  get(name) {
    const mode = this.modes.get(name);
    if (!mode) {
      throw new Error(`Unknown mode: ${name}`);
    }
    return mode;
  }

  /**
   * 全モードのリストを取得
   * @returns {Array<CalculationMode>}
   */
  getAll() {
    return Array.from(this.modes.values());
  }

  /**
   * モードが存在するかチェック
   * @param {string} name - モード名
   * @returns {boolean}
   */
  has(name) {
    return this.modes.has(name);
  }
}

export const modeRegistry = new ModeRegistry();
```

**Step 4: 使用例**

```javascript
// scripts/main.js

import { modeRegistry } from './modes/mode-registry.js';
import { appState } from './states/app-state.js';

// 全モードのイベントを初期化
modeRegistry.getAll().forEach(mode => {
  mode.setupEvents(appState);
});

// モード切り替え
function switchMode(modeName) {
  const mode = modeRegistry.get(modeName);
  appState.setMode(modeName);
  mode.renderForm();
}

// 計算実行
function executeCalculation(modeName, input) {
  const mode = modeRegistry.get(modeName);

  if (!mode.validate(input)) {
    throw new ValidationError('入力データが不正です');
  }

  const result = mode.calculate(input);
  mode.renderResult(result);
  return result;
}
```

**新モード追加の手順（改善後）**:

1. 新しいモードクラスを作成（例: `scripts/modes/profit-analysis-mode.js`）
2. `CalculationMode` を継承して実装
3. `mode-registry.js` に1行追加:
   ```javascript
   this.register(new ProfitAnalysisMode());
   ```

**これだけ！** 他のファイルは修正不要。

**実施スケジュール**:
- Week 13-14: インターフェース設計とFixedModeの実装
- Week 15-16: WeightMode, YieldStatsModeの実装
- Week 17-18: MultiPatternModeの実装とテスト
- Week 19-20: 既存コードとの統合、移行

---

### 4.2 UIコンポーネント化

**問題**: 19ファイルで110回の直接DOM操作

#### 実施計画

**Step 1: 基底コンポーネントクラス**

新規ファイル: `scripts/ui/component.js`

```javascript
/**
 * UIコンポーネントの基底クラス
 */

export class Component {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container not found: ${containerId}`);
    }
    this.state = {};
  }

  /**
   * コンポーネントをレンダリング
   * @returns {string} HTML文字列
   */
  render() {
    throw new Error('Must implement render()');
  }

  /**
   * 状態を更新して再レンダリング
   * @param {Object} newState - 新しい状態
   */
  setState(newState) {
    this.state = { ...this.state, ...newState };
    this.update();
  }

  /**
   * DOMを更新
   */
  update() {
    this.container.innerHTML = this.render();
    this.afterRender();
  }

  /**
   * レンダリング後の処理（イベント登録など）
   */
  afterRender() {
    // サブクラスでオーバーライド
  }

  /**
   * イベントリスナーをバインド
   * @param {string} selector - セレクタ
   * @param {string} event - イベント名
   * @param {Function} handler - ハンドラー
   */
  on(selector, event, handler) {
    const elements = this.container.querySelectorAll(selector);
    elements.forEach(el => {
      el.addEventListener(event, handler);
    });
  }

  /**
   * コンポーネントを破棄
   */
  destroy() {
    this.container.innerHTML = '';
  }
}
```

**Step 2: 具体的なコンポーネント実装**

例: `scripts/ui/multi-pattern-table.component.js`

```javascript
/**
 * 複数パターン分析テーブルコンポーネント
 */

import { Component } from './component.js';
import { yen, pct } from '../dom-utils.js';

export class MultiPatternTable extends Component {
  constructor(containerId) {
    super(containerId);
    this.state = {
      patterns: [],
      yieldRate: null
    };
  }

  render() {
    const { patterns, yieldRate } = this.state;

    return `
      <div class="multi-pattern-table">
        <table>
          <thead>
            <tr>
              <th>パターン名</th>
              <th>加工前原価</th>
              <th>加工前売価</th>
              <th>加工後原価</th>
              <th>加工後売価</th>
              <th>値入率</th>
            </tr>
          </thead>
          <tbody>
            ${patterns.map((pattern, index) => this.renderRow(pattern, index)).join('')}
          </tbody>
        </table>
        <button class="add-pattern-btn">+ パターン追加</button>
      </div>
    `;
  }

  renderRow(pattern, index) {
    return `
      <tr data-index="${index}">
        <td><input type="text" class="pattern-name" value="${pattern.name || ''}" /></td>
        <td><input type="number" class="before-cost" value="${pattern.beforeCost || ''}" /></td>
        <td><input type="number" class="before-price" value="${pattern.beforePrice || ''}" /></td>
        <td>${pattern.afterCost ? yen(pattern.afterCost) : '-'}</td>
        <td><input type="number" class="after-price" value="${pattern.afterPrice || ''}" /></td>
        <td class="markup">${pattern.markup ? pct(pattern.markup) : '-'}</td>
        <td><button class="delete-btn" data-index="${index}">削除</button></td>
      </tr>
    `;
  }

  afterRender() {
    // イベントリスナーを登録
    this.on('.add-pattern-btn', 'click', () => this.addPattern());
    this.on('.delete-btn', 'click', (e) => this.deletePattern(e.target.dataset.index));
    this.on('input[type="number"]', 'input', (e) => this.handleInput(e));
  }

  addPattern() {
    const newPattern = {
      name: `パターン${this.state.patterns.length + 1}`,
      beforeCost: 0,
      beforePrice: 0,
      afterPrice: 0
    };
    this.setState({
      patterns: [...this.state.patterns, newPattern]
    });
  }

  deletePattern(index) {
    const patterns = [...this.state.patterns];
    patterns.splice(index, 1);
    this.setState({ patterns });
  }

  handleInput(event) {
    const row = event.target.closest('tr');
    const index = parseInt(row.dataset.index);
    const field = event.target.className;
    const value = parseFloat(event.target.value) || 0;

    const patterns = [...this.state.patterns];
    patterns[index][field] = value;

    // 再計算
    if (this.state.yieldRate) {
      patterns[index].afterCost = this.calculateAfterCost(
        patterns[index].beforeCost,
        this.state.yieldRate
      );
      patterns[index].markup = this.calculateMarkup(
        patterns[index].afterCost,
        patterns[index].afterPrice
      );
    }

    this.setState({ patterns });
  }

  calculateAfterCost(beforeCost, yieldRate) {
    return beforeCost / (yieldRate / 100);
  }

  calculateMarkup(cost, price) {
    return ((price - cost) / price) * 100;
  }

  setYieldRate(yieldRate) {
    this.setState({ yieldRate });
  }

  getPatterns() {
    return this.state.patterns;
  }
}
```

**使用例**:

```javascript
// scripts/main.js

import { MultiPatternTable } from './ui/multi-pattern-table.component.js';

// 初期化
const multiPatternTable = new MultiPatternTable('multiPatternContainer');

// 初期データをセット
multiPatternTable.setState({
  patterns: [
    { name: 'パターンA', beforeCost: 100, beforePrice: 150, afterPrice: 200 }
  ],
  yieldRate: 80
});

// データ取得
const patterns = multiPatternTable.getPatterns();
```

**メリット**:
- DOM操作が各コンポーネント内に集約
- 状態管理が明確
- 再利用可能
- テストが容易

**実施スケジュール**:
- Week 21: Component基底クラスの作成
- Week 22-23: MultiPatternTableコンポーネント
- Week 24: HistoryListコンポーネント
- Week 25: YieldStatsTableコンポーネント
- Week 26-28: 残りのUI要素のコンポーネント化

---

### 4.3 後方互換APIの廃止

**問題**: 旧APIと新APIが混在、開発者の混乱

#### 実施計画

**Step 1: 廃止予定APIのマーク**

```javascript
// scripts/states/app-state.js

/**
 * @deprecated Use yieldStats.getRawData() instead. Will be removed in v3.0.0
 */
getYieldStatsData() {
  console.warn('getYieldStatsData() is deprecated. Use yieldStats.getRawData() instead.');
  return this.yieldStats.getRawData();
}

/**
 * @deprecated Use yieldStats.setRawData() instead. Will be removed in v3.0.0
 */
setYieldStatsData(data) {
  console.warn('setYieldStatsData() is deprecated. Use yieldStats.setRawData() instead.');
  this.yieldStats.setRawData(data);
}
```

**Step 2: 既存コードの移行**

全ファイルをスキャンして旧APIの使用箇所を検出:

```bash
# 旧APIの使用箇所を検索
grep -r "getYieldStatsData\|setYieldStatsData" scripts/ --exclude-dir=node_modules
```

各箇所を新APIに置き換え:

```javascript
// Before
const data = appState.getYieldStatsData();

// After
const data = appState.yieldStats.getRawData();
```

**Step 3: 廃止予定の通知**

`CHANGELOG.md` に記載:

```markdown
## [Unreleased]

### Deprecated
- `AppState.getYieldStatsData()` - Use `appState.yieldStats.getRawData()` instead (will be removed in v3.0.0)
- `AppState.setYieldStatsData()` - Use `appState.yieldStats.setRawData()` instead (will be removed in v3.0.0)
```

**Step 4: v3.0.0で完全削除**

6ヶ月後、警告期間を経て削除:

```javascript
// v3.0.0 で以下のメソッドを削除
// - getYieldStatsData()
// - setYieldStatsData()
```

**実施スケジュール**:
- Week 29: 廃止予定APIのマークと警告追加
- Week 30-32: 既存コードの移行
- Week 33: ドキュメント更新
- 6ヶ月後: v3.0.0で完全削除

---

## Phase 5: パフォーマンス最適化（6ヶ月以降）

**期間**: 継続的改善
**優先度**: 🟢 Low
**目標**: ページロード時間 < 1秒

### 5.1 コード分割とLazy Loading

**現状**: 全JavaScriptが初回ロードで読み込まれる（約500KB）

**目標**: 初回ロード時は必須ファイルのみ（< 100KB）

#### 実施計画

**Step 1: エントリーポイントの最小化**

```javascript
// scripts/main.js (最小版)

// 必須モジュールのみ即座ロード
import { initApp } from './core/init.js';
import { registerServiceWorker } from './core/sw-register.js';

// アプリ初期化
initApp();
registerServiceWorker();

// モード別の遅延ロード
async function loadMode(modeName) {
  switch (modeName) {
    case 'fixed':
      const { FixedMode } = await import('./modes/fixed-mode.js');
      return new FixedMode();
    case 'weight':
      const { WeightMode } = await import('./modes/weight-mode.js');
      return new WeightMode();
    case 'yieldStats':
      const { YieldStatsMode } = await import('./modes/yield-stats-mode.js');
      return new YieldStatsMode();
    case 'multiPattern':
      const { MultiPatternMode } = await import('./modes/multi-pattern-mode.js');
      return new MultiPatternMode();
    default:
      throw new Error(`Unknown mode: ${modeName}`);
  }
}
```

**Step 2: 重いライブラリの遅延ロード**

```javascript
// ECharts（統計グラフ用、約1MB）は歩留まり統計モード選択時のみロード

async function loadECharts() {
  if (!window.echarts) {
    const echarts = await import('https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js');
    window.echarts = echarts;
  }
  return window.echarts;
}

// 使用時
async function showYieldStatsChart(data) {
  const echarts = await loadECharts();
  const chart = echarts.init(document.getElementById('chart'));
  chart.setOption(data);
}
```

**Step 3: Service Workerでのプリキャッシュ最適化**

```javascript
// sw.js

const CORE_CACHE = 'core-v1';
const EXTENDED_CACHE = 'extended-v1';

// 必須ファイル（即座にキャッシュ）
const CORE_FILES = [
  '/index.html',
  '/styles/main.css',
  '/scripts/main.js',
  '/scripts/core/init.js'
];

// 拡張ファイル（バックグラウンドでキャッシュ）
const EXTENDED_FILES = [
  '/scripts/modes/fixed-mode.js',
  '/scripts/modes/weight-mode.js',
  '/scripts/modes/yield-stats-mode.js',
  '/scripts/modes/multi-pattern-mode.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      // コアファイルを即座にキャッシュ
      caches.open(CORE_CACHE).then(cache => cache.addAll(CORE_FILES)),

      // 拡張ファイルはバックグラウンドで
      caches.open(EXTENDED_CACHE).then(cache => cache.addAll(EXTENDED_FILES))
    ])
  );
});
```

**期待効果**:
- 初回ロード時間: 3秒 → 1秒未満
- 初回転送量: 500KB → 100KB
- Time to Interactive: 2秒短縮

---

### 5.2 データベースクエリの最適化

**現状**: 全履歴データを毎回取得（100件以上で遅延）

#### 実施計画

**Step 1: ページネーション実装**

```javascript
// scripts/db.js

/**
 * ページネーションで履歴を取得
 * @param {number} page - ページ番号（1始まり）
 * @param {number} perPage - 1ページあたりの件数
 * @returns {Promise<Object>} { items, total, hasMore }
 */
async getHistoryPaginated(page = 1, perPage = 20) {
  const tx = this.db.transaction([STORE_NAME], 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const index = store.index('timestamp');

  const allKeys = await index.getAllKeys();
  const total = allKeys.length;
  const start = (page - 1) * perPage;
  const end = start + perPage;

  const pageKeys = allKeys.slice(start, end);
  const items = await Promise.all(
    pageKeys.map(key => store.get(key))
  );

  return {
    items: items.filter(item => !item.deleted),
    total,
    hasMore: end < total,
    page,
    perPage
  };
}
```

**Step 2: 仮想スクロール実装**

```javascript
// scripts/ui/history-list.component.js

export class HistoryList extends Component {
  constructor(containerId) {
    super(containerId);
    this.state = {
      items: [],
      visibleRange: { start: 0, end: 20 },
      itemHeight: 80, // 各アイテムの高さ（px）
      totalHeight: 0
    };
  }

  render() {
    const { items, visibleRange, itemHeight, totalHeight } = this.state;
    const visibleItems = items.slice(visibleRange.start, visibleRange.end);

    return `
      <div class="history-list" style="height: ${totalHeight}px; position: relative;">
        <div class="spacer" style="height: ${visibleRange.start * itemHeight}px;"></div>
        ${visibleItems.map(item => this.renderItem(item)).join('')}
        <div class="spacer" style="height: ${(items.length - visibleRange.end) * itemHeight}px;"></div>
      </div>
    `;
  }

  afterRender() {
    // スクロールイベントで可視範囲を更新
    this.container.addEventListener('scroll', () => {
      const scrollTop = this.container.scrollTop;
      const start = Math.floor(scrollTop / this.state.itemHeight);
      const end = start + 20;

      this.setState({
        visibleRange: { start, end }
      });
    });
  }
}
```

**期待効果**:
- 履歴表示時間: 5秒 → 0.5秒（100件の場合）
- メモリ使用量: 50MB → 10MB

---

## 実施ガイドライン

### 原則

1. **段階的実施**: 一度に全てを変更しない
2. **テスト駆動**: 変更前後でテストを実行
3. **ドキュメント更新**: コード変更とドキュメントを同期
4. **レビュー必須**: 全ての変更をレビュー
5. **ロールバック可能**: 問題が起きたら即座に戻せる状態を維持

### 各Phase開始前のチェックリスト

- [ ] 前Phaseのタスクが完了している
- [ ] 全テストが通っている
- [ ] ドキュメントが更新されている
- [ ] ステークホルダーの承認を得ている
- [ ] ロールバックプランがある

### ブランチ戦略

```
main (本番)
  ↑
  develop (開発)
    ↑
    feature/phase1-security
    feature/phase2-architecture
    feature/phase3-quality
    feature/phase4-extensibility
```

各Phaseごとにフィーチャーブランチを作成し、完了後にdevelopにマージ。
developで十分テストした後、mainにマージして本番リリース。

### コミットメッセージ規約

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Type**:
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `test`: テスト追加
- `docs`: ドキュメント
- `style`: コードスタイル
- `perf`: パフォーマンス改善
- `chore`: ビルド・ツール設定

**例**:
```
refactor(state): Split AppState into multiple classes

- Create YieldStatsState class for yield statistics management
- Move 400 lines of code from state.js to yield-stats-state.js
- Update 12 files to use new state structure

Closes #123
```

---

## リスク管理

### リスク一覧

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| **既存機能の破壊** | 高 | 高 | 包括的なテスト、段階的リリース |
| **スケジュール遅延** | 中 | 中 | バッファを設定、優先順位の見直し |
| **リソース不足** | 中 | 高 | 外部協力者の検討、タスク分割 |
| **技術的負債の増加** | 低 | 高 | コードレビュー強化、技術選定の慎重化 |
| **パフォーマンス劣化** | 低 | 中 | ベンチマーク測定、プロファイリング |

### 緊急時の対応

**問題発生時**:
1. 即座に該当Phaseのロールバック
2. 根本原因の調査
3. 修正プランの策定
4. 再実施の判断

**ロールバック手順**:
```bash
# 直前のコミットに戻す
git revert HEAD

# 特定のPhaseを巻き戻す
git revert <commit-hash>

# 緊急パッチをリリース
git checkout -b hotfix/emergency-fix
# 修正
git push origin hotfix/emergency-fix
```

---

## 成功指標（KPI）

### Phase 1: セキュリティ

- [ ] Firebase APIキーがGit履歴から完全削除
- [ ] console.* の使用が0件（logger.js除く）
- [ ] npm audit で Critical/High の脆弱性が0件

### Phase 2: アーキテクチャ

- [ ] state.js が300行以下に削減
- [ ] 新規クラスのテストカバレッジが80%以上
- [ ] 循環依存が0件

### Phase 3: 品質

- [ ] テストカバレッジが70%以上
- [ ] 全テストの実行時間が10秒以内
- [ ] エラーハンドリングが統一（ErrorHandlerクラス使用率100%）

### Phase 4: 拡張性

- [ ] 新モード追加のコスト: 8ファイル修正 → 1ファイル追加のみ
- [ ] コンポーネントの再利用性: 3箇所以上で使用されるコンポーネントが5個以上
- [ ] 後方互換APIの使用が0件

### Phase 5: パフォーマンス

- [ ] 初回ロード時間が1秒未満（Lighthouse測定）
- [ ] Time to Interactive が2秒未満
- [ ] 履歴表示時間が1秒未満（100件の場合）

---

## まとめ

この改善計画は、6ヶ月かけてアプリケーションの設計品質を**36% → 85%**まで向上させることを目指します。

**重要な原則**:
1. セキュリティは即座に対応
2. アーキテクチャは計画的に改善
3. 品質は継続的に向上
4. 拡張性は長期的に確保

各Phaseを着実に進めることで、保守性・信頼性・拡張性の高いアプリケーションを実現できます。

---

**次のステップ**: Phase 1のセキュリティ対応から開始しましょう。
