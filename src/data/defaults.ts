// ===== MVP 預設值：署內無經費資料庫回溯性研究 =====

import type { FormData, Personnel, Education, WorkHistory, Project, BudgetItem } from '../types/form';

export const SDD_VERSION = '1.3.0';

export const emptyEducation: Education = {
  degree: '',
  degree_other: '',
  school: '',
  department: '',
  grad_year: '',
};

export const emptyWorkHistory: WorkHistory = {
  institution: '',
  title: '',
  start_ym: '',
  end_ym: '',
};

export const emptyProject: Project = {
  status: 'completed',
  project_name: '',
  role: '',
  funder: '',
  budget: '',
  start_ym: '',
  end_ym: '',
  summary: '',
};


/** 空白人員模板 */
export const emptyPersonnel: Personnel = {
  role: 'pi',
  name_zh: '',
  name_en: '',
  title: '',
  unit: '',
  phone: '',
  fax: '',
  email: '',
  address: '',
  gender: '',
  birth_date: '',
  id_number: '',
  official_phone: '',
  irb_training_cert: '',
  work_description: '',
  education: [],
  expertise: '',
  irb_training_hours: 0,
  work_history: [],
  projects: [],
  publications: '',
};

/** 預設經費項目（含 tooltip 說明） */
export const BUDGET_PRESETS: { id: string; name: string; category: string; tooltip: string; auto?: boolean }[] = [
  // 業務費（經常門）
  { id: 'consumable',  name: '消耗品',     category: '業務費', tooltip: '辦公或研究所需消耗性材料，核實報支。' },
  { id: 'maintenance', name: '設備養護費', category: '業務費', tooltip: '既有設備之維修保養費用，核實報支。' },
  { id: 'office',      name: '一般事務費', category: '業務費', tooltip: '辦公文具、印刷、郵資等一般行政事務費用。' },
  { id: 'travel',      name: '差旅費',     category: '業務費', tooltip: '依行政院「國內出差旅費報支要點」規定辦理。' },
  // 資本門
  { id: 'hardware',  name: '軟硬體設備費', category: '資本門', tooltip: '購置研究所需軟體授權或硬體設備，依預算規定辦理。' },
  // 人事費（經常門）
  { id: 'pi_fee',    name: '計畫主持人費', category: '人事費', tooltip: '以新臺幣 2 萬元／月為上限。' },
  { id: 'co_pi_fee', name: '協同主持人費', category: '人事費', tooltip: '以 1 萬 8 千元／月為上限。' },
  { id: 'ra_fee',    name: '研究人力費',   category: '人事費', tooltip: '依受委託單位自訂標準核實支給；在本計畫支領專任薪資者，不得再支領本部其他計畫薪資。' },
  // 管理費（自動計算）
  { id: 'mgmt', name: '管理費', category: '管理費', tooltip: '自動計算：(人事費 + 業務費 - 主持人費 - 協同主持人費) × 15%。', auto: true },
];

export const defaultBudgetItems: BudgetItem[] = BUDGET_PRESETS.map(p => ({
  id: p.id,
  name: p.name,
  category: p.category,
  is_custom: false,
  amount: '',
  note: '',
}));

/** §1.5 MVP 預設值 */
export const defaultFormData: FormData = {
  // 基本資訊
  project_title_zh: '',
  project_title_en: '',
  project_year: String(new Date().getFullYear() - 1911), // 民國年
  project_id: '',
  project_type: 'new_1yr',
  execution_start: '',
  execution_end: '',
  responsible_unit: '',
  filing_date: '',
  research_focus: '',
  has_questionnaire: false,
  experiment_types: [],
  needs_funding: false,
  apply_amount: '',
  budget_items: defaultBudgetItems,

  // 人員 — 預設一位 PI
  personnel: [{ ...emptyPersonnel, role: 'pi' }],

  // 研究內容
  purpose: '',
  background: '',
  methodology: '',
  expected_outcome: '',
  abstract_zh: '',
  abstract_en: '',
  keywords_zh: '',
  keywords_en: '',
  outcome_type: ['paper_writing'],
  outcome_type_detail: [{ type: 'paper_writing', count: 1, note: '' }],
  references: '',
  gantt_chart: [],

  // IRB 審查 — MVP 預設免審
  review_type: 'exempt',
  exempt_category: 'public_info',
  exempt_reason: '本研究為次級資料研究，資料皆已去識別化。',
  data_source: '本研究使用疾管署防疫資料庫，依據「衛生福利部疾病管制署防疫資料庫員工研究計畫使用申請作業說明」提出申請，並檢附本 IRB 審查通過證明文件後，依序完成資料權責單位、資訊室及企劃組審核，經一層核定後取得去識別化資料。',
  recruit_subjects: false,
  recruit_method: '',
  interact_subjects: false,
  interact_detail: '',
  privacy_during: '本研究使用之資料庫已去除個人識別資訊，研究過程中所有資料皆儲存於符合 ISMS 資訊安全管理規範之加密環境中，僅限經授權之研究人員得以接觸分析資料。',
  privacy_after: '研究成果僅以群體統計量呈現，不揭露任何個案資訊。原始分析資料於計畫結束後保留三年，届滿後依機關資料銷毀程序辦理。',
  privacy_withdrawal: '本研究採用次級資料庫進行分析，無法回溯識別個別研究對象，故無中途退出之情形。',

  // 機關配合協調 — MVP 預設無
  has_coordination: false,

  // 資料庫申請 — MVP 預設
  apply_unit: '',
  research_purpose_type: 'no_fund_research',
  analysis_deadline: '',
  retention_deadline: '',
  delivery_format: 'digital',
  analysis_location: ['office', 'personal_pc'],
  pi_same_as_applicant: true,
  cross_link_data_center: false,
};

/**
 * 文件名稱對照表 — DOC 編號的唯一權威來源
 *
 * DOC-2 = 署內研究計畫書（完整：封面 + 壹~捌主體 + 附表一/二/三）← inject-doc2.cjs
 * DOC-4 = IRB-004 研究計畫書                                       ← inject-doc4.cjs
 * 兩者不同，勿混淆。
 */
// DOC_NAMES 是文件 ID → 中文名稱的對應表，也是 DocId 型別的唯一來源。
// 新增文件時：在這裡加一行，TypeScript 會自動更新 DocId，planConfigs 可直接使用。
export const DOC_NAMES = {
  'DOC-1': '研究計畫簽呈（含公文系統操作說明）',
  'DOC-2': '署內研究計畫書',           // 完整文件：封面 + 壹~捌 + 附表一/二/三
  'DOC-3': 'IRB-002 計畫送件核對表',
  'DOC-4': 'IRB-004 研究計畫書',       // IRB 審查用，非署內計畫書
  'DOC-5': 'IRB-012 免審申請表',
  'DOC-6': 'IRB-018 保密切結書（研究人員）',
  'DOC-7': '資料庫保密切結書（署內員工使用）',
  'DOC-8': '資料庫使用申請單',
} as const;

export type DocId = keyof typeof DOC_NAMES;
