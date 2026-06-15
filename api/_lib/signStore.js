// ===== 簽名中繼暫存（Upstash Redis REST）=====
//
// 手機簽名 QR 流程的後端核心：
//   手機 POST /api/sign/submit → 簽名圖存進 Redis（5 分鐘自動過期）
//   電腦 GET  /api/sign/poll   → 取出簽名圖（GETDEL：取完即刪，讀一次就消失）
//
// 安全設計（每一條都是刻意的，改之前先想清楚）：
//   1. session id 由電腦端 crypto.randomUUID() 產生（122 bits 亂度），無法列舉猜測
//   2. TTL 300 秒：就算沒人來取，簽名最多留 5 分鐘
//   3. GETDEL 取完即刪：簽名不會留在伺服器上被重複讀取
//   4. 大小上限 100KB：簽名板輸出通常 5~20KB，超過就是異常請求
//   5. 只接受 data:image/png;base64, 前綴：擋掉任意內容塞進 Redis
//   6. key 一律加 "sign:" 前綴：與其他可能的 Redis 資料隔離
//
// 環境變數：UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// （Vercel 專案設定 → Environment Variables；本地開發不用設，
//   server.js 有 in-memory 版，見 server.js 的「簽名中繼」段）

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PNG_PREFIX = 'data:image/png;base64,';

export const MAX_IMAGE_CHARS = 100_000;  // base64 字元數上限（約 75KB 原始圖）
export const TTL_SECONDS = 300;          // 簽名在中繼站的存活時間（5 分鐘）

/** session id 必須是 UUID 格式，不是就回錯誤訊息（null = 合法） */
export function validateSession(session) {
  if (typeof session !== 'string' || !UUID_RE.test(session)) {
    return 'session 格式錯誤';
  }
  return null;
}

/** 簽名圖必須是 PNG data URL 且不超過大小上限（null = 合法） */
export function validateImage(image) {
  if (typeof image !== 'string' || !image.startsWith(PNG_PREFIX)) {
    return '簽名圖格式錯誤（僅接受 PNG data URL）';
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return `簽名圖過大（上限 ${Math.round(MAX_IMAGE_CHARS / 1024)}KB）`;
  }
  return null;
}

// 對 Upstash 送一條 Redis 指令（REST API：POST 一個 JSON 陣列，如 ["SET","k","v"]）。
// 沒設定環境變數時回 configured:false，呼叫端回 503 給前端顯示明確訊息。
async function redisCommand(command) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return { configured: false };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Upstash 回應 ${resp.status}: ${body}`);
  }
  const data = await resp.json();
  return { configured: true, result: data.result };
}

/** 存簽名：SET sign:<session> <image> EX 300 */
export async function saveSignature(session, image) {
  return redisCommand(['SET', `sign:${session}`, image, 'EX', String(TTL_SECONDS)]);
}

/** 取簽名（取完即刪）：GETDEL sign:<session>。沒有（未簽/已取/過期）→ result 為 null */
export async function takeSignature(session) {
  return redisCommand(['GETDEL', `sign:${session}`]);
}
