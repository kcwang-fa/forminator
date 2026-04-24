// ===== 個人資料利用申請表（DOC-10）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-10.docx
// 來源：../source-templates/附件3-113-個人資料利用申請表D-205-0113-1140410-V5.0.docx
//
// 只注入「本欄由申請單位填寫」區塊：
//   申請單位 / 申請人員 / 公務聯絡電話 / 申請日期 / 申請事由說明 /
//   使用期間 / 資料檔案名稱及內容
// 申請項目、利用依據、利用目的、交付方式為固定文字（原檔即已勾選 ■，保留原樣）。
// 後面簽核區（申請單位主管、業務權責單位）留空不注入。
//
// 執行：node scripts/inject-doc10.cjs  或  npm run inject-doc10

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/附件3-113-個人資料利用申請表D-205-0113-1140410-V5.0.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-10.docx');

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-10.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}

function replaceOnce(xml, pattern, replacement) {
  return xml.replace(pattern, replacement);
}

console.log('📄 Processing DOC-10: 個人資料利用申請表');
let { zip, xml } = readDocXml(SRC);

// ===== 申請者資料（申請單位=主持人服務單位；申請人員=主持人；公務聯絡電話=主持人聯絡電話）=====
xml = replaceOnce(xml, /<w:t([^>]*)>中區管制中心<\/w:t>/,           '<w:t$1>{pi_unit}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)>王功錦<\/w:t>/,                  '<w:t$1>{pi_name_zh}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)>\(04\)24739940-203<\/w:t>/,      '<w:t$1>{pi_phone}</w:t>');

// ===== 申請日期（115 年 04 月 24 日 → 民國年月日）=====
xml = replaceOnce(xml, /<w:t([^>]*)>115<\/w:t>/,                     '<w:t$1>{filing_year}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)> 04 <\/w:t>/,                    '<w:t$1>{filing_month}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)>24<\/w:t>/,                      '<w:t$1>{filing_day}</w:t>');

// ===== 申請事由說明 =====
xml = replaceOnce(xml, /<w:t([^>]*)>台灣李斯特菌之流行病學與全基因體定序特徵分析<\/w:t>/,
                                                                     '<w:t$1>{project_title_zh}</w:t>');
xml = replaceOnce(
  xml,
  /<w:t([^>]*)>」\(計畫編號:115111\)，已完成本署人體研究委員會免審通過，申請防疫資料庫去識別化個人資料。<\/w:t>/,
  '<w:t$1>」(IRB編號:{irb_number})，已完成本署人體研究委員會{irb_review_type_text}通過，申請防疫資料庫去識別化個人資料。</w:t>'
);

// ===== 使用期間 =====
xml = replaceOnce(xml, /<w:t([^>]*)>自收到資料後至研究期程截止日115年12月31日<\/w:t>/,
                                                                     '<w:t$1>自收到資料後至研究期程截止日{execution_end_roc}</w:t>');

// ===== 資料檔案名稱及內容 =====
xml = replaceOnce(xml, /<w:t([^>]*)>倉儲系統<\/w:t>/,                '<w:t$1>{doc10_data_scope}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)>中2018年至2025年李斯特菌症確定個案之人口學資料。<\/w:t>/,
                                                                     '<w:t$1></w:t>');

console.log('  ✓ 個人資料利用申請表 申請單位填寫區注入');
saveDoc(zip, xml, OUT);
