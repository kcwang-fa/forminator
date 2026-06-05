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

export function calcProjectYears(start: string, end: string): number {
  const months = calcInclusiveMonths(start, end);
  if (months <= 0) return 0;
  return Math.max(1, Math.ceil(months / 12));
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
