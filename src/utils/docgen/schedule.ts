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

  // 甘特圖分年：gantt_chart 已是「每年一組工作項目」的巢狀結構，這裡直接逐年輸出
  // （不再需要切片）。DOC-2 七、預定進度的 12 月甘特表依年數重複（巢狀 loop {#gantt_years}{#gantt_rows}）。
  // 多年期才標年度；一年期 year_label 留空（has_year_label=false），DOC-2 不輸出年度標題段落，
  // 甘特表呈現與單年期相同（保護 snapshot）。
  const baseRocYear = Number(getRocDateParts(fullExecutionStart).y);
  const yearLabelFor = (yearIndex: number): string => {
    if (!isMultiYear) return '';
    return Number.isFinite(baseRocYear)
      ? `${yearOrdinal(yearIndex)}（${baseRocYear + yearIndex} 年度）`
      : yearOrdinal(yearIndex);
  };
  const gantt_years = data.gantt_chart.map((ganttYear, yearIndex) => {
    const gantt_rows = ganttYear.rows.map(g => {
      const row: Record<string, string> = { task_name: g.task_name };
      // 每年固定輸出 12 欄（DOC-2 甘特表 12 個月）；超出該年實際月數的格子留空白
      for (let i = 0; i < 12; i++) row[`m${i + 1}`] = g.months[i] ? '■' : '';
      return row;
    });
    const year_label = yearLabelFor(yearIndex);
    // has_year_label：DOC-2 甘特表「上方年度標題段落」的開關（boolean，給 docxtemplater 當條件區段）。
    // 一年期 year_label 是空字串 → false → 整個標題段落不輸出，版面與原本單年期完全相同。
    return { year_label, has_year_label: year_label !== '', gantt_rows };
  });

  // DOC-4 純文字版時程：逐年逐列展開；多年期在每年前加年度標題。
  const scheduleLines = data.gantt_chart.length > 0
    ? data.gantt_chart.map((ganttYear, yearIndex) => {
        const rowLines = ganttYear.rows
          .map(g => `${g.task_name}：${formatMonthRanges(g.months)}`)
          .join('\n');
        const label = yearLabelFor(yearIndex);
        return label ? `${label}\n${rowLines}` : rowLines;
      }).join('\n')
    : '（請參閱署內研究計畫書）';

  return {
    schedule_text: `${periodText}\n${scheduleLines}`,
    gantt_chart_text: scheduleLines,
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
