/**
 * アプリケーション統一ロガー
 * 環境に応じてログレベルを制御し、本番環境での不要なログ出力を抑制
 *
 * 使用例:
 * import { logger } from './core/logger.js';
 * logger.info('処理完了', { id: 123 });
 * logger.error('エラー発生', error);
 */

const LOG_LEVELS = {
  NONE: 0,
  ERROR: 1,
  WARN: 2,
  INFO: 3,
  DEBUG: 4
};

class Logger {
  constructor() {
    this.level = this.getLogLevel();
    this.prefix = '';
  }

  /**
   * 実行環境に応じたログレベルを取得
   * @returns {number} ログレベル
   */
  getLogLevel() {
    // 本番環境判定
    const isDevelopment =
      location.hostname === 'localhost' ||
      location.hostname === '127.0.0.1' ||
      location.hostname === '' ||
      location.port !== '';

    // 開発環境: DEBUG レベルまで出力
    // 本番環境: ERROR のみ出力
    return isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;
  }

  /**
   * ログレベルを設定（テスト用）
   * @param {number} level - ログレベル
   */
  setLevel(level) {
    this.level = level;
  }

  /**
   * ログプレフィックスを設定
   * @param {string} prefix - プレフィックス
   */
  setPrefix(prefix) {
    this.prefix = prefix;
  }

  /**
   * タイムスタンプ付きのメッセージを生成
   * @param {string} level - ログレベル名
   * @param {string} message - メッセージ
   * @returns {string} フォーマット済みメッセージ
   */
  formatMessage(level, message) {
    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    return `${timestamp} [${level}] ${prefix}${message}`;
  }

  /**
   * エラーログを出力（常に出力される）
   * @param {string} message - メッセージ
   * @param {...any} args - 追加の引数
   */
  error(message, ...args) {
    if (this.level >= LOG_LEVELS.ERROR) {
      console.error(this.formatMessage('ERROR', message), ...args);
    }
  }

  /**
   * 警告ログを出力
   * @param {string} message - メッセージ
   * @param {...any} args - 追加の引数
   */
  warn(message, ...args) {
    if (this.level >= LOG_LEVELS.WARN) {
      console.warn(this.formatMessage('WARN', message), ...args);
    }
  }

  /**
   * 情報ログを出力
   * @param {string} message - メッセージ
   * @param {...any} args - 追加の引数
   */
  info(message, ...args) {
    if (this.level >= LOG_LEVELS.INFO) {
      console.info(this.formatMessage('INFO', message), ...args);
    }
  }

  /**
   * デバッグログを出力（開発環境のみ）
   * @param {string} message - メッセージ
   * @param {...any} args - 追加の引数
   */
  debug(message, ...args) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.log(this.formatMessage('DEBUG', message), ...args);
    }
  }

  /**
   * グループログの開始
   * @param {string} label - グループラベル
   */
  group(label) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.group(this.formatMessage('GROUP', label));
    }
  }

  /**
   * グループログの終了
   */
  groupEnd() {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.groupEnd();
    }
  }

  /**
   * テーブル形式でログを出力
   * @param {any} data - 表示するデータ
   */
  table(data) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.table(data);
    }
  }

  /**
   * パフォーマンス計測の開始
   * @param {string} label - 計測ラベル
   */
  time(label) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.time(label);
    }
  }

  /**
   * パフォーマンス計測の終了
   * @param {string} label - 計測ラベル
   */
  timeEnd(label) {
    if (this.level >= LOG_LEVELS.DEBUG) {
      console.timeEnd(label);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();

// ログレベル定数もエクスポート（テスト用）
export { LOG_LEVELS };
