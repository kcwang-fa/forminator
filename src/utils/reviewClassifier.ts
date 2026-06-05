import type {
  ExemptCategory,
  ReviewDataUseType,
  ReviewDecision,
  ReviewScreening,
  ReviewSpecimenUseType,
  ReviewType,
} from '../types/form';

// ===== 審查類型判斷規則引擎 =====
//
// 設計理念（Phase 2 重構）：
//   以前每個資料用途 / 檢體類型的判斷都寫在一個巨大的 switch 裡，規則散落、難維護。
//   重構後改成「宣告式規則表」：
//     - DATA_USE_RULES / SPECIMEN_RULES 用 Record<型別, 規則> 把「某個選項 → 判什麼審查」
//       集中成一張查表。新增一個資料/檢體類型，TypeScript 會強制你補上對應規則（漏寫會編譯錯）。
//     - 規則可以是「靜態結果」(RuleOutcome)，也可以是「依其他欄位決定的函式」(s => RuleOutcome)，
//       例如最低風險 true/false 會判不同層級。
//   classifyReviewType 的流程改為：跑修飾規則 → 依使用者勾選順序查表套用 → 後處理（族群升級、
//   可識別性/最低風險警示、混合方法警示）。
//
//   ⚠️ 行為等價性：本檔有迴歸護網 scripts/classifier-snapshot.ts。
//   改規則前先 `npm run classifier-snapshot:write`（若刻意改行為），或改完跑
//   `npm run classifier-snapshot:check` 確認沒有意外漂移。

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  exempt: '免予審查',
  expedited: '簡易審查',
  full: '一般審查',
};

// 審查層級高低：從嚴原則 = 取命中規則中的最高層級
const REVIEW_RANK: Record<ReviewType, number> = {
  exempt: 1,
  expedited: 2,
  full: 3,
};

const VULNERABLE_WARNING = '研究對象包含易受傷害族群或免審先決條件排除族群，免審判斷需從嚴處理。';

// 既有資料若涉及這些敏感/易受傷害族群，即使資料無法辨識個人，免審也要提高為簡易審查
const SENSITIVE_GROUPS: ReviewVulnerableLike[] = [
  'hiv_positive',
  'tb_case',
  'new_immigrant_or_migrant',
  'long_term_care_resident',
  'minor',
  'prisoner',
  'indigenous',
  'pregnant',
  'disability',
  'mental_illness',
  'other_vulnerable',
];
type ReviewVulnerableLike = ReviewScreening['vulnerable_populations'][number];

function unique(items: string[]): string[] {
  return Array.from(new Set(items));
}

function hasAny<T extends string>(items: T[], targets: T[]): boolean {
  return targets.some((target) => items.includes(target));
}

function inferExemptCategory(dataUseTypes: ReviewDataUseType[], specimenUseTypes: ReviewSpecimenUseType[]): ExemptCategory {
  if (dataUseTypes.includes('education_evaluation')) return 'education';
  if (dataUseTypes.includes('public_policy_evaluation')) return 'public_policy';
  if (dataUseTypes.includes('public_non_interactive_observation')) return 'public_non_interactive';
  if (dataUseTypes.includes('public_info') || dataUseTypes.includes('deidentified_database')) return 'public_info';
  if (specimenUseTypes.includes('cdc_residual_specimen') || specimenUseTypes.includes('strain_or_virus')) return 'minimal_risk';
  return 'minimal_risk';
}

// 一條規則命中後的結果：要判哪種審查、理由、命中的法規依據、(可選) 警示、(可選) 需人工確認
type RuleOutcome = {
  type: ReviewType;
  reason: string;
  rule: string;
  warning?: string;
  needsReview?: boolean;
};

// 規則可以是固定結果，也可以是「看其他欄位再決定」的函式
type ReviewRule = RuleOutcome | ((screening: ReviewScreening) => RuleOutcome);

function resolveRule(rule: ReviewRule, screening: ReviewScreening): RuleOutcome {
  return typeof rule === 'function' ? rule(screening) : rule;
}

// ----- 修飾規則：與「用什麼資料/檢體」無關，但會直接拉高審查層級，最先套用 -----
const MODIFIER_RULES: Array<{ when: (s: ReviewScreening) => boolean; outcome: RuleOutcome }> = [
  {
    when: (s) => s.has_high_risk_procedure,
    outcome: {
      type: 'full',
      reason: '涉及高風險、人體試驗或需要安全性監測的處置，應採一般審查。',
      rule: '新案審查說明：高風險或人體試驗範圍計畫需提報安全性監測計畫。',
    },
  },
  {
    when: (s) => s.has_discrimination_risk,
    outcome: {
      type: 'full',
      reason: '研究可能造成個人或族群歧視風險，不符合簡易審查表列的低風險行為研究條件。',
      rule: '新案審查類型評檢表：研究個人或群體特質或行為之簡易審查，不含造成歧視之潛在可能者。',
    },
  },
  {
    when: (s) => s.has_other_irb_approval,
    outcome: {
      type: 'expedited',
      reason: '多中心研究已取得其他中心合法審查會同意證明，可列為簡易審查判斷依據。',
      rule: '新案審查類型評檢表：多中心研究計畫已取得其他中心合法審查會之同意證明。',
    },
  },
];

// ----- 資料用途規則表（涵蓋全部 ReviewDataUseType；漏寫某 key TypeScript 會報錯）-----
const DATA_USE_RULES: Record<ReviewDataUseType, ReviewRule> = {
  education_evaluation: {
    type: 'exempt',
    reason: '於一般教學環境中進行教育評量、測試、教學技巧或成效評估，原則上可列免予審查。',
    rule: '新案審查類型評檢表：一般教學環境中之教育評量或教學成效研究。',
  },
  public_policy_evaluation: {
    type: 'exempt',
    reason: '公務機關執行法定職務所進行的公共政策成效評估研究，原則上可列免予審查。',
    rule: '新案審查類型評檢表：公務機關執行法定職務之公共政策成效評估研究。',
  },
  public_non_interactive_observation: {
    type: 'exempt',
    reason: '於公開場合進行非記名、非互動且非介入性研究，且無從辨識特定個人，原則上可列免予審查。',
    rule: '新案審查類型評檢表：公開場合非記名、非互動且非介入性研究。',
  },
  // 最低風險為 false → 一般審；否則（true 或未確認）→ 免審
  minimal_risk_new_data: (s) =>
    s.is_minimal_risk === false
      ? {
          type: 'full',
          reason: '使用新收集資料但研究風險高於最低風險，不宜判為免審。',
          rule: '新案審查類型評檢表：研究計畫屬最低風險且風險不高於未參加者。',
        }
      : {
          type: 'exempt',
          reason: '新收集資料若屬最低風險，且研究對象風險不高於未參加者，原則上可列免予審查。',
          rule: '新案審查類型評檢表：研究計畫屬最低風險且風險不高於未參加者。',
        },
  noninvasive_measurement: {
    type: 'expedited',
    reason: '使用非侵入性方法收集資料，原則上屬簡易審查。',
    rule: '新案審查類型評檢表：非侵入性方法收集資料。',
  },
  behavior_or_trait: {
    type: 'expedited',
    reason: '研究個人或群體特質或行為，且未標示歧視風險，原則上屬簡易審查。',
    rule: '新案審查類型評檢表：研究個人或群體特質或行為。',
  },
  // 影像資料可識別或敏感 → 一般審；否則 → 簡審
  recording_or_image: (s) =>
    s.recording_is_identifiable_or_sensitive
      ? {
          type: 'full',
          reason: '研究使用錄音、錄影或影像資料，且可能識別個人或影響工作、保險、財務及社會關係，需從嚴審查。',
          rule: '新案審查類型評檢表：以研究為目的所蒐集之錄音、錄影或影像資料。',
        }
      : {
          type: 'expedited',
          reason: '以研究為目的蒐集錄音、錄影或影像資料，且未標示可識別或敏感影響，原則上屬簡易審查。',
          rule: '新案審查類型評檢表：以研究為目的所蒐集之錄音、錄影或影像資料。',
        },
  // 資料庫：唯有「資料提供單位去個資且無法辨識特定個人」才免審；否則從嚴並需人工確認
  deidentified_database: (s) =>
    s.data_identifiability === 'provider_deidentified_unidentifiable'
      ? {
          type: 'exempt',
          reason: '申請防疫資料庫、衛福資料科學中心、健保資料庫等資料，且由資料提供單位去個資、研究者無法辨識特定個人，原則上可列免予審查。',
          rule: '新案審查類型評檢表：資料提供單位去個資且無法辨識特定個人之資料庫分析。',
        }
      : {
          type: 'full',
          reason: '使用資料庫資料但尚未確認由資料提供單位去個資且無法辨識特定個人，需人工確認或從嚴審查。',
          rule: '新案審查類型評檢表：免審資料庫分析須經資料提供單位去個資且無法辨識特定個人。',
          warning: '若只是研究團隊自行匿名編碼，請勿寫成「去連結」；新案審查說明特別提醒這個名詞差異。',
          needsReview: true,
        },
  // 病歷：去個資+無接觸+無族群 → 免審；HIV 陽性病歷 → 一般審；其餘臨床常規病歷 → 簡審
  medical_record: (s) => {
    const vulnerablePopulations = s.vulnerable_populations || [];
    const hasVulnerable = vulnerablePopulations.length > 0;
    const hasHiv = vulnerablePopulations.includes('hiv_positive');
    if (
      s.data_identifiability === 'provider_deidentified_unidentifiable' &&
      !s.has_direct_subject_contact &&
      !hasVulnerable
    ) {
      return {
        type: 'exempt',
        reason: '向醫療院所申請之病歷資料若已由該單位提供為無法辨識特定個人，且無直接接觸個案資料，原則上可列免予審查。',
        rule: '新案審查類型評檢表：醫療院所提供無法辨識特定個人且無直接接觸之病歷資料。',
      };
    }
    if (hasHiv) {
      return {
        type: 'full',
        reason: '使用 HIV 陽性患者病歷不屬於簡易審查表列病歷研究範圍，需從嚴審查。',
        rule: '新案審查類型評檢表：使用臨床常規治療或診斷病歷之簡易審查，不含 HIV 陽性患者病歷。',
      };
    }
    return {
      type: 'expedited',
      reason: '使用臨床常規治療或診斷之病歷，且未標示 HIV 陽性患者病歷，原則上屬簡易審查。',
      rule: '新案審查類型評檢表：使用臨床常規治療或診斷之病歷，含個案報告。',
    };
  },
  // 業務資料：最低風險且非可回連 → 免審；否則從嚴並需人工確認
  business_data: (s) =>
    s.is_minimal_risk && s.data_identifiability !== 'identifiable_or_linkable'
      ? {
          type: 'exempt',
          reason: '直接使用既有業務蒐集資料進行研究，若屬最低風險且資料隱私保護措施清楚，原則上可列免予審查。',
          rule: '新案審查類型評檢表：直接使用執行業務所蒐集資料，須敘明最低風險及資料隱私保護措施。',
        }
      : {
          type: 'full',
          reason: '使用既有業務資料但未符合最低風險或資料仍可識別，需人工確認或從嚴審查。',
          rule: '新案審查類型評檢表：業務資料免審須清楚敘明最低風險與資料隱私保護措施。',
          needsReview: true,
        },
  public_info: {
    type: 'exempt',
    reason: '使用已合法公開週知之資訊，且符合其公開週知目的，原則上可列免予審查。',
    rule: '新案審查類型評檢表：使用已合法公開週知之資訊。',
  },
  other_existing_data: {
    type: 'full',
    reason: '研究資料或新收案方式不屬於目前表列免審或簡易審查情境，建議先以一般審查或人工確認處理。',
    rule: '新案審查類型評檢表：不符合以上者，請送一般審查。',
    needsReview: true,
  },
  other_new_data: {
    type: 'full',
    reason: '研究資料或新收案方式不屬於目前表列免審或簡易審查情境，建議先以一般審查或人工確認處理。',
    rule: '新案審查類型評檢表：不符合以上者，請送一般審查。',
    needsReview: true,
  },
};

// ----- 檢體 / 菌株規則表（涵蓋全部 ReviewSpecimenUseType）-----
const SPECIMEN_RULES: Record<ReviewSpecimenUseType, ReviewRule> = {
  limited_blood_draw: {
    type: 'expedited',
    reason: '新收集血液檢體且符合成年人、採血量與頻率限制，原則上屬簡易審查。',
    rule: '新案審查類型評檢表：自成年人收集血液檢體之採血量與頻率限制。',
  },
  new_noninvasive_specimen: {
    type: 'expedited',
    reason: '僅以非侵入性方法採集研究用人體檢體，原則上屬簡易審查。',
    rule: '新案審查類型評檢表：非侵入性方法採集研究用人體檢體。',
  },
  // 驗餘檢體：最低風險為 false → 一般審；否則 → 免審
  cdc_residual_specimen: (s) =>
    s.is_minimal_risk === false
      ? {
          type: 'full',
          reason: '使用防疫驗餘檢體但研究風險高於最低風險，不宜判為免審。',
          rule: '新案審查類型評檢表：使用防疫驗餘檢體且符合傳染病防治法與最低風險。',
        }
      : {
          type: 'exempt',
          reason: '僅使用防疫驗餘檢體，且符合傳染病防治法與最低風險條件，原則上可列免予審查。',
          rule: '新案審查類型評檢表：使用防疫驗餘檢體且符合傳染病防治法與最低風險。',
        },
  remaining_specimen_original_consent: {
    type: 'expedited',
    reason: '使用剩餘檢體且符合檢體提供者原先同意範圍，原則上屬簡易審查。',
    rule: '新案審查類型評檢表：使用剩餘檢體且符合原先同意使用範圍。',
  },
  external_remaining_specimen_original_consent: {
    type: 'expedited',
    reason: '使用外單位剩餘檢體且符合檢體提供者原先同意範圍，原則上屬簡易審查。',
    rule: '新案審查類型評檢表：使用外單位剩餘檢體且符合原先同意使用範圍。',
  },
  legal_biobank_unlinkable: {
    type: 'expedited',
    reason: '自合法人體生物資料庫取得去連結或無法辨識特定個人之檢體，原則上屬簡易審查。',
    rule: '新案審查類型評檢表：合法人體生物資料庫之去連結或無法辨識檢體。',
  },
  cdc_residual_non_original_with_clinical_report: {
    type: 'expedited',
    reason: '使用防疫驗餘檢體進行非原通報疾病檢驗且需核發檢驗報告至臨床端，原則上屬簡易審查，並應取得知情同意書。',
    rule: '新案審查類型評檢表：防疫驗餘檢體進行非原通報疾病檢驗且核發臨床報告。',
    warning: '此情境應取得檢體提供者之知情同意書。',
  },
  strain_or_virus: {
    type: 'exempt',
    reason: '使用醫療院所依防疫需求送回本署之菌株或病毒株，原則上可列免予審查。',
    rule: '新案審查類型評檢表：使用醫療院所依防疫需求送回本署之菌株/病毒株。',
  },
  other_specimen: {
    type: 'full',
    reason: '檢體使用方式不屬於目前表列免審或簡易審查情境，建議先以一般審查或人工確認處理。',
    rule: '新案審查類型評檢表：不符合以上者，請送一般審查。',
    needsReview: true,
  },
};

export function classifyReviewType(screening: ReviewScreening): ReviewDecision {
  const dataUseTypes = screening.data_use_types || [];
  const specimenUseTypes = screening.specimen_use_types || [];
  const hasAnyResearchMaterial = dataUseTypes.length > 0 || specimenUseTypes.length > 0 || screening.has_other_irb_approval;

  if (!hasAnyResearchMaterial) {
    return {
      review_type: null,
      confidence: 'incomplete',
      reasons: ['請先選擇研究使用的資料、研究方法、檢體或菌株類型。'],
      matched_rules: [],
      warnings: ['此工具僅提供送件前初判，最後審查類型仍以本署人體研究倫理審查會裁定為準。'],
    };
  }

  const reasons: string[] = [];
  const matchedRules: string[] = [];
  const warnings: string[] = [];
  let reviewType: ReviewType | null = null;
  let needsReview = false;

  // 套用一條規則結果：依「從嚴原則」把 reviewType 升到最高層級，並累積理由/依據/警示
  const apply = (outcome: RuleOutcome) => {
    if (!reviewType || REVIEW_RANK[outcome.type] > REVIEW_RANK[reviewType]) {
      reviewType = outcome.type;
    }
    reasons.push(outcome.reason);
    matchedRules.push(outcome.rule);
    if (outcome.warning) warnings.push(outcome.warning);
    if (outcome.needsReview) needsReview = true;
  };

  // 1) 修飾規則（高風險、歧視、其他 IRB 同意）最先套用
  MODIFIER_RULES.forEach((modifier) => {
    if (modifier.when(screening)) apply(modifier.outcome);
  });

  // 2) 依使用者勾選順序查表套用資料用途與檢體規則（保留順序，理由/警示順序才會穩定）
  dataUseTypes.forEach((type) => {
    const rule = DATA_USE_RULES[type];
    if (rule) apply(resolveRule(rule, screening));
  });
  specimenUseTypes.forEach((type) => {
    const rule = SPECIMEN_RULES[type];
    if (rule) apply(resolveRule(rule, screening));
  });

  // 3) 後處理：易受傷害族群會把「免審」往上調為「簡審」
  const vulnerablePopulations = screening.vulnerable_populations || [];
  const hasVulnerablePopulation = vulnerablePopulations.length > 0;
  const hasSensitiveExistingGroup = hasAny(vulnerablePopulations, SENSITIVE_GROUPS);

  if (hasSensitiveExistingGroup && reviewType === 'exempt' && dataUseTypes.length > 0) {
    reviewType = 'expedited';
    reasons.push('使用既有資料且研究對象屬易受傷害或敏感族群，即使資料無法辨識特定個人，也應提高為簡易審查。');
    matchedRules.push('新案審查類型評檢表：使用無法辨識特定個人之既有資料，但研究對象為易受傷害族群。');
    warnings.push(VULNERABLE_WARNING);
  } else if (hasVulnerablePopulation && reviewType === 'exempt') {
    reviewType = 'expedited';
    reasons.push('免審先決條件排除易受傷害族群，本案需提高審查層級並由 IRB 確認。');
    matchedRules.push('新案審查類型評檢表：免審先決條件。');
    warnings.push(VULNERABLE_WARNING);
    needsReview = true;
  }

  const finalReviewType = reviewType as ReviewType | null;

  // 4) 後處理警示：尚未確認最低風險、資料仍可識別/可回連
  if (screening.is_minimal_risk === null && finalReviewType !== 'full') {
    warnings.push('尚未確認是否屬最低風險；若風險高於日常生活中遭受的危害或不適，審查層級可能需要提高。');
    needsReview = true;
  }

  if (
    screening.data_identifiability === 'identifiable_or_linkable' &&
    finalReviewType !== 'full' &&
    !dataUseTypes.includes('medical_record')
  ) {
    warnings.push('資料仍可識別或可回連個人，請補充去識別化、匿名編碼與存取控管措施；必要時需提高審查層級。');
    needsReview = true;
  }

  if (!finalReviewType) {
    return {
      review_type: null,
      confidence: 'incomplete',
      reasons: ['目前資訊不足，尚無法判斷審查類型。'],
      matched_rules: unique(matchedRules),
      warnings: unique([...warnings, '請至少補齊資料來源、檢體來源與最低風險判斷。']),
    };
  }

  const isMixedMethod = dataUseTypes.length + specimenUseTypes.length > 1;
  if (isMixedMethod) {
    warnings.push('研究涉及兩種以上研究方法，系統已依「從嚴審查」原則採最高審查層級。');
  }

  warnings.push('本判斷僅供送件前初步分流，最後裁定權仍為本署人體研究倫理審查會。');

  return {
    review_type: finalReviewType,
    confidence: needsReview ? 'needs_review' : 'clear',
    suggested_exempt_category: finalReviewType === 'exempt' ? inferExemptCategory(dataUseTypes, specimenUseTypes) : undefined,
    reasons: unique(reasons),
    matched_rules: unique(matchedRules),
    warnings: unique(warnings),
  };
}
