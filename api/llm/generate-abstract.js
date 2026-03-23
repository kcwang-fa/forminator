// Vercel Serverless Function — 摘要與關鍵字生成
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3-32b';

  try {
    const { purpose, background, methodology, expected_outcome } = req.body;
    if (!purpose || !background || !methodology || !expected_outcome) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    if (!GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY 未設定' });

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: `你是一位公共衛生研究計畫撰寫助手，專門協助疾管署研究人員撰寫計畫摘要。
請根據以下研究內容，生成中文摘要、英文摘要、中文關鍵詞與英文關鍵詞。

要求：
1. 中文摘要：300-500 字，一段式，結構為「背景→目的→方法→預期成果」
2. 英文摘要：基於中文摘要翻譯，150-300 words，結構為 Background→Objective→Methods→Expected results
3. 中文關鍵詞：3-6 個，以頓號分隔，優先使用 MeSH 中文對照
4. 英文關鍵詞：對應中文關鍵詞，使用 MeSH 標準詞彙

輸出格式（JSON）：
{
  "abstract_zh": "...",
  "abstract_en": "...",
  "keywords_zh": "...",
  "keywords_en": "..."
}`,
          },
          {
            role: 'user',
            content: `研究目的：\n${purpose}\n\n背景分析：\n${background}\n\n研究方法：\n${methodology}\n\n預期成果：\n${expected_outcome}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err) {
    console.error('generate-abstract error:', err);
    res.status(500).json({ error: '生成失敗' });
  }
}
