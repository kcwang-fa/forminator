// ===== 自動甘特圖生成 Hook =====

import { useEffect } from 'react';
import { useFormStore } from './useFormStore';
import { calcMonthsBetween, resizeGantt } from '../utils/gantt';

export function useAutoGantt() {
  const { watch, setValue, getValues } = useFormStore();

  const projectType = watch('project_type');
  const executionStart = watch('execution_start');
  const executionEnd = watch('execution_end');
  const fullExecutionStart = watch('full_execution_start');
  const fullExecutionEnd = watch('full_execution_end');

  useEffect(() => {
    const ganttStart = projectType === 'new_1yr'
      ? executionStart
      : fullExecutionStart || executionStart;
    const ganttEnd = projectType === 'new_1yr'
      ? executionEnd
      : fullExecutionEnd || executionEnd;

    if (ganttStart && ganttEnd) {
      const months = calcMonthsBetween(ganttStart, ganttEnd);
      if (months > 0) {
        const currentGantt = getValues('gantt_chart');
        const currentMonths = currentGantt[0]?.months.length || 0;
        if (currentGantt.length === 0 || currentMonths !== months) {
          setValue('gantt_chart', resizeGantt(currentGantt, months));
        }
      }
    }
  }, [executionStart, executionEnd, fullExecutionStart, fullExecutionEnd, getValues, projectType, setValue]);
}
