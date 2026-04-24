// ===== 資料庫使用申請單（DOC-8）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-8.docx
// 來源：../source-templates/資料庫_使用申請單.docx
//
// ⚠️  DOC-8 = 資料庫使用申請單（附件2）
//     申請日期、申請者資料、研究計畫摘要各欄位、checkbox 等
// 執行：node scripts/inject-doc8.cjs  或  npm run inject-doc8

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/資料庫_使用申請單.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-8.docx');

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-8.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}
function replaceText(xml, oldText, newText) {
  const esc = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r = xml.replace(new RegExp(`(>)${esc}(<)`, 'g'), `$1${newText}$2`);
  return r !== xml ? r : xml.replace(new RegExp(esc, 'g'), newText);
}

// 在標籤所在 cell 的下一個相鄰 cell 中插入 placeholder
function insertInNextCell(xml, labelText, placeholder) {
  const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${esc}<\\/w:t><\\/w:r><\\/w:p><\\/w:tc>` +
    `<w:tc><w:tcPr>[\\s\\S]*?<\\/w:tcPr>` +
    `<w:p[^>]*><w:pPr>[\\s\\S]*?<\\/w:pPr>)` +
    `(<\\/w:p>)`
  );
  const r = xml.replace(pattern, `$1<w:r><w:t>${placeholder}</w:t></w:r>$2`);
  if (r !== xml) return r;
  return replaceText(xml, labelText, labelText + placeholder);
}

// 替換第 N 個出現的字串
function replaceNth(xml, search, replacement, n) {
  const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(esc, 'g');
  let count = 0;
  return xml.replace(re, (match) => {
    count++;
    return count === n ? replacement : match;
  });
}

console.log('📄 Processing DOC-8: 資料庫使用申請單');
let { zip, xml } = readDocXml(SRC);

// ===== 一、申請日期（民國年月日 → 合併為單一 placeholder）=====
// 原始結構：申請日期：民國<blank>年<blank>月<blank>日（多個 run）
// 保留 "民國" 前面的文字，其後換成 placeholder
xml = xml.replace(
  /(<w:t>申請日期：民國<\/w:t><\/w:r>)[\s\S]*?(<w:t>日<\/w:t><\/w:r>)/,
  '$1<w:r><w:t>{apply_date_roc}</w:t></w:r>'
);

// ===== 一、申請者資料（表格 label → 下一格）=====
xml = insertInNextCell(xml, '申請單位',  '{apply_unit}');
xml = insertInNextCell(xml, '申請人員',  '{pi_name_zh}');
xml = insertInNextCell(xml, '公務電話',  '{pi_phone}');
xml = insertInNextCell(xml, 'E-mail',    '{pi_email}');

// ===== 一、研究目的及用途 checkbox =====
// ⬛️ = 已勾選（原始預設），□ = 未勾選
// 每次 replaceNth 後剩餘數量減 1，所以連續替換都用 n=1
xml = replaceNth(xml, '⬛️', '{purpose_no_fund}', 1); // 無需經費研究計畫（預設）

// □ checkboxes - 在相鄰 run 的使用 cross-run 正則，在同一 run 的用 replaceText
// □ + 署內科技（兩個 run）
xml = xml.replace(/(>)□(<\/w:t><\/w:r>[\s\S]{0,400}?<w:t[^>]*>)署內科技/, '$1{purpose_internal}$2署內科技');
// □ + 碩（兩個 run）
xml = xml.replace(/(>)□(<\/w:t><\/w:r>[\s\S]{0,400}?<w:t[^>]*>)碩/, '$1{purpose_thesis}$2碩');
// □ + 其他，請說明（兩個 run）
xml = xml.replace(/(>)□(<\/w:t><\/w:r>[\s\S]{0,400}?<w:t[^>]*>)其他，請說明/, '$1{purpose_other}$2其他，請說明');
xml = xml.replace(
  /(<w:t[^>]*>其他，請說明：<\/w:t><\/w:r><w:r[^>]*>[\s\S]*?<w:t[^>]*>)________________________________________(<\/w:t>)/,
  '$1{purpose_other_detail}$2'
);

// ===== 二、研究計畫摘要（表格欄位）=====
xml = insertInNextCell(xml, '年   度',   '{project_year}');
xml = insertInNextCell(xml, '計畫名稱',  '{project_title_zh}');
xml = xml.replace(
  /(<w:t>計畫期間<\/w:t>[\s\S]*?<\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*><w:pPr>[\s\S]*?<\/w:pPr>)(<\/w:p><\/w:tc>)/,
  '$1<w:r><w:t>{execution_period_text}</w:t></w:r>$2'
);
xml = insertInNextCell(xml, '計畫緣起',  '{background}');
xml = insertInNextCell(xml, '計畫目的',  '{purpose}');
xml = insertInNextCell(xml, '實施方法及進行步驟', '{methodology}');
xml = insertInNextCell(xml, '資料庫預定使用範圍', '{db_usage_scope}');

// 分析期限、保留期限
// 原始 XML 共有 4 處「：_____________」(13 個底線)：
//   ① 分析期限  ② 保留期限  ③ 其他分析平台  ④ 資科中心資料庫名稱
// replaceNth 會在每次替換後重新計數，所以連續用 n=1 依序吃掉 ①②。
xml = replaceNth(xml, '：_____________', '：{analysis_deadline_roc}', 1);
xml = replaceNth(xml, '：_____________', '：{retention_deadline_roc}', 1);

// ===== 資料交付方式 checkbox =====
// 連續替換 ⬛️ 都用 n=1（前一個已被替換成其他文字）
xml = replaceNth(xml, '⬛️', '{delivery_digital}', 1); // 數位檔案（預設）
xml = replaceText(xml, '□紙本　　         ', '{delivery_paper}紙本　　         ');

// ===== 資料使用地點 checkbox =====
xml = replaceNth(xml, '⬛️', '{loc_office}', 1); // 本署署內辦公場域（預設）
xml = replaceNth(xml, '⬛️', '{loc_pc}',     1); // 個人公務電腦（預設）
// □ + 其他分析平台（兩個 run）
xml = xml.replace(/(>)□(<\/w:t><\/w:r>[\s\S]{0,400}?<w:t[^>]*>)其他分析平台/, '$1{loc_other}$2其他分析平台');
xml = replaceText(xml, '□資科中心', '{loc_data_center}資科中心');

// ===== 研究成果預計處理類型 checkbox =====
xml = replaceNth(xml, '⬛️', '{outcome_paper_writing}', 1); // 3.論文寫作
xml = replaceText(xml, '□1.提供決策___件', '{outcome_policy}1.提供決策{outcome_policy_count}件');
xml = replaceText(xml, '□2.研究報告___件 ', '{outcome_report}2.研究報告{outcome_report_count}件 ');
xml = replaceText(xml,
  '□4.論文發表___件(預計發表日期_________)',
  '{outcome_paper_publish}4.論文發表{outcome_paper_publish_count}件(預計發表日期{outcome_paper_publish_date})');

// ===== 計畫主持人 checkbox =====
xml = replaceNth(xml, '⬛️', '{pi_same}', 1); // 同申請人員（預設）

// ===== 四、資料勾稽 checkbox =====
xml = replaceNth(xml, '⬛️', '{cross_link_no}', 1); // 否（預設）
xml = replaceText(xml, '□是', '{cross_link_yes}是');
// 「資科中心資料庫名稱」標籤與「：_____________」位於不同 <w:t> run，
// 無法用 replaceText 一次比對。改用 replaceNth：前兩處 (分析/保留) 已消耗，
// 剩下「其他分析平台」「資科中心」兩處，資科中心為第 2 個。
xml = replaceNth(xml, '：_____________', '：{cross_link_db_name}', 2);

function injectPlaceholderIntoEmptyCell(cellXml, placeholder) {
  const lastPClose = cellXml.lastIndexOf('</w:p>');
  if (lastPClose === -1) throw new Error('cell 無段落可注入 placeholder');
  return cellXml.slice(0, lastPClose) +
    `<w:r><w:t xml:space="preserve">${placeholder}</w:t></w:r>` +
    cellXml.slice(lastPClose);
}

function processDatabaseSection(sectionIndex, suffix) {
  const sysRe = /<w:t[^>]*>申請系統<\/w:t>/g;
  const sysMatches = [...xml.matchAll(sysRe)];
  if (sysMatches.length < sectionIndex + 1) {
    throw new Error(`找不到第 ${sectionIndex + 1} 個「申請系統」區塊`);
  }

  const labelPos = sysMatches[sectionIndex].index;
  const headerTrStart = xml.lastIndexOf('<w:tr ', labelPos);
  const headerTrEnd = xml.indexOf('</w:tr>', labelPos) + '</w:tr>'.length;
  let headerRow = xml.slice(headerTrStart, headerTrEnd);

  const headerCellRanges = [];
  let p = 0;
  while (true) {
    const s = headerRow.indexOf('<w:tc>', p);
    if (s === -1) break;
    const e = headerRow.indexOf('</w:tc>', s) + '</w:tc>'.length;
    headerCellRanges.push([s, e]);
    p = e;
  }
  if (headerCellRanges.length !== 6) throw new Error(`第 ${sectionIndex + 1} 個 header row 預期 6 cells，實得 ${headerCellRanges.length}`);

  const injectIntoHeaderCell = (idx, placeholder) => {
    const [s, e] = headerCellRanges[idx];
    headerRow = headerRow.slice(0, s)
      + injectPlaceholderIntoEmptyCell(headerRow.slice(s, e), placeholder)
      + headerRow.slice(e);
  };

  injectIntoHeaderCell(5, `{apply_year_text${suffix}}`);
  injectIntoHeaderCell(3, `{apply_condition${suffix}}`);
  injectIntoHeaderCell(1, `{apply_system_text${suffix}}`);
  xml = xml.slice(0, headerTrStart) + headerRow + xml.slice(headerTrEnd);

  const seqRe = /<w:t[^>]*>序號<\/w:t>/g;
  const seqMatches = [...xml.matchAll(seqRe)];
  const seqMatchIndex = sectionIndex + 1;
  if (seqMatches.length < seqMatchIndex + 1) {
    throw new Error(`找不到第 ${seqMatchIndex + 1} 個「序號」區塊`);
  }
  const seqHeaderPos = seqMatches[seqMatchIndex].index;
  const seqHeaderTrEnd = xml.indexOf('</w:tr>', seqHeaderPos) + '</w:tr>'.length;

  const row1Start = xml.indexOf('<w:tr ', seqHeaderTrEnd);
  const row1End = xml.indexOf('</w:tr>', row1Start) + '</w:tr>'.length;
  const row2End = xml.indexOf('</w:tr>', row1End) + '</w:tr>'.length;
  const row3End = xml.indexOf('</w:tr>', row2End) + '</w:tr>'.length;

  let row1 = xml.slice(row1Start, row1End);
  const dataCellRanges = [];
  p = 0;
  while (true) {
    const s = row1.indexOf('<w:tc>', p);
    if (s === -1) break;
    const e = row1.indexOf('</w:tc>', s) + '</w:tc>'.length;
    dataCellRanges.push([s, e]);
    p = e;
  }
  if (dataCellRanges.length !== 3) throw new Error(`第 ${sectionIndex + 1} 個 data row 預期 3 cells，實得 ${dataCellRanges.length}`);

  const loopName = `data_field_rows${suffix}`;
  const updateDataCell = (idx, placeholder) => {
    const [s, e] = dataCellRanges[idx];
    row1 = row1.slice(0, s)
      + injectPlaceholderIntoEmptyCell(row1.slice(s, e), placeholder)
      + row1.slice(e);
  };

  updateDataCell(2, `{apply_purpose}{/${loopName}}`);
  updateDataCell(1, '{field_name}');
  row1 = row1.replace(/<w:t[^>]*>1<\/w:t>/, `<w:t xml:space="preserve">{#${loopName}}{field_index}</w:t>`);

  xml = xml.slice(0, row1Start) + row1 + xml.slice(row3End);
}

function processDbPersonnelRoster() {
  const label = '共同參與研究人員及實際處理資料人員清冊';
  const labelPos = xml.indexOf(label);
  if (labelPos === -1) {
    throw new Error(`找不到「${label}」區塊`);
  }

  const labelRowEnd = xml.indexOf('</w:tr>', labelPos) + '</w:tr>'.length;
  const headerRowStart = xml.indexOf('<w:tr ', labelRowEnd);
  const headerRowEnd = xml.indexOf('</w:tr>', headerRowStart) + '</w:tr>'.length;

  const row1Start = xml.indexOf('<w:tr ', headerRowEnd);
  const row1End = xml.indexOf('</w:tr>', row1Start) + '</w:tr>'.length;
  const row2End = xml.indexOf('</w:tr>', row1End) + '</w:tr>'.length;
  const row3End = xml.indexOf('</w:tr>', row2End) + '</w:tr>'.length;
  const row4End = xml.indexOf('</w:tr>', row3End) + '</w:tr>'.length;

  let row1 = xml.slice(row1Start, row1End);
  const cellRanges = [];
  let p = 0;
  while (true) {
    const s = row1.indexOf('<w:tc>', p);
    if (s === -1) break;
    const e = row1.indexOf('</w:tc>', s) + '</w:tc>'.length;
    cellRanges.push([s, e]);
    p = e;
  }
  if (cellRanges.length !== 4) {
    throw new Error(`共同人員清冊資料列預期 4 cells，實得 ${cellRanges.length}`);
  }

  const placeholders = ['{#db_personnel}{name_zh}', '{unit}', '{title}', '{phone}{/db_personnel}'];
  // 由右往左改，避免前面 cell 插入 placeholder 後把後面 cell 的 index 擠歪
  placeholders.slice().reverse().forEach((placeholder, reverseIdx) => {
    const idx = placeholders.length - 1 - reverseIdx;
    const [s, e] = cellRanges[idx];
    row1 = row1.slice(0, s)
      + injectPlaceholderIntoEmptyCell(row1.slice(s, e), placeholder)
      + row1.slice(e);
  });

  xml = xml.slice(0, row1Start) + row1 + xml.slice(row4End);
}

// 將 header label「申請年度」改為「資料期間」
xml = replaceText(xml, '申請年度', '資料期間');

processDatabaseSection(0, '');
processDatabaseSection(1, '_2');
processDatabaseSection(2, '_3');
processDbPersonnelRoster();

console.log('  ✓ 資料庫使用申請單 欄位注入');
saveDoc(zip, xml, OUT);
