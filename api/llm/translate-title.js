// Vercel Serverless Function — 計畫名稱英文翻譯
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
  const GROQ_MODEL = process.env.GROQ_MODEL || 'qwen/qwen3-32b';

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
        max_tokens: 200,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const parsed = JSON.parse(content);
    res.json(parsed);
  } catch (err) {
    console.error('translate-title error:', err);
    res.status(500).json({ error: '翻譯失敗' });
  }
}
