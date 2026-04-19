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

/**
 * 產生 docgen budget_rows 所需的資料列（含管理費與合計行）
 * 只帶入金額非空的項目
 */
export function buildBudgetRows(items: BudgetItem[], needsFunding: boolean) {
  if (!needsFunding) return [];

  const active = items.filter(i => i.id !== 'mgmt' && i.name && i.amount);
  const personnel  = active.filter(isPersonnel).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const business   = active.filter(isBusiness).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const capital    = active.filter(isCapital).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const piAmount   = Number(active.find(i => i.id === 'pi_fee')?.amount  || 0);
  const coPiAmount = Number(active.find(i => i.id === 'co_pi_fee')?.amount || 0);
  const mgmtActive = isMgmtActive(items);
  const mgmt  = mgmtActive ? Math.round((personnel + business - piAmount - coPiAmount) * 0.15) : 0;
  const total = personnel + business + capital + mgmt;

  const mgmtRow = mgmtActive
    ? [{ budget_item: '管理費', budget_amount: mgmt ? mgmt.toLocaleString() : '', budget_note: '業務費小計 × 15%' }]
    : [];

  return [
    ...active.map(i => ({
      budget_item:   i.name,
      budget_amount: Number(i.amount).toLocaleString(),
      budget_note:   i.note,
    })),
    ...mgmtRow,
    { budget_item: '合計', budget_amount: total ? total.toLocaleString() : '', budget_note: '' },
  ];
}
