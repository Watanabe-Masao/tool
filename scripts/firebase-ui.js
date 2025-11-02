/**
 * Firebase同期UI
 * 認証画面、同期ボタン、ステータス表示
 */

import {
  initializeFirebase,
  signInAnonymously,
  signUpWithEmail,
  signInWithEmail,
  upgradeAnonymousAccount,
  signOut,
  isSignedIn,
  isAnonymous,
  getCurrentUser,
  sendPasswordResetEmail,
} from './firebase-auth.js';
import {
  syncData,
  uploadToCloud,
  downloadFromCloud,
  getLastSyncTime,
  getIsSyncing,
  setupRealtimeListener,
} from './firebase-sync.js';
import { firebaseFeatures } from './firebase-config.js';
import { showToast } from './toast.js';

let realtimeUnsubscribe = null;

/**
 * Firebase UIを初期化
 */
export async function initializeFirebaseUI() {
  if (!firebaseFeatures.enabled) {
    console.log('Firebase機能は無効です');
    hideFirebaseUI();
    return;
  }

  // Firebaseを初期化
  const initialized = await initializeFirebase();
  if (!initialized) {
    hideFirebaseUI();
    return;
  }

  // UIを表示
  showFirebaseUI();

  // イベントリスナーを設定
  setupEventListeners();

  // 認証状態の変化を監視
  window.addEventListener('authStateChanged', (e) => {
    updateUIForAuthState(e.detail.user);
  });

  // 同期ステータスの変化を監視
  window.addEventListener('syncStatusChanged', (e) => {
    updateSyncStatusUI(e.detail.status, e.detail.lastSyncTime);
  });
}

/**
 * Firebase UIを表示
 */
function showFirebaseUI() {
  const syncButton = document.getElementById('sync-button');
  const authStatus = document.getElementById('auth-status');

  if (syncButton) syncButton.style.display = 'block';
  if (authStatus) authStatus.style.display = 'block';
}

/**
 * Firebase UIを非表示
 */
function hideFirebaseUI() {
  const syncButton = document.getElementById('sync-button');
  const authStatus = document.getElementById('auth-status');

  if (syncButton) syncButton.style.display = 'none';
  if (authStatus) authStatus.style.display = 'none';
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 同期ボタン
  const syncButton = document.getElementById('sync-button');
  if (syncButton) {
    syncButton.addEventListener('click', handleSyncClick);
  }

  // 認証ボタン
  const signInButton = document.getElementById('signin-button');
  if (signInButton) {
    signInButton.addEventListener('click', showAuthModal);
  }

  const signOutButton = document.getElementById('signout-button');
  if (signOutButton) {
    signOutButton.addEventListener('click', handleSignOut);
  }

  // モーダル内のボタン
  const anonymousSignInBtn = document.getElementById('anonymous-signin-btn');
  if (anonymousSignInBtn) {
    anonymousSignInBtn.addEventListener('click', handleAnonymousSignIn);
  }

  const emailSignInBtn = document.getElementById('email-signin-btn');
  if (emailSignInBtn) {
    emailSignInBtn.addEventListener('click', handleEmailSignIn);
  }

  const emailSignUpBtn = document.getElementById('email-signup-btn');
  if (emailSignUpBtn) {
    emailSignUpBtn.addEventListener('click', handleEmailSignUp);
  }

  const upgradeAccountBtn = document.getElementById('upgrade-account-btn');
  if (upgradeAccountBtn) {
    upgradeAccountBtn.addEventListener('click', handleUpgradeAccount);
  }

  const resetPasswordBtn = document.getElementById('reset-password-btn');
  if (resetPasswordBtn) {
    resetPasswordBtn.addEventListener('click', handleResetPassword);
  }

  // モーダルを閉じる
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        closeAuthModal();
      }
    });
  }

  const closeModalBtn = document.getElementById('close-auth-modal');
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeAuthModal);
  }
}

/**
 * 同期ボタンクリック
 */
async function handleSyncClick() {
  if (!isSignedIn()) {
    showAuthModal();
    return;
  }

  const success = await syncData();
  if (success) {
    console.log('同期完了');
  }
}

/**
 * 匿名サインイン
 */
async function handleAnonymousSignIn() {
  try {
    await signInAnonymously();
    closeAuthModal();

    // リアルタイムリスナーを設定
    realtimeUnsubscribe = setupRealtimeListener();
  } catch (error) {
    console.error('匿名サインインエラー:', error);
  }
}

/**
 * メールサインイン
 */
async function handleEmailSignIn() {
  const email = document.getElementById('signin-email').value;
  const password = document.getElementById('signin-password').value;

  if (!email || !password) {
    showToast('メールアドレスとパスワードを入力してください', 'warning');
    return;
  }

  try {
    await signInWithEmail(email, password);
    closeAuthModal();

    // リアルタイムリスナーを設定
    realtimeUnsubscribe = setupRealtimeListener();
  } catch (error) {
    console.error('メールサインインエラー:', error);
  }
}

/**
 * メールサインアップ
 */
async function handleEmailSignUp() {
  const email = document.getElementById('signup-email').value;
  const password = document.getElementById('signup-password').value;
  const confirmPassword = document.getElementById('signup-password-confirm').value;

  if (!email || !password || !confirmPassword) {
    showToast('すべての項目を入力してください', 'warning');
    return;
  }

  if (password !== confirmPassword) {
    showToast('パスワードが一致しません', 'warning');
    return;
  }

  if (password.length < 6) {
    showToast('パスワードは6文字以上で設定してください', 'warning');
    return;
  }

  try {
    await signUpWithEmail(email, password);
    closeAuthModal();

    // リアルタイムリスナーを設定
    realtimeUnsubscribe = setupRealtimeListener();
  } catch (error) {
    console.error('メールサインアップエラー:', error);
  }
}

/**
 * アカウントアップグレード
 */
async function handleUpgradeAccount() {
  const email = document.getElementById('upgrade-email').value;
  const password = document.getElementById('upgrade-password').value;
  const confirmPassword = document.getElementById('upgrade-password-confirm').value;

  if (!email || !password || !confirmPassword) {
    showToast('すべての項目を入力してください', 'warning');
    return;
  }

  if (password !== confirmPassword) {
    showToast('パスワードが一致しません', 'warning');
    return;
  }

  if (password.length < 6) {
    showToast('パスワードは6文字以上で設定してください', 'warning');
    return;
  }

  try {
    await upgradeAnonymousAccount(email, password);
    closeAuthModal();
  } catch (error) {
    console.error('アカウントアップグレードエラー:', error);
  }
}

/**
 * パスワードリセット
 */
async function handleResetPassword() {
  const email = document.getElementById('reset-email').value;

  if (!email) {
    showToast('メールアドレスを入力してください', 'warning');
    return;
  }

  try {
    await sendPasswordResetEmail(email);
  } catch (error) {
    console.error('パスワードリセットエラー:', error);
  }
}

/**
 * サインアウト
 */
async function handleSignOut() {
  try {
    // リアルタイムリスナーを解除
    if (realtimeUnsubscribe) {
      realtimeUnsubscribe();
      realtimeUnsubscribe = null;
    }

    await signOut();
  } catch (error) {
    console.error('サインアウトエラー:', error);
  }
}

/**
 * 認証モーダルを表示
 */
function showAuthModal() {
  console.log('showAuthModal が呼ばれました');
  const modal = document.getElementById('auth-modal');
  console.log('モーダル要素:', modal);

  if (!modal) {
    console.error('auth-modal が見つかりません');
    return;
  }

  // 匿名ユーザーならアップグレード画面を表示
  if (isAnonymous()) {
    console.log('匿名ユーザー: アップグレード画面を表示');
    showUpgradeSection();
  } else {
    console.log('未ログイン: サインイン画面を表示');
    showSignInSection();
  }

  console.log('モーダルを表示します');
  // is-openクラスを追加してモーダルを表示
  modal.classList.add('is-open');
}

/**
 * 認証モーダルを閉じる
 */
function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('is-open');
  }

  // フォームをクリア
  clearAuthForms();
}

/**
 * 認証フォームをクリア
 */
function clearAuthForms() {
  const forms = ['signin-email', 'signin-password', 'signup-email', 'signup-password', 'signup-password-confirm', 'upgrade-email', 'upgrade-password', 'upgrade-password-confirm', 'reset-email'];

  forms.forEach(id => {
    const input = document.getElementById(id);
    if (input) input.value = '';
  });
}

/**
 * サインイン画面を表示
 */
function showSignInSection() {
  hideAllAuthSections();
  const section = document.getElementById('signin-section');
  if (section) section.style.display = 'block';
}

/**
 * サインアップ画面を表示
 */
function showSignUpSection() {
  hideAllAuthSections();
  const section = document.getElementById('signup-section');
  if (section) section.style.display = 'block';
}

/**
 * アップグレード画面を表示
 */
function showUpgradeSection() {
  hideAllAuthSections();
  const section = document.getElementById('upgrade-section');
  if (section) section.style.display = 'block';
}

/**
 * パスワードリセット画面を表示
 */
function showResetSection() {
  hideAllAuthSections();
  const section = document.getElementById('reset-section');
  if (section) section.style.display = 'block';
}

/**
 * すべての認証画面を非表示
 */
function hideAllAuthSections() {
  const sections = ['signin-section', 'signup-section', 'upgrade-section', 'reset-section'];
  sections.forEach(id => {
    const section = document.getElementById(id);
    if (section) section.style.display = 'none';
  });
}

/**
 * 認証状態に応じてUIを更新
 */
function updateUIForAuthState(user) {
  const authStatus = document.getElementById('auth-status');
  const signInButton = document.getElementById('signin-button');
  const signOutButton = document.getElementById('signout-button');
  const syncButton = document.getElementById('sync-button');

  if (user) {
    // ログイン中
    if (authStatus) {
      const userInfo = user.isAnonymous
        ? '匿名ユーザー'
        : user.email || 'ログイン中';
      authStatus.textContent = `☁️ ${userInfo}`;
      authStatus.className = 'auth-status logged-in';
    }

    if (signInButton) signInButton.style.display = 'none';
    if (signOutButton) signOutButton.style.display = 'inline-block';
    if (syncButton) syncButton.disabled = false;
  } else {
    // 未ログイン
    if (authStatus) {
      authStatus.textContent = '☁️ 未ログイン';
      authStatus.className = 'auth-status logged-out';
    }

    if (signInButton) signInButton.style.display = 'inline-block';
    if (signOutButton) signOutButton.style.display = 'none';
    if (syncButton) syncButton.disabled = true;
  }
}

/**
 * 同期ステータスUIを更新
 */
function updateSyncStatusUI(status, lastSyncTime) {
  const syncButton = document.getElementById('sync-button');
  const syncStatus = document.getElementById('sync-status');

  if (!syncButton) return;

  switch (status) {
    case 'uploading':
      syncButton.textContent = '📤 アップロード中...';
      syncButton.disabled = true;
      if (syncStatus) syncStatus.textContent = 'アップロード中...';
      break;

    case 'downloading':
      syncButton.textContent = '📥 ダウンロード中...';
      syncButton.disabled = true;
      if (syncStatus) syncStatus.textContent = 'ダウンロード中...';
      break;

    case 'success':
      syncButton.textContent = '🔄 同期';
      syncButton.disabled = false;
      if (syncStatus && lastSyncTime) {
        syncStatus.textContent = `最終同期: ${formatTime(lastSyncTime)}`;
      }
      break;

    case 'error':
      syncButton.textContent = '🔄 同期';
      syncButton.disabled = false;
      if (syncStatus) syncStatus.textContent = '同期エラー';
      break;

    default:
      syncButton.textContent = '🔄 同期';
      syncButton.disabled = !isSignedIn();
      break;
  }
}

/**
 * 時刻をフォーマット
 */
function formatTime(date) {
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) {
    return 'たった今';
  } else if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分前`;
  } else if (diff < 86400000) {
    return `${Math.floor(diff / 3600000)}時間前`;
  } else {
    return `${Math.floor(diff / 86400000)}日前`;
  }
}

// タブ切り替えリンク
window.showSignInSection = showSignInSection;
window.showSignUpSection = showSignUpSection;
window.showResetSection = showResetSection;
