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
// file-saver 是 CJS 套件，無具名 ESM 匯出。用 default import + destructure，
// 讓 Vite 和 Node 原生 ESM（snapshot 腳本用）都能解析。
import fileSaver from 'file-saver';
const { saveAs } = fileSaver;
import type { FormData, Personnel } from '../types/form';
import { toRocDate } from './date';
import { DOC_NAMES, type DocId } from '../data/defaults';
import { buildBudgetRows, calcTotal, isPersonnel, isBusiness, isCapital } from './budgetCalc';
import { EXEMPT_MAP } from './docgenMaps';
import { prepareDatabaseData } from './docgen/database';
import { preparePersonnelAppendix } from './docgen/personnelAppendix';
import { prepareScheduleData } from './docgen/schedule';

// DOC-6（IRB-018 保密切結書）和 DOC-7（資料庫保密切結書）需要每位研究人員各一份
const PER_PERSON_DOCS = new Set<DocId>(['DOC-6', 'DOC-7']);

// ===== 輔助函式 =====

function findByRole(personnel: Personnel[], role: string): Personnel | undefined {
  return personnel.find(p => p.role === role);
}

// ===== 子資料準備函式 =====

function prepareBasicData(data: FormData, pi: Personnel, contact: Personnel) {
  const applyDate = data.apply_date || data.filing_date;
  const executionPeriodText = data.execution_start && data.execution_end
    ? `${toRocDate(data.execution_start)}至${toRocDate(data.execution_end)}`
    : data.execution_start
      ? toRocDate(data.execution_start)
      : data.execution_end
        ? toRocDate(data.execution_end)
        : '';

  return {
    project_title_zh: data.project_title_zh,
    project_title_en: data.project_title_en,
    project_year: data.project_year,
    responsible_unit: data.responsible_unit,
    execution_start_roc: toRocDate(data.execution_start),
    execution_end_roc: toRocDate(data.execution_end),
    exec_start_y: data.execution_start ? String(new Date(data.execution_start).getFullYear() - 1911) : '',
    exec_start_m: data.execution_start ? String(new Date(data.execution_start).getMonth() + 1) : '',
    exec_start_d: data.execution_start ? String(new Date(data.execution_start).getDate()) : '',
    exec_end_y: data.execution_end ? String(new Date(data.execution_end).getFullYear() - 1911) : '',
    exec_end_m: data.execution_end ? String(new Date(data.execution_end).getMonth() + 1) : '',
    exec_end_d: data.execution_end ? String(new Date(data.execution_end).getDate()) : '',
    filing_date_roc: toRocDate(data.filing_date),
    signing_date_roc: toRocDate(data.filing_date),
    apply_date_roc: toRocDate(applyDate),
    execution_period_text: executionPeriodText,

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
  return {
    purpose: data.purpose,
    background: data.background,
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
    privacy_during: data.privacy_during,
    privacy_after: data.privacy_after,
    privacy_withdrawal: data.privacy_withdrawal,
    exempt_category_text: data.exempt_category ? (EXEMPT_MAP[data.exempt_category] || data.exempt_category) : '',
    exempt_reason: data.exempt_reason,
    recruit_text: data.recruit_subjects ? `是。${data.recruit_method}` : '否',
    interact_text: data.interact_subjects ? `是。${data.interact_detail}` : '否',
    conflict_of_interest_text: '本研究計畫主持人及所有研究人員聲明，與本研究無利益衝突。',
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
  };
}

// 各文件的零碎欄位（DOC-4 樣板字 / DOC-6 角色 checkbox 預設 / IRB-002 / co_pi_names）。
// 量太小，獨立成檔反而散；先用 holding pen 收一起，將來某類長大再拆。
function prepareMiscPlaceholders(data: FormData, pi: Personnel) {
  return {
    // DOC-4 固定樣板字
    funding_detail_text: data.needs_funding
      ? '(1)經費需求：＿＿＿千元\n(2)經費來源(可複選)：\n  □疾病管制署  □衛生福利部  □國家科學及技術委員會 □其他：＿＿＿'
      : '(1)經費需求：＿＿＿千元，■不需經費\n(2)經費來源(可複選)：\n  □疾病管制署  □衛生福利部  □國家科學及技術委員會 □其他：＿＿＿',
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
  const pi      = findByRole(data.personnel, 'pi') ?? data.personnel[0];
  if (!pi) throw new Error('表單中至少需要一位計畫主持人（PI）');
  const contact = findByRole(data.personnel, 'contact') || pi;

  return {
    ...prepareBasicData(data, pi, contact),
    ...prepareResearchData(data),
    ...prepareIRBData(data),
    ...prepareProjectTypeData(data),
    ...prepareDatabaseData(data, pi),
    ...prepareScheduleData(data),
    ...prepareMiscPlaceholders(data, pi),
    ...preparePersonnelAppendix(data),
    ...prepareCoverData(data),
    // 經費概算
    budget_no_items: !data.needs_funding,
    budget_rows: buildBudgetRows(data.budget_items || [], data.needs_funding),
    // 壹、綜合資料經費摘要表
    personnel_count: (data.personnel || []).length,
    apply_amount:     data.needs_funding && data.apply_amount ? Number(data.apply_amount).toLocaleString() : '',
    budget_total:     data.needs_funding ? calcTotal(data.budget_items || []).toLocaleString() : '',
    budget_personnel: data.needs_funding ? (data.budget_items || []).filter(isPersonnel).reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString() : '',
    budget_business:  data.needs_funding ? (data.budget_items || []).filter(isBusiness).reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString() : '',
    budget_capital:   data.needs_funding ? (data.budget_items || []).filter(isCapital).reduce((s, i) => s + (Number(i.amount) || 0), 0).toLocaleString() : '',
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
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
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
