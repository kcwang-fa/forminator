// Vercel Serverless Function — 電腦端輪詢取簽名（QR 簽名流程的「中繼站 → 電腦端」）
// 電腦的 QrSignModal 每 2 秒來問一次「簽好了沒」；GETDEL 取完即刪（讀一次就消失）。
import { validateSession, takeSignature } from '../_lib/signStore.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const session = req.query?.session;
    const sessionError = validateSession(session);
    if (sessionError) return res.status(400).json({ error: sessionError });

    const taken = await takeSignature(session);
    if (!taken.configured) {
      return res.status(503).json({ error: '簽名中繼服務未設定，請改用「上傳圖檔」方式' });
    }
    // result 為 null = 還沒簽（或已被取走/過期）→ pending，前端繼續輪詢
    if (!taken.result) return res.json({ status: 'pending' });
    res.json({ status: 'done', image: taken.result });
  } catch (err) {
    console.error('sign/poll error:', err);
    res.status(500).json({ error: '查詢失敗，請稍後再試' });
  }
}
