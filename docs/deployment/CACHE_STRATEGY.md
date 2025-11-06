# キャッシュ戦略とデータ整合性設計

## 📋 目次

1. [概要](#概要)
2. [3層キャッシュアーキテクチャ](#3層キャッシュアーキテクチャ)
3. [操作別戦略マトリクス](#操作別戦略マトリクス)
4. [コストバランスの設計指針](#コストバランスの設計指針)
5. [トラブルシューティング](#トラブルシューティング)

---

## 概要

このアプリケーションは**オフライン対応**と**データ整合性**を両立するため、3層のキャッシュ戦略を採用しています。

### キャッシュの種類

1. **Service Workerキャッシュ** (静的アセット: JS, CSS, HTML)
2. **IndexedDBキャッシュ** (ユーザーデータのローカルコピー)
3. **Firestoreキャッシュ** (クラウドデータベース)

---

## 3層キャッシュアーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: Service Worker (静的アセット)                  │
│  戦略: Network First (常に最新を取得、オフライン時のみキャッシュ)│
│  更新: 自動検出 + ユーザー通知                             │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 2: IndexedDB (ローカルデータ)                      │
│  戦略: Cache-First + Background Sync                     │
│  更新: Firestoreと双方向同期                              │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Firestore (クラウドデータベース)                  │
│  戦略: Source of Truth（真実の情報源）                     │
│  更新: リアルタイム同期                                    │
└─────────────────────────────────────────────────────────┘
```

---

## 操作別戦略マトリクス

### 🎯 推奨戦略

| 操作 | キャッシュ戦略 | 整合性 | パフォーマンス | コスト | 実装 |
|------|--------------|--------|--------------|--------|------|
| **読み込み（表示のみ）** | Cache-First + Background Sync | 中 | ⚡⚡⚡ 高速 | 💰 低 | `getHistory()` |
| **編集・削除** | Pessimistic Update | 高 | ⚡⚡ 普通 | 💰💰 中 | `updateCalculationName()` |
| **新規作成** | Optimistic Update | 高 | ⚡⚡⚡ 高速 | 💰 低 | `saveCalculation()` |
| **モーダル表示** | Sync-then-Display | 高 | ⚡ 遅い | 💰💰💰 高 | `showHistoryModal()` |

### 📝 戦略の詳細

#### 1. **Cache-First + Background Sync** (読み込み)

**使用場所:** ページロード時、履歴一覧の表示

**動作:**
1. IndexedDBから即座にデータを読み込んで表示
2. バックグラウンドでFirestoreと同期
3. 差分があれば自動更新

**メリット:**
- ⚡ 高速な初期表示
- 🌐 オフライン対応
- 💰 ネットワークコストが低い

**デメリット:**
- 🕐 最新データが表示されるまでにラグがある（通常1-2秒）

**実装例:**
```javascript
// 1. IndexedDBから即座に表示
const cachedHistory = await getHistory();
renderHistoryList(cachedHistory);

// 2. バックグラウンドでFirestoreと同期（非同期）
syncWithFirestore().then(updatedHistory => {
  if (hasChanges(cachedHistory, updatedHistory)) {
    renderHistoryList(updatedHistory);
  }
});
```

---

#### 2. **Pessimistic Update** (編集・削除)

**使用場所:** 商品名編集、履歴削除

**動作:**
1. ローカルとFirestoreの両方を更新
2. 更新完了後にUIを更新
3. 失敗時はロールバック

**メリット:**
- ✅ 高い整合性
- 🔒 データ不整合のリスクが低い
- 🎯 確実な更新

**デメリット:**
- 🐌 ネットワーク待ち時間がある
- 📶 オフライン時は操作不可

**実装例:**
```javascript
async function updateCalculationName(id, newName) {
  try {
    // 1. Firestoreを更新
    await updateInCloud(id, { name: newName });

    // 2. IndexedDBキャッシュを更新
    await db.update(id, { name: newName });

    // 3. UIを更新
    await renderHistoryList();

    showToast('更新しました', 'success');
  } catch (error) {
    // ロールバック不要（更新失敗）
    showToast('更新に失敗しました', 'error');
  }
}
```

**現在の実装:** `scripts/storage.js` の `updateCalculationName()`

---

#### 3. **Optimistic Update** (新規作成)

**使用場所:** 新しい計算の保存

**動作:**
1. IndexedDBに即座に保存してUIを更新
2. バックグラウンドでFirestoreに同期
3. 失敗時は再試行（自動同期）

**メリット:**
- ⚡⚡⚡ 非常に高速
- 🌐 オフライン対応
- 🎯 ユーザー体験が良い

**デメリット:**
- 🕐 Firestore同期失敗時にデバイス間で不整合の可能性

**実装例:**
```javascript
async function saveCalculation(data) {
  // 1. IndexedDBに即座に保存
  const id = await db.add(data);

  // 2. UIを即座に更新
  showToast('保存しました', 'success');

  // 3. バックグラウンドでFirestoreに同期（非同期）
  syncToFirestore(id, data).catch(error => {
    console.warn('Firestoreへの同期は後で再試行します', error);
    // 自動同期で後で再試行される
  });
}
```

**現在の実装:** `scripts/storage.js` の `saveCalculation()`（双方向同期で自動アップロード）

---

#### 4. **Sync-then-Display** (モーダル表示)

**使用場所:** 履歴モーダルを開く時

**動作:**
1. Firestoreから最新データを取得
2. IndexedDBを更新
3. UIを表示

**メリット:**
- ✅ 最も高い整合性
- 🎯 他のデバイスでの変更を確実に反映
- 🔒 データ不整合のリスクがほぼゼロ

**デメリット:**
- 🐌 表示までに時間がかかる（1-3秒）
- 📶 オンライン必須
- 💰💰💰 ネットワークコストが高い

**実装例:**
```javascript
async function showHistoryModal() {
  // ローディング表示
  showLoadingOverlay('最新データを取得中...');

  try {
    // 1. Firestoreと同期
    await ensureFreshDataBeforeDisplay();

    // 2. IndexedDBから取得（既に最新）
    const history = await getHistory();

    // 3. UIを表示
    renderHistoryList(history);
  } finally {
    hideLoadingOverlay();
  }
}
```

**現在の実装:** `scripts/history-ui.js` の `showHistoryModal()`

---

## コストバランスの設計指針

### 💰 コスト要因

1. **ネットワークコスト** - Firestore読み取り/書き込み回数
2. **レイテンシコスト** - ユーザー待ち時間
3. **整合性コスト** - データ不整合のリスク
4. **開発コスト** - 実装の複雑さ

### 🎯 推奨バランス

#### 低頻度・重要度高（編集・削除）
- **戦略:** Pessimistic Update
- **理由:** データ不整合のリスクを避けるべき
- **トレードオフ:** 少し遅くても確実性を優先

#### 高頻度・重要度中（読み込み）
- **戦略:** Cache-First + Background Sync
- **理由:** 高速な体験が重要
- **トレードオフ:** 1-2秒のラグは許容

#### 高頻度・重要度高（新規作成）
- **戦略:** Optimistic Update
- **理由:** 保存の即応性が重要
- **トレードオフ:** 自動同期で整合性を担保

#### 低頻度・整合性最重要（モーダル表示）
- **戦略:** Sync-then-Display
- **理由:** 他デバイスでの変更を確実に反映
- **トレードオフ:** 待ち時間は許容（1回のみ）

---

## トラブルシューティング

### 問題1: 編集後にUIが更新されない

**原因:** Service Workerが古いJSファイルをキャッシュしている

**解決策:**
```javascript
// ブラウザコンソールで実行
await window.swDebug.unregister();
await window.swDebug.clearCaches();
location.reload();
```

または、開発者ツール：
1. F12 → Application → Service Workers → Unregister
2. Application → Storage → Clear site data
3. ページをリロード

---

### 問題2: データが古いまま表示される

**原因:** IndexedDBとFirestoreが同期していない

**解決策:**
```javascript
// ブラウザコンソールで実行
await window.debugIndexedDB.showAll();  // 現在のデータを確認
```

または、手動で再同期：
1. 履歴モーダルを開く（自動的にFirestoreと同期）
2. ページをリロード

---

### 問題3: Service Workerの新バージョンが適用されない

**原因:** ブラウザが古いService Workerを使い続けている

**解決策:**

**自動的に適用される場合:**
- アプリが「新しいバージョンが利用可能です」と通知
- 「今すぐ更新」ボタンをクリック

**手動で適用する場合:**
1. すべてのタブを閉じる
2. ブラウザを再起動
3. アプリを再度開く

**開発者向け:**
```javascript
// Service Workerを強制的にスキップして即座にアクティブ化
navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
```

---

## 開発者向けデバッグツール

### Service Workerデバッグ

```javascript
// Service Workerをアンインストール
await window.swDebug.unregister();

// すべてのキャッシュをクリア
await window.swDebug.clearCaches();

// Service Workerのバージョンを確認
const sw = await navigator.serviceWorker.ready;
const mc = new MessageChannel();
mc.port1.onmessage = (event) => {
  console.log('Service Worker version:', event.data);
};
sw.active.postMessage({ type: 'GET_VERSION' }, [mc.port2]);
```

### IndexedDBデバッグ

```javascript
// データベース状態を表示
window.debugIndexedDB.getStatus();

// 全データを表示
window.debugIndexedDB.showAll();

// トランザクションログを表示
window.debugIndexedDB.getTransactionLog();
```

---

## まとめ

### ✅ ベストプラクティス

1. **読み込みは高速に** - Cache-First + Background Sync
2. **編集は確実に** - Pessimistic Update
3. **新規作成は即座に** - Optimistic Update
4. **モーダル表示は最新データ** - Sync-then-Display

### 🎯 トレードオフの判断基準

- **整合性 > 速度** → Pessimistic Update
- **速度 > 整合性** → Optimistic Update
- **バランス** → Cache-First + Background Sync

### 🔧 メンテナンス

- Service Workerのバージョンを定期的に更新
- Firestoreの読み取り/書き込み回数を監視
- ユーザーフィードバックを収集して戦略を調整
