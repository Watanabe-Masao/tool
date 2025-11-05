# 設計改善計画書 v2.0（統合版）

**プロジェクト名**: 歩留まり計算ツール
**作成日**: 2025-11-05
**最終更新**: 2025-11-05
**総合評価**: 54/150点（36%）→ 目標 127/150点（85%）

---

## 📋 目次

1. [エグゼクティブサマリー](#エグゼクティブサマリー)
2. [既存の改善実績（2025-11-05以前）](#既存の改善実績)
3. [Phase 0: 残存課題の即座完了（1-2時間）](#phase-0-残存課題の即座完了)
4. [Phase 1: セキュリティ対応（即座実施）](#phase-1-セキュリティ対応)
5. [Phase 2: アーキテクチャ改善（1-2ヶ月）](#phase-2-アーキテクチャ改善)
6. [Phase 3: 品質向上（2-3ヶ月）](#phase-3-品質向上)
7. [Phase 4: 拡張性確保（3-6ヶ月）](#phase-4-拡張性確保)
8. [Phase 5: パフォーマンス最適化（6ヶ月以降）](#phase-5-パフォーマンス最適化)
9. [実施ガイドライン](#実施ガイドライン)
10. [リスク管理](#リスク管理)
11. [成功指標（KPI）](#成功指標kpi)

---

## エグゼクティブサマリー

### 現状の評価

| カテゴリ | 重大度 | 問題数 | 影響範囲 | 状態 |
|---------|--------|--------|----------|------|
| **セキュリティ** | 🔴 Critical | 2 | 全体 | ⚠️ 80%完了 |
| **アーキテクチャ** | 🟠 High | 6 | 30ファイル | ⚠️ 一部完了 |
| **品質・テスト** | 🟠 High | 3 | 全体 | ❌ 未着手 |
| **保守性** | 🟡 Medium | 4 | 20ファイル | ⚠️ 改善中 |

### 重要な発見

✅ **2025-11-05以前に既に実施された改善**:
- 重複コード削減: 96行削減
- 後方互換コード削除: 21箇所統一
- タイミング依存改善: マジックナンバー削減
- 状態管理の一元化: **80%完了**（残り6箇所）

⚠️ **残存課題**:
- グローバル変数の完全削除（window.* が6箇所残存）
- Firebase APIキーの履歴からの削除
- console.* の削除（406箇所）

---

## 既存の改善実績

### 完了したリファクタリング（2025-11-05以前）

#### 1. 重複コード削減（96行削減）

**実施内容**:
- `scripts/event-handlers-setup.js` の重複コード96行を削減（55%削減）
- 新しいユーティリティモジュール `scripts/yield-stats-transition.js` を作成

**成果**:
- ✅ コード重複の解消
- ✅ 保守性の向上
- ✅ バグ修正が1箇所で済む

**コミット**: `f5eb506`

---

#### 2. 後方互換コード削除（21箇所統一）

**実施内容**:
- `scripts/yield-stats-display.js` から3つの重複変数を削除
- 21箇所の参照を統一

**成果**:
- ✅ 変数重複の解消
- ✅ コードの一貫性向上

**コミット**: `64d2f85`

---

#### 3. 状態管理の一元化（80%完了）

**実施内容**:
- `state.js` に `yieldStats` 構造を追加（87-505行）
- 新しいメソッド20個を実装
- 一部のファイルを新APIに移行

**現状**:
```javascript
// ✅ 実装済み
appState.yieldStats = {
  rawData: null,              // 生データ
  calculatedStats: {...},     // 計算結果
  ui: {...},                  // UI状態
  outliers: {...},            // 外れ値管理
  validation: {...},          // サンプルサイズ妥当性
  lastCalculated: null        // 最後の計算結果
};
```

**⚠️ 残存課題**: 旧グローバル変数が6箇所残っている
```bash
window.statsDataByType        → 6箇所（要削除）
window.yieldStatsState        → 6箇所（要削除）
window.lastCalculatedStats    → 6箇所（要削除）
```

---

### 改善の可視化

#### 状態管理の Before / After

**Before（分散・複雑）**:
```
┌─────────────────────────────────────────────────┐
│          グローバルスコープ (window)              │
├─────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌──────────────────┐      │
│  │  appState   │    │ window.          │      │
│  │ yieldStats  │◀──▶│ statsDataByType  │◀──┐  │
│  │   Data      │    │                  │   │  │
│  └─────────────┘    └──────────────────┘   │  │
│         ▲                                   │  │
│         │                                   │重複│
│         │          ┌──────────────────┐    │  │
│         │          │ window.          │    │  │
│         └──────────│ yieldStatsState  │◀───┤  │
│                    │                  │    │  │
│                    └──────────────────┘    │  │
│                            ▲               │  │
│                            │               │  │
│                    ┌───────────────────┐   │  │
│                    │ window.last       │───┘  │
│                    │ CalculatedStats   │      │
│                    └───────────────────┘      │
└─────────────────────────────────────────────────┘
```

**❌ 問題点**:
- 4つのグローバルオブジェクトが分散
- データの重複（yieldStatsData と statsDataByType）
- 同期の問題
- デバッグが困難

---

**After（一元化・シンプル）**:
```
┌─────────────────────────────────────────────────┐
│          グローバルスコープ (window)              │
├─────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐     │
│  │          appState                      │     │
│  │  ┌─────────────────────────────────┐  │     │
│  │  │ yieldStats (一元管理)            │  │     │
│  │  │                                 │  │     │
│  │  │ ├─ rawData                      │  │     │
│  │  │ ├─ calculatedStats              │  │     │
│  │  │ ├─ ui                           │  │     │
│  │  │ ├─ outliers                     │  │     │
│  │  │ ├─ validation                   │  │     │
│  │  │ └─ lastCalculated               │  │     │
│  │  └─────────────────────────────────┘  │     │
│  └───────────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

**✅ 改善点**:
- すべての状態がappStateに集約
- データ重複の解消
- 階層構造で見通しが良い
- メソッド経由でアクセス（カプセル化）

---

### コード例：Before / After

#### 例1: 統計データの保存

**Before（分散・複雑）**:
```javascript
// ❌ 4箇所に分散して保存
appState.setYieldStatsData(data);  // 生データ
window.statsDataByType = {          // 計算結果
  yieldRate: yieldRateStats,
  beforeWeight: beforeWeightStats,
  afterWeight: afterWeightStats
};
window.yieldStatsState.hasYieldRateData = true;     // フラグ
window.yieldStatsState.isCalculated = true;         // フラグ
window.lastCalculatedStats = yieldRateStats;        // キャッシュ
```

**After（一元化・シンプル）**:
```javascript
// ✅ メソッド経由で自動同期
appState.setYieldStatsRawData(data);  // 生データ + フラグ自動更新
appState.setCalculatedStats('yieldRate', yieldRateStats);
appState.setCalculatedStats('beforeWeight', beforeWeightStats);
appState.setCalculatedStats('afterWeight', afterWeightStats);
// isCalculated, lastCalculated は自動更新される ✨
```

#### 例2: 外れ値の除外

**Before（直接操作・冗長）**:
```javascript
// ❌ 直接操作、複数行
window.yieldStatsState.manuallyExcludedOutlierIndices.clear();
window.yieldStatsState.currentOutlierValues = [];
window.yieldStatsState.isOutlierExcluded = false;
```

**After（メソッド経由・簡潔）**:
```javascript
// ✅ メソッド1つで完結
appState.clearExcludedOutliers();
```

---

## Phase 0: 残存課題の即座完了

**期間**: 1-2時間
**優先度**: 🔴 Critical
**目的**: 既に80%完了している状態管理の移行を100%完了させる

### 0.1 グローバル変数の完全削除

**問題**: `window.*` グローバル変数が6箇所残存

#### 影響範囲

```
┌────────────────────────────────────────────┐
│ ファイル                        変更箇所   │
├────────────────────────────────────────────┤
│ scripts/yield-stats-display.js    4箇所   │
│ scripts/state.js                  2箇所   │
└────────────────────────────────────────────┘
合計: 6箇所
```

#### 実施手順

**Step 1: yield-stats-display.js の修正（30分）**

```javascript
// Before（4箇所を検索）
window.statsDataByType
window.yieldStatsState
window.lastCalculatedStats

// After（新APIに置き換え）
appState.getCalculatedStats(type)
appState.yieldStats.ui
appState.getLastCalculatedStats()
```

**Step 2: state.js の後方互換コードを削除（15分）**

```javascript
// Before（削除対象）
/**
 * @deprecated Use yieldStats.getRawData() instead
 */
getYieldStatsData() {
  console.warn('getYieldStatsData() is deprecated');
  return this.yieldStats.getRawData();
}

// After（完全削除）
// メソッドごと削除
```

**Step 3: 検証（15分）**

```bash
# グローバル変数が残っていないことを確認
grep -r "window\.statsDataByType\|window\.yieldStatsState\|window\.lastCalculatedStats" scripts/ --exclude-dir=node_modules

# ブラウザで動作確認
# 1. 歩留まり統計モードを開く
# 2. データを入力して計算
# 3. 外れ値除外機能をテスト
# 4. 履歴保存・読込をテスト
```

**検証チェックリスト**:
- [ ] grep で window.* が0件
- [ ] 歩留まり統計の計算が正常動作
- [ ] 外れ値除外が正常動作
- [ ] 履歴保存・読込が正常動作

**期待効果**:
- ✅ 状態管理の一元化が100%完了
- ✅ 技術的負債の解消
- ✅ デバッグの容易化

---

## Phase 1: セキュリティ対応

**期間**: 1日
**優先度**: 🔴 Critical

### 1.1 Firebase APIキーの保護 ✅ 完了（2025-11-05）

**実施済み**:
- ✅ `scripts/firebase-config.example.js` を作成（テンプレート）
- ✅ `.gitignore` に `firebase-config.js` を追加
- ✅ `firebase-config.js` にセキュリティ警告を追加

**残りのタスク**:

```bash
# 1. Git履歴からAPIキーを完全削除
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch scripts/firebase-config.js" \
  --prune-empty --tag-name-filter cat -- --all

# または BFG Repo-Cleaner を使用（推奨）
java -jar bfg.jar --delete-files firebase-config.js

# 2. 強制プッシュ（注意: チームに通知）
git push origin --force --all
git push origin --force --tags

# 3. Firebase APIキーをローテーション（強く推奨）
# - Firebaseコンソールで新しいウェブアプリを作成
# - 古いAPIキーを無効化
# - 新しいキーで firebase-config.js を更新
```

**重要**: この操作は破壊的なため、チーム全員に通知が必要です。

---

### 1.2 本番環境デバッグコードの削除

**問題**: console.log/warn/error が406回残存

#### 実施計画

**Step 1: ロギングフレームワークの作成（1時間）**

新規ファイル: `scripts/core/logger.js`

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
    this.level = this.getLogLevel();
  }

  getLogLevel() {
    // 本番環境判定
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

**Step 2: 段階的な置き換え（優先順位順）**

| ファイル | console.* 回数 | 優先度 | 時間 |
|---------|---------------|--------|------|
| scripts/db.js | 80回 | ★★★★★ | 1時間 |
| scripts/firebase-sync.js | 105回 | ★★★★★ | 1.5時間 |
| scripts/storage.js | 44回 | ★★★★☆ | 30分 |
| 残り19ファイル | 177回 | ★★★☆☆ | 2時間 |

**合計時間**: 5時間

**置き換え例**:
```javascript
// Before
console.log('✅ 保存完了 (ID:', result.id, ')');
console.error('Failed to save calculation:', error);

// After
import { logger } from './core/logger.js';
logger.info('保存完了', { id: result.id });
logger.error('計算データの保存に失敗', error);
```

**Step 3: ESLintルールの追加**

`.eslintrc.json`:
```json
{
  "rules": {
    "no-console": ["error", {
      "allow": []
    }]
  }
}
```

**検証**:
```bash
# 本番ビルドでconsole.*が残っていないことを確認
grep -r "console\." scripts/ --exclude="logger.js" --exclude-dir=node_modules
```

---

## Phase 2: アーキテクチャ改善

**期間**: 6-8週間
**優先度**: 🟠 High

### 2.1 状態管理の分割

**現状**: `state.js` が525行で肥大化

#### 現在の構造（問題あり）

```
state.js (525行)
├── AppState (全体管理)
├── CalculationSnapshot (計算結果)
├── ProductSimulationData (商品シミュレーション)
└── yieldStats (歩留まり統計 - 400行以上!)
```

#### 改善後の構造

```
states/
├── app-state.js (150行) - コア状態管理
├── calculation-state.js (100行) - 計算結果管理
├── yield-stats-state.js (250行) - 歩留まり統計専用
└── ui-state.js (50行) - UI状態フラグ
```

#### 実施手順

**Week 1: yield-stats-state.js の分離**

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
      // ... 他のUIフラグ
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

  // ... 他のメソッド20個
}
```

**Week 2: app-state.js のリファクタリング**

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

**Week 3-4: 影響範囲の修正**

以下の12ファイルで `appState` の使用箇所を修正:

| ファイル | 変更箇所 | 難易度 | 時間 |
|---------|---------|--------|------|
| scripts/yield-stats-display.js | 41箇所 | ★★★★★ | 2時間 |
| scripts/yield-stats-transition.js | 17箇所 | ★★★★☆ | 1時間 |
| scripts/mode-manager.js | 13箇所 | ★★★☆☆ | 1時間 |
| scripts/multi-pattern-stats-loader.js | 9箇所 | ★★★☆☆ | 45分 |
| scripts/yield-stats-table.js | 7箇所 | ★★☆☆☆ | 30分 |
| scripts/sample-size-validator.js | 6箇所 | ★★☆☆☆ | 30分 |
| scripts/event-handlers-setup.js | 3箇所 | ★☆☆☆☆ | 15分 |
| scripts/history-save-dialog.js | 3箇所 | ★☆☆☆☆ | 15分 |
| scripts/history-restore.js | 4箇所 | ★☆☆☆☆ | 20分 |
| scripts/history-ui.js | 1箇所 | ★☆☆☆☆ | 5分 |
| scripts/form-manager.js | 3箇所 | ★☆☆☆☆ | 15分 |
| scripts/reverse-simulation.js | 3箇所 | ★☆☆☆☆ | 15分 |

**合計**: 110箇所、約7時間

**修正例**:
```javascript
// Before
import { appState } from './state.js';
const data = appState.getYieldStatsRawData();

// After
import { appState } from './states/app-state.js';
const data = appState.yieldStats.getRawData();
```

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

#### 実施計画（Week 5-8）

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

**実施スケジュール**: Week 5-7（詳細は元の計画書を参照）

---

## Phase 3: 品質向上

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

**テンプレート**: 元の計画書の「Phase 3.1」を参照

---

### 3.2 統一エラーハンドリング

**問題**: try-catch 263回あるが、処理が不統一

#### 実施計画

**Step 1: ErrorHandler クラスの作成**

新規ファイル: `scripts/core/error-handler.js`

```javascript
/**
 * 統一エラーハンドラー
 */

import { logger } from './logger.js';
import { showError, showWarning } from './toast.js';
import { isRetryableError } from './errors.js';

export class ErrorHandler {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.notifyUser = options.notifyUser !== false;
  }

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
        logger.debug(`${operationName} 実行中 (試行 ${attempt + 1})`);
        const result = await operation();
        logger.debug(`${operationName} 成功`);
        return result;

      } catch (error) {
        lastError = error;
        attempt++;

        logger.error(`${operationName} 失敗 (試行 ${attempt})`, error);

        if (retryable && isRetryableError(error) && attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          logger.warn(`${delay}ms後に再試行します...`);
          await this.sleep(delay);
          continue;
        }

        break;
      }
    }

    return this.handleError(lastError, operationName, userMessage, onError);
  }

  handleError(error, operationName, userMessage, onError) {
    if (onError) {
      try {
        onError(error);
      } catch (e) {
        logger.error('カスタムエラーハンドラーで例外', e);
      }
    }

    if (this.notifyUser) {
      const message = userMessage || this.getDefaultUserMessage(error, operationName);

      if (error.retryable) {
        showWarning(message);
      } else {
        showError(message);
      }
    }

    throw error;
  }

  getDefaultUserMessage(error, operationName) {
    if (error.getUserMessage) {
      return error.getUserMessage();
    }

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

export const errorHandler = new ErrorHandler();
```

**使用例**:
```javascript
// Before
export async function saveCalculation(...) {
  try {
    validateCalculationData(...);
  } catch (error) {
    console.error('[エラー] バリデーションエラー:', error);
    throw error;
  }

  try {
    const result = await saveToCloud(data);
    console.log(`✅ 保存完了`);
    return result.id;
  } catch (error) {
    console.error('Failed to save:', error);
    throw mapFirebaseError(error);
  }
}

// After
export async function saveCalculation(...) {
  return errorHandler.execute(
    async () => {
      validateCalculationData(...);
      if (!isSignedIn()) throw new OfflineError('save');
      const result = await saveToCloud(data);
      logger.info('保存完了', { id: result.id });
      return result.id;
    },
    {
      operationName: 'データ保存',
      retryable: true,
      userMessage: 'データの保存に失敗しました'
    }
  );
}
```

**実施スケジュール**: Week 1-6（詳細は元の計画書を参照）

---

## Phase 4: 拡張性確保

**期間**: 12-24週間
**優先度**: 🟡 Medium

### 4.1 Strategy パターンでモード管理をリファクタリング

**問題**: 新しい計算モード追加時に8箇所以上の修正が必要

#### CalculationMode インターフェース

新規ファイル: `scripts/modes/calculation-mode.interface.js`

```javascript
/**
 * 計算モードの基底クラス
 */

export class CalculationMode {
  getName() { throw new Error('Must implement getName()'); }
  getDisplayName() { throw new Error('Must implement getDisplayName()'); }
  calculate(input) { throw new Error('Must implement calculate()'); }
  validate(input) { throw new Error('Must implement validate()'); }
  renderForm(container) { throw new Error('Must implement renderForm()'); }
  renderResult(result, container) { throw new Error('Must implement renderResult()'); }
  clearInput() { throw new Error('Must implement clearInput()'); }
  setupEvents(stateManager) { throw new Error('Must implement setupEvents()'); }
}
```

#### モードレジストリ

新規ファイル: `scripts/modes/mode-registry.js`

```javascript
/**
 * 計算モードのレジストリ
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

  registerDefaultModes() {
    this.register(new FixedMode());
    this.register(new WeightMode());
    this.register(new YieldStatsMode());
    this.register(new MultiPatternMode());
  }

  register(mode) {
    this.modes.set(mode.getName(), mode);
  }

  get(name) {
    const mode = this.modes.get(name);
    if (!mode) {
      throw new Error(`Unknown mode: ${name}`);
    }
    return mode;
  }

  getAll() {
    return Array.from(this.modes.values());
  }
}

export const modeRegistry = new ModeRegistry();
```

**新モード追加の手順（改善後）**:
1. 新しいモードクラスを作成（例: `scripts/modes/profit-analysis-mode.js`）
2. `CalculationMode` を継承して実装
3. `mode-registry.js` に1行追加:
   ```javascript
   this.register(new ProfitAnalysisMode());
   ```

**これだけ！** 他のファイルは修正不要。

**実施スケジュール**: Week 13-20（詳細は元の計画書を参照）

---

### 4.2 UIコンポーネント化

**問題**: 19ファイルで110回の直接DOM操作

**実施スケジュール**: Week 21-28（詳細は元の計画書を参照）

---

### 4.3 後方互換APIの廃止

**実施スケジュール**: Week 29-33（詳細は元の計画書を参照）

---

## Phase 5: パフォーマンス最適化

**期間**: 継続的改善
**優先度**: 🟢 Low
**目標**: ページロード時間 < 1秒

### 5.1 コード分割とLazy Loading

**現状**: 全JavaScriptが初回ロードで読み込まれる（約500KB）
**目標**: 初回ロード時は必須ファイルのみ（< 100KB）

### 5.2 データベースクエリの最適化

**現状**: 全履歴データを毎回取得（100件以上で遅延）

詳細は元の計画書を参照

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
    feature/phase0-remaining-tasks
    feature/phase1-security
    feature/phase2-architecture
    feature/phase3-quality
    feature/phase4-extensibility
```

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
- `security`: セキュリティ修正

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

### Phase 0: 残存課題完了

- [ ] window.* グローバル変数が0件
- [ ] 状態管理の一元化が100%完了
- [ ] 後方互換コードが完全削除

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

### 改善の全体像

```
現状（36%）→ Phase 0完了（45%）→ Phase 1完了（60%）→ Phase 2完了（70%）→ Phase 3完了（80%）→ Phase 4完了（85%）
```

### 重要なポイント

1. **Phase 0は最優先**: 既に80%完了している改善を100%にする（1-2時間）
2. **セキュリティは即座に**: APIキーの履歴削除とログ削除（1日）
3. **段階的実施**: 一度に全てを変更せず、ファイル単位で進める
4. **テスト重視**: 各変更後に必ずテストを実行
5. **ドキュメント整備**: 既存の優れたドキュメント（STATE_FLOW_DIAGRAM.md等）を活用

### 優先順位

1. **今すぐ**: Phase 0（1-2時間）
2. **今日中**: Phase 1セキュリティ（1日）
3. **今週中**: Phase 2の準備とテスト整備
4. **今月中**: Phase 2完了
5. **3ヶ月以内**: Phase 3完了
6. **6ヶ月以内**: Phase 4完了

---

**次のステップ**: Phase 0の残存課題（グローバル変数の完全削除）から開始することを強く推奨します。
