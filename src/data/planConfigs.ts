// ===== 計畫類型配置表 =====
//
// 這是整個系統的「唯一真相來源」：要生成哪些文件、顯示哪些步驟、跑關流程怎麼走，
// 全部在這裡定義。App.tsx、WorkflowGuide、useDocumentGeneration 都只讀這份配置。
//
// 新手提示：
//   - 要新增計畫類型 → 在 PLAN_CONFIGS 加一個 key，其他地方不需動
//   - 模板尚未備妥時先設 ready: false，UI 會自動顯示 disabled
//   - docs 只能填 DocId（'DOC-1' ~ 'DOC-8'），填錯 TypeScript 會報錯

import type { ReviewType, WorkflowStep } from '../types/form';
import type { DocId } from './defaults';

// 每種計畫類型的靜態配置
export interface PlanConfig {
  id: ReviewType;
  label: string;
  description: string;
  docs: DocId[];                 // 此類型需要的文件列表（決定生成時的預選項）
  wizardStepKeys: WizardStepKey[]; // 此類型顯示的步驟
  workflowSteps: WorkflowStep[]; // 跑關流程說明
  ready: boolean;                // false = 模板尚未備妥，UI 顯示 disabled
}

export const WIZARD_STEP_KEYS = ['basic', 'personnel', 'research', 'irb', 'budget', 'database'] as const;
export type WizardStepKey = typeof WIZARD_STEP_KEYS[number];

// ─── 免審：署內資料庫回溯性研究 ────────────────────────────────────────────
const exemptWorkflowSteps: WorkflowStep[] = [
  {
    step: 1,
    title: '研究計畫上簽',
    description: '將簽呈連同署內研究計畫書送單位主管、相關單位及企劃組，一層核定',
    documents: ['DOC-1', 'DOC-2'],
    signatureNotes: [
      '署內研究計畫書封面：計畫主持人簽名',
      '附表一：填表人簽章 + 計畫主持人簽章（每位研究人員各一份）',
    ],
  },
  {
    step: 2,
    title: '申請 IRB 審查',
    description: '紙本送企劃組，同時寄送 e-mail',
    documents: ['DOC-2', 'DOC-3', 'DOC-4', 'DOC-5', 'DOC-6'],
    refDocuments: [{ label: '研究計畫簽呈（已奉准）' }],
    signatureNotes: [
      'IRB-012 免審申請表：申請人簽章 + 單位主管簽章',
      'IRB-018 保密切結書：每位研究人員各自親簽',
    ],
    contact: {
      name: '劉兪筠',
      unit: '企劃組',
      email: 'yyliu7160@cdc.gov.tw',
      phone: '(02) 2395-9825 #3022',
    },
  },
  {
    step: 3,
    title: '資料庫申請上簽',
    description: 'IRB 通過後，將資料庫申請簽呈（DOC-9）連同使用申請單、保密切結書、個人資料利用申請表送單位主管、資料權責單位及資訊室、企劃組，一層核定',
    documents: ['DOC-9', 'DOC-7', 'DOC-8', 'DOC-11'],
    refDocuments: [{ label: 'IRB 審查許可書' }],
    signatureNotes: [
      'DOC-8 資料庫使用申請單：申請者簽名 + 單位主管簽名',
      'DOC-7 資料庫保密切結書：每位研究人員各自親簽',
      'DOC-11 個人資料利用申請表：申請單位主管簽名 + 業務權責單位核章',
    ],
  },
  {
    step: 4,
    title: '送資訊室去識別化',
    description: '第 3 關奉核後，填妥應用系統維護單送資訊室，委請進行資料庫去識別化處理',
    documents: ['DOC-10'],
    signatureNotes: [
      'DOC-10 應用系統維護單：申請單位核章 + 業務／系統權責單位審查',
    ],
  },
];

// ─── 所有計畫類型配置 ───────────────────────────────────────────────────────
export const PLAN_CONFIGS: Record<ReviewType, PlanConfig> = {
  exempt: {
    id: 'exempt',
    label: '免審',
    description: '署內資料庫回溯性研究（免審）',
    docs: ['DOC-1', 'DOC-2', 'DOC-3', 'DOC-4', 'DOC-5', 'DOC-6', 'DOC-7', 'DOC-8', 'DOC-9', 'DOC-10', 'DOC-11'],
    wizardStepKeys: ['basic', 'personnel', 'research', 'irb', 'budget', 'database'],
    workflowSteps: exemptWorkflowSteps,
    ready: true,
  },
  expedited: {
    id: 'expedited',
    label: '簡易審查',
    description: '簡易審查計畫（模板準備中）',
    docs: ['DOC-1', 'DOC-2', 'DOC-3', 'DOC-4', 'DOC-6'],
    wizardStepKeys: ['basic', 'personnel', 'research', 'irb', 'budget'],
    workflowSteps: [], // 待模板備妥後補充
    ready: false,
  },
  full: {
    id: 'full',
    label: '一般審查',
    description: '一般審查計畫（模板準備中）',
    docs: ['DOC-1', 'DOC-2', 'DOC-3', 'DOC-4', 'DOC-6'],
    wizardStepKeys: ['basic', 'personnel', 'research', 'irb', 'budget'],
    workflowSteps: [], // 待模板備妥後補充
    ready: false,
  },
};

export function getPlanConfig(reviewType: ReviewType): PlanConfig {
  return PLAN_CONFIGS[reviewType] ?? PLAN_CONFIGS.exempt;
}
