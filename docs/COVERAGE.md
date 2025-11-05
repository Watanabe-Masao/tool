# テストカバレッジ向上計画

## 📊 現在のカバレッジ状況

**最終更新**: 2025-11-05

| メトリクス | カバレッジ | 目標 |
|-----------|-----------|------|
| Statements | 6.96% | 10% → 20% → 50% → 80% |
| Branches | 6.61% | 10% → 20% → 50% → 70% |
| Functions | 13.44% | 15% → 30% → 60% → 80% |
| Lines | 7.12% | 10% → 20% → 50% → 80% |

**テスト数**: 461 (437 passed, 7 skipped)

## 🎯 カバレッジ目標

### Phase 1: 基盤構築 ✅ **完了**
**目標**: 3.54% → 6.96%
**期間**: 2025-11-05
**成果**:
- ビジネスロジックの純粋関数化
- 重要計算モジュールのテスト作成
- CI/CD への統合

**テスト追加**:
- calculator-fixed.js: 52テスト
- calculator-weight.js: 54テスト
- calculator-multi-pattern.js: 35テスト
- calculator-yield-stats.js: 51テスト
- calculation.js: 31テスト
- validation.js: 36テスト
- errors.js: 32テスト

### Phase 2: ビジネスロジック強化
**目標**: 6.96% → 10%
**優先度**: 高
**対象モジュール**:
- [ ] yield-stats-calc.js (現在100% → 維持)
- [ ] state.js (現在80.2% → 90%)
- [ ] memoize.js (現在90% → 95%)
- [ ] logger.js (現在100% → 維持)

**期待効果**: +3-4% カバレッジ向上

### Phase 3: UI統合層のテスト
**目標**: 10% → 20%
**優先度**: 中
**対象モジュール**:
- [ ] form-manager.js (0% → 30%)
- [ ] input-handler.js (0% → 50%)
- [ ] display.js (0% → 40%)
- [ ] mode-manager.js (0% → 30%)

**期待効果**: +10% カバレッジ向上

### Phase 4: データ層のテスト
**目標**: 20% → 50%
**優先度**: 中
**対象モジュール**:
- [ ] storage.js (0% → 60%)
- [ ] db.js (0% → 40%)
- [ ] db-batch.js (0% → 40%)
- [ ] session.js (0% → 50%)

**期待効果**: +30% カバレッジ向上

### Phase 5: Firebase統合のテスト
**目標**: 50% → 80%
**優先度**: 低（モック必要）
**対象モジュール**:
- [ ] firebase-auth.js (0% → 60%)
- [ ] firebase-sync.js (0% → 50%)
- [ ] firebase-ui.js (0% → 40%)

**期待効果**: +30% カバレッジ向上

## 📈 カバレッジ履歴

| 日付 | カバレッジ | 変化 | テスト数 | 備考 |
|------|-----------|------|---------|------|
| 2025-11-05 | 6.96% | +97% | 461 | Phase 1完了: ビジネスロジック基盤 |
| 開始時 | 3.54% | - | 437 | 初期状態 |

## 🎨 モジュール別カバレッジ

### ✅ 高カバレッジ（80%以上）
- `calculator-yield-stats.js`: **100%** (51テスト)
- `calculation.js`: **100%** (31テスト)
- `constants.js`: **100%**
- `yield-stats-calc.js`: **100%**
- `logger.js`: **100%** (25テスト)
- `calculator-multi-pattern.js`: **92%** (35テスト)
- `memoize.js`: **90%** (12テスト)

### 🟡 中カバレッジ（50-80%）
- `calculator-weight.js`: **60.86%** (54テスト)
- `calculator-fixed.js`: **57.14%** (52テスト)
- `state.js`: **80.2%** (26テスト)
- `validation.js`: **71.25%** (36テスト)
- `errors.js`: **95%** (32テスト)

### 🔴 低カバレッジ（50%未満）
- `dom-utils.js`: **26.66%**
- `yield-stats-transition.js`: **36.17%**
- その他UI/Firebaseモジュール: **0%**

## 🐛 テストで発見したバグ

1. **validation.js** - フィールド名の不一致
   - `data.input` → `data.inputData`
   - `data.result` → `data.resultData`
   - **影響**: 検証が正しく動作していなかった

2. **errors.js** - QuotaExceededError の戻り値型エラー
   - 代入式が文字列を返していた
   - **影響**: エラーハンドリングチェーンが壊れていた

3. **calculator-yield-stats.js** - validateEntry が boolean 以外を返す
   - falsy値（空文字列、null、undefined）を返していた
   - **影響**: 条件分岐で予期しない動作

## 🛠️ テスト戦略

### 優先度の決定基準
1. **ビジネスロジック** - 最優先
   - 計算ロジック
   - データ検証
   - エラーハンドリング

2. **状態管理** - 高優先度
   - アプリケーション状態
   - セッション管理

3. **UI統合** - 中優先度
   - フォーム管理
   - 表示制御

4. **データ層** - 中優先度
   - ストレージ
   - データベース

5. **外部統合** - 低優先度（モック必要）
   - Firebase認証
   - Firebase同期

### テスト作成ガイドライン

#### 1. 純粋関数を優先
```javascript
// ✅ 良い例: テストしやすい
export function calculateYieldRate(beforeWeight, afterWeight) {
  if (!beforeWeight || !afterWeight) return null;
  return (afterWeight / beforeWeight) * 100;
}

// ❌ 悪い例: DOM依存
function calculateYieldRate() {
  const before = num(FIELDS.BEFORE_WEIGHT);
  const after = num(FIELDS.AFTER_WEIGHT);
  return (after / before) * 100;
}
```

#### 2. DOM依存コードのリファクタリングパターン
```javascript
// 純粋関数: ビジネスロジック
export function calculateLogic(param1, param2) {
  // 計算ロジック
  return result;
}

// DOM統合層: 薄いラッパー
function calculate() {
  const p1 = num(FIELDS.PARAM1);
  const p2 = num(FIELDS.PARAM2);
  return calculateLogic(p1, p2);
}
```

#### 3. テストケースの種類
- **正常系**: 期待通りの動作
- **エッジケース**: 境界値、特殊値
- **異常系**: エラーハンドリング
- **実用シナリオ**: 実際の使用例

## 🚀 CI/CD 統合

### カバレッジ閾値（段階的）

#### 現在（Phase 1完了時）
```json
{
  "statements": 5,
  "branches": 5,
  "functions": 10,
  "lines": 5
}
```

#### Phase 2目標
```json
{
  "statements": 8,
  "branches": 7,
  "functions": 12,
  "lines": 8
}
```

#### Phase 3目標
```json
{
  "statements": 15,
  "branches": 12,
  "functions": 20,
  "lines": 15
}
```

#### 最終目標
```json
{
  "statements": 80,
  "branches": 70,
  "functions": 80,
  "lines": 80
}
```

### CI/CDでのチェック
- ✅ カバレッジが閾値を下回ったらCIを失敗させる
- ✅ PRごとにカバレッジレポートをコメント
- ✅ Codecovへのアップロード
- ✅ カバレッジレポートをアーティファクトとして保存

## 📚 参考資料

### テスト実行コマンド
```bash
# 全テスト実行
npm test

# カバレッジレポート生成
npm run test:coverage

# 特定ファイルのテスト
npm test -- calculator-fixed.test.js

# ウォッチモード
npm test -- --watch
```

### カバレッジレポート確認
```bash
# ブラウザでHTMLレポートを開く
open coverage/lcov-report/index.html
```

## 🎓 学んだこと

### TDD（テスト駆動開発）の価値
1. **バグの早期発見**
   - 3つの実装バグを発見・修正
   - 本番環境に到達する前に問題を解決

2. **リファクタリングの安全性**
   - DOM依存コードを純粋関数に変更
   - テストが動作を保証

3. **ドキュメント効果**
   - テストが仕様書として機能
   - 使用例が明確

### 純粋関数の利点
1. **テスタビリティ**: モック不要
2. **再利用性**: Web Worker、Node.jsで使用可能
3. **保守性**: 関心の分離

### カバレッジの適切な目標設定
- ❌ 最初から80%を目指す → 挫折
- ✅ 段階的に向上させる → 持続可能

## 🔄 定期レビュー

### 月次レビュー項目
- [ ] カバレッジ目標の達成度確認
- [ ] 新しいバグの発見・修正
- [ ] カバレッジ閾値の調整
- [ ] 次フェーズの計画調整

### 四半期レビュー項目
- [ ] 全体的なテスト戦略の見直し
- [ ] CI/CDパイプラインの最適化
- [ ] チーム内知識共有
- [ ] ツール・ライブラリのアップデート

---

**次のアクション**: Phase 2（10%目標）の開始
**担当**: 開発チーム
**期限**: TBD
