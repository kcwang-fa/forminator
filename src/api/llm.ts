// ===== §4 LLM 輔助生成 — 前端呼叫 =====

import { getLLMSettings } from '../hooks/useLLMSettings';

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

async function readApiError(res: Response, fallback: string): Promise<string> {
  const err = await res.json().catch(() => ({ error: fallback }));
  const details = [
    err.error,
    err.provider ? `provider=${err.provider}` : '',
    err.model ? `model=${err.model}` : '',
  ].filter(Boolean);

  return details.length > 0 ? details.join(' | ') : fallback;
}

interface TranslateTitleResponse {
  project_title_en: string;
}

interface GenerateAbstractResponse {
  abstract_zh: string;
  abstract_en: string;
  keywords_zh: string;
  keywords_en: string;
}

interface GenerateDbPurposeResponse {
  field_purposes: Array<{
    field_name: string;
    apply_purpose: string;
  }>;
}

/**
 * Prompt A：計畫名稱英文翻譯
 */
export async function translateTitle(titleZh: string): Promise<TranslateTitleResponse> {
  const { provider, apiKey } = getLLMSettings();
  if (!apiKey) throw new Error('請先至「AI 設定」輸入 API Key');

  const res = await fetch(`${API_BASE}/llm/translate-title`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_title_zh: titleZh, provider, apiKey }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, `HTTP ${res.status}`));
  }
  return res.json();
}

/**
 * Prompt B：摘要與關鍵字生成
 */
export async function generateAbstract(params: {
  purpose: string;
  background: string;
  methodology: string;
  expected_outcome: string;
}): Promise<GenerateAbstractResponse> {
  const { provider, apiKey } = getLLMSettings();
  if (!apiKey) throw new Error('請先至「AI 設定」輸入 API Key');

  const res = await fetch(`${API_BASE}/llm/generate-abstract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, provider, apiKey }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '生成失敗'));
  }
  return res.json();
}

/**
 * Prompt C：DOC-8 申請目的生成
 */
export async function generateDbApplyPurpose(params: {
  purpose: string;
  methodology: string;
  apply_system_text: string;
  apply_condition: string;
  field_names: string[];
}): Promise<GenerateDbPurposeResponse> {
  const { provider, apiKey } = getLLMSettings();
  if (!apiKey) throw new Error('請先至「AI 設定」輸入 API Key');

  const res = await fetch(`${API_BASE}/llm/generate-db-purpose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, provider, apiKey }),
  });
  if (!res.ok) {
    throw new Error(await readApiError(res, '生成失敗'));
  }
  return res.json();
}
