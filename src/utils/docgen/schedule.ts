// ===== 甘特圖 + 人力配置 placeholder 準備 =====
//
// 甘特：DOC-2 七、預定進度（{#gantt_years}{#gantt_rows} 巢狀 loop）+ DOC-4 schedule_text 純文字版。
// 人力：DOC-2 伍、人力配置（{#personnel_rows} loop）+ DOC-4 personnel_equipment_text。
//
// 動 gantt_rows / personnel_rows 的 sub-key（task_name / m1~m12 / role_text 等）
// 必須與 scripts/inject-doc2.cjs 的 loop 對齊。
//
// ⚠️ 甘特表的欄位語意（2026-08-28 改）：
//   m1~m12 = 「該曆年的 1 月～12 月」，不是「計畫的第 1～12 個月」。
//   計畫期間以外的月份留白（例：115/10 起算 → 115 年度表的 1~9 月空白、
//   116 年度表的 10~12 月空白），跨曆年就輸出兩張表。
//   why：官方甘特表只有 12 欄、表頭固定，用相對月序會讓「第 1 月」到底是幾月完全看不出來，
//   Word 輸出就丟失了網頁上看得到的年月資訊。改成曆年對齊後欄位語意固定、審查者不用自己數。
//   對應的表頭文字（1月～12月）由 scripts/inject-doc2.cjs 產生，兩邊要一起改。

import type { FormData } from '../../types/form';
import { toRocDate } from '../date';
import { ganttCalendarViews, ganttYearLabel, resolveGanttStart } from '../gantt';
import { ROLE_MAP } from '../docgenMaps';

function formatPeriod(start: string, end: string): string {
  if (start && end) return `${toRocDate(start)} 至 ${toRocDate(end)}`;
  return start ? toRocDate(start) : end ? toRocDate(end) : '';
}

/**
 * 把「該曆年 12 格的勾選狀態」轉成人看的月份區間字串。
 * 輸入 months 固定 12 格（index 0 = 1 月），輸出如「10至12月」「3月、7至9月」。
 * 全部沒勾 → 回空字串（呼叫端自行決定要不要略過這一列）。
 */
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
    ranges.push(start === end ? `${start}月` : `${start}至${end}月`);
    index++;
  }

  return ranges.join('、');
}

// 一張「曆年甘特表」：12 格固定對應該曆年的 1~12 月。
interface CalendarYearTable {
  rocYear: number;                                        // 民國年（西元 - 1911）
  label: string;                                          // 年度名稱（與 Step3 頁籤同一個 ganttYearLabel）
  rows: { task_name: string; months: boolean[] }[];       // months 長度固定 12
}

/**
 * 把表單裡「以計畫年度切分」的甘特資料（gantt_chart，months 是相對月序）攤平到「曆年」，
 * 一個曆年一張 12 欄（1~12 月）的表。
 *
 * 換算本身在 utils/gantt.ts 的 ganttCalendarViews()——Step3 的曆年頁籤跟這裡的 Word 表格
 * 共用同一份換算，才不會兩邊各算一次而走鐘。這裡只負責把檢視套回工作項目、合併成表。
 *
 * 一年期從年中起算時（例：115/10 ~ 116/9），單一計畫年度會橫跨兩個曆年，於是輸出兩張表；
 * 兩張表都列出完整的工作項目，不屬於該年的月份留白。
 */
function buildCalendarYearTables(data: FormData, isMultiYear: boolean): {
  tables: CalendarYearTable[];
  datesResolved: boolean;                                 // 起始日期都解析成功 → 年度標題才可信
} {
  const ganttStart = resolveGanttStart(isMultiYear, data.execution_start, data.full_execution_start);
  const views = ganttCalendarViews(data.gantt_chart, ganttStart, isMultiYear);
  const datesResolved = views.every(view => view.rocYearKnown);

  // 同一個曆年可能被多個計畫年度指到（正常的年度切法不會，僅防舊資料），故用 Map 合併列。
  const tableMap = new Map<number, CalendarYearTable>();
  views.forEach((view, viewIndex) => {
    let table = tableMap.get(view.rocYear);
    if (!table) {
      table = { rocYear: view.rocYear, label: ganttYearLabel(view, viewIndex, isMultiYear), rows: [] };
      tableMap.set(view.rocYear, table);
    }
    data.gantt_chart[view.ganttYearIndex].rows.forEach(row => {
      // monthSlots[i] = 該曆年第 i+1 月對應到相對月序的哪一格；-1 表示不在計畫期間內
      const months = view.monthSlots.map(slot => slot >= 0 && Boolean(row.months[slot]));

      // 每張曆年表只列「該年度有排程」的工作項目：
      // 跨曆年時（例：一年期 115/10~116/9）「文獻回顧」只發生在 115，116 年度表就不該
      // 出現一整列空白。例外是「完全沒排程」的項目（使用者還沒勾任何月份）——那是尚未填寫，
      // 每張表都保留，才不會整列從 Word 裡靜默消失。
      const scheduledThisYear = months.some(Boolean);
      const scheduledAnyYear = row.months.some(Boolean);
      if (!scheduledThisYear && scheduledAnyYear) return;

      table!.rows.push({ task_name: row.task_name, months });
    });
  });

  const tables = [...tableMap.values()].sort((a, b) => a.rocYear - b.rocYear);
  return { tables, datesResolved };
}

export function prepareScheduleData(data: FormData) {
  const isMultiYear = data.project_type !== 'new_1yr';
  const fullExecutionStart = data.full_execution_start || data.execution_start;
  const fullExecutionEnd = data.full_execution_end || data.execution_end;
  const periodText = isMultiYear
    ? `全程計畫期間：${formatPeriod(fullExecutionStart, fullExecutionEnd)}\n本年度執行期間：${formatPeriod(data.execution_start, data.execution_end)}`
    : `執行期間：${formatPeriod(data.execution_start, data.execution_end)}`;

  // 甘特圖：先攤平成「一個曆年一張表」，DOC-2 七、預定進度再依表數重複整張表
  //（巢狀 loop {#gantt_years}{#gantt_rows}）。
  const { tables, datesResolved } = buildCalendarYearTables(data, isMultiYear);

  // 年度標題（表格上方的獨立段落）要不要顯示：
  //   - 只有一張表 → 不標，版面與原本單年期完全相同（保護既有 snapshot／官方表單長相）。
  //   - 日期解析失敗（datesResolved=false）→ 年度不可信，一律不標。
  // 標題文字本身是 table.label（utils/gantt.ts 的 ganttYearLabel，與 Step3 頁籤共用）：
  // 多年期「第2年（116 年度）」、一年期跨曆年「115 年度」。
  const showYearLabels = tables.length > 1 && datesResolved;
  const yearLabelFor = (table: CalendarYearTable): string => (showYearLabels ? table.label : '');

  const gantt_years = tables.map(table => {
    const gantt_rows = table.rows.map(row => {
      const cells: Record<string, string> = { task_name: row.task_name };
      // m1~m12 = 該曆年的 1 月~12 月；計畫期間外的月份留白
      for (let i = 0; i < 12; i++) cells[`m${i + 1}`] = row.months[i] ? '■' : '';
      return cells;
    });
    const year_label = yearLabelFor(table);
    // has_year_label：DOC-2 甘特表「上方年度標題段落」的開關（boolean，給 docxtemplater 當條件區段）。
    // year_label 是空字串 → false → 整個標題段落不輸出。
    return { year_label, has_year_label: year_label !== '', gantt_rows };
  });

  // DOC-4 純文字版時程：逐曆年逐列展開；有多張表時在每年前加年度標題。
  // 該年度沒勾到任何月份的工作項目就不列（它會出現在另一個年度的段落裡）。
  const scheduleLines = tables.length > 0
    ? tables.map(table => {
        const rowLines = table.rows
          .map(row => ({ name: row.task_name, ranges: formatMonthRanges(row.months) }))
          .filter(row => row.ranges !== '')
          .map(row => `${row.name}：${row.ranges}`)
          .join('\n') || '（本年度未設定工作項目）';
        const label = yearLabelFor(table);
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
