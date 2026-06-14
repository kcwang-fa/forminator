import { defaultFormData, emptyDatabaseRequest, emptyReviewScreening } from '../data/defaults';
import type { BudgetItem, DatabaseFieldPurpose, DatabaseRequest, ExemptCategory, FormData, GanttYear, MulticenterSite, OutcomeTypeDetail, ReviewScreening } from '../types/form';
import { calcProjectYears } from './date';
import { getYearAmounts, sumYearAmounts } from './budgetCalc';
import { monthsPerYear } from './gantt';

const LEGACY_PRIVACY_DEFAULTS = {
  privacy_during: '本研究使用之資料庫已去除個人識別資訊，研究過程中所有資料皆儲存於符合 ISMS 資訊安全管理規範之加密環境中，僅限經授權之研究人員得以接觸分析資料。',
  privacy_after: '研究成果僅以群體統計量呈現，不揭露任何個案資訊。原始分析資料於計畫結束後保留三年，届滿後依機關資料銷毀程序辦理。',
  privacy_withdrawal: '本研究採用次級資料庫進行分析，無法回溯識別個別研究對象，故無中途退出之情形。',
} as const;

type LegacyDatabaseFields = {
  apply_system?: DatabaseRequest['apply_system'];
  apply_system_other?: string;
  apply_condition?: string;
  apply_year_start?: string;
  apply_year_end?: string;
  data_fields?: DatabaseRequest['data_fields'];
  data_fields_other?: DatabaseRequest['data_fields_other'] | string;
  db_usage_scope?: string;
};

type MaybeLegacyFormData = Partial<FormData> & LegacyDatabaseFields & {
  outcome_type_detail?: Partial<OutcomeTypeDetail>[];
  review_screening?: Partial<ReviewScreening>;
  // 舊草稿 exempt_category 是單一字串（或空字串表示未選），新版改成可複選陣列
  exempt_category?: ExemptCategory[] | ExemptCategory | '';
  database_requests?: Array<Partial<DatabaseRequest> & {
    data_fields_other?: string[] | string;
    doc8_field_purposes?: Partial<DatabaseFieldPurpose>[];
    apply_year_start?: string;
    apply_year_end?: string;
  }>;
};

function normalizeOtherFields(value: string[] | string | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value
    ? value.split(/[、，,\n;；]+/).map(item => item.trim()).filter(Boolean)
    : [];
}

function normalizeOutcomeTypeDetails(details: MaybeLegacyFormData['outcome_type_detail']): OutcomeTypeDetail[] {
  if (!Array.isArray(details)) return [];
  return details.map(detail => ({
    type: detail.type || 'other',
    count: detail.count || 1,
    note: detail.note || '',
    publish_date: detail.publish_date || '',
  }));
}

function normalizeDoc8FieldPurposes(details: Partial<DatabaseFieldPurpose>[] | undefined): DatabaseFieldPurpose[] {
  if (!Array.isArray(details)) return [];
  return details
    .map(detail => ({
      field_name: detail.field_name || '',
      apply_purpose: detail.apply_purpose || '',
    }))
    .filter(detail => detail.field_name.trim());
}

function normalizeDatabaseRequest(request: Partial<DatabaseRequest> & { data_fields_other?: string[] | string } | undefined): DatabaseRequest {
  return {
    ...emptyDatabaseRequest,
    ...request,
    data_fields: request?.data_fields || [],
    data_fields_other: normalizeOtherFields(request?.data_fields_other),
    doc8_field_purposes: normalizeDoc8FieldPurposes(request?.doc8_field_purposes),
    db_usage_scope_item: request?.db_usage_scope_item || '',
    db_usage_scope_item_manual: request?.db_usage_scope_item_manual || false,
  };
}

function normalizeDatabaseRequests(data: MaybeLegacyFormData): DatabaseRequest[] {
  if (Array.isArray(data.database_requests) && data.database_requests.length > 0) {
    return data.database_requests.map((rawRequest) => {
      const request = {
        ...rawRequest,
      } as Partial<DatabaseRequest> & { data_fields_other?: string[] | string; apply_year_start?: string; apply_year_end?: string };
      delete request.apply_year_start;
      delete request.apply_year_end;
      return normalizeDatabaseRequest(request);
    });
  }

  const hasLegacyDatabaseData = Boolean(
    data.apply_system ||
    data.apply_system_other ||
    data.apply_condition ||
    data.apply_year_start ||
    data.apply_year_end ||
    (Array.isArray(data.data_fields) && data.data_fields.length > 0) ||
    normalizeOtherFields(data.data_fields_other).length > 0 ||
    data.db_usage_scope,
  );

  if (hasLegacyDatabaseData) {
    return [normalizeDatabaseRequest({
      apply_system: data.apply_system,
      apply_system_other: data.apply_system_other,
      apply_condition: data.apply_condition,
      apply_year_start: data.apply_year_start,
      apply_year_end: data.apply_year_end,
      data_fields: data.data_fields,
      data_fields_other: data.data_fields_other,
      db_usage_scope_item: data.db_usage_scope,
      db_usage_scope_item_manual: Boolean(data.db_usage_scope),
    } as Partial<DatabaseRequest> & { data_fields_other?: string[] | string })];
  }

  return [{ ...emptyDatabaseRequest }];
}

function normalizeReviewScreening(screening: Partial<ReviewScreening> | undefined): ReviewScreening {
  return {
    ...emptyReviewScreening,
    ...screening,
    data_use_types: Array.isArray(screening?.data_use_types) ? screening.data_use_types : [],
    specimen_use_types: Array.isArray(screening?.specimen_use_types) ? screening.specimen_use_types : [],
    vulnerable_populations: Array.isArray(screening?.vulnerable_populations) ? screening.vulnerable_populations : [],
    data_identifiability: screening?.data_identifiability || '',
    is_minimal_risk: typeof screening?.is_minimal_risk === 'boolean' ? screening.is_minimal_risk : null,
    has_direct_subject_contact: Boolean(screening?.has_direct_subject_contact),
    has_high_risk_procedure: Boolean(screening?.has_high_risk_procedure),
    has_discrimination_risk: Boolean(screening?.has_discrimination_risk),
    recording_is_identifiable_or_sensitive: Boolean(screening?.recording_is_identifiable_or_sensitive),
    has_other_irb_approval: Boolean(screening?.has_other_irb_approval),
    notes: screening?.notes || '',
  };
}

function normalizeMulticenterSites(sites: FormData['multicenter_sites'] | undefined): MulticenterSite[] {
  if (!Array.isArray(sites)) return [];
  return sites.map((site) => ({
    country: site?.country || '',
    city: site?.city || '',
    location: site?.location || '',
    contact: site?.contact || '',
  }));
}

function normalizePrivacyText(
  value: string | undefined,
  legacyDefault: string,
): string {
  if (!value) return '';
  return value.trim() === legacyDefault ? '' : value;
}

// 經費項目分年金額相容：
//   舊草稿只有 amount（無 year_amounts）→ year_amounts = [amount]；
//   年數變動時補/裁 year_amounts 長度；amount 一律重算為「全程總額」(= year_amounts 加總)。
// years 來自正規化後的 project_years，確保 Step5 顯示的欄數與資料長度一致。
function normalizeBudgetItems(items: BudgetItem[] | undefined, years: number): BudgetItem[] {
  const list = Array.isArray(items) && items.length > 0 ? items : defaultFormData.budget_items;
  return list.map(item => {
    const year_amounts = getYearAmounts(item, years);
    return { ...item, year_amounts, amount: sumYearAmounts(year_amounts) };
  });
}

// exempt_category 從舊版「單一字串」相容到新版「可複選陣列」：
//   陣列 → 原樣；空字串（未選）→ []；其他字串 → 包成單元素陣列；缺 → 用預設值。
function normalizeExemptCategory(value: ExemptCategory[] | ExemptCategory | '' | undefined): ExemptCategory[] {
  if (Array.isArray(value)) return value;
  if (value === '') return [];
  if (typeof value === 'string') return [value];
  return [...defaultFormData.exempt_category];
}

// 甘特圖從舊版「全程扁平一大張」相容到新版「每年一組工作項目」：
//   新格式（每個元素都有 rows）→ 原樣清洗（task_name/months 補預設）；
//   舊格式（扁平 GanttItem[]，每列 months 為全程長度）→ 按 12 個月切年，
//     每年「複製一份」工作項目、取該年 12 格切片，讓舊草稿載入後視覺與從前一致，
//     之後使用者才能各年自行調整（對齊「每年都複製一份」的決策，不讓舊資料消失）。
type LegacyGanttRow = { task_name?: string; months?: boolean[] };

function cleanRow(row: LegacyGanttRow): { task_name: string; months: boolean[] } {
  return {
    task_name: row.task_name || '',
    months: Array.isArray(row.months) ? row.months.map(Boolean) : [],
  };
}

function normalizeGanttChart(value: unknown): GanttYear[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  // 新格式：每個元素都是 { rows: [...] }
  const isNewFormat = value.every(
    entry => entry && typeof entry === 'object' && 'rows' in entry,
  );
  if (isNewFormat) {
    return (value as GanttYear[]).map(year => ({
      rows: Array.isArray(year.rows) ? year.rows.map(cleanRow) : [],
    }));
  }

  // 舊格式：扁平 GanttItem[]（每列 months = 全程長度）→ 按 12 切年、每年複製一份
  const legacyRows = (value as LegacyGanttRow[]).filter(
    row => row && typeof row === 'object' && 'months' in row,
  );
  if (legacyRows.length === 0) return [];

  const totalMonths = legacyRows[0]?.months?.length || 0;
  return monthsPerYear(totalMonths).map((monthCount, yearIndex) => {
    const offset = yearIndex * 12;
    return {
      rows: legacyRows.map(row => ({
        task_name: row.task_name || '',
        months: Array.from({ length: monthCount }, (_, i) => Boolean(row.months?.[offset + i])),
      })),
    };
  });
}

export function normalizeFormData(data: MaybeLegacyFormData | null | undefined): FormData {
  const next = data || {};
  const normalizedDatabaseRequests = normalizeDatabaseRequests(next);
  const globalApplyYearStart = next.apply_year_start || next.database_requests?.[0]?.apply_year_start || '';
  const globalApplyYearEnd = next.apply_year_end || next.database_requests?.[0]?.apply_year_end || '';
  const projectType = next.project_type || defaultFormData.project_type;
  const fullExecutionStart = next.full_execution_start || next.execution_start || '';
  const fullExecutionEnd = next.full_execution_end || next.execution_end || '';
  const inferredProjectYears = projectType === 'new_1yr'
    ? '1'
    : next.project_years || String(calcProjectYears(fullExecutionStart, fullExecutionEnd) || '');
  const yearsCount = Math.max(1, Number(inferredProjectYears) || 1);

  return {
    ...defaultFormData,
    ...next,
    project_type: projectType,
    project_years: inferredProjectYears,
    full_execution_start: fullExecutionStart,
    full_execution_end: fullExecutionEnd,
    outcome_type_detail: normalizeOutcomeTypeDetails(next.outcome_type_detail),
    gantt_chart: normalizeGanttChart(next.gantt_chart),
    review_type_source: next.review_type_source || defaultFormData.review_type_source,
    review_screening: normalizeReviewScreening(next.review_screening),
    exempt_category: normalizeExemptCategory(next.exempt_category),
    expedited_subject_relationship_other_detail: next.expedited_subject_relationship_other_detail || '',
    expedited_has_control_group: Boolean(next.expedited_has_control_group),
    expedited_control_group_type:
      next.expedited_control_group_type === 'case_control'
      || next.expedited_control_group_type === 'placebo_experimental'
      || next.expedited_control_group_type === 'other'
        ? next.expedited_control_group_type
        : '',
    expedited_control_group_other_detail: next.expedited_control_group_other_detail || '',
    expedited_control_consent_form:
      typeof next.expedited_control_consent_form === 'boolean'
        ? next.expedited_control_consent_form
        : null,
    expedited_consent_design:
      next.expedited_consent_design === 'provide'
      || next.expedited_consent_design === 'waive_signature'
      || next.expedited_consent_design === 'waive_full'
        ? next.expedited_consent_design
        : null,
    expedited_consent_proof_methods: Array.isArray(next.expedited_consent_proof_methods)
      ? next.expedited_consent_proof_methods.filter(
          (method) => method === 'signed_datetime'
            || method === 'witness_signature'
            || method === 'team_record'
            || method === 'other',
        )
      : [],
    expedited_consent_proof_other_detail: next.expedited_consent_proof_other_detail || '',
    expedited_consent_sources: Array.isArray(next.expedited_consent_sources)
      ? next.expedited_consent_sources.filter(
          (source) => source === 'subject'
            || source === 'parent'
            || source === 'guardian'
            || source === 'authorized_person'
            || source === 'legal_representative'
            || source === 'other',
        )
      : [],
    expedited_consent_source_other_detail: next.expedited_consent_source_other_detail || '',
    expedited_waive_signature_reason: next.expedited_waive_signature_reason || '',
    expedited_waive_consent_reason: next.expedited_waive_consent_reason || '',
    expedited_followup_period: next.expedited_followup_period || '',
    subject_patient_disease_name: next.subject_patient_disease_name || '',
    subject_cdc_staff_reason: next.subject_cdc_staff_reason || '',
    subject_population_other_detail: next.subject_population_other_detail || '',
    subject_roster_existing_db_name: next.subject_roster_existing_db_name || '',
    subject_roster_existing_project_name: next.subject_roster_existing_project_name || '',
    subject_roster_other_detail: next.subject_roster_other_detail || '',
    irb0021_has_specimen:
      typeof next.irb0021_has_specimen === 'boolean' ? next.irb0021_has_specimen : null,
    irb0021_has_new_specimen:
      typeof next.irb0021_has_new_specimen === 'boolean' ? next.irb0021_has_new_specimen : null,
    irb0021_has_existing_specimen:
      typeof next.irb0021_has_existing_specimen === 'boolean' ? next.irb0021_has_existing_specimen : null,
    irb0021_has_data:
      typeof next.irb0021_has_data === 'boolean' ? next.irb0021_has_data : null,
    irb0021_has_new_data:
      typeof next.irb0021_has_new_data === 'boolean' ? next.irb0021_has_new_data : null,
    irb0021_has_existing_data:
      typeof next.irb0021_has_existing_data === 'boolean' ? next.irb0021_has_existing_data : null,
    irb0021_data_deidentified:
      typeof next.irb0021_data_deidentified === 'boolean' ? next.irb0021_data_deidentified : null,
    specimen_new_detail: next.specimen_new_detail || '',
    specimen_existing_detail: next.specimen_existing_detail || '',
    data_new_detail: next.data_new_detail || '',
    data_existing_detail: next.data_existing_detail || '',
    data_deidentification_detail: next.data_deidentification_detail || '',
    is_multicenter: Boolean(next.is_multicenter),
    multicenter_type: next.multicenter_type === 'domestic' || next.multicenter_type === 'international'
      ? next.multicenter_type
      : '',
    multicenter_sites: normalizeMulticenterSites(next.multicenter_sites),
    budget_items: normalizeBudgetItems(next.budget_items, yearsCount),
    privacy_during: normalizePrivacyText(next.privacy_during, LEGACY_PRIVACY_DEFAULTS.privacy_during),
    privacy_after: normalizePrivacyText(next.privacy_after, LEGACY_PRIVACY_DEFAULTS.privacy_after),
    privacy_withdrawal: normalizePrivacyText(next.privacy_withdrawal, LEGACY_PRIVACY_DEFAULTS.privacy_withdrawal),
    apply_year_start: globalApplyYearStart,
    apply_year_end: globalApplyYearEnd,
    database_requests: normalizedDatabaseRequests,
  };
}
