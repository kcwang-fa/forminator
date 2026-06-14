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

// ===== 簽名圖注入 helper =====
// 簽章欄注入「條件 section + 圖片標籤」三件組：{#xx_has_sig}{%xx_sig}{/xx_has_sig}
//   - 有簽名：docgen 的 image module 把 {%xx_sig} 換成簽名 PNG 圖
//   - 沒簽名：section 整段消失，簽章欄維持範本原樣（底線/空白），列印後仍可手簽
// ⚠️ 三個標籤必須拆成三個「獨立 run」：docxtemplater 展開 section 時，若 {%圖片} 與
//    section 標籤擠在同一個 <w:t>，圖片標籤會丟失 <w:t> 上下文而報
//    「Raw tag not in paragraph」（2026-06-11 實測）。
// ⚠️ 錨點找不到一律 throw，不可 console.warn 帶過——DOC-7 的立書人姓名欄曾因
//    CJK 相容字靜默匹配失敗，模板缺 placeholder 很久都沒人發現。
function sigRuns(prefix) {
  return `<w:r><w:t>{#${prefix}_has_sig}</w:t></w:r>` +
         `<w:r><w:t>{%${prefix}_sig}</w:t></w:r>` +
         `<w:r><w:t>{/${prefix}_has_sig}</w:t></w:r>`;
}
// 在「錨點文字所在 run」的 </w:r> 之後插入簽名三件組。
function injectSigAfterRun(xml, anchorText, prefix, searchFrom = 0) {
  const anchorIdx = xml.indexOf(anchorText, searchFrom);
  if (anchorIdx === -1) throw new Error(`簽名欄錨點「${anchorText}」不存在（範本可能改版）`);
  const runEnd = xml.indexOf('</w:r>', anchorIdx);
  if (runEnd === -1) throw new Error(`簽名欄錨點「${anchorText}」後找不到 run 結尾`);
  const insertAt = runEnd + '</w:r>'.length;
  let out = xml.slice(0, insertAt) + sigRuns(prefix) + xml.slice(insertAt);
  // 簽章欄段落若鎖死行高（lineRule="exact"），Word 會把高於行高的簽名圖「裁掉」。
  // 改成 atLeast：沒簽名時外觀不變，有簽名時行高自動撐開。
  const paraStart = out.lastIndexOf('<w:p ', anchorIdx);
  if (paraStart !== -1) {
    const head = out.slice(paraStart, anchorIdx);
    if (head.includes('w:lineRule="exact"')) {
      out = out.slice(0, paraStart) + head.replace('w:lineRule="exact"', 'w:lineRule="atLeast"') + out.slice(anchorIdx);
    }
  }
  return out;
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

// ===== 立同意書人簽名欄：嵌入簽名圖 =====
// DOC-6 是逐人文件，每份帶「該人自己」的簽名（docgen 的 person_sig）。
// 錨點「立同意書人簽名：」全文件唯一，圖接在 label run 後、底線 run 前。
xml = injectSigAfterRun(xml, '立同意書人簽名：', 'person');
console.log('  ✓ 立同意書人簽名欄簽名注入');

console.log('  ✓ IRB-018 欄位注入');
saveDoc(zip, xml, OUT);
