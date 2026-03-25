// Vercel Serverless Function — 計畫名稱英文翻譯
import { GoogleGenAI } from '@google/genai';

const SYSTEM_PROMPT = `你是一位公共衛生領域的學術翻譯專家。請將以下中文研究計畫名稱翻譯為英文。
要求：
1. 使用公共衛生／流行病學領域的標準學術英文術語
2. 疾病名稱依循 WHO/CDC 官方英文名稱
3. 採用 Title Case 格式
4. 僅輸出 JSON，不要輸出任何其他文字：{ "project_title_en": "..." }`;

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
      temperature: 0.3,
      max_tokens: 1024,
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
    const { project_title_zh, provider, apiKey } = req.body;
    if (!project_title_zh) return res.status(400).json({ error: '缺少計畫名稱' });
    if (!apiKey) return res.status(400).json({ error: '請先設定 API Key' });

    const userPrompt = `計畫名稱：${project_title_zh}`;

    let content;
    if (provider === 'gemini') {
      content = await callGemini(apiKey, userPrompt);
    } else {
      content = await callGroq(apiKey, userPrompt);
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('No JSON found in response:', content);
      return res.status(502).json({ error: 'LLM 回應格式錯誤', debug: content.substring(0, 500) });
    }
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error('translate-title error:', err);
    res.status(500).json({ error: `翻譯失敗: ${err.message}` });
  }
}
