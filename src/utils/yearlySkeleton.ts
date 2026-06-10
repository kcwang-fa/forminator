// ===== 多年期「分年骨架」產生器 =====
//
// 用途：多年期計畫的「研究主旨 / 實施方法 / 成果預估」這三節，範本要求「總述 + 分年」
// 的寫法（例：研究主旨要先寫全程總目標、再逐年寫分年目的）。對新手來說對著空白
// textarea 很難下手，所以提供「帶入分年骨架」按鈕，一鍵產生填空骨架讓使用者接著寫。
//
// 注意：這只是「填字輔助」，底層仍是單一文字欄位（不分年存）。
// 各節的骨架結構刻意不同，反映範本各節的真實長相：
//   - 研究主旨：只給全程總目標（「分年目的」已獨立成 yearly_objectives 欄位）
//   - 分年計劃目的：逐年的分年目的填空（多年期專用欄位）
//   - 實施方法：偏純分年（每年研究設計/資料收集/分析方法），範本無明顯總述開頭
//   - 成果預估：全程預期成果 + 分年成果預估

/** 可帶骨架的章節（research 三節 + 已獨立成欄位的「分年計劃目的」）*/
export type YearlySection = 'purpose' | 'yearly_objectives' | 'methodology' | 'expected_outcome';

/**
 * 產生某一節的分年填空骨架。
 *
 * @param section  要產生哪一節的骨架
 * @param rocBase  計畫起始的民國年（例：114）。無法推算時傳 null → 改用「第N年」標籤
 * @param yearCount 計畫年數（= 甘特圖的年數）
 * @returns 多行字串，可直接填入或附加到 textarea
 */
export function buildYearlySkeleton(
  section: YearlySection,
  rocBase: number | null,
  yearCount: number,
): string {
  // 至少一年；保險避免傳入 0 或負數產生空骨架
  const years = Math.max(1, yearCount);

  // 第 i 年（0-based）的年度標籤：能推民國年就用「115 年度」，否則退回「第1年」
  const yearLabel = (i: number): string =>
    rocBase == null ? `第${i + 1}年` : `${rocBase + i} 年度`;

  // 各年一行的填空列（依章節給不同的括號提示）。用兩個半形空格縮排，
  // 避開 no-irregular-whitespace（全形空格 lint 不允許）。
  const yearLines = (hint = ''): string =>
    Array.from({ length: years }, (_, i) => `  ${yearLabel(i)}${hint}：`).join('\n');

  switch (section) {
    case 'purpose':
      // 只剩全程總目標——「分年目的」已獨立成 yearly_objectives 欄位（見下方 case）。
      return '【全程總目標】';
    case 'yearly_objectives':
      // 分年目的：逐年填空（從 purpose 拆出來的獨立欄位）。
      return ['【分年目的】', yearLines()].join('\n');
    case 'methodology':
      // 偏純分年；每年提示研究設計/資料收集/分析方法
      return [
        '【分年實施方法及進行步驟】',
        yearLines('（研究設計／資料收集／分析方法）'),
      ].join('\n');
    case 'expected_outcome':
      // 全程預期成果 + 分年成果預估
      return ['【全程預期成果】', '', '【分年成果預估】', yearLines()].join('\n');
  }
}
