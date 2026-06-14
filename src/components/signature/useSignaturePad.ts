// ===== 簽名板共用 hook =====
//
// 封裝 signature_pad 的初始化地雷，給 SignaturePadModal（桌機）和 SignPage（手機）共用。
//
// 兩個地雷（都實測踩過，詳見各段註解）：
//   1. antd Modal 的內容掛在 portal、掛載時機比 useEffect 晚 → 用「callback ref」，
//      React 在 canvas 真正掛上 DOM 時通知我們，不用猜時機。
//   2. Modal 開啟動畫期間寬度是 0，canvas 一掛上來量不到真實尺寸 → 用 ResizeObserver，
//      等 canvas 真正拿到尺寸才初始化，之後視窗轉向/縮放也會自動跟上。
//
// canvas 的「內部像素」要跟「顯示尺寸 × devicePixelRatio」同步，否則 retina 螢幕上
// 筆跡會模糊、筆尖位置和游標對不上（signature_pad 官方建議作法）。

import { useCallback, useRef } from 'react';
import SignaturePad from 'signature_pad';
import { SIG_CANVAS_WIDTH } from '../../utils/signatureImage';

// 把簽名 canvas 等比縮到寬 ≤600px 再輸出 PNG。
// why：retina 螢幕的 canvas 內部像素是顯示尺寸的 2~3 倍，直接 toDataURL 會輸出大圖；
//      縮過再存，localStorage 才不會被簽名塞爆。
function exportDownscaled(canvas: HTMLCanvasElement): string {
  let scale = SIG_CANVAS_WIDTH / canvas.width;
  if (scale > 1) scale = 1;  // 小圖不放大（放大只會模糊）
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * scale);
  out.height = Math.round(canvas.height * scale);
  out.getContext('2d')!.drawImage(canvas, 0, 0, out.width, out.height);
  return out.toDataURL('image/png');
}

export function useSignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // 接到 <canvas ref={setupCanvas}>：掛載時傳元素、卸載時傳 null。
  //
  // ⚠️ 必須用 useCallback 釘住函式身分：ref callback 若每次 render 都是新函式，
  //    React 會在「每一次 re-render」先用舊函式 detach(null) 再用新函式 attach——
  //    等於簽到一半遇到任何 re-render（例如剛簽完上一個人、2 秒後自動儲存觸發的
  //    那次 re-render）就把 canvas 重設、筆跡整個擦掉，使用者看起來就是「簽不了名」。
  const setupCanvas = useCallback((canvas: HTMLCanvasElement | null) => {
    if (!canvas) {
      // canvas 卸載（Modal 關閉、頁面切換）→ 全部清乾淨
      observerRef.current?.disconnect();
      observerRef.current = null;
      padRef.current?.off();  // 拆掉事件監聽，避免殘留
      padRef.current = null;
      canvasRef.current = null;
      return;
    }
    // 同一個 canvas 重複 attach（StrictMode、極端情況下的 ref 重掛）→ 冪等，不重做
    if (canvasRef.current === canvas && padRef.current) return;
    canvasRef.current = canvas;
    const syncSize = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      if (w === 0 || h === 0) return;  // 還沒有尺寸（Modal 開啟動畫中）→ 等 observer 再通知
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      // 以 canvas 自己的內部尺寸當真相比對（不要用閉包變數記上次尺寸——
      // 閉包在重新 attach 時會歸零，誤判「尺寸變了」而把畫到一半的筆跡擦掉）
      const targetW = Math.round(w * ratio);
      const targetH = Math.round(h * ratio);
      const sizeChanged = canvas.width !== targetW || canvas.height !== targetH;
      if (!sizeChanged && padRef.current) return;  // 尺寸沒變，筆跡與事件監聽都保留

      if (sizeChanged) {
        canvas.width = targetW;   // 重設尺寸會清空畫面、重置 context 狀態
        canvas.height = targetH;
      }

      // StrictMode 會做一次 callback ref 的 attach → detach → attach。
      // 第二次 attach 時 canvas 尺寸沒變，但前一次 detach 已把 SignaturePad.off() 掉；
      // 因此即使尺寸相同，也必須重新套用縮放並建立事件監聽。
      canvas.getContext('2d')!.setTransform(ratio, 0, 0, ratio, 0, 0);
      if (!padRef.current) {
        padRef.current = new SignaturePad(canvas, {
          penColor: '#1a1a2e',  // 接近墨水的深藍黑
          // 不設 backgroundColor → 透明底，疊在文件底線上不會蓋出白塊
        });
      } else if (sizeChanged) {
        padRef.current.clear();  // 真的改了尺寸才需要同步重置筆跡資料
      }
    };
    syncSize();  // 沒有開啟動畫的情況（如減少動態偏好）一掛上就有尺寸，直接初始化
    observerRef.current = new ResizeObserver(syncSize);
    observerRef.current.observe(canvas);
  }, []);

  const clear = () => padRef.current?.clear();
  const isEmpty = () => !padRef.current || padRef.current.isEmpty();
  const exportPng = () => (canvasRef.current ? exportDownscaled(canvasRef.current) : '');

  return { setupCanvas, clear, isEmpty, exportPng };
}
