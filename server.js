// ===== Forminator API Proxy Server =====
// Railway 部署用：前端靜態檔 + LLM API proxy

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3-32b';

app.use(express.json());

// 靜態檔案（React build）
app.use(express.static(join(__dirname, 'dist')));

// §4.3 Prompt A：計畫名稱英文翻譯
app.post('/api/llm/translate-title', async (req, res) => {
  try {
    const { project_title_zh } = req.body;
    if (!project_title_zh) return res.status(400).json({ error: '缺少計畫名稱' });
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
            content: `你是一位公共衛生領域的學術翻譯專家。請將以下中文研究計畫名稱翻譯為英文。
要求：
1. 使用公共衛生／流行病學領域的標準學術英文術語
2. 疾病名稱依循 WHO/CDC 官方英文名稱
3. 採用 Title Case 格式
4. 僅輸出 JSON 格式：{ "project_title_en": "..." }`,
          },
          { role: 'user', content: `計畫名稱：${project_title_zh}` },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('GROQ API error:', response.status, errBody);
      return res.status(502).json({ error: `GROQ API 錯誤: ${response.status}` });
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('Empty LLM response:', JSON.stringify(data));
      return res.status(502).json({ error: 'LLM 回應為空' });
    }
    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'LLM 回應格式錯誤' });
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error('translate-title error:', err);
    res.status(500).json({ error: `翻譯失敗: ${err.message}` });
  }
});

// §4.3 Prompt B：摘要與關鍵字生成
app.post('/api/llm/generate-abstract', async (req, res) => {
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
}`,
          },
          {
            role: 'user',
            content: `研究目的：\n${purpose}\n\n背景分析：\n${background}\n\n研究方法：\n${methodology}\n\n預期成果：\n${expected_outcome}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('GROQ API error:', response.status, errBody);
      return res.status(502).json({ error: `GROQ API 錯誤: ${response.status}` });
    }
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      console.error('Empty LLM response:', JSON.stringify(data));
      return res.status(502).json({ error: 'LLM 回應為空' });
    }
    const cleaned = content.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>[\s\S]*/g, '').trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'LLM 回應格式錯誤' });
    const parsed = JSON.parse(jsonMatch[0]);
    res.json(parsed);
  } catch (err) {
    console.error('generate-abstract error:', err);
    res.status(500).json({ error: `生成失敗: ${err.message}` });
  }
});

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🤖 Forminator server running on port ${PORT}`);
});
