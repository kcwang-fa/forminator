import type {
  ExemptCategory,
  ReviewDataUseType,
  ReviewDecision,
  ReviewScreening,
  ReviewSpecimenUseType,
  ReviewType,
} from '../types/form';

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  exempt: '免予審查',
  expedited: '簡易審查',
  full: '一般審查',
};

const REVIEW_RANK: Record<ReviewType, number> = {
  exempt: 1,
  expedited: 2,
  full: 3,
};

const VULNERABLE_WARNING = '研究對象包含易受傷害族群或免審先決條件排除族群，免審判斷需從嚴處理。';

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

  const setReviewType = (nextType: ReviewType, reason: string, rule: string, warning?: string) => {
    if (!reviewType || REVIEW_RANK[nextType] > REVIEW_RANK[reviewType]) {
      reviewType = nextType;
    }
    reasons.push(reason);
    matchedRules.push(rule);
    if (warning) warnings.push(warning);
  };

  const hasVulnerablePopulation = screening.vulnerable_populations.length > 0;
  const hasHivRecord = screening.vulnerable_populations.includes('hiv_positive');
  const hasSensitiveExistingGroup = hasAny(screening.vulnerable_populations, [
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
  ]);

  if (screening.has_high_risk_procedure) {
    setReviewType(
      'full',
      '涉及高風險、人體試驗或需要安全性監測的處置，應採一般審查。',
      '新案審查說明：高風險或人體試驗範圍計畫需提報安全性監測計畫。',
    );
  }

  if (screening.has_discrimination_risk) {
    setReviewType(
      'full',
      '研究可能造成個人或族群歧視風險，不符合簡易審查表列的低風險行為研究條件。',
      '新案審查類型評檢表：研究個人或群體特質或行為之簡易審查，不含造成歧視之潛在可能者。',
    );
  }

  if (screening.has_other_irb_approval) {
    setReviewType(
      'expedited',
      '多中心研究已取得其他中心合法審查會同意證明，可列為簡易審查判斷依據。',
      '新案審查類型評檢表：多中心研究計畫已取得其他中心合法審查會之同意證明。',
    );
  }

  dataUseTypes.forEach((type) => {
    switch (type) {
      case 'education_evaluation':
        setReviewType(
          'exempt',
          '於一般教學環境中進行教育評量、測試、教學技巧或成效評估，原則上可列免予審查。',
          '新案審查類型評檢表：一般教學環境中之教育評量或教學成效研究。',
        );
        break;
      case 'public_policy_evaluation':
        setReviewType(
          'exempt',
          '公務機關執行法定職務所進行的公共政策成效評估研究，原則上可列免予審查。',
          '新案審查類型評檢表：公務機關執行法定職務之公共政策成效評估研究。',
        );
        break;
      case 'public_non_interactive_observation':
        setReviewType(
          'exempt',
          '於公開場合進行非記名、非互動且非介入性研究，且無從辨識特定個人，原則上可列免予審查。',
          '新案審查類型評檢表：公開場合非記名、非互動且非介入性研究。',
        );
        break;
      case 'minimal_risk_new_data':
        setReviewType(
          screening.is_minimal_risk === false ? 'full' : 'exempt',
          screening.is_minimal_risk === false
            ? '使用新收集資料但研究風險高於最低風險，不宜判為免審。'
            : '新收集資料若屬最低風險，且研究對象風險不高於未參加者，原則上可列免予審查。',
          '新案審查類型評檢表：研究計畫屬最低風險且風險不高於未參加者。',
        );
        break;
      case 'noninvasive_measurement':
        setReviewType(
          'expedited',
          '使用非侵入性方法收集資料，原則上屬簡易審查。',
          '新案審查類型評檢表：非侵入性方法收集資料。',
        );
        break;
      case 'behavior_or_trait':
        setReviewType(
          'expedited',
          '研究個人或群體特質或行為，且未標示歧視風險，原則上屬簡易審查。',
          '新案審查類型評檢表：研究個人或群體特質或行為。',
        );
        break;
      case 'recording_or_image':
        setReviewType(
          screening.recording_is_identifiable_or_sensitive ? 'full' : 'expedited',
          screening.recording_is_identifiable_or_sensitive
            ? '研究使用錄音、錄影或影像資料，且可能識別個人或影響工作、保險、財務及社會關係，需從嚴審查。'
            : '以研究為目的蒐集錄音、錄影或影像資料，且未標示可識別或敏感影響，原則上屬簡易審查。',
          '新案審查類型評檢表：以研究為目的所蒐集之錄音、錄影或影像資料。',
        );
        break;
      case 'deidentified_database':
        if (screening.data_identifiability === 'provider_deidentified_unidentifiable') {
          setReviewType(
            'exempt',
            '申請防疫資料庫、衛福資料科學中心、健保資料庫等資料，且由資料提供單位去個資、研究者無法辨識特定個人，原則上可列免予審查。',
            '新案審查類型評檢表：資料提供單位去個資且無法辨識特定個人之資料庫分析。',
          );
        } else {
          setReviewType(
            'full',
            '使用資料庫資料但尚未確認由資料提供單位去個資且無法辨識特定個人，需人工確認或從嚴審查。',
            '新案審查類型評檢表：免審資料庫分析須經資料提供單位去個資且無法辨識特定個人。',
            '若只是研究團隊自行匿名編碼，請勿寫成「去連結」；新案審查說明特別提醒這個名詞差異。',
          );
          needsReview = true;
        }
        break;
      case 'medical_record':
        if (
          screening.data_identifiability === 'provider_deidentified_unidentifiable' &&
          !screening.has_direct_subject_contact &&
          !hasVulnerablePopulation
        ) {
          setReviewType(
            'exempt',
            '向醫療院所申請之病歷資料若已由該單位提供為無法辨識特定個人，且無直接接觸個案資料，原則上可列免予審查。',
            '新案審查類型評檢表：醫療院所提供無法辨識特定個人且無直接接觸之病歷資料。',
          );
        } else if (hasHivRecord) {
          setReviewType(
            'full',
            '使用 HIV 陽性患者病歷不屬於簡易審查表列病歷研究範圍，需從嚴審查。',
            '新案審查類型評檢表：使用臨床常規治療或診斷病歷之簡易審查，不含 HIV 陽性患者病歷。',
          );
        } else {
          setReviewType(
            'expedited',
            '使用臨床常規治療或診斷之病歷，且未標示 HIV 陽性患者病歷，原則上屬簡易審查。',
            '新案審查類型評檢表：使用臨床常規治療或診斷之病歷，含個案報告。',
          );
        }
        break;
      case 'business_data':
        if (screening.is_minimal_risk && screening.data_identifiability !== 'identifiable_or_linkable') {
          setReviewType(
            'exempt',
            '直接使用既有業務蒐集資料進行研究，若屬最低風險且資料隱私保護措施清楚，原則上可列免予審查。',
            '新案審查類型評檢表：直接使用執行業務所蒐集資料，須敘明最低風險及資料隱私保護措施。',
          );
        } else {
          setReviewType(
            'full',
            '使用既有業務資料但未符合最低風險或資料仍可識別，需人工確認或從嚴審查。',
            '新案審查類型評檢表：業務資料免審須清楚敘明最低風險與資料隱私保護措施。',
          );
          needsReview = true;
        }
        break;
      case 'public_info':
        setReviewType(
          'exempt',
          '使用已合法公開週知之資訊，且符合其公開週知目的，原則上可列免予審查。',
          '新案審查類型評檢表：使用已合法公開週知之資訊。',
        );
        break;
      case 'other_existing_data':
      case 'other_new_data':
        setReviewType(
          'full',
          '研究資料或新收案方式不屬於目前表列免審或簡易審查情境，建議先以一般審查或人工確認處理。',
          '新案審查類型評檢表：不符合以上者，請送一般審查。',
        );
        needsReview = true;
        break;
    }
  });

  specimenUseTypes.forEach((type) => {
    switch (type) {
      case 'limited_blood_draw':
        setReviewType(
          'expedited',
          '新收集血液檢體且符合成年人、採血量與頻率限制，原則上屬簡易審查。',
          '新案審查類型評檢表：自成年人收集血液檢體之採血量與頻率限制。',
        );
        break;
      case 'new_noninvasive_specimen':
        setReviewType(
          'expedited',
          '僅以非侵入性方法採集研究用人體檢體，原則上屬簡易審查。',
          '新案審查類型評檢表：非侵入性方法採集研究用人體檢體。',
        );
        break;
      case 'cdc_residual_specimen':
        setReviewType(
          screening.is_minimal_risk === false ? 'full' : 'exempt',
          screening.is_minimal_risk === false
            ? '使用防疫驗餘檢體但研究風險高於最低風險，不宜判為免審。'
            : '僅使用防疫驗餘檢體，且符合傳染病防治法與最低風險條件，原則上可列免予審查。',
          '新案審查類型評檢表：使用防疫驗餘檢體且符合傳染病防治法與最低風險。',
        );
        break;
      case 'remaining_specimen_original_consent':
        setReviewType(
          'expedited',
          '使用剩餘檢體且符合檢體提供者原先同意範圍，原則上屬簡易審查。',
          '新案審查類型評檢表：使用剩餘檢體且符合原先同意使用範圍。',
        );
        break;
      case 'external_remaining_specimen_original_consent':
        setReviewType(
          'expedited',
          '使用外單位剩餘檢體且符合檢體提供者原先同意範圍，原則上屬簡易審查。',
          '新案審查類型評檢表：使用外單位剩餘檢體且符合原先同意使用範圍。',
        );
        break;
      case 'legal_biobank_unlinkable':
        setReviewType(
          'expedited',
          '自合法人體生物資料庫取得去連結或無法辨識特定個人之檢體，原則上屬簡易審查。',
          '新案審查類型評檢表：合法人體生物資料庫之去連結或無法辨識檢體。',
        );
        break;
      case 'cdc_residual_non_original_with_clinical_report':
        setReviewType(
          'expedited',
          '使用防疫驗餘檢體進行非原通報疾病檢驗且需核發檢驗報告至臨床端，原則上屬簡易審查，並應取得知情同意書。',
          '新案審查類型評檢表：防疫驗餘檢體進行非原通報疾病檢驗且核發臨床報告。',
          '此情境應取得檢體提供者之知情同意書。',
        );
        break;
      case 'strain_or_virus':
        setReviewType(
          'exempt',
          '使用醫療院所依防疫需求送回本署之菌株或病毒株，原則上可列免予審查。',
          '新案審查類型評檢表：使用醫療院所依防疫需求送回本署之菌株/病毒株。',
        );
        break;
      case 'other_specimen':
        setReviewType(
          'full',
          '檢體使用方式不屬於目前表列免審或簡易審查情境，建議先以一般審查或人工確認處理。',
          '新案審查類型評檢表：不符合以上者，請送一般審查。',
        );
        needsReview = true;
        break;
    }
  });

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

  let finalReviewType = reviewType as ReviewType | null;

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

  finalReviewType = reviewType as ReviewType | null;

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
