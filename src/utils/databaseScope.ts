import type { FormData } from '../types/form';
import { ANALYSIS_LOCATION_MAP, DATA_FIELD_MAP } from './docgenMaps';

export function getApplySystemText(data: FormData) {
  return data.apply_system === 'warehouse'
    ? '倉儲系統'
    : (data.apply_system_other || '申請系統');
}

export function getDataFieldRows(data: FormData) {
  return data.apply_system === 'warehouse'
    ? (data.data_fields || []).map((key, index) => ({
        field_index: String(index + 1),
        field_name: key === 'other' ? (data.data_fields_other || '其他') : (DATA_FIELD_MAP[key] || key),
      }))
    : [];
}

export function getDataFieldListText(data: FormData) {
  const rows = getDataFieldRows(data);
  return rows.length > 0
    ? rows.map(row => row.field_name).join('、')
    : '本申請單所列研究所需欄位';
}

export function buildDatabaseUsageScope(data: FormData) {
  const systemText = getApplySystemText(data);
  const conditionText = data.apply_condition || '擷取資料條件所列資料';
  const fieldListText = getDataFieldListText(data);
  const locationText = data.analysis_location.length > 0
    ? data.analysis_location.map(location => ANALYSIS_LOCATION_MAP[location] || location).join('、')
    : '核定之資料使用地點';

  return [
    `本研究預定使用疾管署防疫資料庫（${systemText}）中「${conditionText}」之去識別化資料，使用欄位限於${fieldListText}。`,
    '資料僅供本研究進行描述性統計、流行病學特徵分析、趨勢分析、研究報告及論文撰寫使用，不作個案追蹤、行政裁處、商業用途或本計畫以外之使用。',
    `資料使用地點限${locationText}，僅計畫主持人及核定研究人員得存取；研究成果僅以彙整統計呈現，不揭露可識別個人資訊。`,
  ].join('');
}
