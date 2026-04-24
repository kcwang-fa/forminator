// ===== §7.5 JSON 匯出／匯入 =====

import type { FormData, ExportData, Personnel, PersonnelProfileExport } from '../types/form';
import { SDD_VERSION } from '../data/defaults';
import { normalizeFormData } from './formNormalization';

const PROFILE_VERSION = '1.0';

/**
 * 匯出表單資料為 JSON 檔並下載
 */
export function exportToJson(data: FormData): void {
  const exportData: ExportData = {
    sdd_version: SDD_VERSION,
    exported_at: new Date().toISOString(),
    project_name: data.project_title_zh || '未命名計畫',
    data,
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  });

  const timestamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  const projectName = data.project_title_zh || 'draft';
  const filename = `forminator-${projectName}-${timestamp}.json`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 匯出單一人員 Profile 為 JSON
 */
export function exportPersonnelProfile(person: Personnel): void {
  const { role: _role, ...rest } = person;
  const profile: PersonnelProfileExport = {
    type: 'pi_profile',
    version: PROFILE_VERSION,
    exported_at: new Date().toISOString(),
    personnel: rest,
  };
  const blob = new Blob([JSON.stringify(profile, null, 2)], { type: 'application/json' });
  const name = person.name_zh || 'personnel';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `profile-${name}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 從 JSON 檔匯入人員 Profile
 */
export function importPersonnelProfile(file: File): Promise<PersonnelProfileExport | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target?.result as string);
        if (parsed.type !== 'pi_profile' || !parsed.personnel) {
          resolve(null);
          return;
        }
        resolve(parsed as PersonnelProfileExport);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}

/**
 * 從 JSON 檔匯入表單資料
 * @returns 解析後的 FormData，或 null（解析失敗）
 */
export function importFromJson(file: File): Promise<{ data: FormData; version: string } | null> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed: ExportData = JSON.parse(e.target?.result as string);
        if (!parsed.data || !parsed.sdd_version) {
          resolve(null);
          return;
        }
        resolve({ data: normalizeFormData(parsed.data), version: parsed.sdd_version });
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsText(file);
  });
}
