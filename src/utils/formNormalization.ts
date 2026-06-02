import { defaultFormData, emptyDatabaseRequest, emptyReviewScreening } from '../data/defaults';
import type { DatabaseFieldPurpose, DatabaseRequest, FormData, OutcomeTypeDetail, ReviewScreening } from '../types/form';

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

export function normalizeFormData(data: MaybeLegacyFormData | null | undefined): FormData {
  const next = data || {};
  const normalizedDatabaseRequests = normalizeDatabaseRequests(next);
  const globalApplyYearStart = next.apply_year_start || next.database_requests?.[0]?.apply_year_start || '';
  const globalApplyYearEnd = next.apply_year_end || next.database_requests?.[0]?.apply_year_end || '';

  return {
    ...defaultFormData,
    ...next,
    outcome_type_detail: normalizeOutcomeTypeDetails(next.outcome_type_detail),
    review_type_source: next.review_type_source || defaultFormData.review_type_source,
    review_screening: normalizeReviewScreening(next.review_screening),
    apply_year_start: globalApplyYearStart,
    apply_year_end: globalApplyYearEnd,
    database_requests: normalizedDatabaseRequests,
  };
}
