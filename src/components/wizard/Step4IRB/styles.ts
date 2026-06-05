// Step4IRB 與其子元件共用的版面樣式。
// 抽出避免多處複製字面值，並讓子元件不必反向 import 主檔（與 Step5Database/styles.ts 同慣例）。

import type { CSSProperties } from 'react';

// 兩欄自適應排版（窄螢幕自動疊成一欄）
export const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
};

// 直向堆疊、固定間距
export const sectionStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

// 文案小幫手卡片邊框（與 Step1/Step5 的輔助卡片同色系）
export const helperCardBorder = '#D9D4CC';
