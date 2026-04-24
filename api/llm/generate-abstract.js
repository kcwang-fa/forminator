// Vercel Serverless Function — 摘要與關鍵字生成
import { callLlmJson, GEMINI_MODEL, GROQ_MODEL } from '../_lib/llm.js';

const SYSTEM_PROMPT = `你是一位公共衛生研究計畫撰寫助手，專門協助疾管署研究人員撰寫計畫摘要。
請根據以下研究內容，生成中文摘要、英文摘要、中文關鍵詞與英文關鍵詞。

重要：所有中文內容必須使用「繁體中文」與「台灣用語」（例如：資料庫而非数据库、軟體而非软件、程式而非程序）。

要求：
1. 中文摘要：300-500 字，繁體中文，一段式，結構為「背景→目的→方法→預期成果」
2. 英文摘要：基於中文摘要翻譯，150-300 words，結構為 Background→Objective→Methods→Expected results
3. 中文關鍵詞：3-6 個，繁體中文，以頓號分隔，優先使用 MeSH 中文對照
4. 英文關鍵詞：對應中文關鍵詞，使用 MeSH 標準詞彙

輸出格式（JSON）：
{
  "abstract_zh": "...",
  "abstract_en": "...",
  "keywords_zh": "...",
  "keywords_en": "..."
}`;

const RESPONSE_SCHEMA = {
  name: 'generate_abstract',
  schema: {
    type: 'object',
    properties: {
      abstract_zh: { type: 'string' },
      abstract_en: { type: 'string' },
      keywords_zh: { type: 'string' },
      keywords_en: { type: 'string' },
    },
    required: ['abstract_zh', 'abstract_en', 'keywords_zh', 'keywords_en'],
    additionalProperties: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { purpose, background, methodology, expected_outcome, provider, apiKey } = req.body;
    if (!purpose || !background || !methodology || !expected_outcome) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    if (!apiKey) return res.status(400).json({ error: '請先設定 API Key' });

    const userPrompt = `研究目的：\n${purpose}\n\n背景分析：\n${background}\n\n研究方法：\n${methodology}\n\n預期成果：\n${expected_outcome}`;

    const parsed = await callLlmJson(
      provider,
      apiKey,
      SYSTEM_PROMPT,
      userPrompt,
      RESPONSE_SCHEMA,
      { temperature: 0.5, maxTokens: 2000 },
    );

    res.json(parsed);
  } catch (err) {
    console.error('generate-abstract error:', err);
    res.status(500).json({
      error: `生成失敗: ${err instanceof Error ? err.message : '未知錯誤'}`,
      provider: providerLabel(req.body?.provider),
      model: req.body?.provider === 'gemini' ? GEMINI_MODEL : GROQ_MODEL,
    });
  }
}

function providerLabel(provider) {
  return provider === 'gemini' ? 'Gemini' : 'Groq';
}
