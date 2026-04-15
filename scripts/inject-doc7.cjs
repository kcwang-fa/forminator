// ===== 資料庫保密切結書（署內員工使用）（DOC-7）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-7.docx
// 來源：../原始範本/資料庫-保密切結書-署內員工使用D-205-0009-1140410-V4.2.docx
//
// ⚠️  DOC-7 = 資料庫保密切結書（署內員工使用）
//     每位研究人員各自產生一份（generatePerPersonDoc）
//     原始範本中的「邱乾順」為示範姓名，需替換為 placeholder
// 執行：node scripts/inject-doc7.cjs  或  npm run inject-doc7

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname,
  '../../原始範本/資料庫-保密切結書-署內員工使用D-205-0009-1140410-V4.2.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-7.docx');

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-7.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}
function replaceText(xml, oldText, newText) {
  const esc = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r = xml.replace(new RegExp(`(>)${esc}(<)`, 'g'), `$1${newText}$2`);
  return r !== xml ? r : xml.replace(new RegExp(esc, 'g'), newText);
}

// 在標籤段落的下一個相鄰段落中插入 placeholder
function insertInNextParagraph(xml, labelText, placeholder) {
  const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 找到標籤段落結尾，在下一個段落（空段落）中插入文字
  const pattern = new RegExp(
    `(${esc}<\\/w:t><\\/w:r><\\/w:p><w:p[^>]*><w:pPr>[\\s\\S]*?<\\/w:pPr>)(<\\/w:p>)`
  );
  const r = xml.replace(pattern, `$1<w:r><w:t>${placeholder}</w:t></w:r>$2`);
  return r !== xml ? r : replaceText(xml, labelText, labelText + placeholder);
}

console.log('📄 Processing DOC-7: 資料庫保密切結書（署內員工使用）');
let { zip, xml } = readDocXml(SRC);

// 正文立書人姓名（示範姓名「邱乾順」→ placeholder）
xml = replaceText(xml, '邱乾順', '{person_name_zh}');

// 簽名欄：立書人姓名 / 職稱
xml = replaceText(xml, '立書人姓名：', '立書人姓名：{person_name_zh}');
xml = replaceText(xml, '職稱：', '職稱：{person_title}');

// 日期
xml = replaceText(xml, '中華民國     年     月    日', '中華民國{signing_date_roc}');

console.log('  ✓ 資料庫保密切結書 欄位注入');
saveDoc(zip, xml, OUT);
