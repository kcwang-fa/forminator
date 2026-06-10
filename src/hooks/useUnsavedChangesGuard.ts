// ===== 關閉分頁前的保險 =====
//
// 雖然有自動存檔，但「最後一次編輯」到「2 秒後寫入 localStorage」之間有空窗，
// 這段時間若直接關掉分頁，最新的幾個字會還沒存到。所以在有改動時掛 beforeunload，
// 讓瀏覽器跳原生的「確定要離開？」對話框（瀏覽器只允許原生樣式，無法自訂文案）。
//
// 注意：這跟「提醒匯出 JSON」是兩回事 —— 這支防的是「誤關分頁丟最後幾個字」，
// 匯出提醒（useExportReminder）防的是「換電腦／清快取整份草稿不見」。

import { useEffect } from 'react';

/** hasData 為 true（表單已被改動）時，關閉分頁前跳原生確認對話框 */
export function useUnsavedChangesGuard(hasData: boolean) {
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasData) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasData]);
}
