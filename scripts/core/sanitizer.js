/**
 * HTML文字列のサニタイゼーション
 *
 * 【設計原則】
 * - 単一情報源の原則: エスケープロジックを一箇所に集約
 * - 関心の分離: セキュリティ処理を専用モジュールに分離
 * - 再利用性: 全モジュールから利用可能
 * - シンプルさ: 理解・保守が容易なAPI
 * - 安全性確保: XSS攻撃からユーザーを保護
 *
 * @module core/sanitizer
 */

import { logger } from './logger.js';

/**
 * HTMLエスケープが必要な文字のマッピング
 * @constant
 * @type {Object.<string, string>}
 */
const HTML_ESCAPE_MAP = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '/': '&#x2F;'
};

/**
 * HTML特殊文字をエスケープする正規表現
 * @constant
 * @type {RegExp}
 */
const HTML_ESCAPE_REGEX = /[&<>"'/]/g;

/**
 * HTML文字列をエスケープ
 *
 * XSS攻撃を防ぐため、HTML特殊文字をエスケープします。
 *
 * @param {*} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 *
 * @example
 * escapeHTML('<script>alert("XSS")</script>')
 * // => '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
 */
export function escapeHTML(str) {
  // null, undefined, 数値などを安全に処理
  if (str == null) {
    return '';
  }

  // 文字列に変換
  const stringValue = String(str);

  // エスケープ
  return stringValue.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char]);
}

/**
 * 属性値をエスケープ
 *
 * HTML属性内で使用する値を安全にエスケープします。
 *
 * @param {*} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 *
 * @example
 * escapeAttribute('value with "quotes"')
 * // => 'value with &quot;quotes&quot;'
 */
export function escapeAttribute(str) {
  // escapeHTMLと同じロジックだが、将来的に異なる処理を追加可能
  return escapeHTML(str);
}

/**
 * 安全なHTMLテンプレートリテラル
 *
 * タグ付きテンプレートリテラルを使用して、自動的にエスケープされたHTMLを生成します。
 *
 * @param {TemplateStringsArray} strings - テンプレート文字列
 * @param {...*} values - 埋め込まれる値（自動的にエスケープされる）
 * @returns {string} エスケープされたHTML文字列
 *
 * @example
 * const userName = getUserInput();
 * const html = html`<div>ようこそ、${userName}さん</div>`;
 * // userName に '<script>' が含まれていてもエスケープされる
 */
export function html(strings, ...values) {
  let result = '';

  for (let i = 0; i < strings.length; i++) {
    result += strings[i];

    if (i < values.length) {
      // 値を自動的にエスケープ
      result += escapeHTML(values[i]);
    }
  }

  return result;
}

/**
 * 生のHTMLを挿入（エスケープなし）
 *
 * 【注意】信頼できるHTMLのみに使用してください。
 * ユーザー入力を含む場合は、必ずエスケープしてください。
 *
 * @param {string} rawHTML - 生のHTML文字列
 * @returns {RawHTML} 生のHTML（マーカーオブジェクト）
 *
 * @example
 * const trustedHTML = '<b>太字</b>';
 * const html = html`<div>${raw(trustedHTML)}</div>`;
 * // <div><b>太字</b></div> として出力される
 */
export function raw(rawHTML) {
  return { __raw: true, html: rawHTML };
}

/**
 * 生のHTMLを考慮したテンプレートリテラル
 *
 * raw()でマークされた値はエスケープせず、それ以外は自動エスケープします。
 *
 * @param {TemplateStringsArray} strings - テンプレート文字列
 * @param {...*} values - 埋め込まれる値
 * @returns {string} HTML文字列
 *
 * @example
 * const userName = '<script>alert("XSS")</script>';
 * const icon = raw('<i class="icon"></i>');
 * const result = htmlWithRaw`<div>${icon} ${userName}</div>`;
 * // <div><i class="icon"></i> &lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;</div>
 */
export function htmlWithRaw(strings, ...values) {
  let result = '';

  for (let i = 0; i < strings.length; i++) {
    result += strings[i];

    if (i < values.length) {
      const value = values[i];

      // raw()でマークされた値はエスケープしない
      if (value && typeof value === 'object' && value.__raw) {
        result += value.html;
      } else {
        // それ以外は自動エスケープ
        result += escapeHTML(value);
      }
    }
  }

  return result;
}

/**
 * DOMに安全にHTMLを挿入
 *
 * innerHTML の代わりに使用して、XSS攻撃を防ぎます。
 *
 * @param {HTMLElement} element - 対象のDOM要素
 * @param {string} content - 挿入するコンテンツ（自動的にエスケープされる）
 * @param {boolean} [escape=true] - エスケープするかどうか
 *
 * @example
 * const userInput = getUserInput();
 * setContent(element, userInput); // 安全に挿入される
 */
export function setContent(element, content, escape = true) {
  if (!element) {
    logger.warn('setContent: element is null or undefined');
    return;
  }

  if (escape) {
    // textContentを使用（最も安全）
    element.textContent = content;
  } else {
    // エスケープなし（信頼できるコンテンツのみ）
    element.innerHTML = content;
  }
}

/**
 * DOMに安全にHTMLを挿入（innerHTML代替）
 *
 * テンプレートリテラルで生成されたHTMLを安全に挿入します。
 *
 * @param {HTMLElement} element - 対象のDOM要素
 * @param {TemplateStringsArray} strings - テンプレート文字列
 * @param {...*} values - 埋め込まれる値
 *
 * @example
 * const userName = getUserInput();
 * setHTML(element)`<div>ようこそ、${userName}さん</div>`;
 * // userName は自動的にエスケープされる
 */
export function setHTML(element) {
  return function(strings, ...values) {
    if (!element) {
      logger.warn('setHTML: element is null or undefined');
      return;
    }

    const safeHTML = html(strings, ...values);
    element.innerHTML = safeHTML;
  };
}

/**
 * URLをサニタイズ
 *
 * javascript:, data: などの危険なプロトコルをブロックします。
 *
 * @param {string} url - サニタイズするURL
 * @returns {string} 安全なURL（危険な場合は空文字列）
 *
 * @example
 * sanitizeURL('javascript:alert("XSS")')
 * // => '' (ブロックされる)
 *
 * sanitizeURL('https://example.com')
 * // => 'https://example.com' (許可される)
 */
export function sanitizeURL(url) {
  if (!url) {
    return '';
  }

  const trimmed = String(url).trim().toLowerCase();

  // 危険なプロトコルをブロック
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:'
  ];

  for (const protocol of dangerousProtocols) {
    if (trimmed.startsWith(protocol)) {
      logger.warn(`Blocked dangerous URL protocol: ${protocol}`);
      return '';
    }
  }

  // 安全なプロトコルのみ許可
  const safeProtocols = ['http://', 'https://', 'mailto:', 'tel:', '/'];
  const isSafe = safeProtocols.some(protocol => trimmed.startsWith(protocol)) ||
                 !trimmed.includes(':'); // 相対URL

  if (!isSafe) {
    logger.warn(`Blocked potentially unsafe URL: ${url}`);
    return '';
  }

  return url;
}

/**
 * サニタイザーの使用統計を記録
 * （開発・デバッグ用）
 */
let usageStats = {
  escapeHTML: 0,
  html: 0,
  setContent: 0,
  sanitizeURL: 0
};

/**
 * 使用統計を取得
 *
 * @returns {Object} 使用統計
 */
export function getUsageStats() {
  return { ...usageStats };
}

/**
 * 使用統計をリセット
 */
export function resetUsageStats() {
  usageStats = {
    escapeHTML: 0,
    html: 0,
    setContent: 0,
    sanitizeURL: 0
  };
}

// 開発環境での統計記録は、ES6モジュールのexport関数を再代入できないため無効化
// if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
//   // 統計記録のラッパー（実装不可）
// }

/**
 * サニタイザーモジュールの初期化ログ
 */
logger.info('Sanitizer module loaded', {
  functions: ['escapeHTML', 'html', 'setContent', 'sanitizeURL']
});
