// ===== 自動甘特圖生成 Hook =====

import { useEffect } from 'react';
import { useFormStore } from './useFormStore';
import { generateDefaultGantt, calcMonthsBetween } from '../utils/gantt';

export function useAutoGantt() {
  const { watch, setValue, getValues } = useFormStore();

  const executionStart = watch('execution_start');
  const executionEnd = watch('execution_end');

  useEffect(() => {
    if (executionStart && executionEnd) {
      const months = calcMonthsBetween(executionStart, executionEnd);
      if (months > 0) {
        const currentGantt = getValues('gantt_chart');
        if (currentGantt.length === 0) {
          setValue('gantt_chart', generateDefaultGantt(months));
        }
      }
    }
  }, [executionStart, executionEnd, setValue, getValues]);
}
