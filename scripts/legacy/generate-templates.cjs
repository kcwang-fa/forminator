// ===== DOC-7, DOC-8 模板生成 =====
// 使用 docx-js 建立 .docx 檔案，內含 {placeholder} 標籤
// DOC-1~6 由 inject-placeholders.cjs 從原始 CDC 模板注入，不在此腳本處理

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun,
  AlignmentType, PageBreak,
  Table, TableRow, TableCell, TableBorders, WidthType,
  BorderStyle, VerticalAlign,
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
  await save(doc, 'DOC-1.docx');
}

// ========================================
// DOC-3: IRB-002 計畫送件核對表
// ========================================
async function genDOC8() {
  const THIN = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };

  function cell(text, opts = {}) {
    return new TableCell({
      width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
      verticalAlign: VerticalAlign.CENTER,
      borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
      shading: opts.shading ? { fill: opts.shading } : undefined,
      children: [
        new Paragraph({
          alignment: opts.align || AlignmentType.LEFT,
          children: [new TextRun({ text, font: '標楷體', size: opts.size || 22, bold: opts.bold || false })],
          spacing: { before: 40, after: 40 },
        }),
      ],
    });
  }

  // 表頭列
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell('項次', { width: 600, bold: true, align: AlignmentType.CENTER, shading: 'D9D9D9' }),
      cell('表單', { width: 3200, bold: true, align: AlignmentType.CENTER, shading: 'D9D9D9' }),
      cell('表單編號', { width: 1200, bold: true, align: AlignmentType.CENTER, shading: 'D9D9D9' }),
      cell('備註', { width: 3200, bold: true, align: AlignmentType.CENTER, shading: 'D9D9D9' }),
      cell('備齊(V)', { width: 1200, bold: true, align: AlignmentType.CENTER, shading: 'D9D9D9' }),
    ],
  });

  const ITEMS = [
    { no: '1',  name: '人體研究計畫申請表',                           code: 'IRB-002-1', note: '請申請人與單位主管簽章',                                                    ph: '{irb002_check_1}' },
    { no: '2',  name: '簡易審查案件申請表',                           code: 'IRB-003',   note: '請申請人與單位主管簽章',                                                    ph: '{irb002_check_2}' },
    { no: '3',  name: '研究計畫書',                                   code: 'IRB-004',   note: '請另提供完整計畫書',                                                        ph: '{irb002_check_3}' },
    { no: '4',  name: '人體研究計畫免審申請表',                       code: 'IRB-012',   note: '請申請人與單位主管簽章',                                                    ph: '{irb002_check_4}' },
    { no: '5',  name: '研究對象說明暨同意書',                         code: 'IRB-005',   note: '請申請人簽章',                                                              ph: '{irb002_check_5}' },
    { no: '6',  name: '問卷或病歷記錄用紙',                           code: '',          note: '',                                                                          ph: '{irb002_check_6}' },
    { no: '7',  name: '主持人及協同研究人員之學經歷、著作及所受研究倫理相關訓練之背景資料', code: '', note: '研究倫理訓練時數證明：主持人：六年內9小時以上。研究相關人員：三年內4小時以上。', ph: '{irb002_check_7}' },
    { no: '8',  name: '前次人體研究審查相關資料\nIRB 編號：',         code: '',          note: '',                                                                          ph: '{irb002_check_8}' },
    { no: '9',  name: '多中心人體研究審查相關資料\nIRB 編號：',       code: '',          note: '請造冊依序列出',                                                            ph: '{irb002_check_9}' },
    { no: '10', name: '資料及安全性監測計畫 (DSMP)',                  code: 'IRB-014',   note: '請依計畫風險評估是否需建置',                                               ph: '{irb002_check_10}' },
    { no: '11', name: '其他（請說明）：',                             code: '',          note: '請造冊依序列出',                                                            ph: '{irb002_check_11}' },
    { no: '12', name: '電子檔1份：含上述所附申請文件',                code: '',          note: '以 e-mail 寄至審查會承辦人',                                               ph: '{irb002_check_12}' },
    { no: '13', name: '保密切結書',                                   code: 'IRB-018',   note: '請接觸個人資訊及資料存取之研究成員，均需繳交',                             ph: '{irb002_check_13}' },
  ];

  const dataRows = ITEMS.map(item =>
    new TableRow({
      children: [
        cell(item.no,   { width: 600,  align: AlignmentType.CENTER }),
        cell(item.name, { width: 3200 }),
        cell(item.code, { width: 1200, align: AlignmentType.CENTER }),
        cell(item.note, { width: 3200, size: 20 }),
        cell(item.ph,   { width: 1200, align: AlignmentType.CENTER }),
      ],
    })
  );

  // 說明列
  const noteRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 5,
        borders: { top: THIN, bottom: THIN, left: THIN, right: THIN },
        children: [new Paragraph({
          children: [new TextRun({ text: '申請文件請依上列順序置放，並於確認備齊及簽章完整後送至本署企劃組承辦人收', font: '標楷體', size: 22 })],
          spacing: { before: 40, after: 40 },
        })],
      }),
    ],
  });

  const table = new Table({
    width: { size: 9400, type: WidthType.DXA },
    borders: TableBorders.NONE,
    rows: [headerRow, ...dataRows, noteRow],
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: '標楷體', size: 24 } } },
    },
    sections: [{
      properties: {
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, right: 900, bottom: 1080, left: 900 } },
      },
      children: [
        // 機關名稱 & 標題
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: '衛生福利部疾病管制署人體研究倫理審查會', font: '標楷體', size: 28, bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: '計畫送件核對表', font: '標楷體', size: 32, bold: true })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 }, children: [new TextRun({ text: '（本清單請置於首頁）', font: '標楷體', size: 22 })] }),

        // 計畫名稱
        new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: '計畫名稱：{irb002_project_title}', font: '標楷體', size: 24 })] }),

        // 主持人 / 日期
        new Table({
          width: { size: 9400, type: WidthType.DXA },
          borders: TableBorders.NONE,
          rows: [new TableRow({
            children: [
              new TableCell({ borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }, width: { size: 4700, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: '主持人姓名：{irb002_pi_name}', font: '標楷體', size: 24 })] })] }),
              new TableCell({ borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }, width: { size: 4700, type: WidthType.DXA }, children: [new Paragraph({ children: [new TextRun({ text: '日期：{irb002_date}', font: '標楷體', size: 24 })] })] }),
            ],
          }),
          new TableRow({
            children: [
              new TableCell({ borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }, width: { size: 4700, type: WidthType.DXA }, children: [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '職稱：{irb002_pi_title}', font: '標楷體', size: 24 })] })] }),
              new TableCell({ borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }, width: { size: 4700, type: WidthType.DXA }, children: [new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: '單位：{irb002_pi_unit}', font: '標楷體', size: 24 })] })] }),
            ],
          })],
        }),

        // 主表格
        table,

        // 收件人簽章
        new Paragraph({ spacing: { before: 200, after: 80 }, children: [new TextRun({ text: '收件人簽章/日期：＿＿＿＿＿＿＿＿＿（審查會填寫）', font: '標楷體', size: 24 })] }),
        new Paragraph({ children: [
          new TextRun({ text: '□文件不足，請補件　　□確認送件資料無誤', font: '標楷體', size: 24 }),
        ]}),

        // 表單編號
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 200 }, children: [new TextRun({ text: '表單編號：IRB-002', font: '標楷體', size: 20 })] }),
      ],
    }],
  });

  await save(doc, 'DOC-3.docx');
}

// ========================================
// 主程式
// ========================================
async function main() {
  console.log('🏗️  Generating DOC-7, DOC-8 templates...\n');
  await genDOC7();
  await genDOC8();
  console.log('\n✅ DOC-7, DOC-8 generated in public/templates/');
  console.log('ℹ️  DOC-1~6 由 inject-placeholders.cjs 從原始 CDC 模板注入');
}

main().catch(console.error);
