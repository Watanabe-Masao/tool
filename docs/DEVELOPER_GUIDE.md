# 開発者ガイド

本書は、実装の概要・依存関係・主要モジュールの責務と連携を整理したドキュメントです。

## 1. 全体構成
```
root
├─ index.html
├─ manifest.json
├─ sw.js
├─ scripts/
│  ├─ main.js
│  ├─ state.js
│  ├─ storage.js
│  ├─ db.js
│  ├─ calculation.js
│  ├─ calculator-fixed.js
│  ├─ calculator-weight.js
│  ├─ product-simulator.js
│  ├─ display.js
│  ├─ dom-utils.js
│  └─ constants.js
└─ styles/
   ├─ main.css
   └─ history.css
```

参考：MVP 実装記録にファイル構成と PWA/履歴機能の要点があります（IndexedDB ラッパ、Service Worker、UI など）。

## 2. 機能別の責務
- **`calculation.js`**：純粋関数群（歩留まり率、100g 換算、値入率、粗利率、仕上がり価格等）  
- **`calculator-*.js`**：入力値から結果構造体を作成（モード別）  
- **`product-simulator.js`**：商品化（重量・消耗品費）と値引き後粗利の計算  
- **`display.js`**：DOM 更新（結果表示、セクション表示制御、値引きの初期化）  
- **`state.js`**：アプリ状態（モード、ステップ、スナップショット）  
- **`storage.js`/`db.js`**：IndexedDB 保存・検索・更新・削除、JSON 入出力  
- **`history-ui.js`**：履歴モーダル UI（一覧・操作）  
- **`constants.js`**：UI 要素 ID、ラベル、モード定義  
- **`sw.js`/`manifest.json`**：PWA 設定（Cache-First 等）

## 3. 計算のフロー（例：計量 → 計量）
1. `calculator-weight.js` で入力値取得  
2. `calculation.js` の純粋関数で中間値を算出  
3. `display.js` で DOM に反映・粗利率も算出  
4. `state.js` にスナップショット保存（商品化や逆算で再利用）  
5. 必要に応じて `product-simulator.js` で重量や値引きの派生計算を実行

## 4. データ構造（抜粋）
### 4.1 スナップショット（`state.js`）
```js
{
  afterCost: number,   // 100g あたり
  afterPrice: number,  // 100g あたり
  beforeMarkup: number,
  afterMarkup: number,
  beforePrice: number,
  beforeCost: number,
  yieldRate: number    // %
}
```

### 4.2 履歴保存データ（`storage.js` → IndexedDB）
```js
{
  id: number,
  name: string,
  mode: 'fixed' | 'weight',
  category?: string,
  input: object,      // 入力スナップショット
  result: object,     // 計算結果
  product?: object,   // 商品化計算結果
  timestamp: number
}
```

## 5. PWA とオフライン
- `sw.js`：基本は **Cache First**。アプリの静的アセットをキャッシュし、無通信でも UI が起動  
- `manifest.json`：アイコン・テーマカラー・起動モードを定義

## 6. バリデーションとエラーハンドリング
- `calculation.js` は **副作用なし**・**未定義/不正値に対して安全**  
- `display.js` で結果の表示/非表示を制御し、エラー状態を UI に反映  
- 入力の 0/負数や単位不整合に注意（ユーザーガイドにも注意点を明記）

## 7. 変更時の参照ポイント
- UI/DOM を変更 → `constants.js`（ID）と `display.js` の参照を合わせる  
- 計算式の変更/追加 → `calculation.js` へ純粋関数として追加、呼び出し側で注入  
- 履歴フォーマット変更 → `storage.js`/`db.js` のスキーマ互換性に注意  
- 逆算や値引き派生 → `product-simulator.js` と `reverse-sim` の整合を保つ

## 8. ローカル開発
```bash
npm i            # （必要に応じてツール導入）
npm run dev      # 開発用サーバ（任意）
# もしくは任意の静的サーバで index.html を配信
```

## 9. 既存ドキュメント
- MVP 実装記録とファイル構成：`MVP_IMPLEMENTATION.md`
- 数式仕様：`docs/TECHNICAL_SPEC.md`（本ガイドの下位文書）