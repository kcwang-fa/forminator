import { callLlmJson, GEMINI_MODEL, GROQ_MODEL } from '../_lib/llm.js';

const SYSTEM_PROMPT = `你是一位熟悉疾管署防疫資料庫申請文件的公衛研究計畫撰寫助手。
請根據研究目的、研究方法／實施方法及進行步驟，以及本次申請的資料庫系統、資料條件與欄位，為每一個中文欄位名稱分別撰寫 DOC-8 的「申請目的」。

重要：
1. 所有中文內容必須使用繁體中文與台灣用語。
2. 每個欄位都要有不同的申請目的，不可整批複製同一句。
3. 文風要正式、精簡，符合公務申請文件。
4. 聚焦該欄位在研究分析中的用途，不要捏造未提供的方法。
5. 每個欄位的申請目的控制在 20 到 50 字。
6. 依輸入欄位順序輸出。
7. 僅輸出 JSON，不要輸出其他文字。

輸出格式：
{
  "field_purposes": [
    { "field_name": "...", "apply_purpose": "..." }
  ]
}`;

const RESPONSE_SCHEMA = {
  name: 'generate_db_purpose',
  schema: {
    type: 'object',
    properties: {
      field_purposes: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            field_name: { type: 'string' },
            apply_purpose: { type: 'string' },
          },
          required: ['field_name', 'apply_purpose'],
          additionalProperties: false,
        },
      },
    },
    required: ['field_purposes'],
    additionalProperties: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { purpose, methodology, apply_system_text, apply_condition, field_names, provider, apiKey } = req.body;
    if (!purpose || !methodology || !apply_system_text || !Array.isArray(field_names) || field_names.length === 0) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    if (!apiKey) return res.status(400).json({ error: '請先設定 API Key' });

    const userPrompt = [
      `研究目的：\n${purpose}`,
      `研究方法／實施方法及進行步驟：\n${methodology}`,
      `申請系統：${apply_system_text}`,
      `擷取資料條件：${apply_condition || '未填寫'}`,
      `欄位名稱：\n${field_names.map((name, index) => `${index + 1}. ${name}`).join('\n')}`,
    ].join('\n\n');

    const parsed = await callLlmJson(
      provider,
      apiKey,
      SYSTEM_PROMPT,
      userPrompt,
      RESPONSE_SCHEMA,
      { temperature: 0.4, maxTokens: 1200 },
    );

    res.json(parsed);
  } catch (err) {
    console.error('generate-db-purpose error:', err);
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
