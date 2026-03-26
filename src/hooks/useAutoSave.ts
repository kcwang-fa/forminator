// ===== Auto-Save Hook：自動儲存表單到 localStorage =====

import { useEffect } from 'react';
import { useFormStore } from './useFormStore';
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

/** 監聽表單變化，debounce 後自動存入 localStorage */
export function useAutoSave() {
  const { watch } = useFormStore();

  useEffect(() => {
    const subscription = watch((formData) => {
      // debounce：用 setTimeout 避免每次 keystroke 都寫入
      const timer = setTimeout(() => {
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
        } catch {
          // localStorage 滿了就算了，不影響使用
        }
      }, DEBOUNCE_MS);
      return () => clearTimeout(timer);
    });
    return () => subscription.unsubscribe();
  }, [watch]);
}
