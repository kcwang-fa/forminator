// ===== 文件生成靜態對照表 =====

export const ROLE_MAP: Record<string, string> = {
  pi:         '計畫主持人',
  co_pi:      '協同主持人',
  researcher: '研究人員',
  contact:    '計畫聯絡人',
  assistant:  '研究助理',
};

export const EXEMPT_MAP: Record<string, string> = {
  public_non_interactive: '於公共場所進行之非介入性研究，且非以可辨識個人之方式利用',
  public_info:            '使用已合法公開之資料或文件，且資訊之使用無涉可辨識之個資',
  public_policy:          '公共政策之成效評估研究，且非以可辨識個人之方式利用',
  education:              '於一般教學環境中進行之教育評量或測試、教學技巧之研究',
  minimal_risk:           '研究計畫屬最低風險，且所蒐集之個資經加密處理',
};

export const PURPOSE_MAP: Record<string, string> = {
  internal_research: '署內科技研究計畫',
  thesis:            '碩、博士論文',
  no_fund_research:  '無需經費研究計畫',
  other:             '其他',
};

export const ANALYSIS_LOCATION_MAP: Record<string, string> = {
  office:         '本署署內辦公場域',
  personal_pc:    '個人公務電腦',
  other_platform: '其他分析平台',
  data_center:    '資科中心',
};

export const OUTCOME_TYPE_MAP: Record<string, string> = {
  policy:        '提供決策',
  report:        '研究報告',
  paper_writing: '論文寫作',
  paper_publish: '論文發表',
  other:         '其他',
};
