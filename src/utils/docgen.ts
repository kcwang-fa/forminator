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
import { ROLE_MAP, EXEMPT_MAP } from './docgenMaps';
import { prepareDatabaseData } from './docgen/database';

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

function prepareGanttData(data: FormData, pi: Personnel) {
  return {
    schedule_text: `執行期間：${toRocDate(data.execution_start)} 至 ${toRocDate(data.execution_end)}\n${
      data.gantt_chart.length > 0
        ? data.gantt_chart.map(g =>
            `${g.task_name}：${g.months.map((m: boolean, i: number) => m ? `第${i + 1}月` : '').filter(Boolean).join('、')}`
          ).join('\n')
        : '（請參閱署內研究計畫書）'
    }`,
    gantt_chart_text: data.gantt_chart.length > 0
      ? data.gantt_chart.map(g =>
          `${g.task_name}：${g.months.map((m, i) => m ? `第${i + 1}月` : '').filter(Boolean).join('、')}`
        ).join('\n')
      : '（請參閱署內研究計畫書）',
    gantt_rows: data.gantt_chart.map(g => {
      const row: Record<string, string> = { task_name: g.task_name };
      for (let i = 0; i < 12; i++) row[`m${i + 1}`] = g.months[i] ? '■' : '';
      return row;
    }),
    personnel_equipment_text: data.personnel.map(p =>
      `${ROLE_MAP[p.role] || p.role}：${p.name_zh}（${p.unit} ${p.title}）— ${p.work_description || '研究資料分析與報告撰寫'}`
    ).join('\n'),
    personnel_rows: data.personnel.map(p => ({
      role_text: ROLE_MAP[p.role] || p.role,
      name_zh: p.name_zh,
      title: p.title,
      unit: p.unit,
      work_description: p.work_description || '研究資料分析與報告撰寫',
    })),
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
    // 資料庫申請單的共同參與研究人員／實際處理資料人員：帶入除 PI 外的所有已填人員
    db_personnel: data.personnel.filter(p => p.role !== 'pi' && !!p.name_zh.trim()).map(p => ({
      name_zh: p.name_zh,
      unit: p.unit,
      title: p.title,
      phone: p.phone,
    })),
    // IRB-002
    irb002_project_title: data.project_title_zh,
    irb002_pi_name: pi.name_zh || '',
    irb002_pi_title: pi.title || '',
    irb002_pi_unit: pi.unit || '',
  };
}

function preparePersonnelAppendix(data: FormData) {
  const ROLE_LABEL: Record<string, string> = {
    pi: '主持人', co_pi: '協同主持人', researcher: '研究人員',
  };
  const GENDER_LABEL: Record<string, string> = {
    male: '男', female: '女',
  };

  const toProj = (proj: FormData['personnel'][0]['projects'][0]) => ({
    proj_name:     proj.project_name,
    proj_role:     proj.role,
    proj_budget:   proj.budget || '無',
    proj_funder:   proj.funder,
    proj_start_ym: proj.start_ym,
    proj_end_ym:   proj.end_ym,
  });

  const members = data.personnel.filter(p => ['pi', 'co_pi', 'researcher'].includes(p.role));

  return {
    personnel_appendix: members.map(p => {
      const piProjects = (p.projects || []).filter(proj => proj.role === '主持人' && !!proj.budget);
      const completed  = (p.projects || []).filter(pr => pr.status === 'completed');
      const ongoing    = (p.projects || []).filter(pr => pr.status === 'ongoing');
      const pending    = (p.projects || []).filter(pr => pr.status === 'pending');

      return {
        pa_role_label:   ROLE_LABEL[p.role] || p.role,
        pa_name_zh:      p.name_zh,
        pa_gender_label: GENDER_LABEL[p.gender] || '',
        pa_birth_date:   p.birth_date || '',
        pa_education: (p.education || []).map(e => ({
          edu_degree:    e.degree === '其他' ? (e.degree_other || '其他') : (e.degree || ''),
          edu_school:    [e.school, e.department].filter(Boolean).join(' '),
          edu_grad_year: e.grad_year || '',
        })),
        pa_work_history: (p.work_history || []).map(wh => ({
          wh_institution: wh.institution,
          wh_title:       wh.title,
          wh_start_ym:    wh.start_ym,
          wh_end_ym:      wh.end_ym,
        })),
        pa_completed:    completed.map(toProj),
        pa_no_completed: completed.length === 0,
        pa_ongoing:      ongoing.map(toProj),
        pa_no_ongoing:   ongoing.length === 0,
        pa_pending:      pending.map(toProj),
        pa_no_pending:   pending.length === 0,
        pa_has_pi_proj:     piProjects.length > 0,
        pa_no_pi_proj:      piProjects.length === 0,
        pa_pi_proj_name:    piProjects[0]?.project_name || '',
        pa_pi_proj_pi:      p.name_zh,
        pa_pi_proj_funder:  piProjects[0]?.funder || '',
        pa_pi_proj_period:  piProjects[0] ? `${piProjects[0].start_ym}～${piProjects[0].end_ym}` : '',
        pa_pi_proj_budget:  piProjects[0]?.budget || '',
        pa_pi_proj_summary: piProjects[0]?.summary || '',
        pa_publications_text: p.publications || '',
      };
    }),
    personnel_appendix_count: members.length,
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
    ...prepareGanttData(data, pi),
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
