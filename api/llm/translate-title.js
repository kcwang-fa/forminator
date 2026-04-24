// Vercel Serverless Function — 計畫名稱英文翻譯
import { callLlmJson, GEMINI_MODEL, GROQ_MODEL } from '../_lib/llm.js';

const SYSTEM_PROMPT = `你是一位公共衛生領域的學術翻譯專家。請將以下中文研究計畫名稱翻譯為英文。
要求：
1. 使用公共衛生／流行病學領域的標準學術英文術語
2. 疾病名稱依循 WHO/CDC 官方英文名稱
3. 採用 Title Case 格式
4. 僅輸出 JSON，不要輸出任何其他文字：{ "project_title_en": "..." }`;

const RESPONSE_SCHEMA = {
  name: 'translate_title',
  schema: {
    type: 'object',
    properties: {
      project_title_en: { type: 'string' },
    },
    required: ['project_title_en'],
    additionalProperties: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { project_title_zh, provider, apiKey } = req.body;
    if (!project_title_zh) return res.status(400).json({ error: '缺少計畫名稱' });
    if (!apiKey) return res.status(400).json({ error: '請先設定 API Key' });

    const userPrompt = `計畫名稱：${project_title_zh}`;

    const parsed = await callLlmJson(
      provider,
      apiKey,
      SYSTEM_PROMPT,
      userPrompt,
      RESPONSE_SCHEMA,
      { temperature: 0.3, maxTokens: 1024 },
    );

    res.json(parsed);
  } catch (err) {
    console.error('translate-title error:', err);
    res.status(500).json({
      error: `翻譯失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
      provider: providerLabel(req.body?.provider),
      model: req.body?.provider === 'gemini' ? GEMINI_MODEL : GROQ_MODEL,
    });
  }
}

function providerLabel(provider) {
  return provider === 'gemini' ? 'Gemini' : 'Groq';
}
