import type { DatabaseFieldPurpose, DatabaseRequest } from '../types/form';
import { DATA_FIELD_MAP } from './docgenMaps';

export function normalizeOtherFields(otherFields: DatabaseRequest['data_fields_other'] | string | undefined) {
  if (Array.isArray(otherFields)) return otherFields;
  return otherFields
    ? otherFields.split(/[、，,\n;；]+/).map(item => item.trim()).filter(Boolean)
    : [];
}

export function getApplySystemText(request: Pick<DatabaseRequest, 'apply_system' | 'apply_system_other'>) {
  return request.apply_system === 'warehouse'
    ? '倉儲系統'
    : (request.apply_system_other || '申請系統');
}

export function hasDatabaseRequestContent(
  request: Pick<DatabaseRequest, 'apply_system' | 'apply_system_other' | 'apply_condition' | 'data_fields' | 'data_fields_other'>,
) {
  const hasSystemName = request.apply_system === 'other' && Boolean(request.apply_system_other?.trim());
  const hasCondition = Boolean(request.apply_condition?.trim());
  const hasFields = (request.data_fields || []).length > 0 || normalizeOtherFields(request.data_fields_other).length > 0;
  return hasSystemName || hasCondition || hasFields;
}

export function getDataFieldNames(request: Pick<DatabaseRequest, 'apply_system' | 'data_fields' | 'data_fields_other'>) {
  if (request.apply_system !== 'warehouse') {
    return normalizeOtherFields(request.data_fields_other);
  }

  return (request.data_fields || []).flatMap((key) => {
    if (key !== 'other') {
      return [DATA_FIELD_MAP[key] || key];
    }

    const otherFields = normalizeOtherFields(request.data_fields_other)
      .map(item => item.trim())
      .filter(Boolean);

    return otherFields.length > 0
      ? otherFields
      : ['其他'];
  });
}

export function normalizeDoc8FieldPurposes(
  fieldNames: string[],
  existingPurposes: DatabaseFieldPurpose[] | undefined,
) {
  const buckets = new Map<string, string[]>();
  (existingPurposes || []).forEach((item) => {
    const key = item.field_name.trim();
    if (!key) return;
    const bucket = buckets.get(key) || [];
    bucket.push(item.apply_purpose || '');
    buckets.set(key, bucket);
  });

  return fieldNames.map((field_name) => {
    const bucket = buckets.get(field_name) || [];
    const apply_purpose = bucket.shift() || '';
    buckets.set(field_name, bucket);
    return { field_name, apply_purpose };
  });
}

export function areFieldPurposesEqual(left: DatabaseFieldPurpose[] | undefined, right: DatabaseFieldPurpose[] | undefined) {
  if ((left || []).length !== (right || []).length) return false;
  return (left || []).every((item, index) =>
    item.field_name === right?.[index]?.field_name &&
    item.apply_purpose === right?.[index]?.apply_purpose,
  );
}

export function getDataFieldRows(
  request: Pick<DatabaseRequest, 'apply_system' | 'data_fields' | 'data_fields_other' | 'doc8_field_purposes'>,
  fallbackApplyPurpose = '',
) {
  const fieldNames = getDataFieldNames(request);
  const normalizedPurposes = normalizeDoc8FieldPurposes(fieldNames, request.doc8_field_purposes);

  return normalizedPurposes.map((row, index) => ({
    field_index: String(index + 1),
    field_name: row.field_name,
    apply_purpose: row.apply_purpose.trim() || fallbackApplyPurpose,
  }));
}

export function getDataFieldListText(request: Pick<DatabaseRequest, 'apply_system' | 'data_fields' | 'data_fields_other'>) {
  const fieldNames = getDataFieldNames(request);
  return fieldNames.length > 0
    ? fieldNames.join('、')
    : '本申請單所列研究所需欄位';
}

function ensureScopeItemPunctuation(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[。．.!！?？]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

export function normalizeDatabaseUsageScopeItemText(text: string) {
  return ensureScopeItemPunctuation(
    text
      .trim()
      .replace(/^本研究預定使用/, '')
      .replace(/^疾管署/, ''),
  );
}

export function buildDatabaseUsageScopeItem(request: Pick<DatabaseRequest, 'apply_system' | 'apply_system_other' | 'apply_condition' | 'data_fields' | 'data_fields_other'>) {
  if (!hasDatabaseRequestContent(request)) return '';

  const systemText = getApplySystemText(request);
  const conditionText = request.apply_condition || '擷取資料條件所列資料';
  const fieldListText = getDataFieldListText(request);

  return ensureScopeItemPunctuation(
    `疾管署防疫資料庫（${systemText}）中「${conditionText}」之去識別化資料，使用欄位限於${fieldListText}`,
  );
}

export function buildDatabaseUsageScopeSummary(
  requests: Array<Pick<DatabaseRequest, 'apply_system' | 'apply_system_other' | 'apply_condition' | 'data_fields' | 'data_fields_other' | 'db_usage_scope_item'>>,
) {
  const items = requests
    .filter(request => hasDatabaseRequestContent(request))
    .map(request => normalizeDatabaseUsageScopeItemText(request.db_usage_scope_item || buildDatabaseUsageScopeItem(request)))
    .filter(Boolean);

  if (items.length === 0) return '';
  if (items.length === 1) return `本研究預定使用${items[0]}`;

  return [
    '本研究預定使用疾管署下列防疫資料庫之去識別化資料：',
    ...items.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n');
}

export function buildDatabaseUsageScopePreview(
  requests: Array<Pick<DatabaseRequest, 'apply_system' | 'apply_system_other' | 'apply_condition' | 'data_fields' | 'data_fields_other' | 'db_usage_scope_item'>>,
) {
  const items = requests.map((request) => {
    const generated = request.db_usage_scope_item || buildDatabaseUsageScopeItem(request);
    return normalizeDatabaseUsageScopeItemText(
      generated || `疾管署防疫資料庫（${getApplySystemText(request)}）中「擷取資料條件所列資料」之去識別化資料，使用欄位限於本申請單所列研究所需欄位。`,
    );
  });

  if (items.length === 0) return '';
  if (items.length === 1) return `本研究預定使用${items[0]}`;

  return [
    '本研究預定使用疾管署下列防疫資料庫之去識別化資料：',
    ...items.map((item, index) => `${index + 1}. ${item}`),
  ].join('\n');
}
