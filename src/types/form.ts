// ===== Forminator 表單終結者 — 核心型別定義 =====

export type ProjectType = 'new_1yr' | 'new_multi' | 'continuing_multi';
export type ReviewType = 'exempt' | 'expedited' | 'full';
export type ExemptCategory = 'public_non_interactive' | 'public_info' | 'public_policy' | 'education' | 'minimal_risk';
export type PersonnelRole = 'pi' | 'co_pi' | 'researcher' | 'contact' | 'assistant';
export type Gender = 'male' | 'female';
export type OutcomeType = 'policy' | 'report' | 'paper_writing' | 'paper_publish' | 'other';
export type ResearchPurposeType = 'internal_research' | 'thesis' | 'no_fund_research' | 'other';
export type DeliveryFormat = 'paper' | 'digital';
export type AnalysisLocation = 'office' | 'personal_pc' | 'other_platform' | 'data_center';
export type ExperimentType = 'human_research' | 'gene_recombination' | 'animal' | 'biosafety_level2' | 'high_risk_pathogen';
export type FundingSource = 'cdc' | 'mohw' | 'nstc' | 'other';
export type ApplySystem = 'warehouse' | 'other';
// 倉儲系統可選的中文欄位；other 表示自填
export type DataFieldKey =
  | 'case_id'        // 傳染病報告單電腦編號
  | 'gender'         // 性別
  | 'residence'      // 居住縣市
  | 'onset_date'     // 發病日期(西元-yyyymmdd)
  | 'main_symptom'   // 主要症狀
  | 'is_dead'        // 是否死亡
  | 'death_date'     // 死亡日期(西元-yyyymmdd)
  | 'other';         // 其他（使用者自填）

// ===== 子結構 =====

export interface BudgetItem {
  id: string;          // preset key ('irb_fee' | 'travel' | 'meal' | 'misc' | 'mgmt') 或 uuid（自訂）
  name: string;        // 項目名稱
  category: string;    // '人事費' | '業務費' | '管理費'
  is_custom: boolean;  // 使用者自訂項目
  amount: string;      // 金額（字串，空白表示未填）
  note: string;        // 說明
  active?: boolean;    // false = 使用者手動停用（目前只用於管理費）
}

export interface GanttItem {
  task_name: string;
  months: boolean[];
}

export interface Education {
  degree: string;       // 博士/碩士/學士/其他
  degree_other: string; // degree === '其他' 時的自填內容
  school: string;
  department: string;
  grad_year: string;    // 民國年
}

export interface WorkHistory {
  institution: string;  // 服務機關及單位
  title: string;        // 職稱
  start_ym: string;     // 起（民國年月，如 110/07）
  end_ym: string;       // 訖（如 114/04 或「迄今」）
}

export interface Project {
  status: 'completed' | 'ongoing' | 'pending';  // 已完成/執行中/申請中
  project_name: string;
  role: string;          // 擔任角色（自由文字）
  funder: string;        // 補助機關
  budget: string;        // 經費
  start_ym: string;      // 起年月
  end_ym: string;        // 迄年月
  summary: string;       // 摘要（附表二：role=主持人且有經費時填寫）
}

export interface Publication {
  title: string;    // 著作名稱
  journal: string;  // 期刊／出版來源
  year: string;     // 發表年（民國）
  authors: string;  // 作者群
}

export interface Personnel {
  role: PersonnelRole;
  name_zh: string;
  name_en: string;
  title: string;
  unit: string;
  phone: string;
  fax: string;
  email: string;
  address: string;
  gender: Gender | '';
  birth_date: string;
  id_number: string;
  official_phone: string;
  irb_training_cert: string;
  work_description: string;
  // 附表一、二、三
  education: Education[];
  expertise: string;
  irb_training_hours: number;
  work_history: WorkHistory[];
  projects: Project[];
  publications: string;  // 近三年著作清單（自由文字）
}

export interface OutcomeTypeDetail {
  type: OutcomeType;
  count: number;
  note: string;
}

// ===== 主表單資料結構 =====

export interface FormData {
  // §2.2.1 基本資訊
  project_title_zh: string;
  project_title_en: string;
  project_year: string;
  project_id: string;
  project_type: ProjectType;
  execution_start: string;
  execution_end: string;
  responsible_unit: string;
  filing_date: string;
  research_focus: string;
  has_questionnaire: boolean;
  experiment_types: ExperimentType[];
  needs_funding: boolean;
  apply_amount: string;  // 申請金額（使用者填寫，帶入壹、綜合資料）

  // §2.2.2 人員
  personnel: Personnel[];

  // §2.2.3 研究內容
  purpose: string;
  background: string;
  methodology: string;
  expected_outcome: string;
  abstract_zh: string;
  abstract_en: string;
  keywords_zh: string;
  keywords_en: string;
  outcome_type: OutcomeType[];
  outcome_type_detail: OutcomeTypeDetail[];
  references: string;
  gantt_chart: GanttItem[];

  // §2.2.4 IRB 審查資訊
  review_type: ReviewType;
  exempt_category: ExemptCategory | '';
  exempt_reason: string;
  data_source: string;
  recruit_subjects: boolean;
  recruit_method: string;
  interact_subjects: boolean;
  interact_detail: string;
  privacy_during: string;
  privacy_after: string;
  privacy_withdrawal: string;

  // §2.2.5 經費
  budget_items: BudgetItem[];

  // §2.2.6 機關配合協調
  has_coordination: boolean;

  // §2.2.7 資料庫申請
  apply_unit: string;
  research_purpose_type: ResearchPurposeType;
  research_purpose_other_detail: string;
  analysis_deadline: string;
  retention_deadline: string;
  delivery_format: DeliveryFormat;
  analysis_location: AnalysisLocation[];
  pi_same_as_applicant: boolean;
  cross_link_data_center: boolean;

  // 資料庫申請系統與欄位（DOC-8、DOC-9、DOC-10、DOC-11 共用）
  apply_system: ApplySystem;            // 申請系統：倉儲系統 / 其他
  apply_system_other: string;           // apply_system === 'other' 時的自填名稱
  apply_year: string;                   // 申請年度（西元 YYYY-MM-DD，沿用 DatePicker 格式）
  apply_condition: string;              // 擷取資料條件（病名、菌名），例：「2018至2025年麻疹確定個案」
  data_fields: DataFieldKey[];          // 選用的中文欄位（僅 apply_system='warehouse' 時有效）
  data_fields_other: string;            // data_fields 包含 'other' 時的自填內容
}

// ===== 跑關流程 =====

export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  documents: string[];
  refDocuments?: { label: string }[];  // 非 forminator 產生、需自備的參考文件
  signatureNotes?: string[];           // 需親簽的說明
  contact?: {
    name: string;
    unit: string;
    email: string;
    phone: string;
  };
}

// ===== JSON 匯出格式 =====

export interface ExportData {
  sdd_version: string;
  exported_at: string;
  project_name: string;
  data: FormData;
}

export interface PersonnelProfileExport {
  type: 'pi_profile';
  version: string;
  exported_at: string;
  personnel: Omit<Personnel, 'role'>;
}
