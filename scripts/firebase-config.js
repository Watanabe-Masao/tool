/**
 * Firebase設定ファイル
 *
 * 使い方：
 * 1. Firebaseコンソール (https://console.firebase.google.com/) でプロジェクトを作成
 * 2. プロジェクト設定 > 全般 > マイアプリ > ウェブアプリを追加
 * 3. 以下の設定値をFirebaseコンソールからコピー
 * 4. Authentication > Sign-in method で「匿名」と「メール/パスワード」を有効化
 * 5. Firestore Database を作成（テストモードで開始）
 */

// Firebase設定値（プロジェクト情報から取得）
export const firebaseConfig = {
  apiKey: "AIzaSyA7UMMKgnwweA8PJYQIL7zvhBexqyiCi0k",
  authDomain: "yield-calculator-ffc3a.firebaseapp.com",
  projectId: "yield-calculator-ffc3a",
  storageBucket: "yield-calculator-ffc3a.appspot.com",
  messagingSenderId: "31235016265",
  appId: "1:31235016265:web:65b8f13d9e7408a9472198"
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
