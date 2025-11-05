# ドキュメント構造

**最終更新**: 2025-11-05
**現在のフェーズ**: Phase 3 完了 ✅

---

## 📚 主要ドキュメント

### 設計・アーキテクチャ
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - システムアーキテクチャ全体図
  - モジュール構成、データフロー、状態管理
  - PWAアーキテクチャ、データベース設計
  - 41KB, v4.2

- **[DESIGN_IMPROVEMENT_PLAN_V2.md](./DESIGN_IMPROVEMENT_PLAN_V2.md)** - 設計改善計画 v2.0
  - 設計原則レビュー（54/150点）
  - Phase 0-3 の改善計画
  - 34KB

### 実装・リファクタリング
- **[IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md)** ⭐ **NEW**
  - Phase 0-3 の完全な実施報告書
  - Before/After比較、技術的負債返済状況
  - 設計スコア改善: 54/150 → 84/150
  - 24KB

- **[REFACTORING_PHASE_3_QUALITY.md](./REFACTORING_PHASE_3_QUALITY.md)** ⭐ **NEW**
  - Phase 3: コード品質改善の詳細レポート
  - ESLint設定、ユニットテスト、カバレッジ測定
  - Critical バグ修正（logger 無限再帰）
  - 11KB

### パフォーマンス・品質
- **[PERFORMANCE.md](./PERFORMANCE.md)** ⭐ **NEW**
  - パフォーマンス最適化ガイドライン
  - イベントハンドリング、DOM操作、メモ化
  - ベンチマーク目標: 25-60% 改善
  - 6KB

- **[TESTING.md](./TESTING.md)**
  - テスト戦略、ユニットテスト、統合テスト
  - カバレッジ目標、CI/CD連携
  - 32KB

### 機能・操作
- **[FEATURES.md](./FEATURES.md)**
  - 全機能一覧と詳細説明
  - 固定歩留まり、逆算、複数パターン分析
  - 45KB

- **[CRUD_OPERATIONS.md](./CRUD_OPERATIONS.md)**
  - CRUD操作の完全ガイド
  - IndexedDB + Firestore の二層構造
  - 30KB

- **[GUIDES.md](./GUIDES.md)**
  - ユーザーガイド、開発者ガイド
  - 15KB

### インフラ・設定
- **[FIREBASE_SETUP.md](./FIREBASE_SETUP.md)**
  - Firebase プロジェクトのセットアップ
  - Authentication, Firestore, Hosting
  - 11KB

- **[CACHE_STRATEGY.md](./CACHE_STRATEGY.md)**
  - キャッシュ戦略（Service Worker）
  - オフライン対応
  - 12KB

### 仕様
- **[reverse-sim-spec.md](./reverse-sim-spec.md)**
  - 逆算シミュレーション仕様
  - 2.6KB

---

## 📁 アーカイブ

### archive/phase0-2/ (旧ドキュメント)
Phase 0-2 完了後、不要になったドキュメント：

- `DESIGN_IMPROVEMENT_PLAN.md` - v1改善計画（v2に更新）
- `DOCUMENTATION_REORGANIZATION.md` - 古い再編成計画
- `REFACTORING_BACKWARD_COMPAT_TIMING.md` - Phase 0後方互換性削除
- `REFACTORING_SUMMARY.md` - 旧リファクタリング要約
- `REFACTORING_YIELD_STATS_TRANSITION.md` - Phase 2.1完了記録
- `STATE_CONSOLIDATION_IMPACT_ANALYSIS.md` - 状態統合分析（完了）
- `GLOBAL_STATE_ANALYSIS.md` - グローバル状態分析（完了）

**注意**: これらのドキュメントは参照用として保持していますが、最新情報は上記の主要ドキュメントを参照してください。

---

## 🗺️ ドキュメントマップ

### 初めての方
1. [FEATURES.md](./FEATURES.md) - どんな機能があるか
2. [GUIDES.md](./GUIDES.md) - 使い方
3. [FIREBASE_SETUP.md](./FIREBASE_SETUP.md) - セットアップ

### 開発者
1. [ARCHITECTURE.md](./ARCHITECTURE.md) - システム全体像
2. [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) - 改善履歴
3. [TESTING.md](./TESTING.md) - テスト戦略
4. [PERFORMANCE.md](./PERFORMANCE.md) - パフォーマンス最適化

### メンテナンス
1. [CRUD_OPERATIONS.md](./CRUD_OPERATIONS.md) - データ操作
2. [CACHE_STRATEGY.md](./CACHE_STRATEGY.md) - キャッシュ管理
3. [REFACTORING_PHASE_3_QUALITY.md](./REFACTORING_PHASE_3_QUALITY.md) - 最新の改善内容

---

## 📊 プロジェクト状況

### 設計スコア
- **Phase 0 開始前**: 54/150 (36%)
- **Phase 3 完了後**: 84/150 (56%)
- **改善**: +30点 (+56%)

### テストカバレッジ
- **Phase 0 開始前**: 0%
- **Phase 3 完了後**: 80-100% (主要モジュール)

### 技術的負債
- **返済済み**: 5項目（console.* 乱用、無限再帰バグ、など）
- **残存**: 5項目（E2Eテスト、CI/CD、など）
- **返済率**: 50%

---

## 🚀 次のステップ

### 推奨される改善（IMPLEMENTATION_SUMMARY.md より）
1. **Phase 4**: UI/History State の分離（中優先度）
2. **Phase 5**: パフォーマンス最適化実装（高優先度）
3. **Phase 6**: E2Eテスト基盤構築（中優先度）
4. **Phase 7**: CI/CDパイプライン構築（高優先度）

---

## 📝 ドキュメント更新履歴

### 2025-11-05 (Phase 3 完了)
- ✅ **NEW**: IMPLEMENTATION_SUMMARY.md - 実装総まとめ
- ✅ **NEW**: REFACTORING_PHASE_3_QUALITY.md - Phase 3詳細レポート
- ✅ **NEW**: PERFORMANCE.md - パフォーマンスガイド
- ✅ **NEW**: README.md - このファイル
- ✅ アーカイブ: 7ファイルを archive/phase0-2/ に移動

### 2025-10-31 (Phase 2 完了)
- DESIGN_IMPROVEMENT_PLAN_V2.md 作成
- ARCHITECTURE.md v4.2 更新

---

## 📮 フィードバック

ドキュメントの改善提案は Issues または Pull Requests でお願いします。

**メンテナー**: Claude (AI Assistant)
**レビュー推奨日**: 2025-12-01 (1ヶ月後)
