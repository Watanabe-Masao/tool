# 次回の改善計画（Phase 4-7）

**現在**: Phase 3 完了 ✅
**設計スコア**: 84/150 (56%)
**目標スコア**: 120/150 (80%)

---

## Phase 4: UIState / HistoryState の分離

### 優先度: 中
### 推定工数: 3日
### 目標: AppState をさらに分解し、200行以下に

### 背景
AppState (現在413行) はまだ複数の責務を持っている：
1. モード管理
2. 計算結果（CalculationSnapshot）
3. 商品シミュレーション（ProductSimulationData）
4. **UI状態** ← 分離候補
5. **履歴管理** ← 分離候補
6. 歩留まり統計（YieldStatsState - 既に分離済み✅）

### 実施内容

#### 4.1: UIState の抽出
```javascript
// scripts/state/ui-state.js (NEW)
export class UIState {
  constructor() {
    this.isFromHistory = false;
    this.hasUnsavedChanges = false;
    this.showYieldStatsWithMultiPattern = false;
    this.saveDialogMode = 'normal';  // 'normal' | 'new'
  }

  markAsFromHistory() {
    this.isFromHistory = true;
  }

  markAsModified() {
    this.hasUnsavedChanges = true;
  }

  resetModified() {
    this.hasUnsavedChanges = false;
  }

  // ... 他のUIフラグ管理メソッド
}
```

#### 4.2: HistoryState の抽出
```javascript
// scripts/state/history-state.js (NEW)
export class HistoryState {
  constructor() {
    this.loadedHistoryId = null;
  }

  setLoadedId(id) {
    this.loadedHistoryId = id;
  }

  getLoadedId() {
    return this.loadedHistoryId;
  }

  clearLoadedId() {
    this.loadedHistoryId = null;
  }

  isLoadedFromHistory() {
    return this.loadedHistoryId !== null;
  }
}
```

#### 4.3: AppState のリファクタリング
```javascript
// scripts/state.js (REFACTORED)
import { YieldStatsState } from './state/yield-stats-state.js';
import { UIState } from './state/ui-state.js';
import { HistoryState } from './state/history-state.js';

export class AppState {
  constructor() {
    // モード管理
    this.mode = MODE.FIXED;
    this.currentStep = 1;

    // 計算結果
    this.snapshot = new CalculationSnapshot();
    this.productData = new ProductSimulationData();

    // コンポジション
    this._yieldStatsState = new YieldStatsState();
    this._uiState = new UIState();
    this._historyState = new HistoryState();

    // 後方互換性（次のPhase 0で削除）
    this.yieldStats = this._yieldStatsState;
    this.ui = this._uiState;
    this.history = this._historyState;
  }

  // 委譲メソッド
  isFromHistory() {
    return this._uiState.isFromHistory;
  }

  getLoadedHistoryId() {
    return this._historyState.getLoadedId();
  }

  // ...
}
```

### 期待効果
- AppState: 413行 → 推定200行 (-52%)
- テスタビリティ向上
- 責務の明確化
- 設計スコア: +3点 (単一責任の原則 9→10)

### テスト
- `__tests__/ui-state.test.js` (10+ tests)
- `__tests__/history-state.test.js` (8+ tests)
- `__tests__/app-state.test.js` (既存テストを更新)

---

## Phase 5: パフォーマンス最適化の実装

### 優先度: 高
### 推定工数: 5日
### 目標: 初期ロード -25%, 計算処理 -60%, DB読み込み -50%

### 5.1: イベントハンドリング最適化

#### デバウンス拡大適用
```javascript
// input-handler.js (REFACTOR)
import { debounce } from './debounce.js';

// Before: 即座に計算
input.addEventListener('input', handleInput);

// After: 300ms後に計算
input.addEventListener('input', debounce(handleInput, 300));
```

**対象ファイル**:
- input-handler.js (4 listeners)
- firebase-ui.js (18 listeners)
- history-ui.js (27 listeners)
- multi-pattern-ui.js (25 listeners)

**期待効果**: CPU使用率 -40%

#### 5.2: DOM操作最適化

```javascript
// history-item-renderer.js (REFACTOR)
export function renderHistoryItems(items) {
  const fragment = document.createDocumentFragment();

  items.forEach(item => {
    const element = createHistoryItem(item);
    fragment.appendChild(element);
  });

  // 1回のDOM操作
  container.innerHTML = '';
  container.appendChild(fragment);
}
```

**期待効果**: レンダリング時間 -50%

#### 5.3: 計算結果のメモ化

```javascript
// yield-stats-calc.js (REFACTOR)
const calculationCache = new Map();

export function calculateStatistics(data, type) {
  const cacheKey = JSON.stringify({ data, type });

  if (calculationCache.has(cacheKey)) {
    logger.debug('キャッシュヒット', { type });
    return calculationCache.get(cacheKey);
  }

  const result = heavyCalculation(data, type);
  calculationCache.set(cacheKey, result);

  return result;
}
```

**期待効果**: 再計算時間 -90%

#### 5.4: Chart.js の遅延ロード

```javascript
// yield-stats-charts.js (REFACTOR)
let Chart = null;

export async function showChart(data, config) {
  if (!Chart) {
    // 初回のみロード
    const module = await import('chart.js/auto');
    Chart = module.default;
  }

  return new Chart(ctx, config);
}
```

**期待効果**: 初期バンドルサイズ -120KB

#### 5.5: IndexedDB バッチ処理

```javascript
// db.js (REFACTOR)
export async function batchPut(store, items) {
  const tx = this.db.transaction(store, 'readwrite');
  const objectStore = tx.objectStore(store);

  // 全てのputを1つのトランザクションで実行
  const promises = items.map(item => objectStore.put(item));

  await Promise.all(promises);
  await tx.done;

  logger.info(`バッチ保存完了: ${items.length}件`);
}
```

**期待効果**: 大量データ保存 -70%

### ベンチマーク目標

| 指標 | Before | Target | 改善率 |
|------|--------|--------|--------|
| 初期ロード | ~2s | <1.5s | -25% |
| 計算処理 | 100-500ms | <200ms | -60% |
| DB読み込み | 200-1000ms | <500ms | -50% |
| レンダリング | 100ms | <50ms | -50% |

### 測定ツール
- Lighthouse (Performance Score)
- Chrome DevTools Performance
- Web Vitals (LCP, FID, CLS)

---

## Phase 6: E2Eテスト基盤構築

### 優先度: 中
### 推定工数: 3日
### 目標: 主要ユーザーフローの自動テスト

### 6.1: ツール選定

**候補**:
1. **Playwright** (推奨)
   - クロスブラウザ対応（Chrome, Firefox, Safari）
   - 高速・安定
   - デバッグツールが優秀

2. Cypress
   - 開発者体験が良い
   - Chromeのみ対応

**推奨**: Playwright

### 6.2: セットアップ

```bash
npm install --save-dev @playwright/test

npx playwright install
```

```javascript
// playwright.config.js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8080',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } },
    { name: 'webkit', use: { browserName: 'webkit' } }
  ]
});
```

### 6.3: テストシナリオ

#### シナリオ1: 基本計算フロー
```javascript
// e2e/basic-calculation.test.js
import { test, expect } from '@playwright/test';

test('固定歩留まり計算ができる', async ({ page }) => {
  await page.goto('/');

  // 値を入力
  await page.fill('#before-cost', '1000');
  await page.fill('#yield-rate', '80');
  await page.fill('#markup', '40');

  // 計算ボタンクリック
  await page.click('#calculate-button');

  // 結果を検証
  await expect(page.locator('#after-cost')).toHaveText('1250');
  await expect(page.locator('#after-price')).toHaveText('2083.33');
});
```

#### シナリオ2: 履歴保存・読み込み
```javascript
test('計算結果を保存・読み込みできる', async ({ page }) => {
  // 計算実行
  await performCalculation(page);

  // 保存
  await page.click('#save-button');
  await page.fill('#product-name', 'テスト商品');
  await page.click('#save-confirm');

  // 保存成功を確認
  await expect(page.locator('.toast')).toHaveText('保存しました');

  // 履歴から読み込み
  await page.click('#history-button');
  await page.click('.history-item:first-child');

  // データが復元されていることを確認
  await expect(page.locator('#product-name')).toHaveValue('テスト商品');
});
```

#### シナリオ3: オフライン動作
```javascript
test('オフラインでも動作する', async ({ page, context }) => {
  await page.goto('/');

  // オフラインモードに
  await context.setOffline(true);

  // 計算実行（オフラインでも動く）
  await performCalculation(page);

  // 結果が表示される
  await expect(page.locator('#after-cost')).not.toBeEmpty();

  // オンラインに戻す
  await context.setOffline(false);
});
```

### 期待効果
- 主要フローの自動テスト
- リグレッション防止
- ブラウザ互換性の保証
- 設計スコア: +2点 (テスタビリティ 8→10)

---

## Phase 7: CI/CDパイプライン構築

### 優先度: 高
### 推定工数: 1日
### 目標: 全テスト・デプロイの自動化

### 7.1: GitHub Actions 設定

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  lint:
    name: ESLint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run lint

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage

      # カバレッジをCodecovにアップロード
      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npx playwright install --with-deps

      # Webサーバー起動
      - run: npm run serve &
      - run: npx wait-on http://localhost:8080

      # E2Eテスト実行
      - run: npx playwright test

      # 失敗時のスクリーンショット・動画をアップロード
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: playwright-results
          path: test-results/

  deploy:
    name: Deploy to Firebase
    needs: [lint, test, e2e]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run build

      # Firebase Hosting にデプロイ
      - uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT }}'
          channelId: live
```

### 7.2: PR 自動チェック

```yaml
# .github/workflows/pr-checks.yml
name: PR Checks

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  coverage-check:
    name: Coverage Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test:coverage

      # カバレッジコメントをPRに追加
      - uses: romeovs/lcov-reporter-action@v0.3.1
        with:
          lcov-file: ./coverage/lcov.info
          github-token: ${{ secrets.GITHUB_TOKEN }}

  size-check:
    name: Bundle Size Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: andresz1/size-limit-action@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
```

### 7.3: ステータスバッジ

```markdown
# README.md に追加

![CI Status](https://github.com/user/repo/workflows/CI/badge.svg)
![Coverage](https://codecov.io/gh/user/repo/branch/main/graph/badge.svg)
![License](https://img.shields.io/github/license/user/repo)
```

### 期待効果
- 全テスト自動実行
- カバレッジ自動測定＆レポート
- 自動デプロイ
- PR品質の自動チェック

---

## Phase 8: TypeScript 導入検討（長期計画）

### 優先度: 低
### 推定工数: 10日
### 目標: 型安全性の向上

### 背景
現在のJavaScriptコードは実行時エラーのリスクがある：
```javascript
// 型エラーが実行時まで分からない
function calculatePrice(cost, yieldRate, markup) {
  return (cost / yieldRate) / (1 - markup);  // yieldRateが0だとInfinity
}

calculatePrice('1000', null, undefined);  // 実行時エラー
```

### 段階的導入

#### Step 1: JSDoc型アノテーション
```javascript
/**
 * @param {number} cost
 * @param {number} yieldRate - 0より大きい値
 * @param {number} markup - 0-1の範囲
 * @returns {number}
 */
function calculatePrice(cost, yieldRate, markup) {
  // ...
}
```

#### Step 2: TypeScript設定（allowJs: true）
```json
// tsconfig.json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": true,
    "noEmit": true,
    "strict": false
  }
}
```

#### Step 3: ファイルごとに.ts化
```typescript
// state.ts (MIGRATED)
interface CalculationSnapshot {
  afterCost: number | null;
  afterPrice: number | null;
  beforeMarkup: number | null;
  // ...
}

class AppState {
  mode: MODE;
  currentStep: 1 | 2 | 3;
  snapshot: CalculationSnapshot;
  // ...
}
```

### 期待効果
- コンパイル時の型エラー検出
- IDEの補完強化
- リファクタリングの安全性向上
- 設計スコア: +5点（依存性逆転の原則、インターフェース分離）

---

## 設計スコア改善予測

### 現在（Phase 3完了後）: 84/150

| 原則 | 現在 | Phase 4 | Phase 5 | Phase 6 | Phase 7 | Phase 8 | 最終目標 |
|------|------|---------|---------|---------|---------|---------|----------|
| 1. 単一情報源 | 10 | 10 | 10 | 10 | 10 | 10 | 10 |
| 2. 関心の分離 | 9 | 10 | 10 | 10 | 10 | 10 | 10 |
| 3. DRY原則 | 9 | 9 | 9 | 9 | 9 | 9 | 9 |
| 4. 疎結合 | 9 | 10 | 10 | 10 | 10 | 10 | 10 |
| 5. 高凝集性 | 9 | 10 | 10 | 10 | 10 | 10 | 10 |
| 6. 単一責任 | 9 | 10 | 10 | 10 | 10 | 10 | 10 |
| 7. IF分離 | 7 | 7 | 7 | 7 | 7 | 9 | 9 |
| 8. 依存性逆転 | 6 | 6 | 6 | 6 | 6 | 8 | 8 |
| 9. 可読性 | 8 | 9 | 9 | 9 | 9 | 10 | 10 |
| 10. テスタビリティ | 8 | 8 | 9 | 10 | 10 | 10 | 10 |
| **合計** | **84** | **89** | **90** | **91** | **91** | **96** | **96** |
| **進捗** | 56% | 59% | 60% | 61% | 61% | 64% | 64% |

### マイルストーン

- **Phase 3 完了**: 84/150 (56%) ✅ 達成済み
- **Phase 4 完了**: 89/150 (59%)
- **Phase 5 完了**: 90/150 (60%)
- **Phase 6 完了**: 91/150 (61%)
- **Phase 7 完了**: 91/150 (61%)
- **Phase 8 完了**: 96/150 (64%)

---

## 実施スケジュール（推奨）

### 短期（1ヶ月）
- Week 1: **Phase 7** CI/CD構築（最優先）
- Week 2-3: **Phase 5** パフォーマンス最適化
- Week 4: **Phase 4** State分離

### 中期（3ヶ月）
- Month 2: **Phase 6** E2Eテスト
- Month 3: パフォーマンス測定＆改善

### 長期（6ヶ月）
- Month 4-6: **Phase 8** TypeScript導入検討

---

## まとめ

### 優先順位
1. 🔥 **Phase 7**: CI/CD（最優先・1日）
2. 🔥 **Phase 5**: パフォーマンス（高優先・5日）
3. ⚡ **Phase 4**: State分離（中優先・3日）
4. ⚡ **Phase 6**: E2E（中優先・3日）
5. 💡 **Phase 8**: TypeScript（低優先・10日）

### 総工数
- 短期（必須）: 9日
- 中期（推奨）: +3日
- 長期（検討）: +10日
- **合計**: 22日

### 期待ROI
- **設計スコア**: 84 → 96 (+14%)
- **パフォーマンス**: 25-60% 改善
- **テスト自動化**: 100%
- **開発効率**: +30%
- **バグ検出率**: +50%

**次回レビュー推奨日**: Phase 4開始前（2025-12-01）

---

**作成日**: 2025-11-05
**作成者**: Claude (AI Assistant)
