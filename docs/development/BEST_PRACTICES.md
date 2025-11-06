# ベストプラクティス

**対象**: 本プロジェクトの開発者・コントリビューター
**最終更新**: 2025-11-05

---

## 目次
1. [コーディング規約](#コーディング規約)
2. [Git運用](#git運用)
3. [テスト戦略](#テスト戦略)
4. [パフォーマンス](#パフォーマンス)
5. [セキュリティ](#セキュリティ)
6. [ドキュメント](#ドキュメント)

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

var yieldRate = data.yieldRate;
var beforeWeight = data.beforeWeight;

var items = existingItems.concat([newItem]);
```

#### const/let の使用
```javascript
// ✅ Good
const MAX_RETRIES = 3;
let currentAttempt = 0;

// ❌ Bad
var MAX_RETRIES = 3;
var currentAttempt = 0;
```

#### 厳密等価演算子
```javascript
// ✅ Good
if (value === null) { /* ... */ }
if (count === 0) { /* ... */ }

// ❌ Bad
if (value == null) { /* ... */ }
if (count == 0) { /* ... */ }
```

#### テンプレート文字列
```javascript
// ✅ Good
logger.info(`処理完了: ${count}件`);

// ❌ Bad
logger.info('処理完了: ' + count + '件');
```

#### オブジェクトショートハンド
```javascript
// ✅ Good
const user = { name, age, email };

const methods = {
  save() { /* ... */ },
  load() { /* ... */ }
};

// ❌ Bad
const user = { name: name, age: age, email: email };

const methods = {
  save: function() { /* ... */ },
  load: function() { /* ... */ }
};
```

### モジュール設計

#### 単一責任の原則
```javascript
// ✅ Good: 各モジュールが1つの責務
// logger.js - ログ出力のみ
// db.js - IndexedDB操作のみ
// firebase-sync.js - Firestore同期のみ

// ❌ Bad: 複数の責務が混在
// util.js - ログ、DB、同期が全て入っている
```

#### 適切なファイルサイズ
- **推奨**: 300行以下
- **警告**: 500行以上
- **リファクタリング必須**: 1000行以上

```javascript
// 大きなファイルは分割
// Before: state.js (506 lines)
// After:
//   - state.js (413 lines)
//   - yield-stats-state.js (340 lines)
```

#### エクスポート
```javascript
// ✅ Good: 名前付きエクスポート（推奨）
export const logger = new Logger();
export { LOG_LEVELS };

// ✅ Good: デフォルトエクスポート（1つのクラスのみ）
export default class AppState { /* ... */ }

// ❌ Bad: 混在は避ける
export default logger;
export { LOG_LEVELS };  // デフォルト+名前付きは混乱を招く
```

### ロギング

#### ログレベルの使い分け
```javascript
// ✅ Good
logger.error('データベース接続エラー', error);  // システムエラー
logger.warn('キャッシュ削除に失敗（続行）', error);  // 警告
logger.info('データ保存完了', { id: 123 });  // 重要な情報
logger.debug('計算中間結果', { step: 2, value: 100 });  // デバッグ情報

// ❌ Bad
console.log('データベース接続エラー', error);  // console.* 禁止
logger.info('計算中間結果', { step: 2, value: 100 });  // info は多すぎる
```

#### グループログ
```javascript
// ✅ Good: 関連ログをグループ化
logger.group('データ同期開始');
logger.debug('ローカルデータ取得');
logger.debug('Firestore接続');
logger.debug('差分計算');
logger.groupEnd();

// ❌ Bad: バラバラに出力
logger.debug('データ同期: ローカルデータ取得');
logger.debug('データ同期: Firestore接続');
logger.debug('データ同期: 差分計算');
```

#### パフォーマンス測定
```javascript
// ✅ Good
logger.time('統計計算');
const stats = calculateStatistics(data);
logger.timeEnd('統計計算');  // "統計計算: 123.45ms" と出力

// ❌ Bad
const start = Date.now();
const stats = calculateStatistics(data);
logger.debug(`計算時間: ${Date.now() - start}ms`);
```

### エラーハンドリング

#### カスタムエラーの使用
```javascript
// ✅ Good
throw new ValidationError('Invalid yield rate', { value: -10 });
throw new NotFoundError('Record', id);
throw new OfflineError('save');

// ❌ Bad
throw 'Invalid yield rate';  // 文字列を投げない
throw { error: 'not found' };  // オブジェクトを投げない
```

#### try-catch の粒度
```javascript
// ✅ Good: 適切な粒度
try {
  const data = await db.get(id);
  return processData(data);
} catch (error) {
  logger.error('データ取得エラー', error);
  throw new IndexedDBError('Failed to get data', error);
}

// ❌ Bad: 粒度が粗すぎる
try {
  const data = await db.get(id);
  const processed = processData(data);
  await db.save(processed);
  await firebaseSync.upload(processed);
  return processed;
} catch (error) {
  // どこでエラーが発生したか分からない
  logger.error('エラー', error);
}
```

### パフォーマンス

#### デバウンス/スロットル
```javascript
// ✅ Good: 高頻度イベントにデバウンス
import { debounce } from './debounce.js';

input.addEventListener('input', debounce((e) => {
  calculateResult(e.target.value);
}, 300));

// ❌ Bad: 毎回実行
input.addEventListener('input', (e) => {
  calculateResult(e.target.value);  // 入力毎に計算
});
```

#### Document Fragment
```javascript
// ✅ Good: 1回のDOM操作
const fragment = document.createDocumentFragment();
items.forEach(item => {
  fragment.appendChild(createItemElement(item));
});
container.appendChild(fragment);

// ❌ Bad: N回のDOM操作（リフロー）
items.forEach(item => {
  container.appendChild(createItemElement(item));
});
```

---

## Git運用

### コミットメッセージ

#### Conventional Commits 形式
```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type（必須）
- `feat`: 新機能
- `fix`: バグ修正
- `refactor`: リファクタリング
- `test`: テスト追加・修正
- `docs`: ドキュメント更新
- `style`: フォーマット変更（コード動作に影響なし）
- `perf`: パフォーマンス改善
- `chore`: ビルド・設定変更

#### 例
```
feat(logger): Add unified logger for Phase 1.2

- Create logger.js with environment-aware log levels
- Replace 406 console.* calls with logger methods
- Add ESLint rule to prevent console.* usage

Closes #123
```

```
fix: Resolve infinite recursion in logger methods

Critical bug fix:
- error() now calls console.error instead of logger.error
- warn() now calls console.warn instead of logger.warn
- debug() now calls console.log instead of logger.debug

Fixes: RangeError: Maximum call stack size exceeded
```

### ブランチ戦略

#### ブランチ命名
```
<type>/<short-description>

例:
feature/add-export-csv
fix/logger-infinite-recursion
refactor/extract-yield-stats-state
docs/update-architecture
```

#### 作業フロー
1. `main` から新ブランチを作成
2. 変更を実装＆コミット
3. テストを実行して確認
4. Pull Request 作成
5. レビュー＆マージ

### コミット粒度

#### ✅ Good: 適切な粒度
```
commit 1: feat(logger): Create logger.js core module
commit 2: feat(logger): Replace console.* in db.js
commit 3: feat(logger): Add ESLint rule for console.*
commit 4: test: Add logger unit tests
```

#### ❌ Bad: 粗すぎる
```
commit 1: Add logger feature (全ての変更を1コミット)
```

#### ❌ Bad: 細かすぎる
```
commit 1: Add LOG_LEVELS constant
commit 2: Add Logger class
commit 3: Add error method
commit 4: Add warn method
commit 5: Add info method
...
```

---

## テスト戦略

### テストピラミッド
```
     /\
    /  \ E2E Tests (少ない)
   /────\
  /      \ Integration Tests (中程度)
 /────────\
/          \ Unit Tests (多い)
```

### ユニットテスト

#### テストファイル命名
```
対象ファイル: scripts/core/logger.js
テストファイル: __tests__/logger.test.js
```

#### テスト構造
```javascript
describe('Logger', () => {
  describe('error()', () => {
    it('ERROR レベルで console.error を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      logger.error('エラーメッセージ');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    it('NONE レベルでは出力されない', () => {
      logger.setLevel(LOG_LEVELS.NONE);
      logger.error('エラーメッセージ');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
```

#### テストのベストプラクティス
```javascript
// ✅ Good: AAA パターン（Arrange, Act, Assert）
it('生データを設定・取得できる', () => {
  // Arrange
  const data = { yieldRate: [80, 85, 90] };

  // Act
  state.setRawData(data);

  // Assert
  expect(state.getRawData()).toEqual(data);
});

// ✅ Good: 1テストケース = 1つの検証
it('無効な値の場合、isValid()がfalseを返す', () => {
  state.snapshot.update({ ac: NaN, ap: 150 });
  expect(state.snapshot.isValid()).toBe(false);
});

// ❌ Bad: 複数の検証を1つのテストに詰め込む
it('スナップショットのテスト', () => {
  state.snapshot.update({ ac: 100, ap: 150 });
  expect(state.snapshot.isValid()).toBe(true);

  state.snapshot.reset();
  expect(state.snapshot.isValid()).toBe(false);

  state.snapshot.update({ ac: NaN, ap: 150 });
  expect(state.snapshot.isValid()).toBe(false);
});
```

### カバレッジ目標

| モジュールタイプ | Statements | Branches | Functions |
|------------------|------------|----------|-----------|
| Core (logger等) | 95%+ | 80%+ | 100% |
| State管理 | 90%+ | 70%+ | 90%+ |
| UI | 70%+ | 60%+ | 70%+ |
| Utils | 80%+ | 70%+ | 80%+ |

---

## パフォーマンス

詳細は [PERFORMANCE.md](./PERFORMANCE.md) を参照

### チェックリスト
- [ ] 高頻度イベントにデバウンス/スロットル適用
- [ ] Document Fragment でDOM操作を最適化
- [ ] 計算結果のメモ化
- [ ] 画像の遅延ロード
- [ ] Service Worker でキャッシング
- [ ] IndexedDB のバッチ処理

---

## セキュリティ

### APIキー管理
```javascript
// ✅ Good: 環境変数
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  // ...
};

// ❌ Bad: ハードコード
const firebaseConfig = {
  apiKey: "AIza...",  // 危険！
  // ...
};
```

### 入力バリデーション
```javascript
// ✅ Good: すべての入力を検証
function validateYieldRate(value) {
  if (typeof value !== 'number') {
    throw new ValidationError('Yield rate must be a number');
  }
  if (value < 0 || value > 100) {
    throw new ValidationError('Yield rate must be between 0 and 100');
  }
  return true;
}

// ❌ Bad: 検証なし
function calculateYield(rate) {
  return cost / (1 - rate / 100);  // rate が不正値でもチェックしない
}
```

### XSS対策
```javascript
// ✅ Good: textContent を使用
element.textContent = userInput;

// ⚠️ 注意: innerHTML は信頼できるデータのみ
element.innerHTML = sanitize(userInput);  // DOMPurify等でサニタイズ

// ❌ Bad: 未検証のHTMLを挿入
element.innerHTML = userInput;  // XSS脆弱性！
```

---

## ドキュメント

### コードコメント

#### JSDoc
```javascript
/**
 * 歩留まり率から販売価格を計算
 * @param {number} cost - 原価
 * @param {number} yieldRate - 歩留まり率（%）
 * @param {number} markup - 利益率
 * @returns {number} 販売価格
 * @throws {ValidationError} パラメータが不正な場合
 */
function calculatePrice(cost, yieldRate, markup) {
  validateInput({ cost, yieldRate, markup });
  return (cost / (yieldRate / 100)) / (1 - markup);
}
```

#### インラインコメント
```javascript
// ✅ Good: 「なぜ」を説明
// Firestore削除を先に実行することで、真実の源泉をクリーン化
await deleteFromCloud(id);

// ローカル削除が失敗しても、次回同期で整合性が回復する
try {
  await db.delete(id);
} catch (error) {
  logger.warn('ローカル削除失敗（続行）', error);
}

// ❌ Bad: 「何を」説明（コードを読めば分かる）
// Firestoreから削除
await deleteFromCloud(id);

// エラーをキャッチ
try {
  await db.delete(id);
} catch (error) {
  logger.warn('エラー', error);
}
```

### README / ドキュメント

#### 必須セクション
1. **概要**: プロジェクトの目的
2. **セットアップ**: インストール手順
3. **使い方**: 基本的な使用方法
4. **アーキテクチャ**: システム構成
5. **開発**: 開発環境のセットアップ
6. **テスト**: テスト実行方法
7. **デプロイ**: デプロイ手順

---

## チェックリスト

### Pull Request 前
- [ ] コードがESLintをパスする (`npm run lint`)
- [ ] すべてのテストがパスする (`npm test`)
- [ ] カバレッジが基準を満たす (`npm run test:coverage`)
- [ ] コミットメッセージがConventional Commits形式
- [ ] 新機能にはテストを追加
- [ ] ドキュメントを更新（必要な場合）

### リリース前
- [ ] 全E2Eテストをパス
- [ ] パフォーマンス測定を実施
- [ ] セキュリティスキャン実施
- [ ] CHANGELOG.md 更新
- [ ] バージョン番号更新（SemVer）

---

## 参考資料

- [JavaScript Style Guide - Airbnb](https://github.com/airbnb/javascript)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Jest Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Web.dev - Performance](https://web.dev/performance/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

**最終更新**: 2025-11-05
**次回レビュー**: 2025-12-01
