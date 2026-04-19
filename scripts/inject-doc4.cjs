// ===== IRB-004 研究計畫書（DOC-4）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-4.docx
// 來源：../source-templates/IRB-004 研究計畫書.docx
//
// ⚠️  DOC-4 ≠ DOC-2
//     DOC-4 = IRB-004 研究計畫書（本腳本）
//     DOC-2 = 署內研究計畫書（inject-doc2.cjs）
// 執行：node scripts/inject-doc4.cjs  或  npm run inject-doc4

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/IRB-004 研究計畫書.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-4.docx');

function readDocXml(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = new PizZip(buf);
  return { zip, xml: zip.file('word/document.xml').asText() };
}

function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-4.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}

function replaceText(xml, oldText, newText) {
  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r1 = xml.replace(new RegExp(`(>)${escaped}(<)`, 'g'), `$1${newText}$2`);
  if (r1 !== xml) return r1;
  return xml.replace(new RegExp(escaped, 'g'), newText);
}

// 在標籤所在 cell 的下一個相鄰 cell 中插入 placeholder
function insertInNextCell(xml, labelText, placeholder) {
  const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${escaped}<\\/w:t><\\/w:r><\\/w:p><\\/w:tc>` +
    `<w:tc><w:tcPr>[\\s\\S]*?<\\/w:tcPr>` +
    `<w:p[^>]*><w:pPr>[\\s\\S]*?<\\/w:pPr>)` +
    `(<\\/w:p>)`
  );
  const result = xml.replace(pattern, `$1<w:r><w:t>${placeholder}</w:t></w:r>$2`);
  if (result !== xml) return result;
  // 備用：直接附加在標籤後
  return replaceText(xml, labelText, labelText + placeholder);
}

// ===== 主程式 =====

console.log('📄 Processing DOC-4: IRB-004 研究計畫書');
let { zip, xml } = readDocXml(SRC);

// 計畫名稱中/英文
xml = xml.replace(
  /(>中文<\/w:t><\/w:r>[\s\S]*?>：<\/w:t><\/w:r>)(<\/w:p>)/,
  '$1<w:r><w:t>{project_title_zh}</w:t></w:r>$2');
xml = xml.replace(
  /(>英文<\/w:t><\/w:r>[\s\S]*?>：<\/w:t><\/w:r>)(<\/w:p>)/,
  '$1<w:r><w:t>{project_title_en}</w:t></w:r>$2');

// 計畫主持人姓名（第 1 個 = PI, 第 2 個 = co-PI）
let nameCount = 0;
xml = xml.replace(/>姓名：</g, (match) => {
  nameCount++;
  if (nameCount === 1) return '>姓名：{pi_name_zh}<';
  if (nameCount === 2) return '>姓名：{co_pi_names}<';
  return match;
});

// 研究描述欄位
xml = insertInNextCell(xml, '計畫摘要',           '{abstract_zh}');
xml = insertInNextCell(xml, '背景說明',           '{background}');
xml = insertInNextCell(xml, '研究設計與進行方法', '{methodology}');
xml = insertInNextCell(xml, '限與預期進度',       '{schedule_text}');
xml = insertInNextCell(xml, '研究人力及相關設備需求', '{personnel_equipment_text}');
xml = insertInNextCell(xml, '預期成果及主要效益', '{expected_outcome}');
xml = insertInNextCell(xml, '屬及運用',           '{outcome_usage_text}');

console.log('  ✓ IRB-004 欄位注入');

saveDoc(zip, xml, OUT);
