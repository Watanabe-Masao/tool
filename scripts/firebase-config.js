/**
 * Firebase設定ファイル
 *
 * ⚠️ セキュリティ警告: このファイルは機密情報を含むため、Gitリポジトリから除外されています
 *
 * セットアップ手順：
 * 1. firebase-config.example.js からこのファイルを作成
 * 2. Firebaseコンソールから取得した実際の設定値に置き換える
 *
 * 注意: このファイルを公開リポジトリにコミットしないでください
 */

// Firebase設定値（プロジェクト情報から取得）
// 本番環境用の設定値（このファイルは .gitignore に含まれています）
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
