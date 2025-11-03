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
  downloadToFile,
  uploadFromFile,
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

  // データベースリセットボタン（iOS Safari対応）
  const resetDbButton = document.getElementById('reset-db-button');
  if (resetDbButton) {
    resetDbButton.addEventListener('click', handleResetDatabase);
  }

  // 同期状態確認ボタン（iOS Safari対応）
  const checkSyncStatusButton = document.getElementById('check-sync-status-button');
  if (checkSyncStatusButton) {
    checkSyncStatusButton.addEventListener('click', handleCheckSyncStatus);
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

  // 手動ダウンロード/アップロードボタン
  const downloadFileBtn = document.getElementById('download-file-btn');
  if (downloadFileBtn) {
    downloadFileBtn.addEventListener('click', handleDownloadFile);
  }

  const uploadFileBtn = document.getElementById('upload-file-btn');
  if (uploadFileBtn) {
    uploadFileBtn.addEventListener('click', handleUploadFileClick);
  }

  const uploadFileInput = document.getElementById('upload-file-input');
  if (uploadFileInput) {
    uploadFileInput.addEventListener('change', handleUploadFileChange);
  }

  // Firestoreクリーンアップボタン
  const cleanupFirestoreBtn = document.getElementById('cleanup-firestore-button');
  if (cleanupFirestoreBtn) {
    cleanupFirestoreBtn.addEventListener('click', handleCleanupFirestore);
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

  try {
    const success = await syncData();
    if (success) {
      console.log('同期完了');
    }
  } catch (error) {
    console.error('同期エラー:', error);
    showToast('同期に失敗しました。詳細はコンソールを確認してください。', 'error');
  }
}

/**
 * ファイルダウンロードボタンクリック
 */
async function handleDownloadFile() {
  if (!isSignedIn()) {
    showAuthModal();
    return;
  }

  try {
    await downloadToFile();
  } catch (error) {
    console.error('ファイルダウンロードエラー:', error);
    showToast('ファイルのダウンロードに失敗しました。', 'error');
  }
}

/**
 * ファイルアップロードボタンクリック
 */
function handleUploadFileClick() {
  if (!isSignedIn()) {
    showAuthModal();
    return;
  }

  const uploadFileInput = document.getElementById('upload-file-input');
  if (uploadFileInput) {
    uploadFileInput.click();
  }
}

/**
 * ファイル選択時
 */
async function handleUploadFileChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    await uploadFromFile(file);
  } catch (error) {
    console.error('ファイルアップロードエラー:', error);
    showToast('ファイルのアップロードに失敗しました。', 'error');
  } finally {
    // ファイル入力をリセット
    event.target.value = '';
  }
}

/**
 * Firestoreクリーンアップボタンクリック
 */
async function handleCleanupFirestore() {
  if (!isSignedIn()) {
    showAuthModal();
    return;
  }

  try {
    console.log('🧹 Firestoreクリーンアップを開始します...');
    const user = getCurrentUser();
    const firestore = firebase.firestore();

    // 全データを取得
    const snapshot = await firestore
      .collection('users')
      .doc(user.uid)
      .collection('history')
      .get();

    console.log(`📦 取得したデータ: ${snapshot.size}件`);

    if (snapshot.empty) {
      showToast('クリーンアップするデータがありません', 'info');
      return;
    }

    // データをグループ化（name, category, timestampが同じものを重複とみなす）
    const dataMap = new Map();

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const key = `${data.name || 'unknown'}_${data.category || 'unknown'}_${data.timestamp || 0}`;

      if (!dataMap.has(key)) {
        dataMap.set(key, []);
      }

      dataMap.get(key).push({
        docId: doc.id,
        data: data,
        hasUuid: !!data.uuid,
        hasFirestoreId: !!data.firestoreId,
        updatedAt: data.updatedAt?.toDate?.() || new Date(0)
      });
    });

    console.log(`📊 ユニークなデータグループ: ${dataMap.size}個`);

    // 重複を検出して削除リストを作成
    const toDelete = [];
    const toKeep = [];

    dataMap.forEach((items, key) => {
      if (items.length === 1) {
        // 重複なし
        toKeep.push(items[0]);
      } else {
        // 重複あり: 最適なデータを選択
        console.log(`⚠️ [${key}] ${items.length}件の重複を検出`);

        // ソート優先順位: UUID形式のデータを優先 → 最新のupdatedAtを優先
        items.sort((a, b) => {
          if (a.hasUuid && !b.hasUuid) return -1;
          if (!a.hasUuid && b.hasUuid) return 1;
          if (a.hasFirestoreId && !b.hasFirestoreId) return -1;
          if (!a.hasFirestoreId && b.hasFirestoreId) return 1;
          return b.updatedAt - a.updatedAt;
        });

        // 最初の1件を保持、残りを削除
        toKeep.push(items[0]);
        for (let i = 1; i < items.length; i++) {
          toDelete.push(items[i]);
        }
      }
    });

    console.log('\n📊 クリーンアップサマリー:');
    console.log(`  保持: ${toKeep.length}件`);
    console.log(`  削除: ${toDelete.length}件`);

    if (toDelete.length === 0) {
      showToast('削除する重複データがありません', 'info');
      return;
    }

    // 確認ダイアログ
    const confirmed = confirm(
      `Firestoreから${toDelete.length}件の重複データを削除します。\n\n` +
      `現在: ${snapshot.size}件\n` +
      `削除後: ${toKeep.length}件\n\n` +
      `実行しますか？`
    );

    if (!confirmed) {
      console.log('❌ クリーンアップをキャンセルしました');
      return;
    }

    showToast('重複データを削除中...', 'info');

    // バッチ削除（500件ずつ）
    let deletedCount = 0;
    const batchSize = 500;

    for (let i = 0; i < toDelete.length; i += batchSize) {
      const batch = firestore.batch();
      const chunk = toDelete.slice(i, i + batchSize);

      chunk.forEach(item => {
        const docRef = firestore
          .collection('users')
          .doc(user.uid)
          .collection('history')
          .doc(item.docId);
        batch.delete(docRef);
      });

      await batch.commit();
      deletedCount += chunk.length;
      console.log(`🗑️ 削除完了: ${deletedCount}/${toDelete.length}件`);
    }

    console.log('\n✅ クリーンアップ完了!');
    showToast(`クリーンアップ完了! 削除: ${deletedCount}件、残り: ${toKeep.length}件`, 'success');

    // 完了後にダウンロードを促す
    const shouldDownload = confirm(
      'クリーンアップが完了しました。\n\nダウンロードボタンを押してデータを再同期しますか？'
    );

    if (shouldDownload) {
      await downloadFromCloud();
    }
  } catch (error) {
    console.error('❌ クリーンアップエラー:', error);
    showToast(`クリーンアップに失敗しました: ${error.message}`, 'error');
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
  const modal = document.getElementById('auth-modal');

  if (!modal) {
    console.error('auth-modal が見つかりません');
    return;
  }

  // 匿名ユーザーならアップグレード画面を表示
  if (isAnonymous()) {
    showUpgradeSection();
  } else {
    showSignInSection();
  }

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
  const downloadFileBtn = document.getElementById('download-file-btn');
  const uploadFileBtn = document.getElementById('upload-file-btn');
  const cleanupFirestoreBtn = document.getElementById('cleanup-firestore-button');
  const deletedDataBtn = document.getElementById('deleted-data-button');

  if (user) {
    // ログイン中
    if (authStatus) {
      authStatus.textContent = '☁️ ログイン済み';
      authStatus.className = 'status-badge logged-in';
    }

    if (signInButton) signInButton.style.display = 'none';
    if (signOutButton) signOutButton.style.display = 'inline-block';
    if (syncButton) syncButton.disabled = false;
    if (downloadFileBtn) downloadFileBtn.disabled = false;
    if (uploadFileBtn) uploadFileBtn.disabled = false;
    if (cleanupFirestoreBtn) cleanupFirestoreBtn.disabled = false;
    if (deletedDataBtn) deletedDataBtn.disabled = false;
  } else {
    // 未ログイン
    if (authStatus) {
      authStatus.textContent = '☁️ 未ログイン';
      authStatus.className = 'status-badge logged-out';
    }

    if (signInButton) signInButton.style.display = 'inline-block';
    if (signOutButton) signOutButton.style.display = 'none';
    if (syncButton) syncButton.disabled = true;
    if (downloadFileBtn) downloadFileBtn.disabled = true;
    if (uploadFileBtn) uploadFileBtn.disabled = true;
    if (cleanupFirestoreBtn) cleanupFirestoreBtn.disabled = true;
    if (deletedDataBtn) deletedDataBtn.disabled = true;
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

/**
 * データベースリセット処理（iOS Safari対応）
 */
async function handleResetDatabase() {
  const confirmed = confirm(
    'データベースをリセットしますか？\n\n' +
    'この操作により、すべてのローカルデータが削除されます。\n' +
    'クラウド同期を使用している場合は、再度ダウンロードできます。\n\n' +
    '続行しますか？'
  );

  if (!confirmed) {
    return;
  }

  try {
    const DB_NAME = 'YieldCalculatorDB';
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onsuccess = () => {
      showToast('データベースを削除しました。ページを再読み込みします...', 'success');
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    };

    deleteRequest.onerror = (event) => {
      console.error('データベース削除エラー:', event.target.error);
      showToast('データベースの削除に失敗しました', 'error');
    };

    deleteRequest.onblocked = () => {
      showToast('データベース削除がブロックされました。すべてのタブを閉じてから再試行してください', 'warning');
    };
  } catch (err) {
    console.error('データベース削除に失敗:', err);
    showToast('データベースの削除に失敗しました', 'error');
  }
}

/**
 * 同期状態を確認（iOS Safari対応）
 */
async function handleCheckSyncStatus() {
  try {
    showToast('状態を確認中...', 'info');

    // 認証状態を確認
    const signedIn = isSignedIn();
    const user = getCurrentUser();
    const anonymous = isAnonymous();

    // IndexedDBのデータ数を取得
    const { db } = await import('./db.js');
    await db.open();
    const localData = await db.getAll();
    const localCount = localData.length;

    // 最終同期時刻を取得
    const lastSync = getLastSyncTime();
    const lastSyncStr = lastSync
      ? `${lastSync.toLocaleString('ja-JP')}\n（${formatTime(lastSync)}）`
      : '未同期';

    // 状態メッセージを作成
    let statusMessage = '【同期状態】\n\n';

    // 認証状態
    statusMessage += '■ ログイン状態\n';
    if (signedIn) {
      statusMessage += `✅ ログイン済み\n`;
      statusMessage += `   種類: ${anonymous ? '匿名' : 'メールアドレス'}\n`;
      statusMessage += `   UID: ${user.uid.substring(0, 8)}...\n`;
    } else {
      statusMessage += `❌ 未ログイン\n`;
    }
    statusMessage += '\n';

    // ローカルデータ
    statusMessage += '■ ローカルデータ\n';
    statusMessage += `   件数: ${localCount}件\n`;
    statusMessage += '\n';

    // 同期状態
    statusMessage += '■ 最終同期時刻\n';
    statusMessage += `   ${lastSyncStr}\n`;
    statusMessage += '\n';

    // 推奨アクション
    statusMessage += '【推奨アクション】\n';
    if (!signedIn) {
      statusMessage += '⚠️ ログインしてください\n';
    } else if (localCount === 0 && lastSync) {
      statusMessage += '⚠️ ローカルにデータがありません\n';
      statusMessage += '   「🔄 同期」ボタンを押して\n   クラウドからダウンロードしてください\n';
    } else if (localCount === 0 && !lastSync) {
      statusMessage += 'ℹ️ データがありません\n';
      statusMessage += '   新規計算を実行してください\n';
    } else if (!lastSync) {
      statusMessage += 'ℹ️ 同期を実行してください\n';
      statusMessage += '   「🔄 同期」ボタンを押してください\n';
    } else {
      statusMessage += '✅ 正常に動作しています\n';
    }

    alert(statusMessage);

  } catch (err) {
    console.error('状態確認エラー:', err);
    alert(
      '状態確認に失敗しました。\n\n' +
      `エラー: ${err.message}\n\n` +
      '詳細はコンソールログをご確認ください。'
    );
  }
}

// タブ切り替えリンク
window.showSignInSection = showSignInSection;
window.showSignUpSection = showSignUpSection;
window.showResetSection = showResetSection;
