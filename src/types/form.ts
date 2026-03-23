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

// ===== 子結構 =====

export interface GanttItem {
  task_name: string;
  months: boolean[];
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

  // §2.2.5 經費（MVP 全隱藏）
  // §2.2.6 機關配合協調
  has_coordination: boolean;

  // §2.2.7 資料庫申請
  apply_unit: string;
  research_purpose_type: ResearchPurposeType;
  analysis_deadline: string;
  retention_deadline: string;
  delivery_format: DeliveryFormat;
  analysis_location: AnalysisLocation[];
  pi_same_as_applicant: boolean;
  cross_link_data_center: boolean;
}

// ===== 跑關流程 =====

export interface WorkflowStep {
  step: number;
  title: string;
  description: string;
  documents: string[];
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
