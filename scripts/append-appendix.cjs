// ===== 將附表一、二、三 XML 追加到 DOC-2 (署內研究計畫書) =====
// 直接操作現有 public/templates/DOC-2.docx

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const TEMPLATE = path.join(__dirname, '..', 'public', 'templates', 'DOC-2.docx');
const F = 'DFKai-SB';
const SZ = '22';
const SZ_H = '26';

function rpr(opts = {}) {
  return `<w:rPr>
    <w:rFonts w:ascii="${F}" w:hAnsi="${F}" w:eastAsia="${F}"/>
    ${opts.bold ? '<w:b/>' : ''}
    <w:sz w:val="${opts.sz || SZ}"/><w:szCs w:val="${opts.sz || SZ}"/>
  </w:rPr>`;
}

function run(text, opts = {}) {
  return `<w:r>${rpr(opts)}<w:t xml:space="preserve">${text}</w:t></w:r>`;
}

function para(content, opts = {}) {
  const jc = opts.center ? '<w:jc w:val="center"/>' : '';
  const sp = (opts.before !== undefined || opts.after !== undefined)
    ? `<w:spacing w:before="${opts.before || 0}" w:after="${opts.after !== undefined ? opts.after : 100}"/>`
    : '';
  const ppr = (jc || sp) ? `<w:pPr>${jc}${sp}</w:pPr>` : '';
  return `<w:p>${ppr}${content}</w:p>`;
}

const CELL_BORDERS = `<w:tcBorders>
  <w:top w:val="single" w:sz="4" w:color="000000"/>
  <w:left w:val="single" w:sz="4" w:color="000000"/>
  <w:bottom w:val="single" w:sz="4" w:color="000000"/>
  <w:right w:val="single" w:sz="4" w:color="000000"/>
</w:tcBorders>`;

function tc(text, width, opts = {}) {
  const shd = opts.header ? '<w:shd w:val="clear" w:color="auto" w:fill="D9D9D9"/>' : '';
  return `<w:tc>
    <w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${CELL_BORDERS}${shd}</w:tcPr>
    <w:p><w:pPr><w:spacing w:before="40" w:after="40"/></w:pPr>${run(text, { bold: !!opts.header })}</w:p>
  </w:tc>`;
}

function tr(...cells) { return `<w:tr>${cells.join('')}</w:tr>`; }

const TBL_BORDERS = `<w:tblBorders>
  <w:top w:val="single" w:sz="4" w:color="000000"/>
  <w:left w:val="single" w:sz="4" w:color="000000"/>
  <w:bottom w:val="single" w:sz="4" w:color="000000"/>
  <w:right w:val="single" w:sz="4" w:color="000000"/>
  <w:insideH w:val="single" w:sz="4" w:color="000000"/>
  <w:insideV w:val="single" w:sz="4" w:color="000000"/>
</w:tblBorders>`;

function tbl(rows) {
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="9000" w:type="dxa"/>
      ${TBL_BORDERS}
      <w:tblLayout w:type="fixed"/>
    </w:tblPr>
    ${rows.join('')}
  </w:tbl>`;
}

function buildAppendixXml() {
  // ===== 附表一：學經歷說明書 =====
  const appendix1 = `
    ${para(run('附表一　計畫主持人、協同主持人、研究人員學經歷說明書', { bold: true, sz: SZ_H }), { center: true, after: 160 })}
    ${tbl([
      tr(tc('姓名', 1500, { header: true }), tc('{pa_name_zh}　　職稱：{pa_title}　　服務單位：{pa_unit}', 7500)),
      tr(tc('最高學歷', 1500, { header: true }), tc('{pa_degree}　{pa_school}　{pa_department}，民國{pa_grad_year}年畢業', 7500)),
      tr(tc('專長領域', 1500, { header: true }), tc('{pa_expertise}', 7500)),
      tr(tc('研究倫理訓練', 1500, { header: true }), tc('{pa_irb_training_hours}小時（證明文件：{pa_irb_training_cert}）', 7500)),
    ])}
    ${para(run('服務經歷', { bold: true }), { before: 200, after: 80 })}
    ${tbl([
      tr(tc('服務機關及單位', 4800, { header: true }), tc('職稱', 2000, { header: true }), tc('起訖年月', 2200, { header: true })),
      tr(tc('{#pa_work_history}{wh_institution}', 4800), tc('{wh_title}', 2000), tc('{wh_start_ym}～{wh_end_ym}{/pa_work_history}', 2200)),
    ])}
    ${para(run('研究計畫（近三年已完成、執行中、申請中）', { bold: true }), { before: 200, after: 80 })}
    ${tbl([
      tr(tc('計畫名稱', 2800, { header: true }), tc('狀態', 800, { header: true }), tc('角色', 900, { header: true }), tc('補助機關', 1800, { header: true }), tc('經費(元)', 1200, { header: true }), tc('起訖年月', 1500, { header: true })),
      tr(tc('{#pa_projects}{proj_name}', 2800), tc('{proj_status_label}', 800), tc('{proj_role}', 900), tc('{proj_funder}', 1800), tc('{proj_budget}', 1200), tc('{proj_start_ym}～{proj_end_ym}{/pa_projects}', 1500)),
    ])}`;

  // ===== 附表二：計畫摘要 =====
  const appendix2 = `
    ${para(run('附表二　近三年主持之有經費計畫摘要（若無此資料，請填無此資料）', { bold: true, sz: SZ_H }), { center: true, before: 300, after: 160 })}
    ${tbl([
      tr(tc('計畫名稱', 2500, { header: true }), tc('補助機關', 1800, { header: true }), tc('經費(元)', 1000, { header: true }), tc('起訖年月', 1400, { header: true }), tc('計畫摘要', 2300, { header: true })),
      tr(tc('{#pa_pi_projects}{pi_proj_name}', 2500), tc('{pi_proj_funder}', 1800), tc('{pi_proj_budget}', 1000), tc('{pi_proj_start_ym}～{pi_proj_end_ym}', 1400), tc('{pi_proj_summary}{/pa_pi_projects}', 2300)),
    ])}
    ${para(run('{#pa_no_pi_projects}無此資料{/pa_no_pi_projects}'))}`;

  // ===== 附表三：著作清單 =====
  const appendix3 = `
    ${para(run('附表三　近三年著作清單（若無此資料，請填無此資料）', { bold: true, sz: SZ_H }), { center: true, before: 300, after: 160 })}
    ${tbl([
      tr(tc('著作名稱', 3000, { header: true }), tc('期刊／出版來源', 2500, { header: true }), tc('發表年(民國)', 1000, { header: true }), tc('作者群', 2500, { header: true })),
      tr(tc('{#pa_publications}{pub_title}', 3000), tc('{pub_journal}', 2500), tc('{pub_year}', 1000), tc('{pub_authors}{/pa_publications}', 2500)),
    ])}
    ${para(run('{#pa_no_publications}無此資料{/pa_no_publications}'))}`;

  return `
    ${para(run('{#personnel_appendix}'))}
    <w:p><w:r><w:br w:type="page"/></w:r></w:p>
    ${appendix1}
    ${appendix2}
    ${appendix3}
    ${para(run('{/personnel_appendix}'))}`;
}

// ===== 主程式 =====
const buf = fs.readFileSync(TEMPLATE);
const zip = new PizZip(buf);
let xml = zip.file('word/document.xml').asText();

// 檢查是否已經嵌入過
if (xml.includes('{#personnel_appendix}')) {
  console.log('⚠️  附表已存在，跳過（如需重新嵌入請先還原 DOC-2.docx）');
  process.exit(0);
}

xml = xml.replace('</w:body>', buildAppendixXml() + '</w:body>');
zip.file('word/document.xml', xml);
const out = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
fs.writeFileSync(TEMPLATE, out);
console.log(`✅ 附表一、二、三已嵌入 DOC-2.docx (${(out.length / 1024).toFixed(1)} KB)`);
