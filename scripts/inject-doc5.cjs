// ===== IRB-012 免審申請表（DOC-5）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-5.docx
// 來源：../原始範本/IRB-012 免審申請表.docx
//
// ⚠️  DOC-5 = IRB-012 免審申請表
// 執行：node scripts/inject-doc5.cjs  或  npm run inject-doc5

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../原始範本/IRB-012 免審申請表.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-5.docx');

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-5.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}
function replaceText(xml, oldText, newText) {
  const esc = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r = xml.replace(new RegExp(`(>)${esc}(<)`, 'g'), `$1${newText}$2`);
  return r !== xml ? r : xml.replace(new RegExp(esc, 'g'), newText);
}
function insertInNextCell(xml, labelText, placeholder) {
  const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${esc}<\\/w:t><\\/w:r><\\/w:p><\\/w:tc><w:tc><w:tcPr>[\\s\\S]*?<\\/w:tcPr><w:p[^>]*><w:pPr>[\\s\\S]*?<\\/w:pPr>)(<\\/w:p>)`
  );
  const r = xml.replace(pattern, `$1<w:r><w:t>${placeholder}</w:t></w:r>$2`);
  return r !== xml ? r : replaceText(xml, labelText, labelText + placeholder);
}

console.log('📄 Processing DOC-5: IRB-012 免審申請表');
let { zip, xml } = readDocXml(SRC);

// 計畫名稱中/英文
xml = insertInNextCell(xml, '中文', '{project_title_zh}');
xml = insertInNextCell(xml, '英文', '{project_title_en}');

// 計畫主持人
xml = insertInNextCell(xml, '中文姓名', '{pi_name_zh}');

// 協同主持人
xml = xml.replace(
  /(協同主持人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  '$1<w:r><w:t>{co_pi_names}</w:t></w:r>$3');

// 聯絡人
xml = xml.replace(
  /(聯絡人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  '$1<w:r><w:t>{contact_name_zh}</w:t></w:r>$3');

// 研究計畫目的
xml = insertInNextCell(xml, '研究計畫目的', '{purpose}');

// 免審理由
xml = replaceText(xml,
  '本研究為次級資料研究，資料皆已去識別化。',
  '{exempt_reason}');

// 資料來源說明
xml = replaceText(xml,
  '本研究使用疾管署防疫資料庫，依據「衛生福利部疾病管制署防疫資料庫員工研究計畫使用申請作業說明」提出申請，並檢附本IRB審查通過證明文件後，依序完成資料權責單位、資訊室及企劃組審核，經一層核定後取得去識別化資料。',
  '{data_source}');

console.log('  ✓ IRB-012 欄位注入');
saveDoc(zip, xml, OUT);
