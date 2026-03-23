// ===== §4 LLM 輔助生成 — 前端呼叫 =====

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

interface TranslateTitleResponse {
  project_title_en: string;
}

interface GenerateAbstractResponse {
  abstract_zh: string;
  abstract_en: string;
  keywords_zh: string;
  keywords_en: string;
}

/**
 * Prompt A：計畫名稱英文翻譯
 */
export async function translateTitle(titleZh: string): Promise<TranslateTitleResponse> {
  const res = await fetch(`${API_BASE}/llm/translate-title`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ project_title_zh: titleZh }),
  });
  if (!res.ok) throw new Error('翻譯失敗');
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
  const res = await fetch(`${API_BASE}/llm/generate-abstract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('生成失敗');
  return res.json();
}
