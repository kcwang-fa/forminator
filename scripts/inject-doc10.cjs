// ===== 應用系統維護單（DOC-10）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-10.docx
// 來源：../source-templates/附件5-應用系統維護單D-205-0045-1140519-V4.6.docx
//
// 只注入「本欄由申請單位填寫」區塊：
//   系統名稱 / 申請單位 / 申請日期 / 需求項目（勾選機敏資料庫使用）/ 需求內容描述
// 「本欄由權責單位／資訊室填寫」區塊留空。
//
// ⚠️  本簽呈表格的 label 與 value cell 採上下/左右混合佈局，
//     若要分欄對齊較複雜；目前採保守作法：在 label 後 append placeholder，
//     輸出畫面擠一些但資料正確；日後需要美化可再重工。
//
// 執行：node scripts/inject-doc10.cjs  或  npm run inject-doc10

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/附件5-應用系統維護單D-205-0045-1140519-V4.6.docx');
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

function replaceText(xml, oldText, newText) {
  const esc = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r = xml.replace(new RegExp(`(>)${esc}(<)`, 'g'), `$1${newText}$2`);
  return r !== xml ? r : xml.replace(new RegExp(esc, 'g'), newText);
}

console.log('📄 Processing DOC-10: 應用系統維護單');
let { zip, xml } = readDocXml(SRC);

// 在 label 的 <w:t> 文字後 append placeholder
// （保留 label 文字，只在同 run 內加 placeholder；docxtemplater 後續會解析）
xml = xml.replace(
  /<w:t([^>]*)>系統名稱：<\/w:t>/,
  '<w:t$1 xml:space="preserve">系統名稱：{apply_system_text}</w:t>'
);
xml = xml.replace(
  /<w:t([^>]*)>申請單位：<\/w:t>/,
  '<w:t$1 xml:space="preserve">申請單位：{pi_unit}</w:t>'
);
xml = xml.replace(
  /<w:t([^>]*)>申請日期：<\/w:t>/,
  '<w:t$1 xml:space="preserve">申請日期：民國{apply_date_roc}</w:t>'
);

// 勾選「機敏資料庫使用」— 把該 run 開頭的 □ 換成 ■
xml = xml.replace(
  /<w:t([^>]*)>□機敏資料庫使用/,
  '<w:t$1>■機敏資料庫使用'
);

// 需求內容描述 — 在 label 後 append placeholder
// 原 text: '需求內容描述' 然後下一 run 是 '(申請人填)'
// 改為：'需求內容描述{doc10_request_desc}'
xml = xml.replace(
  /<w:t([^>]*)>需求內容描述<\/w:t>/,
  '<w:t$1 xml:space="preserve">需求內容描述：{doc10_request_desc}</w:t>'
);

console.log('  ✓ 應用系統維護單 申請單位填寫區注入');
saveDoc(zip, xml, OUT);
