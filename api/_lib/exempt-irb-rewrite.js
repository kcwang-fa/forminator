export const EXEMPT_IRB_REWRITE_SYSTEM_PROMPT = `你是一位熟悉台灣公衛研究與疾管署 IRB 免審文件的文稿潤飾助手。
你的任務是將使用者提供的 IRB 免審申請文字改寫得更正式、清楚、符合台灣公務文件語氣。

重要限制：
1. 只能潤飾語氣、句構與段落順序，不得新增使用者未提供的事實。
2. 不得改變審查類型，不得重新判斷是否免審。
3. 不得改變資料來源、資料範圍、保存期限、銷毀方式、接觸個資狀態。
4. 不得將「匿名編碼」改寫為「去連結」。
5. 若原文表示「研究者無法辨識特定個人」或「不接觸可識別個資」，必須保留該語意。
6. 若護欄資訊指出研究者不接觸個資，不可改寫成「研究團隊保管個人資料」等暗示會接觸個資的句子。
7. 所有內容使用繁體中文與台灣用語。
8. 只輸出 JSON，不要輸出 Markdown 或額外說明。

輸出格式：
{
  "rewritten": {
    "exempt_reason": "...",
    "data_source": "...",
    "privacy_during": "...",
    "privacy_after": "...",
    "privacy_withdrawal": "..."
  },
  "cautions": ["..."]
}`;

export const EXEMPT_IRB_REWRITE_SCHEMA = {
  name: 'rewrite_exempt_irb',
  schema: {
    type: 'object',
    properties: {
      rewritten: {
        type: 'object',
        properties: {
          exempt_reason: { type: 'string' },
          data_source: { type: 'string' },
          privacy_during: { type: 'string' },
          privacy_after: { type: 'string' },
          privacy_withdrawal: { type: 'string' },
        },
        required: ['exempt_reason', 'data_source', 'privacy_during', 'privacy_after', 'privacy_withdrawal'],
        additionalProperties: false,
      },
      cautions: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['rewritten', 'cautions'],
    additionalProperties: false,
  },
};

export function buildExemptIrbRewritePrompt(draft, guardrails) {
  return [
    '請潤飾以下 IRB 免審申請文字。請遵守系統訊息中的限制。',
    '',
    '護欄資訊（不可改變）：',
    JSON.stringify(guardrails || {}, null, 2),
    '',
    '原始草稿：',
    JSON.stringify(draft || {}, null, 2),
  ].join('\n');
}

export function validateExemptIrbRewriteRequest(body) {
  const draft = body?.draft;
  if (!draft || typeof draft !== 'object') return '缺少免審文案草稿';

  const requiredFields = ['exempt_reason', 'data_source', 'privacy_during', 'privacy_after', 'privacy_withdrawal'];
  const missing = requiredFields.filter(field => typeof draft[field] !== 'string' || !draft[field].trim());
  if (missing.length > 0) return `免審文案草稿缺少欄位：${missing.join(', ')}`;

  if (!body?.apiKey) return '請先設定 API Key';
  return '';
}
