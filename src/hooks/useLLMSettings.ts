// ===== LLM Provider 設定 — localStorage 持久化 =====

import { useState, useCallback } from 'react';

export type LLMProvider = 'groq' | 'gemini';

export interface LLMSettings {
  provider: LLMProvider;
  apiKey: string;
}

const STORAGE_KEY = 'forminator_llm_settings';

function loadSettings(): LLMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.provider && parsed.apiKey) return parsed;
    }
  } catch { /* ignore */ }
  return { provider: 'groq', apiKey: '' };
}

function saveSettings(settings: LLMSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useLLMSettings() {
  const [settings, setSettingsState] = useState<LLMSettings>(loadSettings);

  const setSettings = useCallback((next: LLMSettings) => {
    setSettingsState(next);
    saveSettings(next);
  }, []);

  return { settings, setSettings };
}

export function getLLMSettings(): LLMSettings {
  return loadSettings();
}
