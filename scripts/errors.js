/**
 * カスタムエラークラス
 * アプリケーション全体で使用する標準化されたエラー型
 */

/**
 * ベースエラークラス
 */
class AppError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = this.constructor.name;
    this.retryable = options.retryable || false;
    this.code = options.code;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * ネットワークエラー
 * ネットワーク接続の問題によるエラー
 */
export class NetworkError extends AppError {
  constructor(message, options = {}) {
    super(message, { retryable: true, ...options });
  }
}

/**
 * リソースが見つからないエラー
 */
export class NotFoundError extends AppError {
  constructor(resourceType, resourceId, additionalInfo = '') {
    const message = `${resourceType} not found: ${resourceId}${additionalInfo ? '. ' + additionalInfo : ''}`;
    super(message, { retryable: false });
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * 権限エラー
 */
export class PermissionError extends AppError {
  constructor(operation, details = '') {
    const message = `Permission denied for ${operation}${details ? ': ' + details : ''}`;
    super(message, { retryable: false });
    this.operation = operation;
  }
}

/**
 * データ競合エラー
 */
export class ConflictError extends AppError {
  constructor(message, localData, remoteData) {
    super(message, { retryable: false });
    this.localData = localData;
    this.remoteData = remoteData;
  }
}

/**
 * バリデーションエラー
 */
export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, { retryable: false });
    this.validationErrors = errors;
  }

  /**
   * エラーメッセージの配列を取得
   */
  getErrors() {
    return this.validationErrors;
  }

  /**
   * ユーザー向けメッセージを取得
   */
  getUserMessage() {
    if (this.validationErrors.length === 0) {
      return this.message;
    }
    return `${this.message}\n• ${this.validationErrors.join('\n• ')}`;
  }
}

/**
 * データベースエラー
 */
export class DatabaseError extends AppError {
  constructor(operation, originalError) {
    const message = `Database error during ${operation}: ${originalError.message}`;
    super(message, { retryable: false });
    this.operation = operation;
    this.originalError = originalError;
  }
}

/**
 * オフラインエラー
 */
export class OfflineError extends AppError {
  constructor(operation) {
    const message = `Cannot perform ${operation} while offline. Please check your internet connection.`;
    super(message, { retryable: true });
    this.operation = operation;
  }
}

/**
 * Firebaseエラーをカスタムエラーに変換
 */
export function mapFirebaseError(error, operation = 'operation') {
  if (!error) {
    return new AppError('Unknown error occurred');
  }

  const code = error.code;
  const message = error.message || error.toString();

  // Firestoreエラーコードのマッピング
  switch (code) {
    case 'permission-denied':
      return new PermissionError(operation, 'Firestoreのセキュリティルールを確認してください');

    case 'unavailable':
    case 'deadline-exceeded':
    case 'resource-exhausted':
      return new NetworkError(`ネットワークエラー: ${message}`, { code });

    case 'not-found':
      return new NotFoundError('Cloud resource', operation);

    case 'already-exists':
      return new ConflictError('リソースが既に存在します', null, null);

    case 'unauthenticated':
      return new PermissionError(operation, 'ログインが必要です');

    default:
      return new AppError(message, { code, retryable: false });
  }
}

/**
 * IndexedDBエラーをカスタムエラーに変換
 */
export function mapIndexedDBError(error, operation = 'operation') {
  if (!error) {
    return new DatabaseError(operation, new Error('Unknown database error'));
  }

  const name = error.name;
  const message = error.message || error.toString();

  switch (name) {
    case 'QuotaExceededError':
      return new DatabaseError(operation, error).message =
        'ストレージ容量が不足しています。不要なデータを削除してください。';

    case 'InvalidStateError':
    case 'TransactionInactiveError':
    case 'AbortError':
      return new DatabaseError(operation, error);

    case 'NotFoundError':
      return new NotFoundError('IndexedDB record', operation);

    default:
      return new DatabaseError(operation, error);
  }
}

/**
 * エラーがリトライ可能かどうかを判定
 */
export function isRetryableError(error) {
  if (error instanceof AppError) {
    return error.retryable;
  }

  // Firebase エラーコードでの判定
  if (error.code) {
    const retryableCodes = [
      'unavailable',
      'deadline-exceeded',
      'resource-exhausted',
      'aborted',
      'cancelled'
    ];
    return retryableCodes.includes(error.code);
  }

  // IndexedDB エラー名での判定
  if (error.name) {
    const retryableNames = [
      'InvalidStateError',
      'TransactionInactiveError',
      'AbortError'
    ];
    return retryableNames.includes(error.name);
  }

  return false;
}
