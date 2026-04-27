// ===== 甘特圖 + 人力配置 placeholder 準備 =====
//
// 甘特：DOC-2 七、預定進度（{#gantt_rows} loop）+ DOC-4 schedule_text 純文字版。
// 人力：DOC-2 伍、人力配置（{#personnel_rows} loop）+ DOC-4 personnel_equipment_text。
//
// 動 gantt_rows / personnel_rows 的 sub-key（task_name / m1~m12 / role_text 等）
// 必須與 scripts/inject-doc2.cjs 的 loop 對齊。

import type { FormData } from '../../types/form';
import { toRocDate } from '../date';
import { ROLE_MAP } from '../docgenMaps';

export function prepareScheduleData(data: FormData) {
  return {
    schedule_text: `執行期間：${toRocDate(data.execution_start)} 至 ${toRocDate(data.execution_end)}\n${
      data.gantt_chart.length > 0
        ? data.gantt_chart.map(g =>
            `${g.task_name}：${g.months.map((m: boolean, i: number) => m ? `第${i + 1}月` : '').filter(Boolean).join('、')}`
          ).join('\n')
        : '（請參閱署內研究計畫書）'
    }`,
    gantt_chart_text: data.gantt_chart.length > 0
      ? data.gantt_chart.map(g =>
          `${g.task_name}：${g.months.map((m, i) => m ? `第${i + 1}月` : '').filter(Boolean).join('、')}`
        ).join('\n')
      : '（請參閱署內研究計畫書）',
    gantt_rows: data.gantt_chart.map(g => {
      const row: Record<string, string> = { task_name: g.task_name };
      for (let i = 0; i < 12; i++) row[`m${i + 1}`] = g.months[i] ? '■' : '';
      return row;
    }),
    personnel_equipment_text: data.personnel.map(p =>
      `${ROLE_MAP[p.role] || p.role}：${p.name_zh}（${p.unit} ${p.title}）— ${p.work_description || '研究資料分析與報告撰寫'}`
    ).join('\n'),
    personnel_rows: data.personnel.map(p => ({
      role_text: ROLE_MAP[p.role] || p.role,
      name_zh: p.name_zh,
      title: p.title,
      unit: p.unit,
      work_description: p.work_description || '研究資料分析與報告撰寫',
    })),
  };
}
