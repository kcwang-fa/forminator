// 驗證 DOC-12 對照組欄位：
//   1. docgen 只在「有對照組」時勾類別與專用說明同意書。
//   2. DOC-12 模板可渲染新增 placeholder，且「其它」說明文字會帶入。

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';
import { defaultFormData } from '../src/data/defaults';
import { prepareIrb002_1Data } from '../src/utils/docgen/irb0021';

const __dirname = dirname(fileURLToPath(import.meta.url));
const templatePath = resolve(__dirname, '../public/templates/DOC-12.docx');

const noControl = prepareIrb002_1Data({
  ...defaultFormData,
  recruit_subjects: true,
  expedited_has_control_group: false,
  expedited_control_group_type: 'case_control',
  expedited_control_consent_form: true,
});
assert.equal(noControl.irb0021_control_no, '■');
assert.equal(noControl.irb0021_control_case, '□');
assert.equal(noControl.irb0021_control_consent_yes, '□');

const noRecruitment = prepareIrb002_1Data({
  ...defaultFormData,
  recruit_subjects: false,
  subject_count: '500',
  subject_explainer: '由研究護理師進行說明',
  subject_population_groups: ['patient'],
  subject_patient_disease_name: '結核病',
  subject_roster_methods: ['existing_db'],
  subject_roster_existing_db_name: '傳染病個案通報系統',
  expedited_subject_relationship: 'other',
  expedited_subject_relationship_other_detail: '社區合作研究者',
  expedited_has_control_group: true,
  expedited_control_group_type: 'case_control',
  expedited_control_consent_form: true,
  review_screening: {
    ...defaultFormData.review_screening,
    data_use_types: ['deidentified_database'],
  },
});
assert.equal(noRecruitment.subject_count, '');
assert.equal(noRecruitment.subject_explainer, '由研究護理師進行說明');
assert.equal(noRecruitment.irb0021_pop_patient, '□');
assert.equal(noRecruitment.subject_patient_disease_name, '');
assert.equal(noRecruitment.irb0021_roster_existing_db, '□');
assert.equal(noRecruitment.subject_roster_existing_db_name, '');
assert.equal(noRecruitment.irb0021_rel_other, '□');
assert.equal(noRecruitment.subject_relationship_other_detail, '');
assert.equal(noRecruitment.irb0021_control_yes, '□');
assert.equal(noRecruitment.irb0021_control_no, '□');
assert.equal(noRecruitment.irb0021_control_case, '□');
assert.equal(noRecruitment.irb0021_control_consent_yes, '□');

const waiveSignature = prepareIrb002_1Data({
  ...defaultFormData,
  expedited_consent_design: 'waive_signature',
  expedited_consent_proof_methods: ['team_record', 'other'],
  expedited_consent_proof_other_detail: '保留告知紀錄與研究對象確認回覆',
  expedited_waive_signature_reason: '以口頭及書面資訊告知研究內容，但不蒐集簽名',
  expedited_waive_consent_reason: '不應輸出',
});
assert.equal(waiveSignature.irb0021_consent_provide, '□');
assert.equal(waiveSignature.irb0021_consent_waive_signature, '■');
assert.equal(waiveSignature.irb0021_consent_waive_full, '□');
assert.equal(waiveSignature.irb0021_consent_proof_datetime, '□');
assert.equal(waiveSignature.irb0021_consent_proof_witness, '□');
assert.equal(waiveSignature.irb0021_consent_proof_record, '■');
assert.equal(waiveSignature.irb0021_consent_proof_other, '■');
assert.equal(waiveSignature.consent_proof_other_detail, '保留告知紀錄與研究對象確認回覆');
assert.equal(waiveSignature.irb0021_consent_source_subject, '□');
assert.equal(waiveSignature.irb0021_consent_source_other, '□');
assert.equal(waiveSignature.consent_source_other_detail, '');
assert.equal(waiveSignature.consent_source_na, '不適用');
assert.equal(waiveSignature.waive_signature_reason, '以口頭及書面資訊告知研究內容，但不蒐集簽名');
assert.equal(waiveSignature.waive_consent_reason, '');

const waiveSignatureDoc = new Docxtemplater(new PizZip(readFileSync(templatePath)), {
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => '',
});
waiveSignatureDoc.render(waiveSignature);
const waiveSignatureXml = waiveSignatureDoc.getZip().file('word/document.xml').asText();
const waiveSignatureText = [...waiveSignatureXml.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)]
  .map((match) => match[1])
  .join('');
assert.match(
  waiveSignatureText,
  /免除簽署但須告知，請說明以口頭及書面資訊告知研究內容，但不蒐集簽名/,
);
assert.match(waiveSignatureText, /■\s*由研究團隊記錄知情同意過程/);
assert.match(waiveSignatureText, /■\s*其他，請說明保留告知紀錄與研究對象確認回覆/);
assert.match(
  waiveSignatureText,
  /研究對象說明暨同意書將從何處取得（勾選適用者）：不適用/,
);

const provideConsent = prepareIrb002_1Data({
  ...defaultFormData,
  expedited_consent_design: 'provide',
  expedited_consent_proof_methods: ['signed_datetime', 'witness_signature'],
  expedited_consent_sources: ['subject', 'parent', 'legal_representative', 'other'],
  expedited_consent_source_other_detail: '經法院指定之特別代理人',
});
assert.equal(provideConsent.irb0021_consent_provide, '■');
assert.equal(provideConsent.irb0021_consent_source_subject, '■');
assert.equal(provideConsent.irb0021_consent_source_parent, '■');
assert.equal(provideConsent.irb0021_consent_source_guardian, '□');
assert.equal(provideConsent.irb0021_consent_source_authorized_person, '□');
assert.equal(provideConsent.irb0021_consent_source_legal_representative, '■');
assert.equal(provideConsent.irb0021_consent_source_other, '■');
assert.equal(provideConsent.consent_source_other_detail, '經法院指定之特別代理人');
assert.equal(provideConsent.consent_source_na, '');

const provideConsentDoc = new Docxtemplater(new PizZip(readFileSync(templatePath)), {
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => '',
});
provideConsentDoc.render(provideConsent);
const provideConsentXml = provideConsentDoc.getZip().file('word/document.xml').asText();
const provideConsentText = [...provideConsentXml.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)]
  .map((match) => match[1])
  .join('');
assert.match(provideConsentText, /■\s*研究對象\s+■\s*研究對象之父母/);
assert.match(provideConsentText, /■\s*研究對象之法定代理人/);
assert.match(provideConsentText, /■\s*其它，請說明經法院指定之特別代理人/);

const specimenOverride = prepareIrb002_1Data({
  ...defaultFormData,
  irb0021_has_specimen: true,
  irb0021_has_new_specimen: false,
  irb0021_has_existing_specimen: true,
  specimen_new_detail: '不應輸出的新採集檢體說明',
  specimen_existing_detail: '防疫用驗餘檢體',
  review_screening: {
    ...defaultFormData.review_screening,
    specimen_use_types: ['new_noninvasive_specimen'],
  },
});
assert.equal(specimenOverride.irb0021_specimen_yes, '■');
assert.equal(specimenOverride.irb0021_specimen_no, '□');
assert.equal(specimenOverride.irb0021_specimen_new_no, '■');
assert.equal(specimenOverride.irb0021_specimen_new_yes, '□');
assert.equal(specimenOverride.irb0021_specimen_existing_no, '□');
assert.equal(specimenOverride.irb0021_specimen_existing_yes, '■');
assert.equal(specimenOverride.specimen_new_detail, '');
assert.equal(specimenOverride.specimen_existing_detail, '防疫用驗餘檢體');

const noSpecimenOverride = prepareIrb002_1Data({
  ...defaultFormData,
  irb0021_has_specimen: false,
  irb0021_has_new_specimen: true,
  irb0021_has_existing_specimen: true,
  specimen_new_detail: '不應輸出',
  specimen_existing_detail: '不應輸出',
  review_screening: {
    ...defaultFormData.review_screening,
    specimen_use_types: ['new_noninvasive_specimen', 'cdc_residual_specimen'],
  },
});
assert.equal(noSpecimenOverride.irb0021_specimen_yes, '□');
assert.equal(noSpecimenOverride.irb0021_specimen_no, '■');
assert.equal(noSpecimenOverride.irb0021_specimen_new_no, '□');
assert.equal(noSpecimenOverride.irb0021_specimen_new_yes, '□');
assert.equal(noSpecimenOverride.irb0021_specimen_existing_no, '□');
assert.equal(noSpecimenOverride.irb0021_specimen_existing_yes, '□');
assert.equal(noSpecimenOverride.specimen_new_detail, '');
assert.equal(noSpecimenOverride.specimen_existing_detail, '');

const dataOverride = prepareIrb002_1Data({
  ...defaultFormData,
  irb0021_has_data: true,
  irb0021_has_new_data: true,
  irb0021_has_existing_data: false,
  irb0021_data_deidentified: true,
  data_new_detail: '焦點團體訪談資料',
  data_existing_detail: '不應輸出的既有資料說明',
  data_deidentification_detail: '由資料管理單位移除直接識別欄位',
  review_screening: {
    ...defaultFormData.review_screening,
    data_use_types: ['deidentified_database'],
    data_identifiability: 'identifiable_or_linkable',
  },
});
assert.equal(dataOverride.irb0021_data_yes, '■');
assert.equal(dataOverride.irb0021_data_no, '□');
assert.equal(dataOverride.irb0021_data_new_no, '□');
assert.equal(dataOverride.irb0021_data_new_yes, '■');
assert.equal(dataOverride.irb0021_data_existing_no, '■');
assert.equal(dataOverride.irb0021_data_existing_yes, '□');
assert.equal(dataOverride.data_new_detail, '焦點團體訪談資料');
assert.equal(dataOverride.data_existing_detail, '');
assert.equal(dataOverride.irb0021_deid_yes, '■');
assert.equal(dataOverride.irb0021_deid_no, '□');
assert.equal(dataOverride.data_deidentification_detail, '由資料管理單位移除直接識別欄位');

const identifiableDataOverride = prepareIrb002_1Data({
  ...defaultFormData,
  irb0021_has_data: true,
  irb0021_data_deidentified: false,
  data_deidentification_detail: '不應輸出',
  review_screening: {
    ...defaultFormData.review_screening,
    data_use_types: ['deidentified_database'],
    data_identifiability: 'provider_deidentified_unidentifiable',
  },
});
assert.equal(identifiableDataOverride.irb0021_deid_yes, '□');
assert.equal(identifiableDataOverride.irb0021_deid_no, '■');
assert.equal(identifiableDataOverride.data_deidentification_detail, '');

const noDataOverride = prepareIrb002_1Data({
  ...defaultFormData,
  irb0021_has_data: false,
  irb0021_has_new_data: true,
  irb0021_has_existing_data: true,
  data_new_detail: '不應輸出',
  data_existing_detail: '不應輸出',
  review_screening: {
    ...defaultFormData.review_screening,
    data_use_types: ['minimal_risk_new_data', 'deidentified_database'],
    data_identifiability: 'provider_deidentified_unidentifiable',
  },
});
assert.equal(noDataOverride.irb0021_data_yes, '□');
assert.equal(noDataOverride.irb0021_data_no, '■');
assert.equal(noDataOverride.irb0021_data_new_no, '□');
assert.equal(noDataOverride.irb0021_data_new_yes, '□');
assert.equal(noDataOverride.irb0021_data_existing_no, '□');
assert.equal(noDataOverride.irb0021_data_existing_yes, '□');
assert.equal(noDataOverride.data_new_detail, '');
assert.equal(noDataOverride.data_existing_detail, '');
assert.equal(noDataOverride.irb0021_deid_yes, '□');
assert.equal(noDataOverride.irb0021_deid_no, '□');
assert.equal(noDataOverride.data_deidentification_detail, '');

const otherControl = prepareIrb002_1Data({
  ...defaultFormData,
  recruit_subjects: true,
  expedited_has_control_group: true,
  expedited_control_group_type: 'other',
  expedited_control_group_other_detail: '歷史同期對照',
  expedited_control_consent_form: false,
  expedited_subject_relationship: 'other',
  expedited_subject_relationship_other_detail: '社區合作研究者',
  expedited_consent_design: 'waive_full',
  expedited_consent_proof_methods: ['signed_datetime', 'witness_signature', 'team_record', 'other'],
  expedited_consent_proof_other_detail: '不應輸出',
  expedited_consent_sources: ['subject', 'other'],
  expedited_consent_source_other_detail: '不應輸出',
  expedited_waive_consent_reason: '使用既有去識別化資料，實務上無法逐一取得同意',
  expedited_has_followup: true,
  expedited_followup_period: '自納入日起追蹤 12 個月',
  subject_population_groups: ['patient', 'cdc_staff', 'other'],
  subject_patient_disease_name: '結核病',
  subject_cdc_staff_reason: '需分析本署內部訓練資料',
  subject_population_other_detail: '長照機構住民',
  subject_roster_methods: ['existing_db', 'existing_project', 'other'],
  subject_roster_existing_db_name: '傳染病個案通報系統',
  subject_roster_existing_project_name: '既有監測計畫',
  subject_roster_other_detail: '由合作單位提供名冊',
  specimen_new_detail: '新採集鼻咽拭子',
  specimen_existing_detail: '防疫業務驗餘血清',
  data_new_detail: '問卷資料，蒐集基本人口學與暴露史',
  data_existing_detail: '通報資料庫之性別、年齡、發病日與居住縣市欄位',
  data_deidentification_detail: '資料提供前由資料管理單位移除直接識別欄位並以流水號編碼，研究團隊不接觸身分證字號或姓名',
  review_screening: {
    ...defaultFormData.review_screening,
    specimen_use_types: ['new_noninvasive_specimen', 'cdc_residual_specimen'],
    data_use_types: ['minimal_risk_new_data', 'deidentified_database'],
    data_identifiability: 'provider_deidentified_unidentifiable',
  },
});
assert.equal(otherControl.irb0021_control_yes, '■');
assert.equal(otherControl.irb0021_control_case, '□');
assert.equal(otherControl.irb0021_control_placebo, '□');
assert.equal(otherControl.irb0021_control_other, '■');
assert.equal(otherControl.irb0021_control_consent_yes, '□');
assert.equal(otherControl.irb0021_control_consent_no, '■');
assert.equal(otherControl.irb0021_consent_proof_datetime, '□');
assert.equal(otherControl.irb0021_consent_proof_witness, '□');
assert.equal(otherControl.irb0021_consent_proof_record, '□');
assert.equal(otherControl.irb0021_consent_proof_other, '□');
assert.equal(otherControl.consent_proof_other_detail, '');
assert.equal(otherControl.irb0021_consent_source_subject, '□');
assert.equal(otherControl.irb0021_consent_source_other, '□');
assert.equal(otherControl.consent_source_other_detail, '');
assert.equal(otherControl.consent_source_na, '不適用');
assert.equal(otherControl.control_group_other_detail, '歷史同期對照');
assert.equal(otherControl.subject_relationship_other_detail, '社區合作研究者');
assert.equal(otherControl.subject_patient_disease_name, '結核病');
assert.equal(otherControl.subject_roster_existing_db_name, '傳染病個案通報系統');
assert.equal(otherControl.specimen_existing_detail, '防疫業務驗餘血清');
assert.equal(otherControl.data_existing_detail, '通報資料庫之性別、年齡、發病日與居住縣市欄位');
assert.equal(
  otherControl.data_deidentification_detail,
  '資料提供前由資料管理單位移除直接識別欄位並以流水號編碼，研究團隊不接觸身分證字號或姓名',
);
assert.equal(otherControl.waive_consent_reason, '使用既有去識別化資料，實務上無法逐一取得同意');
assert.equal(otherControl.followup_period, '自納入日起追蹤 12 個月');
// 研究類別「(請述明檢體種類)」自動草稿：new_noninvasive_specimen 屬「檢體採集」、
// cdc_residual_specimen 屬「防疫用驗餘檢體」，兩格都被勾，種類文字自動帶入對應 label。
assert.equal(otherControl.irb0021_cat_specimen_detail, '非侵入性新採檢體');
assert.equal(otherControl.irb0021_cat_residual_detail, '防疫驗餘檢體');

const zip = new PizZip(readFileSync(templatePath));
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  nullGetter: () => '',
});
doc.render(otherControl);

const xml = doc.getZip().file('word/document.xml').asText();
const text = [...xml.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>/g)]
  .map((match) => match[1])
  .join('');
assert.match(text, /■\s*其它，請說明：歷史同期對照/);
assert.match(text, /是否設計對照組專用之說明同意書？□是\s+■否/);
assert.match(text, /特定病人，疾病名稱：結核病/);
assert.match(text, /本署人員，理由：需分析本署內部訓練資料/);
assert.match(text, /既有資訊系統或資料庫，資訊系統或資料庫名稱：傳染病個案通報系統/);
assert.match(text, /既有計畫的研究對象名單：既有監測計畫/);
assert.match(text, /其它，請說明：社區合作研究者/);
assert.match(text, /新採集鼻咽拭子/);
assert.match(text, /防疫業務驗餘血清/);
assert.match(text, /問卷資料，蒐集基本人口學與暴露史/);
assert.match(text, /通報資料庫之性別、年齡、發病日與居住縣市欄位/);
assert.match(text, /去識別化\/去連結之程序.*資料提供前由資料管理單位移除直接識別欄位並以流水號編碼/);
assert.match(text, /免除知情同意，請說明使用既有去識別化資料，實務上無法逐一取得同意/);
assert.match(text, /追蹤期間：自納入日起追蹤 12 個月/);
// 研究類別「檢體採集：<種類>」自動草稿確實渲染進 DOC-12（提示文字「(請述明檢體種類)」仍保留在後）。
assert.match(text, /檢體採集：非侵入性新採檢體\s+\(請述明檢體種類\)/);

// 研究類別檢體種類：使用者手填優先於自動草稿；未勾到該類別時留空。
const catKindOverride = prepareIrb002_1Data({
  ...defaultFormData,
  irb0021_cat_specimen_detail: '全血及血清', // 手填覆寫自動草稿
  review_screening: {
    ...defaultFormData.review_screening,
    specimen_use_types: ['limited_blood_draw'], // 屬「檢體採集」、非「防疫用驗餘檢體」
  },
});
assert.equal(catKindOverride.irb0021_cat_specimen_detail, '全血及血清'); // 手填優先於草稿（草稿應為「限量採血」）
assert.equal(catKindOverride.irb0021_cat_residual_detail, ''); // 沒勾防疫驗餘 → 留空

console.log('[control-group-docx-smoke] ✓ DOC-12 對照組與部分接上欄位渲染正確');
