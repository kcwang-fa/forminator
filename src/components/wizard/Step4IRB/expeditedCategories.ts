// ===== IRB-003 簡易審查案件申請表「研究類別」(A~I) 顯示用資料 =====
//
// 這份檔案只放「畫面要顯示的文字」（分類抬頭 + 各勾選格的敘述），不含任何判斷邏輯。
// 判斷哪幾格該預勾在 reviewClassifier.ts 的 suggestExpeditedCategories；docgen 的 ■/□ 注入在
// docgen.ts 的 prepareExpeditedData。三者各司其職，這裡純資料。
//
// 文字忠於 source-templates/IRB-003 簡易審查案件申請表.docx 原文（與 inject-doc13.cjs 的 24 格對位一致）；
// value 對齊 ExpeditedCategory union 與 {irb003_*} placeholder（a / b1~b8 / c1~c6 / d / e / f / g1~g3 / h / i1~i2）。

import type { ExpeditedCategory } from '../../../types/form';

export interface ExpeditedCategoryGroup {
  letter: string;  // 分類字母（A~I）
  title: string;   // 分類抬頭
  note?: string;   // 該分類的補充限制／說明（如 C 群的器材限制、H 的生物資料庫定義）
  items: { value: ExpeditedCategory; label: string }[];
}

export const EXPEDITED_CATEGORY_GROUPS: ExpeditedCategoryGroup[] = [
  {
    letter: 'A',
    title: '從手指、腳跟、耳朵採血或靜脈穿刺收集血液檢體',
    items: [
      { value: 'a', label: '自體重 50 公斤以上之成年人，採集手指、腳跟、耳朵或靜脈血液，且採血總量八週內不超過 320 毫升，每週採血不超過二次，且每次採血不超過 20 毫升。' },
    ],
  },
  {
    letter: 'B',
    title: '以下列非侵入性方法採集研究用人體檢體',
    items: [
      { value: 'b1', label: '以不損傷外形的方式收集頭髮、指甲或體表自然脫落之皮屑。' },
      { value: 'b2', label: '收集因例行照護需要而拔除之恆齒。' },
      { value: 'b3', label: '收集排泄物和體外分泌物，如汗液等。' },
      { value: 'b4', label: '非以套管取得唾液，但使用非刺激方式、咀嚼口香糖、蠟或施用檸檬酸刺激舌頭取得唾液。' },
      { value: 'b5', label: '以一般洗牙程序或低於其侵犯性範圍之程序採集牙齦上或牙齦內之牙菌斑及牙結石。' },
      { value: 'b6', label: '以刮取或漱口方式，自口腔或皮膚採集黏膜或皮膚細胞。' },
      { value: 'b7', label: '以蒸氣吸入後收集之痰液。' },
      { value: 'b8', label: '其他非以穿刺、皮膚切開或使用器械置入人體方式採集檢體。' },
    ],
  },
  {
    letter: 'C',
    title: '使用下列非侵入性方法收集資料',
    note: '使用之醫療器材須經中央主管機關核准上市，且不包括使用游離輻射、微波、全身麻醉或鎮靜劑等方式。',
    items: [
      { value: 'c1', label: '使用於研究對象體表或一段距離之感應器，不涉及相當能量的輸入或侵犯研究對象隱私。' },
      { value: 'c2', label: '測量體重或感覺測試。' },
      { value: 'c3', label: '核磁共振造影。' },
      { value: 'c4', label: '心電圖、腦波圖、體溫、自然背景輻射偵測、視網膜電圖、超音波、診斷性紅外線造影、杜卜勒血流檢查及心臟超音波。' },
      { value: 'c5', label: '依研究對象年齡、體重和健康情形所為之適度運動、肌力測試、身體組織成分評估與柔軟度測試。' },
      { value: 'c6', label: '其他符合本款規定之非侵入性方法。' },
    ],
  },
  {
    letter: 'D',
    title: '使用臨床常規治療或診斷之病歷',
    items: [
      { value: 'd', label: '使用臨床常規治療或診斷之病歷，含個案報告之研究。但不含人類後天性免疫不全病毒（HIV）陽性患者之病歷。' },
    ],
  },
  {
    letter: 'E',
    title: '以研究為目的所蒐集之錄音、錄影或影像資料',
    items: [
      { value: 'e', label: '以研究為目的所蒐集之錄音、錄影或影像資料。但不含可辨識或可能影響研究對象工作、保險、財務及社會關係之資料。' },
    ],
  },
  {
    letter: 'F',
    title: '研究個人或群體特質或行為',
    items: [
      { value: 'f', label: '研究個人或群體特質或行為，但不含造成個人或族群歧視之潛在可能者。' },
    ],
  },
  {
    letter: 'G',
    title: '已審查通過之計畫，符合下列情形之一者',
    items: [
      { value: 'g1', label: '已不再收錄新個案，且所收錄之研究對象均已完成所有相關的研究試驗，惟仍須長期追蹤。' },
      { value: 'g2', label: '未能於原訂計畫期間達成收案數，僅展延計畫期間，未再增加個案數，且無新增之危險性。' },
      { value: 'g3', label: '僅限於接續前階段研究之後續資料分析。' },
    ],
  },
  {
    letter: 'H',
    title: '自合法生物資料庫取得之去連結或無法辨識特定個人之資料或檢體',
    note: '合法生物資料庫指依《人體生物資料庫管理條例》經衛福部核准者；本署未設置經核准之人體生物資料庫。',
    items: [
      { value: 'h', label: '自合法生物資料庫取得之去連結或無法辨識特定個人之資料、檔案、文件、資訊或檢體進行研究。但不含涉及族群或群體利益者。' },
    ],
  },
  {
    letter: 'I',
    title: '其他',
    items: [
      { value: 'i1', label: '審查會承接其他合法審查會通過之研究計畫，得以簡易審查程序追認之。' },
      { value: 'i2', label: '不符合以上，但您認為基於研究計畫的某些特殊性質仍符合簡易審查的條件（請於下方詳細說明）。' },
    ],
  },
];
