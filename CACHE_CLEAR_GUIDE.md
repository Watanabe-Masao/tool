# ブラウザキャッシュクリア方法

## 🔄 すぐにキャッシュをクリアする方法

エラー `The requested module './dom-utils.js' does not provide an export named 'toFixed'` が表示される場合、
ブラウザが古いバージョンのファイルをキャッシュしています。

---

## 方法1: スーパーリロード（最速・推奨）

### Windows / Linux
```
Ctrl + Shift + R
```
または
```
Ctrl + F5
```

### Mac
```
Cmd + Shift + R
```
または
```
Shift + 再読み込みボタンをクリック
```

---

## 方法2: 開発者ツールでキャッシュを無効化（確実）

### Chrome / Edge

1. **F12** キーを押して開発者ツールを開く
2. **開発者ツールが開いている状態で** 再読み込みボタンを**右クリック**
3. 「キャッシュの消去とハード再読み込み」を選択

または

1. **F12** キーを押して開発者ツールを開く
2. **Network** タブをクリック
3. 「**Disable cache**」にチェックを入れる
4. 開発者ツールを開いたまま **Ctrl+R** または **Cmd+R** でリロード

### Firefox

1. **F12** キーを押して開発者ツールを開く
2. **Network** タブをクリック
3. 「**Disable Cache**」にチェックを入れる
4. 開発者ツールを開いたまま **Ctrl+R** または **Cmd+R** でリロード

### Safari

1. **Cmd + Option + E** で開発者ツールを開く
2. **Network** タブをクリック
3. 「**Disable Caches**」にチェックを入れる
4. 開発者ツールを開いたまま **Cmd+R** でリロード

---

## 方法3: ブラウザの設定からキャッシュをクリア（徹底的）

### Chrome / Edge

1. **Ctrl + Shift + Delete** (Mac: **Cmd + Shift + Delete**)
2. 「キャッシュされた画像とファイル」にチェック
3. 期間: 「全期間」を選択
4. 「データを削除」をクリック

### Firefox

1. **Ctrl + Shift + Delete** (Mac: **Cmd + Shift + Delete**)
2. 「キャッシュ」にチェック
3. 期間: 「すべての履歴」を選択
4. 「今すぐ消去」をクリック

### Safari

1. **Cmd + Option + E** で「開発」メニューを表示
2. メニューバーの「開発」→「キャッシュを空にする」

---

## 方法4: シークレット/プライベートモードで開く（最も確実）

### Chrome / Edge
```
Ctrl + Shift + N  (Mac: Cmd + Shift + N)
```

### Firefox
```
Ctrl + Shift + P  (Mac: Cmd + Shift + P)
```

### Safari
```
Cmd + Shift + N
```

シークレットモードで `index.html` または `test-ux-animations.html` を開く

---

## ✅ キャッシュクリア後の確認手順

1. 上記のいずれかの方法でキャッシュをクリア
2. ブラウザで `index.html` を開く
3. **F12** キーで開発者ツールを開く
4. **Console** タブを確認
5. エラーメッセージが消えていることを確認

### 期待される結果
- ✅ エラーなし
- ✅ アプリケーションが正常に読み込まれる
- ✅ 統計計算が実行できる

---

## 🚨 それでもエラーが出る場合

### 確認1: ファイルが最新か確認
```bash
cd /home/user/tool
git status
git pull origin claude/review-architecture-design-011CUdJ1FMmi9SxNm1AcPBgg
```

### 確認2: dom-utils.js の内容を確認
```bash
grep "export const toFixed" scripts/dom-utils.js
```

**期待される出力**:
```
export const toFixed = (n, d = 2) => Number.isFinite(n) ? Number(n.toFixed(d)) : null;
```

### 確認3: ブラウザを完全に再起動
1. ブラウザを完全に終了（全タブ、全ウィンドウを閉じる）
2. タスクマネージャー/アクティビティモニタでブラウザプロセスが完全に終了しているか確認
3. ブラウザを再起動
4. `index.html` を開く

---

## 📝 トラブルシューティングチェックリスト

- [ ] スーパーリロード（Ctrl+Shift+R / Cmd+Shift+R）を試した
- [ ] 開発者ツールで「Disable cache」を有効にした
- [ ] ブラウザのキャッシュを完全に削除した
- [ ] シークレット/プライベートモードで試した
- [ ] ブラウザを完全に再起動した
- [ ] 別のブラウザで試した（Chrome → Firefox など）
- [ ] git pull で最新版を取得した

---

## 🎯 推奨手順（この順番で試してください）

1. **まず**: `Ctrl+Shift+R` (Mac: `Cmd+Shift+R`) でスーパーリロード
2. **ダメなら**: シークレットモードで開く
3. **それでもダメなら**: ブラウザを完全に再起動
4. **最終手段**: 別のブラウザを使う

---

## ✨ 成功確認

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
