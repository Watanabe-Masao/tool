# 歩留まり統計遷移のリファクタリング

## 📅 実施日
2025-11-05

## 🎯 目的
歩留まり統計から複数パターン分析への遷移処理において、約160行の重複コードを削減し、保守性を向上させる。

## 📊 リファクタリング前の問題点

### 1. 大規模なコード重複
**場所**: `scripts/event-handlers-setup.js`
- **Lines 295-385** (multiPatternBtn): 90行
- **Lines 730-813** (goToMultiPatternBtn): 83行
- **重複内容**: 約80行が完全に重複

```javascript
// 重複していたコード例
if (currentMode === MODE.YIELD_STATS) {
  const yieldRateStats = window.statsDataByType?.yieldRate;
  const hasValidStats = yieldRateStats && yieldRateStats.count >= 2;
  // ... 80行以上の重複コード
}
```

### 2. 分散した状態管理
- `appState`: 4つのプロパティ
- `window.statsDataByType`: 統計データ
- `window.lastCalculatedStats`: 最後の統計
- `window.yieldStatsState`: 11+ プロパティ

### 3. 複雑なデータクリア処理
「いいえ」を選択した際に37行、8つの異なる操作が必要

### 4. 脆弱な更新シーケンス
`updateLoadStatsButtons()` を適切なタイミングで呼び出さないとバグが発生

## ✨ 実施したリファクタリング

### 1. 新しいユーティリティモジュールの作成

**ファイル**: `scripts/yield-stats-transition.js`

#### 抽出された関数:

#### a) `checkStatsDataExists()`
統計データの存在を確認する関数。

**戻り値**:
```javascript
{
  hasValidStats: boolean,        // window.statsDataByTypeに有効な統計があるか
  isFromHistory: boolean,         // 履歴から読み込まれたか
  hasYieldStatsData: boolean,     // appStateにデータがあるか
  hasAnyStats: boolean            // いずれかのソースに統計データがあるか
}
```

**責務**:
- `window.statsDataByType` からの統計データ確認
- 履歴から読み込まれたデータの確認
- 複数のデータソースを統合して判定

#### b) `clearAllYieldStatsData(yieldStatsCallbacks)`
歩留まり統計の全データをクリアする関数。

**実行内容**:
1. `appState` のデータクリア
2. `window` グローバル変数のクリア
3. `yieldStatsState` の完全リセット (11プロパティ)
4. DOM要素の非表示化
5. `updateLoadStatsButtons()` の呼び出し

**パラメータ**:
- `yieldStatsCallbacks`: 歩留まり統計のコールバック関数

**効果**:
- 37行のデータクリア処理を1行の関数呼び出しに削減
- データクリアの漏れを防止
- 保守性の向上

#### c) `handleYieldStatsTransition(targetMode, modeSwitchCallbacks, loadAllStatsToMultiPattern, yieldStatsCallbacks, options)`
歩留まり統計から複数パターン分析への遷移処理を統合した関数。

**パラメータ**:
- `targetMode`: 遷移先のモード (`MODE.MULTI_PATTERN`)
- `modeSwitchCallbacks`: モード切替に必要なコールバック
- `loadAllStatsToMultiPattern`: 統計値読み込み関数
- `yieldStatsCallbacks`: 歩留まり統計のコールバック
- `options.beforeTransition`: 遷移前に実行する処理 (オプション)

**処理フロー**:
1. 現在のモードが歩留まり統計でない場合 → 通常遷移 (false を返す)
2. 統計データがない場合 → 通常遷移 (false を返す)
3. 統計データがある場合 → 確認ダイアログ表示
   - 「はい」: 統計値を取り込む
   - 「いいえ」: データをクリアして遷移
4. true を返す (確認ダイアログを表示したことを示す)

**戻り値**:
- `true`: 確認ダイアログを表示した
- `false`: 通常遷移を行うべき

### 2. event-handlers-setup.js のリファクタリング

#### Before (multiPatternBtn):
```javascript
// 90行のコード
if (multiPatternBtn) {
  multiPatternBtn.addEventListener('click', () => {
    const currentMode = appState.getMode();
    const multiPatternProductName = qs('#multiPatternProductName');

    // ... 商品名処理 (10行)

    // 歩留まり統計モードから遷移する場合、統計データがあれば確認メッセージを表示
    if (currentMode === MODE.YIELD_STATS) {
      // ... 統計データチェック (15行)

      if (hasValidStats || (isFromHistory && hasYieldStatsData)) {
        const useStats = confirm('...');

        handleModeSwitch(MODE.MULTI_PATTERN, {...});

        if (useStats) {
          // ... 統計値読み込み (7行)
        } else {
          // ... データクリア (37行)
        }

        return;
      }
    }

    // 通常の遷移処理
    handleModeSwitch(MODE.MULTI_PATTERN, {...});
  });
}
```

#### After (multiPatternBtn):
```javascript
// 40行のコード (50行削減!)
if (multiPatternBtn) {
  multiPatternBtn.addEventListener('click', () => {
    const currentMode = appState.getMode();
    const multiPatternProductName = qs('#multiPatternProductName');

    // 商品名フィールドの処理
    if (multiPatternProductName && currentMode !== MODE.YIELD_STATS) {
      multiPatternProductName.value = '';
      multiPatternProductName.removeAttribute('readonly');
      multiPatternProductName.style.backgroundColor = '';
      multiPatternProductName.style.cursor = '';
    }

    // 歩留まり統計からの遷移処理（新しいユーティリティ関数を使用）
    const modeSwitchCallbacks = {
      handleModeSwitch,
      resetSteps,
      resetWeightSteps,
      resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
      updateLoadStatsButtons,
      displayCurrentStatistics
    };

    const handled = handleYieldStatsTransition(
      MODE.MULTI_PATTERN,
      modeSwitchCallbacks,
      loadAllStatsToMultiPattern,
      yieldStatsCallbacks
    );

    // 確認ダイアログが表示されなかった場合は通常の遷移処理
    if (!handled) {
      handleModeSwitch(MODE.MULTI_PATTERN, modeSwitchCallbacks);
    }
  });
}
```

#### Before (goToMultiPatternBtn):
```javascript
// 83行のコード
qs('#goToMultiPatternBtn')?.addEventListener('click', () => {
  // ... 統計データチェック (15行)

  let useStats = false;
  if (hasValidStats || (isFromHistory && hasYieldStatsData)) {
    useStats = confirm('...');
  }

  // 商品名を引き継ぐ (8行)
  const yieldStatsProductName = qs('#yieldStatsProductName')?.value || '';
  // ...

  handleModeSwitch(MODE.MULTI_PATTERN);

  if (useStats) {
    // ... 統計値読み込み (7行)
  } else {
    // ... データクリア (37行)
  }
});
```

#### After (goToMultiPatternBtn):
```javascript
// 37行のコード (46行削減!)
qs('#goToMultiPatternBtn')?.addEventListener('click', () => {
  // 歩留まり統計からの遷移処理（新しいユーティリティ関数を使用）
  const modeSwitchCallbacks = {
    handleModeSwitch,
    resetSteps,
    resetWeightSteps,
    resetYieldStatsEntries: () => resetYieldStatsEntries(() => addYieldStatsRow(yieldStatsCallbacks)),
    updateLoadStatsButtons,
    displayCurrentStatistics
  };

  // 遷移前の処理: 歩留まり統計の商品名を複数パターン分析に引き継ぐ
  const beforeTransition = () => {
    const yieldStatsProductName = qs('#yieldStatsProductName')?.value || '';
    const multiPatternProductName = qs('#multiPatternProductName');
    if (multiPatternProductName && yieldStatsProductName) {
      multiPatternProductName.value = yieldStatsProductName;
      multiPatternProductName.setAttribute('readonly', 'readonly');
      multiPatternProductName.style.backgroundColor = '#f0f0f0';
      multiPatternProductName.style.cursor = 'not-allowed';
    }
  };

  const handled = handleYieldStatsTransition(
    MODE.MULTI_PATTERN,
    modeSwitchCallbacks,
    loadAllStatsToMultiPattern,
    yieldStatsCallbacks,
    { beforeTransition }
  );

  // 確認ダイアログが表示されなかった場合は通常の遷移処理
  if (!handled) {
    beforeTransition(); // 商品名の引き継ぎは常に実行
    handleModeSwitch(MODE.MULTI_PATTERN, modeSwitchCallbacks);
  }
});
```

## 📈 成果

### コード削減
| 項目 | Before | After | 削減量 |
|------|--------|-------|--------|
| multiPatternBtn ハンドラー | 90行 | 40行 | **50行 (55%)** |
| goToMultiPatternBtn ハンドラー | 83行 | 37行 | **46行 (55%)** |
| **合計** | **173行** | **77行** | **96行 (55%)** |

### 新規モジュール
| ファイル | 行数 | 説明 |
|----------|------|------|
| `scripts/yield-stats-transition.js` | 154行 | 3つのユーティリティ関数 |
| `__tests__/yield-stats-transition.test.js` | 448行 | テストコード (16テストケース) |

### ネット効果
- **event-handlers-setup.js**: 96行削減
- **新規コード**: 154行追加 (ユーティリティ)
- **テストコード**: 448行追加
- **実質**: 58行増加だが、**重複を96行削減**し、保守性が大幅に向上

## 🎯 品質向上

### 1. 保守性の向上
- ✅ 重複コードの削除: 96行の完全重複を削除
- ✅ 単一責任の原則: 各関数が明確な責務を持つ
- ✅ 関数の再利用性: 同じロジックを複数箇所で再利用可能

### 2. テスタビリティの向上
- ✅ ユニットテスト可能: 各関数を独立してテスト可能
- ✅ モック可能: 依存関係を分離しやすい
- ✅ テストカバレッジ: 16のテストケースを作成

### 3. バグ修正の容易さ
- ✅ 1箇所の修正で2箇所に反映: 重複がないため、修正漏れなし
- ✅ データクリアの一元化: `clearAllYieldStatsData()` で全てのクリア処理を管理
- ✅ 更新順序の保証: `updateLoadStatsButtons()` を確実に呼び出す

## 🔍 解決した実際のバグ

### バグ1: 「いいえ」選択後のエラーメッセージ残存
**問題**: ユーザーが確認ダイアログで「いいえ」を選択しても、「サンプルサイズが不十分です」のメッセージが残り続けた。

**原因**: `handleModeSwitch()` 内で `updateLoadStatsButtons()` が古いデータで呼ばれた後、データクリアが実行されたが、`updateLoadStatsButtons()` が再度呼ばれなかった。

**解決**: `clearAllYieldStatsData()` 内で `updateLoadStatsButtons()` を確実に呼び出すように修正。

### バグ2: データクリアの漏れ
**問題**: 過去に数回、一方のハンドラーで修正したが、もう一方のハンドラーに反映し忘れる事例があった。

**解決**: 重複コードを削除し、共通の関数を使用することで、修正漏れを防止。

## 🚀 今後の改善点

### 1. テストコードの改善
現在のテストコードはモジュールモックが複雑です。今後、以下の改善を検討:
- 統合テストの追加
- E2Eテストの追加
- モックの簡略化

### 2. 状態管理のさらなる統一
現在も4つのグローバルオブジェクトに分散しています。将来的には:
- 単一の状態管理オブジェクトに統合
- Redux/Zustand等の状態管理ライブラリの導入検討

### 3. タイミング依存コードの改善
現在も `setTimeout` に依存しています。将来的には:
- Promise ベースの非同期処理に移行
- `requestAnimationFrame` の活用
- 統計計算完了イベントの導入

## 📝 学んだこと

### 1. コード重複は保守性の大敵
- 80行の重複コードは、バグ修正時に2箇所修正する必要があり、修正漏れが発生
- 早期のリファクタリングが重要

### 2. グローバル状態の管理
- 複数のグローバルオブジェクトに状態が分散すると、データの同期が困難
- データクリアに8つの操作が必要になり、エラーの温床に

### 3. 関数の抽出タイミング
- 関数が50行を超えたら分割を検討
- 同じロジックが2箇所以上に現れたら即座に抽出

## ✅ チェックリスト

- [x] ユーティリティモジュール作成
- [x] `checkStatsDataExists()` 実装
- [x] `clearAllYieldStatsData()` 実装
- [x] `handleYieldStatsTransition()` 実装
- [x] multiPatternBtn ハンドラーのリファクタリング
- [x] goToMultiPatternBtn ハンドラーのリファクタリング
- [x] テストコード作成 (基本構造)
- [ ] テストコードの改善 (将来)
- [ ] ブラウザでの動作確認 (次のステップ)
- [ ] Git コミット & プッシュ

## 🔗 関連ファイル

### 変更されたファイル
- `scripts/yield-stats-transition.js` (新規)
- `scripts/event-handlers-setup.js` (リファクタリング)

### 追加されたファイル
- `__tests__/yield-stats-transition.test.js` (新規)
- `docs/REFACTORING_YIELD_STATS_TRANSITION.md` (このドキュメント)

### 影響を受けるファイル
- `scripts/multi-pattern-stats-loader.js` (インポート元)
- `scripts/yield-stats-display.js` (インポート元)
- `scripts/mode-manager.js` (インポート元)
- `scripts/yield-stats-table.js` (インポート元)
