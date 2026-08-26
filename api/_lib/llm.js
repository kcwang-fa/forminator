import { GoogleGenAI } from '@google/genai';

export const GROQ_MODEL = 'qwen/qwen3.6-27b';
export const GEMINI_MODEL = 'gemini-2.5-flash-lite';

function cleanGroqContent(content) {
  return content
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<think>[\s\S]*/g, '')
    .trim();
}

function buildErrorMessage(provider, error) {
  const message = error instanceof Error ? error.message : String(error);
  return `${provider} API 錯誤: ${message}`;
}

export async function callGroqJson(apiKey, systemPrompt, userPrompt, _schema, options = {}) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.3,
      max_tokens: options.maxTokens ?? 1024,
      response_format: { type: 'json_object' },
      // qwen3.6-27b 是 reasoning model，reasoning_format 預設 'raw' 會把
      // <think>...</think> 混進 content，跟 response_format: json_object
      // 同時使用時 Groq 會在伺服器端做 JSON 驗證直接 400（json_validate_failed）。
      // 設成 'hidden' 讓 content 只留最終輸出，繞過這個已知限制。
      reasoning_format: 'hidden',
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error('GROQ API error:', response.status, errBody);
    throw new Error(`HTTP ${response.status}${errBody ? ` - ${errBody}` : ''}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 回應為空');

  try {
    return JSON.parse(cleanGroqContent(content));
  } catch (error) {
    console.error('GROQ JSON parse error:', content);
    throw new Error(buildErrorMessage('Groq', error));
  }
}

export async function callGeminiJson(apiKey, systemPrompt, userPrompt, schema, options = {}) {
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        temperature: options.temperature ?? 0.3,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: 'application/json',
        responseSchema: schema.schema,
      },
    });

    const content = response.text;
    if (!content) throw new Error('LLM 回應為空');
    return JSON.parse(content);
  } catch (error) {
    console.error('Gemini API error:', error);
    throw new Error(buildErrorMessage('Gemini', error));
  }
}

export async function callLlmJson(provider, apiKey, systemPrompt, userPrompt, schema, options = {}) {
  if (provider === 'gemini') {
    return callGeminiJson(apiKey, systemPrompt, userPrompt, schema, options);
  }

  return callGroqJson(apiKey, systemPrompt, userPrompt, schema, options);
}
