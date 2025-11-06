# CRUD操作ドキュメント

**バージョン**: v1.0
**最終更新**: 2025-11-03
**対象**: IndexedDB + Firebase Sync を使用したデータ永続化層

## 目次
- [概要](#概要)
- [CRUD操作の全体像](#crud操作の全体像)
- [クラス構造](#クラス構造)
- [Create（作成）](#create作成)
- [Read（読み込み）](#read読み込み)
- [Update（更新）](#update更新)
- [Delete（削除）](#delete削除)
- [エラーハンドリング](#エラーハンドリング)
- [データ同期戦略](#データ同期戦略)

---

## 概要

歩留まり計算ツールは、**2層のデータ永続化戦略**を採用しています：

1. **IndexedDB（ローカル）**: オフライン対応、高速アクセス
2. **Firebase Firestore（クラウド）**: オンライン同期、マルチデバイス対応

### データフロー方針

```
オンライン時:
  Firestore (信頼できる唯一のソース) ⇄ IndexedDB (キャッシュ)

オフライン時:
  IndexedDB (ローカルキャッシュのみ)
```

---

## CRUD操作の全体像

### 操作マトリクス

| 操作 | オンライン | オフライン | 主要ファイル |
|------|----------|----------|------------|
| **Create** | Firestore → IndexedDB | ❌ エラー | `storage.js`, `firebase-sync.js` |
| **Read** | Firestore → IndexedDB | IndexedDB | `storage.js`, `db.js` |
| **Update** | Firestore → IndexedDB | ❌ エラー | `storage.js`, `firebase-sync.js` |
| **Delete** | Firestore → IndexedDB | ❌ エラー | `storage.js`, `firebase-sync.js` |

### アーキテクチャ図

```mermaid
graph TB
    subgraph "UI層"
        UI[ユーザーインターフェース]
    end

    subgraph "ビジネスロジック層"
        Storage[storage.js<br/>データ保存ロジック]
        Validation[validation.js<br/>データ検証]
    end

    subgraph "データアクセス層"
        DB[db.js<br/>IndexedDB操作]
        FirebaseSync[firebase-sync.js<br/>Firestore同期]
        FirebaseAuth[firebase-auth.js<br/>認証管理]
    end

    subgraph "永続化層"
        IDB[(IndexedDB<br/>ローカルキャッシュ)]
        Firestore[(Firestore<br/>信頼できるソース)]
    end

    UI --> Storage
    Storage --> Validation
    Storage --> DB
    Storage --> FirebaseSync
    FirebaseSync --> FirebaseAuth

    DB --> IDB
    FirebaseSync --> Firestore
    FirebaseSync -.キャッシュ更新.-> DB

    style Firestore fill:#ff9800
    style IDB fill:#4caf50
    style Storage fill:#2196f3
```

---

## クラス構造

### YieldCalculatorDB クラス

```mermaid
classDiagram
    class YieldCalculatorDB {
        -db: IDBDatabase
        -openPromise: Promise
        -openRetryCount: number
        -maxRetries: number
        -activeTransactions: number
        -transactionLog: Array
        -maxLogSize: number

        +constructor()
        +generateUUID() string
        +logTransactionStart(operation)
        +logTransactionEnd(operation, success)
        +getTransactionLog() Array
        +sleep(ms) Promise
        +checkDatabaseEnvironment() Object
        +open(retryCount) Promise~IDBDatabase~
        +save(data, options) Promise~number~
        +getById(id) Promise~Object~
        +getAll() Promise~Array~
        +update(id, data) Promise~void~
        +delete(id) Promise~void~
        +search(query) Promise~Array~
        +exportJSON() Promise~Object~
        +importJSON(data) Promise~void~
        +clear() Promise~void~
    }

    class IDBDatabase {
        <<external>>
    }

    YieldCalculatorDB --> IDBDatabase
```

### データモデル

```mermaid
classDiagram
    class CalculationRecord {
        +id: number
        +uuid: string
        +name: string
        +category: string
        +mode: string
        +input: InputData
        +result: ResultData
        +product: ProductData
        +timestamp: number
        +createdAt: string
        +updatedAt: string
        +deleted: boolean
        +deletedAt: string|null
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

---

## Create（作成）

### 処理フロー

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant UI as UI層
    participant Storage as storage.js
    participant Validation as validation.js
    participant Auth as firebase-auth.js
    participant Sync as firebase-sync.js
    participant DB as db.js
    participant Firestore as Firestore
    participant IDB as IndexedDB

    User->>UI: 保存ボタンクリック
    UI->>UI: カテゴリー・商品名入力
    UI->>Storage: saveCalculation(name, mode, inputData, resultData)

    rect rgb(255, 245, 230)
    Note over Storage,Validation: バリデーション
    Storage->>Validation: validateCalculationData()
    alt バリデーションエラー
        Validation-->>Storage: ValidationError
        Storage-->>UI: エラーメッセージ
        UI-->>User: トースト通知（エラー）
    end
    end

    rect rgb(230, 245, 255)
    Note over Storage,Auth: オンラインチェック
    Storage->>Auth: isSignedIn()
    alt オフライン
        Auth-->>Storage: false
        Storage-->>UI: OfflineError
        UI-->>User: 「オンライン時のみ保存可能」
    end
    end

    rect rgb(230, 255, 230)
    Note over Storage,IDB: データ保存（オンライン時）
    Storage->>Sync: saveToCloud(data)
    Sync->>Firestore: collection.add(data)
    Firestore-->>Sync: docRef (uuid)

    Note over Sync: Firestoreに保存成功<br/>→ IndexedDBにキャッシュ
    Sync->>DB: save(data, options)
    DB->>IDB: トランザクション実行
    IDB-->>DB: id
    DB-->>Sync: { id, uuid }
    Sync-->>Storage: { id, uuid }
    Storage-->>UI: id
    UI-->>User: トースト通知（成功）
    end
```

### 主要関数

#### storage.js: saveCalculation()

```javascript
/**
 * 現在の計算データを保存（オンライン時のみ）
 * ベストプラクティス：Firestoreに直接保存 → IndexedDBにキャッシュ
 */
export async function saveCalculation(name, mode, inputData, resultData, category = null, productData = null) {
  // 1. バリデーション
  validateCalculationData({ name, mode, input: inputData, result: resultData, category, productData });

  // 2. オンラインチェック
  if (!isSignedIn()) {
    throw new OfflineError('save');
  }

  // 3. データ準備
  const data = {
    name,
    mode,
    category,
    input: inputData,
    result: resultData,
    product: productData,
    timestamp: Date.now()
  };

  // 4. Firestoreに保存（IndexedDBにもキャッシュ）
  const result = await saveToCloud(data);
  return result.id;
}
```

#### db.js: save()

```javascript
/**
 * データを保存（IndexedDB）
 * @param {Object} data - 保存するデータ
 * @param {Object} options - { uuid: string } Firebase UUIDを含む
 * @returns {Promise<number>} 保存されたレコードのID
 */
async save(data, options = {}) {
  this.logTransactionStart('save');

  const db = await this.open();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const record = {
    ...data,
    uuid: options.uuid || this.generateUUID(),
    timestamp: data.timestamp || Date.now(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    deleted: false,
    deletedAt: null
  };

  const request = store.add(record);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      this.logTransactionEnd('save', true);
      resolve(request.result); // IndexedDB ID
    };
    request.onerror = () => {
      this.logTransactionEnd('save', false);
      reject(createUserFriendlyError(request.error, 'データの保存'));
    };
  });
}
```

### データ整合性保証

| 項目 | 保証内容 |
|------|---------|
| **UUID** | Firestore ドキュメントIDとIndexedDB レコードを紐付け |
| **順序** | Firestore保存成功 → IndexedDBキャッシュ（Firestoreが信頼できるソース） |
| **競合** | 新規作成のため競合なし |
| **リトライ** | Firestore保存失敗時はIndexedDBにも保存しない |

---

## Read（読み込み）

### 処理フロー

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant UI as UI層（履歴モーダル）
    participant Storage as storage.js
    participant Sync as firebase-sync.js
    participant DB as db.js
    participant Firestore as Firestore
    participant IDB as IndexedDB

    User->>UI: 履歴ボタンクリック

    rect rgb(255, 245, 230)
    Note over UI,IDB: 履歴一覧取得
    UI->>Storage: getAllCalculations()
    Storage->>DB: getAll()
    DB->>IDB: クエリ実行（deleted=false）
    IDB-->>DB: データ配列
    DB-->>Storage: calculations[]
    Storage-->>UI: 履歴データ
    UI->>User: 履歴モーダル表示
    end

    rect rgb(230, 255, 230)
    Note over User,Firestore: 読み込み操作（事前同期）
    User->>UI: 読込ボタンクリック
    UI->>UI: ensureFreshDataBeforeDisplay()
    alt オンライン
        UI->>Sync: downloadFromCloud()
        Sync->>Firestore: collection.get()
        Firestore-->>Sync: 全データ
        Sync->>DB: データ差分更新
    end
    UI->>Storage: loadCalculation(id)
    Storage->>DB: getById(id)
    DB->>IDB: クエリ実行
    IDB-->>DB: データ
    DB-->>Storage: { mode, input, result }
    Storage-->>UI: データ復元
    UI->>User: 計算結果表示
    end
```

### 主要関数

#### storage.js: loadCalculation()

```javascript
/**
 * 保存済みのデータから入力値を復元
 *
 * キャッシュ整合性保証:
 * - handleLoadCalculation()内でFirestoreと同期済み（ensureFreshDataBeforeDisplay）
 * - モーダルを開いてから時間が経過している可能性を考慮し、読み込み直前に再同期
 */
export async function loadCalculation(id) {
  validateId(id);

  const data = await db.getById(id);
  if (!data) {
    throw new NotFoundError(id);
  }

  return {
    mode: data.mode,
    input: data.input,
    result: data.result,
    product: data.product,
    category: data.category
  };
}
```

#### db.js: getById()

```javascript
/**
 * IDでデータを取得
 * @param {number} id - レコードID
 * @returns {Promise<Object|null>}
 */
async getById(id) {
  this.logTransactionStart('getById');

  const db = await this.open();
  const transaction = db.transaction([STORE_NAME], 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.get(id);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      this.logTransactionEnd('getById', true);
      const record = request.result;

      // 削除済みレコードはnullを返す
      if (record && record.deleted) {
        resolve(null);
      } else {
        resolve(record);
      }
    };
    request.onerror = () => {
      this.logTransactionEnd('getById', false);
      reject(createUserFriendlyError(request.error, 'データの取得'));
    };
  });
}
```

### データ同期戦略

```mermaid
graph TD
    A[履歴モーダルを開く] --> B{オンライン?}
    B -->|はい| C[Firestoreから全データ取得]
    B -->|いいえ| D[IndexedDBキャッシュを表示]

    C --> E[IndexedDBと差分比較]
    E --> F[新規・更新データをキャッシュ]
    F --> G[削除済みデータを削除]
    G --> H[最新データを表示]

    D --> H

    I[読込ボタンをクリック] --> J{オンライン?}
    J -->|はい| K[Firestoreと再同期<br/>ensureFreshDataBeforeDisplay]
    J -->|いいえ| L[IndexedDBから読み込み]

    K --> M[最新データで復元]
    L --> M

    style C fill:#ff9800
    style F fill:#4caf50
    style K fill:#ff9800
```

---

## Update（更新）

### 処理フロー

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant UI as UI層（履歴モーダル）
    participant Storage as storage.js
    participant Validation as validation.js
    participant Auth as firebase-auth.js
    participant Sync as firebase-sync.js
    participant DB as db.js
    participant Firestore as Firestore
    participant IDB as IndexedDB

    User->>UI: 編集ボタンクリック
    UI->>UI: 商品名・カテゴリー変更
    UI->>Storage: updateCalculation(id, updates)

    rect rgb(255, 245, 230)
    Note over Storage,Validation: バリデーション
    Storage->>Validation: validateId(id)
    Storage->>Validation: validateUpdateData(updates)
    alt バリデーションエラー
        Validation-->>Storage: ValidationError
        Storage-->>UI: エラーメッセージ
        UI-->>User: トースト通知（エラー）
    end
    end

    rect rgb(230, 245, 255)
    Note over Storage,Auth: オンラインチェック
    Storage->>Auth: isSignedIn()
    alt オフライン
        Auth-->>Storage: false
        Storage-->>UI: OfflineError
        UI-->>User: 「オンライン時のみ更新可能」
    end
    end

    rect rgb(230, 255, 230)
    Note over Storage,Firestore: データ更新（オンライン時）
    Storage->>DB: getById(id)
    DB->>IDB: レコード取得
    IDB-->>DB: record
    DB-->>Storage: record

    Storage->>Sync: updateInCloud(record.uuid, updates)
    Sync->>Firestore: doc(uuid).update(updates)
    Firestore-->>Sync: 成功

    Note over Sync: Firestore更新成功<br/>→ IndexedDBキャッシュ更新
    Sync->>DB: update(id, mergedData)
    DB->>IDB: トランザクション実行
    IDB-->>DB: 成功
    DB-->>Sync: void
    Sync-->>Storage: void
    Storage-->>UI: 成功
    UI-->>User: トースト通知（更新完了）
    end
```

### 主要関数

#### storage.js: updateCalculation()

```javascript
/**
 * 保存済みデータを更新（オンライン時のみ）
 * ベストプラクティス：Firestoreを更新 → IndexedDBキャッシュを更新
 */
export async function updateCalculation(id, updates) {
  // 1. バリデーション
  validateId(id);
  validateUpdateData(updates);

  // 2. オンラインチェック
  if (!isSignedIn()) {
    throw new OfflineError('update');
  }

  // 3. 既存データ取得
  const existingData = await db.getById(id);
  if (!existingData) {
    throw new NotFoundError(id);
  }

  // 4. Firestoreを更新（IndexedDBキャッシュも更新）
  await updateInCloud(existingData.uuid, updates);
}
```

#### db.js: update()

```javascript
/**
 * データを更新
 * @param {number} id - レコードID
 * @param {Object} updates - 更新内容
 * @returns {Promise<void>}
 */
async update(id, updates) {
  this.logTransactionStart('update');

  const db = await this.open();
  const transaction = db.transaction([STORE_NAME], 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  // 既存データを取得
  const getRequest = store.get(id);

  return new Promise((resolve, reject) => {
    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (!record || record.deleted) {
        reject(createUserFriendlyError(new Error('Record not found'), 'データの更新'));
        return;
      }

      // データをマージして更新
      const updatedRecord = {
        ...record,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      const putRequest = store.put(updatedRecord);
      putRequest.onsuccess = () => {
        this.logTransactionEnd('update', true);
        resolve();
      };
      putRequest.onerror = () => {
        this.logTransactionEnd('update', false);
        reject(createUserFriendlyError(putRequest.error, 'データの更新'));
      };
    };

    getRequest.onerror = () => {
      this.logTransactionEnd('update', false);
      reject(createUserFriendlyError(getRequest.error, 'データの取得'));
    };
  });
}
```

### データ整合性保証

| 項目 | 保証内容 |
|------|---------|
| **UUID照合** | IndexedDB IDからUUIDを取得し、Firestoreドキュメントを特定 |
| **順序** | Firestore更新成功 → IndexedDBキャッシュ更新（Firestoreが信頼できるソース） |
| **競合** | 楽観的ロック（Firestore Timestamp利用） |
| **ロールバック** | Firestore更新失敗時はIndexedDBを更新しない |

---

## Delete（削除）

### 処理フロー（論理削除）

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant UI as UI層（履歴モーダル）
    participant Storage as storage.js
    participant Auth as firebase-auth.js
    participant Sync as firebase-sync.js
    participant DB as db.js
    participant Firestore as Firestore
    participant IDB as IndexedDB

    User->>UI: 削除ボタンクリック
    UI->>UI: 確認ダイアログ表示
    User->>UI: 「削除」確認
    UI->>Storage: deleteCalculation(id)

    rect rgb(230, 245, 255)
    Note over Storage,Auth: オンラインチェック
    Storage->>Auth: isSignedIn()
    alt オフライン
        Auth-->>Storage: false
        Storage-->>UI: OfflineError
        UI-->>User: 「オンライン時のみ削除可能」
    end
    end

    rect rgb(255, 230, 230)
    Note over Storage,Firestore: 論理削除（オンライン時）
    Storage->>DB: getById(id)
    DB->>IDB: レコード取得
    IDB-->>DB: record
    DB-->>Storage: record

    Storage->>Sync: deleteFromCloud(record.uuid)
    Sync->>Firestore: doc(uuid).update({deleted: true})
    Firestore-->>Sync: 成功

    Note over Sync: Firestore論理削除成功<br/>→ IndexedDBも論理削除
    Sync->>DB: update(id, {deleted: true, deletedAt: ...})
    DB->>IDB: トランザクション実行
    IDB-->>DB: 成功
    DB-->>Sync: void
    Sync-->>Storage: void
    Storage-->>UI: 成功
    UI->>UI: 履歴リストから削除
    UI-->>User: トースト通知（削除完了）
    end
```

### 論理削除 vs 物理削除

| 方式 | メリット | デメリット | 採用状況 |
|------|---------|----------|---------|
| **論理削除** | - 復元可能<br/>- 監査証跡が残る<br/>- 同期が簡単 | - ストレージ増加<br/>- クエリが複雑 | ✅ **現在の実装** |
| **物理削除** | - ストレージ節約<br/>- クエリが単純 | - 復元不可<br/>- 同期が難しい | ❌ 未採用 |

### 主要関数

#### storage.js: deleteCalculation()

```javascript
/**
 * 保存済みデータを削除（オンライン時のみ）
 * ベストプラクティス：Firestoreで論理削除 → IndexedDBキャッシュも論理削除
 */
export async function deleteCalculation(id) {
  // 1. バリデーション
  validateId(id);

  // 2. オンラインチェック
  if (!isSignedIn()) {
    throw new OfflineError('delete');
  }

  // 3. 既存データ取得
  const existingData = await db.getById(id);
  if (!existingData) {
    throw new NotFoundError(id);
  }

  // 4. Firestoreで論理削除（IndexedDBキャッシュも更新）
  await deleteFromCloud(existingData.uuid);
}
```

#### db.js: update() （論理削除用）

```javascript
// deleteフラグを更新するためにupdate()を使用
await db.update(id, {
  deleted: true,
  deletedAt: new Date().toISOString()
});
```

### 全削除機能

```mermaid
sequenceDiagram
    actor User as ユーザー
    participant UI as UI層
    participant Storage as storage.js
    participant Sync as firebase-sync.js
    participant DB as db.js
    participant Firestore as Firestore
    participant IDB as IndexedDB

    User->>UI: クリアボタンクリック
    UI->>UI: 確認ダイアログ表示
    User->>UI: 「全削除」確認
    UI->>Storage: clearAllCalculations()

    Storage->>Sync: clearAllFromCloud()
    Sync->>Firestore: batch.update(全ドキュメント, {deleted: true})
    Firestore-->>Sync: 成功

    Sync->>DB: clear()
    DB->>IDB: トランザクション実行
    IDB-->>DB: 成功
    DB-->>Sync: void
    Sync-->>Storage: void
    Storage-->>UI: 成功
    UI-->>User: トースト通知（全削除完了）
```

---

## エラーハンドリング

### エラー階層構造

```mermaid
classDiagram
    class BaseError {
        +name: string
        +message: string
        +getUserMessage() string
    }

    class ValidationError {
        +field: string
        +value: any
    }

    class NotFoundError {
        +id: number
    }

    class OfflineError {
        +operation: string
    }

    class FirebaseError {
        +code: string
        +originalError: Error
    }

    class IndexedDBError {
        +operation: string
        +originalError: Error
    }

    BaseError <|-- ValidationError
    BaseError <|-- NotFoundError
    BaseError <|-- OfflineError
    BaseError <|-- FirebaseError
    BaseError <|-- IndexedDBError
```

### エラーマッピング

#### IndexedDBエラー → ユーザーメッセージ

```javascript
function createUserFriendlyError(error, operation) {
  let message = `データベース操作に失敗しました: ${operation}`;

  if (error.name === 'QuotaExceededError') {
    message = 'ストレージの容量が不足しています。不要なデータを削除してください。';
  } else if (error.name === 'VersionError') {
    message = 'データベースのバージョンが競合しています。ページを再読み込みしてください。';
  } else if (error.name === 'InvalidStateError') {
    message = 'データベースが無効な状態です。ページを再読み込みしてください。';
  } else if (error.name === 'DataError') {
    message = 'データの形式が正しくありません。';
  } else if (error.name === 'AbortError') {
    message = 'データベース操作が中断されました。';
  }

  const userError = new Error(message);
  userError.originalError = error;
  userError.operation = operation;
  return userError;
}
```

#### Firebaseエラー → ユーザーメッセージ

| Firebaseエラーコード | ユーザーメッセージ |
|---------------------|------------------|
| `permission-denied` | アクセス権限がありません。ログインしてください。 |
| `not-found` | データが見つかりませんでした。 |
| `already-exists` | データが既に存在します。 |
| `resource-exhausted` | 操作の上限に達しました。しばらく待ってから再試行してください。 |
| `unauthenticated` | 認証が必要です。ログインしてください。 |
| `unavailable` | サービスが一時的に利用できません。しばらく待ってから再試行してください。 |

### エラー処理フロー

```mermaid
graph TD
    A[CRUD操作実行] --> B{成功?}
    B -->|はい| C[結果を返す]
    B -->|いいえ| D{エラー種別}

    D -->|ValidationError| E[バリデーションエラー<br/>フィールド名と値を表示]
    D -->|OfflineError| F[オフラインエラー<br/>「オンライン時のみ可能」]
    D -->|NotFoundError| G[データ未発見エラー<br/>「データが見つかりません」]
    D -->|FirebaseError| H[Firebaseエラー<br/>エラーコードをマッピング]
    D -->|IndexedDBError| I[IndexedDBエラー<br/>createUserFriendlyError]

    E --> J[トースト通知表示]
    F --> J
    G --> J
    H --> J
    I --> J

    J --> K[ログに記録]
    K --> L[ユーザーに通知]

    style E fill:#ff9800
    style F fill:#ff9800
    style G fill:#ff9800
    style H fill:#f44336
    style I fill:#f44336
```

---

## データ同期戦略

### 同期タイミング

| イベント | 同期処理 | 理由 |
|---------|---------|------|
| **アプリ起動時** | Firestoreから全データ取得 → IndexedDB更新 | 最新状態を保証 |
| **履歴モーダルを開く** | ensureFreshDataBeforeDisplay() | モーダル表示前に同期 |
| **読込ボタンクリック** | ensureFreshDataBeforeDisplay() | 読み込み直前に再同期 |
| **保存/更新/削除後** | Firestore操作 → IndexedDBキャッシュ | 即座に反映 |
| **定期同期** | ❌ 未実装 | 将来的にバックグラウンド同期を検討 |

### 同期フロー詳細

```mermaid
sequenceDiagram
    participant App as アプリ
    participant Sync as firebase-sync.js
    participant Firestore as Firestore
    participant DB as db.js
    participant IDB as IndexedDB

    rect rgb(230, 245, 255)
    Note over App,IDB: アプリ起動時の同期
    App->>App: DOMContentLoaded
    App->>Sync: downloadFromCloud()
    Sync->>Firestore: collection.get()
    Firestore-->>Sync: 全データ（deleted含む）

    loop 各ドキュメント
        alt 新規データ
            Sync->>DB: save(data, {uuid})
        else 既存データ
            Sync->>DB: update(id, data)
        else 削除済み
            Sync->>DB: update(id, {deleted: true})
        end
    end

    Sync-->>App: 同期完了
    end

    rect rgb(255, 245, 230)
    Note over App,IDB: 表示前の同期
    App->>App: ensureFreshDataBeforeDisplay()
    App->>Sync: isSignedIn()?
    alt オンライン
        App->>Sync: downloadFromCloud()
        Note over Sync: 上記と同じ処理
    else オフライン
        App->>App: IndexedDBキャッシュを使用
    end
    end
```

### 競合解決戦略

| 競合シナリオ | 解決方法 | 実装状況 |
|------------|---------|---------|
| **マルチデバイス同時編集** | Firestore Timestampで最終書き込み優先 | ✅ 実装済み |
| **オフライン中の編集** | オフライン編集を許可しない | ✅ 実装済み |
| **削除済みデータの復元** | 論理削除フラグで管理 | ✅ 実装済み |

---

## パフォーマンス最適化

### トランザクション管理（Safari対応）

```javascript
class YieldCalculatorDB {
  constructor() {
    this.activeTransactions = 0; // 同時実行トランザクション数
    this.transactionLog = []; // デバッグ用ログ
  }

  logTransactionStart(operation) {
    this.activeTransactions++;
    if (this.activeTransactions > 2) {
      console.warn(`⚠️ 複数トランザクション検出: ${this.activeTransactions}個同時実行中`);
    }
  }

  logTransactionEnd(operation, success = true) {
    this.activeTransactions = Math.max(0, this.activeTransactions - 1);
  }
}
```

### インデックス戦略

```javascript
// データベース初期化時にインデックスを作成
objectStore.createIndex('timestamp', 'timestamp', { unique: false });
objectStore.createIndex('name', 'name', { unique: false });
objectStore.createIndex('mode', 'mode', { unique: false });
objectStore.createIndex('category', 'category', { unique: false });
objectStore.createIndex('uuid', 'uuid', { unique: true });
objectStore.createIndex('deleted', 'deleted', { unique: false });
```

### クエリ最適化

```javascript
// ❌ 悪い例: 全データ取得後にフィルタリング
const allData = await db.getAll();
const activeData = allData.filter(item => !item.deleted);

// ✅ 良い例: インデックスを使用してフィルタリング
const activeData = await db.getAllActive(); // deleted=falseのみ取得
```

---

## セキュリティ

### データ検証

```javascript
// validation.js

export function validateCalculationData(data) {
  if (!data.name || data.name.trim() === '') {
    throw new ValidationError('name', data.name, '商品名は必須です');
  }

  if (!['fixed', 'weight'].includes(data.mode)) {
    throw new ValidationError('mode', data.mode, '無効な計算モードです');
  }

  // 入力データの型チェック
  if (typeof data.input.unitCost !== 'number' || data.input.unitCost < 0) {
    throw new ValidationError('unitCost', data.input.unitCost, '原価は0以上の数値である必要があります');
  }

  // ... その他のバリデーション
}
```

### アクセス制御

```mermaid
graph TD
    A[CRUD操作リクエスト] --> B{ユーザー認証}
    B -->|未認証| C[認証エラー]
    B -->|認証済み| D{操作種別}

    D -->|Create/Update/Delete| E{オンライン?}
    D -->|Read| F{データソース}

    E -->|いいえ| G[OfflineError]
    E -->|はい| H[Firestore操作]

    F -->|オンライン| I[Firestore + IndexedDB]
    F -->|オフライン| J[IndexedDBのみ]

    H --> K[Firestoreセキュリティルール適用]
    K --> L{権限チェック}
    L -->|拒否| M[permission-denied]
    L -->|許可| N[操作実行]

    style C fill:#f44336
    style G fill:#ff9800
    style M fill:#f44336
```

---

## まとめ

### CRUD操作の特徴

| 操作 | 主要戦略 | オフライン対応 |
|------|---------|--------------|
| **Create** | Firestore First | ❌ |
| **Read** | Cache First with Sync | ✅ |
| **Update** | Firestore First | ❌ |
| **Delete** | Firestore First（論理削除） | ❌ |

### 設計の強み

1. **Firestoreを信頼できるソース（Single Source of Truth）とする明確な方針**
2. **IndexedDBはキャッシュとして機能**
3. **論理削除による監査証跡の保持**
4. **ユーザーフレンドリーなエラーメッセージ**
5. **Safari対応のトランザクション管理**
6. **段階的な同期戦略（ensureFreshDataBeforeDisplay）**

### 今後の拡張可能性

- オフライン編集のサポート（ローカル変更キュー）
- 競合解決UIの実装
- バックグラウンド同期（Service Worker Sync API）
- データ圧縮（大量データ対応）
- 監査ログの可視化

---

**ドキュメント作成**: 2025-11-03
**バージョン**: v1.0
**作成者**: Claude Code
