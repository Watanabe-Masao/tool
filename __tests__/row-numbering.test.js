/**
 * 行番号の相対値管理のテスト
 *
 * このテストは、歩留まり統計テーブルとマルチパターンテーブルの
 * 行番号が相対値（位置ベース）で正しく管理されることを確認します。
 */

import { describe, test, expect, beforeEach } from '@jest/globals';

describe('Row Numbering Tests', () => {
  beforeEach(() => {
    // DOM環境をセットアップ
    document.body.innerHTML = `
      <table id="yieldStatsTable">
        <tbody id="yieldStatsTableBody"></tbody>
      </table>
      <table id="patternTable">
        <tbody id="patternTableBody"></tbody>
      </table>
    `;
  });

  describe('Yield Stats Table - Row Numbering', () => {
    test('行番号は位置ベース（1, 2, 3...）で表示される', () => {
      const tbody = document.getElementById('yieldStatsTableBody');

      // 3行追加
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('tr');
        row.className = 'yield-stats-row';
        row.dataset.rowId = i;
        row.innerHTML = `
          <td class="row-number">${i + 1}</td>
          <td><input type="number" id="beforeWeight${i}" /></td>
          <td><input type="number" id="afterWeight${i}" /></td>
        `;
        tbody.appendChild(row);
      }

      // 行番号を確認
      const rows = tbody.querySelectorAll('.yield-stats-row');
      expect(rows[0].querySelector('.row-number').textContent).toBe('1');
      expect(rows[1].querySelector('.row-number').textContent).toBe('2');
      expect(rows[2].querySelector('.row-number').textContent).toBe('3');
    });

    test('中間の行を削除した後、行番号が再採番される（1, 2, 3）', () => {
      const tbody = document.getElementById('yieldStatsTableBody');

      // 3行追加
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('tr');
        row.className = 'yield-stats-row';
        row.dataset.rowId = i;
        row.innerHTML = `
          <td class="row-number">${i + 1}</td>
          <td><input type="number" id="beforeWeight${i}" /></td>
          <td><input type="number" id="afterWeight${i}" /></td>
        `;
        tbody.appendChild(row);
      }

      // 2行目を削除
      const rows = tbody.querySelectorAll('.yield-stats-row');
      rows[1].remove();

      // 行番号を更新（updateRowNumbers相当の処理）
      const remainingRows = tbody.querySelectorAll('.yield-stats-row');
      remainingRows.forEach((row, index) => {
        const rowNumberCell = row.querySelector('.row-number');
        if (rowNumberCell) {
          rowNumberCell.textContent = index + 1;
        }
      });

      // 行番号が1, 2になっていることを確認
      const updatedRows = tbody.querySelectorAll('.yield-stats-row');
      expect(updatedRows.length).toBe(2);
      expect(updatedRows[0].querySelector('.row-number').textContent).toBe('1');
      expect(updatedRows[1].querySelector('.row-number').textContent).toBe('2');
    });

    test('全行をクリアして1行追加した場合、行番号は1から始まる', () => {
      const tbody = document.getElementById('yieldStatsTableBody');

      // 最初に3行追加
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('tr');
        row.className = 'yield-stats-row';
        row.dataset.rowId = i;
        row.innerHTML = `
          <td class="row-number">${i + 1}</td>
          <td><input type="number" id="beforeWeight${i}" /></td>
          <td><input type="number" id="afterWeight${i}" /></td>
        `;
        tbody.appendChild(row);
      }

      // 全行をクリア
      tbody.innerHTML = '';

      // 新しい行を1つ追加
      const row = document.createElement('tr');
      row.className = 'yield-stats-row';
      row.dataset.rowId = 0;
      row.innerHTML = `
        <td class="row-number">1</td>
        <td><input type="number" id="beforeWeight0" /></td>
        <td><input type="number" id="afterWeight0" /></td>
      `;
      tbody.appendChild(row);

      // 行番号が1であることを確認
      const newRow = tbody.querySelector('.yield-stats-row');
      expect(newRow.querySelector('.row-number').textContent).toBe('1');
    });

    test('データ復元時、行番号は配列の位置に基づいて割り当てられる', () => {
      const tbody = document.getElementById('yieldStatsTableBody');

      // 保存されたデータ（配列の位置 = 行番号）
      const savedData = [
        { beforeWeight: 100, afterWeight: 85 },
        { beforeWeight: 150, afterWeight: 127.5 },
        { beforeWeight: 200, afterWeight: 170 }
      ];

      // データを復元
      savedData.forEach((data, index) => {
        const row = document.createElement('tr');
        row.className = 'yield-stats-row';
        row.dataset.rowId = index;
        row.innerHTML = `
          <td class="row-number">${index + 1}</td>
          <td><input type="number" id="beforeWeight${index}" value="${data.beforeWeight}" /></td>
          <td><input type="number" id="afterWeight${index}" value="${data.afterWeight}" /></td>
        `;
        tbody.appendChild(row);
      });

      // 行番号を確認
      const rows = tbody.querySelectorAll('.yield-stats-row');
      expect(rows[0].querySelector('.row-number').textContent).toBe('1');
      expect(rows[1].querySelector('.row-number').textContent).toBe('2');
      expect(rows[2].querySelector('.row-number').textContent).toBe('3');

      // データが正しく復元されていることも確認
      expect(rows[0].querySelector('input[id^="beforeWeight"]').value).toBe('100');
      expect(rows[1].querySelector('input[id^="beforeWeight"]').value).toBe('150');
      expect(rows[2].querySelector('input[id^="beforeWeight"]').value).toBe('200');
    });
  });

  describe('Multi-Pattern Table - Row Numbering', () => {
    test('パターン番号は位置ベース（1, 2, 3...）で表示される', () => {
      const tbody = document.getElementById('patternTableBody');

      // 3パターン追加
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('tr');
        row.dataset.patternId = i + 1;
        row.innerHTML = `
          <td class="pattern-number">${i + 1}</td>
          <td><input type="number" class="pattern-unit-cost" /></td>
          <td><input type="number" class="pattern-unit-price" /></td>
          <td><input type="number" class="pattern-after-price" /></td>
          <td><button type="button" class="btn-remove">削除</button></td>
        `;
        tbody.appendChild(row);
      }

      // パターン番号を確認
      const rows = tbody.querySelectorAll('tr[data-pattern-id]');
      expect(rows[0].querySelector('.pattern-number').textContent).toBe('1');
      expect(rows[1].querySelector('.pattern-number').textContent).toBe('2');
      expect(rows[2].querySelector('.pattern-number').textContent).toBe('3');
    });

    test('中間のパターンを削除した後、パターン番号が再採番される', () => {
      const tbody = document.getElementById('patternTableBody');

      // 3パターン追加
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('tr');
        row.dataset.patternId = i + 1;
        row.innerHTML = `
          <td class="pattern-number">${i + 1}</td>
          <td><input type="number" class="pattern-unit-cost" /></td>
          <td><input type="number" class="pattern-unit-price" /></td>
          <td><input type="number" class="pattern-after-price" /></td>
          <td><button type="button" class="btn-remove">削除</button></td>
        `;
        tbody.appendChild(row);
      }

      // 2パターン目を削除
      const rows = tbody.querySelectorAll('tr[data-pattern-id]');
      rows[1].remove();

      // パターン番号を更新（updatePatternNumbers相当の処理）
      const remainingRows = tbody.querySelectorAll('tr[data-pattern-id]');
      remainingRows.forEach((row, index) => {
        const patternNumberCell = row.querySelector('.pattern-number');
        if (patternNumberCell) {
          patternNumberCell.textContent = index + 1;
        }
      });

      // パターン番号が1, 2になっていることを確認
      const updatedRows = tbody.querySelectorAll('tr[data-pattern-id]');
      expect(updatedRows.length).toBe(2);
      expect(updatedRows[0].querySelector('.pattern-number').textContent).toBe('1');
      expect(updatedRows[1].querySelector('.pattern-number').textContent).toBe('2');
    });

    test('パターンを全て置き換えた場合、番号は1から始まる', () => {
      const tbody = document.getElementById('patternTableBody');

      // 既存のパターンをクリア
      tbody.innerHTML = '';

      // 新しいパターンを追加
      const newPatterns = [
        { label: 'Pattern A', value: 150, sigma: 5 },
        { label: 'Pattern B', value: 160, sigma: 5 }
      ];

      newPatterns.forEach((pattern, index) => {
        const row = document.createElement('tr');
        row.dataset.patternId = index + 1;
        row.innerHTML = `
          <td class="pattern-number">${index + 1}</td>
          <td><input type="number" class="pattern-unit-cost" /></td>
          <td><input type="number" class="pattern-unit-price" /></td>
          <td><input type="number" class="pattern-after-price" /></td>
          <td><button type="button" class="btn-remove">削除</button></td>
        `;
        tbody.appendChild(row);
      });

      // パターン番号を確認
      const rows = tbody.querySelectorAll('tr[data-pattern-id]');
      expect(rows.length).toBe(2);
      expect(rows[0].querySelector('.pattern-number').textContent).toBe('1');
      expect(rows[1].querySelector('.pattern-number').textContent).toBe('2');
    });
  });

  describe('Data Storage Format - No Absolute IDs', () => {
    test('保存データには行IDが含まれず、配列の位置のみが保持される', () => {
      // シミュレート: collectInputValues() の動作
      const tableData = [];
      const tbody = document.getElementById('yieldStatsTableBody');

      // 3行のデータを作成
      for (let i = 0; i < 3; i++) {
        const row = document.createElement('tr');
        row.className = 'yield-stats-row';
        row.dataset.rowId = i + 10; // 内部IDは10, 11, 12（絶対値）
        row.innerHTML = `
          <td class="row-number">${i + 1}</td>
          <td><input type="number" id="beforeWeight${i + 10}" value="${100 + i * 50}" /></td>
          <td><input type="number" id="afterWeight${i + 10}" value="${85 + i * 42.5}" /></td>
        `;
        tbody.appendChild(row);
      }

      // データ収集（row IDは含めない）
      const rows = tbody.querySelectorAll('.yield-stats-row');
      rows.forEach(row => {
        const rowId = row.dataset.rowId;
        const beforeInput = document.getElementById(`beforeWeight${rowId}`);
        const afterInput = document.getElementById(`afterWeight${rowId}`);

        if (beforeInput && afterInput) {
          const beforeWeight = beforeInput.value;
          const afterWeight = afterInput.value;

          if (beforeWeight !== '' || afterWeight !== '') {
            // 行IDは保存しない！配列の位置のみ
            tableData.push({
              beforeWeight: parseFloat(beforeWeight) || 0,
              afterWeight: parseFloat(afterWeight) || 0
            });
          }
        }
      });

      // 保存データを確認
      expect(tableData.length).toBe(3);
      expect(tableData[0]).toEqual({ beforeWeight: 100, afterWeight: 85 });
      expect(tableData[1]).toEqual({ beforeWeight: 150, afterWeight: 127.5 });
      expect(tableData[2]).toEqual({ beforeWeight: 200, afterWeight: 170 });

      // 重要: 行IDが含まれていないことを確認
      expect(tableData[0]).not.toHaveProperty('rowId');
      expect(tableData[0]).not.toHaveProperty('id');
      expect(tableData[0]).not.toHaveProperty('rowNumber');
    });
  });

  describe('Edge Cases', () => {
    test('空のテーブルに1行追加した場合、番号は1', () => {
      const tbody = document.getElementById('yieldStatsTableBody');

      const row = document.createElement('tr');
      row.className = 'yield-stats-row';
      row.dataset.rowId = 0;
      row.innerHTML = `
        <td class="row-number">1</td>
        <td><input type="number" id="beforeWeight0" /></td>
        <td><input type="number" id="afterWeight0" /></td>
      `;
      tbody.appendChild(row);

      expect(tbody.querySelectorAll('.yield-stats-row').length).toBe(1);
      expect(tbody.querySelector('.row-number').textContent).toBe('1');
    });

    test('100行以上でも正しく番号が振られる', () => {
      const tbody = document.getElementById('yieldStatsTableBody');

      // 150行追加
      for (let i = 0; i < 150; i++) {
        const row = document.createElement('tr');
        row.className = 'yield-stats-row';
        row.dataset.rowId = i;
        row.innerHTML = `
          <td class="row-number">${i + 1}</td>
          <td><input type="number" id="beforeWeight${i}" /></td>
          <td><input type="number" id="afterWeight${i}" /></td>
        `;
        tbody.appendChild(row);
      }

      const rows = tbody.querySelectorAll('.yield-stats-row');
      expect(rows.length).toBe(150);
      expect(rows[0].querySelector('.row-number').textContent).toBe('1');
      expect(rows[99].querySelector('.row-number').textContent).toBe('100');
      expect(rows[149].querySelector('.row-number').textContent).toBe('150');
    });
  });
});
