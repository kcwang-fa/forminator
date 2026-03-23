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
