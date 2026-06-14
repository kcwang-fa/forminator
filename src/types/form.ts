// ===== Forminator 表單終結者 — 核心型別定義 =====

export type ProjectType = 'new_1yr' | 'new_multi' | 'continuing_multi';
export type ReviewType = 'exempt' | 'expedited' | 'full';
export type ReviewTypeSource = 'default' | 'screening' | 'manual';
// 本次要產出的「成果類別」（可複選），與 review_type 是正交的兩個軸：
// review_type 決定「IRB 那一包是哪幾份文件」，OutputCategory 決定「整體要產出哪幾類成果」。
// 配置（每類涵蓋的文件與步驟）放在 data/planConfigs.ts 的 OUTPUT_CATEGORY_CONFIGS。
export type OutputCategory = 'research_plan' | 'irb' | 'database';
export type ExemptCategory = 'public_non_interactive' | 'public_info' | 'public_policy' | 'education' | 'minimal_risk';
// IRB-003 簡易審查案件申請表的「研究類別」勾選項（A~I，每個值＝表單上一個勾選格）。
// 命名刻意對齊 inject-doc13.cjs 的 24 個 placeholder（{irb003_a}、{irb003_b1}…），
// docgen 直接用 `irb003_${value}` 組 key，少一層對照表、改名時兩邊一起動。
// 是「可複選陣列」（仿 ExemptCategory）：表單原文每個分類底下可勾多個具體情形。
//   A      = 採血（手指/腳跟/耳朵/靜脈，符合採血量頻率限制）
//   B1~B8  = 非侵入性方法採集人體檢體（毛髮指甲/拔牙/排泄物/唾液/洗牙/刮取漱口/痰液/其他）
//   C1~C6  = 非侵入性方法收集資料（感應器/體重感覺/MRI/心電圖等/適度運動/其他）
//   D      = 臨床常規治療或診斷之病歷（不含 HIV 陽性病歷）
//   E      = 以研究為目的蒐集之錄音/錄影/影像（不含可辨識或敏感影響）
//   F      = 研究個人或群體特質或行為（不含造成歧視之潛在可能）
//   G1~G3  = 已審查通過之計畫（不再收新案僅長期追蹤/僅展延期間未增案/僅後續資料分析）
//   H      = 自合法生物資料庫取得之去連結或無法辨識資料
//   I1~I2  = 其他（承接其他合法審查會通過之計畫 / 不符合以上但具特殊性質，須詳細說明）
export type ExpeditedCategory =
  | 'a'
  | 'b1' | 'b2' | 'b3' | 'b4' | 'b5' | 'b6' | 'b7' | 'b8'
  | 'c1' | 'c2' | 'c3' | 'c4' | 'c5' | 'c6'
  | 'd'
  | 'e'
  | 'f'
  | 'g1' | 'g2' | 'g3'
  | 'h'
  | 'i1' | 'i2';
// IRB-002-1（DOC-12）後半段「主持人與研究對象之關係」單選（對齊 DOC-12 那一列 7 個勾選格）。
export type ExpeditedSubjectRelationship =
  | 'researcher_subject'  // 研究者／研究對象（回溯性資料庫研究的常態）
  | 'medical_patient'     // 醫療人員／病人
  | 'teacher_student'     // 老師／學生
  | 'employer_employee'   // 雇主／職員
  | 'friend'              // 朋友
  | 'cdc_staff'           // 本署人員
  | 'other';              // 其它
// IRB-002-1（DOC-12）「是否有對照組」之 A. 類別單選。
export type ExpeditedControlGroupType =
  | 'case_control'          // 個案病例對照
  | 'placebo_experimental'  // 安慰劑及／或實驗對照
  | 'other';                // 其它
// IRB-002-1（DOC-12）後半段「知情同意設計」單選（對齊 DOC-12 那 3 個主問勾選格）。
export type ExpeditedConsentDesign =
  | 'provide'             // 設計研究對象說明同意書並提供
  | 'waive_signature'     // 申請免除簽署但須告知
  | 'waive_full';         // 申請免除知情同意（回溯性次級資料研究常見）
// IRB-002-1（DOC-12）「如何證明知情同意有落實執行」可複選。
export type ConsentProofMethod =
  | 'signed_datetime'
  | 'witness_signature'
  | 'team_record'
  | 'other';
// IRB-002-1（DOC-12）「研究對象說明暨同意書將從何處取得」可複選。
export type ConsentSource =
  | 'subject'
  | 'parent'
  | 'guardian'
  | 'authorized_person'
  | 'legal_representative'
  | 'other';
// IRB-002-1（DOC-12）第 8 點（3）「研究對象名單取得方式」可複選（對齊 DOC-12 那 5 個勾選格）。
// 只在簡審「是否招募研究對象＝是」時於 Step4 顯示；docgen 把選到的格翻成 ■ 注入 DOC-12。
export type SubjectRosterMethod =
  | 'public'           // 公開招募
  | 'sampling'         // 系統性抽樣
  | 'existing_db'      // 既有資訊系統或資料庫（名稱由 subject_roster_existing_db_name 注入 DOC-12）
  | 'existing_project' // 既有計畫的研究對象名單
  | 'other';           // 其他（說明由 subject_roster_other_detail 注入 DOC-12）
// IRB-002-1（DOC-12）第 8 點（2）「研究對象為下列哪一族群」可複選（對齊 DOC-12 那 10 個勾選格）。
// 簡審 Step4 顯示；空陣列＝沿用審查小幫手（review_screening）自動判斷，使用者勾了就以勾選為準（可覆寫）。
// 特定病人疾病名稱 / 本署人員理由 / 其他說明等自由文字由對應 subject_*_detail 欄位注入 DOC-12。
export type SubjectPopulationGroup =
  | 'adult'       // 一般成人
  | 'adolescent'  // 青少年
  | 'child'       // 兒童／嬰幼兒
  | 'patient'     // 特定病人
  | 'indigenous'  // 少數民族
  | 'pregnant'    // 孕婦
  | 'disability'  // 殘障人士
  | 'prisoner'    // 受刑人
  | 'cdc_staff'   // 本署人員
  | 'other';      // 其他
export type MulticenterType = 'domestic' | 'international';
export type PersonnelRole = 'pi' | 'co_pi' | 'researcher' | 'contact' | 'assistant';
export type Gender = 'male' | 'female';
export type OutcomeType = 'policy' | 'report' | 'paper_writing' | 'paper_publish' | 'other';
export type ResearchPurposeType = 'internal_research' | 'thesis' | 'no_fund_research' | 'other';
export type DeliveryFormat = 'paper' | 'digital';
export type AnalysisLocation = 'office' | 'personal_pc' | 'other_platform' | 'data_center';
export type ExperimentType = 'human_research' | 'gene_recombination' | 'animal' | 'biosafety_level2' | 'high_risk_pathogen';
// DOC-4 IRB-004「(2)經費來源(可複選)」：可複選的經費來源機關
export type FundingSource = 'cdc' | 'mohw' | 'nstc' | 'other';
export type ApplySystem = 'warehouse' | 'other';
export type ReviewDataUseType =
  | 'education_evaluation'
  | 'public_policy_evaluation'
  | 'public_non_interactive_observation'
  | 'minimal_risk_new_data'
  | 'noninvasive_measurement'
  | 'behavior_or_trait'
  | 'recording_or_image'
  | 'deidentified_database'
  | 'medical_record'
  | 'business_data'
  | 'public_info'
  | 'other_existing_data'
  | 'other_new_data';
export type ReviewSpecimenUseType =
  | 'limited_blood_draw'
  | 'new_noninvasive_specimen'
  | 'cdc_residual_specimen'
  | 'remaining_specimen_original_consent'
  | 'external_remaining_specimen_original_consent'
  | 'legal_biobank_unlinkable'
  | 'cdc_residual_non_original_with_clinical_report'
  | 'strain_or_virus'
  | 'other_specimen';
export type ReviewVulnerablePopulation =
  | 'minor'
  | 'prisoner'
  | 'indigenous'
  | 'pregnant'
  | 'disability'
  | 'mental_illness'
  | 'hiv_positive'
  | 'tb_case'
  | 'new_immigrant_or_migrant'
  | 'long_term_care_resident'
  | 'other_vulnerable';
export type ReviewDataIdentifiability =
  | 'provider_deidentified_unidentifiable'
  | 'coded_researcher_unidentifiable'
  | 'identifiable_or_linkable'
  | 'public_or_legally_open'
  | 'unknown';
export type ReviewDecisionConfidence = 'incomplete' | 'clear' | 'needs_review';
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
  // 多年期分年金額：year_amounts[k] = 第 k 年此項目金額（字串，空白表示未填）。
  // 一年期長度為 1。長度應等於 project_years（formNormalization 會補裁）。
  year_amounts: string[];
  // amount = 全程總額（= year_amounts 加總），保留欄位名以相容舊存檔與既有讀取點
  //（calcTotal 等讀此欄，代表「全程」金額）。
  // 真相來源是 year_amounts；任何寫入 year_amounts 後都要重算此欄。
  amount: string;
  note: string;        // 說明
  active?: boolean;    // false = 使用者手動停用（目前只用於管理費）
}

// 一列工作項目：名稱 + 該年內每個月是否執行（months 長度 = 該年實際月數，最後一年可能 < 12）
export interface GanttItem {
  task_name: string;
  months: boolean[];
}

// 一個年度的甘特資料：該年自己一組工作項目列。
// 多年期計畫每年的工作項目可以完全不同（rows 各自獨立），這也是為什麼
// gantt_chart 從「全程扁平一大張」改成「每年一組」的巢狀結構。
// 年度標籤（第一年/114 年度…）不存在資料裡，由執行起迄日衍生（UI 與 docgen 各自計算）。
export interface GanttYear {
  rows: GanttItem[];
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
  // 電子簽名圖（base64 PNG data URL，如 'data:image/png;base64,...'）。
  // 空字串 = 尚未簽名 → 生成文件時簽章欄留白，列印後仍可手簽。
  // why 放在 Personnel 而非獨立 map：人員沒有穩定 id，用 index/姓名當 key
  //     會在 Step2 刪人或改名時把簽名張冠李戴；欄位跟著人走最安全。
  // 舊草稿沒有此欄位（undefined），讀取時一律用 (p.signature_image || '') 防禦。
  signature_image: string;
}

export interface OutcomeTypeDetail {
  type: OutcomeType;
  count: number;
  note: string;
  publish_date: string;
}

export interface DatabaseFieldPurpose {
  field_name: string;
  apply_purpose: string;
}

export interface DatabaseRequest {
  apply_system: ApplySystem;            // 申請系統：倉儲系統 / 其他
  apply_system_other: string;           // apply_system === 'other' 時的自填名稱
  apply_condition: string;              // 擷取資料條件（病名、菌名），例：「2018至2025年麻疹確定個案」
  data_fields: DataFieldKey[];          // 選用的中文欄位（僅 apply_system='warehouse' 時有效）
  data_fields_other: string[];          // data_fields 包含 'other' 時的自填內容（可多筆）
  doc8_field_purposes: DatabaseFieldPurpose[]; // DOC-8 每個中文欄位名稱對應的個別申請目的
  db_usage_scope_item: string;          // 單一申請系統的使用範圍明細
  db_usage_scope_item_manual: boolean;  // true 表示使用者已手動修改，不再自動覆寫
}

export interface ReviewScreening {
  data_use_types: ReviewDataUseType[];
  specimen_use_types: ReviewSpecimenUseType[];
  vulnerable_populations: ReviewVulnerablePopulation[];
  data_identifiability: ReviewDataIdentifiability | '';
  is_minimal_risk: boolean | null;
  has_direct_subject_contact: boolean;
  has_high_risk_procedure: boolean;
  has_discrimination_risk: boolean;
  recording_is_identifiable_or_sensitive: boolean;
  has_other_irb_approval: boolean;
  notes: string;
}

export interface ReviewDecision {
  review_type: ReviewType | null;
  confidence: ReviewDecisionConfidence;
  suggested_exempt_category?: ExemptCategory;
  reasons: string[];
  matched_rules: string[];
  warnings: string[];
}

export interface ExemptIrbDraftText {
  exempt_reason: string;
  data_source: string;
  privacy_during: string;
  privacy_after: string;
  privacy_withdrawal: string;
}

export interface MulticenterSite {
  country: string;
  city: string;
  location: string;
  contact: string;
}

// ===== 主表單資料結構 =====

export interface FormData {
  // §2.2.0 成果類別（Step1 最前面選，決定後續步驟與產出文件）
  output_categories: OutputCategory[];

  // §2.2.1 基本資訊
  project_title_zh: string;
  project_title_en: string;
  project_year: string;
  project_id: string;
  project_type: ProjectType;
  project_years: string;          // 多年期計畫共幾年；一年期固定為 1
  execution_start: string;        // 本年度／本次執行起始日
  execution_end: string;          // 本年度／本次執行截止日
  full_execution_start: string;   // 全程計畫起始日；一年期可同 execution_start
  full_execution_end: string;     // 全程計畫截止日；一年期可同 execution_end
  responsible_unit: string;
  filing_date: string;
  research_focus: string;
  has_questionnaire: boolean;
  experiment_types: ExperimentType[];
  needs_funding: boolean;
  apply_amount: string;  // 申請金額（使用者填寫，帶入壹、綜合資料）
  // DOC-4 IRB-004「(2)經費來源(可複選)」：勾選的來源機關 + 「其他」自填文字
  funding_source: FundingSource[];
  funding_source_other: string;

  // §2.2.2 人員
  personnel: Personnel[];

  // §2.2.3 研究內容
  purpose: string;
  // 分年計劃目的：僅多年期計畫需填寫（逐年的分年目的）。原本與 purpose 擠在同一欄位的
  // 「【分年目的】」段落已獨立成這個欄位；docgen 多年期時會把 purpose（全程總目標）與本欄
  // 合併注入 DOC-2「一、研究主旨」。一年期不顯示、不進文件。
  yearly_objectives: string;
  background: string;
  // 三、多年期計畫之執行成果概要：僅多年期計畫需填寫（新案概述主持人過去相關成果、
  // 延續案敘明初步成果並逐年檢視分年目標）。一年期計畫由 docgen 自動填入「不適用」字樣。
  summary_of_results: string;
  methodology: string;
  expected_outcome: string;
  abstract_zh: string;
  abstract_en: string;
  keywords_zh: string;
  keywords_en: string;
  outcome_type: OutcomeType[];
  outcome_type_detail: OutcomeTypeDetail[];
  references: string;
  gantt_chart: GanttYear[];

  // §2.2.4 IRB 審查資訊
  review_type: ReviewType;
  review_type_source: ReviewTypeSource;
  review_screening: ReviewScreening;
  // IRB-012 表單「研究類別」原文標注「可複選」，故此處用陣列；
  // EXEMPT_MAP 會把每個選到的類別轉成文字、以「；」串接帶入文件。
  exempt_category: ExemptCategory[];
  // IRB-003 簡易審查案件申請表「研究類別」勾選（A~I，可複選；簡審才用到）。
  // 由 Step4 簡審分支「帶入審查小幫手建議分類」按鈕依 review_screening 預帶，再手動增減；
  // docgen 把每個選到的格子轉成 ■、未選轉 □ 注入 DOC-13（見 prepareExpeditedData）。
  expedited_category: ExpeditedCategory[];
  // IRB-003 I2「不符合以上但具特殊性質」的自由說明文字（注入 {irb003_other_detail}）。
  expedited_other_detail: string;
  // IRB-002-1（DOC-12）後半段欄位：簡審 Step4 收集、docgen 翻 ■/□ 注入 DOC-12 後半段勾選格
  // （見 docgen.prepareIrb002_1Data）。預設值貼合「署內回溯性資料庫研究」常態：
  // 研究者／研究對象關係、無對照組、申請免除知情同意、不追蹤、不需 DSMP。使用者可在 Step4 改。
  expedited_subject_relationship: ExpeditedSubjectRelationship;
  // IRB-002-1（DOC-12）「主持人與研究對象之關係」選「其它」時的請說明文字。
  expedited_subject_relationship_other_detail: string;
  expedited_has_control_group: boolean;
  expedited_control_group_type: ExpeditedControlGroupType | '';
  expedited_control_group_other_detail: string;
  // null = 尚未作答；只在有對照組時顯示並要求選擇，避免系統擅自預勾「否」。
  expedited_control_consent_form: boolean | null;
  // null = 尚未作答；必須明確選擇使用同意書、免除簽署但告知，或免除知情同意。
  expedited_consent_design: ExpeditedConsentDesign | null;
  // 使用同意書或免除簽署但仍告知時，至少選一種知情同意落實證明方式。
  expedited_consent_proof_methods: ConsentProofMethod[];
  expedited_consent_proof_other_detail: string;
  // 使用研究對象說明同意書時，勾選同意書取得來源。
  expedited_consent_sources: ConsentSource[];
  expedited_consent_source_other_detail: string;
  // IRB-002-1（DOC-12）知情同意主選項的附帶理由。
  expedited_waive_signature_reason: string;
  expedited_waive_consent_reason: string;
  expedited_has_followup: boolean;
  // IRB-002-1（DOC-12）「是否進行追蹤＝是」時的追蹤期間。
  expedited_followup_period: string;
  expedited_needs_dsmp: boolean;
  // IRB-002-1（DOC-12）多中心資料：多中心類型決定勾選格，sites 逐列輸出官方四欄表格。
  is_multicenter: boolean;
  multicenter_type: MulticenterType | '';
  multicenter_sites: MulticenterSite[];
  exempt_reason: string;
  data_source: string;
  // IRB-012 表單「研究對象納入及排除條件」第 (1)(2) 點，免審也需據實填寫
  // （例：納入＝2018–2025 確診個案、排除＝資料不全者），由 inject-doc5 注入 DOC-5。
  inclusion_criteria: string;
  exclusion_criteria: string;
  recruit_subjects: boolean;
  recruit_method: string;
  // IRB-002-1（DOC-12）第 8 點（1）研究對象估計人數（自由文字，如「約 500」）。簡審 Step4 填、注入 {subject_count}。
  subject_count: string;
  // IRB-002-1（DOC-12）「何人會要求研究對象參與研究，或向研究對象解釋？」的請說明自由文字。
  // 簡審／一般審由 Step4 填，獨立於 recruit_subjects；docgen 原樣帶入、inject-doc12 注入
  // {subject_explainer}。回溯性資料研究可寫「本研究不直接接觸研究對象」。
  subject_explainer: string;
  // IRB-002-1（DOC-12）第 8 點（2）研究對象族群（可複選）。簡審 Step4 顯示；空陣列＝沿用審查小幫手自動判斷，
  // 使用者勾了就以勾選為準（覆寫），docgen.prepareIrb002_1Data 翻成 ■ 注入 DOC-12 的 irb0021_pop_* 勾選格。
  subject_population_groups: SubjectPopulationGroup[];
  subject_patient_disease_name: string;
  subject_cdc_staff_reason: string;
  subject_population_other_detail: string;
  // IRB-002-1（DOC-12）第 8 點（3）研究對象名單取得方式（可複選）。簡審才用到、且只在「是否招募＝是」時於
  // Step4 顯示；docgen.prepareIrb002_1Data 把選到的格翻成 ■ 注入 DOC-12 的 irb0021_roster_* 勾選格。
  subject_roster_methods: SubjectRosterMethod[];
  subject_roster_existing_db_name: string;
  subject_roster_existing_project_name: string;
  subject_roster_other_detail: string;
  // IRB-002-1（DOC-12）檢體問項。null 代表尚未手動覆寫，沿用 review_screening 推導結果；
  // boolean 代表使用者已在 Step4 明確選擇，文件勾選以此為準。
  irb0021_has_specimen: boolean | null;
  irb0021_has_new_specimen: boolean | null;
  irb0021_has_existing_specimen: boolean | null;
  // IRB-002-1（DOC-12）資料問項。null 代表尚未手動覆寫，沿用 review_screening 推導結果。
  irb0021_has_data: boolean | null;
  irb0021_has_new_data: boolean | null;
  irb0021_has_existing_data: boolean | null;
  // IRB-002-1（DOC-12）「研究資料是否去識別化／去連結」。null 時沿用 review_screening 推導。
  irb0021_data_deidentified: boolean | null;
  // IRB-002-1（DOC-12）第 3 題「研究類別」中「檢體採集」「防疫用驗餘檢體」後方的
  // 「(請述明檢體種類)」底線格。空字串＝沿用審查小幫手已勾檢體類型自動帶入的種類草稿；
  // 非空＝使用者在 Step4 手填覆寫（草稿是「處理分類」label，使用者可改成實際種類如血液、咽喉拭子）。
  irb0021_cat_specimen_detail: string;
  irb0021_cat_residual_detail: string;
  // IRB-002-1（DOC-12）檢體／資料說明文字。
  specimen_new_detail: string;
  specimen_existing_detail: string;
  data_new_detail: string;
  data_existing_detail: string;
  // IRB-002-1（DOC-12）「研究資料是否去識別化／去連結＝是」時的程序與研究者接觸個資說明。
  data_deidentification_detail: string;
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
  // 與其他資料庫連結時的資料庫名稱（自由文字）。cross_link_data_center 為 true 才有意義。
  // 同一個值餵兩份文件：DOC-8 資料庫使用申請單、DOC-12 IRB-002-1 第 11 題，皆注入 {cross_link_db_name}。
  cross_link_db_name: string;
  apply_date: string;                   // 申請日期（西元 YYYY-MM-DD）
  apply_year_start: string;             // 資料擷取期間起（西元 YYYY-MM-DD）
  apply_year_end: string;               // 資料擷取期間迄（西元 YYYY-MM-DD）
  irb_number: string;                   // IRB 編號
  db_apply_purpose: string;             // DOC-8 中文欄位旁的申請目的（可由 LLM 生成後手動編修）
  database_requests: DatabaseRequest[]; // 多個申請系統明細（DOC-8、DOC-9、DOC-10、DOC-11 共用）
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
