/**
 * Firebase設定ファイル（テンプレート）
 *
 * セットアップ手順：
 * 1. このファイルを firebase-config.js にコピー
 *    $ cp scripts/firebase-config.example.js scripts/firebase-config.js
 * 2. Firebaseコンソール (https://console.firebase.google.com/) でプロジェクトを作成
 * 3. プロジェクト設定 > 全般 > マイアプリ > ウェブアプリを追加
 * 4. 以下の設定値をFirebaseコンソールからコピーして貼り付け
 * 5. Authentication > Sign-in method で「匿名」と「メール/パスワード」を有効化
 * 6. Firestore Database を作成（テストモードで開始）
 *
 * 注意: firebase-config.js は .gitignore に追加されており、Git管理対象外です
 */

// Firebase設定値（プロジェクト情報から取得）
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY_HERE",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Firebase機能の有効/無効切り替え
export const firebaseFeatures = {
  enabled: true, // Firebase同期を有効化
  autoSync: true, // 自動同期を有効にする
  syncInterval: 300000, // 自動同期の間隔（ミリ秒、デフォルト5分）
};

/**
 * Firebaseセキュリティルール（Firestoreルール）
 *
 * Firebaseコンソール > Firestore Database > ルール に以下を設定：
 *
 * rules_version = '2';
 * service cloud.firestore {
 *   match /databases/{database}/documents {
 *     // ユーザーは自分のデータのみアクセス可能
 *     match /users/{userId}/history/{historyId} {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *
 *     // ユーザー設定
 *     match /users/{userId}/settings/sync {
 *       allow read, write: if request.auth != null && request.auth.uid == userId;
 *     }
 *   }
 * }
 */
