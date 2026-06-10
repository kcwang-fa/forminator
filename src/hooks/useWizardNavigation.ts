// ===== 步驟導航 Hook =====

import { useState, useCallback } from 'react';

export function useWizardNavigation(totalSteps: number) {
  const [currentStep, setCurrentStep] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const next = useCallback(() => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  }, [currentStep, totalSteps]);

  const prev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
      window.scrollTo(0, 0);
    }
  }, [currentStep]);

  const goTo = useCallback((step: number) => {
    setCurrentStep(step);
  }, []);

  // 切換到生成結果頁 / 返回表單時，一併捲回頂端。
  // 為什麼：使用者通常是在「最後一步」這個很長的頁面底部按下「生成文件」，
  // 此時只切換畫面內容、捲動位置不會自動重設，會卡在頁面下方需要手動往上捲。
  // 與上面 next / prev 切步驟時的 scrollTo(0, 0) 是同一個道理，這裡補齊對稱行為。
  const enterResult = useCallback(() => {
    setShowResult(true);
    window.scrollTo(0, 0);
  }, []);
  const exitResult = useCallback(() => {
    setShowResult(false);
    window.scrollTo(0, 0);
  }, []);

  return {
    currentStep,
    showResult,
    next,
    prev,
    goTo,
    enterResult,
    exitResult,
    isFirst: currentStep === 0,
    isLast: currentStep === totalSteps - 1,
  };
}
