// reviewClassifier 重構前的迴歸護網（Phase 2）
//
// 用途：
//   npm run classifier-snapshot:write  → 產出 scripts/baselines/classifier.json（基準線）
//   npm run classifier-snapshot:check  → 重跑 classifyReviewType 比對基準線
//
// 設計重點（為什麼要這支）：
//   reviewClassifier 是一支規則引擎，Phase 2 要把它從「散落的 switch」重構成「宣告式規則表」。
//   重構最怕「看起來等價、其實某條規則行為悄悄變了」。所以先用一組「代表性輸入」把目前的
//   輸出（review_type / confidence / reasons / matched_rules / warnings）整包釘成基準線；
//   重構後 check 必須完全一致，任何一個字不同都會被抓出來。
//
//   - CASES 刻意涵蓋每條規則 + 升級（從嚴）情境 + needsReview / incomplete 邊界
//   - 與 docgen-snapshot.ts 同樣用 sortKeys + stableStringify，確保 JSON 文字穩定、diff 可讀
//   - 新增規則時，請一併補一個對應的 case，再重新 write 基準線

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyReviewType } from '../src/utils/reviewClassifier';
import { emptyReviewScreening } from '../src/data/defaults';
import type { ReviewScreening } from '../src/types/form';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASELINE_PATH = resolve(__dirname, 'baselines/classifier.json');

// 每個 case 以 emptyReviewScreening 為底，只覆寫關注的欄位，讓 case 一眼看出測什麼
function s(partial: Partial<ReviewScreening>): ReviewScreening {
  return { ...emptyReviewScreening, ...partial };
}

const CASES: Array<{ name: string; screening: ReviewScreening }> = [
  // --- 邊界：資料不足 ---
  { name: 'empty', screening: s({}) },

  // --- 資料用途：免審類 ---
  {
    name: 'deidentified_db + 提供單位去個資 + 最低風險 → 免審(clear)',
    screening: s({ data_use_types: ['deidentified_database'], data_identifiability: 'provider_deidentified_unidentifiable', is_minimal_risk: true }),
  },
  {
    name: 'deidentified_db + 未確認可識別性 → full(needsReview)',
    screening: s({ data_use_types: ['deidentified_database'] }),
  },
  { name: 'education_evaluation → 免審', screening: s({ data_use_types: ['education_evaluation'], is_minimal_risk: true }) },
  { name: 'public_policy_evaluation → 免審', screening: s({ data_use_types: ['public_policy_evaluation'], is_minimal_risk: true }) },
  { name: 'public_non_interactive_observation → 免審', screening: s({ data_use_types: ['public_non_interactive_observation'], is_minimal_risk: true }) },
  { name: 'public_info → 免審', screening: s({ data_use_types: ['public_info'], is_minimal_risk: true, data_identifiability: 'public_or_legally_open' }) },

  // --- 資料用途：最低風險開關決定層級 ---
  { name: 'minimal_risk_new_data + 最低風險:true → 免審', screening: s({ data_use_types: ['minimal_risk_new_data'], is_minimal_risk: true }) },
  { name: 'minimal_risk_new_data + 最低風險:false → 一般審', screening: s({ data_use_types: ['minimal_risk_new_data'], is_minimal_risk: false }) },
  { name: 'minimal_risk_new_data + 最低風險:null → 免審(needsReview)', screening: s({ data_use_types: ['minimal_risk_new_data'] }) },

  // --- 資料用途：簡易審查類 ---
  { name: 'noninvasive_measurement → 簡審', screening: s({ data_use_types: ['noninvasive_measurement'], is_minimal_risk: true }) },
  { name: 'behavior_or_trait → 簡審', screening: s({ data_use_types: ['behavior_or_trait'], is_minimal_risk: true }) },
  { name: 'behavior_or_trait + 歧視風險 → 一般審', screening: s({ data_use_types: ['behavior_or_trait'], has_discrimination_risk: true, is_minimal_risk: true }) },
  { name: 'recording_or_image(非敏感) → 簡審', screening: s({ data_use_types: ['recording_or_image'], is_minimal_risk: true }) },
  { name: 'recording_or_image(敏感/可識別) → 一般審', screening: s({ data_use_types: ['recording_or_image'], recording_is_identifiable_or_sensitive: true, is_minimal_risk: true }) },

  // --- 病歷資料三條分支 ---
  {
    name: 'medical_record + 提供單位去個資 + 無接觸 + 無族群 → 免審',
    screening: s({ data_use_types: ['medical_record'], data_identifiability: 'provider_deidentified_unidentifiable', is_minimal_risk: true }),
  },
  { name: 'medical_record + HIV 陽性病歷 → 一般審', screening: s({ data_use_types: ['medical_record'], vulnerable_populations: ['hiv_positive'], is_minimal_risk: true }) },
  { name: 'medical_record(臨床常規病歷) → 簡審', screening: s({ data_use_types: ['medical_record'], is_minimal_risk: true }) },

  // --- 業務資料兩條分支 ---
  {
    name: 'business_data + 最低風險 + 非可回連 → 免審',
    screening: s({ data_use_types: ['business_data'], is_minimal_risk: true, data_identifiability: 'coded_researcher_unidentifiable' }),
  },
  { name: 'business_data + 非最低風險 → 一般審(needsReview)', screening: s({ data_use_types: ['business_data'], is_minimal_risk: false }) },

  // --- 兜底：其他資料 ---
  { name: 'other_existing_data → 一般審(needsReview)', screening: s({ data_use_types: ['other_existing_data'], is_minimal_risk: true }) },
  { name: 'other_new_data → 一般審(needsReview)', screening: s({ data_use_types: ['other_new_data'], is_minimal_risk: true }) },

  // --- 多中心 IRB 同意（本身即構成研究素材）---
  { name: 'has_other_irb_approval 單獨 → 簡審', screening: s({ has_other_irb_approval: true, is_minimal_risk: true }) },

  // --- 直接判一般審的硬條件 ---
  {
    name: '高風險處置（即使其他條件符合免審）→ 一般審',
    screening: s({ data_use_types: ['deidentified_database'], data_identifiability: 'provider_deidentified_unidentifiable', is_minimal_risk: true, has_high_risk_procedure: true }),
  },

  // --- 檢體 / 菌株 ---
  { name: 'limited_blood_draw → 簡審', screening: s({ specimen_use_types: ['limited_blood_draw'], is_minimal_risk: true }) },
  { name: 'new_noninvasive_specimen → 簡審', screening: s({ specimen_use_types: ['new_noninvasive_specimen'], is_minimal_risk: true }) },
  { name: 'cdc_residual_specimen + 最低風險 → 免審', screening: s({ specimen_use_types: ['cdc_residual_specimen'], is_minimal_risk: true }) },
  { name: 'cdc_residual_specimen + 非最低風險 → 一般審', screening: s({ specimen_use_types: ['cdc_residual_specimen'], is_minimal_risk: false }) },
  { name: 'remaining_specimen_original_consent → 簡審', screening: s({ specimen_use_types: ['remaining_specimen_original_consent'], is_minimal_risk: true }) },
  { name: 'external_remaining_specimen_original_consent → 簡審', screening: s({ specimen_use_types: ['external_remaining_specimen_original_consent'], is_minimal_risk: true }) },
  { name: 'legal_biobank_unlinkable → 簡審', screening: s({ specimen_use_types: ['legal_biobank_unlinkable'], is_minimal_risk: true }) },
  { name: 'cdc_residual_non_original_with_clinical_report → 簡審(+知情同意 warning)', screening: s({ specimen_use_types: ['cdc_residual_non_original_with_clinical_report'], is_minimal_risk: true }) },
  { name: 'strain_or_virus → 免審', screening: s({ specimen_use_types: ['strain_or_virus'], is_minimal_risk: true }) },
  { name: 'other_specimen → 一般審(needsReview)', screening: s({ specimen_use_types: ['other_specimen'], is_minimal_risk: true }) },

  // --- 易受傷害族群升級規則 ---
  {
    name: '既有資料(免審) + 敏感族群 → 升簡審',
    screening: s({ data_use_types: ['public_info'], data_identifiability: 'public_or_legally_open', is_minimal_risk: true, vulnerable_populations: ['minor'] }),
  },
  {
    name: '檢體(免審) + 敏感族群 → 升簡審(needsReview)',
    screening: s({ specimen_use_types: ['strain_or_virus'], is_minimal_risk: true, vulnerable_populations: ['prisoner'] }),
  },

  // --- 混合研究方法（從嚴取最高層級 + 警示）---
  {
    name: '混合：deidentified_db + limited_blood_draw',
    screening: s({ data_use_types: ['deidentified_database'], specimen_use_types: ['limited_blood_draw'], data_identifiability: 'provider_deidentified_unidentifiable', is_minimal_risk: true }),
  },

  // --- 可回連資料的警示 ---
  {
    name: 'behavior_or_trait + 可識別/可回連 → 簡審(+可識別 warning)',
    screening: s({ data_use_types: ['behavior_or_trait'], data_identifiability: 'identifiable_or_linkable', is_minimal_risk: true }),
  },
];

// 遞迴排序 object 的 key（陣列保持順序），確保輸出文字穩定
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, v]) => [k, sortKeys(v)] as const);
    return Object.fromEntries(entries);
  }
  return value;
}

function buildSnapshot() {
  const results = CASES.map(({ name, screening }) => ({
    name,
    decision: classifyReviewType(screening),
  }));
  return sortKeys({ results });
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, null, 2) + '\n';
}

function write() {
  writeFileSync(BASELINE_PATH, stableStringify(buildSnapshot()), 'utf8');
  console.log(`[classifier-snapshot] baseline 已寫入：${BASELINE_PATH}`);
}

function check() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(`[classifier-snapshot] 找不到基準線：${BASELINE_PATH}`);
    console.error('[classifier-snapshot] 請先執行 npm run classifier-snapshot:write 建立基準線');
    process.exit(2);
  }
  const expected = readFileSync(BASELINE_PATH, 'utf8');
  const actual = stableStringify(buildSnapshot());
  if (actual === expected) {
    console.log('[classifier-snapshot] ✓ 與基準線完全一致');
    return;
  }
  console.error('[classifier-snapshot] ✗ 與基準線有差異，列出前 80 行 diff：');
  const expectedLines = expected.split('\n');
  const actualLines = actual.split('\n');
  const maxLen = Math.max(expectedLines.length, actualLines.length);
  let shown = 0;
  for (let i = 0; i < maxLen && shown < 80; i++) {
    if (expectedLines[i] !== actualLines[i]) {
      console.error(`  L${i + 1}`);
      console.error(`    - ${expectedLines[i] ?? '<EOF>'}`);
      console.error(`    + ${actualLines[i] ?? '<EOF>'}`);
      shown++;
    }
  }
  process.exit(1);
}

const mode = process.argv[2];
if (mode === 'write') write();
else if (mode === 'check') check();
else {
  console.error('用法：tsx scripts/classifier-snapshot.ts <write|check>');
  process.exit(2);
}
