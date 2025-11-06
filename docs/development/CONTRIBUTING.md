# 開発ガイド 🤝

歩留まり計算ツールへのコントリビューションをお待ちしています！

このドキュメントでは、プロジェクトへの参加方法を説明します。

---

## 目次

- [はじめに](#はじめに)
- [開発環境のセットアップ](#開発環境のセットアップ)
- [開発フロー](#開発フロー)
- [コーディング規約](#コーディング規約)
- [テスト](#テスト)
- [コミットメッセージ](#コミットメッセージ)
- [プルリクエスト](#プルリクエスト)
- [レビュープロセス](#レビュープロセス)
- [質問・相談](#質問相談)

---

## はじめに

### コントリビューションの種類

以下のような貢献を歓迎します：

- 🐛 **バグ報告**: 不具合の報告
- ✨ **機能提案**: 新機能のアイデア
- 💻 **コード貢献**: バグ修正、新機能実装
- 📝 **ドキュメント改善**: ドキュメントの追加・修正
- 🧪 **テスト追加**: テストカバレッジの向上
- 🎨 **UI/UX改善**: デザインの改善
- 🌐 **翻訳**: 多言語対応

### 行動規範

- 敬意を持って接する
- 建設的なフィードバックを心がける
- 多様な視点を尊重する
- 初心者にも優しく

---

## 開発環境のセットアップ

### 必要な環境

- **Node.js**: v18以上
- **npm**: v9以上
- **Git**: 最新版
- **ブラウザ**: Chrome, Edge, Firefox, Safari（最新版）

### セットアップ手順

#### 1. リポジトリをフォーク

GitHubで本リポジトリをフォークします。

#### 2. クローン

```bash
git clone https://github.com/YOUR_USERNAME/tool.git
cd tool
```

#### 3. 依存関係のインストール

```bash
npm install
```

#### 4. ローカルサーバーの起動

```bash
npx http-server -p 8080
```

ブラウザで http://localhost:8080 にアクセス

#### 5. テストの実行

```bash
# 全テストを実行
npm test

# ウォッチモードでテスト
npm run test:watch

# カバレッジを確認
npm run test:coverage
```

---

## 開発フロー

### 1. イシューを確認

- [Issues](https://github.com/Watanabe-Masao/tool/issues) で既存のイシューを確認
- 新しいイシューを作成する場合は、まず検索して重複がないか確認

### 2. ブランチを作成

```bash
# 最新のmainブランチを取得
git checkout main
git pull origin main

# フィーチャーブランチを作成
git checkout -b feature/your-feature-name
```

**ブランチ命名規則**:
- `feature/xxx`: 新機能
- `fix/xxx`: バグ修正
- `docs/xxx`: ドキュメント
- `test/xxx`: テスト
- `refactor/xxx`: リファクタリング

### 3. 開発

- コードを書く
- テストを追加・更新
- ドキュメントを更新

### 4. テスト

```bash
# テストを実行
npm test

# ESLintでコード品質をチェック
npm run lint
```

### 5. コミット

```bash
git add .
git commit -m "feat: Add new feature"
```

### 6. プッシュ

```bash
git push origin feature/your-feature-name
```

### 7. プルリクエストを作成

GitHubでプルリクエストを作成します。

---

## コーディング規約

### JavaScript スタイル

#### ES6+ 機能を使用

```javascript
// ✅ Good
const calculatePrice = (cost, markup) => cost / (1 - markup);
const { yieldRate, beforeWeight } = data;
const items = [...existingItems, newItem];

// ❌ Bad
var calculatePrice = function(cost, markup) {
  return cost / (1 - markup);
};
```

#### const/let の使用

```javascript
// ✅ Good
const MAX_RETRIES = 3;
let currentAttempt = 0;

// ❌ Bad
var MAX_RETRIES = 3;
```

#### 関数名は動詞で始める

```javascript
// ✅ Good
function calculateYieldRate(before, after) { ... }
function validateInput(value) { ... }
function formatCurrency(amount) { ... }

// ❌ Bad
function yieldRate(before, after) { ... }
function inputCheck(value) { ... }
```

#### 早期リターンを使用

```javascript
// ✅ Good
function validateData(data) {
  if (!data) return false;
  if (!data.weight) return false;
  return true;
}

// ❌ Bad
function validateData(data) {
  if (data) {
    if (data.weight) {
      return true;
    }
  }
  return false;
}
```

### モジュール設計

#### 単一責任の原則

- 1つのモジュールは1つの責務のみを持つ
- 関数は1つのことだけを行う

```javascript
// ✅ Good
export function calculateYieldRate(beforeWeight, afterWeight) {
  return (afterWeight / beforeWeight) * 100;
}

export function formatYieldRate(yieldRate) {
  return `${yieldRate.toFixed(1)}%`;
}

// ❌ Bad
export function calculateAndFormatYieldRate(beforeWeight, afterWeight) {
  const yieldRate = (afterWeight / beforeWeight) * 100;
  return `${yieldRate.toFixed(1)}%`;
}
```

#### 疎結合・高凝集

- モジュール間の依存を最小化
- 関連する機能を1つのモジュールにまとめる

### エラーハンドリング

```javascript
// ✅ Good
try {
  const result = await saveData(data);
  showSuccess('データを保存しました');
  return result;
} catch (error) {
  console.error('保存エラー:', error);
  showError('保存に失敗しました。もう一度お試しください。');
  throw error;
}

// ❌ Bad
try {
  const result = await saveData(data);
  alert('保存しました');
  return result;
} catch (error) {
  alert('エラー');
}
```

### コメント

```javascript
// ✅ Good
/**
 * 歩留まり率を計算します
 * @param {number} beforeWeight - 加工前重量（g）
 * @param {number} afterWeight - 加工後重量（g）
 * @returns {number} 歩留まり率（%）
 */
export function calculateYieldRate(beforeWeight, afterWeight) {
  return (afterWeight / beforeWeight) * 100;
}

// ❌ Bad
// 計算
export function calc(b, a) {
  return (a / b) * 100;
}
```

詳細は [BEST_PRACTICES.md](./BEST_PRACTICES.md) をご覧ください。

---

## テスト

### テストの書き方

#### ファイル命名規則

```
scripts/calculator.js
└── __tests__/calculator.test.js
```

#### テスト構造

```javascript
import { calculateYieldRate } from '../calculator.js';

describe('calculateYieldRate', () => {
  test('正常な値で計算できる', () => {
    expect(calculateYieldRate(1000, 850)).toBe(85.0);
  });

  test('0で割ったらエラーを投げる', () => {
    expect(() => calculateYieldRate(0, 850)).toThrow();
  });

  test('負の値を拒否する', () => {
    expect(() => calculateYieldRate(-100, 850)).toThrow();
  });
});
```

#### カバレッジ目標

- **ライン**: 80%以上
- **ブランチ**: 75%以上
- **関数**: 80%以上

```bash
# カバレッジを確認
npm run test:coverage
```

### テストのベストプラクティス

1. **テストは独立させる**: 他のテストに依存しない
2. **AAA パターン**: Arrange（準備）、Act（実行）、Assert（検証）
3. **エッジケースをテスト**: 境界値、エラーケース
4. **わかりやすいテスト名**: 何をテストしているか明確に

詳細は [TESTING.md](../testing/TESTING.md) をご覧ください。

---

## コミットメッセージ

### コミットメッセージの形式

**Conventional Commits** に従います：

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type

- `feat`: 新機能
- `fix`: バグ修正
- `docs`: ドキュメントのみの変更
- `style`: コードの意味に影響しない変更（空白、フォーマット等）
- `refactor`: リファクタリング
- `perf`: パフォーマンス改善
- `test`: テストの追加・修正
- `chore`: ビルドプロセスやツールの変更

### 例

```
feat(stats): Add outlier detection using IQR method

- Implement IQR-based outlier detection
- Add visual highlighting for outliers
- Add "Remove outliers" button

Closes #123
```

```
fix(firebase): Fix authentication error handling

- Add user-friendly error messages
- Handle network errors gracefully

Fixes #456
```

---

## プルリクエスト

### プルリクエストのチェックリスト

プルリクエストを作成する前に、以下を確認してください：

- [ ] コードが正しく動作する
- [ ] テストが通る（`npm test`）
- [ ] ESLintエラーがない（`npm run lint`）
- [ ] 新機能にはテストを追加した
- [ ] ドキュメントを更新した
- [ ] コミットメッセージが規約に従っている

### プルリクエストの説明

以下の情報を含めてください：

```markdown
## 概要
このプルリクエストの目的を簡潔に説明

## 変更内容
- 変更点1
- 変更点2

## 関連イシュー
Closes #123

## スクリーンショット（UI変更の場合）
変更前後のスクリーンショット

## テスト
テスト方法と確認項目

## チェックリスト
- [x] テストが通る
- [x] ドキュメントを更新した
```

---

## レビュープロセス

### レビューの観点

レビュアーは以下の点を確認します：

1. **機能性**: 意図通りに動作するか
2. **コード品質**: 可読性、保守性
3. **テスト**: 適切なテストがあるか
4. **パフォーマンス**: パフォーマンス問題はないか
5. **セキュリティ**: セキュリティ上の問題はないか
6. **ドキュメント**: ドキュメントは更新されているか

### レビューコメントへの対応

- フィードバックを前向きに受け止める
- 不明点は質問する
- 修正後はコメントで報告する

### マージ条件

以下の条件を満たすとマージされます：

- ✅ レビュアーの承認
- ✅ CI/CDが通る（全テスト成功）
- ✅ コンフリクトがない

---

## 質問・相談

### どこで質問する？

- **一般的な質問**: [GitHub Discussions](https://github.com/Watanabe-Masao/tool/discussions)
- **バグ報告**: [GitHub Issues](https://github.com/Watanabe-Masao/tool/issues)
- **機能提案**: [GitHub Issues](https://github.com/Watanabe-Masao/tool/issues)

### 質問のベストプラクティス

1. **まず検索**: 既存のイシューやディスカッションを検索
2. **具体的に**: 問題を具体的に説明
3. **再現手順**: バグの場合は再現手順を記載
4. **環境情報**: ブラウザ、OS、バージョンを記載

---

## 参考ドキュメント

- **[アーキテクチャ](./ARCHITECTURE.md)** - システム設計
- **[ベストプラクティス](./BEST_PRACTICES.md)** - コーディング規約詳細
- **[テスト](../testing/TESTING.md)** - テスト戦略
- **[パフォーマンス](./PERFORMANCE.md)** - パフォーマンス最適化
- **[CI/CD](../deployment/CI_CD.md)** - CI/CDパイプライン

---

## ライセンス

このプロジェクトに貢献することで、あなたのコントリビューションがプロジェクトと同じライセンスの下で公開されることに同意したものとみなされます。

---

**ありがとうございます！** 🎉

あなたのコントリビューションがこのプロジェクトをより良くします。

---

**最終更新**: 2025-11-06
**バージョン**: v4.2
