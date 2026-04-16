// ===== 步驟導航 Hook =====

import { useState, useCallback } from 'react';

const TOTAL_STEPS = 6;

export function useWizardNavigation() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showResult, setShowResult] = useState(false);

  const next = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setCurrentStep(currentStep + 1);
      window.scrollTo(0, 0);
    }
  }, [currentStep]);

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
    isLast: currentStep === TOTAL_STEPS - 1,
  };
}
