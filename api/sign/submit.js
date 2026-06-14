// Vercel Serverless Function — 手機簽名上傳（QR 簽名流程的「手機端 → 中繼站」）
// 手機簽名頁（/sign）簽完後 POST 到這裡，簽名圖暫存 Redis 等電腦端來取。
import { validateSession, validateImage, saveSignature } from '../_lib/signStore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const { session, image } = req.body || {};
    // 驗證全部過才碰 Redis（壞請求直接 400 打回，不浪費中繼站資源）
    const sessionError = validateSession(session);
    if (sessionError) return res.status(400).json({ error: sessionError });
    const imageError = validateImage(image);
    if (imageError) return res.status(400).json({ error: imageError });

    const saved = await saveSignature(session, image);
    if (!saved.configured) {
      return res.status(503).json({ error: '簽名中繼服務未設定，請改用「上傳圖檔」方式' });
    }
    res.json({ ok: true });
  } catch (err) {
    // 刻意不 log image 內容（簽名是個資），只 log 錯誤本身
    console.error('sign/submit error:', err);
    res.status(500).json({ error: '簽名上傳失敗，請稍後再試' });
  }
}
