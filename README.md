# tool

最小構成の **Vite + PWA** テンプレートです。Service Worker は **Stale-While-Revalidate** 戦略で実装しています。

> この README は `MVP_IMPLEMENTATION.md` をベースにユーザ視点で再構成することを想定しています。必要に応じてスクリーンショットや操作例を追記してください。

## デモ
- GitHub Pages へデプロイする場合、Actions が自動で `dist` を公開します。

## 使い方
```bash
# 依存のインストール
npm i

# 開発
npm run dev

# ビルド
npm run build

# ビルドのローカル確認
npm run preview
```

## PWA
- `public/manifest.json` と `sw.js` を同梱
- `src/register-sw.js` で起動時に Service Worker を登録
- **戦略**: 静的アセットは Cache-First、その他は Stale-While-Revalidate

## ディレクトリ構成
```
├─ index.html
├─ sw.js
├─ src/
│  ├─ main.js
│  └─ register-sw.js
├─ public/
│  ├─ manifest.json
│  └─ icons/
│     ├─ icon-192.png
│     └─ icon-512.png
└─ .github/workflows/deploy.yml
```

## ライセンス
- 適宜 `LICENSE` を追加してください。

## 開発メモ
- `vite.config.js` の `base` は GitHub Pages の公開パスに合わせて設定してください（例: `/tool/`）。
- 既存の `scripts/main.js` がある場合は `src/main.js` へ移行していくと保守しやすいです。
