// ===== Auto-Save Hook：自動儲存表單到 localStorage =====

import { useEffect } from 'react';
import { message } from 'antd';
import { useFormStore } from './useFormStore';
import { exportToJson } from '../utils/exportImport';
import type { FormData } from '../types/form';

const STORAGE_KEY = 'forminator_draft';
const DEBOUNCE_MS = 2000;

/** 從 localStorage 讀取草稿 */
export function loadDraft(): FormData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FormData;
  } catch {
    return null;
  }
}

/** 清除 localStorage 草稿 */
export function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

/** 嘗試寫入 localStorage。若 QuotaExceeded，先清舊草稿重試一次。
 *  重試仍失敗時自動觸發 JSON 匯出，確保資料不遺失。 */
function safeSaveDraft(serialized: string, formData: FormData) {
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    // 第一次失敗：清掉舊草稿釋放空間，再試一次
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      // 仍然失敗：自動匯出 JSON，避免資料遺失
      message.warning(
        '儲存空間不足，草稿無法自動儲存。已自動觸發 JSON 匯出，請儲存檔案備份。',
        8,
      );
      exportToJson(formData);
    }
  }
}

/** 監聽表單變化，debounce 後自動存入 localStorage */
export function useAutoSave() {
  const { watch } = useFormStore();

  useEffect(() => {
    const subscription = watch((formData) => {
      const timer = setTimeout(() => {
        const serialized = JSON.stringify(formData);
        safeSaveDraft(serialized, formData as FormData);
      }, DEBOUNCE_MS);
      return () => clearTimeout(timer);
    });
    return () => subscription.unsubscribe();
  }, [watch]);
}
