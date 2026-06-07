// DOC-2 經費頁面結構 smoke test。
// 直接渲染三年度資料，防止年度表又退化成同一張表內堆疊列或錯誤跨頁。

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../public/templates/DOC-2.docx');
const template = new PizZip(fs.readFileSync(templatePath));
const doc = new Docxtemplater(template, {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: { start: '{', end: '}' },
});

const rows = [
  { budget_item: '消耗品', budget_amount: '40', budget_note: '' },
  { budget_item: '差旅費', budget_amount: '111', budget_note: '' },
  { budget_item: '管理費', budget_amount: '23', budget_note: '業務費小計 × 15%' },
];
const blanks = () => Array.from({ length: 12 }, () => ({}));

doc.render({
  budget_years: ['115', '116', '117'].map((year, index) => ({
    by_year: year,
    by_page_break: index === 0 ? [] : [{}],
    budget_rows: rows,
    budget_blanks: blanks(),
    by_total: '174',
  })),
});

const xml = doc.getZip().file('word/document.xml').asText();
const sectionStart = xml.lastIndexOf('陸、經費需求表：');
const sectionEnd = xml.indexOf('柒、', sectionStart);
assert.ok(sectionStart >= 0 && sectionEnd > sectionStart, '找不到 DOC-2 經費章節');

const section = xml.slice(sectionStart, sectionEnd);
const tables = [...section.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].map((match) => ({
  start: match.index,
  end: match.index + match[0].length,
  xml: match[0],
}));

assert.equal(tables.length, 3, '三年度應渲染為 3 張獨立經費表');
assert.equal(
  (section.slice(0, tables[0].start).match(/<w:br w:type="page"\/>/g) || []).length,
  0,
  '第一年度前不應額外分頁',
);
assert.equal(
  (section.match(/<w:pageBreakBefore\/>/g) || []).length,
  0,
  '經費表內不應使用 Word 會忽略的 pageBreakBefore',
);

tables.forEach((table, index) => {
  const rowCount = (table.xml.match(/<w:tr\b/g) || []).length;
  const text = [...table.xml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
    .map((match) => match[1])
    .join('');

  assert.equal(rowCount, 18, `第 ${index + 1} 年經費表應維持官方範本 18 列`);
  assert.ok(
    text.includes(`${115 + index}年度經費需求`),
    `第 ${index + 1} 年經費表年度標題錯誤`,
  );

  if (index > 0) {
    const between = section.slice(tables[index - 1].end, table.start);
    assert.equal(
      (between.match(/<w:br w:type="page"\/>/g) || []).length,
      1,
      `第 ${index + 1} 年前應有且只有 1 個分頁符`,
    );
  }
});

console.log('[budget-docx-smoke] ✓ 3 張年度表、每張 18 列、年度間分頁正確');
