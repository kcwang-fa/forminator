// ===== 表單狀態管理 =====

import { createContext, useContext } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import type { FormData } from '../types/form';
import { defaultFormData } from '../data/defaults';
import { loadDraft } from './useAutoSave';

export type FormStore = UseFormReturn<FormData>;

export const FormContext = createContext<FormStore | null>(null);

export function useFormStore(): FormStore {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error('useFormStore must be used within FormContext.Provider');
  return ctx;
}

export function useCreateFormStore(): FormStore {
  const savedDraft = loadDraft();
  return useForm<FormData>({
    defaultValues: savedDraft ?? defaultFormData,
    mode: 'onBlur',
  });
}
