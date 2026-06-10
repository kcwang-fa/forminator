import type { ExemptIrbDraftText, FormData, ReviewDataIdentifiability, ReviewScreening } from '../types/form';

// ===== §4 免審 IRB 文案輔助 =====
//
// 設計（拆除「免審文案小幫手」後）：
//   Step 4 不再有那塊重量級素材表單（exempt_irb_profile 已整批移除）。隱私保護三段改由
//   buildPrivacyDraftFromScreening() 從「審查類型小幫手」(review_screening) 已填的事實
//   ＋ 罐頭預設句生成（見 Step4IRB/index.tsx 的「帶入隱私保護草稿」按鈕）。
//   免審理由、研究方法各有自己的「帶入」按鈕；AI 潤飾仍可用（ExemptRewritePanel），
//   潤飾對象是主畫面五個文字欄位（免審理由 / 研究方法 / 隱私三段）。

function ensureSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[。．.!！?？]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function compactLines(lines: string[]) {
  return lines.map(line => ensureSentence(line)).filter(Boolean).join('');
}

// 審查小幫手中，只有「資料可識別性 = 可識別或可回連」才認定研究團隊會接觸到可識別個資；
// 其餘（去個資、匿名編碼、公開、未確認）都視為不接觸可識別個資。
function researcherAccessesPersonalData(identifiability: ReviewDataIdentifiability | ''): boolean {
  return identifiability === 'identifiable_or_linkable';
}

// 素材情境：把勾選的資料／檢體類型歸成一個主要情境（資料庫 vs 病歷 vs 檢體 vs 公開資料…）。
// 免審常見的素材各有不同講法，先分類再套對應描述，是讓草稿「會隨素材不同而不同」的關鍵。
// 隱私三段（PRIVACY_DURING_LEAD）與研究方法及工具（DATA_SOURCE_LEAD）兩處共用此分類，故命名為「素材」而非「隱私」。
type MaterialScenario = 'specimen' | 'medical_record' | 'database' | 'business_data' | 'public' | 'new_data' | 'generic';

// 從勾選的資料／檢體類型推主要情境。多選時取「最具體者優先」：檢體 > 病歷 > 資料庫 > 業務 > 公開 > 新收 > 通用。
function inferMaterialScenario(screening: ReviewScreening): MaterialScenario {
  const dataTypes = screening.data_use_types || [];
  const specimenTypes = screening.specimen_use_types || [];

  if (specimenTypes.length > 0) return 'specimen';
  if (dataTypes.includes('medical_record')) return 'medical_record';
  if (dataTypes.includes('deidentified_database')) return 'database';
  if (dataTypes.includes('business_data')) return 'business_data';
  if (dataTypes.some((t) =>
    t === 'public_info' || t === 'public_non_interactive_observation'
    || t === 'public_policy_evaluation' || t === 'education_evaluation')) return 'public';
  if (dataTypes.some((t) =>
    t === 'minimal_risk_new_data' || t === 'noninvasive_measurement'
    || t === 'behavior_or_trait' || t === 'recording_or_image')) return 'new_data';
  return 'generic';
}

// 各情境「研究中」隱私保護的開頭描述（資料如何去識別化／不接觸個人）。
const PRIVACY_DURING_LEAD: Record<MaterialScenario, string> = {
  database: '本研究使用之資料由資料提供單位去識別化後提供，研究團隊取得後無法辨識特定個人',
  medical_record: '本研究向醫療院所申請之病歷資料已去識別化，研究團隊不直接接觸個案',
  business_data: '本研究使用既有業務資料，未新增介入或額外蒐集，並以去識別化方式處理',
  specimen: '本研究使用之檢體或菌株無法回溯辨識特定個人，並依生物安全及實驗室管理規範保存與操作',
  public: '本研究使用已合法公開或不記名之資訊，無從辨識特定個人，過程不蒐集可識別個資',
  new_data: '本研究以最低風險方式蒐集資料，並以匿名或編碼處理，使研究執行時無法辨識特定個人',
  generic: '研究團隊不接觸可直接識別個人之資料',
};

// 從「審查類型小幫手」已填內容生成 IRB-012 隱私保護三段草稿：
//   ① 依「素材類型」決定開頭去識別化講法（PRIVACY_DURING_LEAD + 檢體的特殊銷毀講法）；
//   ② 用「是否接觸個案 / 是否接觸可識別個資」修飾存取描述與撤回段落。
// 儲存位置等仍用通用預設句（拆掉文案小幫手後不再有結構化輸入欄），使用者帶入後可再手動改具體值。
export function buildPrivacyDraftFromScreening(
  data: FormData,
): Pick<ExemptIrbDraftText, 'privacy_during' | 'privacy_after' | 'privacy_withdrawal'> {
  const screening = data.review_screening;
  const scenario = inferMaterialScenario(screening);
  const hasContact = screening.has_direct_subject_contact;
  const accessesPersonal = researcherAccessesPersonalData(screening.data_identifiability);
  const needsWithdrawal = hasContact || accessesPersonal;

  return {
    privacy_during: compactLines([
      PRIVACY_DURING_LEAD[scenario],
      '研究期間資料儲存於符合本署資安規範之核准分析環境，僅限經授權之研究人員基於研究目的存取',
      // 只有會接觸可識別個資時才補最小必要原則句；不接觸的情境寫了反而冗贅。
      accessesPersonal ? '若需接觸可識別資料，將依最小必要原則、權限控管及保密義務辦理' : '',
      // 有直接接觸研究對象時，補上告知與權益保護。
      hasContact ? '如涉及接觸研究對象，將事先告知並採取研究對象權益保護措施' : '',
      '研究成果呈現時不揭露可識別個案之資訊。',
    ]),
    privacy_after: compactLines([
      '研究成果僅以群體統計、整體分析或無法辨識特定個人之方式呈現。',
      // 檢體情境多一段檢體處置/銷毀；其餘資料情境用通用保存銷毀句。
      scenario === 'specimen'
        ? '檢體或菌株依生物安全及實驗室管理規範處置或銷毀，相關分析資料於計畫結束後依核定保存期限保存，屆滿後依機關資料銷毀程序辦理'
        : '研究資料於計畫結束後依核定保存期限保存，屆滿後依機關資料銷毀程序辦理',
    ]),
    // 有接觸個案或會接觸可識別個資 → 提供撤回機制；否則屬不可回連次級資料，無中途退出情形。
    privacy_withdrawal: needsWithdrawal
      ? '如研究對象依法提出撤回或停止使用之請求，研究團隊將依核准程序及相關法規辦理。'
      : '本研究使用無法辨識特定個人之次級資料，且不直接接觸研究對象，故無中途退出之情形。',
  };
}

// 各情境「研究方法及工具描述」(IRB-012 / DOC-5 的 data_source) 的草稿句。
// 設計：這格 tooltip 要的是「用什麼素材/工具、來源、數量、蒐集範圍」（≠ Step3 的 methodology＝分析步驟），
//   而「素材類型」剛好就在審查小幫手填的 review_screening 裡（與隱私三段同源），故 reuse inferMaterialScenario。
// 數量、蒐集範圍、年份、提供單位等「自動化猜不到」的具體值，一律留 ______（ASCII 底線）填空，
//   老實逼使用者補上——這正是舊版「複製 methodology」完全漏掉的部分。
// ⚠️ 填空只能用 ASCII 底線，不可用全形空格 U+3000（U+3000 進 template 字串會踩雷，見 project_step4_irb_redo）。
const DATA_SOURCE_LEAD: Record<MaterialScenario, string> = {
  database: '本研究使用疾管署______防疫資料庫之去識別化資料，資料範圍涵蓋______年至______年，約______筆。',
  medical_record: '本研究使用______提供之去識別化病歷資料，資料範圍涵蓋______年至______年，約______筆。',
  business_data: '本研究使用______既有業務資料，資料範圍涵蓋______年至______年，約______筆，未另行介入或蒐集。',
  specimen: '本研究使用______（如防疫業務剩餘檢體／菌株），來源為______，數量約______，蒐集範圍為______。',
  public: '本研究使用已合法公開之______資訊，來源為______，範圍涵蓋______。',
  new_data: '本研究以______（如問卷、量表、非侵入性測量）蒐集資料，預計收案約______人，蒐集範圍為______。',
  generic: '本研究使用之研究素材／工具為______，來源為______，數量約______，蒐集範圍為______。',
};

// 依審查小幫手已勾的素材類型，生成「研究方法及工具描述」草稿（單一字串，這格是單一 TextArea）。
// 帶入後使用者要把句中的 ______ 換成實際的數量、年份與蒐集範圍。
export function buildDataSourceDraftFromScreening(data: FormData): string {
  return DATA_SOURCE_LEAD[inferMaterialScenario(data.review_screening)];
}

// AI 潤飾的 guardrails：把「潤飾不可違背的事實」帶給後端當 context（後端只把它放進 prompt，不要求固定 key）。
// 來源改為 review_screening + 主表單欄位（不再依賴已移除的 exempt_irb_profile）。
export function buildExemptIrbRewriteGuardrails(data: FormData) {
  const screening = data.review_screening;
  return {
    review_type: data.review_type,
    exempt_category: data.exempt_category,
    data_identifiability: screening.data_identifiability,
    has_direct_contact: screening.has_direct_subject_contact,
    has_interaction: data.interact_subjects,
    inclusion_criteria: data.inclusion_criteria,
    exclusion_criteria: data.exclusion_criteria,
  };
}

// reviewClassifier 的判斷理由（decision.reasons）結尾常帶分流結論口吻，
// 例如「…無法辨識特定個人，原則上可列免予審查。」。把這串理由帶進「免審理由」欄位時，
// 這種「可列免予審查／屬簡易審查」的判斷語句讀起來像系統分流結論、不像研究者自述的免審理由，
// 故先濾掉，只留前面的資料／情境描述。
const VERDICT_PHRASES = [
  '原則上可列免予審查',
  '可列免予審查',
  '原則上屬簡易審查',
  '需人工確認或從嚴審查',
  '需從嚴審查',
  '建議先以一般審查或人工確認處理',
  '不宜判為免審',
];

function stripVerdictTone(reason: string): string {
  let s = reason.trim();
  for (const phrase of VERDICT_PHRASES) {
    const idx = s.indexOf(phrase);
    if (idx >= 0) {
      // 砍掉判斷語句本身，連同它前面的逗號一起去掉
      s = s.slice(0, idx);
      break;
    }
  }
  s = s.replace(/[，、。.\s]+$/, '');

  // 部分理由是條件句「…，若<條件>，原則上可列免予審查。」，前段為描述、後段為結論。
  // 上面只砍掉結論（後段），會留下懸空的「若<條件>。」讀起來不完整。
  // 對免審理由而言，研究者是「主張」自己符合這些條件（而非「假設」），故把條件語氣的
  // 「若」去掉，轉成肯定陳述。classifier 理由中的「若」只出現在這種條件判斷結構，可安全移除。
  s = s.replace(/若/g, '');

  return s ? `${s}。` : '';
}

// 把審查類型小幫手的判斷理由整理成可直接放進「免審理由」欄位的文字（去判斷口吻後串接）。
export function buildExemptReasonFromDecision(reasons: string[]): string {
  return reasons.map(stripVerdictTone).filter(Boolean).join('');
}

export function validateExemptIrbRewrite(original: ExemptIrbDraftText, rewritten: ExemptIrbDraftText) {
  const cautions: string[] = [];
  const fields: Array<keyof ExemptIrbDraftText> = [
    'exempt_reason',
    'data_source',
    'privacy_during',
    'privacy_after',
    'privacy_withdrawal',
  ];

  fields.forEach((field) => {
    if (!rewritten[field]?.trim()) {
      cautions.push(`${field} 改寫結果為空，請勿套用。`);
    }
  });

  const originalText = Object.values(original).join('\n');
  const rewrittenText = Object.values(rewritten).join('\n');

  if (originalText.includes('無法辨識特定個人') && !rewrittenText.includes('無法辨識特定個人')) {
    cautions.push('原文包含「無法辨識特定個人」，AI 改寫後未保留，套用前請確認。');
  }

  if (!originalText.includes('去連結') && rewrittenText.includes('去連結')) {
    cautions.push('AI 改寫出現「去連結」；若本案只是匿名編碼或去個資，請勿直接套用。');
  }

  if (originalText.includes('不接觸可直接識別個人') && !rewrittenText.includes('不接觸')) {
    cautions.push('原文強調研究團隊不接觸可識別個資，AI 改寫後語意可能變弱，請確認。');
  }

  return cautions;
}
