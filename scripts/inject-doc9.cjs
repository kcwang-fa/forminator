// ===== 資料庫申請簽呈（DOC-9）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-9.docx
// 來源：../source-templates/資料庫公文內容.docx
//
// 內容：公文系統操作說明 + 公文內容（主旨/說明/擬辦）+ 附件上傳流程
// 只注入主旨段的動態部分：計畫年度、負責單位、計畫名稱、擷取資料條件
// 說明、擬辦、操作步驟等靜態文字保留原樣。
//
// 執行：node scripts/inject-doc9.cjs  或  npm run inject-doc9

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/資料庫公文內容.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-9.docx');

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-9.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}

function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getParagraphMetaByText(xml, searchText, fromIndex = 0) {
  const textIdx = xml.indexOf(searchText, fromIndex);
  if (textIdx === -1) throw new Error(`找不到「${searchText}」段落`);

  const pStart = xml.lastIndexOf('<w:p ', textIdx);
  const pEnd = xml.indexOf('</w:p>', textIdx) + '</w:p>'.length;
  const paragraph = xml.slice(pStart, pEnd);
  const paraOpenMatch = paragraph.match(/^<w:p [^>]*>/);
  const pPrMatch = paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
  const rPrMatch = paragraph.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);

  if (!paraOpenMatch || !pPrMatch || !rPrMatch) {
    throw new Error(`無法解析「${searchText}」段落樣式`);
  }

  return {
    start: pStart,
    end: pEnd,
    paraOpen: paraOpenMatch[0],
    pPr: pPrMatch[0],
    rPr: `<w:rPr>${rPrMatch[1]}</w:rPr>`,
  };
}

function buildParagraph(meta, text) {
  return `${meta.paraOpen}${meta.pPr}<w:r>${meta.rPr}<w:t>${escapeXml(text)}</w:t></w:r></w:p>`;
}

function buildEmptyParagraph(meta) {
  return `${meta.paraOpen}${meta.pPr}</w:p>`;
}

console.log('📄 Processing DOC-9: 資料庫申請簽呈');
let { zip, xml } = readDocXml(SRC);

// 找主旨段的範圍：從「主旨：」所在段落起，到「請鑒核。」所在段落終。
// 在這段範圍內做字串替換，避免誤中其他段落。
const subjectIdx = xml.indexOf('主旨：');
if (subjectIdx === -1) throw new Error('找不到「主旨：」');
const subjectPStart = xml.lastIndexOf('<w:p ', subjectIdx);
const subjectEndIdx = xml.indexOf('請鑒核。', subjectIdx);
if (subjectEndIdx === -1) throw new Error('找不到「請鑒核。」');
const subjectPEnd = xml.indexOf('</w:p>', subjectEndIdx) + '</w:p>'.length;
const subjectBlock = xml.slice(subjectPStart, subjectPEnd);
const firstParagraphMatch = subjectBlock.match(/(<w:p [^>]*>)([\s\S]*?)<\/w:p>/);
if (!firstParagraphMatch) throw new Error('找不到主旨首段');

const paraOpen = firstParagraphMatch[1];
const firstParagraph = firstParagraphMatch[0];
const pPrMatch = firstParagraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
if (!pPrMatch) throw new Error('找不到主旨段落樣式');
const pPr = pPrMatch[0];

const normalRunMatch = firstParagraph.match(/<w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>主旨：有關本組擬執行<\/w:t><\/w:r>/);
if (!normalRunMatch) throw new Error('找不到主旨一般文字樣式');
const yearRunMatch = firstParagraph.match(/<w:r[^>]*><w:rPr>[\s\S]*?<\/w:rPr><w:t>115<\/w:t><\/w:r>/);
if (!yearRunMatch) throw new Error('找不到主旨年度文字樣式');

const normalRPrMatch = normalRunMatch[0].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
if (!normalRPrMatch) throw new Error('找不到主旨一般文字 rPr');
const yearRPrMatch = yearRunMatch[0].match(/<w:rPr>([\s\S]*?)<\/w:rPr>/);
if (!yearRPrMatch) throw new Error('找不到主旨年度文字 rPr');

const normalRPr = `<w:rPr>${normalRPrMatch[1]}</w:rPr>`;
const yearRPr = `<w:rPr>${yearRPrMatch[1]}</w:rPr>`;

const rebuiltSubject = [
  paraOpen,
  pPr,
  `<w:r>${normalRPr}<w:t>主旨：有關{responsible_unit}擬執行</w:t></w:r>`,
  `<w:r>${yearRPr}<w:t>{project_year}</w:t></w:r>`,
  `<w:r>${normalRPr}<w:t xml:space="preserve">年度署內自行研究計畫「{project_title_zh}」，申請使用「{doc9_apply_scope_text}」資料並委請資訊室進行去識別化處理</w:t></w:r>`,
  `<w:r>${yearRPr}<w:t>1</w:t></w:r>`,
  `<w:r>${normalRPr}<w:t>案，請鑒核。</w:t></w:r>`,
  '</w:p>',
].join('');

xml = xml.slice(0, subjectPStart) + rebuiltSubject + xml.slice(subjectPEnd);

const explanationLabelMeta = getParagraphMetaByText(xml, '說明：');
const explanationItemMeta = getParagraphMetaByText(xml, '一、依據本署', explanationLabelMeta.end);
const proposalMeta = getParagraphMetaByText(xml, '擬辦：', explanationItemMeta.end);
const proposalTailIdx = xml.indexOf('究分析資料。', proposalMeta.end);
if (proposalTailIdx === -1) throw new Error('找不到「擬辦」結尾段落');
const proposalEnd = xml.indexOf('</w:p>', proposalTailIdx) + '</w:p>'.length;

const rebuiltExplanationAndProposal = [
  buildParagraph(explanationLabelMeta, '說明：'),
  buildParagraph(explanationItemMeta, '一、依據本署「防疫資料庫員工研究計畫使用申請作業」辦理。'),
  buildParagraph(explanationItemMeta, '二、本案研究計畫（附件1）已取得本署 IRB 審查許可書（附件2），合先敘明。'),
  buildParagraph(explanationItemMeta, '三、檢附本案申請所需相關表件如下：使用申請單（附件3），資訊安全管理系統文件之「個人資料利用申請表」（附件4）及保密切結書（附件5）。'),
  buildEmptyParagraph(explanationItemMeta),
  buildParagraph(proposalMeta, '擬辦：奉核後，填具「應用系統維護單」等相關表單委請資訊室協助進行資料去識別化處理，以產製本計畫所需之研究分析資料。'),
].join('');

xml = xml.slice(0, explanationLabelMeta.start) + rebuiltExplanationAndProposal + xml.slice(proposalEnd);

console.log('  ✓ 資料庫申請簽呈 主旨／說明／擬辦注入');
saveDoc(zip, xml, OUT);
