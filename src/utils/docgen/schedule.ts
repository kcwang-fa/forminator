// ===== 甘特圖 + 人力配置 placeholder 準備 =====
//
// 甘特：DOC-2 七、預定進度（{#gantt_rows} loop）+ DOC-4 schedule_text 純文字版。
// 人力：DOC-2 伍、人力配置（{#personnel_rows} loop）+ DOC-4 personnel_equipment_text。
//
// 動 gantt_rows / personnel_rows 的 sub-key（task_name / m1~m12 / role_text 等）
// 必須與 scripts/inject-doc2.cjs 的 loop 對齊。

import type { FormData } from '../../types/form';
import { toRocDate, getRocDateParts } from '../date';
import { ROLE_MAP } from '../docgenMaps';

function formatPeriod(start: string, end: string): string {
  if (start && end) return `${toRocDate(start)} 至 ${toRocDate(end)}`;
  return start ? toRocDate(start) : end ? toRocDate(end) : '';
}

// 第 N 年的中文序數標題；超出對照表時退回「第N年」
const YEAR_ORDINALS = ['第一年', '第二年', '第三年', '第四年', '第五年', '第六年'];
function yearOrdinal(yearIndex: number): string {
  return YEAR_ORDINALS[yearIndex] || `第${yearIndex + 1}年`;
}

function formatMonthRanges(months: boolean[]): string {
  const ranges: string[] = [];
  let index = 0;

  while (index < months.length) {
    if (!months[index]) {
      index++;
      continue;
    }

    const start = index + 1;
    while (index + 1 < months.length && months[index + 1]) index++;
    const end = index + 1;
    ranges.push(start === end ? `第${start}月` : `第${start}至${end}月`);
    index++;
  }

  return ranges.join('、') || '未設定';
}

export function prepareScheduleData(data: FormData) {
  const isMultiYear = data.project_type !== 'new_1yr';
  const fullExecutionStart = data.full_execution_start || data.execution_start;
  const fullExecutionEnd = data.full_execution_end || data.execution_end;
  const periodText = isMultiYear
    ? `全程計畫期間：${formatPeriod(fullExecutionStart, fullExecutionEnd)}\n本年度執行期間：${formatPeriod(data.execution_start, data.execution_end)}`
    : `執行期間：${formatPeriod(data.execution_start, data.execution_end)}`;

  // 甘特圖分年：gantt_chart 是「全程扁平 N 個月」陣列，這裡切成每年 12 格輸出。
  // DOC-2 七、預定進度的 12 月甘特表會依年數重複（巢狀 loop {#gantt_years}{#gantt_rows}）。
  const totalMonths = data.gantt_chart[0]?.months.length || 0;
  const years = Math.max(1, Math.ceil(totalMonths / 12));
  // 多年期才標年度；一年期 year_label 留空，讓 DOC-2 甘特表呈現與單年期相同（保護 snapshot）。
  const baseRocYear = Number(getRocDateParts(fullExecutionStart).y);
  const gantt_years = Array.from({ length: years }, (_, yearIndex) => {
    const monthOffset = yearIndex * 12;
    const yearLabel = isMultiYear
      ? Number.isFinite(baseRocYear)
        ? `${yearOrdinal(yearIndex)}（${baseRocYear + yearIndex} 年度）`
        : yearOrdinal(yearIndex)
      : '';
    const gantt_rows = data.gantt_chart.map(g => {
      const row: Record<string, string> = { task_name: g.task_name };
      // 取該年的 12 個月切片；超出全程月數的格子留空白
      for (let i = 0; i < 12; i++) row[`m${i + 1}`] = g.months[monthOffset + i] ? '■' : '';
      return row;
    });
    return { year_label: yearLabel, gantt_rows };
  });

  return {
    schedule_text: `${periodText}\n${
      data.gantt_chart.length > 0
        ? data.gantt_chart.map(g =>
            `${g.task_name}：${formatMonthRanges(g.months)}`
          ).join('\n')
        : '（請參閱署內研究計畫書）'
    }`,
    gantt_chart_text: data.gantt_chart.length > 0
      ? data.gantt_chart.map(g =>
          `${g.task_name}：${formatMonthRanges(g.months)}`
        ).join('\n')
      : '（請參閱署內研究計畫書）',
    gantt_years,
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
