// ===== 匯出提醒 Hook =====
//
// 為什麼這樣設計：
// 草稿只存在「這一台瀏覽器」的 localStorage，清快取／換電腦就沒了，所以要提醒使用者匯出 JSON 備份。
// 但「一開頁就喊」很煩、「每次存檔都喊」更煩。這支只在**同時**滿足兩個條件時，溫和提醒一次：
//   1. 距上次匯出夠久（避免剛備份完又被念、也避免填 2 分鐘就被打斷）
//   2. 內容改得夠多（真的做了一段實質工作才值得提醒）
// 兩個都要中（AND）：閒置開著一小時但沒改 → 不念；剛貼一大段但 1 分鐘前才匯出 → 也不念。
//
// 「改多少算多」用什麼衡量：草稿序列化後的字元數，相對「上次匯出當下」的淨變化量。
// 自動存檔本來就會 JSON.stringify，直接拿長度差最便宜也夠直觀。

import { useEffect, useRef } from 'react';
import { App } from 'antd';

// ⚠️ 兩個門檻都是「手感」常數，覺得太吵就調大、太少提醒就調小：
/** 距上次匯出至少要隔這麼久才考慮提醒（10 分鐘） */
const MIN_INTERVAL_MS = 10 * 60 * 1000;
/** 草稿字數相對上次匯出的淨變化量達這麼多才算「改了不少」（約一段摘要／方法的份量） */
const CHANGE_CHARS = 1000;

export function useExportReminder() {
  const { notification } = App.useApp();

  // baseline = 「上次匯出當下」的草稿長度與時間；從未匯出過時，由下面的 mount effect 初始化為開頁狀態。
  const baselineLenRef = useRef<number>(0);
  const baselineTimeRef = useRef<number>(0);

  // 開頁時用「還原的草稿長度」當基準，這樣衡量的是「這次開頁後新做的工作量」，不被舊草稿灌水。
  useEffect(() => {
    try {
      baselineLenRef.current = localStorage.getItem('forminator_draft')?.length ?? 0;
    } catch {
      baselineLenRef.current = 0;
    }
    baselineTimeRef.current = Date.now();
  }, []);

  /** 每次自動存檔後呼叫：符合條件就提醒一次，並把 baseline 推到現在（snooze 一整個週期，避免 nag） */
  const onSaved = (serialized: string) => {
    const now = Date.now();
    const changedEnough = Math.abs(serialized.length - baselineLenRef.current) >= CHANGE_CHARS;
    const longEnough = now - baselineTimeRef.current >= MIN_INTERVAL_MS;
    if (changedEnough && longEnough) {
      notification.info({
        message: '建議匯出 JSON 備份',
        description: '你已經編輯了不少內容。草稿只存在這台瀏覽器，建議點右上角「匯出 JSON」存一份備份，以免清快取或換電腦時遺失。',
        duration: 8,
      });
      // snooze：重設基準，下一輪要再「久且多」才會提醒
      baselineLenRef.current = serialized.length;
      baselineTimeRef.current = now;
    }
  };

  /** 使用者真的匯出後呼叫：重設 baseline，重新計算下一輪 */
  const markExported = (serialized: string) => {
    baselineLenRef.current = serialized.length;
    baselineTimeRef.current = Date.now();
  };

  return { onSaved, markExported };
}
