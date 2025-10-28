# アーキテクチャドキュメント

## 目次
- [システムアーキテクチャ](#システムアーキテクチャ)
- [モジュール構成](#モジュール構成)
- [データフロー](#データフロー)
- [状態管理](#状態管理)
- [計算フロー](#計算フロー)
- [PWAアーキテクチャ](#pwaアーキテクチャ)
- [データベース設計](#データベース設計)

---

## システムアーキテクチャ

### 全体構成図

```mermaid
graph TB
    subgraph "ユーザーインターフェース"
        UI[HTML/CSS]
        Events[イベントハンドラ]
    end

    subgraph "アプリケーション層"
        Main[main.js<br/>エントリーポイント]
        State[state.js<br/>状態管理]
        Display[display.js<br/>表示制御]
        InputHandler[input-handler.js<br/>入力処理]
        Session[session.js<br/>セッション管理]
    end

    subgraph "ビジネスロジック層"
        CalcFixed[calculator-fixed.js<br/>定額モード計算]
        CalcWeight[calculator-weight.js<br/>計量モード計算]
        CalcYieldStats[calculator-yield-stats.js<br/>歩留まり統計計算]
        Calc[calculation.js<br/>計算ユーティリティ]
        Simulator[product-simulator.js<br/>シミュレーション]
    end

    subgraph "データ層"
        Storage[storage.js<br/>保存ロジック]
        DB[db.js<br/>IndexedDB管理]
        IDB[(IndexedDB)]
    end

    subgraph "PWA層"
        SW[Service Worker<br/>sw.js]
        Cache[(Cache Storage)]
        Manifest[manifest.json]
    end

    subgraph "ユーティリティ"
        Constants[constants.js<br/>定数定義]
        DomUtils[dom-utils.js<br/>DOMヘルパー]
        HistoryUI[history-ui.js<br/>履歴UI]
    end

    UI --> Events
    Events --> Main
    Main --> State
    Main --> Display
    Main --> InputHandler
    Main --> HistoryUI

    InputHandler --> CalcFixed
    InputHandler --> CalcWeight
    CalcFixed --> Calc
    CalcWeight --> Calc
    CalcFixed --> State
    CalcWeight --> State

    Main --> Simulator
    Simulator --> State

    Main --> Storage
    Storage --> DB
    DB --> IDB

    Display --> DomUtils
    HistoryUI --> DomUtils
    Main --> Constants

    SW --> Cache
    SW --> IDB
```

### レイヤー構造

```mermaid
graph TD
    subgraph "Layer 1: Presentation"
        A1[HTML/CSS]
        A2[UI Components]
    end

    subgraph "Layer 2: Application"
        B1[Event Handlers]
        B2[State Management]
        B3[Display Logic]
    end

    subgraph "Layer 3: Business Logic"
        C1[Calculations]
        C2[Simulations]
        C3[Validations]
    end

    subgraph "Layer 4: Data Access"
        D1[Storage API]
        D2[IndexedDB Wrapper]
    end

    subgraph "Layer 5: Infrastructure"
        E1[Service Worker]
        E2[Cache Management]
        E3[PWA Features]
    end

    A1 --> B1
    A2 --> B1
    B1 --> B2
    B2 --> C1
    C1 --> C2
    B1 --> D1
    D1 --> D2
    E1 --> E2
    E1 --> E3
```

---

## モジュール構成

### モジュール依存関係図

```mermaid
graph LR
    Main[main.js] --> State[state.js]
    Main --> Constants[constants.js]
    Main --> Display[display.js]
    Main --> InputHandler[input-handler.js]
    Main --> Storage[storage.js]
    Main --> HistoryUI[history-ui.js]
    Main --> Simulator[product-simulator.js]

    InputHandler --> CalcFixed[calculator-fixed.js]
    InputHandler --> CalcWeight[calculator-weight.js]

    CalcFixed --> Calc[calculation.js]
    CalcWeight --> Calc

    CalcFixed --> State
    CalcWeight --> State

    Simulator --> State

    Display --> DomUtils[dom-utils.js]
    HistoryUI --> DomUtils

    Storage --> DB[db.js]
    HistoryUI --> DB

    style Main fill:#e1bee7
    style State fill:#ffccbc
    style DB fill:#b2dfdb
    style Calc fill:#fff9c4
```

### モジュール責務マトリクス

| モジュール | 主要責務 | 依存先 | 公開API |
|-----------|---------|--------|---------|
| **main.js** | アプリ初期化、イベント統合 | すべて | - |
| **state.js** | 状態管理、スナップショット | なし | AppState |
| **session.js** | セッション状態の永続化 | dom-utils.js, constants.js | saveSessionState(), restoreSessionState() |
| **constants.js** | 定数、ID定義 | なし | すべての定数 |
| **calculation.js** | 基本計算関数 | なし | 各種計算関数 |
| **calculator-fixed.js** | 定額モード計算 | calculation.js, state.js | calculateFixed() |
| **calculator-weight.js** | 計量モード計算 | calculation.js, state.js | calculateWeight() |
| **calculator-yield-stats.js** | 歩留まり統計計算 | calculation.js | calculateYieldRate(), validateEntry() |
| **display.js** | 表示更新 | dom-utils.js | displayResults() |
| **input-handler.js** | 入力管理 | calculator-*.js | setupInputListeners() |
| **product-simulator.js** | シミュレーション | state.js | simulate*() |
| **db.js** | IndexedDB CRUD | なし | Database |
| **storage.js** | 保存ロジック | db.js | saveCalculation() |
| **history-ui.js** | 履歴UI | db.js, dom-utils.js | setupHistoryUI() |
| **dom-utils.js** | DOM操作 | なし | qs(), setText(), etc. |

---

## データフロー

### 計算データフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant Input as 入力フィールド
    participant Handler as InputHandler
    participant Calc as Calculator
    participant State as AppState
    participant Display as Display

    User->>Input: 値を入力
    Input->>Handler: change イベント
    Handler->>Calc: calculateFixed/Weight()
    Calc->>Calc: 内部計算処理
    Calc->>State: updateSnapshot()
    State-->>Calc: 状態更新完了
    Calc->>Display: displayResults()
    Display->>User: 結果表示
```

### 保存・読込データフロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant UI as UI
    participant Storage as Storage
    participant DB as Database
    participant IDB as IndexedDB

    rect rgb(200, 220, 250)
    Note over User,IDB: 保存フロー
    User->>UI: 保存ボタンクリック
    UI->>UI: カテゴリー・商品名入力
    UI->>Storage: saveCalculation()
    Storage->>Storage: データ収集
    Storage->>DB: add()
    DB->>IDB: トランザクション実行
    IDB-->>DB: 保存完了
    DB-->>Storage: ID返却
    Storage-->>UI: 成功通知
    UI->>User: トースト表示
    end

    rect rgb(250, 220, 200)
    Note over User,IDB: 読込フロー
    User->>UI: 履歴ボタンクリック
    UI->>DB: getAll()
    DB->>IDB: クエリ実行
    IDB-->>DB: データ配列
    DB-->>UI: 履歴データ
    UI->>User: 履歴モーダル表示
    User->>UI: 読込ボタンクリック
    UI->>UI: データ復元
    UI->>Calc: 計算実行
    Calc->>User: 結果表示
    end
```

### PWAデータフロー

```mermaid
sequenceDiagram
    participant Browser as ブラウザ
    participant SW as Service Worker
    participant Cache as Cache Storage
    participant Network as ネットワーク

    Browser->>SW: リソースリクエスト
    SW->>Network: fetch試行

    alt ネットワーク利用可能
        Network-->>SW: 最新リソース
        SW->>Cache: キャッシュ更新
        SW-->>Browser: リソース返却
    else オフライン
        SW->>Cache: キャッシュから取得
        Cache-->>SW: キャッシュ済みリソース
        SW-->>Browser: キャッシュから返却
    end
```

---

## 状態管理

### AppState クラス構造

```mermaid
classDiagram
    class AppState {
        -mode: string
        -currentStep: number
        -calculationSnapshot: Object
        -productSimulationData: Object
        -loadedHistoryId: number|null
        -isFromHistory: boolean
        -hasUnsavedChanges: boolean
        -yieldStatsData: Object|null
        -saveDialogMode: string
        +setMode(mode)
        +getMode()
        +setStep(step)
        +getStep()
        +updateSnapshot(data)
        +getSnapshot()
        +updateProductData(data)
        +getProductData()
        +setLoadedHistoryId(id)
        +getLoadedHistoryId()
        +clearLoadedHistoryId()
        +markAsFromHistory()
        +markAsNewCalculation()
        +markAsChanged()
        +markAsSaved()
        +isFromHistoryRecord()
        +hasChanges()
        +setYieldStatsData(data)
        +getYieldStatsData()
        +setSaveDialogMode(mode)
        +getSaveDialogMode()
        +resetAll()
    }

    class CalculationSnapshot {
        +yr: number
        +bc: number
        +bp: number
        +bm: number
        +ac: number
        +ap: number
        +am: number
        +afterMarkup: number
        +discountGross: number
    }

    class ProductSimulationData {
        +cost: number
        +price: number
        +markup: number
    }

    AppState --> CalculationSnapshot
    AppState --> ProductSimulationData
```

### 状態遷移図

```mermaid
stateDiagram-v2
    [*] --> ModeSelection: アプリ起動
    ModeSelection --> Step1: モード選択

    Step1 --> Step2: 基本情報入力完了
    Step2 --> Step3: 歩留まり率設定完了
    Step3 --> Step4: 加工後売価設定完了
    Step4 --> Step5: 商品化設定完了
    Step5 --> Complete: 値引き設定完了

    Complete --> Saving: 保存操作
    Saving --> Complete: 保存完了

    Complete --> ModeSelection: 新規計算

    ModeSelection --> LoadHistory: 履歴読込
    LoadHistory --> Complete: データ復元

    state Step1 {
        [*] --> InputMode
        InputMode --> Calculating
        Calculating --> Displaying
        Displaying --> [*]
    }

    state Step2 {
        [*] --> SelectMethod
        SelectMethod --> InputYield
        InputYield --> CalcYield
        CalcYield --> [*]
    }
```

---

## 計算フロー

### 定額売価モード計算フロー

```mermaid
graph TD
    A[入力: 原価・売価・重量] --> B[100g単価計算]
    B --> C[加工前値入率計算]
    C --> D{歩留まり<br/>入力方法}

    D -->|重量| E1[加工前後重量入力]
    D -->|直接| E2[歩留まり率入力]

    E1 --> F[歩留まり率算出]
    E2 --> F

    F --> G[加工後100g原価計算]
    G --> H[加工後売価入力]
    H --> I[加工後値入率計算]

    I --> J[商品化シミュレーション]
    J --> K[パック原価・売価・値入率]

    K --> L[値引きシミュレーション]
    L --> M[最終粗利率算出]

    style A fill:#e1f5fe
    style M fill:#c8e6c9
```

### 計算式詳細

#### 加工前計算
```
100g原価 = (1個原価 / 1個重量) × 100
100g売価 = (1個売価 / 1個重量) × 100
加工前値入率 = ((100g売価 - 100g原価) / 100g売価) × 100
```

#### 歩留まり計算
```
歩留まり率 = (加工後重量 / 加工前重量) × 100
```

#### 加工後計算
```
加工後100g原価 = 加工前100g原価 / (歩留まり率 / 100)
加工後値入率 = ((加工後100g売価 - 加工後100g原価) / 加工後100g売価) × 100
```

#### 商品化計算
```
パック原価 = (加工後100g原価 × パック重量 / 100) + 消耗品費
パック売価 = 加工後100g売価 × パック重量 / 100
パック値入率 = ((パック売価 - パック原価) / パック売価) × 100
```

#### 値引き計算
```
値引後粗利率 = パック値入率 / (1 - 値引率 / 100)
```

### 逆算フロー

```mermaid
graph TD
    A[目標値入率入力] --> B{逆算対象}

    B -->|重量| C1[重量逆算式]
    B -->|売価| C2[売価逆算式]
    B -->|原価| C3[原価逆算式]
    B -->|歩留まり| C4[歩留まり逆算式]
    B -->|値引率| C5[値引率逆算式]

    C1 --> D[検証処理]
    C2 --> D
    C3 --> D
    C4 --> D
    C5 --> D

    D --> E{有効?}
    E -->|はい| F[結果表示]
    E -->|いいえ| G[エラーメッセージ表示]

    style A fill:#fff9c4
    style F fill:#c8e6c9
    style G fill:#ffcdd2
```

---

## PWAアーキテクチャ

### Service Worker ライフサイクル

```mermaid
stateDiagram-v2
    [*] --> Installing: sw.js登録
    Installing --> Installed: インストール完了
    Installed --> Activating: アクティベート開始
    Activating --> Activated: アクティベート完了
    Activated --> Idle: 待機中

    Idle --> Fetching: fetchイベント
    Fetching --> Idle: レスポンス返却

    Idle --> Terminated: アイドルタイムアウト
    Terminated --> Idle: イベント受信

    Activated --> UpdateCheck: 1時間ごと
    UpdateCheck --> NewVersion: 新バージョン検出
    NewVersion --> Installing: 更新インストール
    UpdateCheck --> Activated: 変更なし

    state Installing {
        [*] --> CacheAssets
        CacheAssets --> [*]
    }

    state Activating {
        [*] --> DeleteOldCache
        DeleteOldCache --> ClaimClients
        ClaimClients --> [*]
    }
```

### 自動バージョニングの仕組み

**問題**: 手動でキャッシュバージョンを更新するのは面倒で、忘れやすい

**解決策**: GitHub Actionsで自動的にビルドタイムスタンプを注入

```mermaid
sequenceDiagram
    participant Dev as 開発者
    participant Git as GitHub
    participant Actions as GitHub Actions
    participant Pages as GitHub Pages
    participant User as ユーザー

    Dev->>Git: コードをpush
    Git->>Actions: デプロイワークフロー起動
    Actions->>Actions: タイムスタンプ生成<br/>(YYYYMMDD-HHMMSS-HASH)
    Actions->>Actions: sw.js内のプレースホルダーを置換<br/>__BUILD_TIMESTAMP__ → 20250126-153045-a1b2c3d
    Actions->>Pages: 更新されたファイルをデプロイ
    Pages->>User: 新しいsw.jsを配信
    User->>User: Service Worker更新検出
    User->>User: 更新通知表示
```

**実装詳細**:

1. **sw.js内のプレースホルダー**:
   ```javascript
   const CACHE_BUILD = '__BUILD_TIMESTAMP__';
   ```

2. **GitHub Actionsでの置換処理**:
   ```bash
   # タイムスタンプ生成
   BUILD_TIMESTAMP=$(date -u +"%Y%m%d-%H%M%S")-${GITHUB_SHA:0:7}

   # プレースホルダーを置換
   sed -i "s/__BUILD_TIMESTAMP__/${BUILD_TIMESTAMP}/g" sw.js
   ```

3. **結果**:
   ```javascript
   const CACHE_BUILD = '20250126-153045-a1b2c3d';
   ```

**メリット**:
- 開発者は手動でバージョンを変更する必要なし
- デプロイごとに自動的にユニークなバージョンが生成される
- コミットハッシュ含有でトレーサビリティが向上
- ビルドツール不要（sedのみ使用）

### キャッシュ戦略

```mermaid
graph TD
    A[Fetchイベント] --> B{ネットワーク<br/>利用可能?}

    B -->|はい| C[ネットワークから取得]
    C --> D[キャッシュに保存]
    D --> E[レスポンス返却]

    B -->|いいえ| F[キャッシュから取得]
    F --> G{キャッシュ<br/>存在?}

    G -->|はい| E
    G -->|いいえ| H[オフラインページ]

    style C fill:#c8e6c9
    style F fill:#fff9c4
    style H fill:#ffcdd2
```

### PWA更新フロー

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as アプリ
    participant Timer as タイマー
    participant SW as Service Worker
    participant Server as サーバー

    App->>Timer: 1時間タイマー開始
    Timer->>SW: update() 呼び出し
    SW->>Server: sw.js リクエスト

    alt 新バージョンあり
        Server-->>SW: 新 sw.js
        SW->>SW: インストール開始
        SW-->>App: updatefound イベント
        App->>User: 更新通知表示
        User->>App: 更新ボタンクリック
        App->>SW: skipWaiting()
        SW->>SW: アクティベート
        SW->>App: controllerchange
        App->>App: location.reload()
    else 変更なし
        Server-->>SW: 304 Not Modified
        SW-->>Timer: 更新なし
    end
```

---

## データベース設計

### IndexedDB スキーマ

```mermaid
erDiagram
    CALCULATIONS {
        number id PK
        string name
        string category
        string mode
        object input
        object result
        object product
        number timestamp
        string createdAt
        string updatedAt
    }

    CALCULATIONS ||--o{ INDEX_TIMESTAMP : has
    CALCULATIONS ||--o{ INDEX_NAME : has
    CALCULATIONS ||--o{ INDEX_MODE : has
    CALCULATIONS ||--o{ INDEX_CATEGORY : has
```

### データモデル詳細

```mermaid
classDiagram
    class CalculationRecord {
        +id: number
        +name: string
        +category: string
        +mode: string
        +input: InputData
        +result: ResultData
        +product: ProductData
        +timestamp: number
        +createdAt: string
        +updatedAt: string
    }

    class InputData {
        +mode: string
        +yieldMethod: string
        +unitCost: number
        +unitPrice: number
        +boxCost: number
        +boxPrice: number
        +boxWeight: number
        +beforeWeight: number
        +afterWeight: number
        +yieldRate: number
        +afterPrice100: number
        +expWeight: number
        +consumable: number
    }

    class ResultData {
        +yr: number
        +bc: number
        +bp: number
        +bm: number
        +ac: number
        +ap: number
        +am: number
        +yieldRate: number
        +afterMarkup: number
        +discountGross: number
    }

    class ProductData {
        +cost: number
        +price: number
        +markup: number
    }

    CalculationRecord --> InputData
    CalculationRecord --> ResultData
    CalculationRecord --> ProductData
```

### Database クラス構造

```mermaid
classDiagram
    class Database {
        -dbName: string
        -version: number
        -db: IDBDatabase
        +open() Promise~IDBDatabase~
        +add(storeName, data) Promise~number~
        +get(storeName, id) Promise~Object~
        +getAll(storeName) Promise~Array~
        +update(storeName, data) Promise~void~
        +delete(storeName, id) Promise~void~
        +clear(storeName) Promise~void~
        -upgradeDB(db) void
    }

    class IDBDatabase {
        <<external>>
    }

    Database --> IDBDatabase
```

---

## ファイル構成と役割

### ディレクトリ構造

```
tool/
├── index.html              # メインHTML、UIマークアップ
├── manifest.json           # PWA設定ファイル
├── sw.js                   # Service Worker
│
├── scripts/                # JavaScriptモジュール
│   ├── main.js            # アプリケーションエントリーポイント
│   ├── constants.js       # 定数・ID定義
│   ├── state.js           # 状態管理クラス
│   ├── session.js         # セッション状態の永続化
│   ├── calculation.js     # 計算ユーティリティ関数
│   ├── calculator-fixed.js        # 定額モード計算ロジック
│   ├── calculator-weight.js       # 計量モード計算ロジック
│   ├── calculator-yield-stats.js  # 歩留まり統計計算ロジック
│   ├── display.js         # UI表示制御
│   ├── input-handler.js   # 入力イベント処理
│   ├── product-simulator.js  # シミュレーション機能
│   ├── db.js              # IndexedDBラッパー
│   ├── storage.js         # データ保存ロジック
│   ├── history-ui.js      # 履歴UI管理
│   └── dom-utils.js       # DOM操作ヘルパー
│
├── styles/                 # スタイルシート
│   ├── main.css           # メインスタイル
│   └── history.css        # 履歴UIスタイル
│
├── icons/                  # PWAアイコン（8サイズ）
│   ├── icon-72.png
│   ├── icon-96.png
│   ├── icon-128.png
│   ├── icon-144.png
│   ├── icon-152.png
│   ├── icon-192.png
│   ├── icon-384.png
│   └── icon-512.png
│
└── docs/                   # ドキュメント
    ├── FEATURES.md         # 機能詳細仕様
    ├── ARCHITECTURE.md     # このファイル
    └── reverse-sim-spec.md # 逆算仕様書
```

---

## 設計パターンと原則

### 適用されている設計パターン

#### 1. **Module Pattern**
各JavaScriptファイルがES6モジュールとして独立
```javascript
// calculation.js
export function calcYield(before, after) { ... }

// main.js
import { calcYield } from './calculation.js';
```

#### 2. **Singleton Pattern**
AppStateクラスのグローバルインスタンス
```javascript
const appState = new AppState();
```

#### 3. **Factory Pattern**
計算モードに応じた関数選択
```javascript
const calculateFunc = mode === 'fixed'
    ? calculateFixed
    : calculateWeight;
```

#### 4. **Observer Pattern**
入力フィールドのchangeイベントで自動計算

#### 5. **Strategy Pattern**
歩留まり計算方法の選択（重量から計算 vs 直接入力）

### SOLID原則の適用

- **Single Responsibility**: 各モジュールが単一責務
- **Open/Closed**: 新機能追加時に既存コード変更不要
- **Liskov Substitution**: 計算関数の互換性
- **Interface Segregation**: 最小限のAPIエクスポート
- **Dependency Inversion**: 抽象（インターフェース）への依存

---

## パフォーマンス最適化

### 最適化戦略

```mermaid
graph TD
    A[パフォーマンス最適化] --> B[キャッシュ戦略]
    A --> C[コード分割]
    A --> D[遅延ロード]
    A --> E[IndexedDB最適化]

    B --> B1[Service Worker]
    B --> B2[ブラウザキャッシュ無効化]
    B --> B3[Network First戦略]

    C --> C1[ES6モジュール]
    C --> C2[必要な時のみインポート]

    D --> D1[履歴UI]
    D --> D2[大量データの遅延描画]

    E --> E1[インデックス活用]
    E --> E2[トランザクション最適化]
```

### レンダリング最適化

- **仮想スクロール**: 大量履歴の効率的表示
- **デバウンス**: 検索入力の遅延処理
- **CSS Transform**: アニメーションの最適化
- **will-change**: GPU加速の活用

---

## セキュリティ設計

### データ保護

```mermaid
graph LR
    A[ユーザーデータ] --> B[ローカルストレージのみ]
    B --> C[外部送信なし]
    C --> D[プライバシー保護]

    E[IndexedDB] --> F[オリジン分離]
    F --> G[他サイトアクセス不可]

    H[Service Worker] --> I[同一オリジンのみ]
    I --> J[HTTPS必須]
```

### セキュリティ対策

1. **XSS対策**: DOMへの直接挿入を避ける
2. **CSP**: Content Security Policy（将来実装可能）
3. **データ検証**: すべての入力値をバリデーション
4. **HTTPS**: GitHub Pagesで強制適用

---

## 拡張性設計

### 将来の拡張ポイント

```mermaid
mindmap
  root((拡張可能性))
    クラウド同期
      Firebase
      Supabase
      カスタムAPI
    データ分析
      Chart.js
      統計ダッシュボード
      レポート生成
    入力拡張
      OCR
      バーコードスキャン
      音声入力
    出力拡張
      PDF出力
      CSV出力
      印刷最適化
    カテゴリー拡張
      ユーザー定義
      階層構造
      タグシステム
```

---

## テスト戦略

### テスト構造（将来実装）

```mermaid
graph TD
    A[テスト戦略] --> B[ユニットテスト]
    A --> C[統合テスト]
    A --> D[E2Eテスト]
    A --> E[PWAテスト]

    B --> B1[calculation.js]
    B --> B2[calculator-*.js]
    B --> B3[product-simulator.js]

    C --> C1[保存・読込フロー]
    C --> C2[計算フロー]
    C --> C3[シミュレーションフロー]

    D --> D1[ユーザー操作]
    D --> D2[データ永続化]

    E --> E1[オフライン動作]
    E --> E2[インストール]
    E --> E3[更新通知]
```

---

## まとめ

このアプリケーションは以下の特徴を持つ、モダンなPWAアーキテクチャを採用しています：

### 主要特徴

1. **完全オフライン動作**: Service Worker + IndexedDBで実現
2. **モジュラー設計**: 13個の責務分離されたモジュール
3. **状態管理**: 一元化されたAppStateクラス
4. **段階的計算**: 5ステップの明確なフロー
5. **データ永続化**: カテゴリー別のローカルDB管理
6. **PWA対応**: インストール可能、自動更新通知

### 技術的強み

- **依存関係ゼロ**: Pure JavaScript/CSS/HTML
- **レスポンシブ**: モバイル・デスクトップ両対応
- **高速**: ネットワーク不要、ローカル処理
- **保守性**: 明確なモジュール分割、一貫した命名規則
- **拡張性**: プラグイン的に機能追加可能

## セッション管理フロー

### セッション保存・復元

```mermaid
sequenceDiagram
    participant User as ユーザー
    participant App as アプリ
    participant Session as SessionStorage
    participant LS as LocalStorage

    rect rgb(200, 220, 250)
    Note over User,LS: セッション保存フロー
    User->>App: 入力値を変更
    App->>App: 入力イベント検知
    App->>Session: saveSessionState()
    Session->>Session: 入力値を収集
    Session->>Session: モード情報を収集
    Session->>LS: データを保存（タイムスタンプ付き）
    end

    rect rgb(250, 220, 200)
    Note over User,LS: セッション復元フロー
    User->>App: ページをリロード
    App->>Session: restoreSessionState()
    Session->>LS: セッションデータを読み込み
    Session->>Session: 有効期限チェック（24時間）

    alt 有効期限内
        Session-->>App: セッションデータ
        App->>Session: applySessionState()
        Session->>App: 入力フィールドを復元
        Session->>App: モードを復元
        App->>User: 復元完了
    else 期限切れ
        Session->>LS: データを削除
        Session-->>App: null
    end
    end
```

### セッションデータ構造

```javascript
{
  mode: "fixed" | "weight" | "yieldStats",
  yieldMethod: "calculate" | "direct",
  timestamp: 1706400000000,
  inputs: {
    // モード別の入力値
  },
  simulation: {
    expWeight: "100",
    consumable: "10"
  },
  tableData: [
    // 歩留まり統計のテーブルデータ（yieldStatsモードのみ）
  ]
}
```

---

**最終更新**: 2025-01-28
**バージョン**: v3.5
**ドキュメント作成**: Claude Code
