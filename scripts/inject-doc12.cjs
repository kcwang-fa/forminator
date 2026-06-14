// ===== IRB-002-1 人體研究計畫申請表（DOC-12）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-12.docx
// 來源：../source-templates/IRB-002-1 人體研究計畫申請表.docx
//
// ⚠️  DOC-12 = IRB-002-1 人體研究計畫申請表（簡審 / 一般審共用）
// 執行：node scripts/inject-doc12.cjs  或  npm run inject-doc12
//
// ── 目前自動化範圍 ────────────────────────────────────────────────────────
// IRB-002-1 本身是一張「checkbox + 空白格」的可手填表單。目前已把可由 wizard 明確取得的資料
// 接成 placeholder；仍需人工判斷或尚無專用 FormData 欄位的說明格，保留 Word 手填：
//
//   (A) LIVE   ── 基本資料區（計畫名稱 / 主持人 / 協同 / 聯絡人 / 預期研究期限 / 研究計畫目的）
//                 與 DOC-5 IRB-012 共用既有 key。
//   (B) 勾選格 ── 後半段 70 個 □ 換成 {irb0021_*}，由 prepareIrb002_1Data 填 ■/□。
//   (C) 隱私   ── 三段範例文字改接 {privacy_during/after/withdrawal}。
//   (D) 文字   ── 招募、族群、名單、關係、對照組、檢體、資料、知情同意、追蹤等附帶說明格。
//   (E) 簽章   ── 主持人簽章可嵌圖；單位主管欄維持紙本核章。
//
// 尚未完整自動化的欄位分成「主選項已接、附帶說明手填」與「完全未接」兩類，詳見檔尾進度註記。

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/IRB-002-1 人體研究計畫申請表.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-12.docx');

// 注入「新建 run」用的字型設定：中文標楷體（DFKai-SB）、英數 Times New Roman。
// 為什麼？insertInNextCell / injectSectionCell 等都是「新建一個不帶 rPr 的 <w:r>」，Word 找不到字型
// 就 fallback 到範本 docDefaults（新細明體 PMingLiU），注入的中文會跟周圍標楷體不一致。明示 rPr 釘住。
// （IRB-002-1 範本大量用 DFKai-SB，與 DOC-5 IRB-012 同，故沿用同一個常數。）
const KAI_RPR = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="DFKai-SB" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:hint="eastAsia"/></w:rPr>';

function readDocXml(p) {
  const zip = new PizZip(fs.readFileSync(p));
  return { zip, xml: zip.file('word/document.xml').asText() };
}
function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-12.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}

// 簽章欄使用「條件 section + 圖片標籤」：有 PI 簽名才嵌圖，沒有則保留空白供紙本手簽。
// 三個標籤必須各自放在獨立 run，否則 image module 會失去圖片標籤的段落上下文。
function sigRuns(prefix) {
  return `<w:r><w:t>{#${prefix}_has_sig}</w:t></w:r>` +
         `<w:r><w:t>{%${prefix}_sig}</w:t></w:r>` +
         `<w:r><w:t>{/${prefix}_has_sig}</w:t></w:r>`;
}

function injectSigAfterRun(xml, anchorText, prefix, searchFrom = 0) {
  const anchorIdx = xml.indexOf(anchorText, searchFrom);
  if (anchorIdx === -1) throw new Error(`簽名欄錨點「${anchorText}」不存在（範本可能改版）`);
  const runEnd = xml.indexOf('</w:r>', anchorIdx);
  if (runEnd === -1) throw new Error(`簽名欄錨點「${anchorText}」後找不到 run 結尾`);
  const insertAt = runEnd + '</w:r>'.length;
  let out = xml.slice(0, insertAt) + sigRuns(prefix) + xml.slice(insertAt);

  // 原表格簽章列鎖死固定行高，圖片可能被裁切；改成至少該高度，保留文字與簽名完整顯示。
  const paraStart = out.lastIndexOf('<w:p ', anchorIdx);
  if (paraStart !== -1) {
    const head = out.slice(paraStart, anchorIdx);
    if (head.includes('w:lineRule="exact"')) {
      out = out.slice(0, paraStart)
        + head.replace('w:lineRule="exact"', 'w:lineRule="atLeast"')
        + out.slice(anchorIdx);
    }
  }
  return out;
}

// 把 ">舊字<" 換成 ">新字<"（限定夾在 tag 之間，避免誤中屬性值）；找不到就退而求其次做全域字串替換。
function replaceText(xml, oldText, newText) {
  const esc = oldText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const r = xml.replace(new RegExp(`(>)${esc}(<)`, 'g'), `$1${newText}$2`);
  return r !== xml ? r : xml.replace(new RegExp(esc, 'g'), newText);
}

// 在「label 標籤」後面那一格（值欄）的空段落裡，插入一個帶標楷體的 placeholder run。
// pattern：label 文字 → 收掉 run/段落/cell → 下一個 cell 的 tcPr → 該 cell 第一段的 pPr → 立刻 </w:p>（空段落）。
// 找不到就 fallback：把 placeholder 直接接在 label 文字後（保底，避免完全沒注入）。
function insertInNextCell(xml, labelText, placeholder) {
  const esc = labelText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${esc}<\\/w:t><\\/w:r><\\/w:p><\\/w:tc><w:tc><w:tcPr>[\\s\\S]*?<\\/w:tcPr><w:p[^>]*><w:pPr>[\\s\\S]*?<\\/w:pPr>)(<\\/w:p>)`
  );
  const r = xml.replace(pattern, `$1<w:r>${KAI_RPR}<w:t>${placeholder}</w:t></w:r>$2`);
  return r !== xml ? r : replaceText(xml, labelText, labelText + placeholder);
}

// 在指定「區段」（如「計畫主持人」「協同主持人」「聯絡人」）之後，往後找第一個 label，
// 把它後面那一格（值欄）填入 placeholder。
// 為什麼要先錨定區段？因為「職稱 / 服務單位 / 聯絡電話 / 電子信箱」在這張表會重複出現
// （主持人 / 協同主持人 / 聯絡人 各一份，後面「多中心」區還有更多），純用 insertInNextCell 只會一直
// 打到第一個（主持人）。先用區段字串當錨點，再往後抓第一個對應 label，就能命中正確區段那一份。
// labelEnd = label「最後一個 text run」的文字：多數 label 是單一 run，傳完整字串即可；
//   但主持人區的「電子信箱」被拆成「電子」+「信箱」兩個 run，那一格要傳 '信箱'（用結尾 run 當錨點）。
function injectSectionCell(xml, sectionText, labelEnd, placeholder) {
  const escS = sectionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escL = labelEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${escS}[\\s\\S]*?${escL}<\\/w:t><\\/w:r><\\/w:p><\\/w:tc><w:tc><w:tcPr>[\\s\\S]*?<\\/w:tcPr><w:p[^>]*>)([\\s\\S]*?)(<\\/w:p>)`
  );
  return xml.replace(pattern, `$1<w:r>${KAI_RPR}<w:t>${placeholder}</w:t></w:r>$3`);
}

// 把「某個 placeholder 所在段落」的對齊從兩端對齊（both）改成靠左（left）。
// why：值欄段落 pPr 預設 <w:jc w:val="both"/>，研究計畫目的這種長段落本文兩端對齊會把字距拉鬆、難看。
// how：placeholder 注入在段落「結尾」、jc 在段落「開頭」的 pPr，往前找最近的一個 both 必是同段那個 jc。
function alignPlaceholderLeft(xml, placeholder) {
  const idx = xml.indexOf(placeholder);
  if (idx === -1) { console.warn(`⚠️  alignPlaceholderLeft 找不到 ${placeholder}`); return xml; }
  const both = '<w:jc w:val="both"/>';
  const jcIdx = xml.lastIndexOf(both, idx);
  if (jcIdx === -1) return xml;
  return xml.substring(0, jcIdx) + '<w:jc w:val="left"/>' + xml.substring(jcIdx + both.length);
}

// 「預期研究期限」：__年 __月(請填寫送審後的日期) 至 __年 __月
// 值欄裡 4 個「底線空格」run（起始年/起始月/結束年/結束月）夾在「年」「月…至」等固定文字 run 之間，
// 順序固定。底線空格 run 是這格唯一「整段都是空白」的 <w:t>，故可安全地「只在這一格範圍內」依序把
// 4 個全空白 run 的內文換成 placeholder，保留外層帶 <w:u> 的 run（填入值仍有底線）。
// placeholders 對應 docgen 已備妥的「全程執行期間」民國年月（送審後～計畫結束）。
function injectPeriodBlanks(xml) {
  const anchor = '預期研究期限</w:t></w:r></w:p></w:tc>';
  const aIdx = xml.indexOf(anchor);
  if (aIdx === -1) { console.warn('⚠️  injectPeriodBlanks 找不到「預期研究期限」'); return xml; }
  const cellStart = aIdx + anchor.length;
  const cellEnd = xml.indexOf('</w:tc>', cellStart) + '</w:tc>'.length;
  const placeholders = ['{full_exec_start_y}', '{full_exec_start_m}', '{full_exec_end_y}', '{full_exec_end_m}'];
  let n = 0;
  const cell = xml.substring(cellStart, cellEnd).replace(
    /<w:t xml:space="preserve">\s+<\/w:t>/g,
    () => (n < placeholders.length
      ? `<w:t xml:space="preserve">${placeholders[n++]}</w:t>`
      : `<w:t xml:space="preserve">       </w:t>`)
  );
  if (n !== placeholders.length) {
    console.warn(`⚠️  injectPeriodBlanks 預期 4 個底線空格，實際換到 ${n} 個`);
  }
  return xml.substring(0, cellStart) + cell + xml.substring(cellEnd);
}

// 「label：____」型自由文字填寫格的通用注入：把「label：」後面第一個「帶底線、整段空白」的 run 換成 placeholder。
// 例：招募方式（請說明招募方式及退出機制：____）、估計人數（研究對象估計人數：____人）。
// 結構：label run → 緊接一個「帶底線、整段空白」的 run（填寫處）→（可能還有別的 run，如「人」）。
// 保留該 run 的 <w:u single>，填入的字仍有底線、像正式表單欄位；docgen 帶空字串時維持空白底線可手寫。
// why 先用 label 錨定再取「之後第一個空白 run」：整份文件還有很多空白 run，必須把範圍框在這一行。
function injectBlankAfterLabel(xml, label, placeholder, blockName) {
  const anchor = `${label}</w:t></w:r>`;
  const i = xml.indexOf(anchor);
  if (i === -1) { console.warn(`⚠️  [${blockName}] 找不到「${label}」`); return xml; }
  const tail = xml.substring(i + anchor.length);
  // anchor 後第一個「整段空白」的 <w:t>（填寫格）；\s+ 限定在 <w:t>…</w:t> 之間，不會跨 run。
  const blank = tail.match(/<w:t xml:space="preserve">\s+<\/w:t>/);
  if (!blank) { console.warn(`⚠️  [${blockName}] anchor 後找不到空白填寫格`); return xml; }
  const replaced = tail.replace(blank[0], `<w:t xml:space="preserve">${placeholder}</w:t>`);
  return xml.substring(0, i + anchor.length) + replaced;
}

// 同 injectBlankAfterLabel，但先用 fromText 把搜尋起點推到指定位置之後。
// why：有些 label 字面在整份文件重複出現（如「請說明：」共 5 處），純 indexOf 會抓到前面別題那個。
//   先用該題獨有的問題文字（fromText）定位，再往後找它自己的 label 與空白格，才不會張冠李戴。
function injectBlankAfterLabelFrom(xml, fromText, label, placeholder, blockName) {
  const from = xml.indexOf(fromText);
  if (from === -1) { console.warn(`⚠️  [${blockName}] 找不到題目「${fromText}」`); return xml; }
  const anchor = `${label}</w:t></w:r>`;
  const i = xml.indexOf(anchor, from);
  if (i === -1) { console.warn(`⚠️  [${blockName}] 「${fromText}」之後找不到「${label}」`); return xml; }
  const tail = xml.substring(i + anchor.length);
  const blank = tail.match(/<w:t xml:space="preserve">\s+<\/w:t>/);
  if (!blank) { console.warn(`⚠️  [${blockName}] anchor 後找不到空白填寫格`); return xml; }
  const replaced = tail.replace(blank[0], `<w:t xml:space="preserve">${placeholder}</w:t>`);
  return xml.substring(0, i + anchor.length) + replaced;
}

// 同樣是「某段文字之後的第一個底線空白」注入，但 label 不要求剛好是完整獨立 run。
// why：DOC-12 有些 label 被拆成多個 run（例如「本署」+「人員，理由」+「：」），
//   也有些 label 前面帶縮排空白。用字串片段定位後抓第一個空白填寫格，比要求完整 run 更穩。
function injectBlankAfterTextFrom(xml, fromText, labelText, placeholder, blockName) {
  const from = xml.indexOf(fromText);
  if (from === -1) { console.warn(`⚠️  [${blockName}] 找不到題目「${fromText}」`); return xml; }
  const i = xml.indexOf(labelText, from);
  if (i === -1) { console.warn(`⚠️  [${blockName}] 「${fromText}」之後找不到「${labelText}」`); return xml; }
  const tail = xml.substring(i + labelText.length);
  const blank = tail.match(/<w:t xml:space="preserve">\s+<\/w:t>/);
  if (!blank) { console.warn(`⚠️  [${blockName}] label 後找不到空白填寫格`); return xml; }
  const replaced = tail.replace(blank[0], `<w:t xml:space="preserve">${placeholder}</w:t>`);
  return xml.substring(0, i + labelText.length) + replaced;
}

// 「label 下一段是整段底線範例文字」的注入：把下一個 paragraph 的第一個 <w:t> 換成 placeholder，其餘清空。
// 用於「既存檢體」「新蒐集資料」「既有資料」這種範本把範例文字直接放在底線段落裡的欄位。
function injectNextParagraphAfterTextFrom(xml, fromText, labelText, placeholder, blockName) {
  const from = xml.indexOf(fromText);
  if (from === -1) { console.warn(`⚠️  [${blockName}] 找不到題目「${fromText}」`); return xml; }
  const i = xml.indexOf(labelText, from);
  if (i === -1) { console.warn(`⚠️  [${blockName}] 「${fromText}」之後找不到「${labelText}」`); return xml; }
  const labelParaEnd = xml.indexOf('</w:p>', i);
  const pStart = xml.indexOf('<w:p', labelParaEnd);
  const pEndStart = xml.indexOf('</w:p>', pStart);
  if (labelParaEnd === -1 || pStart === -1 || pEndStart === -1) {
    console.warn(`⚠️  [${blockName}] 找不到 label 後的下一段填寫格`);
    return xml;
  }

  const pEnd = pEndStart + '</w:p>'.length;
  const para = xml.substring(pStart, pEnd);
  const T_OPEN = /(<w:t(?: [^>]*)?>)[\s\S]*?(<\/w:t>)/g;
  let placed = false;
  const nextPara = para.replace(T_OPEN, (match, open, close) => {
    if (!placed) {
      placed = true;
      return `${open}${placeholder}${close}`;
    }
    return `${open}${close}`;
  });
  if (!placed) {
    console.warn(`⚠️  [${blockName}] 下一段找不到可替換的 <w:t>`);
    return xml;
  }
  return xml.substring(0, pStart) + nextPara + xml.substring(pEnd);
}

// label 後沒有底線空白、下一段又已經是正式註解時，直接在該 label 段落結尾加 placeholder run。
// DOC-12 的去識別化程序題就是這種結構：題目以冒號結尾，下一段立刻開始「※註1」。
function injectAtParagraphEndAfterText(xml, labelText, placeholder, blockName) {
  const i = xml.indexOf(labelText);
  if (i === -1) { console.warn(`⚠️  [${blockName}] 找不到「${labelText}」`); return xml; }
  const pEnd = xml.indexOf('</w:p>', i);
  if (pEnd === -1) { console.warn(`⚠️  [${blockName}] label 後找不到段落結尾`); return xml; }
  const run = `<w:r>${KAI_RPR}<w:t xml:space="preserve">${placeholder}</w:t></w:r>`;
  return xml.substring(0, pEnd) + run + xml.substring(pEnd);
}

// 「label：____」但填寫空白與 label 在同一個 run（尾隨空白）的注入。
// 例：第 11 題「□ 是，資料庫名稱：    」——「資料庫名稱：」與後面那串空白同屬一個 <w:t>，
//   不是獨立的空白 run，故 injectBlankAfterLabel（找下一個空白 run）抓不到。
// 作法：把該 run 內「label 後到 </w:t> 之間的尾隨空白」換成 placeholder（label 文字保留）。
// 用非 global replace、只換第一個命中（label 已挑足夠獨特的字串，見呼叫處）。
function injectInlineBlankAfter(xml, label, placeholder, blockName) {
  const esc = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(${esc})\\s*(<\\/w:t>)`);
  if (!re.test(xml)) { console.warn(`⚠️  [${blockName}] 找不到「${label}…</w:t>」`); return xml; }
  return xml.replace(re, `$1${placeholder}$2`);
}

// ── 後半段「勾選格」批次注入（Phase 2）────────────────────────────────────
// DOC-12 後半段是一大張「□ 勾選表」（研究類別／族群／檢體／資料／知情同意…）。
// 我們把每個 □ 換成一個 docxtemplater placeholder（如 {irb0021_cat_medical_record}），
// docgen 之後依使用者填的內容把它填成 ■（勾）或 □（不勾）。
//
// 為什麼用「範圍 + 依序對位」而不是逐字串 replace？
//   後半段同一個「是/否」會重複出現幾十次，□ 與標籤的 run 切法又很零碎（有時 □ 跟標籤同 run、
//   有時單獨一個 run、有時黏在段落屬性後），純文字 replace 根本分不出「這個 □ 是哪一格」。
//   但 word/document.xml 是「按文件閱讀順序」序列化的，所以只要先用 startText/endText 把某一區塊
//   （例如「族群」那格）框出來，區塊內第 N 個出現的 □ 就一定是該區塊第 N 個勾選格——這跟我們手寫
//   的對位表順序一致（與 inject-doc13.cjs 的「第 N 個 □」同一個道理）。
//
// entries：該區塊內每個 □ 依序對應的 { ph, expect }；ph 為 null 代表「這格刻意保留靜態手填」
//   （例如知情同意落實方式——判斷性太強，不自動勾），佔位讓後面的格不會錯位。
//   expect 是「該格後方描述的一段關鍵字」，純做對位健檢；範本若改版、順序跑掉會 warn 出來。
//   endText 省略時掃到字串結尾（給文件最後一個區塊 DSMP 用）。
function replaceBoxesInRange(xml, label, startText, endText, entries) {
  const s = xml.indexOf(startText);
  if (s === -1) { console.warn(`⚠️  [${label}] 找不到起點「${startText}」`); return xml; }
  const e = endText ? xml.indexOf(endText, s + startText.length) : xml.length;
  if (e === -1) { console.warn(`⚠️  [${label}] 找不到終點「${endText}」`); return xml; }

  let idx = 0;
  const mismatches = [];
  const seg = xml.substring(s, e).replace(/□/g, (mark, offset, str) => {
    const entry = entries[idx];
    idx += 1;
    if (!entry || entry.ph === null) return mark; // 超出對位表 / 刻意保留靜態 → 原樣不動
    // 對位健檢：□ 後方 250 字去標籤、normalize('NFC')（範本有 CJK 相容字，如「驗」「不」），
    //          應包含該格預期關鍵字。expect 留空則略過（□ 後緊跟 run 邊界、關鍵字較遠者）。
    if (entry.expect) {
      // 取一大段原始字串（□ 與標籤之間常夾大量 run 屬性 tag），去標籤後才看得到後方描述文字。
      const after = str.substring(offset + 1, offset + 1200).replace(/<[^>]+>/g, '').normalize('NFC');
      if (!after.includes(entry.expect.normalize('NFC'))) {
        mismatches.push(`[${label}] 第 ${idx - 1} 格（${entry.ph}）後方未見「${entry.expect}」，可能對錯位`);
      }
    }
    return `{${entry.ph}}`;
  });

  if (idx !== entries.length) {
    console.warn(`⚠️  [${label}] 範圍內 □ 數 ${idx}，對位表 ${entries.length} 筆（範本可能改版）`);
  }
  mismatches.forEach((m) => console.warn('⚠️  對位健檢:', m));
  return xml.substring(0, s) + seg + xml.substring(e);
}

// 多中心研究表格：保留官方四欄（國別／城市／地點／聯絡人姓名/電話/電子信箱），
// 把原本兩列空白資料列改成一列 docxtemplater loop row。渲染時會依 multicenter_site_rows
// 自動長出對應列數；單中心由 docgen 傳兩列空白資料，維持原範本的兩列空白版型。
function replaceFirstParagraphText(cell, placeholder) {
  const pStart = cell.indexOf('<w:p');
  const pEndStart = cell.indexOf('</w:p>', pStart);
  if (pStart === -1 || pEndStart === -1) return cell;

  const pEnd = pEndStart + '</w:p>'.length;
  const paragraph = cell.substring(pStart, pEnd)
    .replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, '')
    .replace(
      '</w:p>',
      `<w:r>${KAI_RPR}<w:t xml:space="preserve">${placeholder}</w:t></w:r></w:p>`,
    );
  return cell.substring(0, pStart) + paragraph + cell.substring(pEnd);
}

function injectMulticenterTableRows(xml) {
  const anchor = '國別</w:t>';
  const anchorIndex = xml.indexOf(anchor);
  if (anchorIndex === -1) {
    console.warn('⚠️  [多中心表格] 找不到「國別」表頭');
    return xml;
  }

  // 必須找精確的 <w:tbl>；若只找 "<w:tbl" 會誤中表頭列裡的 <w:tblPrEx>。
  const tableStart = xml.lastIndexOf('<w:tbl>', anchorIndex);
  const tableEndStart = xml.indexOf('</w:tbl>', anchorIndex);
  if (tableStart === -1 || tableEndStart === -1) {
    console.warn('⚠️  [多中心表格] 找不到表格範圍');
    return xml;
  }

  const tableEnd = tableEndStart + '</w:tbl>'.length;
  const table = xml.substring(tableStart, tableEnd);
  const rows = [...table.matchAll(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g)];
  const headerIndex = rows.findIndex((row) => row[0].includes('國別') && row[0].includes('聯絡人姓名'));
  if (headerIndex === -1 || !rows[headerIndex + 1] || !rows[headerIndex + 2]) {
    console.warn('⚠️  [多中心表格] 預期表頭後有兩列空白資料列');
    return xml;
  }

  const sourceRow = rows[headerIndex + 1][0];
  const cells = [...sourceRow.matchAll(/<w:tc\b[^>]*>[\s\S]*?<\/w:tc>/g)];
  if (cells.length !== 4) {
    console.warn(`⚠️  [多中心表格] 預期 4 欄，實際 ${cells.length} 欄`);
    return xml;
  }

  const placeholders = [
    '{#multicenter_site_rows}{country}',
    '{city}',
    '{location}',
    '{contact}{/multicenter_site_rows}',
  ];
  let loopRow = sourceRow;
  for (let i = cells.length - 1; i >= 0; i -= 1) {
    const cell = cells[i][0];
    const cellStart = cells[i].index;
    loopRow = loopRow.substring(0, cellStart)
      + replaceFirstParagraphText(cell, placeholders[i])
      + loopRow.substring(cellStart + cell.length);
  }

  const firstDataRowStart = rows[headerIndex + 1].index;
  const secondDataRowEnd = rows[headerIndex + 2].index + rows[headerIndex + 2][0].length;
  const updatedTable = table.substring(0, firstDataRowStart)
    + loopRow
    + table.substring(secondDataRowEnd);

  console.log('  ✓ 多中心官方四欄表格注入 {#multicenter_site_rows}');
  return xml.substring(0, tableStart) + updatedTable + xml.substring(tableEnd);
}

// ── 隱私保護三段：注入使用者自填文字（比照 inject-doc5）──────────────────────
// 範本三段（研究中 / 結束後 / 中途退出）各列了數條「舉例N：…」現成敘述。Phase 2 改成：把每段
// 第一個「舉例段」整段內文換成 placeholder（{privacy_during/after/withdrawal}）、其餘舉例段內文清空，
// docgen 用使用者在 Step4 填（或勾舉例帶入後再調整）的隱私文字填回。
// 範圍用「大題 / 下一段標題」框定，不依賴 (1)(2)(3) 子標題的精確定位（(1) 標題在 XML 被拆 run、
// 連續字串找不到；改用『含「舉例」的段落』來認，標題段與※註段不含「舉例」會自動保留）。
function injectPrivacyExamples(xml, label, startText, endText, placeholder) {
  const s = xml.indexOf(startText);
  if (s === -1) { console.warn(`⚠️  [隱私-${label}] 找不到起點「${startText}」`); return xml; }
  const e = xml.indexOf(endText, s + startText.length);
  if (e === -1) { console.warn(`⚠️  [隱私-${label}] 找不到終點「${endText}」`); return xml; }

  let placed = false;
  let cleared = 0;
  const seg = xml.substring(s, e).replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    if (!para.includes('舉例')) return para; // 標題段、※註段不動
    // ⚠️ 比對 <w:t> 開標籤時，「<w:t」後面必須緊接空白（有屬性，如 <w:t xml:space="preserve">）或 ">"，
    //    否則會誤命中 <w:tabs> / <w:tab .../> / <w:tblPr> 等同前綴標籤，把 placeholder 塞進 <w:tabs> 裡
    //    破壞 XML 結構（malformed xml）。故用 (?: [^>]*)? 而非 [^>]*。
    const T_OPEN = /(<w:t(?: [^>]*)?>)[\s\S]*?(<\/w:t>)/g;
    if (!placed) {
      placed = true;
      // 該段第一個 <w:t> 放 placeholder（保留其 run 字型），其餘 <w:t> 清空
      let firstT = true;
      return para.replace(T_OPEN, (m, open, close) => {
        if (firstT) { firstT = false; return `${open}${placeholder}${close}`; }
        return `${open}${close}`;
      });
    }
    cleared += 1;
    return para.replace(T_OPEN, '$1$2'); // 後續舉例段內文清空
  });

  if (!placed) console.warn(`⚠️  [隱私-${label}] 範圍內找不到「舉例」段，${placeholder} 未注入`);
  return xml.substring(0, s) + seg + xml.substring(e);
}

console.log('📄 Processing DOC-12: IRB-002-1 人體研究計畫申請表');
let { zip, xml } = readDocXml(SRC);

// ===== (A) LIVE 基本資料區（接既有 docgen key，與 DOC-5 IRB-012 共用）=====

// 計畫名稱 中／英文（值格是帶 pPr 的空段落；中文/英文各只命中第一個＝計畫名稱那列，
// 主持人區的「中文姓名/英文姓名」因 中文/英文 後面接的是「姓名」run、非 cell 收尾，不會被誤中）
xml = insertInNextCell(xml, '中文', '{project_title_zh}');
xml = insertInNextCell(xml, '英文', '{project_title_en}');

// 計畫主持人 中文姓名
// ⚠️ 範本裡「中文」與「姓名」是兩個獨立 run，連起來的「中文姓名」字串並不存在（grep 不到），
//    所以不能用 insertInNextCell('中文姓名',…)。改用跨 run regex：從「計畫主持人」往後找第一個「姓名」
//    （＝中文姓名那一格），把它後面那一格填入 placeholder。（與 DOC-5 同手法。）
xml = xml.replace(
  /(計畫主持人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  `$1<w:r>${KAI_RPR}<w:t>{pi_name_zh}</w:t></w:r>$3`);

// 協同主持人 姓名（多位協同主持人由 docgen 用「、」合併成單一字串）
xml = xml.replace(
  /(協同主持人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  `$1<w:r>${KAI_RPR}<w:t>{co_pi_names}</w:t></w:r>$3`);

// 聯絡人 姓名
xml = xml.replace(
  /(聯絡人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  `$1<w:r>${KAI_RPR}<w:t>{contact_name_zh}</w:t></w:r>$3`);

// 計畫主持人 其餘欄：職稱 / 服務單位 / 聯絡電話 / 電子信箱
// （都用「計畫主持人」當區段錨點往後抓第一個對應 label。主持人區「電子信箱」是 split run「電子」+「信箱」，
//  故 labelEnd 傳 '信箱'。「英文姓名」不注入＝沒有對應 docgen key，留空白給使用者填。）
xml = injectSectionCell(xml, '計畫主持人', '職稱',     '{pi_title}');
xml = injectSectionCell(xml, '計畫主持人', '服務單位', '{pi_unit}');
xml = injectSectionCell(xml, '計畫主持人', '聯絡電話', '{pi_phone}');
xml = injectSectionCell(xml, '計畫主持人', '信箱',     '{pi_email}');

// 協同主持人 其餘欄：職稱 / 服務單位（此表協同主持人是單一固定列，無電話/信箱欄）
xml = injectSectionCell(xml, '協同主持人', '職稱',     '{co_pi_titles}');
xml = injectSectionCell(xml, '協同主持人', '服務單位', '{co_pi_units}');

// 聯絡人 其餘欄：職稱 / 聯絡電話 / 電子信箱（聯絡人區的「電子信箱」是單一 run，labelEnd 傳完整字串）
xml = injectSectionCell(xml, '聯絡人', '職稱',     '{contact_title}');
xml = injectSectionCell(xml, '聯絡人', '聯絡電話', '{contact_phone}');
xml = injectSectionCell(xml, '聯絡人', '電子信箱', '{contact_email}');

// 預期研究期限：全程執行期間民國年月填入 4 個底線空格
xml = injectPeriodBlanks(xml);

// 研究計畫目的：用 {purpose_brief}（純研究主旨，不含分年目的；⚠️ 不要 DOC-2 的合併值 {purpose}）
xml = insertInNextCell(xml, '研究計畫目的', '{purpose_brief}');
xml = alignPlaceholderLeft(xml, '{purpose_brief}');

console.log('  ✓ (A) 基本資料區欄位注入');

// ===== (B) 後半段勾選格 → {irb0021_*} placeholder（依區塊範圍 + 第 N 個 □ 對位）=====
//
// 對位表：依文件閱讀順序排（與後半段 □ 出現順序一致）。每個 entry 是該格的 placeholder + 健檢關鍵字；
// ph: null 代表「刻意保留靜態手填」（判斷性太強、不自動勾），佔位避免後面的格錯位。
// 命名前綴 irb0021_（= IRB-002-1，與 DOC-13 的 irb003_ 區分）；docgen prepareIrb002_1Data 填 ■/□。
const N = { ph: null }; // 靜態保留格的簡寫
const BOX_BLOCKS = [
  {
    label: '研究類別+審查條件',
    start: '研究類別：（可複選）',
    end: '多中心類別',
    entries: [
      // 研究類別（可複選）8 格
      { ph: 'irb0021_cat_questionnaire',   expect: '問卷調查' },
      { ph: 'irb0021_cat_database',        expect: '資料庫' },
      { ph: 'irb0021_cat_business',        expect: '非防疫' },
      { ph: 'irb0021_cat_medical_record',  expect: '病歷回顧' },
      { ph: 'irb0021_cat_strain',          expect: '菌株' },
      { ph: 'irb0021_cat_specimen',        expect: '檢體採集' },
      { ph: 'irb0021_cat_residual',        expect: '餘檢體' },
      { ph: 'irb0021_cat_other',           expect: '其他' },
      // 是否符合簡審 / 免審條件 4 格
      { ph: 'irb0021_meets_expedited',     expect: '簡易審查條件' },
      { ph: 'irb0021_not_meets_expedited', expect: '不符合' },
      { ph: 'irb0021_meets_exempt',        expect: '免予' },
      { ph: 'irb0021_not_meets_exempt',    expect: '不符合' },
    ],
  },
  {
    label: '多中心類別',
    start: '多中心類別',
    end: '研究對象/樣本型態概述',
    entries: [
      { ph: 'irb0021_multicenter_yes',      expect: '是' },
      { ph: 'irb0021_multicenter_na',       expect: '不適用' },
      { ph: 'irb0021_multicenter_domestic', expect: '本國多中心' },
      { ph: 'irb0021_multicenter_intl',     expect: '多國多中心' },
    ],
  },
  {
    label: '是否招募研究對象',
    start: '是否招募研究對象',
    end: '研究對象為下列哪一族群',
    entries: [
      { ph: 'irb0021_recruit_yes', expect: '退出機制' },
      { ph: 'irb0021_recruit_no',  expect: '' },
    ],
  },
  {
    label: '研究對象族群',
    start: '研究對象為下列哪一族群',
    end: '研究對象名單取得方式',
    entries: [
      { ph: 'irb0021_pop_adult',      expect: '一般成人' },
      { ph: 'irb0021_pop_adolescent', expect: '青少年' },
      { ph: 'irb0021_pop_child',      expect: '兒童' },
      { ph: 'irb0021_pop_patient',    expect: '特定病人' },
      { ph: 'irb0021_pop_indigenous', expect: '少數民族' },
      { ph: 'irb0021_pop_pregnant',   expect: '孕婦' },
      { ph: 'irb0021_pop_disability', expect: '殘障' },
      { ph: 'irb0021_pop_prisoner',   expect: '受刑人' },
      { ph: 'irb0021_pop_cdc_staff',  expect: '本署人員' },
      { ph: 'irb0021_pop_other',      expect: '其他' },
    ],
  },
  {
    label: '名單取得方式',
    start: '研究對象名單取得方式',
    end: '請說明主持人與研究對象之關係',
    entries: [
      { ph: 'irb0021_roster_public',           expect: '公開招募' },
      { ph: 'irb0021_roster_sampling',         expect: '系統性抽樣' },
      { ph: 'irb0021_roster_existing_db',      expect: '既有資訊系統' },
      { ph: 'irb0021_roster_existing_project', expect: '既有計畫' },
      { ph: 'irb0021_roster_other',            expect: '其他' },
    ],
  },
  {
    label: '與研究對象之關係',
    start: '請說明主持人與研究對象之關係',
    end: '是否有對照組',
    entries: [
      { ph: 'irb0021_rel_researcher', expect: '研究者' },
      { ph: 'irb0021_rel_medical',    expect: '醫療人員' },
      { ph: 'irb0021_rel_teacher',    expect: '老師' },
      { ph: 'irb0021_rel_employer',   expect: '雇主' },
      { ph: 'irb0021_rel_friend',     expect: '朋友' },
      { ph: 'irb0021_rel_cdc_staff',  expect: '本署人員' },
      { ph: 'irb0021_rel_other',      expect: '其它' },
    ],
  },
  {
    label: '對照組',
    start: '是否有對照組',
    end: '是否有使用檢體',
    entries: [
      { ph: 'irb0021_control_yes', expect: '' }, // 主問「是」
      { ph: 'irb0021_control_case', expect: '個案病例對照' },
      { ph: 'irb0021_control_placebo', expect: '安慰劑' },
      { ph: 'irb0021_control_other', expect: '其它' },
      { ph: 'irb0021_control_consent_yes', expect: '是' },
      { ph: 'irb0021_control_consent_no', expect: '否' },
      { ph: 'irb0021_control_no', expect: '' },  // 主問「否」
    ],
  },
  {
    label: '是否使用檢體',
    start: '是否有使用檢體',
    end: '是否有使用資料',
    entries: [
      { ph: 'irb0021_specimen_yes',          expect: '' },
      { ph: 'irb0021_specimen_no',           expect: '' },
      { ph: 'irb0021_specimen_new_no',       expect: '' },
      { ph: 'irb0021_specimen_new_yes',      expect: '' },
      { ph: 'irb0021_specimen_existing_no',  expect: '' },
      { ph: 'irb0021_specimen_existing_yes', expect: '' },
    ],
  },
  {
    label: '是否使用資料',
    start: '是否有使用資料',
    end: '研究資料是否去識別化',
    entries: [
      { ph: 'irb0021_data_yes',          expect: '' },
      { ph: 'irb0021_data_no',           expect: '' },
      { ph: 'irb0021_data_new_no',       expect: '' },
      { ph: 'irb0021_data_new_yes',      expect: '' },
      { ph: 'irb0021_data_existing_no',  expect: '' },
      { ph: 'irb0021_data_existing_yes', expect: '' },
    ],
  },
  {
    label: '去識別化',
    start: '研究資料是否去識別化',
    end: '是否涉及與其他資料庫連結',
    entries: [
      { ph: 'irb0021_deid_no',  expect: '' },
      { ph: 'irb0021_deid_yes', expect: '請說明進行去' },
    ],
  },
  {
    label: '資料庫連結',
    start: '是否涉及與其他資料庫連結',
    end: '何人會要求研究對象參與',
    entries: [
      { ph: 'irb0021_crosslink_no',  expect: '' },
      { ph: 'irb0021_crosslink_yes', expect: '資料庫名稱' },
    ],
  },
  {
    label: '知情同意',
    start: '本計畫是否設計使用研究對象說明同意書',
    end: '研究對象說明暨同意書將從何處取得',
    entries: [
      { ph: 'irb0021_consent_provide',         expect: '請提供' },
      { ph: 'irb0021_consent_waive_signature', expect: '免除簽署' },
      { ph: 'irb0021_consent_proof_datetime', expect: '簽署日期' },
      { ph: 'irb0021_consent_proof_witness',  expect: '見證人' },
      { ph: 'irb0021_consent_proof_record',   expect: '研究團隊記錄' },
      { ph: 'irb0021_consent_proof_other',    expect: '其他' },
      { ph: 'irb0021_consent_waive_full',      expect: '免除知情同意' },
    ],
  },
  {
    label: '同意書取得來源',
    start: '研究對象說明暨同意書將從何處取得',
    end: '使用何種方法確保研究對象資料之機密性及隱私保護',
    entries: [
      { ph: 'irb0021_consent_source_subject',              expect: '研究對象' },
      { ph: 'irb0021_consent_source_parent',               expect: '父母' },
      { ph: 'irb0021_consent_source_guardian',             expect: '監護人' },
      { ph: 'irb0021_consent_source_authorized_person',    expect: '委任人' },
      { ph: 'irb0021_consent_source_legal_representative', expect: '法定代理人' },
      { ph: 'irb0021_consent_source_other',                expect: '其它' },
    ],
  },
  {
    label: '是否進行追蹤',
    start: '是否進行追蹤',
    end: '本計畫進行風險評估',
    entries: [
      { ph: 'irb0021_followup_yes', expect: '追蹤期間' },
      { ph: 'irb0021_followup_no',  expect: '' },
    ],
  },
  {
    label: 'DSMP',
    start: '本計畫進行風險評估',
    end: null, // 文件最後一個區塊，掃到結尾
    entries: [
      { ph: 'irb0021_dsmp_yes', expect: 'DSMP' },
      { ph: 'irb0021_dsmp_no',  expect: '' },
    ],
  },
];

const totalBoxes = BOX_BLOCKS.reduce((n, b) => n + b.entries.filter((e) => e.ph !== null).length, 0);
for (const block of BOX_BLOCKS) {
  xml = replaceBoxesInRange(xml, block.label, block.start, block.end, block.entries);
}
console.log(`  ✓ (B) 後半段勾選格注入（${totalBoxes} 格接 placeholder、其餘保留靜態）`);
xml = injectMulticenterTableRows(xml);

// ===== (C) 隱私保護三段 → 注入使用者自填文字（{privacy_during/after/withdrawal}）=====
// 大題括號內的指引（「範例文字僅供參考…」）在範本被拆成很多 run、無法穩定 replace，保留原樣；
// 反正三段範例已清空、改吃使用者填的文字，這段指引只是叫使用者依實際情形填寫，留著不衝突。
xml = injectPrivacyExamples(xml, '研究中', '使用何種方法確保研究對象資料之機密性及隱私保護', '研究結束後參與者之隱私保護', '{privacy_during}');
xml = injectPrivacyExamples(xml, '研究結束後', '研究結束後參與者之隱私保護', '中途退出者之隱私保護', '{privacy_after}');
xml = injectPrivacyExamples(xml, '中途退出', '中途退出者之隱私保護', '是否進行追蹤', '{privacy_withdrawal}');
console.log('  ✓ (C) 隱私保護三段注入 {privacy_*}');

// ===== (D) 自由文字填寫格 → 注入使用者自填文字 =====
// 第 3 題「研究類別」中「檢體採集／防疫用驗餘檢體」後方的「(請述明檢體種類)」底線格。
//   label 後第一個底線單空格即填寫格（其後才是底線提示「(請述明檢體種類)」，含字不會被 \s+ 誤命中）。
//   底線 rPr 在 run 上、不動，注入值一樣保有底線。先用「研究類別」把搜尋起點推到這一區再找 label。
xml = injectBlankAfterTextFrom(xml, '研究類別', '檢體採集', '{irb0021_cat_specimen_detail}', '檢體採集種類');
xml = injectBlankAfterTextFrom(xml, '研究類別', '餘檢體', '{irb0021_cat_residual_detail}', '防疫驗餘檢體種類');
xml = injectBlankAfterLabel(xml, '請說明招募方式及退出機制：', '{recruit_method_text}', '招募方式');
xml = injectBlankAfterLabel(xml, '研究對象估計人數：', '{subject_count}', '估計人數');
xml = injectBlankAfterTextFrom(
  xml,
  '研究對象為下列哪一族群',
  '特定病人，疾病名稱：',
  '{subject_patient_disease_name}',
  '特定病人疾病名稱',
);
xml = injectBlankAfterTextFrom(
  xml,
  '研究對象為下列哪一族群',
  '人員，理由',
  '{subject_cdc_staff_reason}',
  '本署人員理由',
);
xml = injectBlankAfterTextFrom(
  xml,
  '研究對象為下列哪一族群',
  '其他：',
  '{subject_population_other_detail}',
  '研究對象族群其他說明',
);
xml = injectBlankAfterTextFrom(
  xml,
  '研究對象名單取得方式',
  '資訊系統或資料庫名稱：',
  '{subject_roster_existing_db_name}',
  '名單來源資料庫名稱',
);
xml = injectBlankAfterTextFrom(
  xml,
  '研究對象名單取得方式',
  '既有計畫的研究對象名單：',
  '{subject_roster_existing_project_name}',
  '名單來源既有計畫',
);
xml = injectBlankAfterTextFrom(
  xml,
  '既有計畫的研究對象名單',
  '其他：',
  '{subject_roster_other_detail}',
  '名單來源其他說明',
);
xml = injectBlankAfterLabelFrom(
  xml,
  '請說明主持人與研究對象之關係',
  '其它，請說明：',
  '{subject_relationship_other_detail}',
  '研究對象關係其他說明',
);
// 第 11 題「□ 是，資料庫名稱：____」——空白與 label 同 run，且「是，資料庫名稱：」字串獨有
//   （另一處「資訊系統或資料庫名稱：」前綴不同，不會誤中），故用 inline 版注入 {cross_link_db_name}。
//   此 key 與 DOC-8 資料庫使用申請單共用（docgen database.ts 帶值；cross_link＝否時為空字串）。
xml = injectInlineBlankAfter(xml, '是，資料庫名稱：', '{cross_link_db_name}', '資料庫連結名稱');
// 第 12 題「何人會要求研究對象參與研究，或向研究對象解釋？請說明：____」——「請說明：」全文重複多次，
//   先用題目文字定位再找它自己的空白格，注入 {subject_explainer}。
xml = injectBlankAfterLabelFrom(xml, '何人會要求研究對象參與', '請說明：', '{subject_explainer}', '何人解釋');
// 對照組 A. 類別選「其它」時的說明欄。題目前面另有多個「其它，請說明」，先用「是否有對照組」定位。
xml = injectBlankAfterLabelFrom(
  xml,
  '是否有對照組',
  '其它，請說明：',
  '{control_group_other_detail}',
  '對照組其他類別',
);
xml = injectBlankAfterTextFrom(
  xml,
  '是否為新採集檢體',
  '，請說明：',
  '{specimen_new_detail}',
  '新採集檢體說明',
);
xml = injectNextParagraphAfterTextFrom(
  xml,
  '是否使用已採集之既存檢體',
  '，請說明：',
  '{specimen_existing_detail}',
  '既存檢體說明',
);
xml = injectNextParagraphAfterTextFrom(
  xml,
  '是否為新蒐集資料',
  '，請說明資料來源及蒐集資料範圍：',
  '{data_new_detail}',
  '新蒐集資料說明',
);
xml = injectNextParagraphAfterTextFrom(
  xml,
  '是否使用既有資料',
  '，請說明資料來源及使用欄位：',
  '{data_existing_detail}',
  '既有資料說明',
);
xml = injectAtParagraphEndAfterText(
  xml,
  '請說明進行去識別化/去連結之程序',
  '{data_deidentification_detail}',
  '去識別化程序說明',
);
xml = injectBlankAfterTextFrom(
  xml,
  '免除簽署但須告知',
  '免除簽署但須告知，請說明',
  '{waive_signature_reason}',
  '免除簽署理由',
);
xml = injectBlankAfterTextFrom(
  xml,
  '如何證明知情同意有落實執行',
  '其他，請',
  '{consent_proof_other_detail}',
  '知情同意其他證明方式',
);
xml = injectBlankAfterTextFrom(
  xml,
  '研究對象說明暨同意書將從何處取得',
  '其它，請說明',
  '{consent_source_other_detail}',
  '同意書其他取得來源',
);
xml = injectAtParagraphEndAfterText(
  xml,
  '研究對象說明暨同意書將從何處取得（勾選適用者）：',
  '{consent_source_na}',
  '同意書取得來源不適用',
);
xml = injectBlankAfterTextFrom(
  xml,
  '免除知情同意',
  '免除知情同意，請說明',
  '{waive_consent_reason}',
  '免除知情同意理由',
);
xml = injectBlankAfterTextFrom(
  xml,
  '是否進行追蹤',
  '是，追蹤期間：',
  '{followup_period}',
  '追蹤期間',
);
console.log('  ✓ (D) 自由文字格注入（招募/族群/名單/關係/對照組/檢體/資料/知情同意/追蹤）');

// ===== (E) 主持人簽章欄：嵌入簽名圖 =====
// 「主持人簽章：」在範本中拆成「主持」+「人簽章：」兩個 run，錨定後者。
// 單位主管欄走紙本核章流程，刻意不注入任何標籤。
xml = injectSigAfterRun(xml, '人簽章：</w:t>', 'pi');
const managerSignatureIndex = xml.indexOf('單位主管簽章：');
if (managerSignatureIndex === -1) {
  throw new Error('DOC-12 找不到「單位主管簽章」欄（範本可能改版）');
}
if (xml.slice(managerSignatureIndex, managerSignatureIndex + 400).includes('{')) {
  throw new Error('DOC-12 單位主管簽章欄被誤注入標籤，必須留白');
}
console.log('  ✓ (E) 主持人簽章欄簽名注入（單位主管欄保持留白）');

// 註：後半段部分題目已接「主選項勾選」，但其附帶說明文字仍保留空白，由使用者在 Word 手填。
//     詳細盤點見檔尾進度註記。日後要自動帶時，需先補 FormData / Step4 欄位與 docgen mapping，
//     再於此注入 placeholder；若已有可重用資料（例如 data_source），則只需確認語意吻合後接入。

saveDoc(zip, xml, OUT);

// ===== 進度註記（Phase 2 已接 / 仍保留靜態的格）=====
// ✅ 已接 placeholder（docgen prepareIrb002_1Data 填 ■/□，見 src/utils/docgen.ts）：
//    研究類別 8 格、符合簡審/免審條件 4 格、多中心 4 格、招募 2 格、族群 10 格、名單取得 5 格、
//    與研究對象關係 7 格、對照組主問/類別/專用同意書 7 格、檢體 6 格、資料 6 格、去識別化 2 格、
//    資料庫連結 2 格、知情同意主問 3 格＋落實方式 4 格、同意書取得來源 6 格、
//    追蹤 2 格、DSMP 2 格 = 共 80 格 → {irb0021_*}。
//    隱私三段 → {privacy_during/after/withdrawal}（與 DOC-5 共用同一批欄位）。
// ✅ 已接的自由文字格（見 (D)）：
//    - 招募/研究對象：{recruit_method_text}、{subject_count}、{subject_explainer}。
//    - 族群附帶說明：{subject_patient_disease_name}、{subject_cdc_staff_reason}、{subject_population_other_detail}。
//    - 名單來源附帶說明：{subject_roster_existing_db_name}、{subject_roster_existing_project_name}、
//      {subject_roster_other_detail}。
//    - 關係/對照組：{subject_relationship_other_detail}、{control_group_other_detail}。
//    - 檢體/資料：{specimen_new_detail}、{specimen_existing_detail}、{data_new_detail}、{data_existing_detail}、
//      {data_deidentification_detail}。
//    - 知情同意/追蹤：{waive_signature_reason}、{waive_consent_reason}、{consent_source_na}、
//      {followup_period}。
//    - 資料庫連結名稱 {cross_link_db_name}（與 DOC-8 共用）。
// ⬜ 仍保留靜態手填（判斷性太強、不自動勾，對位表中以 N 佔位）：
// ⬜ 完全尚未注入的自由文字格：
//    - 研究對象／樣本型態概述（目前 data_source 雖已有 UI 與 docgen 值，但尚未注入此 DOC-12 欄位）。
