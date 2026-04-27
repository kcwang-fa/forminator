// ===== 資料庫區塊 placeholder 準備（DOC-8 / DOC-9 / DOC-10 / DOC-11）=====
//
// 從 docgen.ts 抽出以隔離高脆弱度區。動這支前一定先讀 CLAUDE.md「特別雷區」段：
//   - inject-doc8.cjs 的清冊是右到左注入，避免欄位漂移 — 這支不要動到那行為
//   - doc9_apply_scope_text 不能退回用 apply_condition
//   - doc11_request_desc 跟著 buildDatabaseUsageScopePreview 走，UI preview 一致
//
// 修改後務必 `npm run snapshot:check` 比對基準線。

import type { FormData, Personnel } from '../../types/form';
import { toRocDate } from '../date';
import { emptyDatabaseRequest } from '../../data/defaults';
import { PURPOSE_MAP, ANALYSIS_LOCATION_MAP, OUTCOME_TYPE_MAP } from '../docgenMaps';
import {
  buildDatabaseUsageScopePreview,
  buildDatabaseUsageScopeSummary,
  getApplySystemText,
  getDataFieldRows,
  hasDatabaseRequestContent,
} from '../databaseScope';

function getReviewTypeText(reviewType: FormData['review_type']) {
  if (reviewType === 'expedited') return '簡易審查';
  if (reviewType === 'full') return '一般審查';
  return '免審';
}

function getApplyYearText(data: Pick<FormData, 'apply_year_start' | 'apply_year_end'>) {
  const start = data.apply_year_start ? toRocDate(data.apply_year_start) : '';
  const end = data.apply_year_end ? toRocDate(data.apply_year_end) : '';
  if (start && end) return `${start}至${end}`;
  return start || end;
}

function getDoc9ApplyScopeText(
  data: Pick<FormData, 'apply_year_start' | 'apply_year_end'>,
  applyCondition: string,
) {
  const startYear = data.apply_year_start ? String(new Date(data.apply_year_start).getFullYear() - 1911) : '';
  const endYear = data.apply_year_end ? String(new Date(data.apply_year_end).getFullYear() - 1911) : '';
  const yearText = startYear && endYear
    ? `${startYear}至${endYear}年`
    : startYear
      ? `${startYear}年`
      : endYear
        ? `${endYear}年`
        : '';
  const conditionText = applyCondition.trim();
  return [yearText, conditionText].filter(Boolean).join(' ');
}

function getDoc8ApplyPurposeText(data: Pick<FormData, 'db_apply_purpose' | 'purpose'>) {
  return data.db_apply_purpose.trim() || data.purpose.trim() || '研究及發表';
}

export function prepareDatabaseData(data: FormData, pi: Personnel) {
  const outcomeDetails = data.outcome_type_detail;
  const findOutcome = (t: string) => outcomeDetails.find(o => o.type === t);
  const databaseRequests = (data.database_requests?.length > 0 ? data.database_requests : [{ ...emptyDatabaseRequest }])
    .filter(request => hasDatabaseRequestContent(request));
  const doc8Requests = Array.from({ length: 3 }, (_, index) => databaseRequests[index] || null);
  const primaryRequest = databaseRequests[0] || { ...emptyDatabaseRequest };
  const applySystemText = getApplySystemText(primaryRequest);
  const applyPurposeText = getDoc8ApplyPurposeText(data);
  const dataFieldRows = getDataFieldRows(primaryRequest, applyPurposeText);
  const dbUsageScope = buildDatabaseUsageScopeSummary(databaseRequests);
  const dbUsageScopePreview = buildDatabaseUsageScopePreview(data.database_requests?.length > 0 ? data.database_requests : [{ ...emptyDatabaseRequest }]);
  const applyYearText = getApplyYearText(data);
  const doc9ApplyScopeText = getDoc9ApplyScopeText(data, primaryRequest.apply_condition || '');

  // 申請年度（西元 YYYY 年）
  // 申請日期拆解（DOC-10 分年／月／日欄位）— 民國年
  const applyDate = data.apply_date || data.filing_date;
  const filingDate = applyDate ? new Date(applyDate) : null;
  const filingYear  = filingDate ? String(filingDate.getFullYear() - 1911) : '';
  const filingMonth = filingDate ? String(filingDate.getMonth() + 1).padStart(2, ' ') : '';
  const filingDay   = filingDate ? String(filingDate.getDate()) : '';

  const doc8BlockData = doc8Requests.reduce<Record<string, unknown>>((acc, request, index) => {
    const suffix = index === 0 ? '' : `_${index + 1}`;
    acc[`apply_system_text${suffix}`] = request ? getApplySystemText(request) : '';
    acc[`apply_condition${suffix}`] = request?.apply_condition || '';
    acc[`apply_year_text${suffix}`] = request ? applyYearText : '';
    acc[`data_field_rows${suffix}`] = request ? getDataFieldRows(request, applyPurposeText) : [];
    return acc;
  }, {});

  return {
    apply_unit: data.apply_unit,
    analysis_deadline_roc: toRocDate(data.execution_end || data.analysis_deadline),
    retention_deadline_roc: toRocDate(data.retention_deadline),
    research_purpose_type_text: PURPOSE_MAP[data.research_purpose_type] || data.research_purpose_type,
    delivery_format_text: data.delivery_format === 'digital' ? '數位檔案' : '紙本',
    analysis_location_text: data.analysis_location.map(loc => ANALYSIS_LOCATION_MAP[loc] || loc).join('、'),
    outcome_type_text: outcomeDetails.map(o =>
      `${OUTCOME_TYPE_MAP[o.type] || o.type} ${o.count} 件`
    ).join('、'),
    pi_same_text: data.pi_same_as_applicant
      ? '同申請人員'
      : `${pi.name_zh || ''} / ${pi.title || ''} / ${pi.unit || ''}`,
    cross_link_text: data.cross_link_data_center ? '是' : '否',
    db_usage_scope: dbUsageScope,
    // DOC-8 checkbox
    purpose_internal: data.research_purpose_type === 'internal_research' ? '■' : '□',
    purpose_thesis: data.research_purpose_type === 'thesis' ? '■' : '□',
    purpose_no_fund: data.research_purpose_type === 'no_fund_research' ? '■' : '□',
    purpose_other: data.research_purpose_type === 'other' ? '■' : '□',
    purpose_other_detail: data.research_purpose_other_detail || '',
    delivery_paper: data.delivery_format === 'paper' ? '■' : '□',
    delivery_digital: data.delivery_format === 'digital' ? '■' : '□',
    loc_office: data.analysis_location.includes('office') ? '■' : '□',
    loc_pc: data.analysis_location.includes('personal_pc') ? '■' : '□',
    loc_other: data.analysis_location.includes('other_platform') ? '■' : '□',
    loc_data_center: data.analysis_location.includes('data_center') ? '■' : '□',
    pi_same: data.pi_same_as_applicant ? '■' : '□',
    cross_link_no: data.cross_link_data_center ? '□' : '■',
    cross_link_yes: data.cross_link_data_center ? '■' : '□',
    cross_link_db_name: '',

    // DOC-8 第三區、DOC-9、DOC-10、DOC-11 共用
    apply_system_text:  applySystemText,
    apply_condition:    primaryRequest.apply_condition || '',
    apply_year_text:    applyYearText,
    doc9_apply_scope_text: doc9ApplyScopeText,
    data_field_rows:    dataFieldRows,
    ...doc8BlockData,
    irb_number:         data.irb_number || '',
    irb_review_type_text: getReviewTypeText(data.review_type),
    pi_unit:            pi.unit || '',
    filing_year:        filingYear,
    filing_month:       filingMonth,
    filing_day:         filingDay,
    doc10_data_scope:   dbUsageScope,
    doc11_request_desc: dbUsageScopePreview,
    // 成果類型 checkbox 和計數
    outcome_policy: findOutcome('policy') ? '■' : '□',
    outcome_policy_count: findOutcome('policy')?.count?.toString() || '___',
    outcome_report: findOutcome('report') ? '■' : '□',
    outcome_report_count: findOutcome('report')?.count?.toString() || '___',
    outcome_paper_writing: findOutcome('paper_writing') ? '■' : '□',
    outcome_paper_writing_count: findOutcome('paper_writing')?.count?.toString() || '___',
    outcome_paper_publish: findOutcome('paper_publish') ? '■' : '□',
    outcome_paper_publish_count: findOutcome('paper_publish')?.count?.toString() || '___',
    outcome_paper_publish_date: toRocDate(findOutcome('paper_publish')?.publish_date || ''),
    outcome_other: findOutcome('other') ? '■' : '□',
    outcome_other_count: findOutcome('other')?.count?.toString() || '___',

    // DOC-7（保密切結書，逐人）/ DOC-8（資料庫使用申請單）共同人員清冊：
    // 帶入除 PI 外的所有已填人員。注意 DOC-7 是 PER_PERSON_DOCS，DOC-8 是表格 loop。
    db_personnel: data.personnel.filter(p => p.role !== 'pi' && !!p.name_zh.trim()).map(p => ({
      name_zh: p.name_zh,
      unit: p.unit,
      title: p.title,
      phone: p.phone,
    })),
  };
}
