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

  // スクロール位置を保存する変数
  let savedScrollPosition = 0;

  // すべてのhelp-iconのtitle属性をdata-help-textに移動してツールチップを無効化
  document.querySelectorAll('.help-icon[title]').forEach(helpIcon => {
    const title = helpIcon.getAttribute('title');
    if (title) {
      helpIcon.setAttribute('data-help-text', title);
      helpIcon.removeAttribute('title');
    }
  });

  // data-tooltip属性を持つhelp-iconもdata-help-textに統一
  document.querySelectorAll('.help-icon[data-tooltip]').forEach(helpIcon => {
    const tooltip = helpIcon.getAttribute('data-tooltip');
    if (tooltip) {
      helpIcon.setAttribute('data-help-text', tooltip);
    }
  });

  // すべてのhelp-iconにクリックイベントを追加
  document.addEventListener('click', (e) => {
    const helpIcon = e.target.closest('.help-icon');
    if (helpIcon) {
      e.preventDefault();
      e.stopPropagation();

      // data-help-textまたはdata-tooltipから内容を取得
      const helpText = helpIcon.getAttribute('data-help-text') || helpIcon.getAttribute('data-tooltip');
      if (helpText) {
        // 現在のスクロール位置を保存
        savedScrollPosition = window.pageYOffset || document.documentElement.scrollTop;

        // パイプ記号で改行に変換
        const formattedContent = helpText.replace(/\|/g, '<br>');
        helpModalContent.innerHTML = formattedContent;

        // モーダルを表示
        helpModal.style.display = 'flex';
        document.body.classList.add('modal-open');
      }
    }
  });

  // モーダルを閉じる共通処理
  const closeModal = () => {
    helpModal.style.display = 'none';
    document.body.classList.remove('modal-open');

    // スクロール位置を復元
    window.scrollTo(0, savedScrollPosition);
  };

  // 閉じるボタン
  closeHelpModal.addEventListener('click', closeModal);

  // オーバーレイクリックで閉じる
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
      closeModal();
    }
  });

  // Escapeキーで閉じる
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.style.display === 'flex') {
      closeModal();
    }
  });
}
