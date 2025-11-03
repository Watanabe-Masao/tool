# Phase 1統合手順書

**作成日**: 2025-10-30
**対象**: main.jsへのmode-manager.jsとform-manager.jsの統合

---

## ✅ 完了した作業

### 作成されたモジュール

1. **mode-manager.js** (443行)
   - モード切り替えロジック
   - 入力値チェック
   - フィールドクリア機能

2. **form-manager.js** (454行)
   - ステップ管理
   - フォーム処理
   - 商品化シミュレーション呼び出し

---

## 🎯 次のステップ: main.jsへの統合

### Step 1: main.jsにimport文を追加

**場所**: main.jsの冒頭（既存のimport文の後）

```javascript
// main.jsの既存import文の後に追加
import {
  hasInputValues,
  handleModeSwitch,
  switchMode,
  clearFixedInputs,
  clearWeightInputs,
  clearYieldStatsInputs,
  switchYieldMethodFixed,
  switchYieldMethodWeight
} from './mode-manager.js';

import {
  resetSteps,
  handleStep1,
  handleStep2,
  handleStep3,
  handleDirectStep1,
  handleDirectStep2,
  handleDirectStep3,
  resetWeightSteps,
  handleWeightStep1,
  handleWeightStep2,
  handleWeightStep3,
  handleWeightDirectStep1,
  handleWeightDirectStep2,
  handleWeightDirectStep3,
  handleProductCalculation
} from './form-manager.js';
```

### Step 2: main.jsから削除する関数

**削除対象**（行番号は現在のmain.jsを基準）:

1. **モード管理関連**（mode-manager.jsに移動済み）:
   - `function hasInputValues()` (32行目~)
   - `function handleModeSwitch(newMode)` (157行目~)
   - `function switchMode(newMode)` (191行目~)
   - `function switchYieldMethod()` (369行目~)
   - `function switchWeightYieldMethod()` (405行目~)

2. **フォーム管理関連**（form-manager.jsに移動済み）:
   - `function resetSteps()` (445行目~)
   - `function handleStep1()` (474行目~)
   - `function handleStep2()` (508行目~)
   - `function handleStep3()` (536行目~)
   - `function handleDirectStep1()` (563行目~)
   - `function handleDirectStep2()` (586行目~)
   - `function handleDirectStep3()` (624行目~)
   - `function resetWeightSteps()` (651行目~)
   - `function handleWeightStep1()` (680行目~)
   - `function handleWeightStep2()` (722行目~)
   - `function handleWeightStep3()` (749行目~)
   - `function handleWeightDirectStep1()` (777行目~)
   - `function handleWeightDirectStep2()` (819行目~)
   - `function handleWeightDirectStep3()` (844行目~)
   - `function handleProductCalculation()` (871行目~)

### Step 3: mode-manager.jsの関数呼び出しを更新

**main.js内で変更が必要な箇所**:

#### 3-1. switchMode()の呼び出し

**現状**:
```javascript
switchMode(newMode);
```

**変更後**:
```javascript
switchMode(newMode, {
  resetSteps,
  resetWeightSteps,
  resetYieldStatsEntries,  // main.jsに残る関数
  addYieldStatsRow,        // main.jsに残る関数
  updateLoadStatsButtons   // main.jsに残る関数
});
```

**対象箇所**（検索キーワード: `switchMode(`）:
- handleModeSwitch()内の呼び出し
- 履歴読み込み時の呼び出し

#### 3-2. switchYieldMethod()の呼び出し

**現状**:
```javascript
switchYieldMethod();
```

**変更後**:
```javascript
switchYieldMethodFixed(resetSteps, updateReverseSimulationLabels);
```

**対象箇所**:
- イベントリスナー内の呼び出し

#### 3-3. switchWeightYieldMethod()の呼び出し

**現状**:
```javascript
switchWeightYieldMethod();
```

**変更後**:
```javascript
switchYieldMethodWeight(resetWeightSteps, updateReverseSimulationLabels);
```

**対象箇所**:
- イベントリスナー内の呼び出し

---

## 📝 詳細な手順

### 手順 1: バックアップ作成

```bash
cp scripts/main.js scripts/main.js.backup
```

### 手順 2: import文の追加

1. main.jsの先頭部分（既存のimport文の最後）を開く
2. 上記のimport文を追加
3. 保存

### 手順 3: 重複関数の削除

#### オプション A: 手動削除（推奨・安全）

1. main.jsで `function hasInputValues()` を検索
2. 関数全体を削除（コメント含む）
3. 同様に他の関数も削除
4. 各削除後に保存

#### オプション B: sed/awk利用（リスク高）

```bash
# 注意: 本番実行前に必ずテストすること
# 行番号ベースで削除する例（実際の行番号は確認が必要）
```

### 手順 4: 関数呼び出しの更新

#### 4-1. switchMode()の更新

**検索**: `switchMode(`

**main.js内の該当箇所を特定**:
```bash
grep -n "switchMode(" scripts/main.js
```

**各箇所で**:
```javascript
// 変更前
switchMode(newMode);

// 変更後
switchMode(newMode, {
  resetSteps,
  resetWeightSteps,
  resetYieldStatsEntries,
  addYieldStatsRow,
  updateLoadStatsButtons
});
```

#### 4-2. switchYieldMethodFixed()の更新

**検索**: イベントリスナー内の歩留まり率切り替え

```javascript
// 定額モードの歩留まり率入力方法切り替え
qs(`input[name="${RADIO_NAMES.YIELD_METHOD_FIXED}"]`).addEventListener('change', () => {
  // 変更前: switchYieldMethod();
  // 変更後:
  switchYieldMethodFixed(resetSteps, updateReverseSimulationLabels);
});
```

#### 4-3. switchYieldMethodWeight()の更新

```javascript
// 計量モードの歩留まり率入力方法切り替え
qs(`input[name="${RADIO_NAMES.YIELD_METHOD_WEIGHT}"]`).addEventListener('change', () => {
  // 変更前: switchWeightYieldMethod();
  // 変更後:
  switchYieldMethodWeight(resetWeightSteps, updateReverseSimulationLabels);
});
```

### 手順 5: テスト実行

```bash
# 既存のテストスイート実行
node test-calculations.js
node test-bug-fixes.js
node test-statistics.js

# ブラウザでindex.htmlを開き、手動テスト
# 1. 定額モードの計算（重量から計算）
# 2. 定額モードの計算（歩留まり率直接入力）
# 3. 計量モードの計算（重量から計算）
# 4. 計量モードの計算（歩留まり率直接入力）
# 5. モード切り替え
# 6. 履歴の保存・読み込み
```

### 手順 6: エラー確認

**ブラウザのデベロッパーコンソールで確認**:
```
- ReferenceError: xxx is not defined
- TypeError: xxx is not a function
- Import/Export エラー
```

**よくあるエラーと対処法**:

1. **ReferenceError: resetSteps is not defined**
   - → import文を確認
   - → export文を確認（form-manager.js）

2. **TypeError: switchMode is not a function**
   - → import文を確認
   - → export文を確認（mode-manager.js）

3. **関数が見つからない**
   - → main.jsから削除しすぎていないか確認
   - → 削除すべきでない関数を削除していないか確認

---

## 🔍 削除してはいけない関数（main.jsに残す）

以下の関数は**main.jsに残す必要があります**:

### 歩留まり統計関連（約1,500行）
- `resetYieldStatsEntries()`
- `addYieldStatsRow()`
- `compactYieldStatsRows()`
- `restoreYieldStatsTable()`
- `updateYieldStatsStatistics()`
- `calculateStatistics()`
- `displayStatistics()`
- `detectOutliers()`
- その他統計関連の全関数

### 逆算シミュレーション関連（約500行）
- `resetReverseSimulation()`
- `toggleReverseSimulation()`
- `getReverseSimulationInputs()`
- `updateReverseSimulationLabels()`
- `handleReverseCalculation()`
- `applyReverseSimulationResult()`

### 値引きシミュレーション関連
- `handleDiscountUpdate()`

### イベントリスナー設定（DOMContentLoaded内の全コード）
- モード切り替えボタンのイベント
- 入力フィールドのchangeイベント
- 保存・履歴ボタンのイベント
- その他UIイベント

### 初期化処理
- Service Worker登録
- セッション復元
- 履歴UI初期化
- 複数パターンUI初期化

---

## 📊 期待される効果

### Before (現状)
```
main.js: 5,621行
```

### After (Phase 1完了後)
```
main.js: 約4,700行 (920行削減)
mode-manager.js: 443行
form-manager.js: 454行
─────────────────────────
合計: 5,597行 (削減量: 24行)
```

**注**: 合計行数は若干減少します（重複するimport文やコメントの削除により）

### 主な改善点
1. **モジュール分離**: 単一責任原則に近づく
2. **可読性向上**: 各モジュールが明確な責務を持つ
3. **テスト容易性**: 個別にテスト可能
4. **保守性向上**: 変更の影響範囲が明確

---

## ⚠️ 注意事項

### 1. グローバル変数への依存

**main.js内のグローバル変数**:
```javascript
let yieldStatsEntryCounter = 0;
window.yieldStatsState = { ... };
window.statsDataByType = { ... };
```

これらは**現時点では変更しません**（Phase 2以降で対応）

### 2. 関数の相互依存

- `handleProductCalculation()`は`handleStep3()`等から呼び出される
- `updateReverseSimulationLabels()`はmode-manager.jsから参照される
- これらの依存関係を維持する必要がある

### 3. テストの重要性

- **必ずテストを実行**してから次のPhaseに進む
- 一部の機能が動作しない場合は、ロールバックして原因を特定

---

## 🚀 Phase 2以降の予定

### Phase 2: yield-stats-manager.js作成（2日）
- 歩留まり統計関連の全機能を分離
- グローバル変数をモジュール内変数に変更
- 約1,500行をmain.jsから削減

### Phase 3: calculation-controller.js作成（1日）
- 逆算シミュレーション
- 値引きシミュレーション
- 約400行をmain.jsから削減

### Phase 4: event-handlers.js作成（2日）
- DOMContentLoaded内の全イベントリスナー
- 約800行をmain.jsから削減

### Phase 5: app-initializer.js作成（1日）
- アプリ初期化処理
- Service Worker登録
- 約300行をmain.jsから削減

### Phase 6: main.jsの最終縮小（1日）
- オーケストレーターのみに削減
- 最終的に400行未満を目指す

---

## 📝 チェックリスト

統合作業前に確認：

- [ ] バックアップ作成完了
- [ ] import文を正しく追加
- [ ] 重複関数を削除
- [ ] 関数呼び出しを更新（switchMode, switchYieldMethodFixed, switchYieldMethodWeight）
- [ ] テスト実行（test-calculations.js）
- [ ] テスト実行（test-bug-fixes.js）
- [ ] テスト実行（test-statistics.js）
- [ ] ブラウザで手動テスト
- [ ] デベロッパーコンソールでエラーチェック
- [ ] すべての計算モードで動作確認
- [ ] 履歴機能の動作確認
- [ ] セッション復元の動作確認

すべてチェック完了後、コミット＆プッシュ。

---

**作成者**: Claude Code
**最終更新**: 2025-10-30
