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

// ===== 二、研究計畫摘要（表格欄位）=====
xml = insertInNextCell(xml, '年   度',   '{project_year}');
xml = insertInNextCell(xml, '計畫名稱',  '{project_title_zh}');
xml = insertInNextCell(xml, '計畫緣起',  '{background}');
xml = insertInNextCell(xml, '計畫目的',  '{purpose}');
xml = insertInNextCell(xml, '實施方法及進行步驟', '{methodology}');

// 分析期限、保留期限（原始格式：「分析期|限|：_____________」）
// 第 2、3 個「：_____________」分別對應分析/保留期限（第 1 個是序號）
xml = replaceNth(xml, '：_____________', '：{analysis_deadline_roc}', 2);
xml = replaceNth(xml, '：_____________', '：{retention_deadline_roc}', 3);

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
xml = replaceText(xml, '資科中心資料庫名稱：_____________', '資科中心資料庫名稱：{cross_link_db_name}');

console.log('  ✓ 資料庫使用申請單 欄位注入');
saveDoc(zip, xml, OUT);
