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

  // すべてのhelp-iconのtitle属性をdata-help-textに移動してツールチップを無効化
  document.querySelectorAll('.help-icon[title]').forEach(helpIcon => {
    const title = helpIcon.getAttribute('title');
    if (title) {
      helpIcon.setAttribute('data-help-text', title);
      helpIcon.removeAttribute('title');
    }
  });

  // すべてのhelp-iconにクリックイベントを追加
  document.addEventListener('click', (e) => {
    const helpIcon = e.target.closest('.help-icon');
    if (helpIcon) {
      e.preventDefault();
      e.stopPropagation();

      // data-help-textから内容を取得
      const helpText = helpIcon.getAttribute('data-help-text');
      if (helpText) {
        // パイプ記号で改行に変換
        const formattedContent = helpText.replace(/\|/g, '<br>');
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
