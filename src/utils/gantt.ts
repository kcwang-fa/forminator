// ===== §4.5 甘特圖預設模板生成 =====

import type { GanttItem } from '../types/form';

interface GanttTemplate {
  name: string;
  startRatio: number; // 0~1
  endRatio: number;   // 0~1
}

const TEMPLATES: GanttTemplate[] = [
  { name: '文獻回顧與研究設計', startRatio: 0, endRatio: 0.25 },
  { name: 'IRB 送審與核准', startRatio: 0, endRatio: 0.25 },
  { name: '資料申請與取得', startRatio: 1 / 6, endRatio: 0.5 },
  { name: '資料清理與整理', startRatio: 1 / 3, endRatio: 2 / 3 },
  { name: '統計分析', startRatio: 0.5, endRatio: 5 / 6 },
  { name: '論文撰寫', startRatio: 2 / 3, endRatio: 1 },
  { name: '成果發表與結案', startRatio: 11 / 12, endRatio: 1 },
];

/**
 * 根據計畫總月數生成預設甘特圖
 */
export function generateDefaultGantt(totalMonths: number): GanttItem[] {
  if (totalMonths <= 0) return [];

  return TEMPLATES.map(t => {
    const startMonth = Math.floor(t.startRatio * totalMonths);
    const endMonth = Math.min(Math.ceil(t.endRatio * totalMonths), totalMonths);
    const months = Array.from({ length: totalMonths }, (_, i) =>
      i >= startMonth && i < endMonth
    );
    return { task_name: t.name, months };
  });
}

/**
 * 從起迄日期計算月數
 */
export function calcMonthsBetween(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  return (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()) + 1;
}
