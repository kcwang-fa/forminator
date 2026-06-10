// ===== Auto-Save Hook：自動儲存表單到 localStorage =====
//
// 為什麼這樣設計：
// - 使用者每打幾個字、停 2 秒，就自動把整份草稿寫進 localStorage，避免誤關分頁丟資料。
// - 過去這支是「靜默」存檔，使用者不知道到底存了沒；現在回傳 saveStatus / lastSavedAt，
//   讓 header 的 <SaveStatusIndicator> 顯示「儲存中…／已自動儲存 HH:MM」的安靜回饋。
// - debounce 用「單一 timer ref」實作：每次變動先清掉上一個 timer 再重排，才是真正的 debounce
//   （舊版在 watch callback 裡 return cleanup 是無效的，RHF 不會呼叫它）。

import { useEffect, useRef, useState } from 'react';
import { message } from 'antd';
import { useFormStore } from './useFormStore';
import { exportToJson } from '../utils/exportImport';
import type { FormData } from '../types/form';
import { normalizeFormData } from '../utils/formNormalization';

const STORAGE_KEY = 'forminator_draft';
const DEBOUNCE_MS = 2000;

/** 存檔狀態：idle = 這次開頁還沒存過、saving = debounce 等待中、saved = 已寫入 localStorage */
export type SaveStatus = 'idle' | 'saving' | 'saved';

/** 從 localStorage 讀取草稿 */
export function loadDraft(): FormData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return normalizeFormData(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 清除 localStorage 草稿 */
export function clearDraft() {
  localStorage.removeItem(STORAGE_KEY);
}

/** 嘗試寫入 localStorage。若 QuotaExceeded，先清舊草稿重試一次。
 *  重試仍失敗時自動觸發 JSON 匯出，確保資料不遺失。
 *  回傳是否寫入成功（成功才更新「已存檔」狀態）。 */
function safeSaveDraft(serialized: string, formData: FormData): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch {
    // 第一次失敗：清掉舊草稿釋放空間，再試一次
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, serialized);
      return true;
    } catch {
      // 仍然失敗：自動匯出 JSON，避免資料遺失
      message.warning(
        '儲存空間不足，草稿無法自動儲存。已自動觸發 JSON 匯出，請儲存檔案備份。',
        8,
      );
      exportToJson(formData);
      return false;
    }
  }
}

interface UseAutoSaveOptions {
  /** 每次成功寫入後呼叫，傳入序列化後的草稿字串（給匯出提醒計算變化量用） */
  onSaved?: (serialized: string) => void;
}

/** 監聽表單變化，debounce 後自動存入 localStorage，並回報存檔狀態 */
export function useAutoSave({ onSaved }: UseAutoSaveOptions = {}) {
  const { watch } = useFormStore();
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // 單一 debounce timer，跨多次變動共用，才能「後到的取消先到的」
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // onSaved 存進 ref，避免 watch 訂閱抓到 stale closure（訂閱只建立一次）
  const onSavedRef = useRef(onSaved);
  useEffect(() => {
    onSavedRef.current = onSaved;
  }, [onSaved]);

  useEffect(() => {
    const subscription = watch((formData) => {
      setSaveStatus('saving');
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        const serialized = JSON.stringify(formData);
        const ok = safeSaveDraft(serialized, formData as FormData);
        if (ok) {
          setSaveStatus('saved');
          setLastSavedAt(Date.now());
          onSavedRef.current?.(serialized);
        }
      }, DEBOUNCE_MS);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [watch]);

  return { saveStatus, lastSavedAt };
}
