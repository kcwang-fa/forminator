// ===== 文件生成邏輯 =====

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { FormData, Personnel } from '../types/form';
import { toRocDate } from './date';
import { DOC_NAMES } from '../data/defaults';

// ===== 角色中文對照 =====
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

// ===== 找出特定角色人員 =====
function findByRole(personnel: Personnel[], role: string): Personnel | undefined {
  return personnel.find(p => p.role === role);
}

// ===== 準備通用 template data =====
function prepareCommonData(data: FormData) {
  const pi = findByRole(data.personnel, 'pi') || data.personnel[0];
  const contact = findByRole(data.personnel, 'contact') || pi;

  return {
    // 基本
    project_title_zh: data.project_title_zh,
    project_title_en: data.project_title_en,
    project_year: data.project_year,
    responsible_unit: data.responsible_unit,
    execution_start_roc: toRocDate(data.execution_start),
    execution_end_roc: toRocDate(data.execution_end),
    filing_date_roc: toRocDate(data.filing_date),

    // PI
    pi_name_zh: pi?.name_zh || '',
    pi_title: pi?.title || '',
    pi_unit: pi?.unit || '',
    pi_phone: pi?.phone || '',
    pi_fax: pi?.fax || '',
    pi_email: pi?.email || '',
    pi_address: pi?.address || '',

    // 聯絡人
    contact_name_zh: contact?.name_zh || '',
    contact_title: contact?.title || '',
    contact_unit: contact?.unit || '',
    contact_phone: contact?.phone || '',
    contact_fax: contact?.fax || '',
    contact_email: contact?.email || '',
    contact_address: contact?.address || '',

    // 研究內容
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

    // IRB
    data_source: data.data_source,
    privacy_during: data.privacy_during,
    privacy_after: data.privacy_after,
    privacy_withdrawal: data.privacy_withdrawal,
    exempt_category_text: data.exempt_category ? EXEMPT_MAP[data.exempt_category] || data.exempt_category : '',
    exempt_reason: data.exempt_reason,
    recruit_text: data.recruit_subjects ? `是。${data.recruit_method}` : '否',
    interact_text: data.interact_subjects ? `是。${data.interact_detail}` : '否',
    conflict_of_interest_text: '本研究計畫主持人及所有研究人員聲明，與本研究無利益衝突。',

    // 計畫類別
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

    // 資料庫
    apply_unit: data.apply_unit,
    analysis_deadline_roc: toRocDate(data.analysis_deadline),
    retention_deadline_roc: toRocDate(data.retention_deadline),
    research_purpose_type_text: PURPOSE_MAP[data.research_purpose_type] || data.research_purpose_type,
    delivery_format_text: data.delivery_format === 'digital' ? '數位檔案' : '紙本',
    analysis_location_text: data.analysis_location.map(loc => {
      const map: Record<string, string> = {
        office: '本署署內辦公場域',
        personal_pc: '個人公務電腦',
        other_platform: '其他分析平台',
        data_center: '資科中心',
      };
      return map[loc] || loc;
    }).join('、'),
    outcome_type_text: data.outcome_type_detail.map(o => {
      const map: Record<string, string> = {
        policy: '提供決策',
        report: '研究報告',
        paper_writing: '論文寫作',
        paper_publish: '論文發表',
        other: '其他',
      };
      return `${map[o.type] || o.type} ${o.count} 件`;
    }).join('、'),
    pi_same_text: data.pi_same_as_applicant ? '同申請人員' : `${pi?.name_zh || ''} / ${pi?.title || ''} / ${pi?.unit || ''}`,
    cross_link_text: data.cross_link_data_center ? '是' : '否',
    db_usage_scope: '（請於列印後手動填寫）',

    // 甘特圖文字版
    gantt_chart_text: data.gantt_chart.length > 0
      ? data.gantt_chart.map(g =>
        `${g.task_name}：${g.months.map((m, i) => m ? `第${i + 1}月` : '').filter(Boolean).join('、')}`
      ).join('\n')
      : '（請參閱署內研究計畫書）',

    // 人力配置 (for DOC-4 loop)
    personnel_rows: data.personnel.map(p => ({
      role_text: ROLE_MAP[p.role] || p.role,
      name_zh: p.name_zh,
      title: p.title,
      unit: p.unit,
      work_description: p.work_description || '研究資料分析與報告撰寫',
    })),

    // 資料庫人員 (for DOC-6 loop)
    db_personnel: data.personnel.filter(p => p.role !== 'pi').map(p => ({
      name_zh: p.name_zh,
      unit: p.unit,
      title: p.title,
      phone: p.phone,
    })),

    // 封面用
    co_pi_lines: data.personnel
      .filter(p => p.role === 'co_pi')
      .map(p => `協同主持人：${p.name_zh}`)
      .join('\n') || '',
    researcher_lines: data.personnel
      .filter(p => p.role === 'researcher')
      .map(p => `研究人員：${p.name_zh}`)
      .join('\n') || '',
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
  const out = doc.getZip().generate({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  return out;
}

// ===== 生成保密切結書（每人一份）=====
async function generatePerPersonDoc(
  docId: string,
  baseData: Record<string, unknown>,
  personnel: Personnel[],
): Promise<{ filename: string; blob: Blob }[]> {
  const results: { filename: string; blob: Blob }[] = [];

  for (const person of personnel) {
    const personData = {
      ...baseData,
      person_name_zh: person.name_zh,
      person_title: person.title,
      person_unit: person.unit,
      person_phone: person.phone,
      person_email: person.email,
      person_id_number: person.id_number,
    };

    const blob = await generateDoc(docId, personData);
    const docName = DOC_NAMES[docId] || docId;
    const filename = `${docName}（${person.name_zh}）.docx`;
    results.push({ filename, blob });
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
      if (docId === 'DOC-3' || docId === 'DOC-5') {
        // 保密切結書：每位人員一份
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
      console.error(`生成 ${docId} 失敗:`, err);
      throw new Error(`生成 ${DOC_NAMES[docId] || docId} 失敗：${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 打包 ZIP
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const projectName = data.project_title_zh.slice(0, 20) || '研究計畫';
  saveAs(zipBlob, `${projectName}_文件包.zip`);
}
