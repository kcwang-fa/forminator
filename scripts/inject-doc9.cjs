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

// 在 xml 的某個範圍內做字串替換（避免誤中範圍外的同文字）
function replaceInRange(xml, start, end, pairs) {
  let segment = xml.slice(start, end);
  for (const [from, to] of pairs) {
    const escFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    segment = segment.replace(new RegExp(escFrom), to);
  }
  return xml.slice(0, start) + segment + xml.slice(end);
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

// 主旨段替換——原始 Word 把整段切成多個 text run，所以：
// (1) 首 run 把「本組擬執行」改成 `{responsible_unit}擬執行`
// (2) 「115」run 換成 `{project_year}`（第一個 115，只在主旨段範圍內）
// (3) 計畫名稱跨多 run（保全麻疹...實證評估），把起始 run 擴充成完整主旨後半段，
//     並清空中間 runs 的 text（保留 run 結構與格式，只移除文字）
xml = replaceInRange(xml, subjectPStart, subjectPEnd, [
  // (1) 負責單位
  ['本組擬執行', '{responsible_unit}擬執行'],
  // (2) 年度（只在主旨段範圍內找第一個 115）
  ['<w:t>115</w:t>', '<w:t>{project_year}</w:t>'],
  // (3) 計畫名稱 + 申請條件：把 text 16 run 擴充為完整語句
  [
    '<w:t>年度署內自行研究計畫「保全麻疹消</w:t>',
    '<w:t xml:space="preserve">年度署內自行研究計畫「{project_title_zh}」，申請使用「{apply_condition}」資料並委請資訊室進行去識別化處理</w:t>',
  ],
  // 中間 runs 全部清空文字（保留 <w:r><w:t></w:t></w:r> 結構）
  ['<w:t>除成就的韌性：台灣</w:t>',               '<w:t></w:t>'],
  ['<w:t xml:space="preserve"> 2018-2025 </w:t>', '<w:t></w:t>'],
  ['<w:t>年疫苗修飾麻疹傳染力</w:t>',              '<w:t></w:t>'],
  ['<w:t>與傳播動態的實證評估」，申請使用「</w:t>', '<w:t></w:t>'],
  ['<w:t>2018</w:t>',                             '<w:t></w:t>'],
  ['<w:t>至</w:t>',                               '<w:t></w:t>'],
  ['<w:t>2025</w:t>',                             '<w:t></w:t>'],
  ['<w:t>年麻</w:t>',                             '<w:t></w:t>'],
  ['<w:t>疹確定個案」資料並委請資訊室進行去識別化處理</w:t>', '<w:t></w:t>'],
]);

console.log('  ✓ 資料庫申請簽呈 主旨段注入');
saveDoc(zip, xml, OUT);
