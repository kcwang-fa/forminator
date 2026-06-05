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
  const r = xml.replace(pattern, `$1<w:r><w:t>${placeholder}</w:t></w:r>$2`);
  return r !== xml ? r : replaceText(xml, labelText, labelText + placeholder);
}

console.log('📄 Processing DOC-5: IRB-012 免審申請表');
let { zip, xml } = readDocXml(SRC);

// 計畫名稱中/英文
xml = insertInNextCell(xml, '中文', '{project_title_zh}');
xml = insertInNextCell(xml, '英文', '{project_title_en}');

// 計畫主持人
xml = insertInNextCell(xml, '中文姓名', '{pi_name_zh}');

// 協同主持人
xml = xml.replace(
  /(協同主持人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  '$1<w:r><w:t>{co_pi_names}</w:t></w:r>$3');

// 聯絡人
xml = xml.replace(
  /(聯絡人[\s\S]*?姓名<\/w:t><\/w:r><\/w:p><\/w:tc><w:tc><w:tcPr>[\s\S]*?<\/w:tcPr><w:p[^>]*>)([\s\S]*?)(<\/w:p>)/,
  '$1<w:r><w:t>{contact_name_zh}</w:t></w:r>$3');

// 研究計畫目的
xml = insertInNextCell(xml, '研究計畫目的', '{purpose}');

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

console.log('  ✓ IRB-012 欄位注入');
saveDoc(zip, xml, OUT);
