// ===== §4.5 甘特圖（分年）工具 =====
//
// 甘特圖資料是「每年一組工作項目」的巢狀結構（gantt_chart: GanttYear[]）。
// 多年期計畫每年的工作項目可以完全不同，所以每年各自一組 rows，
// 每列的 months 長度 = 該年實際月數（最後一年可能不滿 12 個月）。
// 一年期就是「只有一個年度」，行為與單張甘特表相同。

import type { GanttItem, GanttYear } from '../types/form';
import { calcInclusiveMonths } from './date';

interface GanttTemplate {
  name: string;
  startRatio: number; // 0~1
  endRatio: number;   // 0~1
}

// 「資料分析」預設範本：典型回溯性資料分析研究的 7 個階段。
// 這份範本不自動套用，由使用者按「帶入資料分析範本」按鈕、針對「目前選到的那一年」載入。
const DATA_ANALYSIS_TEMPLATES: GanttTemplate[] = [
  { name: '文獻回顧與研究設計', startRatio: 0, endRatio: 0.25 },
  { name: 'IRB 送審與核准', startRatio: 0, endRatio: 0.25 },
  { name: '資料申請與取得', startRatio: 1 / 6, endRatio: 0.5 },
  { name: '資料清理與整理', startRatio: 1 / 3, endRatio: 2 / 3 },
  { name: '統計分析', startRatio: 0.5, endRatio: 5 / 6 },
  { name: '論文撰寫', startRatio: 2 / 3, endRatio: 1 },
  { name: '成果發表與結案', startRatio: 11 / 12, endRatio: 1 },
];

/**
 * 把全程總月數切成「每年最多 12 個月」的區塊，最後一年可能不滿 12。
 * 回傳陣列長度 = 年數，各元素 = 該年月數。
 * 例：12 → [12]；24 → [12,12]；30 → [12,12,6]。
 * 注意：這是「從起始月每 12 個月」切法，僅供舊格式草稿遷移用；
 *       多年期實際切年改用 fiscalYearMonthCounts（按年度／曆年對齊）。
 */
export function monthsPerYear(totalMonths: number): number[] {
  if (totalMonths <= 0) return [];
  const blocks: number[] = [];
  for (let remaining = totalMonths; remaining > 0; remaining -= 12) {
    blocks.push(Math.min(12, remaining));
  }
  return blocks;
}

/**
 * 按「年度（曆年 1~12 月）」切年：政府計畫的「年度」對齊曆年，計畫常從年中起算，
 * 故第一年度為「起始月～12 月」（不滿一年）、中間每年度 12 個月、最後一年度為「1 月～結束月」。
 * 例：115/6 ~ 117/7 → [7, 12, 7]（115年度 6-12 月、116年度 1-12 月、117年度 1-7 月）。
 * 回傳陣列長度 = 計畫橫跨的年度數。
 */
export function fiscalYearMonthCounts(start: string, end: string): number[] {
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return [];
  const startMonth = s.getMonth(); // 0~11
  const endMonth = e.getMonth();   // 0~11
  const span = e.getFullYear() - s.getFullYear();
  if (span < 0) return [];
  if (span === 0) return [endMonth - startMonth + 1]; // 同一曆年內
  const blocks = [12 - startMonth];                   // 第一年度：起始月～12 月
  for (let y = 1; y < span; y++) blocks.push(12);     // 中間整年度
  blocks.push(endMonth + 1);                          // 最後年度：1 月～結束月
  return blocks;
}

/**
 * 甘特圖分年的「每年月數」區塊：
 * - 多年期：按年度（曆年）對齊（fiscalYearMonthCounts），第二年起一律從 1 月開始。
 * - 一年期：單一區塊（整個執行期間一張表），即使跨曆年也不拆成兩塊。
 */
export function ganttYearBlocks(start: string, end: string, isMultiYear: boolean): number[] {
  const total = calcInclusiveMonths(start, end);
  if (total <= 0) return [];
  return isMultiYear ? fiscalYearMonthCounts(start, end) : [total];
}

/**
 * 第 yearIndex 個年度頁籤的「月份標籤起始西元日期」：
 * - 第 0 年（或一年期）= 計畫起始日（可能從年中起算）。
 * - 多年期第 1 年起 = 該年度 1 月 1 日（曆年對齊），讓月份標籤從 N/1 開始。
 */
export function ganttYearStartDate(start: string, yearIndex: number, isMultiYear: boolean): string {
  const d = new Date(start);
  if (Number.isNaN(d.getTime())) return start;
  if (yearIndex === 0 || !isMultiYear) return start;
  return `${d.getFullYear() + yearIndex}-01-01`;
}

// 把一列工作項目的 months 調整成指定月數：保留已勾選的格子，不足補 false、過長則裁切。
function resizeRowMonths(row: GanttItem, monthCount: number): GanttItem {
  return {
    ...row,
    months: Array.from({ length: monthCount }, (_, i) => row.months[i] ?? false),
  };
}

// 一列空白工作項目（task_name 空、該年所有月份未勾選）。
function blankRow(monthCount: number): GanttItem {
  return { task_name: '', months: Array.from({ length: monthCount }, () => false) };
}

/**
 * 載入某一年的「資料分析」7 階段範本（依該年月數自動分配進度）。
 * 由 Step3 的「帶入資料分析範本」按鈕呼叫，只覆寫「目前選到的那一年」的工作項目。
 */
export function generateDefaultGanttRows(yearMonths: number): GanttItem[] {
  if (yearMonths <= 0) return [];

  return DATA_ANALYSIS_TEMPLATES.map(t => {
    const startMonth = Math.floor(t.startRatio * yearMonths);
    const endMonth = Math.min(Math.ceil(t.endRatio * yearMonths), yearMonths);
    const months = Array.from({ length: yearMonths }, (_, i) =>
      i >= startMonth && i < endMonth
    );
    return { task_name: t.name, months };
  });
}

/**
 * 產生「每年一列空白」的分年甘特圖。blocks = 每年月數（由 ganttYearBlocks 算出）。
 */
export function createBlankGanttYears(blocks: number[]): GanttYear[] {
  return blocks.map(monthCount => ({ rows: [blankRow(monthCount)] }));
}

/**
 * 依「每年月數區塊」調整分年甘特圖（保留使用者已填的工作項目與勾選）：
 * - 年數變多 → 新年補「一列空白」
 * - 年數變少 → 砍掉尾端多出的年
 * - 每年月數變動 → 各列 months 補裁長度（保留已勾選的格子）
 * 空年（rows 為空）回填一列空白，確保每年至少一列、UI 不會出現空表。
 * blocks 由 ganttYearBlocks(start, end, isMultiYear) 產生（多年期按年度／曆年對齊）。
 */
export function resizeGanttYears(prev: GanttYear[], blocks: number[]): GanttYear[] {
  return blocks.map((monthCount, yearIndex) => {
    const prevRows = prev[yearIndex]?.rows;
    if (!prevRows || prevRows.length === 0) {
      return { rows: [blankRow(monthCount)] };
    }
    return { rows: prevRows.map(row => resizeRowMonths(row, monthCount)) };
  });
}

/**
 * 產生某一年的月份欄標籤（民國年/月）。
 * 分年 UI 每個年度頁籤都從「該年的起始月」往後算 monthCount 個月。
 * start 為該年第一個月的西元日期字串；無法解析時退回「第N月」。
 */
export function getGanttMonthLabels(start: string, monthCount: number): string[] {
  if (!start || monthCount <= 0) {
    return Array.from({ length: Math.max(0, monthCount) }, (_, index) => `第${index + 1}月`);
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return Array.from({ length: monthCount }, (_, index) => `第${index + 1}月`);
  }

  return Array.from({ length: monthCount }, (_, index) => {
    const date = new Date(startDate);
    date.setMonth(startDate.getMonth() + index);
    return `${date.getFullYear() - 1911}/${date.getMonth() + 1}`;
  });
}

/**
 * 從起迄日期計算月數
 */
export function calcMonthsBetween(start: string, end: string): number {
  return calcInclusiveMonths(start, end);
}
