// ===== Forminator API Proxy Server =====
// Railway 部署用：前端靜態檔 + LLM API proxy

import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { callLlmJson, GEMINI_MODEL, GROQ_MODEL } from './api/_lib/llm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// 靜態檔案（React build）
app.use(express.static(join(__dirname, 'dist')));

function providerLabel(provider) {
  return provider === 'gemini' ? 'Gemini' : 'Groq';
}

// §4.3 Prompt A：計畫名稱英文翻譯
app.post('/api/llm/translate-title', async (req, res) => {
  try {
    const { project_title_zh, provider, apiKey } = req.body;
    if (!project_title_zh) return res.status(400).json({ error: '缺少計畫名稱' });
    if (!apiKey) return res.status(400).json({ error: '請先設定 API Key' });

    const systemPrompt = `你是一位公共衛生領域的學術翻譯專家。請將以下中文研究計畫名稱翻譯為英文。
要求：
1. 使用公共衛生／流行病學領域的標準學術英文術語
2. 疾病名稱依循 WHO/CDC 官方英文名稱
3. 採用 Title Case 格式
4. 僅輸出 JSON 格式：{ "project_title_en": "..." }`;
    const userPrompt = `計畫名稱：${project_title_zh}`;
    const responseSchema = {
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

    const parsed = await callLlmJson(
      provider,
      apiKey,
      systemPrompt,
      userPrompt,
      responseSchema,
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
});

// §4.3 Prompt B：摘要與關鍵字生成
app.post('/api/llm/generate-abstract', async (req, res) => {
  try {
    const { purpose, background, methodology, expected_outcome, provider, apiKey } = req.body;
    if (!purpose || !background || !methodology || !expected_outcome) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    if (!apiKey) return res.status(400).json({ error: '請先設定 API Key' });

    const systemPrompt = `你是一位公共衛生研究計畫撰寫助手，專門協助疾管署研究人員撰寫計畫摘要。
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
    const userPrompt = `研究目的：\n${purpose}\n\n背景分析：\n${background}\n\n研究方法：\n${methodology}\n\n預期成果：\n${expected_outcome}`;
    const responseSchema = {
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

    const parsed = await callLlmJson(
      provider,
      apiKey,
      systemPrompt,
      userPrompt,
      responseSchema,
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
});

// DOC-8：逐欄位申請目的生成
app.post('/api/llm/generate-db-purpose', async (req, res) => {
  try {
    const { purpose, methodology, apply_system_text, apply_condition, field_names, provider, apiKey } = req.body;
    if (!purpose || !methodology || !apply_system_text || !Array.isArray(field_names) || field_names.length === 0) {
      return res.status(400).json({ error: '缺少必要欄位' });
    }
    if (!apiKey) return res.status(400).json({ error: '請先設定 API Key' });

    const systemPrompt = `你是一位熟悉疾管署防疫資料庫申請文件的公衛研究計畫撰寫助手。
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

    const userPrompt = [
      `研究目的：\n${purpose}`,
      `研究方法／實施方法及進行步驟：\n${methodology}`,
      `申請系統：${apply_system_text}`,
      `擷取資料條件：${apply_condition || '未填寫'}`,
      `欄位名稱：\n${field_names.map((name, index) => `${index + 1}. ${name}`).join('\n')}`,
    ].join('\n\n');
    const responseSchema = {
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

    const parsed = await callLlmJson(
      provider,
      apiKey,
      systemPrompt,
      userPrompt,
      responseSchema,
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
});

// SPA fallback
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    return next();
  }

  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Forminator server running on port ${PORT}`);
});
