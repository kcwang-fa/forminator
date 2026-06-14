// ===== IRB-012 免審申請表（DOC-5）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-5.docx
// 來源：../source-templates/IRB-012 免審申請表.docx
//
// ⚠️  DOC-5 = IRB-012 免審申請表
// 執行：node scripts/inject-doc5.cjs  或  npm run inject-doc5

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/IRB-012 免審申請表.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-5.docx');

// 注入「新建 run」用的字型設定：中文標楷體（DFKai-SB）、英數 Times New Roman。
// 為什麼要這個？insertInNextCell / injectSectionCell / inline 姓名注入都是新建一個
// 不帶 rPr 的 <w:r>，Word 找不到字型就 fallback 到範本 docDefaults（新細明體 PMingLiU），
// 注入的中文就會跟周圍標楷體不一致（變細細的新細明體）。明示 rPr 即可釘住標楷體。
// w:hint="eastAsia" 告訴 Word「這段照 eastAsia 字型走」；英數沿用 ascii/hAnsi 的 Times New Roman。
const KAI_RPR = '<w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="DFKai-SB" w:hAnsi="Times New Roman" w:cs="Times New Roman" w:hint="eastAsia"/></w:rPr>';

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
  const r = xml.replace(pattern, `$1<w:r>${KAI_RPR}<w:t>${placeholder}</w:t></w:r>$2`);
  return r !== xml ? r : replaceText(xml, labelText, labelText + placeholder);
}
// 在指定「區段」（如「計畫主持人」「聯絡人」）之後，往後找第一個 label 標籤，
// 把它後面那一格（值欄）填入 placeholder。
// 為什麼要先錨定區段？因為「職稱」「聯絡電話」「電子信箱」在同一張表會出現多次
// （主持人/協同主持人/聯絡人各一份），純用 insertInNextCell 只會一直打到第一個（主持人）。
// labelEnd = label「最後一個 text run」的文字：多數 label 是單一 run，直接傳完整字串即可；
// 但「電子信箱」在主持人區被拆成「電子」+「信箱」兩個 run，那一格要傳 '信箱'（用結尾 run 當錨點）。
function injectSectionCell(xml, sectionText, labelEnd, placeholder) {
  const escS = sectionText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escL = labelEnd.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `(${escS}[\\s\\S]*?${escL}<\\/w:t><\\/w:r><\\/w:p><\\/w:tc><w:tc><w:tcPr>[\\s\\S]*?<\\/w:tcPr><w:p[^>]*>)([\\s\\S]*?)(<\\/w:p>)`
  );
  return xml.replace(pattern, `$1<w:r>${KAI_RPR}<w:t>${placeholder}</w:t></w:r>$3`);
}

// 把「某個 placeholder 所在段落」的對齊從兩端對齊（both）改成靠左（left）。
// why：IRB-012 範本的值欄段落 pPr 預設是 <w:jc w:val="both"/>，長段落本文（如研究計畫目的）
//      兩端對齊會把每行字距硬拉開、最後一行尤其鬆散難看。
// how：placeholder 是注入在段落「結尾」，而 jc 在段落「開頭」的 pPr 裡，
//      所以「placeholder 往前找最近的一個 both」必定就是同段落的那個 jc，改它最精準、
//      不會誤傷表格裡其他段落的 both。傳入前該 placeholder 必須已注入到 xml。
function alignPlaceholderLeft(xml, placeholder) {
  const idx = xml.indexOf(placeholder);
  if (idx === -1) { console.warn(`⚠️  alignPlaceholderLeft 找不到 ${placeholder}`); return xml; }
  const both = '<w:jc w:val="both"/>';
  const jcIdx = xml.lastIndexOf(both, idx);
  if (jcIdx === -1) return xml; // 該段本來就沒有顯式 both（已是其他對齊），不動
  return xml.substring(0, jcIdx) + '<w:jc w:val="left"/>' + xml.substring(jcIdx + both.length);
}

// 第 2 題「預期研究期限」：__年 __月(請填寫送審後的日期) 至 __年__月
// why：這欄原本完全沒注入，送審後一片空白（Vickie 回報）。
// 範本值欄裡 4 個「底線空格」run（起始年/起始月/結束年/結束月）夾在「年」「月…至」等
// 固定文字 run 之間，順序固定。底線空格 run 是這格唯一「整段都是空白」的 <w:t>，
// 所以可安全地「只在這一格範圍內」依序把 4 個空白 run 的內文換成 placeholder。
// how：先把「預期研究期限」標籤後面那一格（值欄 <w:tc>…</w:tc>）切出來，
//      在這段內依序替換 4 個全空白 <w:t>，保留外層帶 <w:u> 的 run（填入值仍有底線）。
//      placeholders 對應 docgen 已備妥的「全程執行期間」民國年月（送審後～計畫結束）。
function injectPeriodBlanks(xml) {
  const anchor = '預期研究期限</w:t></w:r></w:p></w:tc>';
  const aIdx = xml.indexOf(anchor);
  if (aIdx === -1) { console.warn('⚠️  injectPeriodBlanks 找不到「預期研究期限」'); return xml; }
  const cellStart = aIdx + anchor.length;                       // 值欄 <w:tc> 開頭
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
// searchFrom：錨點從這個位置開始找（預設從頭），用於「先錨定區域、再找區域內的 run」。
function injectSigAfterRun(xml, anchorText, prefix, searchFrom = 0) {
  const anchorIdx = xml.indexOf(anchorText, searchFrom);
  if (anchorIdx === -1) throw new Error(`簽名欄錨點「${anchorText}」不存在（範本可能改版）`);
  const runEnd = xml.indexOf('</w:r>', anchorIdx);
  if (runEnd === -1) throw new Error(`簽名欄錨點「${anchorText}」後找不到 run 結尾`);
  const insertAt = runEnd + '</w:r>'.length;
  let out = xml.slice(0, insertAt) + sigRuns(prefix) + xml.slice(insertAt);
  // 簽章欄段落若鎖死行高（lineRule="exact"），Word 會把高於行高的簽名圖「裁掉」。
  // 改成 atLeast：沒簽名時外觀不變（單行文字沒超過原行高），有簽名時行高自動撐開。
  const paraStart = out.lastIndexOf('<w:p ', anchorIdx);
  if (paraStart !== -1) {
    const head = out.slice(paraStart, anchorIdx);
    if (head.includes('w:lineRule="exact"')) {
      out = out.slice(0, paraStart) + head.replace('w:lineRule="exact"', 'w:lineRule="atLeast"') + out.slice(anchorIdx);
    }
  }
  return out;
}

console.log('📄 Processing DOC-5: IRB-012 免審申請表');
let { zip, xml } = readDocXml(SRC);

// 計畫名稱中/英文
xml = insertInNextCell(xml, '中文', '{project_title_zh}');
xml = insertInNextCell(xml, '英文', '{project_title_en}');

// 計畫主持人（中文姓名）
// ⚠️ 模板裡「中文」與「姓名」是兩個獨立的 text run，連起來的「中文姓名」字串並不存在，
//    所以不能用 insertInNextCell('中文姓名',...)——它找不到連續字串，placeholder 會完全沒注入
//    （這正是先前 PI 姓名帶不進 DOC-5 的根因）。
// 改用與「協同主持人」「聯絡人」相同的跨 run regex：從「計畫主持人」往後找第一個「姓名」
//    （即中文姓名那一格），把它後面那一格（值欄）填入 placeholder。
xml = xml.replace(
  /(計畫主持人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  `$1<w:r>${KAI_RPR}<w:t>{pi_name_zh}</w:t></w:r>$3`);

// 協同主持人
xml = xml.replace(
  /(協同主持人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  `$1<w:r>${KAI_RPR}<w:t>{co_pi_names}</w:t></w:r>$3`);

// 聯絡人
xml = xml.replace(
  /(聯絡人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  `$1<w:r>${KAI_RPR}<w:t>{contact_name_zh}</w:t></w:r>$3`);

// 計畫主持人 其餘欄位：職稱 / 服務單位 / 聯絡電話 / 電子信箱
// （都用「計畫主持人」當區段錨點，往後找第一個對應 label，填入下一格。
//  ⚠️ 主持人區的「電子信箱」是 split run「電子」+「信箱」，故 labelEnd 傳 '信箱'。）
xml = injectSectionCell(xml, '計畫主持人', '職稱',     '{pi_title}');
xml = injectSectionCell(xml, '計畫主持人', '服務單位', '{pi_unit}');
xml = injectSectionCell(xml, '計畫主持人', '聯絡電話', '{pi_phone}');
xml = injectSectionCell(xml, '計畫主持人', '信箱',     '{pi_email}');

// 協同主持人 其餘欄位：職稱 / 服務單位（多位協同主持人由 docgen 用「、」合併成單一字串）
xml = injectSectionCell(xml, '協同主持人', '職稱',     '{co_pi_titles}');
xml = injectSectionCell(xml, '協同主持人', '服務單位', '{co_pi_units}');

// 聯絡人 其餘欄位：職稱 / 聯絡電話 / 電子信箱（聯絡人區無「服務單位」欄）
// （聯絡人區的「電子信箱」是單一 run，labelEnd 直接傳完整字串。）
xml = injectSectionCell(xml, '聯絡人', '職稱',     '{contact_title}');
xml = injectSectionCell(xml, '聯絡人', '聯絡電話', '{contact_phone}');
xml = injectSectionCell(xml, '聯絡人', '電子信箱', '{contact_email}');

// 預期研究期限（第 2 題）：全程執行期間民國年月填入 4 個底線空格
xml = injectPeriodBlanks(xml);

// 研究計畫目的：用 {purpose_brief}（只要純研究主旨）。
// ⚠️ 不可用 {purpose}——那是 DOC-2 用的合併值（多年期含分年目的），DOC-5 免審申請表不需要分年目的。
xml = insertInNextCell(xml, '研究計畫目的', '{purpose_brief}');
// 研究計畫目的是長段落本文，改靠左對齊（範本原本是兩端對齊，最後一行字距會被拉鬆）
xml = alignPlaceholderLeft(xml, '{purpose_brief}');

// 免審理由
xml = replaceText(xml,
  '本研究為次級資料研究，資料皆已去識別化。',
  '{exempt_reason}');

// 資料來源說明
xml = replaceText(xml,
  '本研究使用疾管署防疫資料庫，依據「衛生福利部疾病管制署防疫資料庫員工研究計畫使用申請作業說明」提出申請，並檢附本IRB審查通過證明文件後，依序完成資料權責單位、資訊室及企劃組審核，經一層核定後取得去識別化資料。',
  '{data_source}');

// 研究對象納入及排除條件
// 「納入條件：」「排除條件：」各自是獨立 text run，placeholder 直接 inline 接在冒號後，
// 與 {exempt_reason}/{data_source} 同樣用 replaceText 注入。
xml = replaceText(xml, '納入條件：', '納入條件：{inclusion_criteria}');
xml = replaceText(xml, '排除條件：', '排除條件：{exclusion_criteria}');

// 隱私保護三段（IRB-012 第 9 題）：改吃表單 privacy_during / privacy_after / privacy_withdrawal。
// 模板每段為「粗體標題 +（1~2 個）內文段」，每個內文段是單一 text run（與 data_source 同性質）。
// 作法：把第一個內文段換成 placeholder，其餘內文段清空（保留 (1)(2)(3) 粗體標題）。
// placeholder 只是 token，實際值由 docxtemplater 在產生 ZIP 時填入並做 XML escape，故此處不需處理跳脱。

// (1) 研究中參與者之隱私保護
xml = replaceText(xml,
  '本研究所使用之通報資料依據「衛生福利部疾病管制署防疫資料庫員工研究計畫使用申請作業說明」，由疾管署資訊室執行資料擷取及去識別化作業後始交付申請者，所有可辨識個人身份之欄位均已於資料交付前完成去識別化處理，以代碼取代個人可辨識資訊，研究人員無從回溯至特定個人。',
  '{privacy_during}');
xml = replaceText(xml,
  '去識別化資料存放於疾管署署內辦公場域之個人公務電腦，設定開機及檔案存取密碼，並依疾管署資訊安全管理系統（ISMS）規定進行加密保存，資料存取權限嚴格限於計畫核定之研究人員，不得攜出至署外，亦不得提供予計畫核定人員以外之他人使用。',
  '');

// (2) 研究結束後參與者之隱私保護
xml = replaceText(xml,
  '研究完成對外發表時，所有結果均以群體層次之統計數據呈現，報告中絕不揭露任何足以識別個人之資訊，以確保研究對象隱私權益獲得充分保障。發表前並依疾管署「員工著作公開發表作業原則」辦理審核程序。',
  '{privacy_after}');
xml = replaceText(xml,
  '研究資料依疾管署規定，於分析期限屆至後保留三年，保留期間持續依資安規定加密妥善保存於疾管署署內辦公場域之個人公務電腦。保留期限屆至時，申請者將依疾管署資安規定完成資料銷毀。',
  '');

// (3) 研究中途退出者之隱私保護
xml = replaceText(xml,
  '本研究為使用既有行政資料庫之次級資料分析，研究進行前資料已完成去識別化處理，技術上無法對應回特定個人，亦無研究對象主動中途退出之情形。由於資料已不具個人識別性，即便特定案例嗣後要求退出，其資料之隱私仍可獲得充分保護。',
  '{privacy_withdrawal}');

// ===== 主持人簽章欄：嵌入簽名圖 =====
// 範本的「主持人簽章：」是 split run（「主持」+「人簽章：」），錨定結尾 run「人簽章：」
// （全文件唯一）。label 與簽名空間同一格，圖直接接在 label 後。
xml = injectSigAfterRun(xml, '人簽章：</w:t>', 'pi');

// 健檢：「單位主管簽章」走公文核章流程、必須留白手簽，
// 後方 400 字元內（該 cell 範圍）不得出現任何注入標籤。
const mgrIdx = xml.indexOf('單位主管簽章：');
if (mgrIdx === -1) throw new Error('DOC-5 找不到「單位主管簽章」欄（範本可能改版）');
if (xml.slice(mgrIdx, mgrIdx + 400).includes('{')) {
  throw new Error('DOC-5 單位主管簽章欄被誤注入標籤，必須留白');
}
console.log('  ✓ 主持人簽章欄簽名注入（單位主管欄保持留白）');

console.log('  ✓ IRB-012 欄位注入');
saveDoc(zip, xml, OUT);
