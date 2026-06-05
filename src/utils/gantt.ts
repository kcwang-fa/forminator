// ===== §4.5 甘特圖預設模板生成 =====

import type { GanttItem } from '../types/form';
import { calcInclusiveMonths } from './date';

interface GanttTemplate {
  name: string;
  startRatio: number; // 0~1
  endRatio: number;   // 0~1
}

// 「資料分析」預設範本：典型回溯性資料分析研究的 7 個階段。
// 注意：這份範本不再自動套用（以前空陣列時會自動塞這 7 項）。
// 現在改為「使用者按按鈕才載入」，預設甘特圖只有一列空白，讓使用者自行輸入工作項目。
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
 * 載入「資料分析」預設範本（7 個階段，依總月數自動分配進度）。
 * 由 Step3 的「帶入資料分析範本」按鈕呼叫，使用者主動點擊才覆寫甘特圖。
 */
export function generateDefaultGantt(totalMonths: number): GanttItem[] {
  if (totalMonths <= 0) return [];

  return DATA_ANALYSIS_TEMPLATES.map(t => {
    const startMonth = Math.floor(t.startRatio * totalMonths);
    const endMonth = Math.min(Math.ceil(t.endRatio * totalMonths), totalMonths);
    const months = Array.from({ length: totalMonths }, (_, i) =>
      i >= startMonth && i < endMonth
    );
    return { task_name: t.name, months };
  });
}

/**
 * 產生「一列空白」甘特圖（task_name 空、所有月份未勾選）。
 * 預設甘特圖用這個，讓使用者自行輸入工作項目，而非被 7 項範本綁死。
 */
export function createBlankGanttRows(totalMonths: number): GanttItem[] {
  if (totalMonths <= 0) return [];
  return [{ task_name: '', months: Array.from({ length: totalMonths }, () => false) }];
}

/**
 * 依新的總月數調整甘特圖每列的 months 長度（保留使用者已勾選的格子）。
 * 甘特圖為空時回傳「一列空白」，不再自動套用 7 項範本
 *（範本改由使用者點「帶入資料分析範本」按鈕載入）。
 */
export function resizeGantt(gantt: GanttItem[], totalMonths: number): GanttItem[] {
  if (totalMonths <= 0) return [];
  if (gantt.length === 0) return createBlankGanttRows(totalMonths);

  return gantt.map((item) => ({
    ...item,
    months: Array.from({ length: totalMonths }, (_, monthIndex) =>
      item.months[monthIndex] ?? false
    ),
  }));
}

export function getGanttMonthLabels(start: string, totalMonths: number): string[] {
  if (!start || totalMonths <= 0) {
    return Array.from({ length: Math.max(0, totalMonths) }, (_, index) => `第${index + 1}月`);
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    return Array.from({ length: totalMonths }, (_, index) => `第${index + 1}月`);
  }

  return Array.from({ length: totalMonths }, (_, index) => {
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
