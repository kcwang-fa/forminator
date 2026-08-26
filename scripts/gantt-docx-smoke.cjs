// DOC-2 七、預定進度（甘特圖）結構 smoke test。
//
// 防的是兩件事：
// 1. 多年期時「每年一張完整甘特表」不要退化成同一張表裡堆列。
// 2. 表頭左上角那個「斜線標題格」（官方表單長相：<w:tl2br> 對角線 + 右上「月　次」／
//    左下「工作項目」）不要被年度標籤等額外內容塞進去撐歪 —— 年度標題必須在表格「外面」
//    的獨立段落，而不是在角落欄裡。
//
// 執行：node scripts/gantt-docx-smoke.cjs 或 npm run smoke:gantt-docx

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../public/templates/DOC-2.docx');

// 每次渲染都要重新讀模板 —— Docxtemplater 是「一次性」的，同一個實體不能 render 兩次。
function renderWith(data) {
  const doc = new Docxtemplater(new PizZip(fs.readFileSync(templatePath)), {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });
  doc.render(data);
  return doc.getZip().file('word/document.xml').asText();
}

// 造一年份的甘特資料：12 個月欄，前三個月打 ■。
function ganttYear(yearLabel) {
  const row = { task_name: '資料清理' };
  for (let i = 1; i <= 12; i++) row[`m${i}`] = i <= 3 ? '■' : '';
  return {
    year_label: yearLabel,
    // has_year_label 是「上方年度標題段落」的開關：一年期為 false，整段不輸出。
    has_year_label: yearLabel !== '',
    gantt_rows: [row],
  };
}

// 從 document.xml 找出所有「甘特表」= 含表頭錨點「月　次」的 <w:tbl>。
function findGanttTables(xml) {
  // ⚠️ 表格開頭有兩種形態：<w:tbl> 與 <w:tbl w:rsidR="...">，regex 要同時吃到，
  // 否則非貪婪匹配會從某張表一路吃到別張表的 </w:tbl>，數量就對不上了。
  return [...xml.matchAll(/<w:tbl(?: [^>]*)?>[\s\S]*?<\/w:tbl>/g)]
    .map((m) => ({ start: m.index, end: m.index + m[0].length, xml: m[0] }))
    .filter((t) => t.xml.includes('月　次'));
}

// 取表格第一格（左上角落欄）的純文字，用來確認裡面只剩「月次／工作項目」。
function cornerCellText(tableXml) {
  const cell = tableXml.slice(0, tableXml.indexOf('</w:tc>'));
  return [...cell.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)].map((m) => m[1]).join('');
}

// ===== 情境 1：多年期（3 年）=====
{
  const labels = ['第一年（115 年度）', '第二年（116 年度）', '第三年（117 年度）'];
  const xml = renderWith({ gantt_years: labels.map(ganttYear) });
  const tables = findGanttTables(xml);

  assert.equal(tables.length, 3, '多年期三年應渲染成 3 張獨立甘特表');

  tables.forEach((table, index) => {
    // 角落欄的斜線（左上→右下對角線框線）必須還在
    assert.ok(
      table.xml.includes('<w:tl2br'),
      `第 ${index + 1} 張甘特表的角落欄少了斜線 <w:tl2br>`,
    );
    // 角落欄裡只能有「月　次」「工作項目」，不可混入年度標籤
    const corner = cornerCellText(table.xml);
    assert.equal(
      corner.replace(/\s/g, ''),
      '月次工作項目',
      `第 ${index + 1} 張甘特表的角落欄混入了額外文字：「${corner}」`,
    );
  });

  // 年度標題必須出現在「表格前面」的段落裡（每張表各自一個）
  labels.forEach((label, index) => {
    const labelPos = xml.indexOf(label);
    assert.ok(labelPos > 0, `找不到年度標題「${label}」`);
    assert.ok(
      labelPos < tables[index].start && labelPos > (index === 0 ? 0 : tables[index - 1].end),
      `年度標題「${label}」不在第 ${index + 1} 張甘特表的正上方`,
    );
  });
}

// ===== 情境 2：一年期（不標年度）=====
{
  const xml = renderWith({ gantt_years: [ganttYear('')] });
  const tables = findGanttTables(xml);

  assert.equal(tables.length, 1, '一年期應只有 1 張甘特表');
  assert.ok(tables[0].xml.includes('<w:tl2br'), '一年期甘特表角落欄少了斜線');
  assert.equal(
    cornerCellText(tables[0].xml).replace(/\s/g, ''),
    '月次工作項目',
    '一年期甘特表角落欄不該有額外文字',
  );
  // has_year_label=false → 年度標題段落整段消失，不留空行
  assert.ok(!xml.includes('{year_label}'), '殘留未渲染的 {year_label} 標籤');
}

console.log('[gantt-docx-smoke] ✓ 多年期 3 張獨立甘特表、角落欄斜線與「月次／工作項目」維持原樣');
