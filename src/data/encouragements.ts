// ===== 加油打氣文案 =====
//
// 給疾管署公衛同仁填表時的鼓勵語。文案集中放這裡（同 stepConfigs.ts / planConfigs.ts 的慣例），
// 不要 inline 散落在 App.tsx，日後要改文字只動這一支檔。
//
// 口吻：溫暖陪伴、簡短。不走工程師梗（使用者是公衛人員不是工程師）。

/**
 * 依目前進度回傳一句鼓勵語（顯示在左側「目前進度」卡片）。
 *
 * @param currentStep 目前所在步驟，從 0 起算（與 useWizardNavigation 一致）
 * @param totalSteps  本次計畫實際顯示的總步數（隨勾選的成果類別變動，最少 1）
 *
 * 設計：用「完成比例」分四段，而不是寫死第幾步——因為步數會隨成果類別變動，
 * 用比例才能不管 3 步還是 6 步都對得上「剛開始 / 前段 / 後段 / 最後一步」。
 */
export function getProgressEncouragement(currentStep: number, totalSteps: number): string {
  // 剛進來、還沒往前走
  if (currentStep === 0) {
    return '表單很多，但別擔心，我們一格一格慢慢填。';
  }

  // ratio = 目前進度 / 最後一步的索引。
  // ⚠️ 只有一步（只勾 basic）時 totalSteps - 1 = 0，會除以零，
  //    所以用 Math.max(..., 1) 把分母至少墊到 1，避免 NaN。
  const lastStepIndex = Math.max(totalSteps - 1, 1);
  const ratio = currentStep / lastStepIndex;

  if (ratio >= 1) {
    return '最後一步了！一路走到這裡很不容易，準備收成你的研究成果吧。';
  }
  if (ratio >= 0.5) {
    return '已經過半囉，你比想像中更接近終點。';
  }
  return '節奏抓到了，繼續往下走就對了。';
}

/** 完成頁（文件準備完成）的慰勞句。 */
export const RESULT_ENCOURAGEMENT =
  '辛苦了！把繁雜的表單交給終結者，你就能把心力留給真正重要的事情。';
