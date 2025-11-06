/**
 * sanitizer.js のユニットテスト
 *
 * XSS対策の信頼性を確保するための包括的なテストスイート
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  escapeHTML,
  escapeAttribute,
  html,
  raw,
  htmlWithRaw,
  setContent,
  sanitizeURL,
  getUsageStats,
  resetUsageStats
} from '../scripts/core/sanitizer.js';

describe('sanitizer.js - XSS対策モジュール', () => {
  describe('escapeHTML', () => {
    it('基本的なHTML特殊文字をエスケープする', () => {
      expect(escapeHTML('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });

    it('アンパサンドをエスケープする', () => {
      expect(escapeHTML('Tom & Jerry')).toBe('Tom &amp; Jerry');
    });

    it('シングルクォートをエスケープする', () => {
      expect(escapeHTML("It's a test")).toBe('It&#39;s a test');
    });

    it('ダブルクォートをエスケープする', () => {
      expect(escapeHTML('Say "Hello"')).toBe('Say &quot;Hello&quot;');
    });

    it('スラッシュをエスケープする', () => {
      expect(escapeHTML('a/b')).toBe('a&#x2F;b');
    });

    it('複数の特殊文字を同時にエスケープする', () => {
      expect(escapeHTML('<a href="javascript:alert(\'XSS\')">'))
        .toBe('&lt;a href=&quot;javascript:alert(&#39;XSS&#39;)&quot;&gt;');
    });

    it('null を空文字列として扱う', () => {
      expect(escapeHTML(null)).toBe('');
    });

    it('undefined を空文字列として扱う', () => {
      expect(escapeHTML(undefined)).toBe('');
    });

    it('数値を文字列に変換してエスケープする', () => {
      expect(escapeHTML(123)).toBe('123');
      expect(escapeHTML(0)).toBe('0');
    });

    it('オブジェクトを文字列に変換する', () => {
      expect(escapeHTML({ toString: () => '<test>' }))
        .toBe('&lt;test&gt;');
    });

    it('特殊文字を含まない文字列はそのまま返す', () => {
      expect(escapeHTML('Hello World')).toBe('Hello World');
    });

    it('空文字列を空文字列として返す', () => {
      expect(escapeHTML('')).toBe('');
    });
  });

  describe('escapeAttribute', () => {
    it('escapeHTML と同じ動作をする', () => {
      const input = '<script>alert("XSS")</script>';
      expect(escapeAttribute(input)).toBe(escapeHTML(input));
    });

    it('属性値内のクォートをエスケープする', () => {
      expect(escapeAttribute('value with "quotes"'))
        .toBe('value with &quot;quotes&quot;');
    });
  });

  describe('html - タグ付きテンプレートリテラル', () => {
    it('変数を自動的にエスケープする', () => {
      const userInput = '<script>alert("XSS")</script>';
      const result = html`<div>${userInput}</div>`;

      expect(result).toBe('<div>&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;</div>');
      expect(result).not.toContain('<script>');
    });

    it('複数の変数をエスケープする', () => {
      const name = '<b>John</b>';
      const message = 'Hello "World"';
      const result = html`<div>${name}: ${message}</div>`;

      expect(result).toContain('&lt;b&gt;John&lt;&#x2F;b&gt;');
      expect(result).toContain('&quot;World&quot;');
    });

    it('数値をそのまま挿入する', () => {
      const count = 42;
      const result = html`<span>${count}</span>`;

      expect(result).toBe('<span>42</span>');
    });

    it('null/undefined を空文字列として扱う', () => {
      const nullValue = null;
      const undefinedValue = undefined;
      const result = html`<div>${nullValue}|${undefinedValue}</div>`;

      expect(result).toBe('<div>|</div>');
    });

    it('変数なしのテンプレートも動作する', () => {
      const result = html`<div>Hello World</div>`;
      expect(result).toBe('<div>Hello World</div>');
    });
  });

  describe('raw - 生のHTML挿入', () => {
    it('__raw フラグを持つオブジェクトを返す', () => {
      const rawHTML = '<b>Bold</b>';
      const result = raw(rawHTML);

      expect(result).toHaveProperty('__raw', true);
      expect(result).toHaveProperty('html', rawHTML);
    });
  });

  describe('htmlWithRaw', () => {
    it('raw()でマークされた値をエスケープしない', () => {
      const trustedHTML = '<b>Bold</b>';
      const result = htmlWithRaw`<div>${raw(trustedHTML)}</div>`;

      expect(result).toBe('<div><b>Bold</b></div>');
    });

    it('raw()なしの値は自動エスケープする', () => {
      const userInput = '<script>alert("XSS")</script>';
      const result = htmlWithRaw`<div>${userInput}</div>`;

      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('raw()とエスケープを混在できる', () => {
      const icon = raw('<i class="icon"></i>');
      const userName = '<script>XSS</script>';
      const result = htmlWithRaw`<div>${icon} ${userName}</div>`;

      expect(result).toContain('<i class="icon"></i>');
      expect(result).not.toContain('<script>XSS</script>');
      expect(result).toContain('&lt;script&gt;');
    });
  });

  describe('setContent', () => {
    let element;

    beforeEach(() => {
      element = document.createElement('div');
    });

    it('デフォルトでtextContentを使用する（安全）', () => {
      const userInput = '<script>alert("XSS")</script>';
      setContent(element, userInput);

      expect(element.textContent).toBe(userInput);
      expect(element.innerHTML).toBe('&lt;script&gt;alert("XSS")&lt;/script&gt;');
    });

    it('escape=false の場合はinnerHTMLを使用する', () => {
      const trustedHTML = '<b>Bold</b>';
      setContent(element, trustedHTML, false);

      expect(element.innerHTML).toBe('<b>Bold</b>');
      expect(element.textContent).toBe('Bold');
    });

    it('null要素に対して警告を出す（エラーにならない）', () => {
      expect(() => {
        setContent(null, 'content');
      }).not.toThrow();
    });

    it('undefined要素に対して警告を出す（エラーにならない）', () => {
      expect(() => {
        setContent(undefined, 'content');
      }).not.toThrow();
    });

    it('空文字列を設定できる', () => {
      element.textContent = 'initial';
      setContent(element, '');

      expect(element.textContent).toBe('');
    });
  });

  describe('sanitizeURL', () => {
    describe('安全なURLは許可する', () => {
      it('https:// URLを許可する', () => {
        expect(sanitizeURL('https://example.com')).toBe('https://example.com');
      });

      it('http:// URLを許可する', () => {
        expect(sanitizeURL('http://example.com')).toBe('http://example.com');
      });

      it('mailto: URLを許可する', () => {
        expect(sanitizeURL('mailto:test@example.com')).toBe('mailto:test@example.com');
      });

      it('tel: URLを許可する', () => {
        expect(sanitizeURL('tel:+1234567890')).toBe('tel:+1234567890');
      });

      it('相対パス（/で始まる）を許可する', () => {
        expect(sanitizeURL('/path/to/page')).toBe('/path/to/page');
      });

      it('相対パス（プロトコルなし）を許可する', () => {
        expect(sanitizeURL('relative/path')).toBe('relative/path');
      });
    });

    describe('危険なURLはブロックする', () => {
      it('javascript: URLをブロックする', () => {
        expect(sanitizeURL('javascript:alert("XSS")')).toBe('');
      });

      it('data: URLをブロックする', () => {
        expect(sanitizeURL('data:text/html,<script>alert("XSS")</script>')).toBe('');
      });

      it('vbscript: URLをブロックする', () => {
        expect(sanitizeURL('vbscript:msgbox("XSS")')).toBe('');
      });

      it('file: URLをブロックする', () => {
        expect(sanitizeURL('file:///etc/passwd')).toBe('');
      });

      it('about: URLをブロックする', () => {
        expect(sanitizeURL('about:blank')).toBe('');
      });

      it('大文字小文字を区別せずブロックする', () => {
        expect(sanitizeURL('JavaScript:alert("XSS")')).toBe('');
        expect(sanitizeURL('JAVASCRIPT:alert("XSS")')).toBe('');
      });

      it('前後の空白を考慮してブロックする', () => {
        expect(sanitizeURL('  javascript:alert("XSS")  ')).toBe('');
      });
    });

    describe('エッジケース', () => {
      it('null を空文字列として返す', () => {
        expect(sanitizeURL(null)).toBe('');
      });

      it('undefined を空文字列として返す', () => {
        expect(sanitizeURL(undefined)).toBe('');
      });

      it('空文字列を空文字列として返す', () => {
        expect(sanitizeURL('')).toBe('');
      });

      it('数値を文字列に変換してチェックする', () => {
        // 数値はプロトコルを含まないため、相対URLとして扱われる
        expect(sanitizeURL(123)).toBe(123);
      });
    });
  });

  describe('使用統計（開発用）', () => {
    beforeEach(() => {
      resetUsageStats();
    });

    it('統計オブジェクトを返す', () => {
      const stats = getUsageStats();

      expect(stats).toHaveProperty('escapeHTML');
      expect(stats).toHaveProperty('html');
      expect(stats).toHaveProperty('setContent');
      expect(stats).toHaveProperty('sanitizeURL');
    });

    it('統計をリセットできる', () => {
      resetUsageStats();
      const stats = getUsageStats();

      expect(stats.escapeHTML).toBe(0);
      expect(stats.html).toBe(0);
      expect(stats.setContent).toBe(0);
      expect(stats.sanitizeURL).toBe(0);
    });
  });

  describe('実践的なXSS攻撃パターン', () => {
    it('img onerror 攻撃をブロックする', () => {
      const malicious = '<img src=x onerror=alert(1)>';
      const result = html`<div>${malicious}</div>`;

      // エスケープされているので、文字列 "onerror" は残るが実行されない
      expect(result).toContain('&lt;img');
      expect(result).toContain('&gt;');
      // 実際のHTMLタグとして解釈されないことを確認
      expect(result).not.toContain('<img');
    });

    it('svg onload 攻撃をブロックする', () => {
      const malicious = '<svg onload=alert(1)>';
      const result = html`${malicious}`;

      // エスケープされているので、文字列 "onload" は残るが実行されない
      expect(result).toContain('&lt;svg');
      expect(result).toContain('&gt;');
      // 実際のHTMLタグとして解釈されないことを確認
      expect(result).not.toContain('<svg');
    });

    it('iframe 攻撃をブロックする', () => {
      const malicious = '<iframe src="javascript:alert(1)"></iframe>';
      const result = html`${malicious}`;

      expect(result).not.toContain('<iframe');
      expect(result).toContain('&lt;iframe');
    });

    it('HTML エンティティエンコーディングを防ぐ', () => {
      const malicious = '&lt;script&gt;alert("XSS")&lt;/script&gt;';
      const result = html`${malicious}`;

      // 二重エスケープを防ぐ
      expect(result).toBe('&amp;lt;script&amp;gt;alert(&quot;XSS&quot;)&amp;lt;&#x2F;script&amp;gt;');
    });

    it('属性内のJavaScript URLをブロックする', () => {
      const url = 'javascript:alert("XSS")';
      const sanitized = sanitizeURL(url);

      const result = html`<a href="${sanitized}">Link</a>`;
      expect(result).toBe('<a href="">Link</a>');
    });
  });

  describe('パフォーマンステスト', () => {
    it('大量のエスケープ処理を高速に実行できる', () => {
      const start = performance.now();

      for (let i = 0; i < 10000; i++) {
        escapeHTML('<script>alert("XSS")</script>');
      }

      const duration = performance.now() - start;

      // 10000回のエスケープが100ms以内
      expect(duration).toBeLessThan(100);
    });

    it('長い文字列を効率的にエスケープできる', () => {
      const longString = '<script>'.repeat(1000) + 'alert("XSS")' + '</script>'.repeat(1000);

      const start = performance.now();
      const result = escapeHTML(longString);
      const duration = performance.now() - start;

      expect(result).toContain('&lt;script&gt;');
      expect(duration).toBeLessThan(50); // 50ms以内
    });
  });
});
