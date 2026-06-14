// ===== 計畫類型配置表 =====
//
// 這是整個系統的「唯一真相來源」：要生成哪些文件、顯示哪些步驟、跑關流程怎麼走，
// 全部在這裡定義。App.tsx、WorkflowGuide、useDocumentGeneration 都只讀這份配置。
//
// 新手提示：
//   - 要新增計畫類型 → 在 PLAN_CONFIGS 加一個 key，其他地方不需動
//   - 模板尚未備妥時先設 ready: false，UI 會自動顯示 disabled
//   - docs 只能填 DocId（'DOC-1' ~ 'DOC-8'），填錯 TypeScript 會報錯

import type { ReviewType, WorkflowStep, OutputCategory } from '../types/form';
import type { DocId } from './defaults';
import { DOCS_WITHOUT_TEMPLATE } from './defaults';

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
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
    ],
  },
  {
    step: 2,
    title: '申請 IRB 審查',
    description: '紙本送企劃組，同時寄送 e-mail',
    documents: ['DOC-2', 'DOC-3', 'DOC-4', 'DOC-5', 'DOC-6'],
    refDocuments: [{ label: '研究計畫簽呈（已奉准）' }],
    signatureNotes: [
      'IRB-012 免審申請表：申請人簽章 + 單位主管簽章（主管簽章請列印後核章）',
      'IRB-018 保密切結書：每位研究人員各自親簽',
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
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
    documents: ['DOC-9', 'DOC-7', 'DOC-8', 'DOC-10'],
    refDocuments: [{ label: 'IRB 審查許可書' }],
    signatureNotes: [
      'DOC-7 資料庫保密切結書：每位研究人員各自親簽',
      'DOC-8 資料庫使用申請單：申請者簽名 + 單位主管簽名（主管簽名請列印後核章）',
      'DOC-10 個人資料利用申請表：申請單位主管簽名 + 業務權責單位核章（皆列印後核章）',
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
    ],
  },
  {
    step: 4,
    title: '送資訊室去識別化',
    description: '資料庫申請奉核後，填妥應用系統維護單送資訊室，委請進行資料庫去識別化處理',
    documents: ['DOC-11'],
    signatureNotes: [
      'DOC-11 應用系統維護單：申請單位核章 + 業務／系統權責單位審查',
    ],
  },
];

// ─── 簡易審查（簡審）跑關流程骨架 ──────────────────────────────────────────────
// ⚠️ 目前是「鋪位子」：結構複用免審四關，但第 2 關（申請 IRB 審查）的文件清單換成
//    簡審那包（依 IRB-001 流程圖：必備 DOC-2/3/4/6 ＋ 簡審加填 DOC-12/13，不含免審 DOC-5）。
//    簽章說明與聯絡窗口先沿用免審值，待確認後再調整（標 TODO）。
const expeditedWorkflowSteps: WorkflowStep[] = [
  {
    step: 1,
    title: '研究計畫上簽',
    description: '將簽呈連同署內研究計畫書送單位主管、相關單位及企劃組，一層核定',
    documents: ['DOC-1', 'DOC-2'],
    signatureNotes: [
      '署內研究計畫書封面：計畫主持人簽名',
      '附表一：填表人簽章 + 計畫主持人簽章（每位研究人員各一份）',
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
    ],
  },
  {
    step: 2,
    title: '申請 IRB 審查（簡易審查）',
    // 簡審與免審最大差異就在這關：送的是 IRB-002-1（DOC-12）＋ IRB-003（DOC-13），而非 IRB-012。
    description: '紙本送企劃組，同時寄送 e-mail；簡易審查由委員實質審查（非逕予同意）',
    documents: ['DOC-2', 'DOC-3', 'DOC-4', 'DOC-6', 'DOC-12', 'DOC-13'],
    refDocuments: [{ label: '研究計畫簽呈（已奉准）' }],
    signatureNotes: [
      'IRB-003 簡易審查案件申請表：主持人簽章 + 單位主管簽章（主管簽章請列印後核章）', // TODO 確認簡審各表單實際簽章需求
      'IRB-018 保密切結書：每位研究人員各自親簽',
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
    ],
    // TODO 確認簡審的 IRB 收件窗口是否與免審相同；先沿用免審聯絡資訊
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
    documents: ['DOC-9', 'DOC-7', 'DOC-8', 'DOC-10'],
    refDocuments: [{ label: 'IRB 審查許可書' }],
    signatureNotes: [
      'DOC-7 資料庫保密切結書：每位研究人員各自親簽',
      'DOC-8 資料庫使用申請單：申請者簽名 + 單位主管簽名（主管簽名請列印後核章）',
      'DOC-10 個人資料利用申請表：申請單位主管簽名 + 業務權責單位核章（皆列印後核章）',
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
    ],
  },
  {
    step: 4,
    title: '送資訊室去識別化',
    description: '資料庫申請奉核後，填妥應用系統維護單送資訊室，委請進行資料庫去識別化處理',
    documents: ['DOC-11'],
    signatureNotes: [
      'DOC-11 應用系統維護單：申請單位核章 + 業務／系統權責單位審查',
    ],
  },
];

// ─── 一般審查跑關流程 ──────────────────────────────────────────────────────
// 一般審與簡審使用相同的 IRB-002 / IRB-002-1 / IRB-004 / IRB-018 文件骨架，
// 但不填 IRB-003，且案件會由 2 位主審委員初審後提 IRB 會議討論。
const fullWorkflowSteps: WorkflowStep[] = [
  {
    step: 1,
    title: '研究計畫上簽',
    description: '將簽呈連同署內研究計畫書送單位主管、相關單位及企劃組，一層核定',
    documents: ['DOC-1', 'DOC-2'],
    signatureNotes: [
      '署內研究計畫書封面：計畫主持人簽名',
      '附表一：填表人簽章 + 計畫主持人簽章（每位研究人員各一份）',
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
    ],
  },
  {
    step: 2,
    title: '申請 IRB 審查（一般審查）',
    description: '紙本送企劃組並寄送電子檔；資料齊備後由 2 位主審委員初審，主持人依意見修正或回覆，再提 IRB 會議討論。審查結果可能為通過、修正後通過、修正後再審或不通過；通過後須依決議頻率辦理期中追蹤，計畫完成後辦理結案審查。',
    documents: ['DOC-2', 'DOC-3', 'DOC-4', 'DOC-6', 'DOC-12'],
    refDocuments: [
      { label: '研究計畫簽呈（已奉准）' },
      { label: '視需要檢附 IRB-014、問卷或病歷紀錄格式' },
      { label: '研究團隊倫理教育訓練證明' },
    ],
    signatureNotes: [
      'IRB-002-1 人體研究計畫申請表：主持人簽章 + 單位主管簽章（主管簽章請列印後核章）',
      'IRB-018 保密切結書：接觸個人資訊或存取資料的研究成員各自親簽',
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
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
    documents: ['DOC-9', 'DOC-7', 'DOC-8', 'DOC-10'],
    refDocuments: [{ label: 'IRB 審查許可書' }],
    signatureNotes: [
      'DOC-7 資料庫保密切結書：每位研究人員各自親簽',
      'DOC-8 資料庫使用申請單：申請者簽名 + 單位主管簽名（主管簽名請列印後核章）',
      'DOC-10 個人資料利用申請表：申請單位主管簽名 + 業務權責單位核章（皆列印後核章）',
      '在下載頁簽過名的人，文件會自動帶入簽名；沒簽的留白，列印後手簽即可',
    ],
  },
  {
    step: 4,
    title: '送資訊室去識別化',
    description: '資料庫申請奉核後，填妥應用系統維護單送資訊室，委請進行資料庫去識別化處理',
    documents: ['DOC-11'],
    signatureNotes: [
      'DOC-11 應用系統維護單：申請單位核章 + 業務／系統權責單位審查',
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
  // 簡易審查（簡審）：文件依 IRB-001 流程圖釘死。
  // docs = 必備 DOC-2/3/4/6 ＋ 簡審加填 DOC-12/13 ＋ 與審查類型正交的 DOC-1（簽呈）、DOC-7~11（資料庫）。
  //「正交」= 資料庫那包是否產出，看使用者勾不勾「資料庫申請」成果類別，跟免/簡/一般審無關，
  //   所以三種審查類型的 docs 都帶著它，最後由 resolveActivePlan 跟成果類別取交集決定。
  expedited: {
    id: 'expedited',
    label: '簡易審查',
    description: '署內資料庫回溯性研究（簡易審查）',
    docs: ['DOC-1', 'DOC-2', 'DOC-3', 'DOC-4', 'DOC-6', 'DOC-7', 'DOC-8', 'DOC-9', 'DOC-10', 'DOC-11', 'DOC-12', 'DOC-13'],
    wizardStepKeys: ['basic', 'personnel', 'research', 'irb', 'budget', 'database'],
    workflowSteps: expeditedWorkflowSteps,
    // ✅ 已開放（簡審 Phase 3）：模板（DOC-12/13.docx）+ docgen（prepareExpeditedData / prepareIrb002_1Data）
    //    + Step4 簡審 UI 都接好，DOC-12/13 也已移出 DOCS_WITHOUT_TEMPLATE。
    // ⚠️ 跑關流程第 2 關的簽章說明 / IRB 收件窗口仍沿用免審值（見 expeditedWorkflowSteps 的 TODO，待確認後補）。
    ready: true,
  },
  // 一般審查：依流程圖只加填 IRB-002-1（DOC-12），不含簡審專屬的 IRB-003（DOC-13）。
  full: {
    id: 'full',
    label: '一般審查',
    description: '一般審查計畫',
    docs: ['DOC-1', 'DOC-2', 'DOC-3', 'DOC-4', 'DOC-6', 'DOC-7', 'DOC-8', 'DOC-9', 'DOC-10', 'DOC-11', 'DOC-12'],
    wizardStepKeys: ['basic', 'personnel', 'research', 'irb', 'budget', 'database'],
    workflowSteps: fullWorkflowSteps,
    ready: true,
  },
};

export function getPlanConfig(reviewType: ReviewType): PlanConfig {
  return PLAN_CONFIGS[reviewType] ?? PLAN_CONFIGS.exempt;
}

// ===== 成果類別配置 =====
//
// 「成果類別」是與 review_type 正交的第二個軸：使用者在 Step1 先選「這次要產出哪幾類成果」
// （研究計畫 / IRB / 資料庫申請，可複選）。每類涵蓋哪些文件、需要哪些步驟，定義在這裡。
// 注意：這裡是「類別涵蓋的全集」，最終實際顯示的文件/步驟，會再與 review_type 的 planConfig
// 取交集（見 resolveActivePlan）——所以簡審/一般審沒有資料庫文件時，選了資料庫也不會無中生有。

export const OUTPUT_CATEGORIES = ['research_plan', 'irb', 'database'] as const;

interface OutputCategoryConfig {
  label: string;
  description: string;
  docs: DocId[];
  steps: WizardStepKey[];
}

export const OUTPUT_CATEGORY_CONFIGS: Record<OutputCategory, OutputCategoryConfig> = {
  research_plan: {
    label: '研究計畫',
    description: '研究計畫簽呈與署內研究計畫書',
    docs: ['DOC-1', 'DOC-2'],
    steps: ['basic', 'personnel', 'research', 'budget'],
  },
  irb: {
    label: 'IRB 審查',
    description: 'IRB 送審相關文件（審查類型決定實際包含哪幾份）',
    // 這裡列「IRB 類別可能涵蓋的所有文件」（各審查類型的聯集）：
    //   免審加填 DOC-5、簡審加填 DOC-12+DOC-13、一般審加填 DOC-12。
    // 實際生成哪幾份，會再與 review_type 的 planConfig.docs 取交集（見 resolveActivePlan）——
    // 例如選免審時，DOC-12/13 不在免審的 planConfig.docs 裡，交集後自動排除，不會誤產。
    docs: ['DOC-3', 'DOC-4', 'DOC-5', 'DOC-6', 'DOC-12', 'DOC-13'],
    steps: ['basic', 'personnel', 'research', 'irb'],
  },
  database: {
    label: '資料庫申請',
    description: '資料庫使用申請相關文件',
    docs: ['DOC-7', 'DOC-8', 'DOC-9', 'DOC-10', 'DOC-11'],
    steps: ['basic', 'personnel', 'database'],
  },
};

export interface ResolvedPlan {
  planConfig: PlanConfig;       // review_type 對應的原始配置（全集）
  wizardStepKeys: WizardStepKey[]; // 篩選後實際顯示的步驟
  docs: DocId[];               // 篩選後實際產出的文件
}

// ── 新手筆記：這個函式在做「交集（取兩邊都有的）」──
// 有兩個獨立的軸：
//   1. review_type（免/簡/一般審）→ 決定「這個審查類型最多會用到哪些文件」= planConfig.docs（全集）
//   2. output_categories（研究計畫/IRB/資料庫，可複選）→ 決定「這次想產出哪幾類成果」
// 最終要顯示的步驟與文件 = 兩邊「都有」的那些（交集），再扣掉「模板還沒做好的文件」（DOCS_WITHOUT_TEMPLATE，
// 目前為空）。例如：選了「簡審」+ 只勾「IRB」→ planConfig.docs（簡審那包）∩ IRB 類別 = DOC-3/4/6/12/13
//（DOC-5 不在簡審 planConfig.docs，交集後排除）→ 簡審 Phase 3 開放後 DOC-12/13 已可生成，全部產出。
// 這就是為什麼選免審時不會冒出簡審的 DOC-12/13：免審的 planConfig.docs 根本沒有它們，交集後就沒了。
//
// 注意：回傳的 `docs` 是「現在真的能生成的文件」（扣掉 DOCS_WITHOUT_TEMPLATE 裡沒模板的），但
// `planConfig.docs`（全集）仍保留完整規劃，需要看「這個審查類型規劃上有哪些文件」時讀 planConfig.docs。
//
// 維持 planConfig 既有順序；basic 一律保留（使用者隨時能回第一步重選）。
// 未勾任何類別時，誠實地回傳「只有基本資訊、零文件」，與 Step1 的「請至少選擇一項」警告一致——
// 不偷偷退回全選，否則畫面顯示全部取消、背後卻仍當全選跑，會自相矛盾。
// （正常情況預設三項全勾，只有使用者刻意全部取消才會走到這裡。）
export function resolveActivePlan(reviewType: ReviewType, categories: OutputCategory[]): ResolvedPlan {
  const planConfig = getPlanConfig(reviewType);
  const stepSet = new Set<WizardStepKey>(['basic']);
  const docSet = new Set<DocId>();
  for (const c of categories) {
    OUTPUT_CATEGORY_CONFIGS[c].steps.forEach((s) => stepSet.add(s));
    OUTPUT_CATEGORY_CONFIGS[c].docs.forEach((d) => docSet.add(d));
  }
  return {
    planConfig,
    wizardStepKeys: planConfig.wizardStepKeys.filter((s) => stepSet.has(s)),
    // 交集（兩邊都有）後，再排除「模板還沒做好」的文件，避免生成時抓不到 .docx 而 404。
    docs: planConfig.docs.filter((d) => docSet.has(d) && !DOCS_WITHOUT_TEMPLATE.includes(d)),
  };
}
