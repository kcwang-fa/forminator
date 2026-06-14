// ===== 簽名圖工具 =====
//
// 簽名在系統內一律以「base64 PNG data URL」字串流通（'data:image/png;base64,...'），
// 存在 Personnel.signature_image。這支模組負責五件事：
//   1. base64DataUrlToUint8Array：data URL → 二進位 bytes（docgen 的 image module 要吃 bytes）
//   2. signatureDataUrlToBlob：data URL → PNG Blob（匯出簽名檔用）
//   3. getPngSize：讀 PNG 檔頭取得原始寬高（算等比縮放用，不用整張圖解碼）
//   4. fitSignatureSize：把原始寬高等比縮到「放得進簽章欄」的尺寸
//   5. normalizeSignatureImage：使用者上傳的圖檔（PNG/JPG）重繪成統一尺寸的 PNG data URL
//
// 注意：1~4 在瀏覽器和 Node（snapshot 腳本、smoke test）都會跑，不能用 DOM API；
//       5 用到 Image/canvas，只有瀏覽器（PR2 的上傳功能）會呼叫。

// 簽章欄能放的最大尺寸（單位 px，docxtemplater image module 用 px 計算）。
// why 45px 高：簽章欄是表格列或一行文字的高度，太高會把整列撐開、甚至把封面擠到溢頁。
// why 170px 寬：約 4.5cm，與 DOC-2 封面「簽名：」後的底線長度相當，不會蓋到旁邊的欄位。
const MAX_SIG_HEIGHT_PX = 45;
const MAX_SIG_WIDTH_PX = 170;

// 簽名板/上傳圖統一輸出的 canvas 尺寸（3:1 橫式，符合簽名比例）。
// 600×200 在手機 retina 螢幕上夠細緻，PNG 通常 5~20KB，localStorage 存得起。
export const SIG_CANVAS_WIDTH = 600;
export const SIG_CANVAS_HEIGHT = 200;

/** data URL（'data:image/png;base64,xxx'）→ Uint8Array。docgen 的 getImage callback 用。 */
export function base64DataUrlToUint8Array(dataUrl: string): Uint8Array {
  // data URL 格式固定是「前綴,base64內容」，逗號後才是真正的資料
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  // atob 把 base64 還原成「每個字元 = 1 byte」的字串，再逐字轉成數字陣列
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** 系統內的 PNG data URL → Blob。下載簽名時保留透明背景與原始解析度。 */
export function signatureDataUrlToBlob(dataUrl: string): Blob {
  if (!dataUrl.startsWith('data:image/png;base64,')) {
    throw new Error('簽名圖片格式不是 PNG，請重新簽名或上傳圖檔');
  }
  const bytes = base64DataUrlToUint8Array(dataUrl);
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
  return new Blob([buffer], { type: 'image/png' });
}

/**
 * 讀 PNG 檔頭取得寬高。
 * PNG 規格：前 8 bytes 是固定簽名，接著 4 bytes 長度 + 4 bytes "IHDR"，
 * 然後第 16~19 bytes 是寬、20~23 bytes 是高（都是 big-endian 32-bit 整數）。
 * 不是合法 PNG 時回傳 null（呼叫端自行決定 fallback）。
 */
export function getPngSize(dataUrl: string): { w: number; h: number } | null {
  const bytes = base64DataUrlToUint8Array(dataUrl);
  // 檢查 PNG 簽名（\x89PNG\r\n\x1a\n）+ IHDR 區塊，不對就不是 PNG
  if (bytes.length < 24 || bytes[0] !== 0x89 || bytes[1] !== 0x50 /* P */) return null;
  const readU32 = (offset: number) =>
    (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
  const w = readU32(16);
  const h = readU32(20);
  if (w <= 0 || h <= 0) return null;
  return { w, h };
}

/**
 * 等比縮放到簽章欄放得下的尺寸，回傳 [寬, 高]（docxtemplater image module 的 getSize 格式）。
 * 先用高度上限算比例、再檢查寬度上限，兩個都不超才行。
 */
export function fitSignatureSize(size: { w: number; h: number } | null): [number, number] {
  // 讀不到尺寸時用保守預設值（3:1 橫式），至少不會撐爆版面
  if (!size) return [135, 45];
  let scale = MAX_SIG_HEIGHT_PX / size.h;
  if (size.w * scale > MAX_SIG_WIDTH_PX) scale = MAX_SIG_WIDTH_PX / size.w;
  // 圖比上限還小就原尺寸放（放大只會模糊）
  if (scale > 1) scale = 1;
  return [Math.round(size.w * scale), Math.round(size.h * scale)];
}

/**
 * 把使用者上傳的圖檔（PNG/JPG）重繪成統一尺寸的 PNG data URL。
 * why 要重繪而不是直接存原檔：
 *   1. 手機拍的照片動輒好幾 MB，直接存會塞爆 localStorage（上限約 5MB）
 *   2. 統一轉成 PNG，docgen 端就只需要處理一種格式
 * 等比縮到「高 ≤200、寬 ≤600」，置中畫在透明背景的 canvas 上。
 * 只能在瀏覽器呼叫（用到 Image 和 canvas）。
 */
export function normalizeSignatureImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);  // 圖已載入記憶體，物件 URL 用完就釋放
      let scale = Math.min(SIG_CANVAS_WIDTH / img.width, SIG_CANVAS_HEIGHT / img.height);
      if (scale > 1) scale = 1;  // 小圖不放大
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('瀏覽器不支援 canvas')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法讀取圖檔，請確認是 PNG 或 JPG 格式'));
    };
    img.src = url;
  });
}
