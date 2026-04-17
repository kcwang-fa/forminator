// ===== 文件生成邏輯 =====

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { FormData, Personnel } from '../types/form';
import { toRocDate } from './date';
import { DOC_NAMES } from '../data/defaults';
import { buildBudgetRows } from './budgetCalc';

// ===== 靜態對照表 =====

const ROLE_MAP: Record<string, string> = {
  pi: '計畫主持人',
  co_pi: '協同主持人',
  researcher: '研究人員',
  contact: '計畫聯絡人',
  assistant: '研究助理',
};

const EXEMPT_MAP: Record<string, string> = {
  public_non_interactive: '於公共場所進行之非介入性研究，且非以可辨識個人之方式利用',
  public_info: '使用已合法公開之資料或文件，且資訊之使用無涉可辨識之個資',
  public_policy: '公共政策之成效評估研究，且非以可辨識個人之方式利用',
  education: '於一般教學環境中進行之教育評量或測試、教學技巧之研究',
  minimal_risk: '研究計畫屬最低風險，且所蒐集之個資經加密處理',
};

const PURPOSE_MAP: Record<string, string> = {
  internal_research: '署內科技研究計畫',
  thesis: '碩、博士論文',
  no_fund_research: '無需經費研究計畫',
  other: '其他',
};

const ANALYSIS_LOCATION_MAP: Record<string, string> = {
  office: '本署署內辦公場域',
  personal_pc: '個人公務電腦',
  other_platform: '其他分析平台',
  data_center: '資科中心',
};

const OUTCOME_TYPE_MAP: Record<string, string> = {
  policy: '提供決策',
  report: '研究報告',
  paper_writing: '論文寫作',
  paper_publish: '論文發表',
  other: '其他',
};

/** 哪些文件需要逐人生成（每人一份） */
const PER_PERSON_DOCS = new Set(['DOC-6', 'DOC-7']);

// ===== 輔助函式 =====

function findByRole(personnel: Personnel[], role: string): Personnel | undefined {
  return personnel.find(p => p.role === role);
}

// ===== 子資料準備函式 =====

function prepareBasicData(data: FormData, pi: Personnel, contact: Personnel) {
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
    apply_date_roc: toRocDate(data.filing_date),

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
    purpose_brief: data.purpose.slice(0, 50) + (data.purpose.length > 50 ? '...' : ''),
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

function prepareDatabaseData(data: FormData, pi: Personnel) {
  const outcomeDetails = data.outcome_type_detail;
  const findOutcome = (t: string) => outcomeDetails.find(o => o.type === t);

  return {
    apply_unit: data.apply_unit,
    analysis_deadline_roc: toRocDate(data.analysis_deadline),
    retention_deadline_roc: toRocDate(data.retention_deadline),
    research_purpose_type_text: PURPOSE_MAP[data.research_purpose_type] || data.research_purpose_type,
    delivery_format_text: data.delivery_format === 'digital' ? '數位檔案' : '紙本',
    analysis_location_text: data.analysis_location.map(loc => ANALYSIS_LOCATION_MAP[loc] || loc).join('、'),
    outcome_type_text: outcomeDetails.map(o =>
      `${OUTCOME_TYPE_MAP[o.type] || o.type} ${o.count} 件`
    ).join('、'),
    pi_same_text: data.pi_same_as_applicant
      ? '同申請人員'
      : `${pi.name_zh || ''} / ${pi.title || ''} / ${pi.unit || ''}`,
    cross_link_text: data.cross_link_data_center ? '是' : '否',
    db_usage_scope: '（請於列印後手動填寫）',
    // DOC-8 checkbox
    purpose_internal: data.research_purpose_type === 'internal_research' ? '■' : '□',
    purpose_thesis: data.research_purpose_type === 'thesis' ? '■' : '□',
    purpose_no_fund: data.research_purpose_type === 'no_fund_research' ? '■' : '□',
    purpose_other: data.research_purpose_type === 'other' ? '■' : '□',
    purpose_other_detail: '',
    delivery_paper: data.delivery_format === 'paper' ? '■' : '□',
    delivery_digital: data.delivery_format === 'digital' ? '■' : '□',
    loc_office: data.analysis_location.includes('office') ? '■' : '□',
    loc_pc: data.analysis_location.includes('personal_pc') ? '■' : '□',
    loc_other: data.analysis_location.includes('other_platform') ? '■' : '□',
    loc_data_center: data.analysis_location.includes('data_center') ? '■' : '□',
    pi_same: data.pi_same_as_applicant ? '■' : '□',
    cross_link_no: data.cross_link_data_center ? '□' : '■',
    cross_link_yes: data.cross_link_data_center ? '■' : '□',
    cross_link_db_name: '',
    // 成果類型 checkbox 和計數
    outcome_policy: findOutcome('policy') ? '■' : '□',
    outcome_policy_count: findOutcome('policy')?.count?.toString() || '___',
    outcome_report: findOutcome('report') ? '■' : '□',
    outcome_report_count: findOutcome('report')?.count?.toString() || '___',
    outcome_paper_writing: findOutcome('paper_writing') ? '■' : '□',
    outcome_paper_writing_count: findOutcome('paper_writing')?.count?.toString() || '___',
    outcome_paper_publish: findOutcome('paper_publish') ? '■' : '□',
    outcome_paper_publish_count: findOutcome('paper_publish')?.count?.toString() || '___',
    outcome_other: findOutcome('other') ? '■' : '□',
    outcome_other_count: findOutcome('other')?.count?.toString() || '___',
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
    // 資料庫人員
    db_personnel: data.personnel.filter(p => p.role !== 'pi').map(p => ({
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

function prepareCommonData(data: FormData) {
  const pi      = findByRole(data.personnel, 'pi') || data.personnel[0];
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
    const docName = DOC_NAMES[docId] || docId;
    results.push({ filename: `${docName}（${person.name_zh}）.docx`, blob });
  }

  return results;
}

// ===== 主要生成函式 =====

export async function generateAllDocuments(
  data: FormData,
  selectedDocs: string[],
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
