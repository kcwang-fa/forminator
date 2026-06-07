// ===== 經費概算計算工具（共用於 Step5Budget 和 docgen）=====
//
// 為什麼獨立成一個檔案？
// Step5Budget（UI 顯示即時小計）和 docgen（填入 Word 文件）都需要同樣的計算邏輯。
// 抽出來就不會兩邊分開維護、算出不同結果。
//
// 管理費計算規則：（人事費 + 業務費 - PI費 - co-PI費）× 15%
// （PI 和 co-PI 的費用不計入管理費基數，這是疾管署規定）

import type { BudgetItem } from '../types/form';

// 每個費用項目的固定 id，對應 defaults.ts 的 defaultBudgetItems
export const PERSONNEL_IDS = ['pi_fee', 'co_pi_fee', 'ra_fee'];
export const BUSINESS_IDS  = ['consumable', 'maintenance', 'office', 'travel'];
export const CAPITAL_IDS   = ['hardware'];

export function isPersonnel(item: BudgetItem): boolean {
  return PERSONNEL_IDS.includes(item.id) || (item.is_custom && item.category === '人事費');
}

export function isBusiness(item: BudgetItem): boolean {
  return BUSINESS_IDS.includes(item.id) || (item.is_custom && item.category === '業務費');
}

export function isCapital(item: BudgetItem): boolean {
  return CAPITAL_IDS.includes(item.id) || (item.is_custom && item.category === '資本門');
}

export function isMgmtActive(items: BudgetItem[]): boolean {
  const mgmt = items.find(i => i.id === 'mgmt');
  return mgmt ? (mgmt.active !== false) : true;
}

// ===== 分年金額工具（多年期計畫）=====
//
// year_amounts[k] = 第 k 年此項目金額；item.amount 是「全程總額」(= year_amounts 加總)。
// 既有的 calcMgmt/calcTotal 讀 item.amount，所以它們算的永遠是「全程」金額
// （壹摘要表的「合計」列用全程）。下面的 *Year 版本才看單一年度（陸、經費需求表逐年用）。

/**
 * 讀某項目的分年金額，並補裁到 years 長度。
 * 舊資料若沒有 year_amounts，退回 [amount]（一年期語意），再補空字串到 years 格。
 */
export function getYearAmounts(item: BudgetItem, years: number): string[] {
  const base = (item.year_amounts && item.year_amounts.length > 0)
    ? item.year_amounts
    : [item.amount || ''];
  const out = base.slice(0, years);
  while (out.length < years) out.push('');
  return out;
}

/** 把分年金額加總成「全程總額」字串（全空 → ''，方便維持原本空白不顯示的行為）。 */
export function sumYearAmounts(yearAmounts: string[]): string {
  const total = yearAmounts.reduce((s, v) => s + (Number(v) || 0), 0);
  return total ? String(total) : '';
}

// 取第 k 年單一項目金額（數字）；找不到項目回 0
function yearAmount(item: BudgetItem, k: number, years: number): number {
  return Number(getYearAmounts(item, years)[k]) || 0;
}
function yearAmountById(items: BudgetItem[], id: string, k: number, years: number): number {
  const it = items.find(i => i.id === id);
  return it ? yearAmount(it, k, years) : 0;
}

/** 第 k 年的管理費：(該年人事費 + 該年業務費 − 該年PI − 該年coPI) × 15% */
export function calcMgmtYear(items: BudgetItem[], k: number, years: number): number {
  const personnel = items.filter(isPersonnel).reduce((s, i) => s + yearAmount(i, k, years), 0);
  const business  = items.filter(isBusiness).reduce((s, i) => s + yearAmount(i, k, years), 0);
  const pi   = yearAmountById(items, 'pi_fee', k, years);
  const coPi = yearAmountById(items, 'co_pi_fee', k, years);
  return Math.round((personnel + business - pi - coPi) * 0.15);
}

/** 第 k 年的總額：該年人事+業務+資本+管理費 */
export function calcTotalYear(items: BudgetItem[], k: number, years: number): number {
  const personnel = items.filter(isPersonnel).reduce((s, i) => s + yearAmount(i, k, years), 0);
  const business  = items.filter(isBusiness).reduce((s, i) => s + yearAmount(i, k, years), 0);
  const capital   = items.filter(isCapital).reduce((s, i) => s + yearAmount(i, k, years), 0);
  const mgmt = isMgmtActive(items) ? calcMgmtYear(items, k, years) : 0;
  return personnel + business + capital + mgmt;
}

// 壹、綜合資料經費摘要表的「逐年資料列」一筆
export interface BudgetSummaryYear {
  sy_year: string;            // 民國年（DOC-2 cell 會在後面接「年度」字樣）
  sy_personnel_count: string; // 研究人力
  sy_apply: string;           // 申請金額
  sy_approved: string;        // 主管機關核定金額
  sy_personnel: string;       // 人事費
  sy_business: string;        // 業務費
  sy_capital: string;         // 設備費（資本門）
}

/**
 * 產生壹摘要表逐年資料列。
 * - 多年期：每年「申請金額」「核定金額」都用該年計算總額（使用者決策：自動帶該年計算總額）。
 * - 一年期：維持原行為 — 申請金額用使用者填的 applyAmountField、核定金額用該年計算總額，
 *   故一年期此表與改版前完全相同（保護 snapshot 與既有文件）。
 */
export function buildBudgetSummaryYears(
  items: BudgetItem[],
  needsFunding: boolean,
  years: number,
  personnelCount: number,
  isMultiYear: boolean,
  rocYears: string[],
  applyAmountField: string,
): BudgetSummaryYear[] {
  if (!needsFunding) return [];
  return Array.from({ length: years }, (_, k) => {
    const personnel = items.filter(isPersonnel).reduce((s, i) => s + yearAmount(i, k, years), 0);
    const business  = items.filter(isBusiness).reduce((s, i) => s + yearAmount(i, k, years), 0);
    const capital   = items.filter(isCapital).reduce((s, i) => s + yearAmount(i, k, years), 0);
    const total = calcTotalYear(items, k, years);
    const apply = isMultiYear ? total : (Number(applyAmountField) || 0);
    return {
      sy_year: rocYears[k] || '',
      sy_personnel_count: String(personnelCount),
      sy_apply:     apply     ? apply.toLocaleString()     : '',
      sy_approved:  total     ? total.toLocaleString()     : '',
      sy_personnel: personnel ? personnel.toLocaleString() : '',
      sy_business:  business  ? business.toLocaleString()  : '',
      sy_capital:   capital   ? capital.toLocaleString()   : '',
    };
  });
}

export function calcMgmt(items: BudgetItem[]): number {
  const personnel  = items.filter(isPersonnel).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const business   = items.filter(isBusiness).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const piAmount   = Number(items.find(i => i.id === 'pi_fee')?.amount   || 0);
  const coPiAmount = Number(items.find(i => i.id === 'co_pi_fee')?.amount || 0);
  return Math.round((personnel + business - piAmount - coPiAmount) * 0.15);
}

export function calcTotal(items: BudgetItem[]): number {
  const personnel = items.filter(isPersonnel).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const business  = items.filter(isBusiness).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const capital   = items.filter(isCapital).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const mgmt = isMgmtActive(items) ? calcMgmt(items) : 0;
  return personnel + business + capital + mgmt;
}

// 陸、經費需求表：逐年一張表（DOC-2 整張表外包 {#budget_years}、明細內包 {#budget_rows}）
interface BudgetDetailRow { budget_item: string; budget_amount: string; budget_note: string }
export interface BudgetYearGroup {
  by_year: string;                    // 民國年（填進「__年度經費需求」標題；一年期同壹表的 sy_year）
  by_page_break: Record<string, never>[]; // 第二年起插入分頁；用陣列供 docxtemplater 整段條件化
  budget_rows: BudgetDetailRow[];     // 該年各項目 + 管理費（不含合計，合計另為固定底列 by_total）
  budget_blanks: Record<string, never>[]; // 空白手填列（數量動態，讓每年表「明細+空白」剛好填滿一頁）
  by_total: string;                   // 該年合計（固定列）
}

// 官方範本整張表共有 18 列：標題 1 + 表頭 1 + 明細/空白 15 + 合計 1。
// 這裡只能補「明細/空白區」的 15 列；若誤設成 18，整張表會膨脹成 21 列並跨頁。
const DETAIL_ROWS_PER_PAGE = 15;

/** 依該年明細列數補足空白列，湊到官方範本的 15 列明細區。 */
function blanksFor(detailRowCount: number): Record<string, never>[] {
  return Array.from({ length: Math.max(0, DETAIL_ROWS_PER_PAGE - detailRowCount) }, () => ({}));
}

/**
 * 產生陸、經費需求表的逐年資料。
 * - 每年一個 group：標題年度 + 該年明細列（含管理費）+ 該年合計。
 * - 合計做成固定底列（by_total），明細列 loop 在上方展開、中間保留模板空白列，符合官方表格樣式。
 * - 多年期：各年金額用 year_amounts[k]、管理費逐年算；一年期一個 group，行為等同改版前。
 * - 無經費：回一個 group，明細只放一列「本計畫無須編列經費」。
 */
export function buildBudgetRowsByYear(
  items: BudgetItem[],
  needsFunding: boolean,
  years: number,
  rocYears: string[],
): BudgetYearGroup[] {
  if (!needsFunding) {
    return [{
      by_year: '',
      by_page_break: [],
      budget_rows: [{ budget_item: '本計畫無須編列經費', budget_amount: '', budget_note: '' }],
      budget_blanks: blanksFor(1),
      by_total: '',
    }];
  }
  const mgmtActive = isMgmtActive(items);
  // 決定每張年度表要列出哪些項目（mgmt 另外算）：
  // - 一年期：維持「金額 > 0 才列」（沒填的項目不出現）。
  // - 多年期：列出「全程任一年有編列」的項目（跨年聯集），讓每張年度表項目一致；
  //   某年沒填的項目金額留空。否則匯入舊存檔（year_amounts 只有第一年）改多年期時，
  //   第二年起會所有項目都被濾掉 → 明細 0 列 → docxtemplater 渲染出壞掉的空表（標題/表頭殘留）。
  const named = items.filter(i => i.id !== 'mgmt' && i.name);
  const activeItems = years === 1
    ? named.filter(i => yearAmount(i, 0, years) > 0)
    : named.filter(i => Array.from({ length: years }, (_, y) => yearAmount(i, y, years)).some(v => v > 0));
  return Array.from({ length: years }, (_, k) => {
    const rows: BudgetDetailRow[] = activeItems.map(i => {
      const amt = yearAmount(i, k, years);
      return {
        budget_item:   i.name,
        budget_amount: amt > 0 ? amt.toLocaleString() : '',  // 該年未填則留空，項目仍列出
        budget_note:   i.note,
      };
    });
    const mgmt = mgmtActive ? calcMgmtYear(items, k, years) : 0;
    if (mgmt) rows.push({ budget_item: '管理費', budget_amount: mgmt.toLocaleString(), budget_note: '業務費小計 × 15%' });
    const total = calcTotalYear(items, k, years);
    return {
      by_year: rocYears[k] || '',
      by_page_break: k === 0 ? [] : [{}],
      budget_rows: rows,
      budget_blanks: blanksFor(rows.length),  // 補空白列到一頁
      by_total: total ? total.toLocaleString() : '',
    };
  });
}
