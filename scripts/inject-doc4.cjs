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

// 標楷體 run 屬性。
// why：本範本的 label（姓名：、計畫摘要…）用 DFKai-SB（= Word 裡的「標楷體」），
//      但 word/styles.xml 的 docDefaults 預設 eastAsia 字型是 PMingLiU（新細明體）。
//      我們「新建」的注入 run 若不帶 rPr，就會掉回新細明體，跟標楷體的 label 不一致。
//      所以明確把注入內容的字型指定成 DFKai-SB，中英文（ascii/hAnsi/eastAsia）都設。
const KAI_RPR =
  '<w:rPr><w:rFonts w:ascii="DFKai-SB" w:eastAsia="DFKai-SB" w:hAnsi="DFKai-SB"/></w:rPr>';

// 產生一個「標楷體」run。注入新建 run 時統一用這個，確保字型一致。
function kaiRun(text) {
  return `<w:r>${KAI_RPR}<w:t>${text}</w:t></w:r>`;
}

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
  const result = xml.replace(pattern, `$1${kaiRun(placeholder)}$2`);
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
  `$1${kaiRun('{project_title_zh}')}$2`);
xml = xml.replace(
  /(>英文<\/w:t><\/w:r>[\s\S]*?>：<\/w:t><\/w:r>)(<\/w:p>)/,
  `$1${kaiRun('{project_title_en}')}$2`);

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

// ===== 「研究計畫之經費」段（(1)經費需求） =====
// 範本原文：經費需求：[底線空格]千元，■不需經費
// why：原本這段全是靜態文字，使用者在 Step5 填的經費金額完全進不去（DOC-4 經費需求沒注入）。
//   ① 把「經費需求：」後那段「底線空格」換成 {budget_thousand}（全程總額換算千元，由 docgen 提供）。
//      錨定該 run 的 <w:u w:val="single"/>（底線屬性）後的 <w:t>，保留底線樣式，數字會像填在底線上。
//   ② 把「不需經費」前的 ■ 換成 {needs_funding_no}（需經費時=□、不需經費時=■），與表單 needs_funding 連動。
// 經費來源(可複選) 那排 checkbox 表單沒有對應欄位，維持原樣由使用者自行勾選。
xml = xml.replace(
  /(經費需求：<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<w:u w:val="single"\/>[\s\S]*?<\/w:rPr><w:t[^>]*>)\s+(<\/w:t>)/,
  `$1{budget_thousand}$2`);
xml = xml.replace(
  /(>)■(<\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t[^>]*>不需經費)/,
  `$1{needs_funding_no}$2`);

// ===== 「研究計畫之經費」段 (2)經費來源(可複選) =====
// 範本原文：□疾病管制署  □衛生福利部  □國家科學及技術委員會 □其他：[底線空白]
// 把每個機關前的 □ 換成對應 placeholder（docgen 依 funding_source 勾選決定 ■/□）。
// ⚠️ 三個 □ 的錨定各不同：疾病管制/衛生 的 □ 與機關名同一個 run（直接接字串即可）；
//    國科會的 □ 是「獨立 run」（<w:t>□</w:t> 後接 <w:t>國家科學…），故要求 □ 是 run 結尾
//    （□</w:t>）再跨 run 接到「國家科學」，才不會誤命中前面疾病管制的 □。
xml = xml.replace(/□(疾病管制)/, '{funding_src_cdc}$1');
xml = xml.replace(/□(衛生)/, '{funding_src_mohw}$1');
xml = xml.replace(
  /□(<\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t[^>]*>國家科學)/,
  '{funding_src_nstc}$1');
xml = xml.replace(/□(其他：)/, '{funding_src_other}$1');
// 「□其他：」後方有一段底線空白，注入自填文字（與經費需求金額同手法：錨定底線 run）。
xml = xml.replace(
  /(其他：<\/w:t><\/w:r><w:r[^>]*><w:rPr>[\s\S]*?<w:u w:val="single"\/>[\s\S]*?<\/w:rPr><w:t[^>]*>)\s+(<\/w:t>)/,
  `$1{funding_src_other_text}$2`);

console.log('  ✓ IRB-004 欄位注入');

saveDoc(zip, xml, OUT);
