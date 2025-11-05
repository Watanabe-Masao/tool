# パフォーマンス最適化ガイドライン

## 現状分析

### イベントリスナー
- **総数**: 190個のイベントリスナー（20ファイル）
- **デバウンス使用**: 2ファイルのみ（event-handlers-setup.js, multi-pattern-ui.js）
- **最適化の余地**: 高頻度イベント（input, scroll, resize）にデバウンス/スロットル適用

### コードカバレッジ
- **logger.js**: 100%
- **yield-stats-state.js**: 94.91%
- **state.js**: 80.2%
- **全体**: 2.18%（多くのファイルが未テスト）

### バンドルサイズ
- **依存関係**: Firebase SDK, Chart.js など
- **最適化**: Tree-shaking, 遅延ロード未実装

## 最適化機会

### 1. イベントハンドリング最適化

#### 高優先度
```javascript
// ❌ 最適化前
input.addEventListener('input', (e) => {
  calculateResult(e.target.value);  // 入力毎に計算
});

// ✅ 最適化後
import { debounce } from './debounce.js';

input.addEventListener('input', debounce((e) => {
  calculateResult(e.target.value);  // 300ms後に1回だけ計算
}, 300));
```

#### 対象ファイル
- `input-handler.js` (4 listeners)
- `firebase-ui.js` (18 listeners)
- `history-ui.js` (27 listeners)
- `multi-pattern-ui.js` (25 listeners)

### 2. DOM操作の最適化

#### Document Fragment の活用
```javascript
// ❌ 最適化前
items.forEach(item => {
  container.appendChild(createItemElement(item));  // 毎回リフロー
});

// ✅ 最適化後
const fragment = document.createDocumentFragment();
items.forEach(item => {
  fragment.appendChild(createItemElement(item));
});
container.appendChild(fragment);  // 1回のリフロー
```

#### 対象ファイル
- `history-item-renderer.js`
- `multi-pattern-ui.js`
- `yield-stats-table.js`

### 3. メモ化の導入

#### 計算結果のキャッシュ
```javascript
// ❌ 最適化前
function calculateStatistics(data) {
  // 毎回同じデータで再計算
  return heavyCalculation(data);
}

// ✅ 最適化後
const cache = new Map();

function calculateStatistics(data) {
  const key = JSON.stringify(data);
  if (cache.has(key)) {
    return cache.get(key);
  }

  const result = heavyCalculation(data);
  cache.set(key, result);
  return result;
}
```

#### 対象ファイル
- `yield-stats-calc.js`
- `sample-size-validator.js`
- `stats-ui-helpers.js`

### 4. 遅延ロード (Lazy Loading)

#### 動的インポート
```javascript
// ❌ 最適化前
import Chart from 'chart.js/auto';  // 初期ロード時に全てロード

// ✅ 最適化後
async function showChart(data) {
  const Chart = await import('chart.js/auto');  // 必要な時だけロード
  return new Chart(ctx, config);
}
```

#### 対象ファイル
- `yield-stats-charts.js` (Chart.js)
- `firebase-auth.js` (Firebase Auth)
- `multi-pattern-presets.js` (プリセット機能)

### 5. Service Worker の活用

#### キャッシュ戦略
- **Static Assets**: Cache First
- **API Requests**: Network First with Cache Fallback
- **Images**: Stale While Revalidate

現状: `sw.js` が存在するが、最適化の余地あり

### 6. IndexedDB操作の最適化

#### バッチ処理
```javascript
// ❌ 最適化前
for (const item of items) {
  await db.put('store', item);  // 1件ずつトランザクション
}

// ✅ 最適化後
const tx = db.transaction('store', 'readwrite');
items.forEach(item => tx.objectStore('store').put(item));
await tx.done;  // 1回のトランザクション
```

#### 対象ファイル
- `db.js` (1227 lines - 最適化の余地大)
- `firebase-sync.js` (1382 lines)

## パフォーマンス測定

### 推奨ツール
1. **Lighthouse**: PWAスコア、パフォーマンススコア
2. **Chrome DevTools Performance**: ボトルネック特定
3. **Bundle Analyzer**: バンドルサイズ分析
4. **Web Vitals**: LCP, FID, CLS測定

### 測定指標
```javascript
// Performance API の活用
performance.mark('calc-start');
calculateStatistics(data);
performance.mark('calc-end');

performance.measure('calculation', 'calc-start', 'calc-end');
const measure = performance.getEntriesByName('calculation')[0];
logger.debug(`計算時間: ${measure.duration}ms`);
```

## 実装優先度

### 高優先度 (即時実施)
1. ✅ デバウンス/スロットルの拡大適用
2. ✅ DOM操作のDocument Fragment化
3. ✅ イベントリスナーのメモリリーク対策

### 中優先度 (次回スプリント)
1. ⬜ 計算結果のメモ化
2. ⬜ Service Worker キャッシュ戦略の最適化
3. ⬜ IndexedDB バッチ処理の導入

### 低優先度 (長期計画)
1. ⬜ Chart.js の動的インポート
2. ⬜ Firebase SDK の Tree-shaking
3. ⬜ Code Splitting の導入

## ベンチマーク目標

### 現状（推定）
- **初期ロード**: ~2s
- **計算処理**: 100-500ms
- **DB読み込み**: 200-1000ms

### 目標
- **初期ロード**: <1.5s (25%改善)
- **計算処理**: <200ms (60%改善)
- **DB読み込み**: <500ms (50%改善)

## 注意事項

### 早すぎる最適化を避ける
- パフォーマンス測定前に最適化しない
- ボトルネックを特定してから対策
- 可読性を犠牲にしない

### ユーザー体験優先
- 体感速度 > 実測速度
- ローディング表示の追加
- プログレッシブエンハンスメント

### メンテナンス性
- 最適化コードにはコメント必須
- テストカバレッジを維持
- ドキュメント更新

## 参考リソース

- [Web.dev Performance](https://web.dev/performance/)
- [MDN Performance API](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [JavaScript Performance Best Practices](https://developer.mozilla.org/en-US/docs/Learn/Performance/JavaScript)
