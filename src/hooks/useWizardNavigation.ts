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

  const enterResult = useCallback(() => setShowResult(true), []);
  const exitResult = useCallback(() => setShowResult(false), []);

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
