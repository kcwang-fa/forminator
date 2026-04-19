// ===== 表單狀態管理 =====
//
// 整個 Wizard 共用一個 React Hook Form 實例。
// 作法：App.tsx 用 useCreateFormStore() 建立實例，透過 FormContext 傳下去；
// 各 Step 元件呼叫 useFormStore() 取得同一個 form，不需要 props 傳遞。
//
// 新手提示：
//   - 要讀欄位值 → form.watch('欄位名') 或 form.getValues('欄位名')
//   - 要寫欄位值 → form.setValue('欄位名', 值)
//   - 欄位名稱定義在 src/types/form.ts 的 FormData 型別

import { createContext, useContext } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { FormData } from '../types/form';
import { defaultFormData } from '../data/defaults';
import { loadDraft } from './useAutoSave';

export type FormStore = UseFormReturn<FormData>;

// 全域 Context，讓所有子元件都能拿到同一個 form 實例
export const FormContext = createContext<FormStore | null>(null);

// 在任何 Step 元件裡呼叫這個 hook 來取得 form
export function useFormStore(): FormStore {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useFormStore must be used within FormContext.Provider');
  return ctx;
}

// 只在 App.tsx 呼叫一次：建立 form，優先載入 localStorage 草稿
export function useCreateFormStore(): FormStore {
  const savedDraft = loadDraft();
  return useForm<FormData>({
    defaultValues: savedDraft ?? defaultFormData,
    mode: 'onBlur', // 離開欄位才觸發驗證，避免邊打字邊噴錯誤
  });
}
