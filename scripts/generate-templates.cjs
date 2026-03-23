// ===== 生成 7 份 docxtemplater 模板 =====
// 使用 docx-js 建立 .docx 檔案，內含 {placeholder} 標籤

const fs = require('fs');
const path = require('path');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageBreak, PageNumber,
} = require('docx');

const OUT = path.join(__dirname, '..', 'public', 'templates');
fs.mkdirSync(OUT, { recursive: true });

// ===== 共用樣式 =====
const FONT = '標楷體';
const FONT_EN = 'Times New Roman';
const border = { style: BorderStyle.SINGLE, size: 1, color: '000000' };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};
const cellMargins = { top: 40, bottom: 40, left: 80, right: 80 };
const A4 = { width: 11906, height: 16838 }; // A4 in DXA

function t(text, opts = {}) {
  return new TextRun({ text, font: FONT, size: opts.size || 24, ...opts });
}

function p(children, opts = {}) {
  if (typeof children === 'string') children = [t(children)];
  return new Paragraph({ children, ...opts });
}

function cell(children, opts = {}) {
  if (typeof children === 'string') children = [p(children)];
  if (!Array.isArray(children)) children = [children];
  // Ensure all items are Paragraphs
  children = children.map(c => c instanceof Paragraph ? c : p([c]));
  return new TableCell({
    borders,
    margins: cellMargins,
    verticalAlign: VerticalAlign.CENTER,
    ...opts,
    children,
  });
}

function headerCell(text, opts = {}) {
  return cell([p([t(text, { bold: true, size: 22 })], { alignment: AlignmentType.CENTER })], {
    shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
    ...opts,
  });
}

// 生成 .docx
async function save(doc, filename) {
  const buffer = await Packer.toBuffer(doc);
  const fp = path.join(OUT, filename);
  fs.writeFileSync(fp, buffer);
  console.log(`✅ ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// ========================================
// DOC-7: 研究計畫簽呈（公文）
// ========================================
async function genDOC7() {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 28 } } },
    },
    sections: [{
      properties: {
        page: { size: A4, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children: [
        p([t('簽', { bold: true, size: 36 })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
        p([t('主旨：', { bold: true }), t('擬辦理「{project_title_zh}」研究計畫，簽請核示。')], { spacing: { after: 200 } }),
        p([t('說明：', { bold: true })], { spacing: { after: 100 } }),
        p([t('一、為瞭解{purpose_brief}，擬利用本署防疫資料庫進行回溯性研究分析。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('二、本案研究期程自{execution_start_roc}至{execution_end_roc}，由{responsible_unit}{pi_name_zh}主持，不需額外經費。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('三、依「衛生福利部疾病管制署研究計畫管理要點」規定，本研究計畫書（如附件一）業經單位主管初審，爰提送研究審查會進行審查。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('四、本案擬同時向本署 IRB 申請倫理審查（免審），相關文件如附件二至四。')], { indent: { left: 480 }, spacing: { after: 200 } }),
        p([t('擬辦：', { bold: true })], { spacing: { after: 100 } }),
        p([t('一、簽請同意辦理上揭研究計畫。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('二、核可後將續依規定向 IRB 申請倫理審查及向資料庫申請使用資料。')], { indent: { left: 480 }, spacing: { after: 400 } }),
        p([t('附件：')], { spacing: { after: 100 } }),
        p([t('一、署內研究計畫書')], { indent: { left: 480 }, spacing: { after: 60 } }),
        p([t('二、IRB-004 研究計畫書')], { indent: { left: 480 }, spacing: { after: 60 } }),
        p([t('三、IRB-012 免審申請表')], { indent: { left: 480 }, spacing: { after: 60 } }),
        p([t('四、IRB-018 保密切結書')], { indent: { left: 480 }, spacing: { after: 400 } }),
        // 簽名區
        p([t('{responsible_unit}')], { alignment: AlignmentType.RIGHT, spacing: { after: 200 } }),
        p([t('{pi_name_zh}')], { alignment: AlignmentType.RIGHT, spacing: { after: 100 } }),
        p([t('中華民國{filing_date_roc}')], { alignment: AlignmentType.RIGHT }),
      ],
    }],
  });
  await save(doc, 'DOC-7.docx');
}

// ========================================
// DOC-3: IRB-018 保密切結書（研究人員）
// ========================================
async function genDOC3() {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 24 } } },
    },
    sections: [{
      properties: {
        page: { size: A4, margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 } },
      },
      children: [
        p([t('保密切結書', { bold: true, size: 36 })], { alignment: AlignmentType.CENTER, spacing: { after: 400 } }),

        p([t('茲立書人'), t('{person_name_zh}', { bold: true, underline: {} }), t('同意遵守以下約定條款，善盡職務上資訊保密的義務：')], { spacing: { after: 300 } }),

        p([t('第一條：公務機密之保密', { bold: true })], { spacing: { after: 150 } }),
        p([t('1. 為維護公務機密及監理業務個人資料保護，對於經核定機密等級與解密條件，或職務上相關之公務機密及個人資料，就其內容負保密之責。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('2. 恪遵保密檢查及安全管制規定，絕不擅自蒐集、洩漏、傳播職務上任何業務相關資訊。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('3. 保密之義務，不因在職或離職而終止。如有違反，依法負刑事、民事及行政責任。')], { indent: { left: 480 }, spacing: { after: 300 } }),

        p([t('第二條：使用公務電腦、網路及相關電腦資源，確實遵守下列事項：', { bold: true })], { spacing: { after: 150 } }),
        p([t('1. 公務電腦、網路及相關電腦資源係以作為公務使用為原則。任何個人用途之使用均不得妨害公務。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('2. 個人使用公務電腦、網路及相關電腦資源，應尊重智慧財產權，不任意安裝或下載非公務需要、非經合法授權或有安全性疑慮之軟體及資料，或從事惡意破壞行為。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('3. 公務電腦、網路及相關電腦資源之使用，基於資訊安全相關考量，主管科室及政風人員得不經個人同意，依主管業務進行稽核，或調整使用方式，不得異議。')], { indent: { left: 480 }, spacing: { after: 100 } }),
        p([t('4. 機敏性公務資料禁止上傳雲端或使用相關服務。')], { indent: { left: 480 }, spacing: { after: 400 } }),

        p([t('立書人姓名：'), t('{person_name_zh}')], { spacing: { after: 200 } }),
        p([t('職稱：'), t('{person_title}')], { spacing: { after: 200 } }),
        p([t('身分證字號：'), t('{person_id_number}')], { spacing: { after: 400 } }),

        p([t('中華民國 {filing_date_roc}')], { alignment: AlignmentType.RIGHT }),
      ],
    }],
  });
  await save(doc, 'DOC-3.docx');
}

// ========================================
// DOC-5: 資料庫保密切結書（署內員工使用）
// ========================================
async function genDOC5() {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 24 } } },
    },
    sections: [{
      properties: {
        page: { size: A4, margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 } },
      },
      headers: {
        default: new Header({
          children: [
            p([t('D-205-0009', { size: 16, color: '888888' })], { alignment: AlignmentType.RIGHT }),
          ],
        }),
      },
      children: [
        p([t('衛生福利部疾病管制署', { size: 28 })], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
        p([t('個人資料保護保密同意書', { bold: true, size: 32 })], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
        p([t('（署內員工使用）', { size: 24 })], { alignment: AlignmentType.CENTER, spacing: { after: 300 } }),

        p([t('　　立同意書人'), t('{person_name_zh}', { bold: true, underline: {} }), t('，因執行「'), t('{project_title_zh}', { underline: {} }), t('」研究計畫（以下簡稱本計畫），需使用衛生福利部疾病管制署（以下簡稱本署）防疫資料庫，茲同意遵守下列事項：')], { spacing: { after: 300, line: 360 } }),

        p([t('一、使用本署提供之資料，僅限於本計畫研究目的範圍內使用，不得為計畫範圍外之利用或無故洩漏。')], { spacing: { after: 150, line: 360 } }),
        p([t('二、善盡善良管理人之注意義務，妥善保管本署提供之資料。')], { spacing: { after: 150, line: 360 } }),
        p([t('三、不得將所取得之資料提供第三人使用，且不得以任何方式對外公布資料內容或衍生資料。')], { spacing: { after: 150, line: 360 } }),
        p([t('四、不得嘗試以任何方式辨識特定個人之身分。')], { spacing: { after: 150, line: 360 } }),
        p([t('五、資料使用完畢或計畫結束後（以先發生者為準），應於期限內依規定銷毀或歸還所有資料（含備份），不得留存。')], { spacing: { after: 150, line: 360 } }),
        p([t('六、如有違反上述約定事項，願依相關法令負一切法律責任。')], { spacing: { after: 400, line: 360 } }),

        p([t('此致　衛生福利部疾病管制署')], { spacing: { after: 400 } }),

        p([t('立同意書人')], { spacing: { after: 100 } }),
        p([t('姓　名：{person_name_zh}')], { spacing: { after: 100 } }),
        p([t('身分證字號：{person_id_number}')], { spacing: { after: 100 } }),
        p([t('服務單位：{person_unit}')], { spacing: { after: 100 } }),
        p([t('職　稱：{person_title}')], { spacing: { after: 100 } }),
        p([t('電　話：{person_phone}')], { spacing: { after: 100 } }),
        p([t('E-mail：{person_email}')], { spacing: { after: 300 } }),

        p([t('中華民國 {filing_date_roc}')], { alignment: AlignmentType.RIGHT }),
      ],
    }],
  });
  await save(doc, 'DOC-5.docx');
}

// ========================================
// DOC-4: 署內研究計畫書
// ========================================
async function genDOC4() {
  // 壹、綜合資料 table
  const summaryTable = new Table({
    width: { size: 9506, type: WidthType.DXA },
    columnWidths: [1600, 1200, 1200, 1100, 1100, 1100, 1100, 1106],
    rows: [
      // 計畫名稱
      new TableRow({ children: [
        cell([p([t('計畫名稱', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('中文：{project_title_zh}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      new TableRow({ children: [
        cell([p([t('', { size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('英文：{project_title_en}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      // 計畫類別
      new TableRow({ children: [
        cell([p([t('計畫類別', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{project_type_text}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      // 實驗
      new TableRow({ children: [
        cell([p([t('實驗類型', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{experiment_types_text}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      // 執行期限
      new TableRow({ children: [
        cell([p([t('執行期限', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('自 {execution_start_roc} 起  至 {execution_end_roc} 止', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      // 經費
      new TableRow({ children: [
        cell([p([t('經費需求', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{funding_text}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      // 計畫主持人
      new TableRow({ children: [
        cell([p([t('計畫主持人', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{pi_name_zh}', { size: 22 })])], { width: { size: 1200, type: WidthType.DXA } }),
        cell([p([t('職稱', { bold: true, size: 22 })])], { width: { size: 1200, type: WidthType.DXA } }),
        cell([p([t('{pi_title}', { size: 22 })])], { width: { size: 1100, type: WidthType.DXA } }),
        cell([p([t('電話', { bold: true, size: 22 })])], { width: { size: 1100, type: WidthType.DXA } }),
        cell([p([t('{pi_phone}', { size: 22 })])], { width: { size: 1100, type: WidthType.DXA } }),
        cell([p([t('傳真', { bold: true, size: 22 })])], { width: { size: 1100, type: WidthType.DXA } }),
        cell([p([t('{pi_fax}', { size: 22 })])], { width: { size: 1106, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        cell([p([t('E-mail', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{pi_email}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      new TableRow({ children: [
        cell([p([t('連絡地址', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{pi_address}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      // 計畫聯絡人
      new TableRow({ children: [
        cell([p([t('計畫聯絡人', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{contact_name_zh}', { size: 22 })])], { width: { size: 1200, type: WidthType.DXA } }),
        cell([p([t('職稱', { bold: true, size: 22 })])], { width: { size: 1200, type: WidthType.DXA } }),
        cell([p([t('{contact_title}', { size: 22 })])], { width: { size: 1100, type: WidthType.DXA } }),
        cell([p([t('電話', { bold: true, size: 22 })])], { width: { size: 1100, type: WidthType.DXA } }),
        cell([p([t('{contact_phone}', { size: 22 })])], { width: { size: 1100, type: WidthType.DXA } }),
        cell([p([t('傳真', { bold: true, size: 22 })])], { width: { size: 1100, type: WidthType.DXA } }),
        cell([p([t('{contact_fax}', { size: 22 })])], { width: { size: 1106, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        cell([p([t('E-mail', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{contact_email}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
      new TableRow({ children: [
        cell([p([t('連絡地址', { bold: true, size: 22 })])], { width: { size: 1600, type: WidthType.DXA } }),
        cell([p([t('{contact_address}', { size: 22 })])], { width: { size: 7906, type: WidthType.DXA }, columnSpan: 7 }),
      ]}),
    ],
  });

  // 伍、人力配置 table
  const personnelTable = new Table({
    width: { size: 9506, type: WidthType.DXA },
    columnWidths: [1400, 1400, 1400, 1400, 3906],
    rows: [
      new TableRow({ children: [
        headerCell('類別', { width: { size: 1400, type: WidthType.DXA } }),
        headerCell('姓名', { width: { size: 1400, type: WidthType.DXA } }),
        headerCell('現職', { width: { size: 1400, type: WidthType.DXA } }),
        headerCell('單位', { width: { size: 1400, type: WidthType.DXA } }),
        headerCell('在本計畫內擔任之具體工作性質、項目及範圍', { width: { size: 3906, type: WidthType.DXA } }),
      ]}),
      // 使用 docxtemplater loop
      new TableRow({ children: [
        cell([p([t('{#personnel_rows}{role_text}', { size: 22 })])], { width: { size: 1400, type: WidthType.DXA } }),
        cell([p([t('{name_zh}', { size: 22 })])], { width: { size: 1400, type: WidthType.DXA } }),
        cell([p([t('{title}', { size: 22 })])], { width: { size: 1400, type: WidthType.DXA } }),
        cell([p([t('{unit}', { size: 22 })])], { width: { size: 1400, type: WidthType.DXA } }),
        cell([p([t('{work_description}{/personnel_rows}', { size: 22 })])], { width: { size: 3906, type: WidthType.DXA } }),
      ]}),
    ],
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 24 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: FONT },
          paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: FONT },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
      ],
    },
    sections: [
      // ===== 封面 =====
      {
        properties: {
          page: { size: A4, margin: { top: 1800, right: 1440, bottom: 1440, left: 1440 } },
        },
        children: [
          p([t('衛生福利部疾病管制署署內研究計畫書', { bold: true, size: 32 })], { alignment: AlignmentType.CENTER, spacing: { after: 600 } }),
          p([t('年　　度：'), t('{project_year}', { underline: {} })], { spacing: { after: 200 } }),
          p([t('計畫名稱：'), t('{project_title_zh}', { underline: {} })], { spacing: { after: 200 } }),
          p([t('負責單位：'), t('{responsible_unit}', { underline: {} })], { spacing: { after: 200 } }),
          p([t('主 持 人：'), t('{pi_name_zh}', { underline: {} })], { spacing: { after: 200 } }),
          p([t('{co_pi_lines}')], { spacing: { after: 200 } }),
          p([t('{researcher_lines}')], { spacing: { after: 200 } }),
          p([t('填報日期：{filing_date_roc}')], { spacing: { after: 200 } }),
          p([t('{project_type_cover_text}')], { spacing: { after: 400 } }),
          p([t('【註1】除英文摘要外，本計畫書限用中文書寫', { size: 20, italics: true })], { spacing: { after: 60 } }),
          p([t('【註2】計畫內容頁數限制：一年期計畫 35 頁為上限', { size: 20, italics: true })]),
        ],
      },
      // ===== 正文 =====
      {
        properties: {
          page: { size: A4, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
        },
        headers: {
          default: new Header({ children: [p([t('衛生福利部疾病管制署署內研究計畫書', { size: 18, color: '888888' })], { alignment: AlignmentType.CENTER })] }),
        },
        footers: {
          default: new Footer({ children: [p([t('第 '), t('', { children: [PageNumber.CURRENT] }), t(' 頁')], { alignment: AlignmentType.CENTER, spacing: { before: 0 } })] }),
        },
        children: [
          // 壹、綜合資料
          p([t('壹、綜合資料', { bold: true, size: 28 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          summaryTable,

          new Paragraph({ children: [new PageBreak()] }),

          // 貳、計畫中文摘要
          p([t('貳、計畫中文摘要', { bold: true, size: 28 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          p([t('{abstract_zh}')], { spacing: { after: 200, line: 360 } }),
          p([t('關鍵詞：'), t('{keywords_zh}', { underline: {} })], { spacing: { after: 400 } }),

          new Paragraph({ children: [new PageBreak()] }),

          // 參、計畫英文摘要
          p([t('參、計畫英文摘要', { bold: true, size: 28 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          p([t('{abstract_en}', { font: FONT_EN })], { spacing: { after: 200, line: 360 } }),
          p([t('Keywords: ', { font: FONT_EN }), t('{keywords_en}', { font: FONT_EN, underline: {} })], { spacing: { after: 400 } }),

          new Paragraph({ children: [new PageBreak()] }),

          // 肆、計畫內容
          p([t('肆、計畫內容', { bold: true, size: 28 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),

          p([t('一、研究主旨', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_2, spacing: { after: 150 } }),
          p([t('{purpose}')], { spacing: { after: 300, line: 360 } }),

          p([t('二、背景分析', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_2, spacing: { after: 150 } }),
          p([t('{background}')], { spacing: { after: 300, line: 360 } }),

          p([t('三、多年期計畫之執行成果概要', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_2, spacing: { after: 150 } }),
          p([t('為一年期計畫，故不適用。')], { spacing: { after: 300 } }),

          p([t('四、實施方法及進行步驟', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_2, spacing: { after: 150 } }),
          p([t('{methodology}')], { spacing: { after: 300, line: 360 } }),

          p([t('五、成果預估', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_2, spacing: { after: 150 } }),
          p([t('{expected_outcome}')], { spacing: { after: 300, line: 360 } }),

          p([t('六、重要參考文獻', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_2, spacing: { after: 150 } }),
          p([t('{references}')], { spacing: { after: 300, line: 360 } }),

          p([t('七、{project_year}年度預定進度', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_2, spacing: { after: 150 } }),
          p([t('{gantt_chart_text}')], { spacing: { after: 300 } }),

          new Paragraph({ children: [new PageBreak()] }),

          // 伍、人力配置
          p([t('伍、人力配置', { bold: true, size: 28 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          personnelTable,

          new Paragraph({ children: [new PageBreak()] }),

          // 陸、經費需求
          p([t('陸、經費需求表', { bold: true, size: 28 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          p([t('本計畫無經費需求。')], { spacing: { after: 300 } }),

          // 柒、需其他機關配合
          p([t('柒、需其他機關配合或協調事項', { bold: true, size: 28 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 200 } }),
          p([t('無。')], { spacing: { after: 300 } }),
        ],
      },
    ],
  });
  await save(doc, 'DOC-4.docx');
}

// ========================================
// DOC-1: IRB-004 研究計畫書
// ========================================
async function genDOC1() {
  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 24 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: FONT },
          paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      ],
    },
    sections: [{
      properties: {
        page: { size: A4, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      headers: {
        default: new Header({ children: [p([t('IRB-004', { size: 18, color: '888888' })], { alignment: AlignmentType.RIGHT })] }),
      },
      footers: {
        default: new Footer({ children: [p([t('第 '), t('', { children: [PageNumber.CURRENT] }), t(' 頁')], { alignment: AlignmentType.CENTER })] }),
      },
      children: [
        p([t('衛生福利部疾病管制署', { size: 28 })], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
        p([t('研究計畫書', { bold: true, size: 32 })], { alignment: AlignmentType.CENTER, spacing: { after: 300 } }),

        // 基本資料表
        new Table({
          width: { size: 9506, type: WidthType.DXA },
          columnWidths: [2400, 7106],
          rows: [
            new TableRow({ children: [
              headerCell('計畫名稱（中文）', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{project_title_zh}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              headerCell('計畫名稱（英文）', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{project_title_en}', { size: 22, font: FONT_EN })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              headerCell('計畫主持人', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{pi_name_zh}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              headerCell('服務單位/職稱', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{pi_unit} / {pi_title}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              headerCell('聯絡電話', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{pi_phone}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              headerCell('E-mail', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{pi_email}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              headerCell('執行期間', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{execution_start_roc} 至 {execution_end_roc}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              headerCell('計畫類別', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{project_type_text}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
            new TableRow({ children: [
              headerCell('經費來源', { width: { size: 2400, type: WidthType.DXA } }),
              cell([p([t('{funding_text}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA } }),
            ]}),
          ],
        }),

        new Paragraph({ children: [new PageBreak()] }),

        // 研究內容
        p([t('一、研究目的', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 150 } }),
        p([t('{purpose}')], { spacing: { after: 300, line: 360 } }),

        p([t('二、背景', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 150 } }),
        p([t('{background}')], { spacing: { after: 300, line: 360 } }),

        p([t('三、研究方法', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 150 } }),
        p([t('{methodology}')], { spacing: { after: 300, line: 360 } }),

        p([t('四、預期成果', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 150 } }),
        p([t('{expected_outcome}')], { spacing: { after: 300, line: 360 } }),

        p([t('五、研究對象之權益保護', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 150 } }),
        p([t('（一）資料來源：')], { spacing: { after: 100 } }),
        p([t('{data_source}')], { spacing: { after: 200, line: 360 } }),
        p([t('（二）研究期間之隱私保護：')], { spacing: { after: 100 } }),
        p([t('{privacy_during}')], { spacing: { after: 200, line: 360 } }),
        p([t('（三）研究結束後之隱私保護：')], { spacing: { after: 100 } }),
        p([t('{privacy_after}')], { spacing: { after: 200, line: 360 } }),
        p([t('（四）退出機制：')], { spacing: { after: 100 } }),
        p([t('{privacy_withdrawal}')], { spacing: { after: 300, line: 360 } }),

        p([t('六、重要參考文獻', { bold: true, size: 26 })], { heading: HeadingLevel.HEADING_1, spacing: { after: 150 } }),
        p([t('{references}')], { spacing: { after: 300, line: 360 } }),
      ],
    }],
  });
  await save(doc, 'DOC-1.docx');
}

// ========================================
// DOC-2: IRB-012 免審申請表
// ========================================
async function genDOC2() {
  const mainTable = new Table({
    width: { size: 9506, type: WidthType.DXA },
    columnWidths: [2600, 6906],
    rows: [
      new TableRow({ children: [
        headerCell('計畫名稱', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{project_title_zh}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('計畫主持人', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{pi_name_zh}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('服務單位/職稱', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{pi_unit} / {pi_title}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('聯絡電話/E-mail', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{pi_phone} / {pi_email}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('執行期間', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{execution_start_roc} 至 {execution_end_roc}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      // 免審類別
      new TableRow({ children: [
        headerCell('免審類別', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{exempt_category_text}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('申請免審理由', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{exempt_reason}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      // 研究對象
      new TableRow({ children: [
        headerCell('是否招募研究對象', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{recruit_text}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('是否與研究對象互動', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{interact_text}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
      // 利益衝突
      new TableRow({ children: [
        headerCell('利益衝突聲明', { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{conflict_of_interest_text}', { size: 22 })])], { width: { size: 6906, type: WidthType.DXA } }),
      ]}),
    ],
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 24 } } },
    },
    sections: [{
      properties: {
        page: { size: A4, margin: { top: 1440, right: 1200, bottom: 1440, left: 1200 } },
      },
      headers: {
        default: new Header({ children: [p([t('IRB-012', { size: 18, color: '888888' })], { alignment: AlignmentType.RIGHT })] }),
      },
      children: [
        p([t('衛生福利部疾病管制署', { size: 28 })], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
        p([t('人體研究倫理審查委員會', { size: 28 })], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
        p([t('免除倫理審查申請表', { bold: true, size: 32 })], { alignment: AlignmentType.CENTER, spacing: { after: 300 } }),

        mainTable,

        p([], { spacing: { after: 200 } }),

        // 簽名區
        p([t('計畫主持人簽章：____________________')], { spacing: { after: 200 } }),
        p([t('日期：{filing_date_roc}')], { spacing: { after: 200 } }),

        p([t('※ 檢附文件：', { bold: true })], { spacing: { after: 100, before: 200 } }),
        p([t('1. 研究計畫書（IRB-004）')], { indent: { left: 480 }, spacing: { after: 60 } }),
        p([t('2. 保密切結書（IRB-018）')], { indent: { left: 480 }, spacing: { after: 60 } }),
        p([t('3. 其他相關文件')], { indent: { left: 480 } }),
      ],
    }],
  });
  await save(doc, 'DOC-2.docx');
}

// ========================================
// DOC-6: 資料庫使用申請單
// ========================================
async function genDOC6() {
  // 一、申請者資料
  const section1 = new Table({
    width: { size: 9506, type: WidthType.DXA },
    columnWidths: [2400, 2553, 2000, 2553],
    rows: [
      new TableRow({ children: [
        cell([p([t('一、申請者資料', { bold: true, size: 22 })])], {
          width: { size: 9506, type: WidthType.DXA }, columnSpan: 4,
          shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        }),
      ]}),
      new TableRow({ children: [
        headerCell('申請單位', { width: { size: 2400, type: WidthType.DXA } }),
        cell([p([t('{apply_unit}', { size: 22 })])], { width: { size: 2553, type: WidthType.DXA } }),
        headerCell('申請人員', { width: { size: 2000, type: WidthType.DXA } }),
        cell([p([t('{pi_name_zh}', { size: 22 })])], { width: { size: 2553, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('公務電話', { width: { size: 2400, type: WidthType.DXA } }),
        cell([p([t('{pi_phone}', { size: 22 })])], { width: { size: 2553, type: WidthType.DXA } }),
        headerCell('E-mail', { width: { size: 2000, type: WidthType.DXA } }),
        cell([p([t('{pi_email}', { size: 22 })])], { width: { size: 2553, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('研究目的及用途', { width: { size: 2400, type: WidthType.DXA } }),
        cell([p([t('{research_purpose_type_text}', { size: 22 })])], { width: { size: 7106, type: WidthType.DXA }, columnSpan: 3 }),
      ]}),
    ],
  });

  // 二、研究計畫摘要
  const section2 = new Table({
    width: { size: 9506, type: WidthType.DXA },
    columnWidths: [2800, 6706],
    rows: [
      new TableRow({ children: [
        cell([p([t('二、研究計畫摘要', { bold: true, size: 22 })])], {
          width: { size: 9506, type: WidthType.DXA }, columnSpan: 2,
          shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        }),
      ]}),
      new TableRow({ children: [
        headerCell('年度', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{project_year}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('計畫名稱', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{project_title_zh}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('計畫緣起', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{background}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('計畫目的', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{purpose}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('實施方法及進行步驟', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{methodology}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('資料庫預定使用範圍', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{db_usage_scope}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('計畫期間', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{execution_start_roc} 至 {execution_end_roc}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('資料使用期限', { width: { size: 2800, type: WidthType.DXA } }),
        cell([
          p([t('分析期限：{analysis_deadline_roc}', { size: 22 })]),
          p([t('保留期限：{retention_deadline_roc}', { size: 22 })]),
        ], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('資料交付方式', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{delivery_format_text}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('資料使用地點與分析平台', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{analysis_location_text}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('研究成果預計處理類型', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{outcome_type_text}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
      new TableRow({ children: [
        headerCell('計畫主持人', { width: { size: 2800, type: WidthType.DXA } }),
        cell([p([t('{pi_same_text}', { size: 22 })])], { width: { size: 6706, type: WidthType.DXA } }),
      ]}),
    ],
  });

  // 共同參與研究人員
  const personnelSection = new Table({
    width: { size: 9506, type: WidthType.DXA },
    columnWidths: [2400, 2600, 1800, 2706],
    rows: [
      new TableRow({ children: [
        cell([p([t('共同參與研究人員及實際處理資料人員清冊', { bold: true, size: 20 })])], {
          width: { size: 9506, type: WidthType.DXA }, columnSpan: 4,
          shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
        }),
      ]}),
      new TableRow({ children: [
        headerCell('姓名', { width: { size: 2400, type: WidthType.DXA } }),
        headerCell('服務單位', { width: { size: 2600, type: WidthType.DXA } }),
        headerCell('職稱', { width: { size: 1800, type: WidthType.DXA } }),
        headerCell('聯絡電話', { width: { size: 2706, type: WidthType.DXA } }),
      ]}),
      // docxtemplater loop for personnel
      new TableRow({ children: [
        cell([p([t('{#db_personnel}{name_zh}', { size: 22 })])], { width: { size: 2400, type: WidthType.DXA } }),
        cell([p([t('{unit}', { size: 22 })])], { width: { size: 2600, type: WidthType.DXA } }),
        cell([p([t('{title}', { size: 22 })])], { width: { size: 1800, type: WidthType.DXA } }),
        cell([p([t('{phone}{/db_personnel}', { size: 22 })])], { width: { size: 2706, type: WidthType.DXA } }),
      ]}),
    ],
  });

  // 三、申請使用之防疫資料庫 — 留空白
  const section3 = new Table({
    width: { size: 9506, type: WidthType.DXA },
    columnWidths: [9506],
    rows: [
      new TableRow({ children: [
        cell([p([t('三、申請使用之防疫資料庫', { bold: true, size: 22 })])], {
          width: { size: 9506, type: WidthType.DXA },
          shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        }),
      ]}),
      new TableRow({ children: [
        cell([
          p([t('（請於列印後手動填寫本節）', { size: 20, italics: true, color: '888888' })]),
          p([]),
          p([t('申請系統名稱：＿＿＿＿＿＿＿＿　　擷取資料條件：＿＿＿＿＿＿＿＿　　申請年度：＿＿＿＿＿', { size: 20 })]),
          p([]),
          p([t('序號　　中文欄位名稱　　　　　　　申請目的', { size: 20 })]),
          p([t('1. ＿＿＿＿＿＿＿＿　　　　＿＿＿＿＿＿＿＿＿＿＿＿＿', { size: 20 })]),
          p([t('2. ＿＿＿＿＿＿＿＿　　　　＿＿＿＿＿＿＿＿＿＿＿＿＿', { size: 20 })]),
          p([t('3. ＿＿＿＿＿＿＿＿　　　　＿＿＿＿＿＿＿＿＿＿＿＿＿', { size: 20 })]),
          p([]),
        ], { width: { size: 9506, type: WidthType.DXA } }),
      ]}),
    ],
  });

  // 四、資科中心勾稽
  const section4 = new Table({
    width: { size: 9506, type: WidthType.DXA },
    columnWidths: [9506],
    rows: [
      new TableRow({ children: [
        cell([p([t('四、申請本署防疫資料庫至資科中心進行資料勾稽', { bold: true, size: 22 })])], {
          width: { size: 9506, type: WidthType.DXA },
          shading: { fill: 'D9E2F3', type: ShadingType.CLEAR },
        }),
      ]}),
      new TableRow({ children: [
        cell([p([t('{cross_link_text}', { size: 22 })])], { width: { size: 9506, type: WidthType.DXA } }),
      ]}),
    ],
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: FONT, size: 24 } } },
    },
    sections: [{
      properties: {
        page: { size: A4, margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 } },
      },
      children: [
        p([t('衛生福利部疾病管制署防疫資料庫員工研究計畫使用申請單', { bold: true, size: 26 })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }),
        p([t('申請日期：民國 {filing_date_roc}　　　　　序號：＿＿＿＿＿', { size: 20 })], { spacing: { after: 200 } }),

        section1,
        p([], { spacing: { after: 100 } }),
        section2,
        p([], { spacing: { after: 100 } }),
        personnelSection,
        p([], { spacing: { after: 100 } }),
        section3,
        p([], { spacing: { after: 100 } }),
        section4,

        p([], { spacing: { after: 300 } }),
        p([t('※ 其他注意事項：申請者、共同參與研究人員及實際處理資料人員，請依規定分別填寫與繳交個人資料保護保密同意書正本。', { size: 20, italics: true })], { spacing: { after: 300 } }),
        p([t('申請者簽名：＿＿＿＿＿＿＿＿＿　　單位主管簽名：＿＿＿＿＿＿＿＿＿')], { spacing: { after: 100 } }),
      ],
    }],
  });
  await save(doc, 'DOC-6.docx');
}

// ========================================
// 主程式
// ========================================
async function main() {
  console.log('🏗️  Generating 7 docxtemplater templates...\n');

  await genDOC7();  // 簽呈
  await genDOC3();  // IRB-018 保密切結書
  await genDOC5();  // 資料庫保密切結書
  await genDOC4();  // 署內研究計畫書
  await genDOC1();  // IRB-004 研究計畫書
  await genDOC2();  // IRB-012 免審申請表
  await genDOC6();  // 資料庫使用申請單

  console.log('\n✅ All 7 templates generated in public/templates/');
}

main().catch(console.error);
