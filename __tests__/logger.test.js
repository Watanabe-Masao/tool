/**
 * @jest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Logger', () => {
  let Logger, logger, LOG_LEVELS;
  let consoleErrorSpy, consoleWarnSpy, consoleInfoSpy, consoleLogSpy;
  let consoleGroupSpy, consoleGroupEndSpy, consoleTableSpy;
  let consoleTimeSpy, consoleTimeEndSpy;

  beforeEach(async () => {
    // コンソールメソッドをモック化
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
    consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});
    consoleTableSpy = jest.spyOn(console, 'table').mockImplementation(() => {});
    consoleTimeSpy = jest.spyOn(console, 'time').mockImplementation(() => {});
    consoleTimeEndSpy = jest.spyOn(console, 'timeEnd').mockImplementation(() => {});

    // logger.jsを再インポート（モックが適用された状態で）
    const module = await import('../scripts/core/logger.js');
    logger = module.logger;
    LOG_LEVELS = module.LOG_LEVELS;
  });

  afterEach(() => {
    // すべてのモックをリストア
    jest.restoreAllMocks();
  });

  describe('ログレベル設定', () => {
    it('setLevel()でログレベルを変更できる', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      expect(logger.level).toBe(LOG_LEVELS.ERROR);

      logger.setLevel(LOG_LEVELS.DEBUG);
      expect(logger.level).toBe(LOG_LEVELS.DEBUG);
    });
  });

  describe('プレフィックス設定', () => {
    it('setPrefix()でプレフィックスを設定できる', () => {
      logger.setPrefix('TEST');
      logger.setLevel(LOG_LEVELS.DEBUG);
      logger.info('メッセージ');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).toContain('[TEST]');
      expect(call).toContain('メッセージ');
    });

    it('プレフィックスなしでも動作する', () => {
      logger.setPrefix('');
      logger.setLevel(LOG_LEVELS.DEBUG);
      logger.info('メッセージ');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).not.toContain('[TEST]');
      expect(call).toContain('メッセージ');
    });
  });

  describe('formatMessage()', () => {
    it('タイムスタンプとレベルを含むメッセージを生成', () => {
      const message = logger.formatMessage('ERROR', 'テストメッセージ');

      expect(message).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/); // ISO形式のタイムスタンプ
      expect(message).toContain('[ERROR]');
      expect(message).toContain('テストメッセージ');
    });

    it('プレフィックス付きメッセージを生成', () => {
      logger.setPrefix('APP');
      const message = logger.formatMessage('INFO', 'テスト');

      expect(message).toContain('[APP]');
      expect(message).toContain('[INFO]');
      expect(message).toContain('テスト');
    });
  });

  describe('error() - エラーログ', () => {
    it('ERROR レベルで console.error を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      logger.error('エラーメッセージ');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const call = consoleErrorSpy.mock.calls[0][0];
      expect(call).toContain('[ERROR]');
      expect(call).toContain('エラーメッセージ');
    });

    it('追加引数を渡せる', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      const errorObj = new Error('test');
      logger.error('エラー発生', errorObj, { id: 123 });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy.mock.calls[0][1]).toBe(errorObj);
      expect(consoleErrorSpy.mock.calls[0][2]).toEqual({ id: 123 });
    });

    it('NONE レベルでは出力されない', () => {
      logger.setLevel(LOG_LEVELS.NONE);
      logger.error('エラーメッセージ');

      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('無限再帰が発生しない（重要）', () => {
      logger.setLevel(LOG_LEVELS.ERROR);

      // 複数回呼び出しても問題ないことを確認
      expect(() => {
        logger.error('メッセージ1');
        logger.error('メッセージ2');
        logger.error('メッセージ3');
      }).not.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('warn() - 警告ログ', () => {
    it('WARN レベルで console.warn を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.WARN);
      logger.warn('警告メッセージ');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const call = consoleWarnSpy.mock.calls[0][0];
      expect(call).toContain('[WARN]');
      expect(call).toContain('警告メッセージ');
    });

    it('ERROR レベルでは出力されない', () => {
      logger.setLevel(LOG_LEVELS.ERROR);
      logger.warn('警告メッセージ');

      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('無限再帰が発生しない（重要）', () => {
      logger.setLevel(LOG_LEVELS.WARN);

      expect(() => {
        logger.warn('警告1');
        logger.warn('警告2');
      }).not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('info() - 情報ログ', () => {
    it('INFO レベルで console.info を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.INFO);
      logger.info('情報メッセージ');

      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      const call = consoleInfoSpy.mock.calls[0][0];
      expect(call).toContain('[INFO]');
      expect(call).toContain('情報メッセージ');
    });

    it('WARN レベルでは出力されない', () => {
      logger.setLevel(LOG_LEVELS.WARN);
      logger.info('情報メッセージ');

      expect(consoleInfoSpy).not.toHaveBeenCalled();
    });
  });

  describe('debug() - デバッグログ', () => {
    it('DEBUG レベルで console.log を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.DEBUG);
      logger.debug('デバッグメッセージ');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const call = consoleLogSpy.mock.calls[0][0];
      expect(call).toContain('[DEBUG]');
      expect(call).toContain('デバッグメッセージ');
    });

    it('INFO レベルでは出力されない', () => {
      logger.setLevel(LOG_LEVELS.INFO);
      logger.debug('デバッグメッセージ');

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('group() / groupEnd() - グループログ', () => {
    it('DEBUG レベルで console.group を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.DEBUG);
      logger.group('グループ1');

      expect(consoleGroupSpy).toHaveBeenCalledTimes(1);
      const call = consoleGroupSpy.mock.calls[0][0];
      expect(call).toContain('[GROUP]');
      expect(call).toContain('グループ1');
    });

    it('DEBUG レベルで console.groupEnd を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.DEBUG);
      logger.groupEnd();

      expect(consoleGroupEndSpy).toHaveBeenCalledTimes(1);
    });

    it('INFO レベルでは出力されない', () => {
      logger.setLevel(LOG_LEVELS.INFO);
      logger.group('グループ');
      logger.groupEnd();

      expect(consoleGroupSpy).not.toHaveBeenCalled();
      expect(consoleGroupEndSpy).not.toHaveBeenCalled();
    });
  });

  describe('table() - テーブル表示', () => {
    it('DEBUG レベルで console.table を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.DEBUG);
      const data = [{ id: 1, name: 'test' }];
      logger.table(data);

      expect(consoleTableSpy).toHaveBeenCalledTimes(1);
      expect(consoleTableSpy.mock.calls[0][0]).toEqual(data);
    });

    it('INFO レベルでは出力されない', () => {
      logger.setLevel(LOG_LEVELS.INFO);
      logger.table([{ id: 1 }]);

      expect(consoleTableSpy).not.toHaveBeenCalled();
    });
  });

  describe('time() / timeEnd() - パフォーマンス計測', () => {
    it('DEBUG レベルで console.time を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.DEBUG);
      logger.time('計測1');

      expect(consoleTimeSpy).toHaveBeenCalledTimes(1);
      expect(consoleTimeSpy.mock.calls[0][0]).toBe('計測1');
    });

    it('DEBUG レベルで console.timeEnd を呼び出す', () => {
      logger.setLevel(LOG_LEVELS.DEBUG);
      logger.timeEnd('計測1');

      expect(consoleTimeEndSpy).toHaveBeenCalledTimes(1);
      expect(consoleTimeEndSpy.mock.calls[0][0]).toBe('計測1');
    });

    it('INFO レベルでは出力されない', () => {
      logger.setLevel(LOG_LEVELS.INFO);
      logger.time('計測');
      logger.timeEnd('計測');

      expect(consoleTimeSpy).not.toHaveBeenCalled();
      expect(consoleTimeEndSpy).not.toHaveBeenCalled();
    });
  });

  describe('ログレベル制御の統合テスト', () => {
    it('ERROR レベル: error のみ出力', () => {
      logger.setLevel(LOG_LEVELS.ERROR);

      logger.error('エラー');
      logger.warn('警告');
      logger.info('情報');
      logger.debug('デバッグ');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('WARN レベル: error, warn のみ出力', () => {
      logger.setLevel(LOG_LEVELS.WARN);

      logger.error('エラー');
      logger.warn('警告');
      logger.info('情報');
      logger.debug('デバッグ');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('INFO レベル: error, warn, info のみ出力', () => {
      logger.setLevel(LOG_LEVELS.INFO);

      logger.error('エラー');
      logger.warn('警告');
      logger.info('情報');
      logger.debug('デバッグ');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('DEBUG レベル: すべて出力', () => {
      logger.setLevel(LOG_LEVELS.DEBUG);

      logger.error('エラー');
      logger.warn('警告');
      logger.info('情報');
      logger.debug('デバッグ');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleInfoSpy).toHaveBeenCalledTimes(1);
      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
    });
  });
});
