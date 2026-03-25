// Vercel Serverless Function — 摘要與關鍵字生成
import { GoogleGenAI } from '@google/genai';

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

async function callGroq(apiKey, userPrompt) {
  const model = 'qwen/qwen3-32b';
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.5,
      max_tokens: 2000,
    }),
  });
  if (!response.ok) {
    const errBody = await response.text();
    console.error('GROQ API error:', response.status, errBody);
    throw new Error(`Groq API 錯誤: ${response.status}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 回應為空');
  return content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '').trim();
}

async function callGemini(apiKey, userPrompt) {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-lite-preview',
    config: {
      systemInstruction: SYSTEM_PROMPT,
    },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
  });
  const content = response.text;
  if (!content) throw new Error('LLM 回應為空');
  return content.trim();
}

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

    let content;
    if (provider === 'gemini') {
      content = await callGemini(apiKey, userPrompt);
    } else {
      content = await callGroq(apiKey, userPrompt);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      return res.status(502).json({ error: 'LLM 回應格式錯誤' });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error('generate-abstract error:', err);
    res.status(500).json({ error: `生成失敗: ${err.message}` });
  }
}
