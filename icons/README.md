# アプリアイコン生成ガイド

PWAとして動作するには、複数サイズのアイコンが必要です。

## 🎨 必要なアイコンサイズ

- 72x72 px
- 96x96 px
- 128x128 px
- 144x144 px
- 152x152 px
- 192x192 px
- 384x384 px
- 512x512 px

## 🚀 簡単な生成方法

### 方法1: オンラインツールを使用（推奨）

**PWA Asset Generator** (無料)
https://www.pwabuilder.com/imageGenerator

1. 512x512pxの元画像を用意（推奨：PNG形式、透過背景）
2. 上記サイトにアップロード
3. すべてのサイズを自動生成してダウンロード
4. ダウンロードしたファイルを `icons/` フォルダに配置

### 方法2: Favicomatic（オールインワン）

https://favicomatic.com/

1. 512x512px以上の画像をアップロード
2. "Every damn size, sir!" を選択
3. ダウンロードして解凍
4. 必要なサイズのファイルを `icons/` フォルダにリネームして配置

### 方法3: 手動で作成

ImageMagickを使用:

```bash
# 元画像（logo.png）から各サイズを生成
convert logo.png -resize 72x72 icon-72.png
convert logo.png -resize 96x96 icon-96.png
convert logo.png -resize 128x128 icon-128.png
convert logo.png -resize 144x144 icon-144.png
convert logo.png -resize 152x152 icon-152.png
convert logo.png -resize 192x192 icon-192.png
convert logo.png -resize 384x384 icon-384.png
convert logo.png -resize 512x512 icon-512.png
```

## 📝 アイコンデザインのヒント

**推奨デザイン:**
- シンプルな🧮（そろばん）アイコン
- 背景色: #5c6bc0（アプリのテーマカラー）
- 文字: 白または明るい色
- 角丸: 適用しない（OSが自動で適用）

**デザイン例:**
```
┌──────────────┐
│              │
│   🧮        │
│   歩留まり  │
│              │
└──────────────┘
```

## 🔄 一時的な対応

アイコンが用意できるまで、以下の方法で仮アイコンを使用できます：

1. **Favicon Generator** で仮アイコン生成:
   https://realfavicongenerator.net/

2. **絵文字をアイコン化**:
   - https://favicon.io/emoji-favicons/abacus/
   - 🧮（そろばん）絵文字を選択
   - ダウンロードして配置

## ✅ 配置後の確認

1. ブラウザで `/tool/` を開く
2. DevTools → Application → Manifest
3. アイコンが正しく表示されることを確認

## 📱 テスト方法

### スマホ（Android）
1. Chrome でアクセス
2. メニュー → "ホーム画面に追加"
3. アイコンがホーム画面に表示されることを確認

### スマホ（iOS）
1. Safari でアクセス
2. 共有ボタン → "ホーム画面に追加"
3. アイコンが表示されることを確認

### PC
1. Chrome/Edge でアクセス
2. アドレスバーの右側にインストールアイコンが表示
3. クリックしてインストール
