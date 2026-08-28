// ===== 自動甘特圖生成 Hook =====

import { useEffect } from 'react';
import { useFormStore } from './useFormStore';
import { ganttYearBlocks, resizeGanttYears, resolveGanttStart, resolveGanttEnd } from '../utils/gantt';

export function useAutoGantt() {
  const { watch, setValue, getValues } = useFormStore();

  const projectType = watch('project_type');
  const executionStart = watch('execution_start');
  const executionEnd = watch('execution_end');
  const fullExecutionStart = watch('full_execution_start');
  const fullExecutionEnd = watch('full_execution_end');

  useEffect(() => {
    // 起迄日的取法（一年期用本年度、多年期用全程）集中在 utils/gantt.ts，
    // Step3 的曆年頁籤與 docgen 都用同一組 helper，避免三處各寫一次而走鐘。
    const isMultiYear = projectType !== 'new_1yr';
    const ganttStart = resolveGanttStart(isMultiYear, executionStart, fullExecutionStart);
    const ganttEnd = resolveGanttEnd(isMultiYear, executionEnd, fullExecutionEnd);

    if (ganttStart && ganttEnd) {
      // 每年月數區塊：多年期按年度（曆年）對齊，第二年起從 1 月開始；一年期單一區塊。
      const blocks = ganttYearBlocks(ganttStart, ganttEnd, isMultiYear);
      if (blocks.length > 0) {
        const currentGantt = getValues('gantt_chart');
        // 比對「每年月數的形狀」而非只比總月數：因為總月數相同但切法改變（如 [12,12,2] → [7,12,7]）
        // 也要重新切年，否則年度月份標籤不會對齊曆年。
        const currentBlocks = currentGantt.map(year => year.rows[0]?.months.length || 0);
        const shapeChanged =
          currentGantt.length === 0 ||
          currentBlocks.length !== blocks.length ||
          currentBlocks.some((m, i) => m !== blocks[i]);
        if (shapeChanged) {
          setValue('gantt_chart', resizeGanttYears(currentGantt, blocks));
        }
      }
    }
  }, [executionStart, executionEnd, fullExecutionStart, fullExecutionEnd, getValues, projectType, setValue]);
}
