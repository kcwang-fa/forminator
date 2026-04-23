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
xml = replaceNth(xml, '⬛️', '{outcome_paper_writing}', 1); // 3.論文寫作（預設）
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

// ===== 三、申請使用之防疫資料庫（第一個區塊）=====
// 原始表格每區塊有 2 個 header row + 3 個空白 data row（序號 1/2/3）。
// 我們只處理第一個區塊；後兩個區塊留給使用者需要多系統申請時自行填。
//
// 第一個 header row 有 6 個 cells：
//   cell 0/2/4 是 label（申請系統名稱／擷取資料條件／申請年度）
//   cell 1/3/5 是空白 data cells（注入 placeholder）
// 第二個 header row 是「序號 / 中文欄位名稱 / 申請目的」。
// 接著 3 個 data rows（序號 1/2/3），我們把序號 1 的 row 改成 docxtemplater loop，
// 並刪除序號 2/3 的 row（由 loop 動態展開）。
{
  // 找第一個「申請系統」header row 範圍
  const sysMatch = xml.match(/<w:t[^>]*>申請系統<\/w:t>/);
  if (!sysMatch) throw new Error('找不到「申請系統」');
  const labelPos = sysMatch.index;
  const headerTrStart = xml.lastIndexOf('<w:tr ', labelPos);
  const headerTrEnd = xml.indexOf('</w:tr>', labelPos) + '</w:tr>'.length;
  let headerRow = xml.slice(headerTrStart, headerTrEnd);

  // 拆出 6 個 cells
  const cellRanges = [];
  let p = 0;
  while (true) {
    const s = headerRow.indexOf('<w:tc>', p);
    if (s === -1) break;
    const e = headerRow.indexOf('</w:tc>', s) + '</w:tc>'.length;
    cellRanges.push([s, e]);
    p = e;
  }
  if (cellRanges.length !== 6) throw new Error(`header row 預期 6 cells，實得 ${cellRanges.length}`);

  // 在空白 cell（1/3/5）的空段落中插入 placeholder run
  const injectPlaceholderIntoEmptyCell = (cellXml, placeholder) => {
    // 找該 cell 最後一個 <w:p...></w:p> 中的位置，在 </w:p> 前塞入 <w:r><w:t>{x}</w:t></w:r>
    const lastPClose = cellXml.lastIndexOf('</w:p>');
    if (lastPClose === -1) throw new Error('cell 無段落可注入 placeholder');
    return cellXml.slice(0, lastPClose) +
      `<w:r><w:t xml:space="preserve">${placeholder}</w:t></w:r>` +
      cellXml.slice(lastPClose);
  };

  // 從後往前替換才不會位移 index
  const injectIntoCell = (idx, placeholder) => {
    const [s, e] = cellRanges[idx];
    const before = headerRow.slice(0, s);
    const cell = headerRow.slice(s, e);
    const after = headerRow.slice(e);
    headerRow = before + injectPlaceholderIntoEmptyCell(cell, placeholder) + after;
  };

  // 倒序注入避免 range 失效
  injectIntoCell(5, '{apply_year_text}');
  injectIntoCell(3, '{apply_condition}');
  injectIntoCell(1, '{apply_system_text}');

  // 替換回 xml
  xml = xml.slice(0, headerTrStart) + headerRow + xml.slice(headerTrEnd);
}

// 「序號 1/2/3」三個 data rows：序號 1 改成 loop、2/3 刪除
{
  // 定位「序號」header row（107xxx 那個，不是申請日期旁的「序號：___」）
  // 從第 2 個 <w:t>序號</w:t> 開始
  const seqRe = /<w:t[^>]*>序號<\/w:t>/g;
  const matches = [...xml.matchAll(seqRe)];
  if (matches.length < 2) throw new Error('找不到第 2 個「序號」出現位置');
  const seqHeaderPos = matches[1].index;
  const seqHeaderTrEnd = xml.indexOf('</w:tr>', seqHeaderPos) + '</w:tr>'.length;

  // 下一個 tr 是「1」、再下 tr 是「2」、再下 tr 是「3」
  const row1Start = xml.indexOf('<w:tr ', seqHeaderTrEnd);
  const row1End = xml.indexOf('</w:tr>', row1Start) + '</w:tr>'.length;
  const row2End = xml.indexOf('</w:tr>', row1End) + '</w:tr>'.length;
  const row3End = xml.indexOf('</w:tr>', row2End) + '</w:tr>'.length;

  let row1 = xml.slice(row1Start, row1End);

  // 拆 row1 的 3 cells
  const cellRanges = [];
  let p = 0;
  while (true) {
    const s = row1.indexOf('<w:tc>', p);
    if (s === -1) break;
    const e = row1.indexOf('</w:tc>', s) + '</w:tc>'.length;
    cellRanges.push([s, e]);
    p = e;
  }
  if (cellRanges.length !== 3) throw new Error(`data row 預期 3 cells，實得 ${cellRanges.length}`);

  // Cell 0: 序號「1」 → 改成 `{#data_field_rows}{field_index}`
  // Cell 1: 空白 → 注入 `{field_name}`
  // Cell 2: 空白 → 注入 `{apply_purpose_text}{/data_field_rows}`
  const injectEmpty = (cell, placeholder) => {
    const lastPClose = cell.lastIndexOf('</w:p>');
    return cell.slice(0, lastPClose) +
      `<w:r><w:t xml:space="preserve">${placeholder}</w:t></w:r>` +
      cell.slice(lastPClose);
  };

  // 倒序修改
  {
    const [s, e] = cellRanges[2];
    row1 = row1.slice(0, s) + injectEmpty(row1.slice(s, e), '{apply_purpose_text}{/data_field_rows}') + row1.slice(e);
  }
  {
    const [s, e] = cellRanges[1];
    row1 = row1.slice(0, s) + injectEmpty(row1.slice(s, e), '{field_name}') + row1.slice(e);
  }
  // Cell 0: 把 `<w:t>1</w:t>` 換成 `<w:t>{#data_field_rows}{field_index}</w:t>`
  row1 = row1.replace(/<w:t[^>]*>1<\/w:t>/, '<w:t xml:space="preserve">{#data_field_rows}{field_index}</w:t>');

  // 用修改後的 row1 取代原 row1 + row2 + row3（刪除 row2/3）
  xml = xml.slice(0, row1Start) + row1 + xml.slice(row3End);
}

console.log('  ✓ 資料庫使用申請單 欄位注入');
saveDoc(zip, xml, OUT);
