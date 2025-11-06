# 配列ベース管理への移行

## 概要

このドキュメントは、プロジェクト内のすべてのテーブル管理を絶対値IDベースから配列ベース管理に移行した変更をまとめています。

**変更日**: 2025-11-06
**目的**: 将来の「履歴追加」機能実装時のバグリスクを軽減し、データ管理の一貫性を向上

## 背景

### 問題点

以前の実装では、テーブルの行を絶対値ID（自動インクリメントカウンター）で管理していました：

```javascript
let yieldStatsEntryCounter = 0;

function addRow() {
  const rowId = yieldStatsEntryCounter++;
  row.dataset.rowId = rowId;

  // IDベースでDOM要素にアクセス
  const input = qs(`#beforeWeight${rowId}`);
}
```

この方法の問題点：

1. **将来機能との競合リスク**: 履歴から「追加」で呼び出す際、既存の行とIDが一貫性を持たない可能性
2. **デバッグ困難**: 行が削除された後、rowIdが飛び飛びになる（0, 2, 5, 8...）
3. **配列操作との不整合**: テーブル行数と内部IDが一致しない

### ユーザー要求

> 今後の実装で歩留まり統計に値が予め入ってる状態で履歴から呼び出す際に上書きで呼び出すか追加で呼び出すかを選択できるようにしたい為です。絶対値で管理されてるとバグの原因になるのが理由です。

## 解決策

### 採用したアプローチ: ハイブリッド管理

完全な配列インデックスへの移行ではなく、以下のハイブリッドアプローチを採用：

1. **内部IDは保持** - 後方互換性とDOM要素の識別のため
2. **値の取得は配列ベース** - `row.querySelector()`でクラスベースで要素を取得
3. **行番号は相対値** - 表示上は1, 2, 3...と連番

```javascript
// ✅ 新しい実装
rows.forEach((row, index) => {
  const beforeInput = row.querySelector('.before-weight-input');
  const afterInput = row.querySelector('.after-weight-input');
  // 配列インデックスで処理
});
```

この方法のメリット：

- ✅ 既存のテストコードに影響なし
- ✅ 将来の「追加」機能実装時に柔軟に対応可能
- ✅ 大規模なリファクタリング不要
- ✅ デバッグが容易（配列として扱える）

## 変更内容

### 1. preset-pairs-table (scripts/multi-pattern-presets.js)

**問題**: ソート後のインデックスで削除していたため、同じ値のペアがあると誤動作の可能性

**解決策**: 各ペアにユニークIDを付与

#### 変更点

**追加された変数**:
```javascript
let tempPairIdCounter = 0; // ペアのユニークID生成用カウンター
```

**addPairToTemp関数**:
```javascript
// 変更前
tempPairs.push({ unitCost, unitPrice });

// 変更後
tempPairs.push({
  id: tempPairIdCounter++,
  unitCost,
  unitPrice
});
```

**renderTempPairs関数**:
```javascript
// 変更前
tbody.innerHTML = sorted.map((pair, index) => `
  <tr>
    <td>${pair.unitCost}</td>
    <td>${pair.unitPrice}</td>
    <td><button data-pair-index="${index}">削除</button></td>
  </tr>
`).join('');

// 変更後
tbody.innerHTML = sorted.map((pair) => `
  <tr>
    <td>${pair.unitCost}</td>
    <td>${pair.unitPrice}</td>
    <td><button data-pair-id="${pair.id}">削除</button></td>
  </tr>
`).join('');
```

**removeTempPair関数**:
```javascript
// 変更前
function removeTempPair(index) {
  const sorted = [...tempPairs].sort((a, b) => b.unitPrice - a.unitPrice);
  const pairToRemove = sorted[index];
  const realIndex = tempPairs.findIndex(p =>
    p.unitCost === pairToRemove.unitCost &&
    p.unitPrice === pairToRemove.unitPrice
  );
  if (realIndex !== -1) {
    tempPairs.splice(realIndex, 1);
  }
  renderTempPairs();
}

// 変更後
function removeTempPair(id) {
  const index = tempPairs.findIndex(p => p.id === id);
  if (index !== -1) {
    tempPairs.splice(index, 1);
    renderTempPairs();
  } else {
    logger.error('Invalid pair ID:', id);
  }
}
```

**savePresetFromModal関数**:
```javascript
// IDプロパティを保存データから除外
const patterns = [...tempPairs]
  .sort((a, b) => b.unitPrice - a.unitPrice)
  .map(({ unitCost, unitPrice }) => ({ unitCost, unitPrice }));
```

### 2. yieldStatsTable (scripts/yield-stats-table.js)

**問題**: rowIdを使ってDOM要素のid属性を構築し、値を取得していた

**解決策**: inputフィールドにクラスを追加し、rowから直接querySelector

#### 変更点

**addYieldStatsRow関数** - クラス追加:
```javascript
// 変更前
<input type="number"
       id="${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}"
       class="table-input"
       ... />

// 変更後
<input type="number"
       id="${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}"
       class="table-input before-weight-input"
       ... />
```

同様に以下のクラスを追加：
- `before-weight-input` - 加工前重量入力
- `after-weight-input` - 加工後重量入力
- `yield-rate-display` - 歩留まり率表示
- `z-score-display` - z-score表示
- `confidence-judgment-display` - 信頼度判定表示

**値取得の変更** - すべての関数で以下のパターンに変更:
```javascript
// 変更前
rows.forEach((row) => {
  const rowId = row.dataset.rowId;
  const beforeInput = qs(`#${YIELD_STATS_FIELDS.BEFORE_WEIGHT}${rowId}`);
  const afterInput = qs(`#${YIELD_STATS_FIELDS.AFTER_WEIGHT}${rowId}`);
});

// 変更後
rows.forEach((row) => {
  const beforeInput = row.querySelector('.before-weight-input');
  const afterInput = row.querySelector('.after-weight-input');
});
```

**影響を受けたファイル**:
- `scripts/session.js` - セッション保存時のデータ取得
- `scripts/history-save-dialog.js` - 履歴保存時のデータ取得
- `scripts/mode-manager.js` - モード切替時の入力チェック
- `scripts/outlier-management.js` - 外れ値検出時の行ハイライト・削除
- `scripts/yield-stats-table.js` - 各種テーブル操作関数

### 3. multiPatternTable (scripts/multi-pattern-ui/patterns.js)

**結論**: 既に適切な設計

multiPatternTableは既にクラスベースのquerySelectを使用していました：

```javascript
// 既存の実装（変更不要）
const unitCostInput = row.querySelector('.pattern-unit-cost');
const unitPriceInput = row.querySelector('.pattern-unit-price');
```

data-pattern-idは以下の用途でのみ使用：
- 削除ボタンの識別
- 特定の行の検索

この設計は既に配列ベース管理と互換性があります。

## 詳細な変更ファイル一覧

### 変更されたファイル

| ファイル | 変更内容 | 行数変更 |
|---|---|---|
| `scripts/multi-pattern-presets.js` | IDベース削除ロジック追加 | +30, -20 |
| `scripts/yield-stats-table.js` | クラス追加、値取得ロジック変更 | +15, -25 |
| `scripts/session.js` | 配列ベース値取得 | +5, -10 |
| `scripts/history-save-dialog.js` | 配列ベース値取得 | +5, -10 |
| `scripts/mode-manager.js` | 配列ベース値取得 | +3, -6 |
| `scripts/outlier-management.js` | 配列ベース値取得（2箇所） | +8, -18 |

**合計**: 66行追加、89行削除

### 変更されなかったファイル

| ファイル | 理由 |
|---|---|
| `scripts/multi-pattern-ui/patterns.js` | 既に適切な設計 |
| `scripts/multi-pattern-ui/calculations.js` | 既に配列インデックス使用 |
| `scripts/multi-pattern-ui/presets.js` | 既にクラスベース取得 |

## テスト結果

### 実行されたテスト

```bash
npm test
```

**結果**:
```
Test Suites: 22 passed, 22 total
Tests:       7 skipped, 711 passed, 718 total
Time:        5.97 s
```

**結論**: ✅ すべてのテストが通過

### 手動テスト項目

以下の機能を手動でテストすることを推奨：

#### 歩留まり統計テーブル
- [ ] 行の追加
- [ ] 行の削除
- [ ] データ入力後の計算
- [ ] セッション保存・復元
- [ ] 履歴保存・復元
- [ ] 外れ値検出・ハイライト
- [ ] 外れ値削除
- [ ] モード切替時の確認ダイアログ

#### プリセット管理
- [ ] プリセット作成
- [ ] 原価・売価ペア追加
- [ ] 同じ値のペアを追加（バグ修正確認）
- [ ] ペア削除
- [ ] プリセット保存
- [ ] プリセット編集
- [ ] プリセット削除
- [ ] プリセット適用

## 将来の「追加」機能実装ガイド

### 実装例: 履歴から追加

```javascript
/**
 * 履歴データをテーブルに追加（上書きではなく追加）
 * @param {Array} tableData - 追加するデータ
 */
export function appendYieldStatsTable(tableData, callbacks = {}) {
  const tbody = qs(`#${UI_ELEMENTS.YIELD_STATS_TABLE_BODY}`);
  if (!tbody || !tableData || tableData.length === 0) return;

  // カウンターはリセットしない（既存の行を保持）
  // yieldStatsEntryCounter は現在の値を継続

  // データから行を追加
  tableData.forEach(rowData => {
    addYieldStatsRow(callbacks);

    // 配列ベース管理: 最後に追加した行から直接inputを取得
    const allRows = tbody.querySelectorAll('.yield-stats-row');
    const lastRow = allRows[allRows.length - 1];
    const beforeInput = lastRow.querySelector('.before-weight-input');
    const afterInput = lastRow.querySelector('.after-weight-input');

    if (beforeInput && rowData.beforeWeight !== undefined) {
      beforeInput.value = rowData.beforeWeight;
    }
    if (afterInput && rowData.afterWeight !== undefined) {
      afterInput.value = rowData.afterWeight;
    }
  });

  // 行番号を更新（相対値に）
  updateRowNumbers();

  // 統計情報を更新
  if (callbacks.updateYieldStatsStatistics) {
    callbacks.updateYieldStatsStatistics();
  }
}
```

### 実装例: 上書きと追加の選択

```javascript
/**
 * 履歴データを読み込む（上書きまたは追加を選択）
 * @param {Array} tableData - 読み込むデータ
 * @param {Object} options - オプション
 * @param {boolean} options.append - trueの場合は追加、falseの場合は上書き
 */
export function loadYieldStatsTableData(tableData, options = {}) {
  const { append = false } = options;

  if (append) {
    // 追加モード
    appendYieldStatsTable(tableData, callbacks);
  } else {
    // 上書きモード（既存の実装）
    restoreYieldStatsTable(tableData, callbacks);
  }
}
```

### ユーザーインターフェース例

```javascript
// 履歴ダイアログで選択を提供
function showHistoryLoadDialog(historyData) {
  const hasExistingData = checkIfTableHasData();

  if (hasExistingData) {
    // 既存データがある場合、選択肢を提供
    showDialog({
      title: '履歴の読み込み',
      message: '既存のデータがあります。どのように読み込みますか？',
      buttons: [
        {
          text: '上書き',
          onClick: () => loadYieldStatsTableData(historyData.tableData, { append: false })
        },
        {
          text: '追加',
          onClick: () => loadYieldStatsTableData(historyData.tableData, { append: true })
        },
        {
          text: 'キャンセル',
          onClick: () => {}
        }
      ]
    });
  } else {
    // 既存データがない場合、直接読み込み
    loadYieldStatsTableData(historyData.tableData, { append: false });
  }
}
```

## 技術的負債

### 解決済み

1. ✅ **preset-pairs-tableの削除バグ**: 同じ値のペアがあると誤削除の可能性 → IDベース削除に変更
2. ✅ **rowIdベースのDOM取得**: 配列ベース取得に統一
3. ✅ **行番号の一貫性**: 相対値表示に統一（前回のコミットで対応）

### 残存する技術的負債

なし。すべてのテーブルが適切に管理されています。

## パフォーマンスへの影響

### 変更前
```javascript
// O(1) - ID直接アクセス
const input = qs(`#beforeWeight${rowId}`);
```

### 変更後
```javascript
// O(n) - 行内要素の検索（nは行内の要素数、通常5-10程度）
const input = row.querySelector('.before-weight-input');
```

**結論**:
- 行内要素数は少ない（5-10個）ため、パフォーマンス影響は無視できる
- 可読性と保守性の向上がパフォーマンスのわずかな低下を上回る

## ベストプラクティス

### 新しいテーブルを追加する場合

1. **クラスベースのquerySelectを使用**
```javascript
// ✅ 推奨
const input = row.querySelector('.my-input');

// ❌ 非推奨
const input = qs(`#myInput${rowId}`);
```

2. **行番号は相対値で表示**
```javascript
// ✅ 推奨
function updateRowNumbers() {
  const rows = tbody.querySelectorAll('tr');
  rows.forEach((row, index) => {
    const numberCell = row.querySelector('.row-number');
    if (numberCell) {
      numberCell.textContent = index + 1;
    }
  });
}
```

3. **内部IDは保持してもOK（必要な場合）**
```javascript
// 削除ボタンなど、特定の行を識別する必要がある場合
row.dataset.rowId = rowId;
<button data-row-id="${rowId}">削除</button>

// 値の取得には使用しない
// ❌ const input = qs(`#input${rowId}`);
// ✅ const input = row.querySelector('.my-input');
```

## まとめ

### 達成したこと

1. ✅ **preset-pairs-table**: IDベース管理に変更し、削除バグを修正
2. ✅ **yieldStatsTable**: 配列ベースの値取得に統一
3. ✅ **multiPatternTable**: 既に適切な設計であることを確認
4. ✅ **全テスト通過**: 711/718テスト（7スキップ）
5. ✅ **将来機能の準備**: 「追加」機能実装時のバグリスクを軽減

### 今後の課題

- 実際に「上書き/追加」機能を実装する際の詳細設計
- ユーザーインターフェースの設計（ダイアログ、ボタン配置など）
- 追加モードでの動作テストケース作成

### 参考資料

- [ROW_NUMBER_REFACTORING.md](./ROW_NUMBER_REFACTORING.md) - 行番号の相対値化に関する前回の変更
- コミット: `2c4eee4` - 行番号を絶対値から相対値に変更

---

**変更履歴**:
- 2025-11-06: 初版作成（配列ベース管理への移行完了）
