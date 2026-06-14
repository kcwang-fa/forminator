import type { ExemptIrbDraftText, FormData, ReviewDataIdentifiability, ReviewScreening } from '../types/form';

// ===== §4 IRB 文案輔助 =====
//
// 設計（拆除「免審文案小幫手」後）：
//   Step 4 不再有那塊重量級素材表單（exempt_irb_profile 已整批移除）。隱私保護三段改由
//   buildPrivacyDraftFromScreening() 從「審查類型小幫手」(review_screening) 已填的事實
//   ＋ 罐頭預設句生成（見 Step4IRB/index.tsx 的「帶入隱私保護草稿」按鈕）。
//   免審理由、研究方法各有自己的「帶入」按鈕；AI 潤飾仍可用（ExemptRewritePanel），
//   潤飾對象是主畫面五個文字欄位（免審理由 / 研究方法 / 隱私三段）。
//
// 隱私草稿不以審查類型猜測資料狀態。免審、簡審、一般審都先依可識別性、是否接觸／招募、
// 素材類型等事實生成；審查類型只影響 UI 與送件流程，不應讓草稿憑空宣稱「已去識別化」。

function ensureSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return /[。．.!！?？]$/.test(trimmed) ? trimmed : `${trimmed}。`;
}

function compactLines(lines: string[]) {
  return lines.map(line => ensureSentence(line)).filter(Boolean).join('');
}

// 素材情境：把勾選的資料／檢體類型歸成一個主要情境（資料庫 vs 病歷 vs 檢體 vs 公開資料…）。
// 素材本身只決定「用的是什麼」，不得用來反推資料一定已去識別化；可識別性另讀
// review_screening.data_identifiability。兩處草稿共用此分類，避免研究方法和隱私段互相矛盾。
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

const MATERIAL_PRIVACY_LEAD: Record<MaterialScenario, string> = {
  database: '本研究使用核准取得之既有資料庫資料',
  medical_record: '本研究使用核准取得之病歷資料',
  business_data: '本研究使用既有業務資料，未因研究額外增加未經核准之資料蒐集',
  specimen: '本研究使用核准取得之檢體或菌株及其相關資料，並依生物安全及實驗室管理規範保存與操作',
  public: '本研究使用依法公開且符合公開目的之資訊',
  new_data: '本研究依核定程序蒐集研究資料',
  generic: '本研究使用經核准之研究資料或材料',
};

const IDENTIFIABILITY_PRIVACY_LEAD: Record<ReviewDataIdentifiability, string> = {
  provider_deidentified_unidentifiable:
    '資料由提供單位完成去識別化後提供，研究團隊取得後無法辨識特定個人',
  coded_researcher_unidentifiable:
    '研究資料採匿名編碼，研究團隊執行研究時不持有編碼對照資訊，無法直接辨識特定個人；如需回連，應由有權限之單位依核准程序辦理',
  identifiable_or_linkable:
    '研究資料仍可能包含可識別或可回連資訊，僅蒐集研究目的所需之最小必要資料，並以權限控管、加密儲存及存取紀錄限制使用',
  public_or_legally_open:
    '資料為依法公開且符合公開目的之資訊，研究過程不另行蒐集非公開之可識別個人資料',
  unknown:
    '資料可識別性與回連方式尚待確認；正式送件前將依實際資料內容補充去識別化、編碼、存取權限及回連管理措施',
};

export interface PrivacyDraftAssessment {
  identifiabilityConfirmed: boolean;
  cautions: string[];
}

export function assessPrivacyDraftInputs(
  data: Pick<FormData, 'review_screening' | 'recruit_subjects'>,
): PrivacyDraftAssessment {
  const identifiability = data.review_screening.data_identifiability;
  const identifiabilityConfirmed = Boolean(identifiability && identifiability !== 'unknown');
  const cautions: string[] = [];

  if (!identifiabilityConfirmed) {
    cautions.push('資料可識別性尚未確認，草稿將使用中性文字；正式送件前請回 Step 1 補齊資料可識別性。');
  }
  if (identifiability === 'coded_researcher_unidentifiable') {
    cautions.push('匿名編碼不等於完全去連結；請確認編碼對照資訊由誰保管，以及研究團隊能否申請回連。');
  }
  if (identifiability === 'identifiable_or_linkable') {
    cautions.push('本案包含可識別或可回連資料，請確認最小必要欄位、存取人員、權限、保存期限及回連程序。');
  }
  if (data.review_screening.has_direct_subject_contact || data.recruit_subjects) {
    cautions.push('本案涉及接觸或招募研究對象，請確認告知、同意、退出及退出後資料處理方式。');
  }

  return { identifiabilityConfirmed, cautions };
}

function identifiabilityLead(identifiability: ReviewDataIdentifiability | ''): string {
  return IDENTIFIABILITY_PRIVACY_LEAD[identifiability || 'unknown'];
}

function buildWithdrawalText(data: FormData): string {
  const screening = data.review_screening;
  const identifiability = screening.data_identifiability;
  const hasContactOrRecruitment = screening.has_direct_subject_contact || data.recruit_subjects;

  if (!identifiability || identifiability === 'unknown') {
    return '資料可識別性及是否可回連尚待確認；中途退出與資料抽離機制應於正式送件前依實際流程補充。';
  }
  if (hasContactOrRecruitment || identifiability === 'identifiable_or_linkable') {
    return '如研究對象提出撤回或停止使用之請求，研究團隊將依核准程序處理尚可辨識及尚未納入整體分析之資料；已完成不可回連處理或已納入整體分析而無法個別抽離者，將依核准內容及相關法規辦理。';
  }
  if (identifiability === 'coded_researcher_unidentifiable') {
    return '如研究對象依法提出撤回或停止使用之請求，將由有權保管編碼對照資訊之單位依核准程序確認及辦理；資料完成不可回連處理後，將無法依個別研究對象抽離。';
  }
  if (identifiability === 'public_or_legally_open') {
    return '本研究使用依法公開之資料，且不直接接觸或招募研究對象，不涉及研究對象中途退出。';
  }
  return '研究團隊取得之資料已無法辨識或回連特定個人，且不直接接觸或招募研究對象，故無法依個別研究對象抽離資料。';
}

// 從「審查類型小幫手」已填內容生成隱私保護三段草稿。可識別性優先於素材類型：
// 素材只描述來源，可識別性才決定能否寫「已去識別化」、是否需要回連與退出機制。
export function buildPrivacyDraftFromScreening(
  data: FormData,
): Pick<ExemptIrbDraftText, 'privacy_during' | 'privacy_after' | 'privacy_withdrawal'> {
  const screening = data.review_screening;
  const scenario = inferMaterialScenario(screening);
  const identifiability = screening.data_identifiability;
  const hasContactOrRecruitment = screening.has_direct_subject_contact || data.recruit_subjects;
  const identifiable = identifiability === 'identifiable_or_linkable';
  const coded = identifiability === 'coded_researcher_unidentifiable';

  return {
    privacy_during: compactLines([
      MATERIAL_PRIVACY_LEAD[scenario],
      identifiabilityLead(identifiability),
      '研究期間資料儲存於符合本署資安規範之核准分析環境，僅限經授權之研究人員基於研究目的存取',
      screening.is_minimal_risk === true && scenario === 'new_data'
        ? '研究程序限於經核准之最低風險方式'
        : '',
      hasContactOrRecruitment ? '如涉及接觸或招募研究對象，將依核准內容進行告知、同意及權益保護' : '',
      '研究成果呈現時不揭露可識別個案之資訊。',
    ]),
    privacy_after: compactLines([
      '研究成果僅以群體統計、整體分析或無法辨識特定個人之方式呈現。',
      identifiable ? '可識別資訊與分析資料將依核准之權限及保存方式管理，非經授權不得存取或回連' : '',
      coded ? '編碼對照資訊由有權限之單位與研究分析資料分開管理' : '',
      // 檢體情境多一段檢體處置/銷毀；其餘資料情境用通用保存銷毀句。
      scenario === 'specimen'
        ? '檢體或菌株依生物安全及實驗室管理規範處置或銷毀，相關分析資料於計畫結束後依核定保存期限保存，屆滿後依機關資料銷毀程序辦理'
        : '研究資料於計畫結束後依核定保存期限保存，屆滿後依機關資料銷毀程序辦理',
    ]),
    privacy_withdrawal: buildWithdrawalText(data),
  };
}

// 各情境「研究方法及工具描述」(IRB-012 / DOC-5 的 data_source) 的草稿句。
// 設計：這格 tooltip 要的是「用什麼素材/工具、來源、數量、蒐集範圍」（≠ Step3 的 methodology＝分析步驟），
//   而「素材類型」剛好就在審查小幫手填的 review_screening 裡（與隱私三段同源），故 reuse inferMaterialScenario。
// 數量、蒐集範圍、年份、提供單位等「自動化猜不到」的具體值，一律留 ______（ASCII 底線）填空，
//   老實逼使用者補上——這正是舊版「複製 methodology」完全漏掉的部分。
// ⚠️ 填空只能用 ASCII 底線，不可用全形空格 U+3000（U+3000 進 template 字串會踩雷，見 project_step4_irb_redo）。
const DATA_SOURCE_LEAD: Record<MaterialScenario, string> = {
  database: '本研究使用疾管署______防疫資料庫之資料，資料範圍涵蓋______年至______年，約______筆。',
  medical_record: '本研究使用______提供之病歷資料，資料範圍涵蓋______年至______年，約______筆。',
  business_data: '本研究使用______既有業務資料，資料範圍涵蓋______年至______年，約______筆，未另行介入或蒐集。',
  specimen: '本研究使用______（如防疫業務剩餘檢體／菌株），來源為______，數量約______，蒐集範圍為______。',
  public: '本研究使用已合法公開之______資訊，來源為______，範圍涵蓋______。',
  new_data: '本研究以______（如問卷、量表、非侵入性測量）蒐集資料，預計收案約______人，蒐集範圍為______。',
  generic: '本研究使用之研究素材／工具為______，來源為______，數量約______，蒐集範圍為______。',
};

// 依審查小幫手已勾的素材類型，生成「研究方法及工具描述」草稿（單一字串，這格是單一 TextArea）。
// 帶入後使用者要把句中的 ______ 換成實際的數量、年份與蒐集範圍。
export function buildDataSourceDraftFromScreening(data: FormData): string {
  const screening = data.review_screening;
  const source = DATA_SOURCE_LEAD[inferMaterialScenario(screening)];
  const handling = identifiabilityLead(screening.data_identifiability);
  return compactLines([source, handling]);
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
