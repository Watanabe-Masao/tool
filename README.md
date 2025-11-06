# 歩留まり計算ツール 🧮

> 食品加工業向けの歩留まり率・原価・売価・値入率計算 PWAアプリケーション

[![CI](https://github.com/Watanabe-Masao/tool/workflows/CI/badge.svg)](https://github.com/Watanabe-Masao/tool/actions/workflows/ci.yml)
[![PR Checks](https://github.com/Watanabe-Masao/tool/workflows/PR%20Checks/badge.svg)](https://github.com/Watanabe-Masao/tool/actions/workflows/pr-checks.yml)
[![codecov](https://codecov.io/gh/Watanabe-Masao/tool/branch/main/graph/badge.svg)](https://codecov.io/gh/Watanabe-Masao/tool)
[![PWA](https://img.shields.io/badge/PWA-Ready-blue.svg)](https://web.dev/progressive-web-apps/)
[![Offline](https://img.shields.io/badge/Offline-First-green.svg)](https://web.dev/offline-first/)

---

## 🎯 概要

**歩留まり計算ツール**は、食品加工業における**歩留まり率、原価、売価、値入率**を効率的に計算するWebアプリケーションです。

### 主な特徴

- ✨ **4つの計算モード** - 定額/計量売価、歩留まり統計、複数パターン分析
- 📱 **PWA対応** - スマホアプリのように使える、オフライン動作可能
- 💾 **2層データ永続化** - IndexedDB（ローカル）+ Firebase（クラウド）
- 📊 **高度な統計分析** - 外れ値検出、サンプルサイズ妥当性判断、z-score判定
- 🎨 **優れたUX** - アニメーション、カラーコーディング、トースト通知
- 🔒 **高品質** - 711テスト、設計スコア76%、セキュリティ脆弱性0件

---

## 🚀 クイックスタート

### オンラインで使う

1. ブラウザで https://watanabe-masao.github.io/tool/ にアクセス
2. モードを選択（定額売価 / 計量売価 / 歩留まり統計 / 複数パターン分析）
3. 各ステップで値を入力
4. 計算結果を確認

### PWAとしてインストール（推奨）

**スマホ（Android）**
- Chrome → メニュー → 「ホーム画面に追加」

**スマホ（iOS）**
- Safari → 共有ボタン → 「ホーム画面に追加」

**PC**
- Chrome/Edge → アドレスバー右のインストールアイコンをクリック

### ローカル開発環境

```bash
# リポジトリのクローン
git clone https://github.com/Watanabe-Masao/tool.git
cd tool

# 依存関係のインストール
npm install

# テストの実行
npm test

# ローカルサーバーの起動
npx http-server -p 8080
# ブラウザで http://localhost:8080 にアクセス
```

---

## ✨ 主な機能

### 📊 4つの計算モード

1. **定額売価→計量加工** - 箱単位仕入れ、100g単位販売
2. **計量売価→計量加工** - 100g単位仕入れ、100g単位販売
3. **歩留まり統計** - 複数サンプルの統計分析
4. **複数パターン分析** - 原価・売価の複数シナリオ比較

### 📈 歩留まり統計モード

- Excel風データテーブルで簡単入力
- 基本統計量（平均、中央値、標準偏差、変動係数）
- 四分位数と分布（Q1、Q3、IQR、歪度、尖度）
- 信頼区間分析（σ1、σ2、σ3範囲）
- **z-score判定システム** - 統計的に正しい個別データ評価
- サンプルサイズ妥当性判断
- 外れ値検出・削除（IQR法）
- グラフ表示（箱ひげ図、ヒストグラム、散布図、Q-Qプロット）

### 💾 データ管理

- **2層永続化**: IndexedDB（ローカル） + Firebase Firestore（クラウド）
- **自動同期**: オンライン時に自動的にクラウドと同期
- **オフライン対応**: ネット接続なしでも読み取り可能
- **履歴管理**: カテゴリー別・商品名別に保存
- **エクスポート/インポート**: JSON形式でバックアップ

### 🎨 優れたUX

- 🎬 アニメーション効果（フェードイン、スライドアップ）
- 🎨 カラーコーディング（緑/黄/赤で直感的な状態表示）
- 📈 プログレスバー（サンプルサイズ充足度の視覚化）
- ⏱️ カウントアップ効果（統計値が段階的に表示）
- 🔔 トースト通知（非ブロッキングな操作フィードバック）

---

## 📚 ドキュメント

### ユーザー向け

- **[使い方ガイド](docs/user-guide/USAGE.md)** - 基本的な使い方
- **[歩留まり統計ガイド](docs/user-guide/YIELD_STATS_GUIDE.md)** - 統計分析の詳細
- **[FAQ](docs/user-guide/FAQ.md)** - よくある質問
- **[トラブルシューティング](docs/user-guide/TROUBLESHOOTING.md)** - 問題解決

### 開発者向け

- **[アーキテクチャ](docs/development/ARCHITECTURE.md)** - システム設計
- **[開発ガイド](docs/development/CONTRIBUTING.md)** - 開発への参加方法
- **[API仕様](docs/specs/API.md)** - モジュールAPI
- **[テスト](docs/testing/README.md)** - テスト戦略

### プロジェクト管理

- **[現状評価](docs/project-management/CURRENT_STATUS_ASSESSMENT.md)** - 最新の評価（**必読**）
- **[改善計画](docs/project-management/DESIGN_IMPROVEMENT_PLAN_V2.md)** - 設計改善計画

📖 **すべてのドキュメント**: [docs/README.md](docs/README.md)

---

## 🔧 技術スタック

### フロントエンド

- HTML5 / CSS3 / JavaScript (ES6+)
- PWA (Service Worker)
- ECharts（データ可視化）

### データ層

- IndexedDB（ローカルストレージ）
- Firebase Firestore（クラウドデータベース）
- Firebase Authentication（ユーザー認証）

### 開発・テスト

- Jest（テストフレームワーク）
- ESLint（コード品質）
- GitHub Actions（CI/CD）

### 品質指標

- **テスト**: 711テスト、22スイート、全て通過
- **設計スコア**: 114/150 (76%) - 優秀
- **セキュリティ**: 脆弱性 0件
- **コード品質**: 適切なモジュール分割、高凝集・疎結合

---

## 📊 プロジェクト統計

```
行数統計（2025-11-06時点）
─────────────────────────────
JavaScript:  ~15,000行（47モジュール）
CSS:         ~5,000行
HTML:        ~1,000行
テスト:      ~8,000行（711テスト）
ドキュメント: ~20,000行
```

### アーキテクチャの進化

```
Phase 0-8: リファクタリング完了
├── main.js: 5,621行 → 15行（99.7%削減）✨
├── モジュール数: 14 → 47
├── テスト数: 437 → 711
└── 設計スコア: 54/150 (36%) → 114/150 (76%)
```

---

## 🤝 コントリビューション

コントリビューションを歓迎します！

1. このリポジトリをフォーク
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'feat: Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. Pull Requestを作成

詳細は [CONTRIBUTING.md](docs/development/CONTRIBUTING.md) をご覧ください。

---

## 🐛 問題報告

バグや機能リクエストは [Issues](https://github.com/Watanabe-Masao/tool/issues) までお願いします。

---

## 📄 ライセンス

このプロジェクトはリファクタリングと学習目的で作成されました。

---

## 🙏 謝辞

このプロジェクトは以下の技術・ツールを使用しています：

- [ECharts](https://echarts.apache.org/) - データ可視化
- [Firebase](https://firebase.google.com/) - バックエンドサービス
- [Jest](https://jestjs.io/) - テストフレームワーク
- [GitHub Actions](https://github.com/features/actions) - CI/CD

---

**バージョン**: v4.2
**最終更新**: 2025-11-06
**メンテナ**: Watanabe-Masao

📖 詳細なドキュメントは [docs/](docs/) をご覧ください。
