// Step5Database 與其子元件共用的版面樣式。
// 抽出避免兩處複製字面值，並讓子元件不必反向 import 主檔。

import type { CSSProperties } from 'react';

export const twoColumnStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: 16,
};

export const denseChoiceGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 8,
};

export const sectionStackStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};
