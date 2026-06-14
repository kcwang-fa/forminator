// ===== 第 4 頁：IRB 審查 =====
//
// review_type 三分支：
//   - exempt（免審）：對應 IRB-012 免審申請表（DOC-5）。研究類別 → 免審理由 → 共用欄位 → AI 潤飾。
//   - expedited（簡審）：對應 IRB-003（DOC-13，研究類別勾選）+ IRB-002-1（DOC-12，後半段欄位）。
//   - full（一般審）：對應 IRB-002-1（DOC-12），共用簡審的 DOC-12 欄位，但不顯示 IRB-003 分類。
//
// 三種審查共用的「研究方法／納入排除／是否招募／隱私三段」抽成 <IrbCommonFields />（靠 RHF path
// 對接）；免審另顯示互動預設面板。簡審與一般審再加 IRB-002-1 後半段的補充欄位（與研究對象關係／對照組／知情同意／追蹤／DSMP），
// 由 docgen.prepareIrb002_1Data 翻成 ■/□ 注入 DOC-12。
//
// 子元件（皆透過 React Hook Form path 對接）：
//   - ReviewConclusionCard：Step 1 判斷結果 + 手動覆寫（三類審查共用）
//   - IrbCommonFields：三種審查共用欄位 + 帶入草稿按鈕 + 隱私範例勾選
//   - ExemptRewritePanel：免審 AI 潤飾（選用，預設收合）

import { useCallback, useEffect, useMemo } from 'react';
import { Alert, App, Button, Card, Checkbox, Collapse, Form, Input, Radio, Switch, Tag } from 'antd';
import { BulbOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { Controller, useFieldArray, useWatch } from 'react-hook-form';
import { useFormStore } from '../../../hooks/useFormStore';
import { classifyReviewType, suggestExpeditedCategories } from '../../../utils/reviewClassifier';
import {
  COLLECT_SPECIMEN,
  RESIDUAL_SPECIMEN,
  specimenKindsDraft,
  suggestPopulationGroups,
} from '../../../utils/docgen/irb0021';
import { buildExemptReasonFromDecision } from '../../../utils/exemptIrbText';
import { emptyMulticenterSite } from '../../../data/defaults';
import type {
  ConsentProofMethod,
  ConsentSource,
  ExemptCategory,
  ExpeditedConsentDesign,
  ExpeditedControlGroupType,
  ExpeditedSubjectRelationship,
  MulticenterType,
  ReviewDataUseType,
  ReviewSpecimenUseType,
  SubjectPopulationGroup,
} from '../../../types/form';
import { ReviewConclusionCard } from './ReviewConclusionCard';
import { ExemptRewritePanel } from './ExemptRewritePanel';
import { IrbCommonFields } from './IrbCommonFields';
import { EXPEDITED_CATEGORY_GROUPS } from './expeditedCategories';

// 研究類別（IRB-012 表單「可複選」）——對應表單四個勾選 + 最低風險，共 5 項。
const EXEMPT_CATEGORY_OPTIONS: { value: ExemptCategory; label: string }[] = [
  { value: 'public_non_interactive', label: '於公開場合進行之非記名、非互動且非介入性研究' },
  { value: 'public_info', label: '使用已合法公開週知之資訊，且使用符合其公開目的' },
  { value: 'public_policy', label: '公務機關執行法定職務進行之公共政策成效評估研究' },
  { value: 'education', label: '一般教學環境中之教育評量、測試或教學技巧研究' },
  { value: 'minimal_risk', label: '研究計畫屬最低風險（風險不高於日常生活）' },
];

// IRB-002-1（DOC-12）第 8 點（2）「研究對象族群」10 個勾選格（可複選），對齊 DOC-12 順序。
const POPULATION_OPTIONS: { value: SubjectPopulationGroup; label: string }[] = [
  { value: 'adult', label: '一般成人' },
  { value: 'adolescent', label: '青少年' },
  { value: 'child', label: '兒童／嬰幼兒' },
  { value: 'patient', label: '特定病人' },
  { value: 'indigenous', label: '少數民族' },
  { value: 'pregnant', label: '孕婦' },
  { value: 'disability', label: '殘障人士' },
  { value: 'prisoner', label: '受刑人' },
  { value: 'cdc_staff', label: '本署人員' },
  { value: 'other', label: '其他' },
];

// IRB-002-1（DOC-12）後半段「主持人與研究對象之關係」7 個勾選格（單選）。
const RELATIONSHIP_OPTIONS: { value: ExpeditedSubjectRelationship; label: string }[] = [
  { value: 'researcher_subject', label: '研究者／研究對象' },
  { value: 'medical_patient', label: '醫療人員／病人' },
  { value: 'teacher_student', label: '老師／學生' },
  { value: 'employer_employee', label: '雇主／職員' },
  { value: 'friend', label: '朋友' },
  { value: 'cdc_staff', label: '本署人員' },
  { value: 'other', label: '其它' },
];

// IRB-002-1（DOC-12）「是否有對照組」之 A. 類別單選。
const CONTROL_GROUP_OPTIONS: { value: ExpeditedControlGroupType; label: string }[] = [
  { value: 'case_control', label: '個案病例對照' },
  { value: 'placebo_experimental', label: '安慰劑及／或實驗對照' },
  { value: 'other', label: '其它' },
];

// IRB-002-1（DOC-12）後半段「知情同意設計」3 個主問勾選格（單選）。
const CONSENT_OPTIONS: { value: ExpeditedConsentDesign; label: string }[] = [
  { value: 'provide', label: '是，設計並使用研究對象說明同意書' },
  { value: 'waive_signature', label: '申請免除簽署但須告知' },
  { value: 'waive_full', label: '申請免除知情同意' },
];

const CONSENT_PROOF_OPTIONS: { value: ConsentProofMethod; label: string }[] = [
  { value: 'signed_datetime', label: '請研究對象於研究對象說明暨同意書簽署日期與時間' },
  { value: 'witness_signature', label: '請見證人簽署' },
  { value: 'team_record', label: '由研究團隊記錄知情同意過程' },
  { value: 'other', label: '其他' },
];

const CONSENT_SOURCE_OPTIONS: { value: ConsentSource; label: string }[] = [
  { value: 'subject', label: '研究對象' },
  { value: 'parent', label: '研究對象之父母' },
  { value: 'guardian', label: '研究對象之監護人' },
  { value: 'authorized_person', label: '研究對象之委任人' },
  { value: 'legal_representative', label: '研究對象之法定代理人' },
  { value: 'other', label: '其它' },
];

// 與 docgen/irb0021.ts 的 DOC-12 主選項分類保持一致；這裡只用來決定 Step4 要不要展開附帶說明欄。
const DOC12_NEW_SPECIMEN = new Set<ReviewSpecimenUseType>([
  'limited_blood_draw',
  'new_noninvasive_specimen',
  'strain_or_virus',
]);
const DOC12_EXISTING_SPECIMEN = new Set<ReviewSpecimenUseType>([
  'cdc_residual_specimen',
  'cdc_residual_non_original_with_clinical_report',
  'remaining_specimen_original_consent',
  'external_remaining_specimen_original_consent',
  'legal_biobank_unlinkable',
]);
const DOC12_NEW_DATA = new Set<ReviewDataUseType>([
  'minimal_risk_new_data',
  'other_new_data',
  'noninvasive_measurement',
  'behavior_or_trait',
  'recording_or_image',
  'education_evaluation',
  'public_policy_evaluation',
  'public_non_interactive_observation',
]);
const DOC12_EXISTING_DATA = new Set<ReviewDataUseType>([
  'medical_record',
  'business_data',
  'deidentified_database',
  'other_existing_data',
  'public_info',
]);

export default function Step4IRB() {
  const { clearErrors, control, setValue, getValues } = useFormStore();
  const { message } = App.useApp();
  const reviewType = useWatch({ control, name: 'review_type' });
  const isMulticenter = useWatch({ control, name: 'is_multicenter' });
  // 是否與其他資料庫連結（DOC-12 第 11 題）：勾「是」才顯示資料庫名稱輸入框。
  const crossLink = useWatch({ control, name: 'cross_link_data_center' });
  const multicenterType = useWatch({ control, name: 'multicenter_type' });
  const hasOtherIrbApproval = useWatch({ control, name: 'review_screening.has_other_irb_approval' });
  const {
    fields: multicenterSiteFields,
    append: appendMulticenterSite,
    remove: removeMulticenterSite,
  } = useFieldArray({ control, name: 'multicenter_sites' });

  // 讀審查類型小幫手的判斷結果（screening 變動才重算），用於「一鍵帶入免審理由」（免審專屬）。
  const screening = useWatch({ control, name: 'review_screening' });
  const decision = useMemo(() => classifyReviewType(screening), [screening]);
  const canApplyScreeningReason = decision.review_type === 'exempt' && decision.reasons.length > 0;

  const handleApplyScreeningReason = () => {
    setValue('exempt_reason', buildExemptReasonFromDecision(decision.reasons), { shouldDirty: true });
    message.success('已帶入審查小幫手的判斷理由，可再手動修改。');
  };

  // ── 簡審（expedited）分支用 ──
  // IRB-003 研究類別建議：重用 reviewClassifier 的 suggestExpeditedCategories（不另寫判斷）。
  const expeditedSuggestions = useMemo(() => suggestExpeditedCategories(screening), [screening]);
  const expeditedCategory = useWatch({ control, name: 'expedited_category' });
  const showExpeditedOtherDetail = (expeditedCategory || []).includes('i2');
  const hasControlGroup = useWatch({ control, name: 'expedited_has_control_group' });
  const controlGroupType = useWatch({ control, name: 'expedited_control_group_type' });
  const consentDesign = useWatch({ control, name: 'expedited_consent_design' });
  const consentProofMethods = useWatch({ control, name: 'expedited_consent_proof_methods' }) ?? [];
  const consentSources = useWatch({ control, name: 'expedited_consent_sources' }) ?? [];
  const subjectRelationship = useWatch({ control, name: 'expedited_subject_relationship' });
  const recruitSubjects = useWatch({ control, name: 'recruit_subjects' });
  const populationGroups = useWatch({ control, name: 'subject_population_groups' }) ?? [];
  const specimenUseTypes = useWatch({ control, name: 'review_screening.specimen_use_types' }) ?? [];
  const dataUseTypes = useWatch({ control, name: 'review_screening.data_use_types' }) ?? [];
  const specimenAnswer = useWatch({ control, name: 'irb0021_has_specimen' });
  const newSpecimenAnswer = useWatch({ control, name: 'irb0021_has_new_specimen' });
  const existingSpecimenAnswer = useWatch({ control, name: 'irb0021_has_existing_specimen' });
  const dataAnswer = useWatch({ control, name: 'irb0021_has_data' });
  const newDataAnswer = useWatch({ control, name: 'irb0021_has_new_data' });
  const existingDataAnswer = useWatch({ control, name: 'irb0021_has_existing_data' });
  const dataDeidentifiedAnswer = useWatch({ control, name: 'irb0021_data_deidentified' });
  const hasFollowup = useWatch({ control, name: 'expedited_has_followup' });
  const needsDsmp = useWatch({ control, name: 'expedited_needs_dsmp' });
  const effectivePopulationGroups = populationGroups.length > 0
    ? populationGroups
    : suggestPopulationGroups(screening);
  const showPatientDiseaseName = effectivePopulationGroups.includes('patient');
  const showCdcStaffReason = effectivePopulationGroups.includes('cdc_staff');
  const showPopulationOtherDetail = effectivePopulationGroups.includes('other');
  const inferredHasSpecimen = specimenUseTypes.length > 0;
  const inferredHasNewSpecimen = specimenUseTypes.some((type) => DOC12_NEW_SPECIMEN.has(type));
  const inferredHasExistingSpecimen = specimenUseTypes.some((type) => DOC12_EXISTING_SPECIMEN.has(type));
  const hasSpecimen = specimenAnswer ?? inferredHasSpecimen;
  const showNewSpecimenDetail = hasSpecimen && (newSpecimenAnswer ?? inferredHasNewSpecimen);
  const showExistingSpecimenDetail = hasSpecimen && (existingSpecimenAnswer ?? inferredHasExistingSpecimen);
  // 研究類別「檢體採集／防疫用驗餘檢體」會被自動勾時，才顯示對應的「(請述明檢體種類)」輸入框；
  // placeholder 直接秀出 docgen 會自動帶入的種類草稿（重用 irb0021.ts 的 specimenKindsDraft）。
  const showCatSpecimenDetail = specimenUseTypes.some((type) => COLLECT_SPECIMEN.has(type));
  const showCatResidualDetail = specimenUseTypes.some((type) => RESIDUAL_SPECIMEN.has(type));
  const catSpecimenKindsDraft = specimenKindsDraft(specimenUseTypes, 'collect');
  const catResidualKindsDraft = specimenKindsDraft(specimenUseTypes, 'residual');
  const inferredHasData = dataUseTypes.length > 0;
  const inferredHasNewData = dataUseTypes.some((type) => DOC12_NEW_DATA.has(type));
  const inferredHasExistingData = dataUseTypes.some((type) => DOC12_EXISTING_DATA.has(type));
  const hasData = dataAnswer ?? inferredHasData;
  const showNewDataDetail = hasData && (newDataAnswer ?? inferredHasNewData);
  const showExistingDataDetail = hasData && (existingDataAnswer ?? inferredHasExistingData);
  const inferredDataDeidentified = screening?.data_identifiability === 'provider_deidentified_unidentifiable'
    || screening?.data_identifiability === 'coded_researcher_unidentifiable';
  const showDeidentificationDetail = hasData
    && (dataDeidentifiedAnswer ?? inferredDataDeidentified);

  const handleApplyExpeditedCategories = () => {
    setValue('expedited_category', suggestExpeditedCategories(getValues().review_screening), { shouldDirty: true });
    message.success('已依審查小幫手帶入建議的研究類別；B／C／G 類請再依實際情形勾選具體項目。');
  };

  // 研究對象族群「帶入建議」：依審查小幫手（review_screening）的弱勢族群推導（無→一般成人），可再調整。
  const handleApplyPopulationGroups = () => {
    setValue('subject_population_groups', suggestPopulationGroups(getValues().review_screening), { shouldDirty: true });
    message.success('已依審查小幫手帶入研究對象族群，可再依實際情形調整。');
  };

  const buildEmptyMulticenterSite = useCallback(
    (type: MulticenterType | '' = multicenterType) => ({
      ...emptyMulticenterSite,
      country: type === 'domestic' ? '臺灣' : '',
    }),
    [multicenterType],
  );

  const handleMulticenterTypeChange = (type: MulticenterType) => {
    setValue('multicenter_type', type, { shouldDirty: true });

    getValues('multicenter_sites').forEach((site, index) => {
      const country = type === 'domestic' && !site.country.trim() ? '臺灣' : site.country;
      setValue(`multicenter_sites.${index}.country`, country, {
        shouldDirty: type === 'domestic' && !site.country.trim(),
        shouldValidate: true,
      });
    });
  };

  // 「已取得其他審查會同意」在語意上必然是多中心案件；舊草稿只有前者時，自動補上多中心主問。
  useEffect(() => {
    if (!hasOtherIrbApproval || isMulticenter) return;
    setValue('is_multicenter', true, { shouldDirty: false });
    if (multicenterSiteFields.length === 0) {
      appendMulticenterSite(buildEmptyMulticenterSite());
    }
  }, [
    appendMulticenterSite,
    buildEmptyMulticenterSite,
    hasOtherIrbApproval,
    isMulticenter,
    multicenterSiteFields.length,
    setValue,
  ]);

  return (
    <div>
      <h3>IRB 審查資訊</h3>

      {/* 審查結論（所有審查類型都顯示）*/}
      <ReviewConclusionCard />

      {reviewType === 'exempt' ? (
        <>
          {/* 研究類別（可複選）— IRB-012 表單第 3 題 */}
          <Controller
            name="exempt_category"
            control={control}
            render={({ field }) => (
              <Form.Item label="研究類別（可複選）" tooltip="對應 IRB-012 免審申請表「研究類別」，可勾選多項。">
                <Checkbox.Group
                  value={field.value}
                  onChange={field.onChange}
                  options={EXEMPT_CATEGORY_OPTIONS}
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                />
              </Form.Item>
            )}
          />

          {/* 免審理由（DOC-5 注入）*/}
          <Controller
            name="exempt_reason"
            control={control}
            render={({ field }) => (
              <Form.Item label="免審理由">
                {canApplyScreeningReason && (
                  <Button
                    type="link"
                    size="small"
                    icon={<BulbOutlined />}
                    onClick={handleApplyScreeningReason}
                    style={{ padding: 0, height: 'auto', marginBottom: 6 }}
                  >
                    帶入審查小幫手判斷理由
                  </Button>
                )}
                <Input.TextArea {...field} rows={3} placeholder="可手動填寫，或用上方按鈕帶入審查小幫手判斷理由" />
              </Form.Item>
            )}
          />

          {/* 共用欄位（研究方法／納入排除／招募／隱私三段）+ 免審互動面板 */}
          <IrbCommonFields section="main" />

          {/* AI 潤飾面板（選用，預設收合）*/}
          <ExemptRewritePanel />

          <IrbCommonFields section="privacy" />
        </>
      ) : reviewType === 'expedited' || reviewType === 'full' ? (
        // ────────────────────────────────────────────────────────────────────
        // IRB-002-1（DOC-12）分支：簡審（expedited）與一般審（full）共用。
        //
        // 簡審另加 IRB-003（DOC-13）：研究類別勾選 → prepareExpeditedData → {irb003_*}。
        // IRB-002-1（DOC-12）：基本資料（前面步驟）+ 後半段欄位（共用欄位 + 下方補充欄位）
        //   → prepareIrb002_1Data 依 review_screening / 既有欄位 / 下方欄位翻成 ■/□。
        // ────────────────────────────────────────────────────────────────────
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            title={reviewType === 'expedited' ? '簡易審查資訊' : '一般審查資訊'}
            description={reviewType === 'expedited'
              ? '這一步填寫簡易審查需要的研究類別與相關資訊。多數欄位已依你前面填寫的內容預先帶好，確認或視情況調整即可；計畫書內容（研究主旨、背景、方法等）沿用前面步驟，不必重填。'
              : '這一步填寫一般審查使用的 IRB-002-1 人體研究計畫申請表。一般審查不需填 IRB-003；請依實際研究風險、研究對象、同意程序與安全監測需求完整確認。'}
          />

          {reviewType === 'expedited' && (
            <>
              <Form.Item
                label="研究類別（可複選）"
                tooltip="依簡易審查的研究類別分類，勾選符合本計畫的項目（可複選）。"
              >
                {expeditedSuggestions.length > 0 && (
                  <Button
                    type="link"
                    size="small"
                    icon={<BulbOutlined />}
                    onClick={handleApplyExpeditedCategories}
                    style={{ padding: 0, height: 'auto', marginBottom: 8 }}
                  >
                    帶入審查小幫手建議分類
                  </Button>
                )}
                <Controller
                  name="expedited_category"
                  control={control}
                  render={({ field }) => {
                    // 每個分類（A~I）的具體項目很多、文字長，攤開會把整頁塞滿，故收進可收合面板。
                    const picked = new Set(field.value || []);
                    // 初次進來時，把「已經有勾項目」的分類預設展開（帶著舊草稿回來看得到），其餘收合。
                    const defaultOpen = EXPEDITED_CATEGORY_GROUPS
                      .filter((g) => g.items.some((it) => picked.has(it.value)))
                      .map((g) => g.letter);
                    return (
                      <Checkbox.Group value={field.value} onChange={field.onChange} style={{ display: 'block' }}>
                        <Collapse
                          ghost
                          size="small"
                          defaultActiveKey={defaultOpen}
                          items={EXPEDITED_CATEGORY_GROUPS.map((group) => {
                            // 該分類已勾幾項（用 field.value 算，與面板是否展開無關）→ 收合狀態也看得到。
                            const count = group.items.filter((it) => picked.has(it.value)).length;
                            return {
                              key: group.letter,
                              label: (
                                <span>
                                  <span style={{ fontWeight: 600 }}>{group.letter}. {group.title}</span>
                                  {count > 0 && <Tag color="blue" style={{ marginLeft: 8 }}>已勾 {count}</Tag>}
                                </span>
                              ),
                              children: (
                                <div>
                                  {group.note && (
                                    <div style={{ color: '#888', fontSize: 12, marginBottom: 8 }}>{group.note}</div>
                                  )}
                                  {group.items.map((item) => (
                                    <div key={item.value} style={{ marginTop: 6 }}>
                                      <Checkbox value={item.value}>{item.label}</Checkbox>
                                    </div>
                                  ))}
                                </div>
                              ),
                            };
                          })}
                        />
                      </Checkbox.Group>
                    );
                  }}
                />
              </Form.Item>

              {/* I2「不符合以上但具特殊性質」勾選時，才顯示對應 {irb003_other_detail} 的說明欄。*/}
              {showExpeditedOtherDetail && (
                <Controller
                  name="expedited_other_detail"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="「其他」請詳細說明">
                      <Input.TextArea {...field} rows={3} placeholder="說明本研究計畫為何仍符合簡易審查條件的特殊性質" />
                    </Form.Item>
                  )}
                />
              )}
            </>
          )}

          {/* 共用欄位（研究方法／納入排除／招募／隱私三段）；簡審與一般審不顯示「免審預設選項」，
              但顯示 DOC-12 第 8 點（3）「研究對象名單取得方式」。*/}
          <IrbCommonFields showExemptDefaults={false} showRosterMethods section="main" />

          {/* IRB-002-1（DOC-12）後半段補充欄位：已依研究情形預設，請確認或修改 */}
          {reviewType !== 'full' && (
            <p style={{ color: '#666', fontSize: 13 }}>
              以下欄位已依常見的署內回溯性資料庫研究預先帶好，請確認或視情況修改。
            </p>
          )}

          {/* DOC-12 第 8 點的後續子題只在「是否招募研究對象＝是」時填寫。 */}
          {recruitSubjects && (
            <>
              {/* 研究對象估計人數（DOC-12 第 8 點（1））：自由文字，注入 {subject_count}。 */}
              <Controller
                name="subject_count"
                control={control}
                render={({ field }) => (
                  <Form.Item label="研究對象估計人數" tooltip="填入預計納入的研究對象人數，可寫概數（如「約 500」）。">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Input {...field} style={{ maxWidth: 220 }} placeholder="例：500" />
                      <span>人</span>
                    </div>
                  </Form.Item>
                )}
              />

              {/* 研究對象族群（DOC-12 第 8 點（2））：未勾＝依審查小幫手自動判斷；勾了即以勾選為準。 */}
              <Controller
                name="subject_population_groups"
                control={control}
                render={({ field }) => (
                  <Form.Item
                    label="研究對象族群（可複選）"
                    tooltip="未勾選時會依審查小幫手的內容自動判斷族群；勾選後即以你的選擇為準。若選特定病人、本署人員或其他，下面會出現對應說明欄。"
                  >
                    <Button
                      type="link"
                      size="small"
                      icon={<BulbOutlined />}
                      onClick={handleApplyPopulationGroups}
                      style={{ padding: 0, height: 'auto', marginBottom: 8 }}
                    >
                      帶入審查小幫手建議族群
                    </Button>
                    <Checkbox.Group
                      value={field.value}
                      onChange={field.onChange}
                      options={POPULATION_OPTIONS}
                      style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}
                    />
                  </Form.Item>
                )}
              />

              <Controller
                name="expedited_subject_relationship"
                control={control}
                render={({ field }) => (
                  <Form.Item label="主持人與研究對象之關係">
                    <Radio.Group {...field} options={RELATIONSHIP_OPTIONS} />
                  </Form.Item>
                )}
              />

              {subjectRelationship === 'other' && (
                <Controller
                  name="expedited_subject_relationship_other_detail"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="主持人與研究對象關係其他說明">
                      <Input {...field} placeholder="請說明主持人與研究對象之其他關係" />
                    </Form.Item>
                  )}
                />
              )}

              <Controller
                name="expedited_has_control_group"
                control={control}
                render={({ field }) => (
                  <Form.Item label="是否有對照組">
                    <Switch
                      checked={field.value}
                      onChange={(checked) => {
                        field.onChange(checked);
                        if (!checked) {
                          clearErrors([
                            'expedited_control_group_type',
                            'expedited_control_group_other_detail',
                            'expedited_control_consent_form',
                          ]);
                        }
                      }}
                      checkedChildren="是"
                      unCheckedChildren="否"
                    />
                  </Form.Item>
                )}
              />

              {hasControlGroup && (
                <Card size="small" style={{ marginBottom: 20 }}>
                  <Controller
                    name="expedited_control_group_type"
                    control={control}
                    rules={{ required: '請選擇對照組類別' }}
                    render={({ field, fieldState }) => (
                      <Form.Item
                        label="A. 對照組類別"
                        required
                        validateStatus={fieldState.error ? 'error' : undefined}
                        help={fieldState.error?.message}
                      >
                        <Radio.Group {...field} options={CONTROL_GROUP_OPTIONS} />
                      </Form.Item>
                    )}
                  />

                  {controlGroupType === 'other' && (
                    <Controller
                      name="expedited_control_group_other_detail"
                      control={control}
                      rules={{ required: '請說明其它對照組類別' }}
                      render={({ field, fieldState }) => (
                        <Form.Item
                          label="其它對照組類別說明"
                          required
                          validateStatus={fieldState.error ? 'error' : undefined}
                          help={fieldState.error?.message}
                        >
                          <Input {...field} placeholder="請說明對照組類別" />
                        </Form.Item>
                      )}
                    />
                  )}

                  <Controller
                    name="expedited_control_consent_form"
                    control={control}
                    rules={{
                      validate: (value) => typeof value === 'boolean' || '請選擇是否設計對照組專用說明同意書',
                    }}
                    render={({ field, fieldState }) => (
                      <Form.Item
                        label="B. 是否設計對照組專用之說明同意書"
                        required
                        validateStatus={fieldState.error ? 'error' : undefined}
                        help={fieldState.error?.message}
                      >
                        <Radio.Group value={field.value} onChange={(event) => field.onChange(event.target.value)}>
                          <Radio value={true}>是</Radio>
                          <Radio value={false}>否</Radio>
                        </Radio.Group>
                      </Form.Item>
                    )}
                  />
                </Card>
              )}

              {(showPatientDiseaseName || showCdcStaffReason || showPopulationOtherDetail) && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0 12px' }}>
                  {showPatientDiseaseName && (
                    <Controller
                      name="subject_patient_disease_name"
                      control={control}
                      render={({ field }) => (
                        <Form.Item label="特定病人疾病名稱">
                          <Input {...field} placeholder="例：結核病確定病例" />
                        </Form.Item>
                      )}
                    />
                  )}

                  {showCdcStaffReason && (
                    <Controller
                      name="subject_cdc_staff_reason"
                      control={control}
                      render={({ field }) => (
                        <Form.Item label="納入本署人員之理由">
                          <Input {...field} placeholder="請說明為何需納入本署人員" />
                        </Form.Item>
                      )}
                    />
                  )}

                  {showPopulationOtherDetail && (
                    <Controller
                      name="subject_population_other_detail"
                      control={control}
                      render={({ field }) => (
                        <Form.Item label="研究對象族群其他說明">
                          <Input {...field} placeholder="請說明其他族群" />
                        </Form.Item>
                      )}
                    />
                  )}
                </div>
              )}
            </>
          )}

          <Controller
            name="is_multicenter"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="是否為多中心研究"
                tooltip="若為多中心研究，將於 DOC-12 勾選多中心類別，並輸出各中心資料。"
              >
                <Switch
                  checked={field.value}
                  onChange={(checked) => {
                    field.onChange(checked);
                    if (checked && multicenterSiteFields.length === 0) {
                      appendMulticenterSite(buildEmptyMulticenterSite());
                    }
                    if (!checked) {
                      setValue('review_screening.has_other_irb_approval', false, { shouldDirty: true });
                      clearErrors(['multicenter_type', 'multicenter_sites']);
                    }
                  }}
                  checkedChildren="是"
                  unCheckedChildren="否"
                />
              </Form.Item>
            )}
          />

          {isMulticenter && (
            <Card size="small" style={{ marginBottom: 20 }}>
              <Controller
                name="multicenter_type"
                control={control}
                rules={{ required: '請選擇多中心類型' }}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="多中心類型"
                    required
                    validateStatus={fieldState.error ? 'error' : undefined}
                    help={fieldState.error?.message}
                  >
                    <Radio.Group
                      value={field.value}
                      onChange={(event) => handleMulticenterTypeChange(event.target.value as MulticenterType)}
                      options={[
                        { value: 'domestic', label: '本國多中心' },
                        { value: 'international', label: '多國多中心' },
                      ]}
                    />
                  </Form.Item>
                )}
              />

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {multicenterSiteFields.map((siteField, index) => (
                  <Card
                    key={siteField.id}
                    type="inner"
                    size="small"
                    title={`中心 ${index + 1}`}
                    extra={multicenterSiteFields.length > 1 ? (
                      <Button
                        type="text"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => removeMulticenterSite(index)}
                      >
                        刪除
                      </Button>
                    ) : null}
                  >
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                        gap: '0 12px',
                      }}
                    >
                      <Controller
                        name={`multicenter_sites.${index}.country`}
                        control={control}
                        rules={{ required: '請填寫國別' }}
                        render={({ field, fieldState }) => (
                          <Form.Item
                            label="國別"
                            required
                            validateStatus={fieldState.error ? 'error' : undefined}
                            help={fieldState.error?.message}
                          >
                            <Input {...field} placeholder="例：臺灣" />
                          </Form.Item>
                        )}
                      />
                      <Controller
                        name={`multicenter_sites.${index}.city`}
                        control={control}
                        rules={{ required: '請填寫城市' }}
                        render={({ field, fieldState }) => (
                          <Form.Item
                            label="城市"
                            required
                            validateStatus={fieldState.error ? 'error' : undefined}
                            help={fieldState.error?.message}
                          >
                            <Input {...field} placeholder="例：臺北市" />
                          </Form.Item>
                        )}
                      />
                      <Controller
                        name={`multicenter_sites.${index}.location`}
                        control={control}
                        rules={{ required: '請填寫地點' }}
                        render={({ field, fieldState }) => (
                          <Form.Item
                            label="地點"
                            required
                            validateStatus={fieldState.error ? 'error' : undefined}
                            help={fieldState.error?.message}
                          >
                            <Input {...field} placeholder="例：衛生福利部疾病管制署" />
                          </Form.Item>
                        )}
                      />
                      <Controller
                        name={`multicenter_sites.${index}.contact`}
                        control={control}
                        rules={{ required: '請填寫聯絡人姓名、電話或電子信箱' }}
                        render={({ field, fieldState }) => (
                          <Form.Item
                            label="聯絡人姓名／電話／電子信箱"
                            required
                            validateStatus={fieldState.error ? 'error' : undefined}
                            help={fieldState.error?.message}
                            style={{ gridColumn: '1 / -1' }}
                          >
                            <Input {...field} placeholder="例：王小明／02-12345678／name@example.org" />
                          </Form.Item>
                        )}
                      />
                    </div>
                  </Card>
                ))}
              </div>

              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => appendMulticenterSite(buildEmptyMulticenterSite())}
                style={{ marginTop: 12 }}
              >
                新增中心
              </Button>
            </Card>
          )}

          {/* 是否涉及與其他資料庫連結（DOC-12 第 11 題）。此開關同時影響資料庫使用申請單，
              預設「否」（署內回溯性研究多半不與外部資料庫連結）；勾「是」才填資料庫名稱。 */}
          <Controller
            name="cross_link_data_center"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="是否涉及與其他資料庫連結"
                tooltip="例如將申請的資料與健保資料庫、死因檔等其他資料庫串接分析。若有，請填寫連結的資料庫名稱。"
              >
                <Switch checked={field.value} onChange={field.onChange} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            )}
          />

          {crossLink && (
            <Controller
              name="cross_link_db_name"
              control={control}
              render={({ field }) => (
                <Form.Item label="連結之資料庫名稱">
                  <Input {...field} placeholder="例：全民健康保險研究資料庫" />
                </Form.Item>
              )}
            />
          )}

          <Controller
            name="subject_explainer"
            control={control}
            render={({ field }) => (
              <Form.Item
                label="何人會要求研究對象參與研究，或向研究對象解釋"
                tooltip="請依實際情形說明；若不招募或不直接接觸研究對象，也請註明。"
              >
                <Input.TextArea
                  {...field}
                  rows={2}
                  placeholder="例：由研究護理師進行說明；若不直接接觸研究對象，請據實註明。"
                />
              </Form.Item>
            )}
          />

          {/* 研究類別會用到「檢體採集／防疫用驗餘檢體」時，補一格檢體種類；placeholder 先顯示
              依前面勾選自動整理好的種類，使用者可直接沿用或改成更精確的實際種類。 */}
          {(showCatSpecimenDetail || showCatResidualDetail) && (
            <div style={{ marginBottom: 20 }}>
              {showCatSpecimenDetail && (
                <Controller
                  name="irb0021_cat_specimen_detail"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="檢體採集的檢體種類"
                      extra="可填實際檢體種類（如血液、咽喉拭子）；未填則沿用你前面選的檢體類型。"
                    >
                      <Input {...field} placeholder={catSpecimenKindsDraft || '例：血液、咽喉拭子'} />
                    </Form.Item>
                  )}
                />
              )}
              {showCatResidualDetail && (
                <Controller
                  name="irb0021_cat_residual_detail"
                  control={control}
                  render={({ field }) => (
                    <Form.Item
                      label="防疫用驗餘檢體的檢體種類"
                      extra="可填實際檢體種類；未填則沿用你前面選的檢體類型。"
                    >
                      <Input {...field} placeholder={catResidualKindsDraft || '例：鼻咽採檢拭子、血清'} />
                    </Form.Item>
                  )}
                />
              )}
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <Controller
              name="irb0021_has_specimen"
              control={control}
              render={({ field }) => (
                <Form.Item label="是否有使用檢體？">
                  <Switch
                    checked={field.value ?? inferredHasSpecimen}
                    onChange={field.onChange}
                    checkedChildren="是"
                    unCheckedChildren="否"
                  />
                </Form.Item>
              )}
            />

            {hasSpecimen && (
              <div style={{ marginLeft: 20, paddingLeft: 16, borderLeft: '3px solid #e8e8e8' }}>
                <Controller
                  name="irb0021_has_new_specimen"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="(1) 是否為新採集檢體？">
                      <Radio.Group
                        value={field.value ?? inferredHasNewSpecimen}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <Radio value={false}>否</Radio>
                        <Radio value={true}>是</Radio>
                      </Radio.Group>
                    </Form.Item>
                  )}
                />

                {showNewSpecimenDetail && (
                  <Controller
                    name="specimen_new_detail"
                    control={control}
                    render={({ field }) => (
                      <Form.Item label="是，請說明：">
                        <Input.TextArea
                          {...field}
                          rows={2}
                          placeholder="請說明新採集檢體的種類、來源與採集方式"
                        />
                      </Form.Item>
                    )}
                  />
                )}

                <Controller
                  name="irb0021_has_existing_specimen"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="(2) 是否使用已採集之既存檢體？">
                      <Radio.Group
                        value={field.value ?? inferredHasExistingSpecimen}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <Radio value={false}>否</Radio>
                        <Radio value={true}>是</Radio>
                      </Radio.Group>
                    </Form.Item>
                  )}
                />

                {showExistingSpecimenDetail && (
                  <Controller
                    name="specimen_existing_detail"
                    control={control}
                    render={({ field }) => (
                      <Form.Item
                        label="是，請說明："
                        extra="例如：研究、防疫用驗餘檢體等"
                      >
                        <Input.TextArea
                          {...field}
                          rows={2}
                          placeholder="請說明既存檢體的種類、來源與取得方式"
                        />
                      </Form.Item>
                    )}
                  />
                )}
              </div>
            )}

            <Controller
              name="irb0021_has_data"
              control={control}
              render={({ field }) => (
                <Form.Item label="1. 是否有使用資料？">
                  <Switch
                    checked={field.value ?? inferredHasData}
                    onChange={field.onChange}
                    checkedChildren="是"
                    unCheckedChildren="否"
                  />
                </Form.Item>
              )}
            />

            {hasData && (
              <div style={{ marginLeft: 20, paddingLeft: 16, borderLeft: '3px solid #e8e8e8' }}>
                <Controller
                  name="irb0021_has_new_data"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="(1) 是否為新蒐集資料？">
                      <Radio.Group
                        value={field.value ?? inferredHasNewData}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <Radio value={false}>否</Radio>
                        <Radio value={true}>是</Radio>
                      </Radio.Group>
                    </Form.Item>
                  )}
                />

                {showNewDataDetail && (
                  <Controller
                    name="data_new_detail"
                    control={control}
                    render={({ field }) => (
                      <Form.Item
                        label="是，請說明資料來源及蒐集資料範圍："
                        extra="例如：問卷、深度訪談、觀察研究、焦點團體等"
                      >
                        <Input.TextArea
                          {...field}
                          rows={2}
                          placeholder="請說明資料來源及蒐集資料範圍"
                        />
                      </Form.Item>
                    )}
                  />
                )}

                <Controller
                  name="irb0021_has_existing_data"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="(2) 是否使用既有資料？">
                      <Radio.Group
                        value={field.value ?? inferredHasExistingData}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <Radio value={false}>否</Radio>
                        <Radio value={true}>是</Radio>
                      </Radio.Group>
                    </Form.Item>
                  )}
                />

                {showExistingDataDetail && (
                  <Controller
                    name="data_existing_detail"
                    control={control}
                    render={({ field }) => (
                      <Form.Item
                        label="是，請說明資料來源及使用欄位："
                        extra="例如：醫院病歷、研究衍生、業務蒐集資料或資料庫名稱等，可引述計畫書頁數"
                      >
                        <Input.TextArea
                          {...field}
                          rows={2}
                          placeholder="請說明資料來源及使用欄位"
                        />
                      </Form.Item>
                    )}
                  />
                )}

                <Controller
                  name="irb0021_data_deidentified"
                  control={control}
                  render={({ field }) => (
                    <Form.Item label="(1) 研究資料是否去識別化／去連結？">
                      <Radio.Group
                        value={field.value ?? inferredDataDeidentified}
                        onChange={(event) => field.onChange(event.target.value)}
                      >
                        <Radio value={false}>否</Radio>
                        <Radio value={true}>是</Radio>
                      </Radio.Group>
                    </Form.Item>
                  )}
                />

                {showDeidentificationDetail && (
                  <Controller
                    name="data_deidentification_detail"
                    control={control}
                    render={({ field }) => (
                      <Form.Item label="去識別化／去連結程序">
                        <Input.TextArea
                          {...field}
                          rows={3}
                          placeholder="請說明由何單位、何人於何時完成編碼或去識別化，以及研究團隊是否會接觸可識別個資"
                        />
                      </Form.Item>
                    )}
                  />
                )}
              </div>
            )}
          </div>

          <Controller
            name="expedited_consent_design"
            control={control}
            rules={{ required: '請確認本研究是使用同意書、免除簽署但告知，或申請免除知情同意' }}
            render={({ field, fieldState }) => (
              <Form.Item
                label="本計畫是否設計使用研究對象說明同意書？"
                tooltip="回溯性次級資料研究常為『申請免除知情同意』。"
                validateStatus={fieldState.error ? 'error' : undefined}
                help={fieldState.error?.message}
              >
                <Radio.Group
                  {...field}
                  options={CONSENT_OPTIONS}
                  // 三選項較長，直排避免擠在一起
                  style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                />
              </Form.Item>
            )}
          />

          {consentDesign === 'provide' && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
              title="請另附 IRB-005 研究對象說明暨同意書"
              description="Forminator 目前不產生 IRB-005；送件時請依研究內容備妥並與其他申請文件一併提供。"
            />
          )}

          {consentDesign !== 'waive_full' && (
            <>
              <Controller
                name="expedited_consent_proof_methods"
                control={control}
                rules={{
                  validate: (value) => value.length > 0 || '請至少選擇一種知情同意落實證明方式',
                }}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="如何證明知情同意有落實執行（可複選）"
                    validateStatus={fieldState.error ? 'error' : undefined}
                    help={fieldState.error?.message}
                  >
                    <Checkbox.Group
                      value={field.value}
                      onChange={field.onChange}
                      options={CONSENT_PROOF_OPTIONS}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    />
                  </Form.Item>
                )}
              />

              {consentProofMethods.includes('other') && (
                <Controller
                  name="expedited_consent_proof_other_detail"
                  control={control}
                  rules={{ required: '請說明其他知情同意落實證明方式' }}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="其他證明方式，請說明"
                      validateStatus={fieldState.error ? 'error' : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input.TextArea {...field} rows={2} placeholder="請說明如何證明知情同意已落實執行" />
                    </Form.Item>
                  )}
                />
              )}
            </>
          )}

          {consentDesign === 'waive_signature' && (
            <Controller
              name="expedited_waive_signature_reason"
              control={control}
              render={({ field }) => (
                <Form.Item label="申請免除簽署但須告知，請說明">
                  <Input.TextArea
                    {...field}
                    rows={2}
                    placeholder="請說明申請免除簽署的理由，以及將如何告知研究對象"
                  />
                </Form.Item>
              )}
            />
          )}

          {consentDesign === 'provide' && (
            <>
              <Controller
                name="expedited_consent_sources"
                control={control}
                rules={{
                  validate: (value) => value.length > 0 || '請至少選擇一個研究對象說明暨同意書取得來源',
                }}
                render={({ field, fieldState }) => (
                  <Form.Item
                    label="研究對象說明暨同意書將從何處取得（勾選適用者）"
                    validateStatus={fieldState.error ? 'error' : undefined}
                    help={fieldState.error?.message}
                  >
                    <Checkbox.Group
                      value={field.value}
                      onChange={field.onChange}
                      options={CONSENT_SOURCE_OPTIONS}
                      style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
                    />
                  </Form.Item>
                )}
              />

              {consentSources.includes('other') && (
                <Controller
                  name="expedited_consent_source_other_detail"
                  control={control}
                  rules={{ required: '請說明其他研究對象說明暨同意書取得來源' }}
                  render={({ field, fieldState }) => (
                    <Form.Item
                      label="其它取得來源，請說明"
                      validateStatus={fieldState.error ? 'error' : undefined}
                      help={fieldState.error?.message}
                    >
                      <Input.TextArea {...field} rows={2} placeholder="請說明同意書的其他取得來源" />
                    </Form.Item>
                  )}
                />
              )}
            </>
          )}

          {(consentDesign === 'waive_signature' || consentDesign === 'waive_full') && (
            <Form.Item label="研究對象說明暨同意書將從何處取得（勾選適用者）">
              <span>不適用</span>
            </Form.Item>
          )}

          {consentDesign === 'waive_full' && (
            <Controller
              name="expedited_waive_consent_reason"
              control={control}
              render={({ field }) => (
                <Form.Item label="免除知情同意理由">
                  <Input.TextArea {...field} rows={2} placeholder="例：本研究使用既有去識別化資料，研究風險極低，實務上無法逐一取得研究對象同意。" />
                </Form.Item>
              )}
            />
          )}

          <Controller
            name="expedited_has_followup"
            control={control}
            render={({ field }) => (
              <Form.Item label="是否進行追蹤">
                <Switch checked={field.value} onChange={field.onChange} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            )}
          />

          {hasFollowup && (
            <Controller
              name="expedited_followup_period"
              control={control}
              render={({ field }) => (
                <Form.Item label="追蹤期間">
                  <Input {...field} placeholder="例：自納入日起追蹤 12 個月" />
                </Form.Item>
              )}
            />
          )}

          <Controller
            name="expedited_needs_dsmp"
            control={control}
            render={({ field }) => (
              <Form.Item label="是否需建置資料及安全性監測計畫（DSMP）">
                <Switch checked={field.value} onChange={field.onChange} checkedChildren="是" unCheckedChildren="否" />
              </Form.Item>
            )}
          />

          {needsDsmp && (
            <Alert
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
              title="請另附 IRB-014 資料及安全性監測計畫"
              description="已勾選需要 DSMP。Forminator 目前不產生 IRB-014，送件前請另行備妥。"
            />
          )}

          <IrbCommonFields showExemptDefaults={false} showRosterMethods section="privacy" />
        </>
      ) : null}
    </div>
  );
}
