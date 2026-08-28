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

/**
 * 甘特資料的起算日：一年期從「本年度執行起始日」算、多年期從「全程起始日」算。
 * UI（Step3 / useAutoGantt）與 docgen（docgen/schedule.ts）都要用這個，
 * 否則兩邊起算月不一致，攤平出來的月份會整批平移。
 */
export function resolveGanttStart(
  isMultiYear: boolean,
  executionStart: string,
  fullExecutionStart: string,
): string {
  return isMultiYear ? (fullExecutionStart || executionStart) : executionStart;
}

/** 同 resolveGanttStart，取結束日。 */
export function resolveGanttEnd(
  isMultiYear: boolean,
  executionEnd: string,
  fullExecutionEnd: string,
): string {
  return isMultiYear ? (fullExecutionEnd || executionEnd) : executionEnd;
}

/**
 * 一個「曆年」的甘特檢視：把 gantt_chart（以計畫年度切分、months 是相對月序）
 * 對應到「該曆年的 1~12 月」12 個固定欄位。
 */
export interface GanttCalendarView {
  rocYear: number;          // 民國年
  rocYearKnown: boolean;    // 起始日可解析 → rocYear 才可信（不可信時 UI/docgen 不標年度）
  ganttYearIndex: number;   // 對應 gantt_chart 的哪一個計畫年度（編輯時寫回這一格）
  monthSlots: number[];     // 12 格：值 = 該計畫年度 months 的 index；-1 = 不在計畫期間內
}

/**
 * 把「以計畫年度切分」的甘特資料攤平到「曆年」座標，一個曆年一個檢視。
 *
 * why：官方甘特表（與網頁 UI）的 12 欄是「曆年的 1~12 月」，而 gantt_chart 存的是
 * 相對月序（該計畫年度的第 1、2… 個月），起算月由 ganttYearStartDate() 決定。
 * 兩者之間的換算只寫在這裡，Step3 的頁籤與 docgen/schedule.ts 的 Word 表格共用，
 * 避免兩邊各算一次而走鐘。
 *
 * 一年期從年中起算時（例：115/10~116/9），單一計畫年度會橫跨兩個曆年 → 產生兩個檢視，
 * 兩個檢視指向「同一個 ganttYearIndex」，所以工作項目清單是同一份（只是勾選格落在不同年）。
 */
export function ganttCalendarViews(
  ganttChart: GanttYear[],
  ganttStart: string,
  isMultiYear: boolean,
): GanttCalendarView[] {
  const views: GanttCalendarView[] = [];

  ganttChart.forEach((ganttYear, ganttYearIndex) => {
    // 這個計畫年度的第一個月是西元幾年幾月
    const startDate = new Date(ganttYearStartDate(ganttStart, ganttYearIndex, isMultiYear));
    const rocYearKnown = !Number.isNaN(startDate.getTime());
    // 日期壞掉時的退路：當成「民國年 = 年序、從 1 月起算」，至少不會整張甘特表消失
    const baseRocYear = rocYearKnown ? startDate.getFullYear() - 1911 : ganttYearIndex;
    const baseMonth = rocYearKnown ? startDate.getMonth() : 0; // 0~11

    // 同一年度各列的 months 長度理論上一致（resizeGanttYears 保證），取最大值防呆
    const monthCount = ganttYear.rows.reduce((max, row) => Math.max(max, row.months.length), 0);
    if (monthCount === 0) return;

    // 這個計畫年度橫跨幾個曆年（起算月 + 月數 - 1 落在第幾個曆年）
    const spanYears = Math.floor((baseMonth + monthCount - 1) / 12) + 1;
    for (let span = 0; span < spanYears; span++) {
      const monthSlots = Array.from({ length: 12 }, (_, month) => {
        const slot = span * 12 + month - baseMonth; // 該曆年 month 月 = 相對第幾個月
        return slot >= 0 && slot < monthCount ? slot : -1;
      });
      views.push({ rocYear: baseRocYear + span, rocYearKnown, ganttYearIndex, monthSlots });
    }
  });

  // 依曆年排序（Array.prototype.sort 是穩定排序，同年時維持原年度順序）
  return views.sort((a, b) => a.rocYear - b.rocYear);
}

// 第 N 年的中文序數；超出對照表時退回「第N年」。
// （沿用 DOC-2 原本的寫法：Word 甘特表的年度標題一直是「第一年」而非「第1年」，
//   統一後 Step3 頁籤也跟著用國字。）
const YEAR_ORDINALS = ['第一年', '第二年', '第三年', '第四年', '第五年', '第六年'];
function yearOrdinal(yearIndex: number): string {
  return YEAR_ORDINALS[yearIndex] || `第${yearIndex + 1}年`;
}

/**
 * 曆年檢視的「年度名稱」：多年期「第2年（116 年度）」、一年期「115 年度」、
 * 年度不可信時退回「第N年」。Step3 的頁籤標題與 DOC-2 甘特表上方的年度標題共用，
 * 兩邊文字才不會各寫一份而走鐘。
 * 注意：這裡只負責「名稱長什麼樣」，「要不要顯示」由呼叫端決定
 * （Word 只有一張表時不標；UI 的頁籤一定要有名字）。
 */
export function ganttYearLabel(
  view: GanttCalendarView,
  viewIndex: number,
  isMultiYear: boolean,
): string {
  if (!view.rocYearKnown) return yearOrdinal(viewIndex);
  return isMultiYear
    ? `${yearOrdinal(view.ganttYearIndex)}（${view.rocYear} 年度）`
    : `${view.rocYear} 年度`;
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
 * 從起迄日期計算月數
 */
export function calcMonthsBetween(start: string, end: string): number {
  return calcInclusiveMonths(start, end);
}
