// 隱私保護草稿 smoke test：
// 直接覆蓋免審、簡審、一般審常見資料情境，避免文案再次用素材類型亂猜「已去識別化」。

import assert from 'node:assert/strict';
import { defaultFormData, emptyReviewScreening } from '../src/data/defaults';
import type { FormData, ReviewScreening } from '../src/types/form';
import {
  assessPrivacyDraftInputs,
  buildDataSourceDraftFromScreening,
  buildPrivacyDraftFromScreening,
} from '../src/utils/exemptIrbText';
import {
  assessPrivacyExample,
  findPrivacyExampleConflict,
  PRIVACY_EXAMPLES,
} from '../src/components/wizard/Step4IRB/privacyExamples';

function form(
  screening: Partial<ReviewScreening>,
  overrides: Partial<FormData> = {},
): FormData {
  return {
    ...defaultFormData,
    ...overrides,
    review_screening: {
      ...emptyReviewScreening,
      ...screening,
    },
  };
}

const providerDeidentified = form({
  data_use_types: ['deidentified_database'],
  data_identifiability: 'provider_deidentified_unidentifiable',
  is_minimal_risk: true,
});
const providerDraft = buildPrivacyDraftFromScreening(providerDeidentified);
assert.match(providerDraft.privacy_during, /提供單位完成去識別化/);
assert.match(providerDraft.privacy_during, /無法辨識特定個人/);
assert.match(providerDraft.privacy_withdrawal, /無法依個別研究對象抽離/);
assert.match(buildDataSourceDraftFromScreening(providerDeidentified), /資料由提供單位完成去識別化/);

const coded = form({
  data_use_types: ['business_data'],
  data_identifiability: 'coded_researcher_unidentifiable',
  is_minimal_risk: true,
});
const codedDraft = buildPrivacyDraftFromScreening(coded);
assert.match(codedDraft.privacy_during, /匿名編碼/);
assert.match(codedDraft.privacy_during, /不持有編碼對照資訊/);
assert.doesNotMatch(codedDraft.privacy_during, /去連結/);
assert.match(codedDraft.privacy_withdrawal, /有權保管編碼對照資訊之單位/);

const identifiableMedicalRecord = form({
  data_use_types: ['medical_record'],
  data_identifiability: 'identifiable_or_linkable',
  is_minimal_risk: true,
});
const identifiableDraft = buildPrivacyDraftFromScreening(identifiableMedicalRecord);
assert.match(identifiableDraft.privacy_during, /可識別或可回連/);
assert.match(identifiableDraft.privacy_during, /最小必要資料/);
assert.match(identifiableDraft.privacy_after, /非經授權不得存取或回連/);
assert.doesNotMatch(identifiableDraft.privacy_during, /病歷資料已去識別化/);
assert.doesNotMatch(buildDataSourceDraftFromScreening(identifiableMedicalRecord), /去識別化病歷資料/);

const expeditedMinimalRisk = form({
  data_use_types: ['noninvasive_measurement'],
  data_identifiability: 'coded_researcher_unidentifiable',
  is_minimal_risk: true,
}, { review_type: 'expedited' });
assert.match(buildPrivacyDraftFromScreening(expeditedMinimalRisk).privacy_during, /最低風險方式/);

const fullNonMinimalRisk = form({
  data_use_types: ['other_new_data'],
  data_identifiability: 'identifiable_or_linkable',
  is_minimal_risk: false,
}, { review_type: 'full' });
assert.doesNotMatch(buildPrivacyDraftFromScreening(fullNonMinimalRisk).privacy_during, /最低風險/);

const recruited = form({
  data_use_types: ['behavior_or_trait'],
  data_identifiability: 'identifiable_or_linkable',
  has_direct_subject_contact: true,
  is_minimal_risk: true,
}, { recruit_subjects: true });
const recruitedDraft = buildPrivacyDraftFromScreening(recruited);
assert.match(recruitedDraft.privacy_during, /告知、同意及權益保護/);
assert.match(recruitedDraft.privacy_withdrawal, /提出撤回或停止使用/);

const specimen = form({
  specimen_use_types: ['cdc_residual_specimen'],
  data_identifiability: 'coded_researcher_unidentifiable',
  is_minimal_risk: true,
});
assert.match(buildPrivacyDraftFromScreening(specimen).privacy_after, /生物安全及實驗室管理規範/);

const publicData = form({
  data_use_types: ['public_info'],
  data_identifiability: 'public_or_legally_open',
  is_minimal_risk: true,
});
const publicDraft = buildPrivacyDraftFromScreening(publicData);
assert.match(publicDraft.privacy_during, /依法公開且符合公開目的/);
assert.match(publicDraft.privacy_withdrawal, /不涉及研究對象中途退出/);

const unknown = form({
  data_use_types: ['medical_record'],
  data_identifiability: 'unknown',
});
const unknownDraft = buildPrivacyDraftFromScreening(unknown);
const unknownAssessment = assessPrivacyDraftInputs(unknown);
assert.equal(unknownAssessment.identifiabilityConfirmed, false);
assert.match(unknownDraft.privacy_during, /可識別性與回連方式尚待確認/);
assert.match(unknownDraft.privacy_withdrawal, /應於正式送件前依實際流程補充/);
assert.doesNotMatch(unknownDraft.privacy_during, /病歷資料已去識別化/);

const blankIdentifiability = form({
  data_use_types: ['deidentified_database'],
});
assert.equal(assessPrivacyDraftInputs(blankIdentifiability).identifiabilityConfirmed, false);
assert.match(buildPrivacyDraftFromScreening(blankIdentifiability).privacy_during, /尚待確認/);

const incompatibleExample = assessPrivacyExample(
  PRIVACY_EXAMPLES[0],
  identifiableMedicalRecord,
);
assert.equal(incompatibleExample.level, 'incompatible');
assert.equal(
  findPrivacyExampleConflict(new Set([7]), 8),
  PRIVACY_EXAMPLES[7],
  '「不可個別抽離」與「退出即全數銷毀」不得同時勾選',
);

console.log('[privacy-draft-smoke] ✓ 10 種資料情境、適用性標籤與退出衝突規則通過');
