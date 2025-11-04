/**
 * ヘルプモーダルの初期化
 */

export function initializeHelpModal() {
  const helpModal = document.getElementById('helpModal');
  const helpModalContent = document.getElementById('helpModalContent');
  const closeHelpModal = document.getElementById('closeHelpModal');

  if (!helpModal || !helpModalContent || !closeHelpModal) {
    console.warn('ヘルプモーダル要素が見つかりません');
    return;
  }

  // すべてのhelp-iconにクリックイベントを追加
  document.addEventListener('click', (e) => {
    const helpIcon = e.target.closest('.help-icon');
    if (helpIcon) {
      e.preventDefault();
      e.stopPropagation();

      // titleアトリビュートから内容を取得
      const title = helpIcon.getAttribute('title');
      if (title) {
        // パイプ記号で改行に変換
        const formattedContent = title.replace(/\|/g, '<br>');
        helpModalContent.innerHTML = formattedContent;

        // モーダルを表示
        helpModal.style.display = 'flex';
        document.body.classList.add('modal-open');
      }
    }
  });

  // 閉じるボタン
  closeHelpModal.addEventListener('click', () => {
    helpModal.style.display = 'none';
    document.body.classList.remove('modal-open');
  });

  // オーバーレイクリックで閉じる
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      helpModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  });

  // Escapeキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.style.display === 'flex') {
      helpModal.style.display = 'none';
      document.body.classList.remove('modal-open');
    }
  });
}
