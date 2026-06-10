// ===== IRB-002 計畫送件核對表（DOC-3）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-3.docx
// 來源：../source-templates/IRB-002 新案計畫送件核對表.docx
//
// ⚠️  DOC-3 = IRB-002 新案計畫送件核對表
//     原始為 .doc 格式（binary）→ 需先用 Word 另存為 .docx 再執行本腳本
//     source-templates的 .doc 檔請勿刪除（保留做比對用）
// 執行：node scripts/inject-doc3.cjs  或  npm run inject-doc3

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/IRB-002 新案計畫送件核對表.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-3.docx');

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-3.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}
// 標楷體 run 屬性。
// why：範本 label 用 DFKai-SB（=「標楷體」），但 docDefaults 預設 eastAsia 是 PMingLiU（新細明體）。
//      「新建」的注入 run 若不帶 rPr 會掉回新細明體，跟標楷體 label 不一致，所以明確指定 DFKai-SB。
//      inline 接在 label run 後的注入（名：/職稱：/單位：/日期：）已繼承 label 的 DFKai-SB，不需額外設。
const KAI_RPR =
  '<w:rPr><w:rFonts w:ascii="DFKai-SB" w:eastAsia="DFKai-SB" w:hAnsi="DFKai-SB"/></w:rPr>';

function replaceText(xml, oldText, newText) {
  const esc = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r = xml.replace(new RegExp(`(>)${esc}(<)`, 'g'), `$1${newText}$2`);
  return r !== xml ? r : xml.replace(new RegExp(esc, 'g'), newText);
}

// 在標籤所在 cell 的下一個相鄰 cell 中插入 placeholder
function insertInNextCell(xml, labelText, placeholder) {
  const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${esc}<\\/w:t><\\/w:r><\\/w:p><\\/w:tc>` +
    `<w:tc><w:tcPr>[\\s\\S]*?<\\/w:tcPr>` +
    `<w:p[^>]*><w:pPr>[\\s\\S]*?<\\/w:pPr>)` +
    `(<\\/w:p>)`
  );
  const r = xml.replace(pattern, `$1<w:r><w:t>${placeholder}</w:t></w:r>$2`);
  if (r !== xml) return r;
  return replaceText(xml, labelText, labelText + placeholder);
}

// 在標籤所在 cell 的「下一個段落」中插入 placeholder（同一個 cell，兩個段落）
function insertInNextParagraph(xml, labelText, placeholder) {
  const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${esc}<\\/w:t><\\/w:r><\\/w:p><w:p[^>]*><w:pPr>[\\s\\S]*?<\\/w:pPr>)(<\\/w:p>)`
  );
  // 注入的計畫名稱要與範本一致用標楷體，故 run 帶 KAI_RPR（這個空段落本身沒有 run 可繼承字型）
  const r = xml.replace(pattern, `$1<w:r>${KAI_RPR}<w:t>${placeholder}</w:t></w:r>$2`);
  if (r !== xml) return r;
  return replaceText(xml, labelText, labelText + placeholder);
}

// 替換第 N 個包含「□是」的段落的全部 run 內容
function replaceNthCheckboxPara(xml, n, placeholder) {
  let count = 0;
  return xml.replace(
    /(<w:p [^>]*>)(<w:pPr>[\s\S]*?<\/w:pPr>)([\s\S]*?)(<\/w:p>)/g,
    (match, pStart, pPr, runs, pEnd) => {
      if (!runs.includes('□是')) return match;
      count++;
      if (count !== n) return match;
      // 保留 pPr，替換所有 run 為單一 placeholder run（標楷體）
      return `${pStart}${pPr}<w:r>${KAI_RPR}<w:t>${placeholder}</w:t></w:r>${pEnd}`;
    }
  );
}

console.log('📄 Processing DOC-3: IRB-002 計畫送件核對表');
let { zip, xml } = readDocXml(SRC);

// ===== 標頭欄位 =====
// 實際 XML 結構：
//   Row A: [計畫名稱：] (單一寬 cell，value 在同 cell 的下一個空段落)
//   Row B: [主持人姓名：] [日期：] (無獨立 value cell，inline 接在 label 後)
//   Row C: [職稱：] [單位：] (同上，inline)
// → 主持人姓名、職稱、單位、日期 均 inline 接在 label 文字後（日期帶入填報日期）

// 計畫名稱：value 在同一 cell 的下一個空段落
xml = insertInNextParagraph(xml, '計畫名稱：', '{irb002_project_title}');

// 主持人姓名：split run（主持人姓 + 名：），inline 接在 名： 後
xml = replaceText(xml, '名：', '名：{irb002_pi_name}');

// 日期：inline 接在 label 後，帶入填報日期（民國年）。label run 已是 DFKai-SB，故日期自動標楷體
// ⚠️ 不可用 replaceText（global）：本表有「兩個」獨立的「日期：」run——
//    ① 表頭「主持人姓名／日期／職稱」那格＝申請人填的填報日期（要注入）
//    ② 文件最底部「收件人簽章/日期：」＝審查會收件時才填，範本明標「（審查會填寫）」，
//       申請人不該預先填，否則把填報日期錯塞進審查會欄位（Vickie 2026-06-10 抓到的 bug）。
//    表頭日期在文件順序上排在收件欄之前，故用非 global regex 只換「第一個」日期 run，
//    留底部收件欄空白給審查會。
xml = xml.replace(/(<w:t[^>]*>)日期：(<\/w:t>)/, '$1日期：{irb002_filing_date}$2');

// 職稱：inline
xml = replaceText(xml, '職稱：', '職稱：{irb002_pi_title}');

// 單位：inline
xml = replaceText(xml, '單位：', '單位：{irb002_pi_unit}');

// ===== 核對表 checkbox（備齊欄）=====
// 由使用者自行勾選，不注入 placeholder，保留原始 □是 文字

console.log('  ✓ IRB-002 欄位注入');
saveDoc(zip, xml, OUT);
