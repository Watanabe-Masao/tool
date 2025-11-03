# データクリーンアップガイド

すべてのデータ（Firestore + IndexedDB + LocalStorage）を削除する方法を説明します。

---

## ⚠️ 重要な注意事項

**この操作は取り消せません！**

削除されるデータ:
- ☁️ **Firestore（クラウド）**: すべての計算履歴
- 💾 **IndexedDB（端末）**: ローカルキャッシュ
- 🔧 **LocalStorage**: 最終同期時刻などの設定

---

## 方法1: GUIから削除（推奨）

### 手順

1. ブラウザで `cleanup.html` を開く
   ```
   file:///path/to/tool/cleanup.html
   ```

2. ログイン状態とデータ件数を確認

3. **「🗑️ すべて削除」** ボタンをクリック

4. 確認ダイアログで「OK」をクリック

5. ログに削除状況が表示される

6. 完了したら「🔄 状態を確認」で結果を確認

### スクリーンショット

```
┌─────────────────────────────────────┐
│  🗑️ データクリーンアップ            │
├─────────────────────────────────────┤
│  ⚠️ 警告                             │
│  以下のデータがすべて削除されます:   │
│  - Firestore（クラウド）             │
│  - IndexedDB（端末）                 │
│  - LocalStorage                      │
├─────────────────────────────────────┤
│  ログイン状態: ログイン中            │
│  Firestore件数: 25 件                │
│  IndexedDB件数: 25 件                │
├─────────────────────────────────────┤
│  [🔄 状態を確認]  [♻️ リロード]      │
│  [🗑️ すべて削除]                     │
└─────────────────────────────────────┘
```

---

## 方法2: ブラウザコンソールから削除

### 手順

1. `index.html` を開く

2. ブラウザの開発者ツールを開く
   - **Windows/Linux**: `F12` または `Ctrl + Shift + I`
   - **Mac**: `Cmd + Option + I`

3. 「コンソール」タブをクリック

4. 以下のスクリプトをコピー＆ペースト:

```html
<script type="module" src="./scripts/cleanup-console.js"></script>
```

または、`index.html`の`<head>`内に上記を追加してリロード

5. コンソールに以下のコマンドを入力:

```javascript
// すべて削除
await cleanupAll()
```

### その他の便利なコマンド

```javascript
// 状態確認
await checkDataStatus()

// IndexedDBのみ削除
await cleanupIndexedDB()

// Firestoreのみ削除
await cleanupFirestore()

// LocalStorageのみ削除
cleanupLocalStorage()
```

### 実行例

```
> await checkDataStatus()

📊 データ状態を確認中...
──────────────────────────────────────────────────
✅ ログイン状態: ログイン中
   ユーザー: test@example.com
   UID: abc123...
📦 IndexedDB: 25 件
   最初の3件: [{id: 1, name: "テスト", uuid: "..."}]
☁️ Firestore: 25 件
   最初の3件: [{id: "uuid-1", name: "テスト", uuid: "..."}]
💾 LocalStorage: 3 件
   キー: ["deviceId", "yield-calculator-last-sync-time", ...]
──────────────────────────────────────────────────
✅ 状態確認完了

> await cleanupAll()

⚠️ すべてのデータを削除します...
[確認ダイアログ] OK をクリック
🗑️ Firestore & IndexedDB を削除中...
✅ Firestore & IndexedDB 削除完了
🗑️ LocalStorage を削除中...
✅ LocalStorage 削除完了
🎉 すべてのデータを削除しました！

📊 データ状態を確認中...
──────────────────────────────────────────────────
✅ ログイン状態: ログイン中
   ユーザー: test@example.com
   UID: abc123...
📦 IndexedDB: 0 件
☁️ Firestore: 0 件
💾 LocalStorage: 0 件
──────────────────────────────────────────────────
✅ 状態確認完了
```

---

## 方法3: 手動で削除

### Firestoreから削除

1. [Firebase Console](https://console.firebase.google.com/) を開く
2. プロジェクトを選択
3. 「Firestore Database」を開く
4. `users/{userId}/history` コレクションを探す
5. すべてのドキュメントを選択して削除

### IndexedDBから削除

**Chrome/Edge:**
1. 開発者ツールを開く (F12)
2. 「Application」タブ
3. 左サイドバーの「IndexedDB」を展開
4. `YieldCalculatorDB` を右クリック → 「Delete database」

**Firefox:**
1. 開発者ツールを開く (F12)
2. 「Storage」タブ
3. 「Indexed DB」を展開
4. `YieldCalculatorDB` を右クリック → 「Delete」

**Safari:**
1. 開発者ツールを開く (Cmd + Option + I)
2. 「Storage」タブ
3. 「Indexed Databases」を選択
4. `YieldCalculatorDB` を削除

### LocalStorageから削除

開発者ツール → Application/Storage → Local Storage → 右クリック → Clear

---

## トラブルシューティング

### エラー: "ログインが必要"

**原因**: Firestoreの削除にはログインが必要です

**解決方法**:
1. `index.html` でログインする
2. ログイン後、再度削除を実行

### エラー: "Permission denied"

**原因**: Firestoreのセキュリティルールで削除が許可されていない

**解決方法**:
1. Firebase Consoleでセキュリティルールを確認
2. または、Firebase Consoleから手動で削除

### エラー: "Database is locked"

**原因**: 複数のタブで同じデータベースを開いている

**解決方法**:
1. すべてのタブを閉じる
2. 1つのタブで再度開く
3. 削除を実行

---

## 削除後の確認

以下のコマンドで削除が成功したか確認できます:

```javascript
await checkDataStatus()
```

すべて `0 件` になっていれば成功です。

```
📦 IndexedDB: 0 件
☁️ Firestore: 0 件
💾 LocalStorage: 0 件
```

---

## よくある質問

### Q: 削除を取り消せますか？

A: いいえ、取り消せません。削除前にバックアップを取ることをおすすめします。

### Q: 一部のデータだけ削除できますか？

A: はい、以下のコマンドで個別に削除できます:
- `await cleanupIndexedDB()` - IndexedDBのみ
- `await cleanupFirestore()` - Firestoreのみ
- `cleanupLocalStorage()` - LocalStorageのみ

### Q: 削除後もログイン状態は維持されますか？

A: はい、Firebaseのログイン情報は別の場所に保存されているため、維持されます。

### Q: 削除に時間がかかります

A: データ件数が多い場合、数秒から数十秒かかることがあります。ブラウザが応答していても待ってください。

---

## 参考リンク

- [Firebase Console](https://console.firebase.google.com/)
- [Chrome DevTools - Application](https://developer.chrome.com/docs/devtools/storage/indexeddb/)
- [Firefox Developer Tools - Storage](https://firefox-source-docs.mozilla.org/devtools-user/storage_inspector/)
