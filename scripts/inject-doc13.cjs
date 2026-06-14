// ===== IRB-003 簡易審查案件申請表（DOC-13）placeholder 注入腳本 =====
// 輸出：public/templates/DOC-13.docx
// 來源：../source-templates/IRB-003 簡易審查案件申請表.docx
//
// ⚠️  DOC-13 = IRB-003 簡易審查案件申請表（簡審專用加填表）
//     依 IRB-001 流程圖：簡易審查除了必備文件外，加填 IRB-002-1（DOC-12）+ IRB-003（DOC-13）。
// 執行：node scripts/inject-doc13.cjs  或  npm run inject-doc13
//
// ── 這支腳本在做什麼？（新手導覽）──
// IRB-003 是一張「勾選清單」：研究計畫符合簡易審查條件者，自行勾選 A~I 分類底下的格子。
// 全表共 24 個空勾選格「□」，外加一個「請詳細說明：」的自由文字底線。
// 我們把這 24 個 □ 各換成一個 docxtemplater placeholder（例如 {irb003_d}），
// 之後 docgen 會依使用者選的簡審類別，把對應 placeholder 填成「■」(勾) 或「□」(不勾)。
//
// ── 為什麼這支特別單純？──
// ① IRB-003 本體沒有「計畫名稱 / 主持人」欄位（那些在 DOC-12 / 別份），所以不必處理跨 cell、
//    區段錨定那一套（對照 inject-doc5.cjs 免審表的複雜度）。
// ② 24 個 □ 在 word/document.xml 裡都是「乾淨的單一 run」<w:t>□</w:t>，而且 rPr 已是標楷體
//    （DFKai-SB）。我們只是「把既有 run 的文字內容從 □ 換成 {placeholder}」，run 與字型都不動，
//    所以這支腳本不需要像 DOC-2/4/5 那樣新建 run、也不需要 KAI_RPR。docgen 之後填的 ■/□
//    會直接沿用這個 run 原本的標楷體。
//
// ⚠️ 目前進度：本腳本（＝模板那一半）做好後，docgen 還沒接 {irb003_*} 的對應值，
//    且簡審要能完整生成還需要 DOC-12。在 docgen 接上之前，DOC-13 仍列在
//    src/data/defaults.ts 的 DOCS_WITHOUT_TEMPLATE，resolveActivePlan 會把它濾掉、不會去 fetch，
//    所以「模板有 placeholder、但沒人填值」不會造成執行期錯誤。

'use strict';
const fs   = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const SRC = path.join(__dirname, '../../source-templates/IRB-003 簡易審查案件申請表.docx');
const OUT = path.join(__dirname, '../public/templates/DOC-13.docx');

function readDocXml(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = new PizZip(buf);
  return { zip, xml: zip.file('word/document.xml').asText() };
}

function saveDoc(zip, xml, outPath) {
  zip.file('word/document.xml', xml);
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(outPath, buf);
  console.log(`✅ DOC-13.docx (${(buf.length / 1024).toFixed(1)} KB)`);
}

// ===== 24 個勾選格對照表 =====
// 依「文件閱讀順序」排列（A → B1~B8 → C1~C6 → D → E → F → G1~G3 → H → I1~I2），
// 與 word/document.xml 裡 24 個 <w:t>□</w:t> 出現的順序一一對應。
//   - ph     ：要注入的 placeholder 名稱（docgen 之後填 ■ / □）
//   - expect ：該勾選格「後方描述文字」的一段關鍵字，純粹拿來「驗證有沒有對錯位」用，
//              不參與比對定位。萬一哪天原始範本改版、項目順序變了，這個檢查會 warn 出來，
//              不會默默把 placeholder 注入到錯的格子。
const CHECKBOXES = [
  // A. 從手指/腳跟/耳朵採血或靜脈穿刺（單格）
  { ph: 'irb003_a',  expect: '自體重' },
  // B. 非侵入性方法採集研究用人體檢體（8 格）
  { ph: 'irb003_b1', expect: '不損傷外形' },
  { ph: 'irb003_b2', expect: '例行照護' },
  { ph: 'irb003_b3', expect: '排泄物和體外' },
  { ph: 'irb003_b4', expect: '非以套管取得唾液' },
  { ph: 'irb003_b5', expect: '一般洗牙' },
  { ph: 'irb003_b6', expect: '刮取或漱口' },
  { ph: 'irb003_b7', expect: '蒸氣吸入' },
  { ph: 'irb003_b8', expect: '其他非以穿刺' },
  // C. 非侵入性方法收集資料（6 格）
  { ph: 'irb003_c1', expect: '研究對象體表' },
  { ph: 'irb003_c2', expect: '測量體重或感覺' },
  { ph: 'irb003_c3', expect: '核磁共振' },
  { ph: 'irb003_c4', expect: '心電圖' },
  { ph: 'irb003_c5', expect: '適度運動' },
  { ph: 'irb003_c6', expect: '其他符合本款' },
  // D. 臨床常規治療/診斷之病歷（單格）
  { ph: 'irb003_d',  expect: '臨床常規治療或診斷之病歷' },
  // E. 以研究為目的蒐集之錄音/錄影/影像（單格）
  { ph: 'irb003_e',  expect: '錄音、錄影' },
  // F. 研究個人或群體特質或行為（單格）
  { ph: 'irb003_f',  expect: '個人或群體特質或行為' },
  // G. 已審查通過之計畫（3 格）
  { ph: 'irb003_g1', expect: '已不再收錄新個案' },
  { ph: 'irb003_g2', expect: '原訂計畫期間' },
  { ph: 'irb003_g3', expect: '接續前階段研究' },
  // H. 自合法生物資料庫取得之去連結/無法辨識資料（單格）
  { ph: 'irb003_h',  expect: '合法生物資料庫取得之去連結' },
  // I. 其他（2 格）
  { ph: 'irb003_i1', expect: '承接其他合法審查會' },
  { ph: 'irb003_i2', expect: '不符合以上' },
];

console.log('📄 Processing DOC-13: IRB-003 簡易審查案件申請表');
let { zip, xml } = readDocXml(SRC);

// ===== 注入 24 個勾選格 =====
// 用「全域 replace + 計數器」走訪所有 <w:t>□</w:t>：命中的第 N 個 □ 換成 CHECKBOXES[N] 的 placeholder。
// 為什麼可以靠「順序」對位？因為 word/document.xml 是按文件閱讀順序序列化的，
// 第 N 個出現的 □ 就是表單上第 N 個勾選格——這跟 CHECKBOXES 的排列方式一致。
// 同時用 expect 關鍵字做「對位健檢」：把該 □ 後方 400 字去掉標籤，檢查是否含預期描述文字。
let boxIdx = 0;
const mismatches = [];
xml = xml.replace(/<w:t([^>]*)>□<\/w:t>/g, (full, attrs, offset, str) => {
  const entry = CHECKBOXES[boxIdx];
  boxIdx += 1;
  if (!entry) return full; // 超出預期的 24 個，保險起見原樣不動

  // 對位健檢：去標籤後的後續文字應包含 expect（描述可能被拆成多個 run，去標籤後會接回連續字串）。
  // ⚠️ 相容表意字雷：這份範本部分中文用「CJK 相容表意文字」（例如「不」是 U+F967 而非一般的
  //    U+4E0D），看起來一模一樣但 codepoint 不同，直接 includes 會比對失敗。先 normalize('NFC')
  //    把相容字還原成一般字再比，兩邊都做才公平。（只影響這個健檢；真正的 □ 注入是靠符號＋順序定位，
  //    與描述文字無關，所以不受相容字影響。）
  const afterRaw = str.substring(offset + full.length, offset + full.length + 400);
  const afterText = afterRaw.replace(/<[^>]+>/g, '').normalize('NFC');
  if (!afterText.includes(entry.expect.normalize('NFC'))) {
    mismatches.push(`第 ${boxIdx - 1} 格（${entry.ph}）後方未找到「${entry.expect}」，可能對錯位`);
  }
  return `<w:t${attrs}>{${entry.ph}}</w:t>`;
});

if (boxIdx !== CHECKBOXES.length) {
  console.warn(`⚠️  預期 ${CHECKBOXES.length} 個勾選格，實際換到 ${boxIdx} 個（範本可能改版）`);
}
if (mismatches.length) {
  mismatches.forEach((msg) => console.warn('⚠️  對位健檢:', msg));
} else if (boxIdx === CHECKBOXES.length) {
  console.log(`  ✓ ${CHECKBOXES.length} 個勾選格全部對位正確`);
}

// ===== 注入「請詳細說明：」自由文字 =====
// 範本結構：「請詳細說明」run +「：」run +「一長串空白＋底線」run（<w:u w:val="single"/>）。
// 跟 DOC-4 的底線空白同款手法：錨定「請詳細說明」後第一個底線 run 的 <w:t>，把整段空白換成
// {irb003_other_detail}，保留底線樣式（docgen 之後填 I 類特殊情形的說明文字；預設空字串）。
// [\s\S]*? 非貪婪：確保抓到的是「請詳細說明」後緊接的第一個底線 run，不會誤命中別處底線。
const beforeDetail = xml;
xml = xml.replace(
  /(請詳細說明<\/w:t>[\s\S]*?<w:u w:val="single"\/>[\s\S]*?<\/w:rPr><w:t[^>]*>)\s+(<\/w:t>)/,
  '$1{irb003_other_detail}$2');
if (xml === beforeDetail) {
  console.warn('⚠️  找不到「請詳細說明」底線空白，{irb003_other_detail} 未注入');
} else {
  console.log('  ✓ 請詳細說明 自由文字注入');
}

// ===== 主持人簽章欄：嵌入簽名圖 =====
// 簽章欄注入「條件 section + 圖片標籤」三件組：{#pi_has_sig}{%pi_sig}{/pi_has_sig}
//   - 有簽名：docgen 的 image module 把 {%pi_sig} 換成簽名 PNG 圖
//   - 沒簽名：section 整段消失，簽章欄維持範本原樣，列印後仍可手簽
// ⚠️ 三個標籤必須拆成三個「獨立 run」：docxtemplater 展開 section 時，若 {%圖片} 與
//    section 標籤擠在同一個 <w:t>，圖片標籤會丟失 <w:t> 上下文而報
//    「Raw tag not in paragraph」（2026-06-11 實測）。
// 範本「主持人簽章：」是 split run（「主持」+「人簽章：」），錨定結尾 run「人簽章：」
// （全文件唯一——「單位主管簽章：」不含此子字串）。
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
  // 簽章欄段落鎖死行高（lineRule="exact"）會讓 Word 把高於行高的圖裁掉，改 atLeast
  const paraStart = out.lastIndexOf('<w:p ', anchorIdx);
  if (paraStart !== -1) {
    const head = out.slice(paraStart, anchorIdx);
    if (head.includes('w:lineRule="exact"')) {
      out = out.slice(0, paraStart) + head.replace('w:lineRule="exact"', 'w:lineRule="atLeast"') + out.slice(anchorIdx);
    }
  }
  return out;
}

xml = injectSigAfterRun(xml, '人簽章：</w:t>', 'pi');

// 健檢：「單位主管簽章」走核章流程必須留白，後方 400 字元內不得出現注入標籤
const mgrSigIdx = xml.indexOf('單位主管簽章：');
if (mgrSigIdx === -1) throw new Error('DOC-13 找不到「單位主管簽章」欄（範本可能改版）');
if (xml.slice(mgrSigIdx, mgrSigIdx + 400).includes('{')) {
  throw new Error('DOC-13 單位主管簽章欄被誤注入標籤，必須留白');
}
console.log('  ✓ 主持人簽章欄簽名注入（單位主管欄保持留白）');

// 註：頁首「IRB編號：」（審查會填）、「單位主管簽章」（核章欄）刻意不注入，保留範本原樣。

saveDoc(zip, xml, OUT);
