// ===== 經費概算計算工具（共用於 Step5Budget 和 docgen）=====

import type { BudgetItem } from '../types/form';

export const PERSONNEL_IDS = ['pi_fee', 'co_pi_fee', 'ra_fee', 'insurance', 'pension'];
export const BUSINESS_IDS  = ['irb_fee', 'travel', 'meal', 'misc'];

export function isPersonnel(item: BudgetItem): boolean {
  return PERSONNEL_IDS.includes(item.id) || (item.is_custom && item.category === '人事費');
}

export function isBusiness(item: BudgetItem): boolean {
  return BUSINESS_IDS.includes(item.id) || (item.is_custom && item.category !== '人事費');
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
  const mgmt = isMgmtActive(items) ? calcMgmt(items) : 0;
  return personnel + business + mgmt;
}

/**
 * 產生 docgen budget_rows 所需的資料列（含管理費與合計行）
 * 只帶入金額非空的項目
 */
export function buildBudgetRows(items: BudgetItem[], needsFunding: boolean) {
  if (!needsFunding) return [];

  const active = items.filter(i => i.id !== 'mgmt' && i.name && i.amount);
  const personnel = active.filter(isPersonnel).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const business  = active.filter(isBusiness).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  const piAmount   = Number(active.find(i => i.id === 'pi_fee')?.amount  || 0);
  const coPiAmount = Number(active.find(i => i.id === 'co_pi_fee')?.amount || 0);
  const mgmtActive = isMgmtActive(items);
  const mgmt  = mgmtActive ? Math.round((personnel + business - piAmount - coPiAmount) * 0.15) : 0;
  const total = personnel + business + mgmt;

  return [
    ...active.map(i => ({
      budget_item:   i.name,
      budget_amount: Number(i.amount).toLocaleString(),
      budget_note:   i.note,
    })),
    { budget_item: '管理費', budget_amount: mgmt ? mgmt.toLocaleString() : '', budget_note: '業務費小計 × 15%' },
    { budget_item: '合計',   budget_amount: total ? total.toLocaleString() : '', budget_note: '' },
  ];
}
