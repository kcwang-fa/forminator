// ===== 文件生成邏輯 =====
//
// 流程：FormData（使用者填的表單）→ prepareCommonData() 整理成 placeholder 物件
//       → generateDoc() 把 placeholder 填進 .docx 模板（docxtemplater）
//       → generateAllDocuments() 打包成 ZIP 下載
//
// 模板檔案放在 public/templates/，由 scripts/inject-docN.cjs 預先注入 {placeholder} 標籤。
// 模板的佔位符格式是 {欄位名}，與 JavaScript 的 ${} 不同。
//
// 新手提示：
//   - 要加新欄位 → 在對應的 prepareXxxData() 函式裡加一行，key 名稱要和模板裡的 {placeholder} 一致
//   - 要加新文件 → 在 DOC_NAMES（defaults.ts）加 ID，在 generateDoc() 的 switch 加 case
//   - DOC-6、DOC-7 是逐人生成（每位研究人員一份），邏輯在 generatePerPersonDoc()

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import JSZip from 'jszip';
// 簽名圖嵌入：免費版 image module 把模板的 {%xxx_sig} 標籤換成 PNG 圖片；
// fix-doc-pr-corruption 是 docxtemplater 官方修復模組，同一份文件嵌多張圖時
// 避免 docPr id 重複造成 Word 開檔報「內容有問題」。
import ImageModule from 'docxtemplater-image-module-free';
import fixDocPrCorruption from 'docxtemplater/js/modules/fix-doc-pr-corruption.js';
import { base64DataUrlToUint8Array, getPngSize, fitSignatureSize } from './signatureImage';
import { requireSinglePi } from './personnelValidation';
// file-saver 是 CJS 套件，無具名 ESM 匯出。用 default import + destructure，
// 讓 Vite 和 Node 原生 ESM（snapshot 腳本用）都能解析。
import fileSaver from 'file-saver';
const { saveAs } = fileSaver;
import type { ExpeditedCategory, FormData, Personnel } from '../types/form';
import { calcProjectYears, getRocDateParts, toRocDate } from './date';
import { DOC_NAMES, type DocId } from '../data/defaults';
import { buildBudgetRowsByYear, calcTotalYear, buildBudgetSummaryYears, isPersonnel, isBusiness, isCapital } from './budgetCalc';
import { EXEMPT_MAP } from './docgenMaps';
import { prepareDatabaseData } from './docgen/database';
import { preparePersonnelAppendix } from './docgen/personnelAppendix';
import { prepareScheduleData } from './docgen/schedule';
import { prepareIrb002_1Data } from './docgen/irb0021';

// DOC-6（IRB-018 保密切結書）和 DOC-7（資料庫保密切結書）需要每位研究人員各一份
const PER_PERSON_DOCS = new Set<DocId>(['DOC-6', 'DOC-7']);

// ===== 輔助函式 =====

function findByRole(personnel: Personnel[], role: string): Personnel | undefined {
  return personnel.find(p => p.role === role);
}

// ===== 子資料準備函式 =====

function prepareBasicData(data: FormData, pi: Personnel, contact: Personnel) {
  const applyDate = data.apply_date || data.filing_date;
  const fullExecutionStart = data.full_execution_start || data.execution_start;
  const fullExecutionEnd = data.full_execution_end || data.execution_end;
  const currentExecutionStart = data.execution_start || fullExecutionStart;
  const currentExecutionEnd = data.execution_end || fullExecutionEnd;
  const currentStartParts = getRocDateParts(currentExecutionStart);
  const currentEndParts = getRocDateParts(currentExecutionEnd);
  const fullStartParts = getRocDateParts(fullExecutionStart);
  const fullEndParts = getRocDateParts(fullExecutionEnd);
  const formatPeriod = (start: string, end: string) => {
    if (start && end) return `${toRocDate(start)}至${toRocDate(end)}`;
    return start ? toRocDate(start) : end ? toRocDate(end) : '';
  };
  const currentExecutionPeriodText = formatPeriod(currentExecutionStart, currentExecutionEnd);
  const fullExecutionPeriodText = formatPeriod(fullExecutionStart, fullExecutionEnd);

  return {
    project_title_zh: data.project_title_zh,
    project_title_en: data.project_title_en,
    project_year: data.project_year,
    // 一年期固定 1 年（即使執行期間跨曆年也算一年期）；多年期才用「橫跨年度數」推算
    project_years: data.project_type === 'new_1yr'
      ? '1'
      : (data.project_years || String(calcProjectYears(fullExecutionStart, fullExecutionEnd) || '')),
    responsible_unit: data.responsible_unit,
    execution_start_roc: toRocDate(fullExecutionStart),
    execution_end_roc: toRocDate(fullExecutionEnd),
    current_execution_start_roc: toRocDate(currentExecutionStart),
    current_execution_end_roc: toRocDate(currentExecutionEnd),
    full_execution_start_roc: toRocDate(fullExecutionStart),
    full_execution_end_roc: toRocDate(fullExecutionEnd),
    exec_start_y: currentStartParts.y,
    exec_start_m: currentStartParts.m,
    exec_start_d: currentStartParts.d,
    exec_end_y: currentEndParts.y,
    exec_end_m: currentEndParts.m,
    exec_end_d: currentEndParts.d,
    full_exec_start_y: fullStartParts.y,
    full_exec_start_m: fullStartParts.m,
    full_exec_start_d: fullStartParts.d,
    full_exec_end_y: fullEndParts.y,
    full_exec_end_m: fullEndParts.m,
    full_exec_end_d: fullEndParts.d,
    filing_date_roc: toRocDate(data.filing_date),
    signing_date_roc: toRocDate(data.filing_date),
    apply_date_roc: toRocDate(applyDate),
    execution_period_text: fullExecutionPeriodText,
    current_execution_period_text: currentExecutionPeriodText,
    full_execution_period_text: fullExecutionPeriodText,

    // PI
    pi_name_zh: pi.name_zh || '',
    pi_title: pi.title || '',
    pi_unit: pi.unit || '',
    pi_phone: pi.phone || '',
    pi_fax: pi.fax || '',
    pi_email: pi.email || '',
    pi_address: pi.address || '',

    // 聯絡人
    contact_name_zh: contact.name_zh || '',
    contact_title: contact.title || '',
    contact_unit: contact.unit || '',
    contact_phone: contact.phone || '',
    contact_fax: contact.fax || '',
    contact_email: contact.email || '',
    contact_address: contact.address || '',
  };
}

function prepareResearchData(data: FormData) {
  // 多年期判斷與 schedule.ts 一致（一年期 = new_1yr）。
  // 「三、多年期計畫之執行成果概要」一節：多年期填使用者內容，一年期沿用範本罐頭字「不適用」。
  const isMultiYear = data.project_type !== 'new_1yr';
  // DOC-2「一、研究主旨」範本要求「總述 + 分年」。多年期時把研究主旨（全程總目標）與獨立的
  // 「分年計劃目的」欄位合併成一段注入 {purpose}；一年期沒有分年目的，維持純研究主旨。
  // DOC-5 免審申請表的「研究計畫目的」只要純研究主旨（不帶分年目的），改用獨立的 {purpose_brief}。
  const yearlyObjectives = isMultiYear ? data.yearly_objectives.trim() : '';
  const purposeMerged = [data.purpose.trim(), yearlyObjectives].filter(Boolean).join('\n\n');
  return {
    purpose: purposeMerged,        // DOC-2「一、研究主旨」：研究主旨（多年期再加分年目的）
    purpose_brief: data.purpose,   // DOC-5「研究計畫目的」：只要純研究主旨、不帶分年目的
    background: data.background,
    summary_of_results: isMultiYear ? data.summary_of_results : '為一年期計畫，故不適用。',
    methodology: data.methodology,
    expected_outcome: data.expected_outcome,
    abstract_zh: data.abstract_zh,
    abstract_en: data.abstract_en,
    keywords_zh: data.keywords_zh,
    keywords_en: data.keywords_en,
    references: data.references,
  };
}

function prepareIRBData(data: FormData) {
  return {
    data_source: data.data_source,
    inclusion_criteria: data.inclusion_criteria,
    exclusion_criteria: data.exclusion_criteria,
    privacy_during: data.privacy_during,
    privacy_after: data.privacy_after,
    privacy_withdrawal: data.privacy_withdrawal,
    // 研究類別可複選：把每個選到的類別轉成文字、以「；」串接
    exempt_category_text: data.exempt_category.map((c) => EXEMPT_MAP[c] || c).join('；'),
    exempt_reason: data.exempt_reason,
    // 招募方式文字改由 docgen/irb0021.ts 的 recruit_method_text 注入 DOC-12（原 recruit_text 無任何範本使用，已移除）。
    interact_text: data.interact_subjects ? `是。${data.interact_detail}` : '否',
    conflict_of_interest_text: '本研究計畫主持人及所有研究人員聲明，與本研究無利益衝突。',
  };
}

// IRB-003 簡易審查案件申請表（DOC-13）24 個「研究類別」勾選格的 key 順序。
// 順序＝表單閱讀順序（A → B1~B8 → C1~C6 → D → E → F → G1~G3 → H → I1~I2），
// 與 ExpeditedCategory union、inject-doc13.cjs 注入的 {irb003_*} placeholder 一一對應。
const EXPEDITED_CATEGORY_KEYS: ExpeditedCategory[] = [
  'a',
  'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8',
  'c1', 'c2', 'c3', 'c4', 'c5', 'c6',
  'd', 'e', 'f',
  'g1', 'g2', 'g3',
  'h',
  'i1', 'i2',
];

// DOC-13（IRB-003）的勾選格：使用者選到的格子填 ■、其餘填 □，外加 I2 的自由說明文字。
// 只有「簡審」會真的用到這份模板；免審/一般審生成時 expedited_category 多半是空陣列，
// 整張表渲染成全 □（一張合法空白表），不會壞。docgen 不挑文件、一律備好這批 key（與其他 prepareXxx 同模式）。
function prepareExpeditedData(data: FormData) {
  const picked = new Set(data.expedited_category || []);
  // 用 EXPEDITED_CATEGORY_KEYS 一次組出 24 個 {irb003_<key>} → ■/□，避免手寫 24 行重複碼。
  const boxes = Object.fromEntries(
    EXPEDITED_CATEGORY_KEYS.map((key) => [`irb003_${key}`, picked.has(key) ? '■' : '□']),
  );
  return {
    ...boxes,
    irb003_other_detail: data.expedited_other_detail || '',
  };
}

function prepareProjectTypeData(data: FormData) {
  return {
    project_type_text: data.project_type === 'new_1yr'
      ? '新增型一年期計畫'
      : data.project_type === 'new_multi'
        ? '新增型多年期計畫'
        : '延續型多年期計畫',
    project_type_cover_text: data.project_type === 'new_1yr'
      ? '■新增型計畫：■一年 □多年'
      : data.project_type === 'new_multi'
        ? '■新增型計畫：□一年 ■多年'
        : '□新增型計畫',
    experiment_types_text: data.experiment_types.length === 0 ? '無' : data.experiment_types.join('、'),
    funding_text: data.needs_funding ? '需經費' : '不需經費',
    // DOC-2 checkbox
    project_type_new: (data.project_type === 'new_1yr' || data.project_type === 'new_multi') ? '■' : '□',
    project_type_1yr: data.project_type === 'new_1yr' ? '■' : '□',
    project_type_multi: data.project_type === 'new_multi' ? '■' : '□',
    project_type_old: data.project_type === 'continuing_multi' ? '■' : '□',
    exp_human: data.experiment_types.includes('human_research') ? '■' : '□',
    exp_gene: data.experiment_types.includes('gene_recombination') ? '■' : '□',
    needs_funding_yes: data.needs_funding ? '■' : '□',
    needs_funding_no: data.needs_funding ? '□' : '■',
    // DOC-4 IRB-004「(2)經費來源(可複選)」勾選欄。
    // 全部 gate 在 needs_funding：不需經費時來源一律 □（沒有經費就沒有來源），
    // 避免 needs_funding 關掉後殘留的 funding_source 仍被勾起。
    // （funding_source 用 ?? [] 防禦：舊草稿/未正規化資料可能沒有此欄位。）
    funding_src_cdc:  data.needs_funding && (data.funding_source ?? []).includes('cdc')   ? '■' : '□',
    funding_src_mohw: data.needs_funding && (data.funding_source ?? []).includes('mohw')  ? '■' : '□',
    funding_src_nstc: data.needs_funding && (data.funding_source ?? []).includes('nstc')  ? '■' : '□',
    funding_src_other: data.needs_funding && (data.funding_source ?? []).includes('other') ? '■' : '□',
    // 「□其他：___」後方自填文字；未勾其他或不需經費時留空
    funding_src_other_text: data.needs_funding && (data.funding_source ?? []).includes('other')
      ? (data.funding_source_other || '') : '',
  };
}

// 各文件的零碎欄位（DOC-4 樣板字 / DOC-6 角色 checkbox 預設 / IRB-002 / co_pi_names）。
// 量太小，獨立成檔反而散；先用 holding pen 收一起，將來某類長大再拆。
function prepareMiscPlaceholders(data: FormData, pi: Personnel) {
  return {
    // DOC-4 固定樣板字
    questionnaire_text: data.has_questionnaire
      ? '問卷內容□ 無     ■ 有（請檢附）'
      : '問卷內容■ 無     □ 有（請檢附）',
    medical_record_text: '病歷記錄用紙之格式■ 無     □ 有（請檢附）',
    outcome_usage_text: '本研究成果歸屬衛生福利部疾病管制署，研究成果得作為傳染病防治政策參考，並投稿學術期刊發表。',
    prior_research_text: '前次人體研究參考資料■ 無     □ 有（請檢附）',
    resource_sufficiency_text: '確保有無足夠資源於受試者保護□ 無     ■ 有',
    conflict_measure_text: '（無利益衝突）',
    // DOC-4
    co_pi_names: data.personnel.filter(p => p.role === 'co_pi').map(p => p.name_zh).join('、') || '（無）',
    // 協同主持人職稱/服務單位（DOC-5 免審申請表用）：與 co_pi_names 同模式，多位用「、」串接。
    // 因免審表「協同主持人」是單一固定列，多位協同主持人只能合併呈現（非逐列）。
    // 無協同主持人時留空字串（不要 fallback「（無）」，免得職稱/單位格出現怪字）。
    co_pi_titles: data.personnel.filter(p => p.role === 'co_pi').map(p => p.title || '').join('、'),
    co_pi_units:  data.personnel.filter(p => p.role === 'co_pi').map(p => p.unit || '').join('、'),
    // DOC-6 角色 checkbox（單份版，逐人版在 generatePerPersonDoc 覆寫）
    role_pi: '□',
    role_co_pi: '□',
    role_researcher: '□',
    role_other: '□',
    // IRB-002 計畫送件核對表（DOC-3）
    irb002_project_title: data.project_title_zh,
    irb002_pi_name: pi.name_zh || '',
    irb002_pi_title: pi.title || '',
    irb002_pi_unit: pi.unit || '',
    // 日期欄帶入「填報日期」（與 DOC-2 封面 filing_date_roc 同源），轉民國年
    irb002_filing_date: toRocDate(data.filing_date),
  };
}

// ===== 簽名資料 =====
//
// 簽名一律用「條件 section + 圖片標籤」的組合：{#pi_has_sig}{%pi_sig}{/pi_has_sig}
//   - 有簽名：section 成立 → {%pi_sig} 被換成簽名圖
//   - 沒簽名：section 整段消失 → 簽章欄維持範本原樣（底線空白），列印後仍可手簽
// why 不直接用 {%pi_sig} 裸標籤：免費版 image module 對空值的行為未定義，
//     包在 section 裡可保證空值時圖片標籤根本不會被處理。
// 主管核章／權責單位／審查會的欄位一律不嵌（走公文流程，必須留白）。
function prepareSignatureData(pi: Personnel) {
  return {
    // 舊草稿沒有 signature_image 欄位（undefined），|| '' 防禦
    pi_has_sig: Boolean(pi.signature_image),
    pi_sig: pi.signature_image || '',
  };
}

function prepareCoverData(data: FormData) {
  const coPis      = data.personnel.filter(p => p.role === 'co_pi');
  const researchers = data.personnel.filter(p => p.role === 'researcher');
  return {
    co_pi_name_1:     coPis[0]?.name_zh || '',
    co_pi_name_2:     coPis[1]?.name_zh || '',
    co_pi_name_3:     coPis[2]?.name_zh || '',
    researcher_name_1: researchers[0]?.name_zh || '',
    researcher_name_2: researchers[1]?.name_zh || '',
    researcher_name_3: researchers[2]?.name_zh || '',
    researcher_name_4: researchers[3]?.name_zh || '',
    co_pi_lines: coPis.map(p => `協同主持人：${p.name_zh}`).join('\n') || '',
    researcher_lines: researchers.map(p => `研究人員：${p.name_zh}`).join('\n') || '',
  };
}

// ===== 準備通用 template data =====
//
// export 目的：讓 scripts/docgen-snapshot.ts 能在 Node 端產出 placeholder 快照，
// 作為 Phase 2 docgen 重構時的迴歸護網。生產程式不需直接呼叫此匯出。
export function prepareCommonData(data: FormData) {
  const pi      = requireSinglePi(data.personnel);
  const contact = findByRole(data.personnel, 'contact') || pi;

  // 經費分年參數：
  // - years：年數（一年期=1）；isMultiYear：是否多年期
  // - rocYears：壹摘要表每列要顯示的民國年（一年期用 project_year，多年期由全程起始日逐年推算）
  // - grandTotal：全程總額 = 各年計算總額加總，讓壹表合計與逐年列相加一致（一年期等同 calcTotal）
  const isMultiYear = data.project_type !== 'new_1yr';
  // years 必須與 isMultiYear 同源：一年期一律 1 張表，避免「project_type=new_1yr 但 project_years
  // 殘留 3」的矛盾態（即時填表未經 normalize 時可能發生）→ 會產生 3 張表卻年度全用 project_year
  // （= 經費表「3 張都 115 年」的災情）。多年期才採用使用者填/推算的年數。
  const years = isMultiYear ? Math.max(1, Number(data.project_years) || 1) : 1;
  const baseRoc = Number(getRocDateParts(data.full_execution_start || data.execution_start).y);
  const rocYears = Array.from({ length: years }, (_, k) =>
    isMultiYear
      // baseRoc 須為有效民國年（> 0）才逐年遞增；全程/本年度起始日都沒填時 baseRoc 會是 0 或 NaN，
      // 此時年度留空（讓使用者手填），避免經費表標題出現「0/1/2 年度」這種亂數。
      ? (Number.isFinite(baseRoc) && baseRoc > 0 ? String(baseRoc + k) : '')
      : (data.project_year || ''));
  const budgetItems = data.budget_items || [];
  const grandTotal = data.needs_funding
    ? Array.from({ length: years }, (_, k) => calcTotalYear(budgetItems, k, years)).reduce((a, b) => a + b, 0)
    : 0;

  return {
    ...prepareBasicData(data, pi, contact),
    ...prepareResearchData(data),
    ...prepareIRBData(data),
    ...prepareExpeditedData(data),
    ...prepareIrb002_1Data(data),
    ...prepareProjectTypeData(data),
    ...prepareDatabaseData(data, pi),
    ...prepareScheduleData(data),
    ...prepareMiscPlaceholders(data, pi),
    ...preparePersonnelAppendix(data),
    ...prepareCoverData(data),
    ...prepareSignatureData(pi),
    // 陸、經費需求表（逐年一張表，整張表外包 {#budget_years}、明細內包 {#budget_rows}）
    budget_years: buildBudgetRowsByYear(budgetItems, data.needs_funding, years, rocYears),
    // 壹、綜合資料經費摘要表
    // - budget_summary_years：逐年資料列（DOC-2 row10~13 收成的 {#budget_summary_years} loop）
    // - 其餘 budget_* / apply_amount 是「合計」列；多年期申請金額=全程總額，一年期維持使用者填的 apply_amount
    budget_summary_years: buildBudgetSummaryYears(
      budgetItems, data.needs_funding, years,
      (data.personnel || []).length, isMultiYear, rocYears, data.apply_amount,
    ),
    personnel_count: (data.personnel || []).length,
    // DOC-4 IRB-004「(1)經費需求：＿＿千元」：把全程總額（grandTotal，單位為元）換算成千元。
    // why：IRB-004 表格以「千元」為單位，但表單金額一律存「元」，故除以 1000。
    //      政府計畫書慣例以整數千元呈現，故四捨五入取整數。
    // 不需經費：填一段空格而非空字串。why：金額注入在範本的「底線 run」內，空字串會讓
    //      底線空白整段消失（變「經費需求：千元」）；填空格可保留底線，與官方空白表
    //      「經費需求：＿＿＿千元，■不需經費」一致（■不需經費由 needs_funding_no 勾選）。
    budget_thousand:  data.needs_funding ? Math.round(grandTotal / 1000).toLocaleString() : '　　　　',
    apply_amount:     data.needs_funding
      ? (isMultiYear ? grandTotal.toLocaleString() : (data.apply_amount ? Number(data.apply_amount).toLocaleString() : ''))
      : '',
    budget_total:     data.needs_funding ? grandTotal.toLocaleString() : '',
    budget_personnel: data.needs_funding ? budgetItems.filter(isPersonnel).reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString() : '',
    budget_business:  data.needs_funding ? budgetItems.filter(isBusiness).reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString() : '',
    budget_capital:   data.needs_funding ? budgetItems.filter(isCapital).reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString() : '',
  };
}

// ===== 載入模板 =====

async function loadTemplate(docId: string): Promise<PizZip> {
  const url = `/templates/${docId}.docx`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`無法載入模板 ${docId}: ${response.statusText}`);
  const buffer = await response.arrayBuffer();
  return new PizZip(buffer);
}

// ===== 生成單份文件 =====

async function generateDoc(docId: string, templateData: Record<string, unknown>): Promise<Blob> {
  const zip = await loadTemplate(docId);
  // 簽名圖嵌入模組。每次生成都建新的 instance，避免跨文件共用內部圖片狀態。
  //   getImage：data URL → 二進位 bytes
  //   getSize：讀 PNG 檔頭原始寬高 → 等比縮到簽章欄放得下的尺寸
  const imageModule = new ImageModule({
    centered: false,
    getImage: (tagValue: string) => base64DataUrlToUint8Array(tagValue),
    getSize: (_img: Uint8Array, tagValue: string) => fitSignatureSize(getPngSize(tagValue)),
  });
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
    modules: [imageModule, fixDocPrCorruption],
  });
  doc.render(templateData);
  return doc.getZip().generate({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
}

// ===== 生成逐人文件（每位人員一份）=====

async function generatePerPersonDoc(
  docId: string,
  baseData: Record<string, unknown>,
  personnel: Personnel[],
): Promise<{ filename: string; blob: Blob }[]> {
  const results: { filename: string; blob: Blob }[] = [];

  for (const person of personnel) {
    const personData = {
      ...baseData,
      person_name_zh:  person.name_zh,
      person_title:    person.title,
      person_unit:     person.unit,
      person_phone:    person.phone,
      person_email:    person.email,
      person_id_number: person.id_number,
      // 逐人簽名（DOC-6 立同意書人、DOC-7 立書人）：每份文件帶「該人自己」的簽名。
      // 沒簽的人 section 不成立 → 簽名欄留白可手簽。改這裡要同步改
      // scripts/docgen-snapshot.ts 的 mergePerPersonData（手抄鏡像）。
      person_has_sig:  Boolean(person.signature_image),
      person_sig:      person.signature_image || '',
      // 角色 checkbox（覆寫 baseData 的預設值）
      role_pi:         person.role === 'pi' ? '■' : '□',
      role_co_pi:      person.role === 'co_pi' ? '■' : '□',
      role_researcher: person.role === 'researcher' ? '■' : '□',
      role_other:      !['pi', 'co_pi', 'researcher'].includes(person.role) ? '■' : '□',
    };

    const blob = await generateDoc(docId, personData);
    const docName = DOC_NAMES[docId as DocId] || docId;
    results.push({ filename: `${docName}（${person.name_zh}）.docx`, blob });
  }

  return results;
}

// ===== 主要生成函式 =====

export async function generateAllDocuments(
  data: FormData,
  selectedDocs: DocId[],
): Promise<void> {
  const commonData = prepareCommonData(data);
  const zip = new JSZip();

  for (const docId of selectedDocs) {
    try {
      if (PER_PERSON_DOCS.has(docId)) {
        const results = await generatePerPersonDoc(docId, commonData, data.personnel);
        for (const { filename, blob } of results) {
          zip.file(filename, blob);
        }
      } else {
        const blob = await generateDoc(docId, commonData);
        const docName = DOC_NAMES[docId] || docId;
        zip.file(`${docName}.docx`, blob);
      }
    } catch (err) {
      throw new Error(`生成 ${DOC_NAMES[docId] || docId} 失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const projectName = data.project_title_zh.slice(0, 20) || '研究計畫';
  saveAs(zipBlob, `${projectName}_文件包.zip`);
}
