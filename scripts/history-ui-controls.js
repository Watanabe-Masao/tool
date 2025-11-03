/**
 * 履歴UIのコントロール（カルーセルとフィルタリング）
 */

import { qs } from './dom-utils.js';
import { MODE } from './constants.js';

/**
 * カルーセルを初期化（スワイプ対応）
 */
export function initializeCarousels() {
  document.querySelectorAll('.history-carousel').forEach(carousel => {
    const track = carousel.querySelector('.history-carousel-track');
    const items = Array.from(track.children);
    const indicators = Array.from(carousel.querySelectorAll('.carousel-indicator'));

    if (items.length <= 1) return; // 1件のみの場合はスワイプ不要

    let currentIndex = 0;
    let startX = 0;
    let currentX = 0;
    let isDragging = false;
    let startTime = 0;
    let touchStartedOnButton = false;

    // スワイプでアイテムを切り替え
    function showItem(index, smooth = true) {
      if (index < 0 || index >= items.length) return;

      currentIndex = index;
      const offset = -index * 100;
      track.style.transition = smooth ? 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none';
      track.style.transform = `translateX(${offset}%)`;

      // アクティブ状態を更新
      items.forEach((item, i) => {
        item.classList.toggle('active', i === index);
      });

      indicators.forEach((indicator, i) => {
        indicator.classList.toggle('active', i === index);
      });
    }

    // タッチ開始 - カルーセル全体で検出
    carousel.addEventListener('touchstart', (e) => {
      // ボタン上でのタッチはスワイプを無効化
      const target = e.target;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        touchStartedOnButton = true;
        isDragging = false;
        return;
      }

      touchStartedOnButton = false;
      startX = e.touches[0].clientX;
      currentX = startX;
      startTime = Date.now();
      isDragging = true;
    }, { passive: true });

    // タッチ移動 - カルーセル全体で検出
    carousel.addEventListener('touchmove', (e) => {
      if (!isDragging || touchStartedOnButton) return;
      currentX = e.touches[0].clientX;
    }, { passive: true });

    // タッチ終了
    const handleTouchEnd = () => {
      if (!isDragging || touchStartedOnButton) {
        touchStartedOnButton = false;
        isDragging = false;
        return;
      }
      isDragging = false;

      const diff = currentX - startX;
      const duration = Date.now() - startTime;
      const velocity = Math.abs(diff) / duration; // ピクセル/ミリ秒

      // より敏感な設定：5%の移動または速度0.2で反応
      const threshold = carousel.offsetWidth * 0.05;
      const isQuickSwipe = velocity > 0.2;

      // スワイプ方向を判定
      if ((Math.abs(diff) > threshold || isQuickSwipe) && Math.abs(diff) > 10) {
        if (diff > 0 && currentIndex > 0) {
          // 右スワイプ（戻る）
          showItem(currentIndex - 1);
        } else if (diff < 0 && currentIndex < items.length - 1) {
          // 左スワイプ（進む）
          showItem(currentIndex + 1);
        } else {
          // 端に到達している場合は元の位置に戻る
          showItem(currentIndex);
        }
      } else {
        // 閾値未満の場合は元の位置に戻る
        showItem(currentIndex);
      }
    };

    carousel.addEventListener('touchend', handleTouchEnd, { passive: true });
    carousel.addEventListener('touchcancel', handleTouchEnd, { passive: true });

    // マウスでもスワイプ可能に - カルーセル全体で検出
    let mouseDown = false;
    let mouseStartedOnButton = false;

    carousel.addEventListener('mousedown', (e) => {
      // ボタン上でのマウスダウンはスワイプを無効化
      const target = e.target;
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        mouseStartedOnButton = true;
        mouseDown = false;
        return;
      }

      mouseStartedOnButton = false;
      startX = e.clientX;
      currentX = startX;
      startTime = Date.now();
      mouseDown = true;
      isDragging = true;
      e.preventDefault();
    });

    carousel.addEventListener('mousemove', (e) => {
      if (!mouseDown || mouseStartedOnButton) return;
      currentX = e.clientX;
    });

    const handleMouseEnd = () => {
      if (!mouseDown || mouseStartedOnButton) {
        mouseStartedOnButton = false;
        mouseDown = false;
        return;
      }
      mouseDown = false;
      isDragging = false;

      const diff = currentX - startX;
      const duration = Date.now() - startTime;
      const velocity = Math.abs(diff) / duration;

      const threshold = carousel.offsetWidth * 0.05;
      const isQuickSwipe = velocity > 0.2;

      // スワイプ方向を判定
      if ((Math.abs(diff) > threshold || isQuickSwipe) && Math.abs(diff) > 10) {
        if (diff > 0 && currentIndex > 0) {
          showItem(currentIndex - 1);
        } else if (diff < 0 && currentIndex < items.length - 1) {
          showItem(currentIndex + 1);
        } else {
          showItem(currentIndex);
        }
      } else {
        // 閾値未満の場合は元の位置に戻る
        showItem(currentIndex);
      }
    };

    carousel.addEventListener('mouseup', handleMouseEnd);
    carousel.addEventListener('mouseleave', () => {
      if (mouseDown) {
        handleMouseEnd();
      }
    });

    // インジケータークリック
    indicators.forEach((indicator, index) => {
      indicator.addEventListener('click', () => {
        showItem(index);
      });
    });

    // 初期化時にトランジションを設定
    track.style.transition = 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
  });
}

/**
 * 履歴フィルタリングUIを初期化
 * @param {string} mode - 現在のモード
 * @param {string} yieldMethod - 現在の歩留まり計算方法
 */
export function initHistoryFilterUI(mode, yieldMethod) {
  // モード選択ボタンの初期化
  const allBtn = qs('#historyFilterAll');
  const fixedBtn = qs('#historyFilterFixed');
  const weightBtn = qs('#historyFilterWeight');
  const yieldStatsBtn = qs('#historyFilterYieldStats');

  // すべてのボタンからis-activeを削除
  [allBtn, fixedBtn, weightBtn, yieldStatsBtn].forEach(btn => {
    if (btn) btn.classList.remove('is-active');
  });

  // 現在のモードに応じてボタンをアクティブ化
  if (mode === MODE.FIXED && fixedBtn) {
    fixedBtn.classList.add('is-active');
  } else if (mode === MODE.WEIGHT && weightBtn) {
    weightBtn.classList.add('is-active');
  } else if (mode === MODE.YIELD_STATS && yieldStatsBtn) {
    yieldStatsBtn.classList.add('is-active');
  }

  // 計算方法セクションの表示/非表示
  const methodSection = qs('#historyFilterMethodSection');
  if (methodSection) {
    if (mode === MODE.YIELD_STATS || !mode) {
      // 歩留まり統計モードまたは全て表示の場合は非表示
      methodSection.style.display = 'none';
    } else {
      methodSection.style.display = '';
      // ラジオボタンの初期化
      const calculateRadio = qs('input[name="historyFilterMethod"][value="calculate"]');
      const directRadio = qs('input[name="historyFilterMethod"][value="direct"]');
      if (yieldMethod === 'direct' && directRadio) {
        directRadio.checked = true;
      } else if (calculateRadio) {
        calculateRadio.checked = true;
      }
    }
  }
}

// イベントリスナーが重複して登録されないようにフラグを管理
let historyFilterListenersSetup = false;

/**
 * 履歴フィルタリングUIのイベントリスナーを設定
 * @param {Function} renderHistoryListCallback - 履歴リスト再描画のコールバック
 */
export function setupHistoryFilterListeners(renderHistoryListCallback) {
  if (historyFilterListenersSetup) return;
  historyFilterListenersSetup = true;

  // モード選択ボタンのイベントリスナー
  const filterButtons = [
    { id: '#historyFilterAll', mode: null },
    { id: '#historyFilterFixed', mode: MODE.FIXED },
    { id: '#historyFilterWeight', mode: MODE.WEIGHT },
    { id: '#historyFilterYieldStats', mode: MODE.YIELD_STATS }
  ];

  filterButtons.forEach(({ id, mode }) => {
    const btn = qs(id);
    if (btn) {
      const filterHandler = async () => {
        // すべてのボタンからis-activeを削除
        filterButtons.forEach(({ id }) => {
          const b = qs(id);
          if (b) b.classList.remove('is-active');
        });
        // クリックされたボタンをアクティブ化
        btn.classList.add('is-active');

        // 計算方法セクションの表示/非表示
        const methodSection = qs('#historyFilterMethodSection');
        if (methodSection) {
          if (mode === MODE.YIELD_STATS || mode === null) {
            // 歩留まり統計モードまたは全て表示の場合は非表示
            methodSection.style.display = 'none';
          } else {
            methodSection.style.display = '';
          }
        }

        // 現在選択されている計算方法を取得
        let yieldMethod = null;
        if (mode !== MODE.YIELD_STATS && mode !== null) {
          const methodRadio = document.querySelector('input[name="historyFilterMethod"]:checked');
          yieldMethod = methodRadio ? methodRadio.value : 'calculate';
        }

        // 履歴リストを再描画
        await renderHistoryListCallback(null, mode, yieldMethod);
      };
      btn.addEventListener('click', filterHandler);
      btn.addEventListener('touchend', (e) => { e.preventDefault(); filterHandler(); }, { passive: false });
    }
  });

  // 計算方法ラジオボタンのイベントリスナー
  const methodRadios = document.querySelectorAll('input[name="historyFilterMethod"]');
  methodRadios.forEach(radio => {
    radio.addEventListener('change', async () => {
      // 現在選択されているモードを取得
      const activeBtn = qs('.btn-mode.is-active[data-mode]');
      if (!activeBtn) return;

      const modeValue = activeBtn.dataset.mode;
      // 'all'の場合はnullとして扱う
      const mode = modeValue === 'all' ? null : modeValue;
      const yieldMethod = radio.value;

      // 履歴リストを再描画
      await renderHistoryListCallback(null, mode, yieldMethod);
    });
  });
}
