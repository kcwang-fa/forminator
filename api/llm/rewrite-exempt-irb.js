import { callLlmJson, GEMINI_MODEL, GROQ_MODEL } from '../_lib/llm.js';
import {
  EXEMPT_IRB_REWRITE_SCHEMA,
  EXEMPT_IRB_REWRITE_SYSTEM_PROMPT,
  buildExemptIrbRewritePrompt,
  validateExemptIrbRewriteRequest,
} from '../_lib/exempt-irb-rewrite.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const validationError = validateExemptIrbRewriteRequest(req.body);
    if (validationError) return res.status(400).json({ error: validationError });

    const { draft, guardrails, provider, apiKey } = req.body;
    const parsed = await callLlmJson(
      provider,
      apiKey,
      EXEMPT_IRB_REWRITE_SYSTEM_PROMPT,
      buildExemptIrbRewritePrompt(draft, guardrails),
      EXEMPT_IRB_REWRITE_SCHEMA,
      { temperature: 0.25, maxTokens: 2500 },
    );

    res.json(parsed);
  } catch (err) {
    console.error('rewrite-exempt-irb error:', err);
    res.status(500).json({
      error: `潤飾失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
      provider: providerLabel(req.body?.provider),
      model: req.body?.provider === 'gemini' ? GEMINI_MODEL : GROQ_MODEL,
    });
  }
}

function providerLabel(provider) {
  return provider === 'gemini' ? 'Gemini' : 'Groq';
}
