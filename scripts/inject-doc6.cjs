// ===== IRB-018 保密切結書（研究人員）（DOC-6）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-6.docx
// 來源：../source-templates/IRB-018 保密切結書(研究人員).docx
//
// ⚠️  DOC-6 = IRB-018 保密切結書（研究人員）
//     每位研究人員各自產生一份（generatePerPersonDoc）
// 執行：node scripts/inject-doc6.cjs  或  npm run inject-doc6

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/IRB-018 保密切結書(研究人員).docx');
const OUT = path.join(__dirname, '../public/templates/DOC-6.docx');

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-6.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}
function replaceText(xml, oldText, newText) {
  const esc = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r = xml.replace(new RegExp(`(>)${esc}(<)`, 'g'), `$1${newText}$2`);
  return r !== xml ? r : xml.replace(new RegExp(esc, 'g'), newText);
}

console.log('📄 Processing DOC-6: IRB-018 保密切結書（研究人員）');
let { zip, xml } = readDocXml(SRC);

// 立書人姓名（正文中的 本人 欄位）
xml = replaceText(xml, '本人_________________', '本人{person_name_zh}');

// 角色 checkbox：□計畫主持人 □協同主持人 □研究人員 □其他
// docgen.ts 中 role_pi / role_co_pi / role_researcher / role_other 各為 ■ 或 □
xml = replaceText(xml,
  '(□計畫主持人 □協同主持人 □研究人員 □其他',
  '({role_pi}計畫主持人 {role_co_pi}協同主持人 {role_researcher}研究人員 {role_other}其他');

// 研究計畫名稱（因執行研究計畫：後面的底線空格）
// 原始為一段底線空格 run，替換為 placeholder
xml = xml.replace(
  /(因執行研究計畫：<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t[^>]*>)\s+(<\/w:t>)/,
  '$1{project_title_zh}$2'
);
// 備用：直接附加
if (!xml.includes('{project_title_zh}')) {
  xml = replaceText(xml, '因執行研究計畫：', '因執行研究計畫：{project_title_zh}');
}

console.log('  ✓ IRB-018 欄位注入');
saveDoc(zip, xml, OUT);
