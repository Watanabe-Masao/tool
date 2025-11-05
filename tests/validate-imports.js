/**
 * Import文の位置を検証するテストスクリプト
 *
 * 検証項目：
 * 1. import文がJSDocコメント内に含まれていないか
 * 2. import文がファイルの適切な位置（コメントの後）にあるか
 * 3. 複数のimport文が連続しているか
 *
 * 実行方法：
 *   node tests/validate-imports.js
 */

import { readFileSync, readdirSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 検証対象ディレクトリ
const SCRIPTS_DIR = join(__dirname, '..', 'scripts');

// 除外するファイル
const EXCLUDE_FILES = [
  'firebase-config.example.js', // テンプレートファイル
];

/**
 * JavaScriptファイルを検証
 * @param {string} filePath - ファイルパス
 * @returns {Object} 検証結果
 */
function validateFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const errors = [];

  // import文を含む行を検索
  const importLines = [];
  let inComment = false;
  let commentStartLine = -1;

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // コメント開始
    if (trimmed.startsWith('/**')) {
      inComment = true;
      commentStartLine = lineNum;
    }

    // コメント終了
    if (trimmed === '*/') {
      inComment = false;
    }

    // import文を検出
    if (trimmed.startsWith('import ')) {
      importLines.push({
        lineNum,
        content: line,
        inComment
      });

      // コメント内のimport文はエラー
      if (inComment) {
        errors.push({
          type: 'IMPORT_IN_COMMENT',
          lineNum,
          message: `Import statement found inside JSDoc comment (started at line ${commentStartLine})`,
          line: trimmed
        });
      }
    }
  });

  // import文が存在する場合、連続しているかチェック
  if (importLines.length > 1) {
    const validImports = importLines.filter(imp => !imp.inComment);
    for (let i = 1; i < validImports.length; i++) {
      const prev = validImports[i - 1].lineNum;
      const curr = validImports[i].lineNum;

      // import文の間に空行以外が入っている場合は警告
      if (curr - prev > 2) {
        const betweenLines = lines.slice(prev, curr - 1);
        const hasNonEmptyNonImport = betweenLines.some(l => {
          const t = l.trim();
          return t !== '' && !t.startsWith('//') && !t.startsWith('import');
        });

        if (hasNonEmptyNonImport) {
          errors.push({
            type: 'SCATTERED_IMPORTS',
            lineNum: curr,
            message: `Import statements should be grouped together`,
            line: validImports[i].content.trim()
          });
        }
      }
    }
  }

  return {
    filePath,
    importCount: importLines.length,
    errors
  };
}

/**
 * ディレクトリ内の全JSファイルを検証
 * @param {string} dir - ディレクトリパス
 * @returns {Array} 検証結果の配列
 */
function validateDirectory(dir) {
  const files = readdirSync(dir);
  const results = [];

  for (const file of files) {
    // JSファイルのみ対象
    if (extname(file) !== '.js') continue;

    // 除外ファイルをスキップ
    if (EXCLUDE_FILES.includes(file)) continue;

    const filePath = join(dir, file);
    const result = validateFile(filePath);

    if (result.errors.length > 0) {
      results.push(result);
    }
  }

  // サブディレクトリも検証
  for (const file of files) {
    const filePath = join(dir, file);
    try {
      const stat = require('fs').statSync(filePath);
      if (stat.isDirectory()) {
        results.push(...validateDirectory(filePath));
      }
    } catch (e) {
      // ディレクトリでない場合はスキップ
    }
  }

  return results;
}

/**
 * メイン実行
 */
function main() {
  console.log('🔍 Validating import statements...\n');

  const results = validateDirectory(SCRIPTS_DIR);

  if (results.length === 0) {
    console.log('✅ All import statements are valid!\n');
    process.exit(0);
  }

  // エラーと警告を分類
  let criticalErrors = 0;
  let warnings = 0;

  results.forEach(result => {
    const critical = result.errors.filter(e => e.type === 'IMPORT_IN_COMMENT');
    const warn = result.errors.filter(e => e.type === 'SCATTERED_IMPORTS');

    if (critical.length > 0) {
      criticalErrors++;
      console.log(`❌ ${result.filePath.replace(SCRIPTS_DIR, 'scripts')}`);
      console.log(`   Imports: ${result.importCount}`);
      critical.forEach(error => {
        console.log(`   ❌ Line ${error.lineNum}: ${error.message}`);
        console.log(`      ${error.line}`);
      });
      console.log('');
    }

    if (warn.length > 0) {
      warnings++;
    }
  });

  if (warnings > 0) {
    console.log(`⚠️  Note: ${warnings} file(s) have scattered imports (not critical)\n`);
  }

  if (criticalErrors > 0) {
    console.log(`\n❌ ${criticalErrors} file(s) with critical errors!\n`);
    process.exit(1);
  }

  console.log('✅ No critical import issues found!\n');
  process.exit(0);
}

main();
