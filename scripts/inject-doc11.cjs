// ===== 個人資料利用申請表（DOC-11）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-11.docx
// 來源：../source-templates/附件3-113-個人資料利用申請表D-205-0113-1140410-V5.0.docx
//
// 只注入「本欄由申請單位填寫」區塊：
//   申請單位 / 申請人員 / 公務聯絡電話 / 申請日期 / 申請事由說明 /
//   使用期間 / 資料檔案名稱及內容
// 申請項目、利用依據、利用目的、交付方式為固定文字（原檔即已勾選 ■，保留原樣）。
// 後面簽核區（申請單位主管、業務權責單位）留空不注入。
//
// 執行：node scripts/inject-doc11.cjs  或  npm run inject-doc11

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/附件3-113-個人資料利用申請表D-205-0113-1140410-V5.0.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-11.docx');

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-11.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}

// 只替換一次：遇到第一個 match 後替換，其餘保留
function replaceOnce(xml, pattern, replacement) {
  return xml.replace(pattern, replacement);
}

console.log('📄 Processing DOC-11: 個人資料利用申請表');
let { zip, xml } = readDocXml(SRC);

// ===== 申請者資料（各 text run 是該 value，精確匹配後替換）=====
xml = replaceOnce(xml, /<w:t([^>]*)>中區管制中心<\/w:t>/,           '<w:t$1>{pi_unit}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)>王功錦<\/w:t>/,                  '<w:t$1>{pi_name_zh}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)>\(04\)24739940-203<\/w:t>/,      '<w:t$1>{pi_phone}</w:t>');

// ===== 申請日期（115 年 04 月 24 日 → 民國年月日）=====
// 原 runs: '115' / '\u3000年' / ' 04 ' / '月\u3000' / '24' / '\u3000日'
xml = replaceOnce(xml, /<w:t([^>]*)>115<\/w:t>/,                     '<w:t$1>{filing_year}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)> 04 <\/w:t>/,                    '<w:t$1 xml:space="preserve"> {filing_month} </w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)>24<\/w:t>/,                      '<w:t$1>{filing_day}</w:t>');

// ===== 申請事由說明 =====
// text 22: '員工自行研究計畫「'
// text 23: '台灣李斯特菌之流行病學與全基因體定序特徵分析'        ← 計畫名稱
// text 24: '」(計畫編號:115111)，已完成本署人體研究委員會免審通過...'
xml = replaceOnce(xml, /<w:t([^>]*)>台灣李斯特菌之流行病學與全基因體定序特徵分析<\/w:t>/,
                                                                     '<w:t$1>{project_title_zh}</w:t>');
xml = replaceOnce(xml, /\(計畫編號:115111\)/,                         '(計畫編號:{project_id})');

// ===== 使用期間 =====
// text 46: '自收到資料後至研究期程截止日115年12月31日'
xml = replaceOnce(xml, /<w:t([^>]*)>自收到資料後至研究期程截止日115年12月31日<\/w:t>/,
                                                                     '<w:t$1>自收到資料後至研究期程截止日{execution_end_roc}</w:t>');

// ===== 資料檔案名稱及內容 =====
// text 57: '倉儲系統'
// text 58: '中2018年至2025年李斯特菌症確定個案之人口學資料。'
xml = replaceOnce(xml, /<w:t([^>]*)>倉儲系統<\/w:t>/,                '<w:t$1>{apply_system_text}</w:t>');
xml = replaceOnce(xml, /<w:t([^>]*)>中2018年至2025年李斯特菌症確定個案之人口學資料。<\/w:t>/,
                                                                     '<w:t$1>中{apply_condition}之人口學資料。</w:t>');

console.log('  ✓ 個人資料利用申請表 申請單位填寫區注入');
saveDoc(zip, xml, OUT);
