/**
 * エラークラスのテスト
 *
 * errors.js のカスタムエラークラスとユーティリティ関数をテスト
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  NetworkError,
  NotFoundError,
  PermissionError,
  ConflictError,
  ValidationError,
  DatabaseError,
  OfflineError,
  mapFirebaseError,
  mapIndexedDBError,
  isRetryableError
} from '../scripts/errors.js';

describe('NetworkError', () => {
  test('基本的なプロパティが設定される', () => {
    const error = new NetworkError('Network timeout');

    expect(error.message).toBe('Network timeout');
    expect(error.name).toBe('NetworkError');
    expect(error.retryable).toBe(true); // ネットワークエラーはリトライ可能
    expect(error.timestamp).toBeDefined();
  });

  test('オプションでエラーコードを設定できる', () => {
    const error = new NetworkError('Connection failed', { code: 'ERR_TIMEOUT' });

    expect(error.code).toBe('ERR_TIMEOUT');
  });

  test('Errorクラスを継承している', () => {
    const error = new NetworkError('Test');

    expect(error instanceof Error).toBe(true);
  });
});

describe('NotFoundError', () => {
  test('リソースタイプとIDを含むメッセージを生成', () => {
    const error = new NotFoundError('User', '123');

    expect(error.message).toBe('User not found: 123');
    expect(error.resourceType).toBe('User');
    expect(error.resourceId).toBe('123');
    expect(error.retryable).toBe(false);
  });

  test('追加情報を含められる', () => {
    const error = new NotFoundError('Document', 'doc-456', 'May have been deleted');

    expect(error.message).toBe('Document not found: doc-456. May have been deleted');
  });
});

describe('PermissionError', () => {
  test('操作名を含むメッセージを生成', () => {
    const error = new PermissionError('delete user');

    expect(error.message).toBe('Permission denied for delete user');
    expect(error.operation).toBe('delete user');
    expect(error.retryable).toBe(false);
  });

  test('詳細情報を含められる', () => {
    const error = new PermissionError('read data', 'Requires admin role');

    expect(error.message).toBe('Permission denied for read data: Requires admin role');
  });
});

describe('ConflictError', () => {
  test('競合データを保持する', () => {
    const localData = { version: 1, name: 'Local' };
    const remoteData = { version: 2, name: 'Remote' };
    const error = new ConflictError('Data conflict detected', localData, remoteData);

    expect(error.message).toBe('Data conflict detected');
    expect(error.localData).toEqual(localData);
    expect(error.remoteData).toEqual(remoteData);
    expect(error.retryable).toBe(false);
  });
});

describe('ValidationError', () => {
  test('バリデーションエラーの配列を保持する', () => {
    const errors = ['名前は必須です', 'メールアドレスの形式が正しくありません'];
    const error = new ValidationError('入力データが不正です', errors);

    expect(error.message).toBe('入力データが不正です');
    expect(error.validationErrors).toEqual(errors);
    expect(error.retryable).toBe(false);
  });

  test('getErrors()でエラー配列を取得できる', () => {
    const errors = ['エラー1', 'エラー2'];
    const error = new ValidationError('検証失敗', errors);

    expect(error.getErrors()).toEqual(errors);
  });

  test('getUserMessage()でユーザー向けメッセージを取得', () => {
    const errors = ['名前は必須です', 'メールアドレスが無効です'];
    const error = new ValidationError('入力エラー', errors);

    const userMessage = error.getUserMessage();

    expect(userMessage).toContain('入力エラー');
    expect(userMessage).toContain('名前は必須です');
    expect(userMessage).toContain('メールアドレスが無効です');
  });

  test('エラーが空の場合はメッセージのみ返す', () => {
    const error = new ValidationError('一般的なエラー', []);

    expect(error.getUserMessage()).toBe('一般的なエラー');
  });

  test('errors引数省略時はデフォルトで空配列が設定される', () => {
    const error = new ValidationError('検証エラー');

    expect(error.validationErrors).toEqual([]);
    expect(error.getErrors()).toEqual([]);
    expect(error.getUserMessage()).toBe('検証エラー');
  });
});

describe('DatabaseError', () => {
  test('操作名と元のエラーを保持する', () => {
    const originalError = new Error('Connection timeout');
    const error = new DatabaseError('save data', originalError);

    expect(error.message).toContain('Database error during save data');
    expect(error.message).toContain('Connection timeout');
    expect(error.operation).toBe('save data');
    expect(error.originalError).toBe(originalError);
    expect(error.retryable).toBe(false);
  });
});

describe('OfflineError', () => {
  test('オフライン状態のエラーメッセージを生成', () => {
    const error = new OfflineError('sync data');

    expect(error.message).toContain('Cannot perform sync data while offline');
    expect(error.operation).toBe('sync data');
    expect(error.retryable).toBe(true); // オフラインエラーはリトライ可能
  });
});

describe('mapFirebaseError', () => {
  test('permission-denied をPermissionErrorに変換', () => {
    const firebaseError = { code: 'permission-denied', message: 'Access denied' };
    const error = mapFirebaseError(firebaseError, 'read document');

    expect(error instanceof PermissionError).toBe(true);
    expect(error.operation).toBe('read document');
  });

  test('unavailable をNetworkErrorに変換', () => {
    const firebaseError = { code: 'unavailable', message: 'Service unavailable' };
    const error = mapFirebaseError(firebaseError);

    expect(error instanceof NetworkError).toBe(true);
  });

  test('not-found をNotFoundErrorに変換', () => {
    const firebaseError = { code: 'not-found', message: 'Document not found' };
    const error = mapFirebaseError(firebaseError, 'get user');

    expect(error instanceof NotFoundError).toBe(true);
  });

  test('already-exists をConflictErrorに変換', () => {
    const firebaseError = { code: 'already-exists', message: 'Already exists' };
    const error = mapFirebaseError(firebaseError);

    expect(error instanceof ConflictError).toBe(true);
  });

  test('unauthenticated をPermissionErrorに変換', () => {
    const firebaseError = { code: 'unauthenticated', message: 'Not authenticated' };
    const error = mapFirebaseError(firebaseError, 'access resource');

    expect(error instanceof PermissionError).toBe(true);
  });

  test('null/undefinedの場合は汎用エラーを返す', () => {
    const error = mapFirebaseError(null);

    expect(error.message).toContain('Unknown error occurred');
  });

  test('未知のエラーコードの場合は汎用AppErrorを返す', () => {
    const firebaseError = { code: 'unknown-error-code', message: 'Unknown error' };
    const error = mapFirebaseError(firebaseError);

    expect(error.message).toBe('Unknown error');
    expect(error.retryable).toBe(false);
  });

  test('messageがない場合はtoString()を使用', () => {
    const firebaseError = {
      code: 'unavailable',
      toString: () => '[object Error: Network issue]'
    };
    const error = mapFirebaseError(firebaseError);

    expect(error instanceof NetworkError).toBe(true);
    expect(error.message).toContain('[object Error: Network issue]');
  });
});

describe('mapIndexedDBError', () => {
  test('QuotaExceededError を適切に変換', () => {
    const dbError = { name: 'QuotaExceededError', message: 'Quota exceeded' };
    const error = mapIndexedDBError(dbError, 'save item');

    expect(error instanceof DatabaseError).toBe(true);
  });

  test('NotFoundError を変換', () => {
    const dbError = { name: 'NotFoundError', message: 'Record not found' };
    const error = mapIndexedDBError(dbError, 'get record');

    expect(error instanceof NotFoundError).toBe(true);
  });

  test('InvalidStateError を変換', () => {
    const dbError = { name: 'InvalidStateError', message: 'Invalid state' };
    const error = mapIndexedDBError(dbError, 'transaction');

    expect(error instanceof DatabaseError).toBe(true);
  });

  test('null/undefinedの場合はDatabaseErrorを返す', () => {
    const error = mapIndexedDBError(null, 'operation');

    expect(error instanceof DatabaseError).toBe(true);
  });

  test('未知のエラー名の場合はDatabaseErrorを返す', () => {
    const dbError = { name: 'UnknownDBError', message: 'Unknown database error' };
    const error = mapIndexedDBError(dbError, 'query');

    expect(error instanceof DatabaseError).toBe(true);
    expect(error.operation).toBe('query');
  });

  test('operation引数省略時はデフォルト値が使用される', () => {
    const dbError = { name: 'AbortError', message: 'Transaction aborted' };
    const error = mapIndexedDBError(dbError);

    expect(error instanceof DatabaseError).toBe(true);
    expect(error.operation).toBe('operation'); // デフォルト値
    expect(error.message).toContain('operation');
  });

  test('messageプロパティがない場合でもエラー処理できる', () => {
    const dbError = {
      name: 'AbortError',
      toString: () => 'AbortError: Transaction aborted'
    };
    const error = mapIndexedDBError(dbError, 'test operation');

    expect(error instanceof DatabaseError).toBe(true);
    expect(error.operation).toBe('test operation');
    // messageはundefinedだが、エラーオブジェクト自体は保持される
    expect(error.originalError).toBe(dbError);
  });
});

describe('isRetryableError', () => {
  test('NetworkErrorはリトライ可能', () => {
    const error = new NetworkError('Connection failed');

    expect(isRetryableError(error)).toBe(true);
  });

  test('OfflineErrorはリトライ可能', () => {
    const error = new OfflineError('sync');

    expect(isRetryableError(error)).toBe(true);
  });

  test('ValidationErrorはリトライ不可', () => {
    const error = new ValidationError('Invalid input', []);

    expect(isRetryableError(error)).toBe(false);
  });

  test('PermissionErrorはリトライ不可', () => {
    const error = new PermissionError('delete');

    expect(isRetryableError(error)).toBe(false);
  });

  test('Firebaseのリトライ可能なコードを判定', () => {
    const error = { code: 'unavailable', message: 'Service unavailable' };

    expect(isRetryableError(error)).toBe(true);
  });

  test('Firebaseのリトライ不可コードを判定', () => {
    const error = { code: 'permission-denied', message: 'Permission denied' };

    expect(isRetryableError(error)).toBe(false);
  });

  test('IndexedDBのリトライ可能なエラーを判定', () => {
    const error = { name: 'AbortError', message: 'Transaction aborted' };

    expect(isRetryableError(error)).toBe(true);
  });

  test('通常のErrorオブジェクトはリトライ不可', () => {
    const error = new Error('Generic error');

    expect(isRetryableError(error)).toBe(false);
  });

  test('codeもnameもないエラーオブジェクトはリトライ不可', () => {
    const error = { message: 'Some error without code or name' };

    expect(isRetryableError(error)).toBe(false);
  });

  test('空オブジェクトはリトライ不可', () => {
    const error = {};

    expect(isRetryableError(error)).toBe(false);
  });
});
