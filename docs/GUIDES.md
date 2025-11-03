# 運用ガイド

**バージョン**: v1.0
**最終更新**: 2025-11-03
**対象**: 歩留まり計算ツールの運用・保守ガイド

---

## 目次
- [ブラウザキャッシュクリア](#ブラウザキャッシュクリア)
- [データクリーンアップ](#データクリーンアップ)
- [トラブルシューティング](#トラブルシューティング)

---

## ブラウザキャッシュクリア

### 概要

エラー `The requested module './dom-utils.js' does not provide an export named 'toFixed'` が表示される場合、
ブラウザが古いバージョンのファイルをキャッシュしています。

---

### 🔄 方法1: スーパーリロード（最速・推奨）

#### Windows / Linux
```
Ctrl + Shift + R
```
または
```
Ctrl + F5
```

#### Mac
```
Cmd + Shift + R
```
または
```
Shift + 再読み込みボタンをクリック
```

---

### 🛠️ 方法2: 開発者ツールでキャッシュを無効化（確実）

#### Chrome / Edge

**方法A: ハード再読み込み**
1. **F12** キーを押して開発者ツールを開く
2. **開発者ツールが開いている状態で** 再読み込みボタンを**右クリック**
3. 「キャッシュの消去とハード再読み込み」を選択

**方法B: Disable cache**
1. **F12** キーを押して開発者ツールを開く
2. **Network** タブをクリック
3. 「**Disable cache**」にチェックを入れる
4. 開発者ツールを開いたまま **Ctrl+R** または **Cmd+R** でリロード

#### Firefox

1. **F12** キーを押して開発者ツールを開く
2. **Network** タブをクリック
3. 「**Disable Cache**」にチェックを入れる
4. 開発者ツールを開いたまま **Ctrl+R** または **Cmd+R** でリロード

#### Safari

1. **Cmd + Option + E** で開発者ツールを開く
2. **Network** タブをクリック
3. 「**Disable Caches**」にチェックを入れる
4. 開発者ツールを開いたまま **Cmd+R** でリロード

---

### 🗑️ 方法3: ブラウザの設定からキャッシュをクリア（徹底的）

#### Chrome / Edge

1. **Ctrl + Shift + Delete** (Mac: **Cmd + Shift + Delete**)
2. 「キャッシュされた画像とファイル」にチェック
3. 期間: 「全期間」を選択
4. 「データを削除」をクリック

#### Firefox

1. **Ctrl + Shift + Delete** (Mac: **Cmd + Shift + Delete**)
2. 「キャッシュ」にチェック
3. 期間: 「すべての履歴」を選択
4. 「今すぐ消去」をクリック

#### Safari

1. **Cmd + Option + E** で「開発」メニューを表示
2. メニューバーの「開発」→「キャッシュを空にする」

---

### 🕵️ 方法4: シークレット/プライベートモードで開く（最も確実）

#### Chrome / Edge
```
Ctrl + Shift + N  (Mac: Cmd + Shift + N)
```

#### Firefox
```
Ctrl + Shift + P  (Mac: Cmd + Shift + P)
```

#### Safari
```
Cmd + Shift + N
```

シークレットモードで `index.html` または `test-ux-animations.html` を開く

---

### ✅ キャッシュクリア後の確認手順

1. 上記のいずれかの方法でキャッシュをクリア
2. ブラウザで `index.html` を開く
3. **F12** キーで開発者ツールを開く
4. **Console** タブを確認
5. エラーメッセージが消えていることを確認

#### 期待される結果
- ✅ エラーなし
- ✅ アプリケーションが正常に読み込まれる
- ✅ 統計計算が実行できる

---

### 🚨 それでもエラーが出る場合

#### 確認1: ファイルが最新か確認
```bash
cd /home/user/tool
git status
git pull origin <branch-name>
```

#### 確認2: dom-utils.js の内容を確認
```bash
grep "export const toFixed" scripts/dom-utils.js
```

**期待される出力**:
```
export const toFixed = (n, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : null;
```

#### 確認3: ブラウザを完全に再起動
1. ブラウザを完全に終了（全タブ、全ウィンドウを閉じる）
2. タスクマネージャー/アクティビティモニタでブラウザプロセスが完全に終了しているか確認
3. ブラウザを再起動
4. `index.html` を開く

---

### 📝 トラブルシューティングチェックリスト

- [ ] スーパーリロード（Ctrl+Shift+R / Cmd+Shift+R）を試した
- [ ] 開発者ツールで「Disable cache」を有効にした
- [ ] ブラウザのキャッシュを完全に削除した
- [ ] シークレット/プライベートモードで試した
- [ ] ブラウザを完全に再起動した
- [ ] 別のブラウザで試した（Chrome → Firefox など）
- [ ] git pull で最新版を取得した

---

### 🎯 推奨手順（この順番で試してください）

1. **まず**: `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`) でスーパーリロード
2. **ダメなら**: シークレットモードで開く
3. **それでもダメなら**: ブラウザを完全に再起動
4. **最終手段**: 別のブラウザを使う

---

### ✨ 成功確認

キャッシュクリア後、以下を確認してください：

```bash
# 自動テストを実行
open test-ux-animations.html
```

または

```bash
# メインアプリを実行
open index.html
```

**Console（F12 → Console）にエラーがなければ成功です！** 🎉

---

## データクリーンアップ

### 概要

すべてのデータ（Firestore + IndexedDB + LocalStorage）を削除する方法を説明します。

---

### ⚠️ 重要な注意事項

**この操作は取り消せません！**

削除されるデータ:
- ☁️ **Firestore（クラウド）**: すべての計算履歴
- 💾 **IndexedDB（端末）**: ローカルキャッシュ
- 🔧 **LocalStorage**: 最終同期時刻などの設定

---

### 🎛️ 方法1: GUIから削除（推奨）

#### 手順

1. ブラウザで `cleanup.html` を開く
   ```
   file:///path/to/tool/cleanup.html
   ```

2. ログイン状態とデータ件数を確認

3. **「🗑️ すべて削除」** ボタンをクリック

4. 確認ダイアログで「OK」をクリック

5. ログに削除状況が表示される

6. 完了したら「🔄 状態を確認」で結果を確認

#### スクリーンショット

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

### 💻 方法2: ブラウザコンソールから削除

#### 手順

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

#### その他の便利なコマンド

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

#### 実行例

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

### 🛠️ 方法3: 手動で削除

#### Firestoreから削除

1. [Firebase Console](https://console.firebase.google.com/) を開く
2. プロジェクトを選択
3. 「Firestore Database」を開く
4. `users/{userId}/history` コレクションを探す
5. すべてのドキュメントを選択して削除

#### IndexedDBから削除

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

#### LocalStorageから削除

開発者ツール → Application/Storage → Local Storage → 右クリック → Clear

---

### 🔍 削除後の確認

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

## トラブルシューティング

### キャッシュクリア関連

#### 問題: スーパーリロードしてもエラーが消えない

**解決方法**:
1. シークレットモードで試す（最も確実）
2. ブラウザを完全に再起動
3. 別のブラウザを使用

#### 問題: 開発者ツールが開けない

**解決方法**:
- **Windows/Linux**: `F12` または `Ctrl + Shift + I`
- **Mac**: `Cmd + Option + I`
- ブラウザの設定で「開発者ツール」が有効になっているか確認

#### 問題: "Disable cache" が見つからない

**解決方法**:
- 開発者ツールの **Network** タブを開いているか確認
- 古いブラウザの場合は、最新バージョンにアップデート

---

### データクリーンアップ関連

#### エラー: "ログインが必要"

**原因**: Firestoreの削除にはログインが必要です

**解決方法**:
1. `index.html` でログインする
2. ログイン後、再度削除を実行

#### エラー: "Permission denied"

**原因**: Firestoreのセキュリティルールで削除が許可されていない

**解決方法**:
1. Firebase Consoleでセキュリティルールを確認
2. または、Firebase Consoleから手動で削除

#### エラー: "Database is locked"

**原因**: 複数のタブで同じデータベースを開いている

**解決方法**:
1. すべてのタブを閉じる
2. 1つのタブで再度開く
3. 削除を実行

#### 問題: 削除に時間がかかる

**原因**: データ件数が多い

**解決方法**:
- データ件数が多い場合、数秒から数十秒かかることがあります
- ブラウザが応答していても待ってください
- 進捗ログを確認しながら待機

---

### よくある質問

#### Q: 削除を取り消せますか？

A: いいえ、取り消せません。削除前にバックアップを取ることをおすすめします。

#### Q: 一部のデータだけ削除できますか？

A: はい、以下のコマンドで個別に削除できます:
- `await cleanupIndexedDB()` - IndexedDBのみ
- `await cleanupFirestore()` - Firestoreのみ
- `cleanupLocalStorage()` - LocalStorageのみ

#### Q: 削除後もログイン状態は維持されますか？

A: はい、Firebaseのログイン情報は別の場所に保存されているため、維持されます。

#### Q: キャッシュクリア後もエラーが出続ける

A: 以下を順番に試してください:
1. ブラウザを完全に再起動
2. シークレットモードで試す
3. 別のブラウザを使用
4. `git pull` で最新版を取得

---

## 参考リンク

### 公式ドキュメント
- [Firebase Console](https://console.firebase.google.com/)
- [Chrome DevTools - Application](https://developer.chrome.com/docs/devtools/storage/indexeddb/)
- [Firefox Developer Tools - Storage](https://firefox-source-docs.mozilla.org/devtools-user/storage_inspector/)

### 関連ドキュメント
- [README.md](../README.md) - 使い方ガイド
- [TESTING.md](./TESTING.md) - テストドキュメント
- [ARCHITECTURE.md](./ARCHITECTURE.md) - アーキテクチャ設計

---

**ドキュメント作成**: 2025-11-03
**バージョン**: v1.0
**統合元ドキュメント**:
- CACHE_CLEAR_GUIDE.md
- CLEANUP_GUIDE.md
