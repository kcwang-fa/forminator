// ===== 隱私保護三段「常用範例」（勾選帶入用）=====
//
// 文字忠於 source-templates/IRB-002-1 人體研究計畫申請表.docx 隱私段的「舉例」（研究中 3 / 結束後 4 /
// 中途退出 2）。Step4 的 IrbCommonFields 把它們做成可勾選清單：使用者勾要套用的範例 → 一鍵帶入對應
// 的 privacy_during / privacy_after / privacy_withdrawal 欄位 → 再手動調整（滿足「勾選後可手動調整」）。
//
// 注入 DOC-12 / DOC-5 的是最終的自由文字（privacy_*），不是這些範例本身——這裡只是「填寫輔助」。

import type { FormData, ReviewDataIdentifiability } from '../../../types/form';

export type PrivacySection = 'during' | 'after' | 'withdrawal';
export type PrivacyExampleLevel = 'recommended' | 'caution' | 'incompatible';

export interface PrivacyExample {
  section: PrivacySection;
  text: string;
  tags: string[];
  recommendedFor?: ReviewDataIdentifiability[];
  incompatibleFor?: ReviewDataIdentifiability[];
  requiresSpecimen?: boolean;
  forbidsSpecimen?: boolean;
  requiresContactOrRecruitment?: boolean;
  requiresNoContactOrRecruitment?: boolean;
  conflictGroup?: string;
  conflictValue?: string;
}

export const PRIVACY_EXAMPLES: PrivacyExample[] = [
  // (1) 研究中參與者之隱私保護
  {
    section: 'during',
    text: '依本署「防疫資料庫員工研究計畫使用申請作業說明」之規定，研究資料由資訊室執行擷取及去識別化作業，資訊室依本署ISMS資安規定之程序與表單，將資料交付申請者，研究者不會接觸到個資。',
    tags: ['去識別化資料庫'],
    recommendedFor: ['provider_deidentified_unidentifiable'],
    incompatibleFor: ['identifiable_or_linkable', 'public_or_legally_open'],
    forbidsSpecimen: true,
  },
  {
    section: 'during',
    text: '依本署「防疫資料庫員工研究計畫使用申請作業說明」之規定，研究資料涉及勾稽資科中心之署外單位資料，全案申請資料由資訊室將符合資科中心規定之加密檔案交付至資科中心，再依據資科中心相關規定，逕向資科中心提出申請，後續資料分析部分，依資科中心規定辦理，研究者不會持有資料亦不會接觸到個資。',
    tags: ['跨庫勾稽', '研究者不持有資料'],
    recommendedFor: ['provider_deidentified_unidentifiable', 'coded_researcher_unidentifiable'],
    incompatibleFor: ['identifiable_or_linkable', 'public_or_legally_open'],
    forbidsSpecimen: true,
  },
  {
    section: 'during',
    text: '依本署「驗餘檢體運用管理作業規範」之規定，驗餘檢體經檢體保管者或非執行計畫之相關人員完成匿名編碼、加密等去識別化處理後始進行統計分析，研究者無從辨識檢體提供者之個人資料、資訊。',
    tags: ['檢體', '匿名編碼'],
    recommendedFor: ['provider_deidentified_unidentifiable', 'coded_researcher_unidentifiable'],
    incompatibleFor: ['identifiable_or_linkable', 'public_or_legally_open'],
    requiresSpecimen: true,
  },
  // (2) 研究結束後參與者之隱私保護
  {
    section: 'after',
    text: '研究結束後若對外發表，所有資料將以群體分析結果取代個別資料，報告中絕不會揭露任何足以識別個人的資訊。',
    tags: ['成果揭露', '通用'],
  },
  {
    section: 'after',
    text: '研究結束後，將依計畫書/研究對象說明暨同意書中敘明之保存形式、保存期限及同意使用範圍，保留剩檢體或研究對象之個人隱私資料。',
    tags: ['有同意程序', '保存'],
    requiresContactOrRecruitment: true,
  },
  {
    section: 'after',
    text: '研究結束後，將依計畫書/研究對象說明暨同意書中敘明之銷毀機制，銷毀剩檢體或刪除研究對象之個人隱私資料。',
    tags: ['銷毀', '個資或檢體'],
  },
  {
    section: 'after',
    text: '本研究無收集檢體或個人隱私資料，計畫相關資料將保存至研究計畫結束後三年。',
    tags: ['無檢體', '無個資', '保存三年'],
    recommendedFor: ['provider_deidentified_unidentifiable', 'public_or_legally_open'],
    incompatibleFor: ['identifiable_or_linkable'],
    forbidsSpecimen: true,
  },
  // (3) 研究中途退出者之隱私保護
  {
    section: 'withdrawal',
    text: '研究資料/材料已完成去識別化始進行研究，技術上將無法抽離，但因其已不具個人識別性，研究對象之隱私仍受到保護。',
    tags: ['不可個別抽離', '已去識別化'],
    recommendedFor: ['provider_deidentified_unidentifiable', 'coded_researcher_unidentifiable'],
    incompatibleFor: ['identifiable_or_linkable', 'public_or_legally_open'],
    requiresNoContactOrRecruitment: true,
    conflictGroup: 'withdrawal-disposition',
    conflictValue: 'not-extractable',
  },
  {
    section: 'withdrawal',
    text: '將依研究對象意願，將已提供的研究材料與資料全數銷毀，不納入研究分析。',
    tags: ['可抽離銷毀', '有退出機制'],
    recommendedFor: ['coded_researcher_unidentifiable', 'identifiable_or_linkable'],
    requiresContactOrRecruitment: true,
    conflictGroup: 'withdrawal-disposition',
    conflictValue: 'destroy-on-withdrawal',
  },
];

export function assessPrivacyExample(
  example: PrivacyExample,
  data: Pick<FormData, 'review_screening' | 'recruit_subjects'>,
): { level: PrivacyExampleLevel; message: string } {
  const identifiability = data.review_screening.data_identifiability;
  const hasSpecimen = data.review_screening.specimen_use_types.length > 0;
  const hasContactOrRecruitment = data.review_screening.has_direct_subject_contact || data.recruit_subjects;

  if (example.requiresSpecimen && !hasSpecimen) {
    return { level: 'incompatible', message: '目前未勾選檢體研究，這段通常不適用。' };
  }
  if (example.forbidsSpecimen && hasSpecimen) {
    return { level: 'incompatible', message: '目前包含檢體，這段文字可能與研究內容矛盾。' };
  }
  if (identifiability && example.incompatibleFor?.includes(identifiability)) {
    return { level: 'incompatible', message: '這段文字與目前選擇的資料可識別性不一致。' };
  }
  if (example.requiresNoContactOrRecruitment && hasContactOrRecruitment) {
    return { level: 'incompatible', message: '目前涉及接觸或招募研究對象，不宜直接宣稱無法個別抽離。' };
  }
  if (example.requiresContactOrRecruitment && !hasContactOrRecruitment) {
    return { level: 'caution', message: '目前未勾選接觸或招募研究對象，請確認是否真的有同意或退出程序。' };
  }
  if (identifiability && example.recommendedFor?.includes(identifiability)) {
    return { level: 'recommended', message: '與目前資料可識別性相符，仍請核對實際流程。' };
  }
  if (!identifiability || identifiability === 'unknown') {
    return { level: 'caution', message: '資料可識別性尚未確認，請先核對再使用。' };
  }
  if (!example.recommendedFor && !example.incompatibleFor) {
    return { level: 'recommended', message: '屬通用範例，仍請依實際保存與銷毀方式調整。' };
  }
  return { level: 'caution', message: '未與目前條件直接衝突，但套用前仍需確認實際流程。' };
}

export function findPrivacyExampleConflict(
  selectedIndexes: Set<number>,
  candidateIndex: number,
): PrivacyExample | undefined {
  const candidate = PRIVACY_EXAMPLES[candidateIndex];
  if (!candidate?.conflictGroup || !candidate.conflictValue) return undefined;

  for (const index of selectedIndexes) {
    const selected = PRIVACY_EXAMPLES[index];
    if (
      selected.conflictGroup === candidate.conflictGroup
      && selected.conflictValue
      && selected.conflictValue !== candidate.conflictValue
    ) {
      return selected;
    }
  }
  return undefined;
}

// 三段的中文抬頭與對應的表單欄位名稱（IrbCommonFields 用來分組顯示 + 帶入時寫對欄位）。
export const PRIVACY_SECTION_META: Record<PrivacySection, { title: string; field: 'privacy_during' | 'privacy_after' | 'privacy_withdrawal' }> = {
  during:     { title: '研究中參與者之隱私保護', field: 'privacy_during' },
  after:      { title: '研究結束後參與者之隱私保護', field: 'privacy_after' },
  withdrawal: { title: '研究中途退出者之隱私保護', field: 'privacy_withdrawal' },
};
