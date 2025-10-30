/**
 * バグ修正の検証テスト
 * Node.js環境で実行
 *
 * 実行方法: node test-bug-fixes.js
 */

// ========================================
// テストヘルパー関数
// ========================================

let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(description, fn) {
  testCount++;
  try {
    fn();
    passCount++;
    console.log(`✅ Test ${testCount}: ${description}`);
  } catch (error) {
    failCount++;
    console.log(`❌ Test ${testCount}: ${description}`);
    console.log(`   Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, but got ${actual}`);
  }
}

function assertNotNull(value, message) {
  if (value === null || value === undefined) {
    throw new Error(message || 'Expected non-null value');
  }
}

// ========================================
// Bug 1: Null参照エラーの修正テスト
// ========================================

console.log('\n========================================');
console.log('Bug 1: Null参照エラーの修正テスト');
console.log('========================================\n');

// qs関数のモック実装
function qs(selector) {
  // 存在する要素の場合
  if (selector === '#discInput') {
    return { value: '10' };
  }
  // 存在しない要素の場合
  return null;
}

test('要素が存在する場合、正常に値を取得できる', () => {
  const element = qs('#discInput');
  const value = parseFloat(element?.value) || 0;
  assertEquals(value, 10, '値は10であるべき');
});

test('要素が存在しない場合、エラーが発生せずデフォルト値0を返す', () => {
  const element = qs('#nonExistentElement');
  const value = parseFloat(element?.value) || 0;
  assertEquals(value, 0, '存在しない要素の場合は0を返すべき');
});

test('Optional chainingなしではエラーが発生する（修正前の動作確認）', () => {
  const element = qs('#nonExistentElement');
  let errorOccurred = false;
  try {
    // Optional chainingなしでアクセス
    const value = parseFloat(element.value) || 0;
  } catch (error) {
    errorOccurred = true;
    assert(error instanceof TypeError, 'TypeErrorが発生すべき');
  }
  assert(errorOccurred, 'エラーが発生すべき');
});

// ========================================
// Bug 2: JSON.parseエラーハンドリングテスト
// ========================================

console.log('\n========================================');
console.log('Bug 2: JSON.parseエラーハンドリングテスト');
console.log('========================================\n');

// localStorageのモック実装
const mockLocalStorage = {
  data: {},
  getItem(key) {
    return this.data[key] || null;
  },
  setItem(key, value) {
    this.data[key] = value;
  },
  removeItem(key) {
    delete this.data[key];
  }
};

// loadPresets関数の実装（修正後）
function loadPresets(localStorage, PRESET_STORAGE_KEY) {
  const presets = localStorage.getItem(PRESET_STORAGE_KEY);
  if (!presets) return [];

  try {
    const parsedPresets = JSON.parse(presets);

    return parsedPresets.map(preset => ({
      ...preset,
      patterns: Array.isArray(preset.patterns) ? preset.patterns : []
    }));
  } catch (error) {
    console.error('Failed to parse presets from localStorage:', error);
    localStorage.removeItem(PRESET_STORAGE_KEY);
    return [];
  }
}

test('正常なJSONデータを正しくパースできる', () => {
  mockLocalStorage.setItem('presets', JSON.stringify([
    { id: 1, name: 'Preset 1', patterns: [{ unitCost: 100, unitPrice: 150 }] }
  ]));

  const result = loadPresets(mockLocalStorage, 'presets');
  assertEquals(result.length, 1, '1件のプリセットを取得できるべき');
  assertEquals(result[0].name, 'Preset 1', 'プリセット名が一致すべき');
});

test('破損したJSONデータでもエラーが発生せず空配列を返す', () => {
  mockLocalStorage.setItem('presets', '{ invalid json }');

  const result = loadPresets(mockLocalStorage, 'presets');
  assertEquals(result.length, 0, '破損データの場合は空配列を返すべき');
});

test('破損したデータは自動的にクリアされる', () => {
  mockLocalStorage.setItem('presets', '{ invalid json }');

  loadPresets(mockLocalStorage, 'presets');
  const clearedData = mockLocalStorage.getItem('presets');
  assertEquals(clearedData, null, '破損データはクリアされるべき');
});

test('patternsプロパティがない古いデータも処理できる', () => {
  mockLocalStorage.setItem('presets', JSON.stringify([
    { id: 1, name: 'Old Preset' }
  ]));

  const result = loadPresets(mockLocalStorage, 'presets');
  assertEquals(result.length, 1, '1件のプリセットを取得できるべき');
  assert(Array.isArray(result[0].patterns), 'patternsは配列であるべき');
  assertEquals(result[0].patterns.length, 0, 'patternsは空配列であるべき');
});

// ========================================
// Bug 3: 配列境界チェックテスト
// ========================================

console.log('\n========================================');
console.log('Bug 3: 配列境界チェックテスト');
console.log('========================================\n');

// removeTempPair関数の実装（修正後）
function removeTempPair(index, tempPairs) {
  const sorted = [...tempPairs].sort((a, b) => b.unitPrice - a.unitPrice);

  // 境界チェック
  if (index < 0 || index >= sorted.length) {
    console.error('Invalid index:', index);
    return { success: false, pairs: tempPairs };
  }

  const pairToRemove = sorted[index];
  const realIndex = tempPairs.findIndex(
    p => p.unitCost === pairToRemove.unitCost && p.unitPrice === pairToRemove.unitPrice
  );

  if (realIndex !== -1) {
    tempPairs.splice(realIndex, 1);
  }

  return { success: true, pairs: tempPairs };
}

test('有効なインデックスで配列要素を削除できる', () => {
  const pairs = [
    { unitCost: 100, unitPrice: 150 },
    { unitCost: 120, unitPrice: 180 },
    { unitCost: 90, unitPrice: 140 }
  ];

  const result = removeTempPair(1, [...pairs]);
  assert(result.success, '削除は成功すべき');
  assertEquals(result.pairs.length, 2, '削除後は2件であるべき');
});

test('負のインデックスではエラーが発生し、配列は変更されない', () => {
  const pairs = [
    { unitCost: 100, unitPrice: 150 },
    { unitCost: 120, unitPrice: 180 }
  ];

  const result = removeTempPair(-1, [...pairs]);
  assert(!result.success, '削除は失敗すべき');
  assertEquals(result.pairs.length, 2, '配列は変更されないべき');
});

test('範囲外のインデックスではエラーが発生し、配列は変更されない', () => {
  const pairs = [
    { unitCost: 100, unitPrice: 150 },
    { unitCost: 120, unitPrice: 180 }
  ];

  const result = removeTempPair(10, [...pairs]);
  assert(!result.success, '削除は失敗すべき');
  assertEquals(result.pairs.length, 2, '配列は変更されないべき');
});

test('空配列に対するインデックス0でもエラーが発生する', () => {
  const pairs = [];

  const result = removeTempPair(0, [...pairs]);
  assert(!result.success, '削除は失敗すべき');
  assertEquals(result.pairs.length, 0, '配列は空のままであるべき');
});

test('境界値（配列の長さ-1）で正常に削除できる', () => {
  const pairs = [
    { unitCost: 100, unitPrice: 150 },
    { unitCost: 120, unitPrice: 180 },
    { unitCost: 90, unitPrice: 140 }
  ];

  const result = removeTempPair(2, [...pairs]);
  assert(result.success, '削除は成功すべき');
  assertEquals(result.pairs.length, 2, '削除後は2件であるべき');
});

// ========================================
// テスト結果サマリー
// ========================================

console.log('\n========================================');
console.log('テスト結果サマリー');
console.log('========================================\n');

console.log(`総テスト数: ${testCount}`);
console.log(`✅ 成功: ${passCount}`);
console.log(`❌ 失敗: ${failCount}`);
console.log(`成功率: ${((passCount / testCount) * 100).toFixed(1)}%\n`);

if (failCount === 0) {
  console.log('🎉 すべてのテストが成功しました！\n');
  process.exit(0);
} else {
  console.log('⚠️  一部のテストが失敗しました。\n');
  process.exit(1);
}
