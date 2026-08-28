// 甘特圖「網頁頁籤 ↔ Word 甘特表」對齊 smoke test。
//
// 防的是這次回報的問題：網頁看得到跨年度、Word 看不到（2026-08-28）。
// 現在兩邊都用 utils/gantt.ts 的 ganttCalendarViews() 把「相對月序」攤平到「曆年」，
// 這支測試就逐格比對，確保之後改任何一邊都不會再走鐘：
//   1. 頁籤數 = Word 甘特表張數（一年期從年中起算會跨兩個曆年 → 2 張）
//   2. 每一格（該曆年的 1~12 月）勾選狀態一致，計畫期間外一律留白
//   3. 年度標題文字一致（Word 只有一張表時不標，維持官方表單原本的單表長相）
//   4. Word 每張表只列「該年度有排程」的工作項目（跨曆年時 116 年度表不該出現整列空白的
//      「文獻回顧」）；完全沒排程的項目屬於「還沒填」，每張表都要保留、不能靜默消失
//
// 執行：npm run smoke:gantt-calendar

import assert from 'node:assert/strict';
import {
  ganttCalendarViews,
  ganttYearLabel,
  resolveGanttStart,
  resolveGanttEnd,
  ganttYearBlocks,
  createBlankGanttYears,
  generateDefaultGanttRows,
} from '../src/utils/gantt';
import { prepareScheduleData } from '../src/utils/docgen/schedule';
import { fixtureExemptFunded } from './fixtures/fixture-exempt-funded';
import type { FormData, GanttYear } from '../src/types/form';

/**
 * 造一份甘特資料：走 useAutoGantt 的同一條路切年（ganttYearBlocks），
 * 再逐年帶入「資料分析」7 項範本當內容，然後比對 UI 與 Word 兩邊的產出。
 */
function check(
  title: string,
  projectType: string,
  execStart: string,
  execEnd: string,
  fullStart = '',
  fullEnd = '',
  mutate?: (chart: GanttYear[]) => void,   // 需要造特殊資料時（如：完全沒排程的項目）
) {
  const isMultiYear = projectType !== 'new_1yr';
  const start = resolveGanttStart(isMultiYear, execStart, fullStart);
  const end = resolveGanttEnd(isMultiYear, execEnd, fullEnd);
  const ganttChart: GanttYear[] = createBlankGanttYears(ganttYearBlocks(start, end, isMultiYear))
    .map(year => ({ rows: generateDefaultGanttRows(year.rows[0].months.length) }));
  mutate?.(ganttChart);

  const data = {
    ...fixtureExemptFunded,
    project_type: projectType,
    execution_start: execStart,
    execution_end: execEnd,
    full_execution_start: fullStart,
    full_execution_end: fullEnd,
    gantt_chart: ganttChart,
  } as FormData;

  const views = ganttCalendarViews(ganttChart, start, isMultiYear);   // Step3 頁籤的來源
  const { gantt_years } = prepareScheduleData(data);                  // DOC-2 甘特表的來源

  assert.equal(
    views.length, gantt_years.length,
    `${title}：網頁頁籤 ${views.length} 個 ≠ Word 甘特表 ${gantt_years.length} 張`,
  );

  views.forEach((view, index) => {
    // 網頁那一頁看得到的全部列（含本年度未排程的，網頁要能編輯所以照列）
    const uiRows = ganttChart[view.ganttYearIndex].rows.map(row => ({
      task_name: row.task_name,
      months: view.monthSlots.map(slot => slot >= 0 && Boolean(row.months[slot])),
      scheduledAnyYear: row.months.some(Boolean),
    }));
    // Word 會列出來的子集：該年度有排程，或整個計畫都還沒排程（還沒填，不能弄丟）
    const expectedRows = uiRows.filter(row => row.months.some(Boolean) || !row.scheduledAnyYear);

    assert.equal(
      expectedRows.length, gantt_years[index].gantt_rows.length,
      `${title}：第 ${index + 1} 張應列 ${expectedRows.length} 項，Word 實際 ${gantt_years[index].gantt_rows.length} 項`,
    );

    expectedRows.forEach((row, rowIndex) => {
      const wordRow = gantt_years[index].gantt_rows[rowIndex] as Record<string, string>;
      assert.equal(row.task_name, wordRow.task_name, `${title}：第 ${index + 1} 張工作項目名稱不一致`);

      for (let month = 0; month < 12; month++) {
        assert.equal(
          row.months[month], wordRow[`m${month + 1}`] === '■',
          `${title}：第 ${index + 1} 張「${row.task_name}」${month + 1} 月 網頁=${row.months[month]} Word=${wordRow[`m${month + 1}`] || '空白'}`,
        );
      }
    });

    // 年度標題：多張表時兩邊文字要一樣；只有一張表時 Word 不標（版面等同原本單表）
    const uiLabel = ganttYearLabel(view, index, isMultiYear);
    const wordLabel = gantt_years[index].year_label;
    if (views.length > 1) {
      assert.equal(uiLabel, wordLabel, `${title}：年度標題不一致（網頁「${uiLabel}」／Word「${wordLabel}」）`);
    } else {
      assert.equal(wordLabel, '', `${title}：只有一個年度時 Word 不該輸出年度標題`);
    }
  });

  const labels = views.map((view, i) => ganttYearLabel(view, i, isMultiYear)).join('、');
  const counts = gantt_years.map(y => y.gantt_rows.length).join('/');
  console.log(`  ✓ ${title}：${views.length} 個頁籤／表（${labels}），各表列數 ${counts}`);
}

// 一年期從年中起算 → 跨兩個曆年，這是這次回報的情境
check('一年期 115/10~116/9（跨曆年）', 'new_1yr', '2026-10-01', '2027-09-30');
// 一年期剛好落在同一個曆年 → 單一張表、不標年度（保護官方表單原本的單表長相）
check('一年期 115/1~115/12（不跨年）', 'new_1yr', '2026-01-01', '2026-12-31');
check('一年期 115/3~115/12（年初留白）', 'new_1yr', '2026-03-01', '2026-12-31');
// 多年期：按年度（曆年）切，首末年不滿 12 個月
check('多年期 115/6~117/7', 'continuing', '2026-06-01', '2027-05-31', '2026-06-01', '2028-07-31');
check('多年期 115/1~116/12', 'continuing', '2026-01-01', '2026-12-31', '2026-01-01', '2027-12-31');

// 「完全沒排程」的工作項目（使用者新增了列但還沒勾任何月份）必須每張表都保留，
// 不能因為「該年度沒排程」的過濾規則而從 Word 裡靜默消失。
check('一年期 115/10~116/9 + 未排程項目', 'new_1yr', '2026-10-01', '2027-09-30', '', '', chart => {
  chart[0].rows.push({ task_name: '尚未排程的項目', months: chart[0].rows[0].months.map(() => false) });
});

console.log('[gantt-calendar-smoke] ✓ 網頁曆年頁籤與 Word 甘特表逐格一致');
