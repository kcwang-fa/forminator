// ===== 日期工具 =====

/**
 * 西元日期 → 民國年月日字串
 * @param dateStr "2025-07-01"
 * @returns "114 年 7 月 1 日"
 */
export function toRocDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const rocYear = d.getFullYear() - 1911;
  return `${rocYear} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

export function getRocDateParts(dateStr: string): { y: string; m: string; d: string } {
  if (!dateStr) return { y: '', m: '', d: '' };
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return { y: '', m: '', d: '' };
  return {
    y: String(date.getFullYear() - 1911),
    m: String(date.getMonth() + 1),
    d: String(date.getDate()),
  };
}

export function calcInclusiveMonths(start: string, end: string): number {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  const months = (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth()) + 1;
  return Math.max(0, months);
}

// 計畫橫跨幾個「年度」。政府的年度對齊曆年，故計算「橫跨的曆年數」而非「月數/12」。
// 例：115/6 ~ 117/7 → 橫跨 115、116、117 三個年度 → 3。
// 這樣多年期的「全程年數」「經費分年」「甘特分年」都用同一個年度數，彼此一致。
export function calcProjectYears(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 0;
  if (endDate < startDate) return 0;
  return endDate.getFullYear() - startDate.getFullYear() + 1;
}

/**
 * 民國年 → 西元年
 */
export function rocToAd(rocYear: number): number {
  return rocYear + 1911;
}

/**
 * 日期加 N 年
 */
export function addYears(dateStr: string, years: number): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().slice(0, 10);
}
