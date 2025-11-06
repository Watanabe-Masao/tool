# CI/CD パイプライン

**作成日**: 2025-11-05
**ステータス**: ✅ 稼働中

---

## 概要

GitHub Actionsを使用した継続的インテグレーション（CI）と継続的デリバリー（CD）のパイプラインです。

### 目的
- コード品質の自動チェック
- テストの自動実行
- カバレッジレポートの自動生成
- PRレビューの効率化

---

## ワークフロー構成

### 1. CI ワークフロー (`.github/workflows/ci.yml`)

#### トリガー
- `push`: main, develop, claude/** ブランチへのプッシュ
- `pull_request`: main, develop ブランチへのPR

#### ジョブ

##### Lint Job
- **実行内容**: ESLintによるコード品質チェック
- **ステップ**:
  1. コードチェックアウト
  2. Node.js 18 セットアップ
  3. 依存関係インストール (`npm ci`)
  4. ESLint実行 (`npm run lint`)
  5. import位置検証 (`npm run validate:imports`)

##### Test Job
- **実行内容**: ユニットテスト＋カバレッジ測定
- **ステップ**:
  1. コードチェックアウト
  2. Node.js 18 セットアップ
  3. 依存関係インストール
  4. テスト実行 (`npm test`)
  5. カバレッジレポート生成 (`npm run test:coverage`)
  6. **Codecov へアップロード** (オプション)
  7. カバレッジレポートをArtifactsとして保存（30日間）

##### Quality Gate Job
- **実行内容**: 品質ゲート判定
- **依存**: lint, test ジョブの成功
- **ステップ**:
  1. カバレッジしきい値チェック
  2. 品質サマリー出力

---

### 2. PR Checks ワークフロー (`.github/workflows/pr-checks.yml`)

#### トリガー
- `pull_request`: opened, synchronize, reopened

#### ジョブ

##### Coverage Report Job
- **実行内容**: PRへのカバレッジコメント
- **ステップ**:
  1. コードチェックアウト（履歴含む）
  2. テスト＋カバレッジ実行
  3. **LCOVレポートをPRにコメント**
  4. 古いコメントは自動削除

##### Code Quality Job
- **実行内容**: コード品質チェック
- **ステップ**:
  1. ESLint実行
  2. import位置検証
  3. **console.* 使用チェック**（logger.js以外で検出→エラー）

##### Commit Message Job
- **実行内容**: コミットメッセージ検証
- **ルール**: Conventional Commits 形式
- **有効なtype**:
  - `feat`: 新機能
  - `fix`: バグ修正
  - `docs`: ドキュメント
  - `style`: フォーマット
  - `refactor`: リファクタリング
  - `perf`: パフォーマンス改善
  - `test`: テスト
  - `chore`: 雑務
  - `ci`: CI/CD設定

**例**:
```
✅ feat(logger): Add unified logger
✅ fix: Resolve infinite recursion
✅ docs: Update CI/CD documentation
❌ Added new feature (type missing)
❌ fix bug (コロンなし)
```

##### PR Summary Job
- **実行内容**: PR品質サマリー出力
- **依存**: 上記3ジョブ（always実行）

---

## セットアップ手順

### 1. リポジトリシークレット設定

#### Codecov（オプション）
1. [codecov.io](https://codecov.io/) でアカウント作成
2. リポジトリを追加してトークン取得
3. GitHub リポジトリの Settings → Secrets and variables → Actions
4. `CODECOV_TOKEN` を追加

**注意**: Codecovトークンがない場合、カバレッジアップロードはスキップされます（`fail_ci_if_error: false`）

### 2. ワークフロー有効化

1. `.github/workflows/` をリポジトリにプッシュ
2. GitHub Actions タブで自動的にワークフローが表示される
3. 初回プッシュでワークフローが自動実行される

### 3. ブランチ保護設定（推奨）

#### main ブランチ
1. Settings → Branches → Add branch protection rule
2. Branch name pattern: `main`
3. ✅ Require status checks to pass before merging
   - 必須チェック:
     - `lint`
     - `test`
     - `quality-gate`
     - `code-quality`
     - `commit-message`
4. ✅ Require pull request reviews before merging
5. ✅ Require linear history（推奨）

---

## ローカルでのチェック

PRを作成する前にローカルで実行できます：

```bash
# ESLintチェック
npm run lint

# 自動修正
npm run lint:fix

# import検証
npm run validate:imports

# テスト実行
npm test

# カバレッジ測定
npm run test:coverage

# 全チェック実行
npm run validate
```

---

## トラブルシューティング

### Q1: ESLint エラーが出る
**A**: `npm run lint:fix` で自動修正を試してください。修正できない場合は手動で対応が必要です。

### Q2: カバレッジが基準を満たさない
**A**: テストを追加してください。jest.config.js のしきい値を確認：
```javascript
coverageThreshold: {
  'scripts/core/logger.js': {
    statements: 95,
    branches: 80,
    functions: 100,
    lines: 95
  },
  // ...
}
```

### Q3: console.* 使用エラー
**A**: `logger.error()`, `logger.warn()`, `logger.info()`, `logger.debug()` を使用してください。

```javascript
// ❌ Bad
console.log('データ保存完了');

// ✅ Good
import { logger } from './core/logger.js';
logger.info('データ保存完了');
```

### Q4: コミットメッセージエラー
**A**: Conventional Commits 形式で書き直してください：
```bash
# 修正前
git commit -m "bug fix"

# 修正後
git commit --amend -m "fix: Resolve login issue"
```

### Q5: Codecov アップロード失敗
**A**: `CODECOV_TOKEN` が設定されているか確認してください。トークンがない場合でもCIは成功します（`fail_ci_if_error: false`）。

---

## パフォーマンス

### 実行時間（推定）

| ジョブ | 時間 |
|--------|------|
| Lint | ~30秒 |
| Test | ~1分 |
| Quality Gate | ~1分 |
| Coverage Report | ~1分 |
| Code Quality | ~30秒 |
| Commit Message | ~10秒 |
| **合計** | **~4分** |

### 最適化Tips
- **キャッシュ**: `actions/setup-node` の `cache: 'npm'` で依存関係をキャッシュ
- **並列実行**: lint と test は並列実行
- **早期失敗**: quality-gate は lint/test 成功後に実行

---

## メトリクス

### 成功率
- 目標: 95%以上
- 現在: （GitHub Actions タブで確認）

### カバレッジ
- 目標: 主要モジュール 80%以上
- 現在: logger.js 100%, yield-stats-state.js 95%, state.js 80%

---

## ステータスバッジ

README.md に表示されるバッジ：

```markdown
[![CI](https://github.com/Watanabe-Masao/tool/workflows/CI/badge.svg)](https://github.com/Watanabe-Masao/tool/actions/workflows/ci.yml)
[![PR Checks](https://github.com/Watanabe-Masao/tool/workflows/PR%20Checks/badge.svg)](https://github.com/Watanabe-Masao/tool/actions/workflows/pr-checks.yml)
[![codecov](https://codecov.io/gh/Watanabe-Masao/tool/branch/main/graph/badge.svg)](https://codecov.io/gh/Watanabe-Masao/tool)
```

- **緑**: 最新ビルド成功
- **赤**: 最新ビルド失敗
- **灰色**: ワークフロー未実行 or 無効

---

## 今後の拡張

### Phase 7.5: デプロイ自動化（計画中）
```yaml
deploy:
  name: Deploy to Firebase
  needs: [lint, test, quality-gate]
  runs-on: ubuntu-latest
  if: github.ref == 'refs/heads/main'
  steps:
    - uses: FirebaseExtended/action-hosting-deploy@v0
```

### Phase 7.6: E2Eテスト（計画中）
```yaml
e2e:
  name: E2E Tests
  runs-on: ubuntu-latest
  steps:
    - run: npx playwright test
```

### Phase 7.7: パフォーマンス測定（計画中）
```yaml
performance:
  name: Lighthouse CI
  runs-on: ubuntu-latest
  steps:
    - run: npm run lighthouse
```

---

## 参考資料

- [GitHub Actions公式ドキュメント](https://docs.github.com/ja/actions)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Codecov Documentation](https://docs.codecov.com/)
- [ESLint CI Integration](https://eslint.org/docs/latest/use/integrations)

---

**最終更新**: 2025-11-05
**メンテナー**: Claude (AI Assistant)
