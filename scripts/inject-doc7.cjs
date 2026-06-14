// ===== 資料庫保密切結書（署內員工使用）（DOC-7）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-7.docx
// 來源：../source-templates/資料庫-保密切結書-署內員工使用D-205-0009-1140410-V4.2.docx
//
// ⚠️  DOC-7 = 資料庫保密切結書（署內員工使用）
//     每位研究人員各自產生一份（generatePerPersonDoc）
//     source-templates中的「邱乾順」為示範姓名，需替換為 placeholder
// 執行：node scripts/inject-doc7.cjs  或  npm run inject-doc7

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname,
  '../../source-templates/資料庫-保密切結書-署內員工使用D-205-0009-1140410-V4.2.docx');
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

// ===== 簽名圖注入 helper =====
// 簽章欄注入「條件 section + 圖片標籤」三件組：{#xx_has_sig}{%xx_sig}{/xx_has_sig}
//   - 有簽名：docgen 的 image module 把 {%xx_sig} 換成簽名 PNG 圖
//   - 沒簽名：section 整段消失，簽章欄維持範本原樣（底線/空白），列印後仍可手簽
// ⚠️ 三個標籤必須拆成三個「獨立 run」：docxtemplater 展開 section 時，若 {%圖片} 與
//    section 標籤擠在同一個 <w:t>，圖片標籤會丟失 <w:t> 上下文而報
//    「Raw tag not in paragraph」（2026-06-11 實測）。
// ⚠️ 錨點找不到一律 throw，不可 console.warn 帶過——本檔的立書人姓名欄曾因
//    CJK 相容字靜默匹配失敗，模板缺 placeholder 很久都沒人發現（見下方註解）。
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
// ⚠️ 範本簽名欄的「立」是 CJK 相容表意字 U+F9F7（字形與一般「立」U+7ACB 完全相同、
//    codepoint 不同），用「立書人姓名：」比對會「靜默失敗」——2026-06-11 才發現
//    模板簽名欄一直缺 {person_name_zh}，只有正文（示範姓名替換）有注入。
//    錨點改用不含相容字的「書人姓名：」（全文件唯一），繞開相容字陷阱。
const NAME_ANCHOR = '書人姓名：</w:t>';
if (!xml.includes(NAME_ANCHOR)) throw new Error('DOC-7 找不到「立書人姓名」欄（範本可能改版）');
xml = xml.replace(NAME_ANCHOR, '書人姓名：{person_name_zh}</w:t>');  // String.replace 只換第一個
xml = replaceText(xml, '職稱：', '職稱：{person_title}');

// 立書人簽名圖：接在姓名後（DOC-7 是逐人文件，每份帶該人自己的 person_sig）
xml = injectSigAfterRun(xml, '書人姓名：{person_name_zh}</w:t>', 'person');

// 健檢：{person_name_zh} 必須恰好出現 2 次（正文「茲立書人」+ 簽名欄），
// 杜絕相容字問題再次靜默失敗
const nameCount = xml.split('{person_name_zh}').length - 1;
if (nameCount !== 2) {
  throw new Error(`DOC-7 {person_name_zh} 應出現 2 次（正文+簽名欄），實際 ${nameCount} 次`);
}
console.log('  ✓ 立書人姓名 + 簽名圖注入（健檢通過）');

// 日期
xml = replaceText(xml, '中華民國     年     月    日', '中華民國{signing_date_roc}');

console.log('  ✓ 資料庫保密切結書 欄位注入');
saveDoc(zip, xml, OUT);
