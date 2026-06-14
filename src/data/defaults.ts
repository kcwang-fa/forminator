// ===== MVP 預設值：署內無經費資料庫回溯性研究 =====

import type { FormData, Personnel, Education, WorkHistory, Project, BudgetItem, DatabaseRequest, ReviewScreening, MulticenterSite } from '../types/form';

export const SDD_VERSION = '1.9.0';

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

export const emptyDatabaseRequest: DatabaseRequest = {
  apply_system: 'warehouse',
  apply_system_other: '',
  apply_condition: '',
  data_fields: [],
  data_fields_other: [],
  doc8_field_purposes: [],
  db_usage_scope_item: '',
  db_usage_scope_item_manual: false,
};

export const emptyReviewScreening: ReviewScreening = {
  data_use_types: [],
  specimen_use_types: [],
  vulnerable_populations: [],
  data_identifiability: '',
  is_minimal_risk: null,
  has_direct_subject_contact: false,
  has_high_risk_procedure: false,
  has_discrimination_risk: false,
  recording_is_identifiable_or_sensitive: false,
  has_other_irb_approval: false,
  notes: '',
};

export const emptyMulticenterSite: MulticenterSite = {
  country: '',
  city: '',
  location: '',
  contact: '',
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
  signature_image: '',
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
  year_amounts: [''],  // 預設一年期，一格空白；多年期由 formNormalization 依 project_years 補長度
  amount: '',          // 全程總額（= year_amounts 加總），衍生欄位
  note: '',
}));

/** §1.5 MVP 預設值 */
export const defaultFormData: FormData = {
  // 成果類別：預設三項全勾，維持原本「免審一次產出全部文件」的行為
  output_categories: ['research_plan', 'irb', 'database'],

  // 基本資訊
  project_title_zh: '',
  project_title_en: '',
  project_year: String(new Date().getFullYear() - 1911), // 民國年
  project_id: '',
  project_type: 'new_1yr',
  project_years: '1',
  execution_start: '',
  execution_end: '',
  full_execution_start: '',
  full_execution_end: '',
  responsible_unit: '',
  filing_date: '',
  research_focus: '',
  has_questionnaire: false,
  experiment_types: [],
  needs_funding: false,
  apply_amount: '',
  funding_source: [],
  funding_source_other: '',
  budget_items: defaultBudgetItems,

  // 人員 — 預設一位 PI
  personnel: [{ ...emptyPersonnel, role: 'pi' }],

  // 研究內容
  purpose: '',
  yearly_objectives: '',  // 分年計劃目的（僅多年期顯示，docgen 多年期時併入研究主旨）
  background: '',
  summary_of_results: '',  // 三、多年期計畫之執行成果概要（一年期由 docgen 填「不適用」）
  methodology: '',
  expected_outcome: '',
  abstract_zh: '',
  abstract_en: '',
  keywords_zh: '',
  keywords_en: '',
  outcome_type: [],
  outcome_type_detail: [],
  references: '',
  gantt_chart: [],

  // IRB 審查 — MVP 預設免審；使用者可用 Step 1 篩檢器改判。
  review_type: 'exempt',
  review_type_source: 'default',
  review_screening: { ...emptyReviewScreening },
  exempt_category: ['public_info'],  // 可複選，預設「使用已合法公開之資料」
  expedited_category: [],   // 簡審 IRB-003 研究類別，預設空白，由 Step4 簡審分支按鈕帶入或手勾
  expedited_other_detail: '',  // 簡審 IRB-003 I2「請詳細說明」自由文字
  // IRB-002-1（DOC-12）後半段欄位；知情同意不預選，必須由使用者明確作答。
  expedited_subject_relationship: 'researcher_subject',
  expedited_subject_relationship_other_detail: '',
  expedited_has_control_group: false,
  expedited_control_group_type: '',
  expedited_control_group_other_detail: '',
  expedited_control_consent_form: null,
  expedited_consent_design: null,
  expedited_consent_proof_methods: [],
  expedited_consent_proof_other_detail: '',
  expedited_consent_sources: [],
  expedited_consent_source_other_detail: '',
  expedited_waive_signature_reason: '',
  expedited_waive_consent_reason: '',
  expedited_has_followup: false,
  expedited_followup_period: '',
  expedited_needs_dsmp: false,
  is_multicenter: false,
  multicenter_type: '',
  multicenter_sites: [],
  exempt_reason: '本研究為次級資料研究，資料皆已去識別化。',
  data_source: '',  // 研究方法及工具描述，使用者自填（或用「帶入 Step 3 研究方法」按鈕帶入）
  inclusion_criteria: '',  // 研究對象納入條件，使用者據實填寫
  exclusion_criteria: '',  // 研究對象排除條件，使用者據實填寫
  recruit_subjects: false,
  recruit_method: '',
  subject_count: '',  // 研究對象估計人數（簡審；自由文字）
  subject_explainer: '',  // 何人會要求研究對象參與/向研究對象解釋；獨立於是否招募
  subject_population_groups: [],  // 研究對象族群（簡審；空＝沿用審查小幫手自動判斷）
  subject_patient_disease_name: '',
  subject_cdc_staff_reason: '',
  subject_population_other_detail: '',
  subject_roster_methods: [],  // 研究對象名單取得方式（簡審才用、招募＝是時才填）
  subject_roster_existing_db_name: '',
  subject_roster_existing_project_name: '',
  subject_roster_other_detail: '',
  irb0021_has_specimen: null,
  irb0021_has_new_specimen: null,
  irb0021_has_existing_specimen: null,
  irb0021_has_data: null,
  irb0021_has_new_data: null,
  irb0021_has_existing_data: null,
  irb0021_data_deidentified: null,
  // 研究類別「檢體採集／防疫用驗餘檢體」的種類底線格：空＝沿用審查小幫手自動草稿（見 irb0021.ts）。
  irb0021_cat_specimen_detail: '',
  irb0021_cat_residual_detail: '',
  specimen_new_detail: '',
  specimen_existing_detail: '',
  data_new_detail: '',
  data_existing_detail: '',
  data_deidentification_detail: '',
  interact_subjects: false,
  interact_detail: '',
  privacy_during: '',
  privacy_after: '',
  privacy_withdrawal: '',

  // 機關配合協調 — MVP 預設無
  has_coordination: false,

  // 資料庫申請 — MVP 預設
  apply_unit: '',
  research_purpose_type: 'no_fund_research',
  research_purpose_other_detail: '',
  analysis_deadline: '',
  retention_deadline: '',
  delivery_format: 'digital',
  analysis_location: ['office', 'personal_pc'],
  pi_same_as_applicant: true,
  cross_link_data_center: false,
  cross_link_db_name: '',  // 連結之資料庫名稱（DOC-8 / DOC-12 共用；cross_link_data_center=true 才有意義）

  apply_date: '',
  apply_year_start: '',
  apply_year_end: '',
  irb_number: '',
  db_apply_purpose: '',
  database_requests: [{ ...emptyDatabaseRequest }],
};

/**
 * 文件名稱對照表 — DOC 編號的唯一權威來源
 *
 * DOC-2 = 署內研究計畫書（完整：封面 + 壹~捌主體 + 附表一/二/三）← inject-doc2.cjs
 * DOC-4 = IRB-004 研究計畫書                                       ← inject-doc4.cjs
 * 兩者不同，勿混淆。
 *
 * ── 新手筆記：為什麼這張表是「唯一權威來源」？ ──
 * 下面 `DocId` 型別是「從這張表的 key 自動長出來的」（keyof typeof DOC_NAMES）。
 * 意思是：你只要在這裡加一行（例如 'DOC-12'），整個專案凡是用到 DocId 的地方
 *（planConfigs 的 docs 陣列、docgen 的文件清單、ZIP 預選…）就都「自動」認得它，
 * 而且如果你哪裡打錯字（寫成 'DOC-21'），TypeScript 會在編譯時直接報錯給你看。
 * → 這就是「型別安全鷹架」：把「改 A 忘了改 B」交給編譯器幫你抓，而不是靠記憶。
 */
export const DOC_NAMES = {
  'DOC-1': '研究計畫簽呈（含公文系統操作說明）',
  'DOC-2': '署內研究計畫書',           // 完整文件：封面 + 壹~捌 + 附表一/二/三
  'DOC-3': 'IRB-002 計畫送件核對表',
  'DOC-4': 'IRB-004 研究計畫書',       // IRB 審查用，非署內計畫書
  'DOC-5': 'IRB-012 免審申請表',       // 免審加填（exempt only）
  'DOC-6': 'IRB-018 保密切結書（研究人員）',
  'DOC-7': '資料庫保密切結書（署內員工使用）',
  'DOC-8': '資料庫使用申請單',
  'DOC-9': '資料庫申請簽呈（含公文系統操作說明）',
  'DOC-10': '個人資料利用申請表',
  'DOC-11': '應用系統維護單',
  // ── 簡審 / 一般審用（依 IRB-001 流程圖：簡審加填 IRB-002-1 + IRB-003；一般審加填 IRB-002-1）──
  // ⚠️ 目前只「鋪好編號位子」：public/templates/ 還沒有 DOC-12/13.docx，
  //    要等 scripts/inject-doc12.cjs / inject-doc13.cjs 寫好、產出模板後才能真的生成文件。
  //    在那之前 planConfigs.expedited 維持 ready:false，UI 不會讓使用者真的下載。
  'DOC-12': 'IRB-002-1 人體研究計畫申請表',  // 簡審 + 一般審共用
  'DOC-13': 'IRB-003 簡易審查案件申請表',    // 簡審專用
} as const;

// DocId = DOC_NAMES 的所有 key 組成的 union 型別（'DOC-1' | 'DOC-2' | … | 'DOC-13'）。
// 不用手寫，會跟著上面那張表自動長大。
export type DocId = keyof typeof DOC_NAMES;

// ── 還沒有 .docx 模板、暫時不能「生成」的文件 ──
// 用途：把「public/templates/ 還沒有對應 .docx」的 DOC 排除在可生成清單外
//（見 planConfigs.ts 的 resolveActivePlan），避免使用者選了卻 fetch 404。
// 新增計畫類型時，若某份文件的 inject 腳本 / docgen 還沒做好，先把它的 DocId 放進這個陣列；
// 等模板產出、docgen 接好後再移除，文件就會自動出現在可生成清單裡。
// 目前 DOC-1~13 全部備妥（DOC-12/13 已於簡審 Phase 1+2 接完、Phase 3 開放），故為空陣列。
export const DOCS_WITHOUT_TEMPLATE: DocId[] = [];
