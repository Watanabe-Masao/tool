/**
 * Firebase認証モジュール
 * 匿名認証とメール/パスワード認証をサポート
 */

import { firebaseConfig, firebaseFeatures } from './firebase-config.js';
import { showToast } from './toast.js';

let auth = null;
let currentUser = null;

/**
 * Firebaseを初期化
 */
export async function initializeFirebase() {
  if (!firebaseFeatures.enabled) {
    console.log('Firebase機能は無効です');
    return false;
  }

  try {
    // Firebase SDKの読み込み確認
    if (typeof firebase === 'undefined') {
      console.error('Firebase SDKが読み込まれていません');
      return false;
    }

    // Firebase初期化
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    auth = firebase.auth();

    // オフライン対応（Firestore永続化）
    // 注: enablePersistence()はFirebase v9で非推奨となりました
    // ただし、アプリ側でIndexedDBを使用しているため、Firestoreの永続化は必須ではありません
    // 将来的にFirebase v10に移行する際は、FirestoreSettings.cacheを使用します
    //
    // firebase.firestore().enablePersistence({ synchronizeTabs: true })
    //   .catch((err) => {
    //     if (err.code === 'failed-precondition') {
    //       console.warn('複数のタブが開いています。永続化は1つのタブでのみ有効です。');
    //     } else if (err.code === 'unimplemented') {
    //       console.warn('このブラウザは永続化をサポートしていません。');
    //     }
    //   });

    // 認証状態の監視
    auth.onAuthStateChanged((user) => {
      currentUser = user;
      updateAuthUI(user);

      if (user) {
        console.log('ログイン中:', user.isAnonymous ? '匿名' : user.email);

        // 自動同期が有効な場合、同期を開始
        if (firebaseFeatures.autoSync) {
          startAutoSync();
        }
      } else {
        console.log('未ログイン');
        stopAutoSync();
      }
    });

    return true;
  } catch (error) {
    console.error('Firebase初期化エラー:', error);
    showToast('Firebase初期化に失敗しました', 'error');
    return false;
  }
}

/**
 * 匿名でサインイン
 */
export async function signInAnonymously() {
  try {
    const result = await auth.signInAnonymously();
    showToast('匿名ログインしました', 'success');
    return result.user;
  } catch (error) {
    console.error('匿名ログインエラー:', error);
    showToast(`匿名ログインに失敗: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * メールアドレスとパスワードでサインアップ
 */
export async function signUpWithEmail(email, password) {
  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    showToast('アカウントを作成しました', 'success');
    return result.user;
  } catch (error) {
    console.error('サインアップエラー:', error);
    let message = 'アカウント作成に失敗しました';

    if (error.code === 'auth/email-already-in-use') {
      message = 'このメールアドレスは既に使用されています';
    } else if (error.code === 'auth/invalid-email') {
      message = 'メールアドレスの形式が正しくありません';
    } else if (error.code === 'auth/weak-password') {
      message = 'パスワードは6文字以上で設定してください';
    }

    showToast(message, 'error');
    throw error;
  }
}

/**
 * メールアドレスとパスワードでサインイン
 */
export async function signInWithEmail(email, password) {
  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    showToast('ログインしました', 'success');
    return result.user;
  } catch (error) {
    console.error('ログインエラー:', error);
    let message = 'ログインに失敗しました';

    if (error.code === 'auth/user-not-found') {
      message = 'ユーザーが見つかりません';
    } else if (error.code === 'auth/wrong-password') {
      message = 'パスワードが正しくありません';
    } else if (error.code === 'auth/invalid-email') {
      message = 'メールアドレスの形式が正しくありません';
    }

    showToast(message, 'error');
    throw error;
  }
}

/**
 * 匿名アカウントをメールアカウントにアップグレード
 */
export async function upgradeAnonymousAccount(email, password) {
  if (!currentUser || !currentUser.isAnonymous) {
    throw new Error('匿名アカウントではありません');
  }

  try {
    const credential = firebase.auth.EmailAuthProvider.credential(email, password);
    const result = await currentUser.linkWithCredential(credential);
    showToast('アカウントをアップグレードしました', 'success');
    return result.user;
  } catch (error) {
    console.error('アカウントアップグレードエラー:', error);
    let message = 'アカウントのアップグレードに失敗しました';

    if (error.code === 'auth/email-already-in-use') {
      message = 'このメールアドレスは既に使用されています';
    } else if (error.code === 'auth/invalid-email') {
      message = 'メールアドレスの形式が正しくありません';
    } else if (error.code === 'auth/weak-password') {
      message = 'パスワードは6文字以上で設定してください';
    }

    showToast(message, 'error');
    throw error;
  }
}

/**
 * サインアウト
 */
export async function signOut() {
  try {
    await auth.signOut();
    showToast('ログアウトしました', 'success');
  } catch (error) {
    console.error('ログアウトエラー:', error);
    showToast('ログアウトに失敗しました', 'error');
    throw error;
  }
}

/**
 * 現在のユーザーを取得
 */
export function getCurrentUser() {
  return currentUser;
}

/**
 * ログイン状態を確認
 */
export function isSignedIn() {
  return currentUser !== null;
}

/**
 * 匿名ユーザーかどうか確認
 */
export function isAnonymous() {
  return currentUser && currentUser.isAnonymous;
}

/**
 * 認証UIを更新
 */
function updateAuthUI(user) {
  const event = new CustomEvent('authStateChanged', {
    detail: { user }
  });
  window.dispatchEvent(event);
}

/**
 * 自動同期タイマーID
 */
let autoSyncTimer = null;

/**
 * 自動同期を開始
 */
function startAutoSync() {
  if (autoSyncTimer) {
    return; // 既に開始している
  }

  // 即座に1回同期
  syncData();

  // 定期的に同期
  autoSyncTimer = setInterval(() => {
    syncData();
  }, firebaseFeatures.syncInterval);

  console.log(`自動同期を開始しました（${firebaseFeatures.syncInterval / 1000}秒ごと）`);
}

/**
 * 自動同期を停止
 */
function stopAutoSync() {
  if (autoSyncTimer) {
    clearInterval(autoSyncTimer);
    autoSyncTimer = null;
    console.log('自動同期を停止しました');
  }
}

/**
 * データ同期（実装は firebase-sync.js で定義）
 */
async function syncData() {
  // この関数は firebase-sync.js からインポートされる
  const event = new CustomEvent('requestSync');
  window.dispatchEvent(event);
}

/**
 * パスワードリセットメールを送信
 */
export async function sendPasswordResetEmail(email) {
  try {
    await auth.sendPasswordResetEmail(email);
    showToast('パスワードリセットメールを送信しました', 'success');
  } catch (error) {
    console.error('パスワードリセットエラー:', error);
    let message = 'パスワードリセットメールの送信に失敗しました';

    if (error.code === 'auth/user-not-found') {
      message = 'ユーザーが見つかりません';
    } else if (error.code === 'auth/invalid-email') {
      message = 'メールアドレスの形式が正しくありません';
    }

    showToast(message, 'error');
    throw error;
  }
}
