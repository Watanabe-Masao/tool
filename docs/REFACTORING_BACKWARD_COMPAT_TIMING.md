# リファクタリング: 後方互換コード削除とタイミング依存改善

## 📅 実施日
2025-11-05

## 🎯 目的
1. 後方互換コードを削除してコードをクリーンにする
2. タイミング依存のsetTimeoutをPromiseベースのポーリングに置き換える

---

## オプション3: 後方互換コードの削除

### 問題点
`yield-stats-display.js`に3つのグローバル変数が重複して存在:
```javascript
// 古い変数（後方互換用）
let currentStatsType = '';
let manuallyExcludedOutlierIndices = new Set();
let currentOutlierValues = [];

// 新しい状態管理
window.yieldStatsState.currentDisplayType
window.yieldStatsState.manuallyExcludedOutlierIndices
window.yieldStatsState.currentOutlierValues
```

**影響**:
- コードの重複
- 保守性の低下
- 混乱を招く

### 実施した変更

#### 1. 変数宣言の削除
**ファイル**: `scripts/yield-stats-display.js`

**Before**:
```javascript
// 外れ値の状態管理（互換性のため残す）
let currentStatsType = '';
let manuallyExcludedOutlierIndices = new Set();
let currentOutlierValues = [];
```

**After**:
削除（完全に削除）

#### 2. 初期化コードの削除
**Before**:
```javascript
// 後方互換性のため、グローバル変数も残す（徐々に置き換え）
manuallyExcludedOutlierIndices = window.yieldStatsState.manuallyExcludedOutlierIndices;
currentOutlierValues = window.yieldStatsState.currentOutlierValues;
currentStatsType = window.yieldStatsState.currentDisplayType;
```

**After**:
削除

#### 3. すべての参照を置き換え

**置き換えた箇所** (21箇所):

| 箇所 | Before | After |
|------|--------|-------|
| Line 59 | `currentStatsType` | `window.yieldStatsState.currentDisplayType` |
| Line 137-141 | `manuallyExcludedOutlierIndices` | `window.yieldStatsState.manuallyExcludedOutlierIndices` |
| Line 137-141 | `currentOutlierValues` | `window.yieldStatsState.currentOutlierValues` |
| Line 368-373 | (同上) | (同上) |
| Line 609-610 | (同上) | (同上) |
| Line 617 | (同上) | (同上) |
| Line 621-626 | (同上) | (同上) |
| Line 663 | (同上) | (同上) |
| Line 678 | (同上) | (同上) |
| Line 707-713 | (同上) | (同上) |
| Line 730 | (同上) | (同上) |
| Line 741 | (同上) | (同上) |

### 成果
- ✅ **3つの重複変数を削除**
- ✅ **21箇所の参照を統一**
- ✅ **コードが一貫性を持つように改善**

---

## オプション2: タイミング依存コードの改善

### 問題点

#### マジックナンバー
```javascript
// 問題: なぜ100ms? なぜ400ms?
setTimeout(() => {
  applySessionState(sessionData);
}, 100);  // ❌ マジックナンバー

const delay = isFromHistory ? 400 : 100;  // ❌ マジックナンバー
setTimeout(() => {
  loadAllStatsToMultiPattern(true);
}, delay);
```

**影響**:
- レースコンディションのリスク
- 環境依存のバグ
- 保守性の低下
- 根拠が不明

### 実施した変更

#### 1. タイミング定数の追加
**ファイル**: `scripts/constants.js`

```javascript
export const TIME = {
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000,
  DEBOUNCE_DELAY: 300,

  // ✨ 新規追加
  UI_TRANSITION_DELAY: 100,        // UI遷移後の待機時間
  HISTORY_LOAD_DELAY: 400,         // 履歴読み込み後の統計計算待機時間
  SESSION_RESTORE_DELAY: 100,      // セッション復元時の待機時間

  // ポーリング設定
  STATS_POLL_INTERVAL: 50,         // 統計データポーリング間隔
  STATS_POLL_MAX_WAIT: 1000        // 統計データ最大待機時間（1秒）
};
```

#### 2. Promiseベースのデータ待機関数
**ファイル**: `scripts/yield-stats-transition.js`

**新規関数**: `waitForStatsDataReady(isFromHistory)`

```javascript
/**
 * 統計データの準備完了を待つ（Promiseベース）
 *
 * この関数は、履歴読み込み後に統計計算が完了するまでポーリングで待機します。
 * setTimeoutのマジックナンバーを置き換えるために作成されました。
 */
export async function waitForStatsDataReady(isFromHistory) {
  // 履歴からの読み込みでない場合は、UI遷移のみ待つ
  if (!isFromHistory) {
    return new Promise(resolve => {
      setTimeout(resolve, TIME.UI_TRANSITION_DELAY);
    });
  }

  // 履歴から読み込まれた場合は、統計データの準備完了を待つ
  const startTime = Date.now();

  while (Date.now() - startTime < TIME.STATS_POLL_MAX_WAIT) {
    // 統計データが準備できているかチェック
    const yieldRateStats = window.statsDataByType?.yieldRate;
    if (yieldRateStats && yieldRateStats.count >= 2) {
      // データが準備できた
      return;
    }

    // 少し待ってから再チェック（ポーリング）
    await new Promise(resolve => setTimeout(resolve, TIME.STATS_POLL_INTERVAL));
  }

  // タイムアウト：最大待機時間を超えた
  console.warn('[waitForStatsDataReady] タイムアウト: 統計データの準備が完了しませんでした');
}
```

**特徴**:
- ✅ **Promiseベース**: 非同期処理が明示的
- ✅ **ポーリング**: データが実際に準備できるまで待つ
- ✅ **タイムアウト付き**: 無限ループを防ぐ
- ✅ **エラーハンドリング**: タイムアウト時に警告を表示

#### 3. handleYieldStatsTransition関数の更新
**Before**:
```javascript
if (useStats) {
  // ❌ マジックナンバー
  const delay = isFromHistory ? 400 : 100;
  setTimeout(() => {
    loadAllStatsToMultiPattern(true);
  }, delay);
}
```

**After**:
```javascript
if (useStats) {
  // ✅ Promiseベースのポーリング
  waitForStatsDataReady(isFromHistory)
    .then(() => {
      loadAllStatsToMultiPattern(true);
    })
    .catch(error => {
      console.error('[handleYieldStatsTransition] データ待機エラー:', error);
      // エラーが発生しても読み込みは試行する
      loadAllStatsToMultiPattern(true);
    });
}
```

#### 4. その他のマジックナンバーを置き換え

**ファイル**: `scripts/event-handlers-setup.js`
```javascript
// Before: setTimeout(() => { applySessionState(sessionData); }, 100);
// After:
setTimeout(() => {
  applySessionState(sessionData);
}, TIME.SESSION_RESTORE_DELAY);
```

**ファイル**: `scripts/multi-pattern-stats-loader.js`
```javascript
// Before: setTimeout(() => { firstInput.focus(); }, 100);
// After:
setTimeout(() => {
  firstInput.focus();
  firstInput.select();
}, TIME.UI_TRANSITION_DELAY);
```

### 成果

#### マジックナンバーの削減
| 場所 | Before | After |
|------|--------|-------|
| event-handlers-setup.js (line 228) | `100` | `TIME.SESSION_RESTORE_DELAY` |
| yield-stats-transition.js (line 193) | `400` or `100` | `waitForStatsDataReady()` |
| multi-pattern-stats-loader.js (line 235) | `100` | `TIME.UI_TRANSITION_DELAY` |

#### 改善点
- ✅ **マジックナンバー削除**: 3箇所のマジックナンバーを定数化
- ✅ **Promiseベース**: 非同期処理が明示的で追跡しやすい
- ✅ **ポーリング機構**: データの実際の準備状況をチェック
- ✅ **タイムアウト保護**: 無限待機を防止
- ✅ **エラーハンドリング**: タイムアウト時に適切に処理
- ✅ **保守性向上**: タイミング調整が一箇所で可能

---

## 📊 全体の成果

### コード品質向上

| カテゴリ | 改善内容 | 影響範囲 |
|---------|---------|---------|
| **後方互換コード削除** | 3つの重複変数削除、21箇所を統一 | yield-stats-display.js |
| **タイミング定数化** | 6つのタイミング定数を追加 | constants.js |
| **Promiseベース待機** | 新しい`waitForStatsDataReady()`関数 | yield-stats-transition.js |
| **マジックナンバー削減** | 3箇所のマジックナンバーを定数化 | 3ファイル |

### ファイル変更サマリー

| ファイル | 変更内容 | 行数変化 |
|---------|---------|---------|
| `scripts/yield-stats-display.js` | 後方互換コード削除、21箇所を統一 | -15行 |
| `scripts/constants.js` | タイミング定数追加 | +9行 |
| `scripts/yield-stats-transition.js` | Promise待機関数追加、タイミング改善 | +40行 |
| `scripts/event-handlers-setup.js` | タイミング定数使用 | 変更なし |
| `scripts/multi-pattern-stats-loader.js` | タイミング定数使用 | 変更なし |

### リスク軽減

#### レースコンディション対策
- ✅ **固定遅延 → ポーリング**: データの実際の準備を確認
- ✅ **タイムアウト保護**: 最大1秒で中断
- ✅ **エラーハンドリング**: タイムアウト時も処理継続

#### 環境依存バグ対策
- ✅ **定数化**: 一箇所で調整可能
- ✅ **ポーリング**: 環境速度に依存しない
- ✅ **柔軟な待機**: データ準備が遅い環境でも対応

---

## 🎯 将来の改善案

### さらなるPromise化（オプション）
現在もいくつかのsetTimeoutが残っています：
- UI遷移待機（`TIME.UI_TRANSITION_DELAY`）
- フォーカス待機（`focusFirstPatternInput`）

これらもrequestAnimationFrameやMutationObserverに置き換え可能です。

### イベント駆動アーキテクチャ（大規模変更）
統計計算完了時にイベントを発火し、それを待機する方式に変更することで、ポーリングも不要にできます。

---

## ✅ チェックリスト

- [x] 後方互換変数の削除
- [x] すべての参照を統一（21箇所）
- [x] タイミング定数の追加
- [x] Promiseベース待機関数の実装
- [x] マジックナンバーの置き換え
- [x] エラーハンドリングの追加
- [ ] ブラウザでの動作確認
- [ ] Git コミット & プッシュ

---

## 🔗 関連ファイル

### 変更されたファイル
- `scripts/yield-stats-display.js` (後方互換コード削除)
- `scripts/constants.js` (タイミング定数追加)
- `scripts/yield-stats-transition.js` (Promise待機関数)
- `scripts/event-handlers-setup.js` (タイミング定数使用)
- `scripts/multi-pattern-stats-loader.js` (タイミング定数使用)

### 追加されたファイル
- `docs/REFACTORING_BACKWARD_COMPAT_TIMING.md` (このドキュメント)
