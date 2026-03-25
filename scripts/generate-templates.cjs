// ===== DOC-7 模板生成 =====
// 使用 docx-js 建立 .docx 檔案，內含 {placeholder} 標籤
// DOC-1~6 由 inject-placeholders.cjs 從原始 CDC 模板注入，不在此腳本處理

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, PageBreak,
} = require('docx');

const OUT = path.join(__dirname, '..', 'public', 'templates');
fs.mkdirSync(OUT, { recursive: true });

// ===== 共用樣式 =====
const FONT = '標楷體';
const A4 = { width: 11906, height: 16838 }; // A4 in DXA

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size || 28, ...opts });
}

function p(children, opts = {}) {
  if (typeof children === 'string') children = [t(children)];
  return new Paragraph({ children, ...opts });
}

async function save(doc, filename) {
  const buffer = await Packer.toBuffer(doc);
  const fp = path.join(OUT, filename);
  fs.writeFileSync(fp, buffer);
  console.log(`✅ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ========================================
// DOC-7: 研究計畫簽呈（含公文系統操作說明）
// ========================================
async function genDOC7() {
  const indent = { left: 480 };
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 28 } } },
    },
    sections: [
      // ---- 第一頁：簽呈內容 ----
      {
        properties: {
          page: { size: A4, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children: [
          p([t('簽', { bold: true, size: 36 })], { alignment: AlignmentType.CENTER, spacing: { after: 300 } }),
          p([t('主旨：', { bold: true }), t('{responsible_unit}擬執行{project_year}年度無經費需求署內自行研究計畫一件，簽請鑒核。')], { spacing: { after: 300 } }),
          p([t('說明：', { bold: true }), t('本研究計畫名稱為「{project_title_zh}」，研究計畫書內容詳如附件。')], { spacing: { after: 300 } }),
          p([t('擬辦：', { bold: true }), t('奉核後據以辦理相關後續事宜。')], {}),
        ],
      },
      // ---- 第二頁：公文系統操作說明 ----
      {
        properties: {
          page: { size: A4, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        children: [
          p([t('公文系統操作說明', { bold: true, size: 36 })], { alignment: AlignmentType.CENTER, spacing: { after: 400 } }),

          p([t('步驟 1', { bold: true }), t('　進入公文系統，點選「公文夾」。')], { spacing: { after: 200 } }),
          p([t('步驟 2', { bold: true }), t('　在右方點擊「←」兩次，直到看見「創稿」選項。')], { spacing: { after: 200 } }),
          p([t('步驟 3', { bold: true }), t('　點選「簽（稿）」。')], { spacing: { after: 200 } }),
          p([t('步驟 4', { bold: true }), t('　點選左方「尚未取號」的位置，再點選「創稿號」以取得公文號。')], { spacing: { after: 200 } }),
          p([t('步驟 5', { bold: true }), t('　選取檔號，系統會跳出查詢視窗，依序選擇「組室」及「業務」後，選擇「其他」。')], { spacing: { after: 200 } }),
          p([t('步驟 6', { bold: true }), t('　記得填寫日期。')], { spacing: { after: 200 } }),
          p([t('步驟 7', { bold: true }), t('　將第一頁的簽呈內容（主旨、說明、擬辦）填入公文系統對應欄位。')], { spacing: { after: 200 } }),
          p([t('步驟 8', { bold: true }), t('　點選附件管理 → 新增 → 將研究計畫書上傳（即 DOC-4 署內研究計畫書）。')], { spacing: { after: 200 } }),
          p([t('步驟 9', { bold: true }), t('　設定會辦單位。')], { spacing: { after: 200 } }),
          p([t('步驟 10', { bold: true }), t('　點選「設定」，檢查預排流程是否正確。')], { spacing: { after: 200 } }),
          p([t('步驟 11', { bold: true }), t('　蓋章、儲存，確認無誤後送出。')], { spacing: { after: 400 } }),

          p([t('※ 提醒：', { bold: true }), t('公文主旨、說明、擬辦的內容已在第一頁自動帶入，請直接複製貼上即可。')], { spacing: { after: 100 } }),
        ],
      },
    ],
  });
  await save(doc, 'DOC-7.docx');
}

// ========================================
// 主程式
// ========================================
async function main() {
  console.log('🏗️  Generating DOC-7 template...\n');
  await genDOC7();
  console.log('\n✅ DOC-7 generated in public/templates/');
  console.log('ℹ️  DOC-1~6 由 inject-placeholders.cjs 從原始 CDC 模板注入');
}

main().catch(console.error);
