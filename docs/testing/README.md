# テストガイド 🧪

歩留まり計算ツールのテスト戦略と実行方法

---

## 📊 現在のテスト状況

```
Test Suites: 22 passed, 22 total
Tests:       711 passed, 7 skipped, 718 total
Time:        6.353 s
```

### カバレッジ

詳細は [COVERAGE.md](./COVERAGE.md) を参照

---

## 🚀 テストの実行

### すべてのテストを実行

```bash
npm test
```

### 特定のテストファイルを実行

```bash
npx jest __tests__/calculation.test.js
```

### ウォッチモードで実行

```bash
npx jest --watch
```

---

## 📚 詳細ドキュメント

- [TESTING.md](./TESTING.md) - テスト戦略の詳細
- [COVERAGE.md](./COVERAGE.md) - カバレッジ情報

---

**最終更新**: 2025-11-06
