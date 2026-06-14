// ===== 簽章需求表（結構化）=====
//
// 「哪份文件、哪個欄位、誰要簽、forminator 會不會自動嵌入」的唯一真相來源。
// 結果頁的 SignaturePanel 用它畫「簽章文件總覽」。
//
// 與 planConfigs.ts 的 signatureNotes 的關係：
//   - signatureNotes 是「跑關流程」裡給人讀的文字說明（依關卡分組），保留不動
//   - 這裡是給程式用的結構化資料（依文件分列），兩邊內容要對得上
//
// signer 三種：
//   - 'pi'          計畫主持人簽（用 PI 的 signature_image）
//   - 'each_member' 每位研究人員各簽自己的（逐人文件或逐人附表）
//   - 'manual_only' 主管核章／權責單位／審查會——走公文流程，forminator 一律留白不碰
//
// 新增簽章欄位時：先改對應的 inject-docN.cjs（注入 {%xxx_sig}），再來這裡補一列。

import type { DocId } from './defaults';

export type SignerKind = 'pi' | 'each_member' | 'manual_only';

export interface SignatureFieldSpec {
  docId: DocId;
  field: string;        // 簽章欄名稱（顯示用）
  signer: SignerKind;   // 誰要簽
  autoEmbed: boolean;   // true = 有簽名圖就自動嵌進文件；false = 永遠留白手簽
  note?: string;        // 補充說明（顯示在總覽表）
  // each_member 的計數範圍：
  //   'all'（預設）   = 全部人員（DOC-6/7 逐人文件對每位 personnel 都產一份）
  //   'appendix'      = 只算主持人/協同/研究人員（DOC-2 附表一 loop 的 filter，
  //                     與 docgen/personnelAppendix.ts 的 members 一致）
  memberScope?: 'all' | 'appendix';
}

export const SIGNATURE_FIELDS: SignatureFieldSpec[] = [
  // ── 申請人方：有簽名圖就自動嵌入，沒簽的人該欄留白可手簽 ──
  { docId: 'DOC-2',  field: '封面：計畫主持人簽名',     signer: 'pi',          autoEmbed: true },
  { docId: 'DOC-2',  field: '附表一：填表人簽章',       signer: 'each_member', autoEmbed: true, note: '每位研究人員一份附表一，各簽自己的', memberScope: 'appendix' },
  { docId: 'DOC-2',  field: '附表一：計畫主持人簽章',   signer: 'pi',          autoEmbed: true, note: '每份附表一都要主持人簽' },
  { docId: 'DOC-5',  field: '主持人簽章',               signer: 'pi',          autoEmbed: true },
  { docId: 'DOC-6',  field: '立同意書人簽名',           signer: 'each_member', autoEmbed: true, note: '每位研究人員各一份' },
  { docId: 'DOC-7',  field: '立書人簽名',               signer: 'each_member', autoEmbed: true, note: '每位研究人員各一份' },
  { docId: 'DOC-8',  field: '申請者簽名',               signer: 'pi',          autoEmbed: true },
  { docId: 'DOC-12', field: '主持人簽章',               signer: 'pi',          autoEmbed: true, note: '簡審／一般審人體研究計畫申請表' },
  { docId: 'DOC-13', field: '主持人簽章',               signer: 'pi',          autoEmbed: true, note: '簡審申請表' },

  // ── 主管核章方：走公文／紙本核章流程，永遠留白 ──
  { docId: 'DOC-5',  field: '單位主管簽章',                       signer: 'manual_only', autoEmbed: false, note: '列印後送單位主管核章' },
  { docId: 'DOC-8',  field: '單位主管簽名',                       signer: 'manual_only', autoEmbed: false, note: '列印後送單位主管核章' },
  { docId: 'DOC-10', field: '申請單位主管簽名／業務權責單位核章', signer: 'manual_only', autoEmbed: false, note: '走公文核章流程' },
  { docId: 'DOC-11', field: '申請單位核章／權責單位審查',         signer: 'manual_only', autoEmbed: false, note: '走公文核章流程' },
  { docId: 'DOC-12', field: '單位主管簽章',                       signer: 'manual_only', autoEmbed: false, note: '列印後送單位主管核章' },
  { docId: 'DOC-13', field: '單位主管簽章',                       signer: 'manual_only', autoEmbed: false, note: '列印後送單位主管核章' },
];
