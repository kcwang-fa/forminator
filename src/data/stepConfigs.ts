// ===== 步驟靜態配置 =====
//
// 每個 wizard 步驟的標題、提示語、與「會影響的文件清單」集中在這裡，
// App.tsx 只負責讀這份配置組 layout，不再夾帶 step metadata。
//
// ⚠️ 邊界注意：
//   - StepConfig.affectedDocs 是「此單一步驟的填寫內容會影響哪些文件」（用於畫面標示）
//   - PlanConfig.docs (planConfigs.ts) 是「此計畫類型整體會產出哪些文件」（用於 ZIP 預選）
//   兩個欄位職責不同，不要互相覆蓋或合併。

import type { DocId } from './defaults';
import type { WizardStepKey } from './planConfigs';

export interface StepConfig {
  title: string;
  hint: string;
  affectedDocs: DocId[];
}

export const STEP_CONFIGS: Record<WizardStepKey, StepConfig> = {
  basic: {
    title: '基本資訊',
    hint: '先把計畫的骨架定清楚，後續文件主旨、封面、期間與單位會一起跟著走。',
    affectedDocs: ['DOC-1', 'DOC-2'],
  },
  personnel: {
    title: '研究團隊',
    hint: '這一步決定逐人文件與研究團隊附表內容。',
    affectedDocs: ['DOC-2', 'DOC-6'],
  },
  research: {
    title: '研究內容',
    hint: '這一步會影響計畫書、資料庫使用範圍與後續簽呈文案，是整份案子的內容核心。',
    affectedDocs: ['DOC-2', 'DOC-4'],
  },
  irb: {
    title: 'IRB 審查',
    hint: '確認審查類型、資料來源與保護措施，這些內容會直接進入 IRB 文件。',
    affectedDocs: ['DOC-3', 'DOC-4', 'DOC-5', 'DOC-6'],
  },
  budget: {
    title: '經費概算',
    hint: '先整理經費概算與需求，讓簽核文件裡的計畫資訊完整一致。',
    affectedDocs: ['DOC-1', 'DOC-2'],
  },
  database: {
    title: '資料庫申請',
    hint: '這一步會影響資料庫申請單、資料庫簽呈、個資表與應用系統維護單。',
    affectedDocs: ['DOC-7', 'DOC-8', 'DOC-9', 'DOC-10', 'DOC-11'],
  },
};
