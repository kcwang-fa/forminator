// ===== IRB-002-1 人體研究計畫申請表（DOC-12）後半段勾選格 placeholder 準備 =====
//
// DOC-12 後半段是一大張「□ 勾選表」。scripts/inject-doc12.cjs 已把其中 80 個勾選格換成
// {irb0021_*} placeholder；這支檔案負責「把它們填成 ■（勾）或 □（不勾）」。
//
// ── 設計原則（沿用簡審 Phase 1「重用、不另寫判斷」）──
// 後半段大多可以從使用者**前面步驟已經填過的**資料推導，不必再問一次：
//   - review_screening（審查類型小幫手）：素材類型 / 弱勢族群 / 去識別化 / 是否接觸個案…
//   - 既有 IRB 欄位：recruit_subjects（招募）、cross_link_data_center（資料庫連結）
//   - 簡審新增的 expedited_* 欄位：與研究對象關係 / 對照組 / 知情同意 / 追蹤 / DSMP（Step4 可改）
// 研究類別只勾「高信心」的格，模糊的留 □ 由使用者在 Word 手勾。
//
// ⚠️ 這裡的 key 名稱必須與 scripts/inject-doc12.cjs 的 BOX_BLOCKS 完全一致（都是 irb0021_*）。

import type {
  FormData,
  ReviewDataUseType,
  ReviewScreening,
  ReviewSpecimenUseType,
  ReviewVulnerablePopulation,
  SubjectPopulationGroup,
} from '../../types/form';

// 勾選格小工具：條件成立填 ■（勾）、否則 □（不勾）。
const box = (on: boolean): string => (on ? '■' : '□');

// ── 研究類別（可複選）對照：素材類型 → 哪一個研究類別格 ──
// 只列「能明確對應」的；對不上的不亂歸（留 □ 手勾）。
// 「資料庫分析」：去識別化資料庫 / 其他既有資料或資料庫。
const DB_ANALYSIS_DATA = new Set<ReviewDataUseType>(['deidentified_database', 'other_existing_data']);
// 「檢體採集」研究類別：實際採集／取得的檢體（不含菌株、不含防疫驗餘——那兩類各有自己的格）。
// export：Step4 UI 要用同一份分類判斷「研究類別檢體採集格會不會被勾」，決定是否顯示種類輸入框。
export const COLLECT_SPECIMEN = new Set<ReviewSpecimenUseType>([
  'limited_blood_draw',
  'new_noninvasive_specimen',
  'remaining_specimen_original_consent',
  'external_remaining_specimen_original_consent',
  'legal_biobank_unlinkable',
]);
// 「防疫用驗餘檢體」研究類別。
export const RESIDUAL_SPECIMEN = new Set<ReviewSpecimenUseType>([
  'cdc_residual_specimen',
  'cdc_residual_non_original_with_clinical_report',
]);

// 檢體類型 → 白話 label，用來把審查小幫手已勾的檢體類型自動串成「檢體種類」草稿。
// 這些字跟 ReviewTypeScreening 的選項 label 一致；放這裡（而非 import UI 元件）是因為 docgen
// 也要在 Node（snapshot/smoke）跑，不能依賴 .tsx。注意：label 是「處理分類」（如「限量採血」），
// 不完全等於純種類（如「血液」），故只當草稿、使用者可在 Step4 手改。
const SPECIMEN_TYPE_LABELS: Partial<Record<ReviewSpecimenUseType, string>> = {
  limited_blood_draw: '限量採血',
  new_noninvasive_specimen: '非侵入性新採檢體',
  remaining_specimen_original_consent: '剩餘檢體',
  external_remaining_specimen_original_consent: '外單位剩餘檢體',
  legal_biobank_unlinkable: '合法生物資料庫檢體',
  cdc_residual_specimen: '防疫驗餘檢體',
  cdc_residual_non_original_with_clinical_report: '驗餘檢體非原疾病檢驗',
};

// 把使用者在審查小幫手已勾、且屬於指定研究類別（檢體採集／防疫驗餘）的檢體類型 label 串成草稿。
// docgen 與 Step4「種類輸入框 placeholder」共用同一份草稿，避免兩邊各算一次（重用、不另寫判斷）。
export function specimenKindsDraft(
  specimenTypes: ReviewSpecimenUseType[],
  group: 'collect' | 'residual',
): string {
  const members = group === 'collect' ? COLLECT_SPECIMEN : RESIDUAL_SPECIMEN;
  return specimenTypes
    .filter((t) => members.has(t))
    .map((t) => SPECIMEN_TYPE_LABELS[t])
    .filter(Boolean)
    .join('、');
}

// ── 「是否使用檢體 → 新採集 / 既存」分類 ──
// 新採集檢體（為研究而新採）：限量採血、新採非侵入檢體、採集菌株/病毒。
const NEW_SPECIMEN = new Set<ReviewSpecimenUseType>([
  'limited_blood_draw',
  'new_noninvasive_specimen',
  'strain_or_virus',
]);
// 既存檢體（已採集／既有來源）：驗餘檢體、既存檢體（原同意/署外）、合法生物資料庫。
const EXISTING_SPECIMEN = new Set<ReviewSpecimenUseType>([
  'cdc_residual_specimen',
  'cdc_residual_non_original_with_clinical_report',
  'remaining_specimen_original_consent',
  'external_remaining_specimen_original_consent',
  'legal_biobank_unlinkable',
]);

// ── 「是否使用資料 → 新蒐集 / 既有」分類 ──
// 新蒐集資料（為研究而新收集，如問卷/訪談/觀察/錄音/量測）。
const NEW_DATA = new Set<ReviewDataUseType>([
  'minimal_risk_new_data',
  'other_new_data',
  'noninvasive_measurement',
  'behavior_or_trait',
  'recording_or_image',
  'education_evaluation',
  'public_policy_evaluation',
  'public_non_interactive_observation',
]);
// 既有資料（病歷、業務蒐集、資料庫、已公開資訊）。
const EXISTING_DATA = new Set<ReviewDataUseType>([
  'medical_record',
  'business_data',
  'deidentified_database',
  'other_existing_data',
  'public_info',
]);

// ── 弱勢族群 → DOC-12「研究對象屬哪一族群」格 ──
// 對不上明確格的（如後天免疫不全/結核/精神疾病）歸「特定病人」；其餘少見者歸「其他」。
const POP_MAP: Partial<Record<ReviewVulnerablePopulation, SubjectPopulationGroup>> = {
  minor: 'adolescent',          // 未成年保守歸「青少年」（兒童/嬰幼兒若更貼切，使用者在 Step4/Word 改）
  indigenous: 'indigenous',
  pregnant: 'pregnant',
  disability: 'disability',
  prisoner: 'prisoner',
  hiv_positive: 'patient',      // 特定病人，疾病名稱由使用者手填
  tb_case: 'patient',
  mental_illness: 'patient',
  new_immigrant_or_migrant: 'other',
  long_term_care_resident: 'other',
  other_vulnerable: 'other',
};

// 依審查小幫手（review_screening）的弱勢族群，建議 DOC-12 第 8 點（2）研究對象族群。
// 沒有任何弱勢族群 → 視為「一般成人」；其餘對映到對應族群格（POP_MAP）。
// Step4「帶入審查小幫手建議」按鈕與 docgen 自動模式共用這支（重用同一規則、不另寫判斷）。
export function suggestPopulationGroups(screening: ReviewScreening | undefined): SubjectPopulationGroup[] {
  const pops = screening?.vulnerable_populations ?? [];
  if (pops.length === 0) return ['adult'];
  const set = new Set<SubjectPopulationGroup>();
  pops.forEach((p) => { const k = POP_MAP[p]; if (k) set.add(k); });
  return [...set];
}

// 已去識別化（可勾「是」）的資料可識別性等級。
const DEIDENTIFIED = new Set(['provider_deidentified_unidentifiable', 'coded_researcher_unidentifiable']);

// DOC-12 後半段全部 {irb0021_*} 勾選格 → ■/□。docgen 不挑文件、一律備好（與其他 prepareXxx 同模式）；
// 只有簡審/一般審會真的用到 DOC-12，其餘審查類型生成時這些值仍合法（多半渲染成保守預設的勾選表）。
export function prepareIrb002_1Data(data: FormData) {
  // review_screening 用 optional chaining 防禦：舊草稿 / 精簡 fixture 可能沒有此欄（與其他 prepareXxx 同精神）。
  const s = data.review_screening;
  const dataUse = new Set(s?.data_use_types ?? []);
  const specimen = new Set(s?.specimen_use_types ?? []);

  const hasAny = (set: Set<string>, members: Set<string>) => [...members].some((m) => set.has(m));

  // 檢體問項在 Step4 可明確覆寫；null／舊草稿未帶欄位時，才沿用審查小幫手的分類。
  const inferredHasSpecimen = specimen.size > 0;
  const hasSpecimen = data.irb0021_has_specimen ?? inferredHasSpecimen;
  const hasNewSpecimen = hasSpecimen
    && (data.irb0021_has_new_specimen ?? hasAny(specimen, NEW_SPECIMEN));
  const hasExistingSpecimen = hasSpecimen
    && (data.irb0021_has_existing_specimen ?? hasAny(specimen, EXISTING_SPECIMEN));
  // 資料問項同樣可在 Step4 明確覆寫；未作答時維持舊草稿的自動推導行為。
  const inferredHasData = dataUse.size > 0;
  const hasData = data.irb0021_has_data ?? inferredHasData;
  const hasNewData = hasData
    && (data.irb0021_has_new_data ?? hasAny(dataUse, NEW_DATA));
  const hasExistingData = hasData
    && (data.irb0021_has_existing_data ?? hasAny(dataUse, EXISTING_DATA));
  const recruitSubjects = Boolean(data.recruit_subjects);

  // 族群（DOC-12 第 8 點（2））只在招募研究對象時填寫。招募＝是時，使用者手選優先；
  // 沒選則沿用審查小幫手自動判斷（無弱勢族群＝一般成人）。
  const manualPops = new Set(data.subject_population_groups ?? []);
  const effectivePops = recruitSubjects
    ? (manualPops.size > 0 ? manualPops : new Set(suggestPopulationGroups(s)))
    : new Set<SubjectPopulationGroup>();

  // 名單取得：招募＝是且用到「資料庫/病歷/業務」類既有資料時，自動勾既有資料庫當安全網。
  const fromExistingDb = recruitSubjects
    && (hasAny(dataUse, DB_ANALYSIS_DATA) || dataUse.has('medical_record') || dataUse.has('business_data'));
  // Step4 簡審「研究對象名單取得方式」使用者手選（招募＝是時才填）；與上面的自動判斷各自貢獻，docgen 取聯集。
  const roster = new Set(recruitSubjects ? data.subject_roster_methods ?? [] : []);

  // 去識別化可由 Step4 明確覆寫；未作答時才沿用審查小幫手。
  // 自動判斷不確定（公開／未知／未填）時，兩格仍留空，避免系統擅自代答。
  const inferredDeidYes = DEIDENTIFIED.has(s?.data_identifiability ?? '');
  const inferredDeidNo = s?.data_identifiability === 'identifiable_or_linkable';
  const deidYes = hasData
    && (data.irb0021_data_deidentified ?? inferredDeidYes);
  const deidNo = hasData
    && (
      data.irb0021_data_deidentified === false
      || (data.irb0021_data_deidentified == null && inferredDeidNo)
    );

  const rel = recruitSubjects ? data.expedited_subject_relationship : undefined;
  const hasControlGroup = recruitSubjects && Boolean(data.expedited_has_control_group);
  const controlGroupType = data.expedited_control_group_type;
  const consent = data.expedited_consent_design;
  const consentProofMethods = new Set(
    consent === 'provide' || consent === 'waive_signature'
      ? data.expedited_consent_proof_methods ?? []
      : [],
  );
  const consentSources = new Set(
    consent === 'provide' ? data.expedited_consent_sources ?? [] : [],
  );
  const isExpedited = data.review_type === 'expedited';
  const isMulticenter = Boolean(data.is_multicenter);
  const multicenterSiteRows = isMulticenter && data.multicenter_sites?.length
    ? data.multicenter_sites.map((site) => ({
        country: site.country || '',
        city: site.city || '',
        location: site.location || '',
        contact: site.contact || '',
      }))
    : [
        { country: '', city: '', location: '', contact: '' },
        { country: '', city: '', location: '', contact: '' },
      ];

  return {
    // 研究類別（可複選）：只勾高信心格，其餘留 □
    irb0021_cat_questionnaire:  box(data.has_questionnaire),
    irb0021_cat_database:       box(hasAny(dataUse, DB_ANALYSIS_DATA)),
    irb0021_cat_business:       box(dataUse.has('business_data')),
    irb0021_cat_medical_record: box(dataUse.has('medical_record')),
    irb0021_cat_strain:         box(specimen.has('strain_or_virus')),
    irb0021_cat_specimen:       box(hasAny(specimen, COLLECT_SPECIMEN)),
    irb0021_cat_residual:       box(hasAny(specimen, RESIDUAL_SPECIMEN)),
    irb0021_cat_other:          box(false), // 不自動勾「其他」，需要時使用者手勾

    // 研究類別「檢體採集／防疫用驗餘檢體」後的「(請述明檢體種類)」底線格：
    //   只在該類別格被勾時才輸出文字（沒勾留空，維持底線可手寫）；
    //   使用者手填優先，沒填則用審查小幫手已勾檢體類型自動串成的種類草稿（specimenKindsDraft）。
    irb0021_cat_specimen_detail: hasAny(specimen, COLLECT_SPECIMEN)
      ? (data.irb0021_cat_specimen_detail?.trim() || specimenKindsDraft(s?.specimen_use_types ?? [], 'collect'))
      : '',
    irb0021_cat_residual_detail: hasAny(specimen, RESIDUAL_SPECIMEN)
      ? (data.irb0021_cat_residual_detail?.trim() || specimenKindsDraft(s?.specimen_use_types ?? [], 'residual'))
      : '',

    // 是否符合簡審 / 免審條件：DOC-12 用於簡審或一般審，故必「不符合免審」。
    irb0021_meets_expedited:     box(isExpedited),
    irb0021_not_meets_expedited: box(!isExpedited),
    irb0021_meets_exempt:        box(false),
    irb0021_not_meets_exempt:    box(true),

    // 多中心類別 + 官方四欄表格。單中心仍保留原表兩列空白資料列，供 Word 手填或維持版型。
    irb0021_multicenter_yes:      box(isMulticenter),
    irb0021_multicenter_na:       box(!isMulticenter),
    irb0021_multicenter_domestic: box(isMulticenter && data.multicenter_type === 'domestic'),
    irb0021_multicenter_intl:     box(isMulticenter && data.multicenter_type === 'international'),
    multicenter_site_rows: multicenterSiteRows,

    // 是否招募研究對象（與免審共用 recruit_subjects）
    irb0021_recruit_yes: box(recruitSubjects),
    irb0021_recruit_no:  box(!recruitSubjects),
    // 「請說明招募方式及退出機制：____」的填寫文字（招募＝否時留空，維持空白底線可手寫）。
    recruit_method_text: recruitSubjects ? data.recruit_method : '',
    // 第 8 點（1）研究對象估計人數：招募＝否時不帶入舊值。
    subject_count: recruitSubjects ? data.subject_count : '',
    // 此題獨立於是否招募研究對象；不招募時也可說明「不直接接觸研究對象」。
    subject_explainer: data.subject_explainer,

    // 研究對象族群（手選優先、否則自動判斷；見上方 effectivePops）
    irb0021_pop_adult:      box(effectivePops.has('adult')),
    irb0021_pop_adolescent: box(effectivePops.has('adolescent')),
    irb0021_pop_child:      box(effectivePops.has('child')),
    irb0021_pop_patient:    box(effectivePops.has('patient')),
    irb0021_pop_indigenous: box(effectivePops.has('indigenous')),
    irb0021_pop_pregnant:   box(effectivePops.has('pregnant')),
    irb0021_pop_disability: box(effectivePops.has('disability')),
    irb0021_pop_prisoner:   box(effectivePops.has('prisoner')),
    irb0021_pop_cdc_staff:  box(effectivePops.has('cdc_staff')), // 自動模式無對應 screening 欄位→false；手選可勾
    irb0021_pop_other:      box(effectivePops.has('other')),
    subject_patient_disease_name: effectivePops.has('patient') ? data.subject_patient_disease_name : '',
    subject_cdc_staff_reason: effectivePops.has('cdc_staff') ? data.subject_cdc_staff_reason : '',
    subject_population_other_detail: effectivePops.has('other') ? data.subject_population_other_detail : '',

    // 研究對象名單取得方式（使用者手選 ∪ 自動判斷；「既有資料庫」OR 上 fromExistingDb 安全網）
    irb0021_roster_public:           box(roster.has('public')),
    irb0021_roster_sampling:         box(roster.has('sampling')),
    irb0021_roster_existing_db:      box(fromExistingDb || roster.has('existing_db')),
    irb0021_roster_existing_project: box(roster.has('existing_project')),
    irb0021_roster_other:            box(roster.has('other')),
    subject_roster_existing_db_name:
      (fromExistingDb || roster.has('existing_db')) ? data.subject_roster_existing_db_name : '',
    subject_roster_existing_project_name:
      roster.has('existing_project') ? data.subject_roster_existing_project_name : '',
    subject_roster_other_detail: roster.has('other') ? data.subject_roster_other_detail : '',

    // 主持人與研究對象之關係（單選 expedited_subject_relationship）
    irb0021_rel_researcher: box(rel === 'researcher_subject'),
    irb0021_rel_medical:    box(rel === 'medical_patient'),
    irb0021_rel_teacher:    box(rel === 'teacher_student'),
    irb0021_rel_employer:   box(rel === 'employer_employee'),
    irb0021_rel_friend:     box(rel === 'friend'),
    irb0021_rel_cdc_staff:  box(rel === 'cdc_staff'),
    irb0021_rel_other:      box(rel === 'other'),
    subject_relationship_other_detail:
      rel === 'other' ? data.expedited_subject_relationship_other_detail : '',

    // 是否有對照組；有對照組時才輸出 A. 類別與 B. 專用說明同意書子題。
    irb0021_control_yes: box(hasControlGroup),
    irb0021_control_no:  box(recruitSubjects && !hasControlGroup),
    irb0021_control_case: box(hasControlGroup && controlGroupType === 'case_control'),
    irb0021_control_placebo: box(hasControlGroup && controlGroupType === 'placebo_experimental'),
    irb0021_control_other: box(hasControlGroup && controlGroupType === 'other'),
    control_group_other_detail:
      hasControlGroup && controlGroupType === 'other'
        ? data.expedited_control_group_other_detail
        : '',
    irb0021_control_consent_yes: box(hasControlGroup && data.expedited_control_consent_form === true),
    irb0021_control_consent_no: box(hasControlGroup && data.expedited_control_consent_form === false),

    // 是否使用檢體 → 新採集 / 既存（無檢體時「是否新採集/既存」兩組都留 □）
    irb0021_specimen_yes:          box(hasSpecimen),
    irb0021_specimen_no:           box(!hasSpecimen),
    irb0021_specimen_new_yes:      box(hasNewSpecimen),
    irb0021_specimen_new_no:       box(hasSpecimen && !hasNewSpecimen),
    irb0021_specimen_existing_yes: box(hasExistingSpecimen),
    irb0021_specimen_existing_no:  box(hasSpecimen && !hasExistingSpecimen),
    specimen_new_detail: hasNewSpecimen ? data.specimen_new_detail : '',
    specimen_existing_detail: hasExistingSpecimen ? data.specimen_existing_detail : '',

    // 是否使用資料 → 新蒐集 / 既有
    irb0021_data_yes:          box(hasData),
    irb0021_data_no:           box(!hasData),
    irb0021_data_new_yes:      box(hasNewData),
    irb0021_data_new_no:       box(hasData && !hasNewData),
    irb0021_data_existing_yes: box(hasExistingData),
    irb0021_data_existing_no:  box(hasData && !hasExistingData),
    data_new_detail: hasNewData ? data.data_new_detail : '',
    data_existing_detail: hasExistingData ? data.data_existing_detail : '',

    // 研究資料是否去識別化／去連結
    irb0021_deid_yes: box(deidYes),
    irb0021_deid_no:  box(deidNo),
    data_deidentification_detail: deidYes ? data.data_deidentification_detail : '',

    // 是否涉及與其他資料庫連結（與資料庫申請的 cross_link_data_center 連動）
    irb0021_crosslink_yes: box(data.cross_link_data_center),
    irb0021_crosslink_no:  box(!data.cross_link_data_center),

    // 知情同意設計（單選）＋使用同意書／免除簽署但告知時的落實證明方式（可複選）。
    irb0021_consent_provide:         box(consent === 'provide'),
    irb0021_consent_waive_signature: box(consent === 'waive_signature'),
    irb0021_consent_waive_full:      box(consent === 'waive_full'),
    irb0021_consent_proof_datetime: box(consentProofMethods.has('signed_datetime')),
    irb0021_consent_proof_witness:  box(consentProofMethods.has('witness_signature')),
    irb0021_consent_proof_record:   box(consentProofMethods.has('team_record')),
    irb0021_consent_proof_other:    box(consentProofMethods.has('other')),
    consent_proof_other_detail:
      consentProofMethods.has('other') ? data.expedited_consent_proof_other_detail : '',
    irb0021_consent_source_subject:              box(consentSources.has('subject')),
    irb0021_consent_source_parent:               box(consentSources.has('parent')),
    irb0021_consent_source_guardian:             box(consentSources.has('guardian')),
    irb0021_consent_source_authorized_person:    box(consentSources.has('authorized_person')),
    irb0021_consent_source_legal_representative: box(consentSources.has('legal_representative')),
    irb0021_consent_source_other:                box(consentSources.has('other')),
    consent_source_other_detail:
      consentSources.has('other') ? data.expedited_consent_source_other_detail : '',
    consent_source_na:
      consent === 'waive_signature' || consent === 'waive_full' ? '不適用' : '',
    waive_signature_reason:
      consent === 'waive_signature' ? data.expedited_waive_signature_reason : '',
    waive_consent_reason:
      consent === 'waive_full' ? data.expedited_waive_consent_reason : '',

    // 是否進行追蹤
    irb0021_followup_yes: box(data.expedited_has_followup),
    irb0021_followup_no:  box(!data.expedited_has_followup),
    followup_period: data.expedited_has_followup ? data.expedited_followup_period : '',

    // 是否需建置 DSMP
    irb0021_dsmp_yes: box(data.expedited_needs_dsmp),
    irb0021_dsmp_no:  box(!data.expedited_needs_dsmp),
  };
}
