// ===== 署內研究計畫書（DOC-2）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-2.docx
// 來源：../原始範本/署內研究計畫書.docx
// 內容：封面 + 壹~捌主體（含目錄 PAGEREF、甘特圖 loop、人力配置 loop）+ 附表一/二/三
//
// ⚠️  DOC-2 ≠ DOC-4
//     DOC-2 = 署內研究計畫書（本腳本）
//     DOC-4 = IRB-004 研究計畫書（inject-doc4.cjs）
// 執行：node scripts/inject-doc2.cjs  或  npm run inject-doc2

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC  = path.join(__dirname, '../../原始範本/署內研究計畫書.docx');
const OUT  = path.join(__dirname, '../public/templates/DOC-2.docx');

// ===== 工具 =====

function readDocXml(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = new PizZip(buf);
  return { zip, xml: zip.file('word/document.xml').asText() };
}

function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-2.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}

// 替換 <w:t> 內的文字
function replaceText(xml, oldText, newText) {
  const escaped = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r1 = xml.replace(new RegExp(`(>)${escaped}(<)`, 'g'), `$1${newText}$2`);
  if (r1 !== xml) return r1;
  return xml.replace(new RegExp(escaped, 'g'), newText);
}

// 在包含 labelText 的段落結尾（</w:p> 前）插入 placeholder run
// startFrom: 從哪個位置開始搜尋（避免誤中文件前段同名標籤）
function injectIntoLabelPara(xml, labelText, placeholder, startFrom = 0) {
  const labelPos = xml.indexOf(labelText, startFrom);
  if (labelPos === -1) { console.warn(`⚠️  找不到 "${labelText}"（從 ${startFrom}）`); return xml; }
  const paraEnd = xml.indexOf('</w:p>', labelPos);
  if (paraEnd === -1) { console.warn(`⚠️  找不到段落結尾 "${labelText}"`); return xml; }
  return xml.slice(0, paraEnd) +
    `<w:r><w:t xml:space="preserve">${placeholder}</w:t></w:r>` +
    xml.slice(paraEnd);
}

// 取得附表一 <w:tbl>...的起訖位置（附表一標題後第一個 tbl）
function findAppendix1Table(xml) {
  const titlePos = xml.indexOf('附表一：主持人');
  if (titlePos === -1) throw new Error('找不到附表一標題');
  const tblStart = xml.indexOf('<w:tbl>', titlePos);
  if (tblStart === -1) throw new Error('找不到附表一 <w:tbl>');
  const tblEnd = xml.indexOf('</w:tbl>', tblStart) + '</w:tbl>'.length;
  return { tblStart, tblEnd };
}

// 把 tbl XML 拆成 rows array（含 <w:tr>...</w:tr>）
function splitRows(tblXml) {
  const rows = [];
  let pos = 0;
  while (true) {
    const s = tblXml.indexOf('<w:tr ', pos);
    if (s === -1) break;
    const e = tblXml.indexOf('</w:tr>', s) + '</w:tr>'.length;
    rows.push(tblXml.slice(s, e));
    pos = e;
  }
  return rows;
}

// 取得 row 裡每個 cell 的完整 XML（含 <w:tc>...）
function splitCells(rowXml) {
  const cells = [];
  let pos = 0;
  while (true) {
    const s = rowXml.indexOf('<w:tc>', pos);
    if (s === -1) break;
    const e = rowXml.indexOf('</w:tc>', s) + '</w:tc>'.length;
    cells.push(rowXml.slice(s, e));
    pos = e;
  }
  return cells;
}

// 取得 row 前面的 <w:tr ...> 開頭（含 trPr）直到第一個 <w:tc>
function getRowHeader(rowXml) {
  const tcPos = rowXml.indexOf('<w:tc>');
  return rowXml.slice(0, tcPos);
}

// 清空 cell 的文字內容，插入新的 run
function setCellText(cellXml, text) {
  // 移除所有 <w:r>...</w:r>（含內容）
  let result = cellXml.replace(/<w:r\b[\s\S]*?<\/w:r>/g, '');
  // 在 </w:p> 前插入新 run
  if (text) {
    result = result.replace(/<\/w:p>/, `<w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`);
  }
  return result;
}

// 移除 cell 的 vMerge 屬性（避免 loop 複製時重複 restart 導致格式錯亂）
function stripVMerge(cellXml) {
  return cellXml.replace(/<w:vMerge[^/]*\/>/g, '').replace(/<w:vMerge[^>]*>[\s\S]*?<\/w:vMerge>/g, '');
}

// 直式文字 cell：加 textDirection tbRlV + 置中 + DFKai-SB 字型
// 用於 noData row 的類別標籤 col 0，與原始範本的 loop row 同格式
function setVerticalCellText(cellXml, text) {
  // 1. 在 tcPr 加入 textDirection（若已存在則不重複）
  let result = cellXml.includes('textDirection')
    ? cellXml
    : cellXml.replace(/<\/w:tcPr>/, '<w:textDirection w:val="tbRlV"/></w:tcPr>');
  // 2. 移除所有既有 run
  result = result.replace(/<w:r\b[\s\S]*?<\/w:r>/g, '');
  // 3. 在 pPr 加 jc center（若尚未有）
  if (!result.includes('<w:jc ')) {
    result = result.replace(/<\/w:pPr>/, '<w:jc w:val="center"/></w:pPr>');
  }
  // 4. 插入帶字型的 run
  if (text) {
    const rPr = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="DFKai-SB" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:hint="eastAsia"/></w:rPr>';
    result = result.replace(/<\/w:p>/, `<w:r>${rPr}<w:t xml:space="preserve">${text}</w:t></w:r></w:p>`);
  }
  return result;
}

// 把某 row 裡的空 cell（特定 index）設定內容
function setRowCell(rowXml, cellIndex, text) {
  const header = getRowHeader(rowXml);
  const cells = splitCells(rowXml);
  if (cellIndex >= cells.length) return rowXml;
  cells[cellIndex] = setCellText(cells[cellIndex], text);
  return header + cells.join('') + '</w:tr>';
}

// ===== 主程式 =====

console.log('📄 Processing DOC-2: 署內研究計畫書');
let { zip, xml } = readDocXml(SRC);

// ─────────────────────────────────────────────
// 一、封面頁 placeholder 注入
// ─────────────────────────────────────────────

// 年度
xml = replaceText(xml,
  '○○○年\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000\u3000',
  '{project_year}年');

xml = xml.replace(
  /(<w:t[^>]*>計畫名稱：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/,
  '$1{project_title_zh}$3');

xml = xml.replace(
  /(<w:t[^>]*>負責單位：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/,
  '$1{responsible_unit}$3');

xml = xml.replace(
  /(<w:t[^>]*>主持人：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/,
  '$1{pi_name_zh}$3');

let copiCount = 0;
xml = xml.replace(
  /(<w:t[^>]*>協同主持人：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/g,
  (match, p1, p2, p3) => {
    copiCount++;
    return copiCount <= 3 ? `${p1}{co_pi_name_${copiCount}}${p3}` : match;
  });

let resCount = 0;
xml = xml.replace(
  /(<w:t[^>]*>研究人員：<\/w:t>[\s\S]*?<w:t[^>]*>)([\u3000\s]+)(<\/w:t>)/g,
  (match, p1, p2, p3) => {
    resCount++;
    return resCount <= 4 ? `${p1}{researcher_name_${resCount}}${p3}` : match;
  });

// ─────────────────────────────────────────────
// 二、主體計畫書（壹~捌 + 目錄 + 甘特圖 + 人力配置）
// ─────────────────────────────────────────────

// 壹、綜合資料 — 計畫名稱中/英文
// 結構：label 段落（含「中文：」）後緊接一個空段落作為 value 欄
// 原本 regex 找不到 <w:t>，改成直接定位第二個 </w:p> 插入
function injectIntoNextEmptyPara(xml, labelText, placeholder, startFrom = 0) {
  const labelPos = xml.indexOf(labelText, startFrom);
  if (labelPos === -1) { console.warn(`⚠️  找不到 "${labelText}"`); return xml; }
  const labelParaEnd = xml.indexOf('</w:p>', labelPos);
  if (labelParaEnd === -1) { console.warn(`⚠️  找不到段落結尾 "${labelText}"`); return xml; }
  const valueParaEnd = xml.indexOf('</w:p>', labelParaEnd + 6);
  if (valueParaEnd === -1) { console.warn(`⚠️  找不到 value 段落 "${labelText}"`); return xml; }
  return xml.slice(0, valueParaEnd) +
    `<w:r><w:t xml:space="preserve">${placeholder}</w:t></w:r>` +
    xml.slice(valueParaEnd);
}

const sec1Pos = xml.indexOf('壹、綜合資料');
xml = injectIntoNextEmptyPara(xml, '中文：', '{project_title_zh}', sec1Pos);
xml = injectIntoNextEmptyPara(xml, '英文：', '{project_title_en}', sec1Pos);

// 計畫類別 checkbox
xml = replaceText(xml, '□新增計畫：', '{project_type_new}新增計畫：');
xml = replaceText(xml, '□一年期計畫', '{project_type_1yr}一年期計畫');
xml = replaceText(xml, '□多年期計畫，共', '{project_type_multi}多年期計畫，共');
xml = replaceText(xml, '□舊多年期計畫', '{project_type_old}舊多年期計畫');
xml = replaceText(xml, '□人體研究', '{exp_human}人體研究');
xml = replaceText(xml, '□人體基因重組', '{exp_gene}人體基因重組');

// 執行期限（OOO=年, OO=月/日）
let oooIdx = 0;
xml = xml.replace(/>OOO</g, () => { oooIdx++; return oooIdx <= 2 ? '>{exec_start_y}<' : '>{exec_end_y}<'; });
let ooIdx = 0;
const ooMapping = [
  'exec_start_m', 'exec_start_d', 'exec_start_m', 'exec_start_d',
  'exec_end_m',   'exec_end_d',   'exec_end_m',   'exec_end_d',
];
xml = xml.replace(/>OO</g, () => { const ph = ooMapping[ooIdx] || 'exec_end_d'; ooIdx++; return `>{${ph}}<`; });

// ○○○ 順序：PI姓名, PI職稱, 聯絡人姓名, 聯絡人職稱
let circleCount = 0;
const circleMapping = ['{pi_name_zh}', '{pi_title}', '{contact_name_zh}', '{contact_title}'];
xml = xml.replace(/○○○/g, () => { const ph = circleMapping[circleCount] || '○○○'; circleCount++; return ph; });

// 電話/傳真/E-mail/連絡地址（限定搜尋 壹、綜合資料之後）
function insertInNthEmptyCell(xml, labelText, placeholder, nth = 1) {
  const escaped = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'g');
  let match, count = 0, targetPos = -1;
  while ((match = regex.exec(xml)) !== null) { count++; if (count === nth) { targetPos = match.index; break; } }
  if (targetPos === -1) return xml;
  const tcEnd = xml.indexOf('</w:tc>', targetPos);
  if (tcEnd === -1) return xml;
  const afterTc = xml.substring(tcEnd + 7);
  const pMatch = afterTc.match(/(<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)(<\/w:p>)/);
  if (pMatch) {
    const ip = tcEnd + 7 + pMatch.index + pMatch[1].length;
    return xml.substring(0, ip) + `<w:r><w:t>${placeholder}</w:t></w:r>` + xml.substring(ip);
  }
  return xml;
}
xml = insertInNthEmptyCell(xml, 'E-mail', '{pi_email}', 1);
xml = insertInNthEmptyCell(xml, 'E-mail', '{contact_email}', 2);
xml = insertInNthEmptyCell(xml, '連絡地址', '{pi_address}', 1);
xml = insertInNthEmptyCell(xml, '連絡地址', '{contact_address}', 2);
xml = insertInNthEmptyCell(xml, '話', '{pi_phone}', 1);
xml = insertInNthEmptyCell(xml, '話', '{contact_phone}', 2);
xml = insertInNthEmptyCell(xml, '真', '{pi_fax}', 1);
xml = insertInNthEmptyCell(xml, '真', '{contact_fax}', 2);

// 貳、中文摘要 / 參、英文摘要
let abstractCount = 0;
xml = xml.replace(/請摘述本計畫之目的與實施方法及關鍵詞/g, () => {
  abstractCount++;
  if (abstractCount === 1) return '{abstract_zh}';
  if (abstractCount === 2) return '{abstract_en}';
  return '請摘述本計畫之目的與實施方法及關鍵詞';
});
xml = xml.replace(/(>關鍵詞：<\/w:t><\/w:r>[\s\S]*?<w:t[^>]*>)([\u3000]+)(<\/w:t>)/, '$1{keywords_zh}$3');
xml = xml.replace(/(>keywords<\/w:t>[\s\S]*?>：<\/w:t><\/w:r>[\s\S]*?<w:t[^>]*>)([\u3000]+)(<\/w:t>)/, '$1{keywords_en}$3');

// 肆、計畫內容各節（找提示文字的段落末，在後方插入 placeholder 段落）
const contentSections = [
  ['應避免空泛性之敘述',           '{purpose}'],
  ['本計畫與防疫工作之相關性等',   '{background}'],
  ['將實施方法及進行步驟詳細說明', '{methodology}'],
  ['計畫之成果預估',               '{expected_outcome}'],
  ['並於計畫內容引用處標註之',     '{references}'],
];
for (const [anchor, ph] of contentSections) {
  const anchorIdx = xml.indexOf(anchor);
  if (anchorIdx === -1) { console.warn(`⚠️  找不到 "${anchor}"`); continue; }
  const pEnd = xml.indexOf('</w:p>', anchorIdx);
  if (pEnd === -1) continue;
  xml = xml.substring(0, pEnd + 6) + `<w:p><w:r><w:t>${ph}</w:t></w:r></w:p>` + xml.substring(pEnd + 6);
}
console.log('  ✓ 肆、計畫內容各節注入');

// 七、預定進度 — 甘特圖 loop
{
  const ganttAnchor = '月\u3000次';
  const ganttIdx = xml.indexOf(ganttAnchor);
  if (ganttIdx !== -1) {
    const ganttTblStart = xml.lastIndexOf('<w:tbl', ganttIdx);
    const ganttTblEnd = xml.indexOf('</w:tbl>', ganttIdx) + 8;
    if (ganttTblStart !== -1 && ganttTblEnd > 8) {
      let ganttTable = xml.substring(ganttTblStart, ganttTblEnd);
      const ganttRowParts = ganttTable.split('</w:tr>');
      if (ganttRowParts.length > 2) {
        let dataRow = ganttRowParts[1] + '</w:tr>';
        const ganttPhs = [
          '{#gantt_rows}{task_name}',
          '{m1}','{m2}','{m3}','{m4}','{m5}','{m6}',
          '{m7}','{m8}','{m9}','{m10}','{m11}','{m12}',
          '{/gantt_rows}',
        ];
        let gcIdx = 0;
        dataRow = dataRow.replace(/(<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)(<\/w:p>)/g,
          (match, before, after) => gcIdx < ganttPhs.length ? `${before}<w:r><w:t>${ganttPhs[gcIdx++]}</w:t></w:r>${after}` : match);
        const newTable = ganttRowParts[0] + '</w:tr>' + dataRow + ganttRowParts[ganttRowParts.length - 1];
        xml = xml.substring(0, ganttTblStart) + newTable + xml.substring(ganttTblEnd);
        console.log('  ✓ 甘特圖 loop 注入');
      }
    }
  }
}

// 伍、人力配置 — loop 注入
{
  const personnelAnchor = '在本計畫內擔任之具體工作性質、項目及範圍';
  const personnelIdx = xml.indexOf(personnelAnchor);
  if (personnelIdx !== -1) {
    const trEnd = xml.indexOf('</w:tr>', personnelIdx);
    if (trEnd !== -1) {
      const insertAt = trEnd + 7;
      const nextTrEnd = xml.indexOf('</w:tr>', insertAt);
      if (nextTrEnd !== -1) {
        let rowXml = xml.substring(insertAt, nextTrEnd + 7);
        const cellPhs = [
          '{#personnel_rows}{role_text}',
          '{name_zh}',
          '{title}',
          '{work_description}{/personnel_rows}',
        ];
        let cellIdx = 0;
        rowXml = rowXml.replace(/(<w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)(<\/w:p>)/g,
          (match, before, after) => cellIdx < cellPhs.length ? `${before}<w:r><w:t>${cellPhs[cellIdx++]}</w:t></w:r>${after}` : match);
        xml = xml.substring(0, insertAt) + rowXml + xml.substring(nextTrEnd + 7);
        console.log('  ✓ 伍、人力配置 loop 注入');
      }
    }
  } else {
    console.warn('⚠️  找不到人力配置表頭，跳過');
  }
}

// 目錄頁碼 — bookmark + PAGEREF
{
  const tocSections = [
    // [tocLabel, bmName, bodyAnchor]
    // bodyAnchor = null → 跳過 bookmark（用特殊方式處理）
    // bmName = null → 跳過此 (  )，保留原樣（例如「份」欄位讓使用者手填）
    // bmName = 'NUMPAGES' → 產生 NUMPAGES 欄位
    ['壹、綜合資料',                   'sec_1',    '壹、綜合資料'],
    ['貳、計畫中文摘要',               'sec_2',    '貳、計畫中文摘要'],
    ['參、計畫英文摘要',               'sec_3',    '參、計畫英文摘要'],
    ['肆、計畫內容',                   'sec_4',    '肆、計畫內容'],
    ['一、研究主旨',                   'sec_4_1',  '一、研究主旨'],
    ['二、背景分析',                   'sec_4_2',  '二、背景分析'],
    ['三、多年期計畫之執行成果概要',   'sec_4_3',  '三、多年期計畫之執行成果概要'],
    ['四、實施方法及進行步驟',         'sec_4_4',  '四、實施方法及進行步驟'],
    ['五、成果預估',                   'sec_4_5',  '五、成果預估'],
    ['六、重要參考文獻',               'sec_4_6',  '六、重要參考文獻'],
    ['七、預定進度',                   'sec_4_7',  null],
    ['伍、人力配置',                   'sec_5',    '伍、人力配置'],
    ['陸、經費需求',                   'sec_6',    '陸、經費需求'],
    ['柒、需其他機關配合或協調事項',   'sec_7',    '柒、需其他機關配合或協調事項'],
    ['捌、附表',                       'sec_8',    '捌、附表'],
    // 附表一~三：份數欄位（null = 跳過，留給使用者手填）+ 頁碼欄位
    ['附表一 份數（跳過）',            null,       null],
    ['附表一 頁碼',                    'sec_app1', '附表一：主持人、協同主持人、研究人員學經歷說明書'],
    ['附表二 份數（跳過）',            null,       null],
    ['附表二 頁碼',                    'sec_app2', '附表二：計畫主持人'],
    ['附表三 份數（跳過）',            null,       null],
    ['附表三 頁碼',                    'sec_app3', '附表三：主持人、協同主持人、研究人員最近三年已發表'],
    ['四、其他（跳過）',               null,       null],
    ['共（  ）頁 → NUMPAGES',         'NUMPAGES', null],
  ];
  let bmId = 100;
  // Step 1: 在本文章節標題插入 bookmark（跳過目錄的第一次出現）
  for (const [, bmName, bodyAnchor] of tocSections) {
    if (!bodyAnchor) continue;
    const firstIdx = xml.indexOf(bodyAnchor);
    if (firstIdx === -1) continue;
    const secondIdx = xml.indexOf(bodyAnchor, firstIdx + bodyAnchor.length);
    const targetIdx = secondIdx !== -1 ? secondIdx : firstIdx;
    const pStart = xml.lastIndexOf('<w:p ', Math.max(0, targetIdx - 500));
    if (pStart === -1 || pStart > targetIdx) continue;
    const pTagEnd = xml.indexOf('>', pStart) + 1;
    xml = xml.substring(0, pTagEnd) +
      `<w:bookmarkStart w:id="${bmId}" w:name="${bmName}"/><w:bookmarkEnd w:id="${bmId}"/>` +
      xml.substring(pTagEnd);
    bmId++;
  }
  // 特殊處理七、預定進度（XML 中被拆開）
  {
    const anchor = '年度預定進度';
    const firstIdx = xml.indexOf(anchor);
    const secondIdx = xml.indexOf(anchor, firstIdx + anchor.length);
    const targetIdx = secondIdx !== -1 ? secondIdx : firstIdx;
    if (targetIdx !== -1) {
      const pStart = xml.lastIndexOf('<w:p ', Math.max(0, targetIdx - 500));
      if (pStart !== -1 && pStart < targetIdx) {
        const pTagEnd = xml.indexOf('>', pStart) + 1;
        xml = xml.substring(0, pTagEnd) +
          `<w:bookmarkStart w:id="${bmId}" w:name="sec_4_7"/><w:bookmarkEnd w:id="${bmId}"/>` +
          xml.substring(pTagEnd);
        bmId++;
      }
    }
  }
  // Step 2: 替換目錄的 (  ) 為 PAGEREF
  const tocAreaStart = xml.indexOf('壹、綜合資料');
  const tocAreaEnd   = xml.indexOf('衛生福利部疾病管制署', tocAreaStart + 10);
  if (tocAreaStart !== -1 && tocAreaEnd !== -1) {
    const beforeToc = xml.substring(0, tocAreaStart);
    let tocArea = xml.substring(tocAreaStart, tocAreaEnd);
    const afterToc  = xml.substring(tocAreaEnd);
    let tocIdx = 0;
    tocArea = tocArea.replace(/<w:t>\(\s{2}\)<\/w:t>/g, () => {
      if (tocIdx >= tocSections.length) return '<w:t>(  )</w:t>';
      const bmName = tocSections[tocIdx++][1];
      // null → 跳過，保留 (  ) 讓使用者手填（例如份數欄）
      if (bmName === null) return '<w:t>(  )</w:t>';
      // 'NUMPAGES' → 總頁數欄位
      if (bmName === 'NUMPAGES') {
        return '<w:t>(</w:t></w:r>' +
          '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
          '<w:r><w:instrText xml:space="preserve"> NUMPAGES </w:instrText></w:r>' +
          '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
          '<w:r><w:t>?</w:t></w:r>' +
          '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
          '<w:r><w:t>)</w:t>';
      }
      // 一般 PAGEREF 欄位
      return '<w:t>(</w:t></w:r>' +
        '<w:r><w:fldChar w:fldCharType="begin"/></w:r>' +
        `<w:r><w:instrText xml:space="preserve"> PAGEREF ${bmName} \\h </w:instrText></w:r>` +
        '<w:r><w:fldChar w:fldCharType="separate"/></w:r>' +
        '<w:r><w:t>?</w:t></w:r>' +
        '<w:r><w:fldChar w:fldCharType="end"/></w:r>' +
        '<w:r><w:t>)</w:t>';
    });
    xml = beforeToc + tocArea + afterToc;
    console.log(`  ✓ 目錄 PAGEREF 注入（共 ${tocIdx} 個章節，含附表一~三 + NUMPAGES）`);
  } else {
    console.warn('⚠️  找不到目錄區域，跳過 PAGEREF 注入');
  }
}

// ─────────────────────────────────────────────
// 三、附表一 — 注入到現有表格
// ─────────────────────────────────────────────

const { tblStart, tblEnd } = findAppendix1Table(xml);
const tblPrefix = xml.slice(tblStart, xml.indexOf('<w:tr ', tblStart)); // <w:tbl>...<w:tblGrid>...</w:tblGrid>
let rows = splitRows(xml.slice(tblStart, tblEnd));

console.log(`  附表一：${rows.length} rows`);

// Row 1：類別 cell（cell index 1）→ {pa_role_label}
rows[0] = setRowCell(rows[0], 1, '{pa_role_label}');

// Row 2：姓名(1)、性別(3)、出生年月日(5)
rows[1] = setRowCell(rows[1], 1, '{pa_name_zh}');
rows[1] = setRowCell(rows[1], 3, '{pa_gender_label}');
rows[1] = setRowCell(rows[1], 5, '{pa_birth_date}');

// Row 3：學歷 header — 留原文，不動
// Row 4：欄位 header（學校名稱/學位/起迄年月/科技專長）— 留原文

// Row 5：學歷 loop row → {#pa_education}school|degree|grad_year|expertise{/pa_education}
// Row 6：刪除（多餘的空白行）
{
  const hdr = getRowHeader(rows[4]);
  const cells = splitCells(rows[4]);
  cells[0] = setCellText(cells[0], '{#pa_education}{edu_school}');
  cells[1] = setCellText(cells[1], '{edu_degree}');
  cells[2] = setCellText(cells[2], '{edu_grad_year}');
  cells[3] = setCellText(cells[3], '{/pa_education}');
  rows[4] = hdr + cells.join('') + '</w:tr>';
  rows.splice(5, 1); // 刪除 Row 6
  console.log('  ✓ 學歷 loop 注入，Row 6 刪除');
}

// Row 7：經歷 header — 留原文
// Row 8：服務機構/職稱/起訖年月 header — 留原文

// Row 9（現在 index 7）：服務經歷 loop row
// Row 10（現在 index 8）：曾任 → 刪除
{
  const hdr = getRowHeader(rows[7]);
  const cells = splitCells(rows[7]);
  cells[0] = setCellText(cells[0], '{#pa_work_history}{wh_institution}');
  cells[1] = setCellText(cells[1], '{wh_title}');
  cells[2] = setCellText(cells[2], '{wh_start_ym}～{wh_end_ym}{/pa_work_history}');
  rows[7] = hdr + cells.join('') + '</w:tr>';
  rows.splice(8, 1); // 刪除曾任 row
  console.log('  ✓ 服務經歷 loop 注入，曾任 row 刪除');
}

// 現在 index 重新對齊（已刪兩行）：
// Row 9（idx 8）：近三年內曾參與之研究計畫 header
// Row 10（idx 9）：類別/計畫名稱/.../起訖年月 header
// Row 11（idx 10）：近三年已完成 loop row（原 Row 13）
// Row 12（idx 11）：刪
// Row 13（idx 12）：刪
// Row 14（idx 13）：無資料 row（原 Row 16）→ conditional
// Row 15（idx 14）：執行中 loop
// ...

// 近三年已完成計畫（原 rows 10, 11, 12, 13 → 現在 idx 10,11,12,13）
{
  const loopIdx = 10;
  const hdr = getRowHeader(rows[loopIdx]);
  const cells = splitCells(rows[loopIdx]);
  // col 0 原本是 vMerge restart label；stripVMerge 後變成普通儲存格（保留標題文字，避免 loop 複製時每行都 restart 一個合併）
  cells[0] = stripVMerge(cells[0]);
  cells[1] = setCellText(cells[1], '{#pa_completed}{proj_name}');
  cells[2] = setCellText(cells[2], '{proj_role}');
  cells[3] = setCellText(cells[3], '{proj_budget}');
  cells[4] = setCellText(cells[4], '{proj_funder}');
  cells[5] = setCellText(cells[5], '{proj_start_ym}～{proj_end_ym}{/pa_completed}');
  rows[loopIdx] = hdr + cells.join('') + '</w:tr>';
  rows.splice(loopIdx + 1, 2); // 刪除 row 11,12
  console.log('  ✓ 已完成計畫 loop 注入');
}

// 無資料 row（現在 idx 11，原 row 16）→ conditional
{
  const noDataIdx = 11;
  const hdr = getRowHeader(rows[noDataIdx]);
  const cells = splitCells(rows[noDataIdx]);
  cells[0] = stripVMerge(setVerticalCellText(cells[0], '{#pa_no_completed}近三年已完成之研究計畫{/pa_no_completed}'));
  cells[1] = setCellText(cells[1], '{#pa_no_completed}若無此資料，請填無此資料{/pa_no_completed}');
  rows[noDataIdx] = hdr + cells.join('') + '</w:tr>';
}

// 執行中計畫（現在 idx 12,13,14,15 → 原 row 17,18,19,20）
{
  const loopIdx = 12;
  const hdr = getRowHeader(rows[loopIdx]);
  const cells = splitCells(rows[loopIdx]);
  cells[0] = stripVMerge(cells[0]);  // 移除 vMerge restart，避免 loop 複製時格式錯亂
  cells[1] = setCellText(cells[1], '{#pa_ongoing}{proj_name}');
  cells[2] = setCellText(cells[2], '{proj_role}');
  cells[3] = setCellText(cells[3], '{proj_budget}');
  cells[4] = setCellText(cells[4], '{proj_funder}');
  cells[5] = setCellText(cells[5], '{proj_start_ym}～{proj_end_ym}{/pa_ongoing}');
  rows[loopIdx] = hdr + cells.join('') + '</w:tr>';
  rows.splice(loopIdx + 1, 2);
  console.log('  ✓ 執行中計畫 loop 注入');
}

{
  const noDataIdx = 13;
  const hdr = getRowHeader(rows[noDataIdx]);
  const cells = splitCells(rows[noDataIdx]);
  cells[0] = stripVMerge(setVerticalCellText(cells[0], '{#pa_no_ongoing}執行中之相關研究計畫{/pa_no_ongoing}'));
  cells[1] = setCellText(cells[1], '{#pa_no_ongoing}若無此資料，請填無此資料{/pa_no_ongoing}');
  rows[noDataIdx] = hdr + cells.join('') + '</w:tr>';
}

// 申請中計畫（現在 idx 14,15,16,17）
{
  const loopIdx = 14;
  const hdr = getRowHeader(rows[loopIdx]);
  const cells = splitCells(rows[loopIdx]);
  cells[0] = stripVMerge(cells[0]);  // 移除 vMerge restart
  cells[1] = setCellText(cells[1], '{#pa_pending}{proj_name}');
  cells[2] = setCellText(cells[2], '{proj_role}');
  cells[3] = setCellText(cells[3], '{proj_budget}');
  cells[4] = setCellText(cells[4], '{proj_funder}');
  cells[5] = setCellText(cells[5], '{proj_start_ym}～{proj_end_ym}{/pa_pending}');
  rows[loopIdx] = hdr + cells.join('') + '</w:tr>';
  rows.splice(loopIdx + 1, 2);
  console.log('  ✓ 申請中計畫 loop 注入');
}

{
  const noDataIdx = 15;
  const hdr = getRowHeader(rows[noDataIdx]);
  const cells = splitCells(rows[noDataIdx]);
  cells[0] = stripVMerge(setVerticalCellText(cells[0], '{#pa_no_pending}申請中之相關研究計畫{/pa_no_pending}'));
  cells[1] = setCellText(cells[1], '{#pa_no_pending}若無此資料，請填無此資料{/pa_no_pending}');
  rows[noDataIdx] = hdr + cells.join('') + '</w:tr>';
}

// 重建附表一 tbl XML
const newTblXml = tblPrefix + rows.join('') + '</w:tbl>';
xml = xml.slice(0, tblStart) + newTblXml + xml.slice(tblEnd);
console.log(`  附表一修改後：${rows.length} rows`);

// ─────────────────────────────────────────────
// 三、附表二 — 角色標題 + 條件判斷 + 段落 placeholder 注入
// ─────────────────────────────────────────────

// 附表二：角色標題加在說明文字下方、填寫內容上方
{
  const app2TitlePos = xml.indexOf('附表二：');
  if (app2TitlePos !== -1) {
    const app2ParaEnd = xml.indexOf('</w:p>', app2TitlePos) + '</w:p>'.length;
    xml = xml.slice(0, app2ParaEnd) +
      '<w:p><w:r><w:t xml:space="preserve">{pa_role_label}</w:t></w:r></w:p>' +
      xml.slice(app2ParaEnd);
    console.log('  ✓ 附表二 角色標題注入（說明文字下方）');
  }
}

// 在附表二「計畫名稱：」段落前插入 {#pa_has_pi_proj}（有資料才顯示下面各行）
// 注意：搜尋範圍限在附表二標題之後，避免誤中封面頁的「計畫名稱：」
{
  const app2RefPos = xml.indexOf('附表二：');
  const labelPos = app2RefPos !== -1 ? xml.indexOf('計畫名稱：', app2RefPos) : -1;
  if (labelPos !== -1) {
    const paraStart = xml.lastIndexOf('<w:p ', labelPos);
    xml = xml.slice(0, paraStart) +
      '<w:p><w:r><w:t>{#pa_has_pi_proj}</w:t></w:r></w:p>' +
      xml.slice(paraStart);
  }
}

// 附表二段落標籤注入（限定從附表二標題之後搜尋，避免誤中文件前段）
const app2SearchFrom = xml.indexOf('附表二：');
xml = injectIntoLabelPara(xml, '計畫名稱：',       '{pa_pi_proj_name}',    app2SearchFrom);
xml = injectIntoLabelPara(xml, '計畫主持人：',      '{pa_pi_proj_pi}',      app2SearchFrom);
xml = injectIntoLabelPara(xml, '委託或補助單位：',   '{pa_pi_proj_funder}',  app2SearchFrom);
xml = injectIntoLabelPara(xml, '執行期程：',        '{pa_pi_proj_period}',  app2SearchFrom);
xml = injectIntoLabelPara(xml, '經費：',            '{pa_pi_proj_budget}',  app2SearchFrom);
xml = injectIntoLabelPara(xml, '摘要：',            '{pa_pi_proj_summary}', app2SearchFrom);

// 在摘要 placeholder 之後加入 {/pa_has_pi_proj} 和無資料條件
{
  const summaryPos = xml.indexOf('{pa_pi_proj_summary}', app2SearchFrom);
  if (summaryPos !== -1) {
    const paraEnd = xml.indexOf('</w:p>', summaryPos) + '</w:p>'.length;
    xml = xml.slice(0, paraEnd) +
      '<w:p><w:r><w:t>{/pa_has_pi_proj}</w:t></w:r></w:p>' +
      '<w:p><w:r><w:t>{#pa_no_pi_proj}無此資料{/pa_no_pi_proj}</w:t></w:r></w:p>' +
      xml.slice(paraEnd);
  }
}
console.log('  ✓ 附表二 placeholder 注入（含條件判斷）');

// ─────────────────────────────────────────────
// 四、附表三 — 角色標題 + 著作清單文字 placeholder
// ─────────────────────────────────────────────

// 附表三：角色標題加在說明文字下方、填寫內容上方
{
  const app3TitlePos = xml.indexOf('附表三：');
  if (app3TitlePos !== -1) {
    const app3ParaEnd = xml.indexOf('</w:p>', app3TitlePos) + '</w:p>'.length;
    xml = xml.slice(0, app3ParaEnd) +
      '<w:p><w:r><w:t xml:space="preserve">{pa_role_label}</w:t></w:r></w:p>' +
      xml.slice(app3ParaEnd);
    console.log('  ✓ 附表三 角色標題注入（說明文字下方）');
  }
}

const app3pos = xml.indexOf('附表三：');
if (app3pos !== -1) {
  // 找附表三之後第一個空段落，注入 placeholder
  const afterApp3 = xml.slice(app3pos);
  const emptyParaMatch = afterApp3.match(/(<w:p[^>]*>(?:<w:pPr>[\s\S]*?<\/w:pPr>)?)(<\/w:p>)/);
  if (emptyParaMatch) {
    const ip = app3pos + emptyParaMatch.index + emptyParaMatch[1].length;
    xml = xml.slice(0, ip) +
      '<w:r><w:t xml:space="preserve">{pa_publications_text}</w:t></w:r>' +
      xml.slice(ip);
    console.log('  ✓ 附表三 placeholder 注入');
  }
}

// ─────────────────────────────────────────────
// 五、personnel_appendix loop 包住全部附表
// ─────────────────────────────────────────────

// 找附表一標題所在段落，在前面插入 {#personnel_appendix}
const app1TitlePos = xml.indexOf('附表一：主持人');
const app1ParaStart = xml.lastIndexOf('<w:p ', app1TitlePos);
const loopStartPara = '<w:p><w:r><w:t>{#personnel_appendix}</w:t></w:r></w:p>';
xml = xml.slice(0, app1ParaStart) + loopStartPara + xml.slice(app1ParaStart);

// 在 </w:body> 前插入 {/personnel_appendix}
const loopEndPara = '<w:p><w:r><w:t>{/personnel_appendix}</w:t></w:r></w:p>';
xml = xml.replace('</w:body>', loopEndPara + '</w:body>');
console.log('  ✓ personnel_appendix loop 包裝完成');

saveDoc(zip, xml, OUT);
