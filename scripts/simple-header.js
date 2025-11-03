/**
 * シンプルヘッダーの制御
 */

import { qs } from './dom-utils.js';

/**
 * メニューの開閉
 */
let menuOpen = false;

export function initializeSimpleHeader() {
  const menuButton = qs('#menu-button');
  const headerMenu = qs('#header-menu');

  if (!menuButton || !headerMenu) return;

  // メニューボタンクリック
  menuButton.addEventListener('click', (e) => {
    e.stopPropagation();
    menuOpen = !menuOpen;
    headerMenu.style.display = menuOpen ? 'block' : 'none';
  });

  // メニュー外クリックで閉じる
  document.addEventListener('click', (e) => {
    if (menuOpen && !headerMenu.contains(e.target)) {
      menuOpen = false;
      headerMenu.style.display = 'none';
    }
  });

  // メニューアイテムクリック時に閉じる
  const menuItems = headerMenu.querySelectorAll('.menu-item');
  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      menuOpen = false;
      headerMenu.style.display = 'none';
    });
  });
}
