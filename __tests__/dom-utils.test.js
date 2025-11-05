/**
 * DOMユーティリティ関数のテスト
 *
 * dom-utils.js の各種ヘルパー関数をテスト
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  qs,
  qsa,
  num,
  setText,
  toFixed,
  yen,
  pct,
  show,
  hide,
  bind,
  toggleActive,
  addTapListener
} from '../scripts/dom-utils.js';

describe('qs - querySelector', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('要素を正しく取得できる', () => {
    document.body.innerHTML = '<div id="test">Hello</div>';

    const el = qs('#test');

    expect(el).not.toBeNull();
    expect(el.textContent).toBe('Hello');
  });

  test('存在しない要素はnullを返す', () => {
    const el = qs('#nonexistent');

    expect(el).toBeNull();
  });

  test('カスタムrootを指定できる', () => {
    document.body.innerHTML = `
      <div id="container">
        <span id="child">Child</span>
      </div>
    `;

    const container = qs('#container');
    const child = qs('#child', container);

    expect(child).not.toBeNull();
    expect(child.textContent).toBe('Child');
  });

  test('クラスセレクタも使用できる', () => {
    document.body.innerHTML = '<div class="test-class">Content</div>';

    const el = qs('.test-class');

    expect(el).not.toBeNull();
    expect(el.textContent).toBe('Content');
  });
});

describe('qsa - querySelectorAll', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('複数の要素を配列として取得できる', () => {
    document.body.innerHTML = `
      <div class="item">Item 1</div>
      <div class="item">Item 2</div>
      <div class="item">Item 3</div>
    `;

    const items = qsa('.item');

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(3);
    expect(items[0].textContent).toBe('Item 1');
    expect(items[2].textContent).toBe('Item 3');
  });

  test('存在しない要素は空配列を返す', () => {
    const items = qsa('.nonexistent');

    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(0);
  });

  test('カスタムrootを指定できる', () => {
    document.body.innerHTML = `
      <div id="container">
        <span class="child">Child 1</span>
        <span class="child">Child 2</span>
      </div>
    `;

    const container = qs('#container');
    const children = qsa('.child', container);

    expect(children.length).toBe(2);
  });
});

describe('num - 数値取得', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('input要素から数値を取得できる', () => {
    document.body.innerHTML = '<input id="test" value="123.45" />';

    const value = num('test');

    expect(value).toBe(123.45);
  });

  test('整数も正しく取得できる', () => {
    document.body.innerHTML = '<input id="test" value="100" />';

    const value = num('test');

    expect(value).toBe(100);
  });

  test('負の数も取得できる', () => {
    document.body.innerHTML = '<input id="test" value="-50.5" />';

    const value = num('test');

    expect(value).toBe(-50.5);
  });

  test('ゼロを正しく取得できる', () => {
    document.body.innerHTML = '<input id="test" value="0" />';

    const value = num('test');

    expect(value).toBe(0);
  });

  test('無効な数値はnullを返す', () => {
    document.body.innerHTML = '<input id="test" value="abc" />';

    const value = num('test');

    expect(value).toBeNull();
  });

  test('空の値はnullを返す', () => {
    document.body.innerHTML = '<input id="test" value="" />';

    const value = num('test');

    expect(value).toBeNull();
  });

  test('存在しない要素はnullを返す', () => {
    const value = num('nonexistent');

    expect(value).toBeNull();
  });

  test('Infinityはnullを返す', () => {
    document.body.innerHTML = '<input id="test" value="Infinity" />';

    const value = num('test');

    expect(value).toBeNull();
  });
});

describe('setText - テキスト設定', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('要素のテキストを設定できる', () => {
    document.body.innerHTML = '<div id="test">Old</div>';

    setText('test', 'New');

    const el = qs('#test');
    expect(el.textContent).toBe('New');
  });

  test('存在しない要素でもエラーにならない', () => {
    expect(() => setText('nonexistent', 'Text')).not.toThrow();
  });

  test('空文字列を設定できる', () => {
    document.body.innerHTML = '<div id="test">Content</div>';

    setText('test', '');

    const el = qs('#test');
    expect(el.textContent).toBe('');
  });

  test('数値を文字列として設定できる', () => {
    document.body.innerHTML = '<div id="test"></div>';

    setText('test', 123);

    const el = qs('#test');
    expect(el.textContent).toBe('123');
  });
});

describe('toFixed - 数値フォーマット', () => {
  test('デフォルトで小数点2桁にフォーマットする', () => {
    expect(toFixed(123.456)).toBe(123.46);
    expect(toFixed(100)).toBe(100);
  });

  test('小数点桁数を指定できる', () => {
    expect(toFixed(123.456, 0)).toBe(123);
    expect(toFixed(123.456, 1)).toBe(123.5);
    expect(toFixed(123.456, 3)).toBe(123.456);
  });

  test('無効な数値はnullを返す', () => {
    expect(toFixed(NaN)).toBeNull();
    expect(toFixed(Infinity)).toBeNull();
    expect(toFixed(null)).toBeNull();
    expect(toFixed(undefined)).toBeNull();
  });

  test('負の数も正しくフォーマットする', () => {
    expect(toFixed(-123.456)).toBe(-123.46);
  });

  test('ゼロを正しくフォーマットする', () => {
    expect(toFixed(0)).toBe(0);
    expect(toFixed(0.001, 2)).toBe(0);
  });
});

describe('yen - 円フォーマット', () => {
  test('数値を円形式にフォーマットする', () => {
    expect(yen(1000)).toBe('¥1000.00');
    expect(yen(123.45)).toBe('¥123.45');
  });

  test('無効な数値はハイフンを返す', () => {
    expect(yen(NaN)).toBe('-');
    expect(yen(Infinity)).toBe('-');
    expect(yen(null)).toBe('-');
    expect(yen(undefined)).toBe('-');
  });

  test('ゼロを正しくフォーマットする', () => {
    expect(yen(0)).toBe('¥0.00');
  });

  test('負の数も正しくフォーマットする', () => {
    expect(yen(-500)).toBe('¥-500.00');
  });
});

describe('pct - パーセントフォーマット', () => {
  test('数値をパーセント形式にフォーマットする', () => {
    expect(pct(85)).toBe('85.00%');
    expect(pct(33.33)).toBe('33.33%');
  });

  test('無効な数値はハイフンを返す', () => {
    expect(pct(NaN)).toBe('-');
    expect(pct(Infinity)).toBe('-');
    expect(pct(null)).toBe('-');
    expect(pct(undefined)).toBe('-');
  });

  test('ゼロを正しくフォーマットする', () => {
    expect(pct(0)).toBe('0.00%');
  });

  test('100を超える値も正しくフォーマットする', () => {
    expect(pct(120)).toBe('120.00%');
  });
});

describe('show - 要素を表示', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('is-hiddenクラスを削除して要素を表示する', () => {
    document.body.innerHTML = '<div id="test" class="is-hidden">Content</div>';

    show('test');

    const el = qs('#test');
    expect(el.classList.contains('is-hidden')).toBe(false);
  });

  test('元々表示されている要素でもエラーにならない', () => {
    document.body.innerHTML = '<div id="test">Content</div>';

    expect(() => show('test')).not.toThrow();
  });

  test('存在しない要素でもエラーにならない', () => {
    expect(() => show('nonexistent')).not.toThrow();
  });
});

describe('hide - 要素を非表示', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('is-hiddenクラスを追加して要素を非表示にする', () => {
    document.body.innerHTML = '<div id="test">Content</div>';

    hide('test');

    const el = qs('#test');
    expect(el.classList.contains('is-hidden')).toBe(true);
  });

  test('元々非表示の要素でもエラーにならない', () => {
    document.body.innerHTML = '<div id="test" class="is-hidden">Content</div>';

    expect(() => hide('test')).not.toThrow();
  });

  test('存在しない要素でもエラーにならない', () => {
    expect(() => hide('nonexistent')).not.toThrow();
  });
});

describe('bind - イベントバインド', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('複数の要素にイベントリスナーをバインドできる', () => {
    document.body.innerHTML = `
      <input id="input1" value="0" />
      <input id="input2" value="0" />
      <input id="input3" value="0" />
    `;

    let callCount = 0;
    const handler = () => callCount++;

    bind(['input1', 'input2', 'input3'], handler);

    // input1をトリガー
    const input1 = qs('#input1');
    input1.dispatchEvent(new Event('input'));
    expect(callCount).toBe(1);

    // input2をトリガー
    const input2 = qs('#input2');
    input2.dispatchEvent(new Event('input'));
    expect(callCount).toBe(2);
  });

  test('存在しない要素があってもエラーにならない', () => {
    document.body.innerHTML = '<input id="input1" />';

    const handler = () => {};

    expect(() => bind(['input1', 'nonexistent'], handler)).not.toThrow();
  });
});

describe('toggleActive - アクティブ切り替え', () => {
  test('アクティブクラスを正しく切り替える', () => {
    document.body.innerHTML = `
      <button id="btn1" class="is-active">Button 1</button>
      <button id="btn2">Button 2</button>
    `;

    const btn1 = qs('#btn1');
    const btn2 = qs('#btn2');

    toggleActive(btn2, btn1);

    expect(btn1.classList.contains('is-active')).toBe(false);
    expect(btn2.classList.contains('is-active')).toBe(true);
  });

  test('両方の要素にクラスがない場合も正しく動作する', () => {
    document.body.innerHTML = `
      <button id="btn1">Button 1</button>
      <button id="btn2">Button 2</button>
    `;

    const btn1 = qs('#btn1');
    const btn2 = qs('#btn2');

    toggleActive(btn1, btn2);

    expect(btn1.classList.contains('is-active')).toBe(true);
    expect(btn2.classList.contains('is-active')).toBe(false);
  });
});

describe('addTapListener - タップリスナー追加', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  test('要素にclickイベントリスナーを追加できる', () => {
    document.body.innerHTML = '<button id="btn">Click</button>';

    let clicked = false;
    const handler = () => clicked = true;

    const btn = qs('#btn');
    addTapListener(btn, handler);

    btn.click();

    expect(clicked).toBe(true);
  });

  test('複数回クリックできる', () => {
    document.body.innerHTML = '<button id="btn">Click</button>';

    let clickCount = 0;
    const handler = () => clickCount++;

    const btn = qs('#btn');
    addTapListener(btn, handler);

    btn.click();
    btn.click();
    btn.click();

    expect(clickCount).toBe(3);
  });

  test('null要素でもエラーにならない', () => {
    expect(() => addTapListener(null, () => {})).not.toThrow();
  });

  test('undefined要素でもエラーにならない', () => {
    expect(() => addTapListener(undefined, () => {})).not.toThrow();
  });
});
