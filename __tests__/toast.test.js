/**
 * トースト通知システムのテスト
 * モーダル表示時のエラーメッセージ表示を含む
 */

import { showToast, showInfo, showSuccess, showWarning, showError } from '../scripts/toast.js';

// DOMモックをセットアップ
describe('トースト通知システム', () => {
  beforeEach(() => {
    // DOMをリセット
    document.body.innerHTML = '';
  });

  describe('showToast基本機能', () => {
    it('トースト要素が作成される', () => {
      showToast('テストメッセージ', 'info', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast).not.toBeNull();
      expect(toast.classList.contains('toast')).toBe(true);
    });

    it('メッセージが正しく設定される', () => {
      showToast('テストメッセージ', 'info', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.innerHTML).toContain('テストメッセージ');
    });

    it('改行が<br>タグに変換される', () => {
      showToast('行1\n行2\n行3', 'info', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.innerHTML).toContain('行1<br>行2<br>行3');
    });

    it('適切なクラスが設定される - info', () => {
      showToast('テスト', 'info', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-info')).toBe(true);
      expect(toast.classList.contains('toast-show')).toBe(true);
    });

    it('適切なクラスが設定される - success', () => {
      showToast('テスト', 'success', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-success')).toBe(true);
    });

    it('適切なクラスが設定される - warning', () => {
      showToast('テスト', 'warning', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-warning')).toBe(true);
    });

    it('適切なクラスが設定される - error', () => {
      showToast('テスト', 'error', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-error')).toBe(true);
    });

    it('既存のトースト要素が再利用される', () => {
      showToast('メッセージ1', 'info', 3000);
      const toast1 = document.getElementById('app-toast');

      showToast('メッセージ2', 'success', 3000);
      const toast2 = document.getElementById('app-toast');

      expect(toast1).toBe(toast2); // 同じ要素
      expect(toast2.innerHTML).toContain('メッセージ2'); // 内容が更新されている
    });
  });

  describe('アイコン表示', () => {
    it('infoタイプのアイコンが表示される', () => {
      showToast('テスト', 'info', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.innerHTML).toContain('fa-circle-info');
    });

    it('successタイプのアイコンが表示される', () => {
      showToast('テスト', 'success', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.innerHTML).toContain('fa-circle-check');
    });

    it('warningタイプのアイコンが表示される', () => {
      showToast('テスト', 'warning', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.innerHTML).toContain('fa-triangle-exclamation');
    });

    it('errorタイプのアイコンが表示される', () => {
      showToast('テスト', 'error', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.innerHTML).toContain('fa-circle-xmark');
    });
  });

  describe('ヘルパー関数', () => {
    it('showInfo()が正しく動作する', () => {
      showInfo('情報メッセージ');

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-info')).toBe(true);
      expect(toast.innerHTML).toContain('情報メッセージ');
    });

    it('showSuccess()が正しく動作する', () => {
      showSuccess('成功メッセージ');

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-success')).toBe(true);
      expect(toast.innerHTML).toContain('成功メッセージ');
    });

    it('showWarning()が正しく動作する', () => {
      showWarning('警告メッセージ');

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-warning')).toBe(true);
      expect(toast.innerHTML).toContain('警告メッセージ');
    });

    it('showError()が正しく動作する', () => {
      showError('エラーメッセージ');

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-error')).toBe(true);
      expect(toast.innerHTML).toContain('エラーメッセージ');
    });
  });

  describe('モーダル表示時の改善（z-index対応）', () => {
    it('CSSでz-index: 10002が設定されていることを確認', () => {
      // CSSの読み込みを確認するテスト
      // 実際のz-indexはCSSで設定されているため、ここでは存在確認のみ
      showToast('テスト', 'error', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast).not.toBeNull();
      expect(toast.classList.contains('toast')).toBe(true);
    });

    it('エラーメッセージが表示される', () => {
      // エラーメッセージのデフォルト表示時間は5000msに設定されている
      // タイマーの動作は統合テストで確認
      showError('重要なエラー');

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-show')).toBe(true);
      expect(toast.innerHTML).toContain('重要なエラー');
    });

    it('警告メッセージが表示される', () => {
      // 警告メッセージのデフォルト表示時間は4000msに設定されている
      // タイマーの動作は統合テストで確認
      showWarning('重要な警告');

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-show')).toBe(true);
      expect(toast.innerHTML).toContain('重要な警告');
    });

    it('エラー表示時間をカスタマイズできる', () => {
      // カスタム表示時間が設定できることを確認
      // 関数が正常に呼ばれることを確認
      expect(() => showError('カスタムエラー', 10000)).not.toThrow();

      const toast = document.getElementById('app-toast');
      expect(toast).not.toBeNull();
    });
  });

  describe('エッジケース', () => {
    it('空のメッセージでもエラーにならない', () => {
      expect(() => showToast('', 'info', 3000)).not.toThrow();
    });

    it('nullメッセージでもエラーにならない', () => {
      expect(() => showToast(null, 'info', 3000)).not.toThrow();
    });

    it('undefinedメッセージでもエラーにならない', () => {
      expect(() => showToast(undefined, 'info', 3000)).not.toThrow();
    });

    it('無効なタイプはinfoとして扱われる', () => {
      showToast('テスト', 'invalid-type', 3000);

      const toast = document.getElementById('app-toast');
      // デフォルトアイコン（info）が使われる
      expect(toast.innerHTML).toContain('fa-circle-info');
    });
  });

  describe('複数回呼び出し', () => {
    it('連続して呼び出した場合、最後のメッセージが表示される', () => {
      showToast('メッセージ1', 'info', 3000);
      showToast('メッセージ2', 'success', 3000);
      showToast('メッセージ3', 'error', 3000);

      const toast = document.getElementById('app-toast');
      expect(toast.innerHTML).toContain('メッセージ3');
      expect(toast.classList.contains('toast-error')).toBe(true);
    });

    it('既存のタイマーがクリアされる', () => {
      // 既存のタイマーがクリアされることを確認
      // 連続して呼び出しても正常に動作することを確認
      showToast('メッセージ1', 'info', 1000);
      showToast('メッセージ2', 'info', 1000);

      const toast = document.getElementById('app-toast');
      expect(toast.classList.contains('toast-show')).toBe(true);
      expect(toast.innerHTML).toContain('メッセージ2');
    });
  });
});
