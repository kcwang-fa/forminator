// ===== 審查類型小幫手（免審 / 簡審 / 一般審判斷器）=====
//
// 設計理念（Phase 1 重構）：
//   以前這個元件把「資料用途 13 種 + 檢體 9 種 + 族群 11 種 + 可識別性 5 種 +
//   最低風險 + 5 個風險勾選」一次全部攤開在 Step 1 最上面，使用者一打開就被淹沒，
//   也不知道該從哪幾項下手。
//
//   重構後改成「引導式漸進揭露」：
//   1. 把這些題目拆成 5 個「白話問句」面板（Collapse），預設全部收合 →
//      Step 1 打開時只看到幾行問句標題，不再是一整片勾選框。
//   2. 資料用途依「既有資料 / 評估觀察 / 新收集資料」分三組，每組變小、好掃描。
//   3. 「研究對象與特殊風險」這種修飾條件放到最後一個面板，照「先講做什麼、
//      再講有沒有特殊狀況」的順序引導。
//   4. 每個面板標題會顯示「已選 N 項」，就算收合著也看得到自己選過哪些。
//
//   ⚠️ 重要：背後的判斷邏輯（reviewClassifier.ts）這次完全沒動，純粹改呈現方式。
//   要改判斷規則請去 reviewClassifier.ts，不要改這支。

import { useMemo, useCallback } from 'react';
import { Alert, Button, Checkbox, Collapse, Divider, Radio, Space, Tag, Typography } from 'antd';
import { CheckCircleOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { Controller, useWatch } from 'react-hook-form';
import { useFormStore } from '../../hooks/useFormStore';
import { getPlanConfig } from '../../data/planConfigs';
import { classifyReviewType, REVIEW_TYPE_LABELS } from '../../utils/reviewClassifier';
import type {
  ExemptCategory,
  ReviewDataIdentifiability,
  ReviewDataUseType,
  ReviewSpecimenUseType,
  ReviewVulnerablePopulation,
} from '../../types/form';

const { Text, Title } = Typography;

// 資料用途分三組呈現（合起來仍是原本完整的 13 種 ReviewDataUseType）。
// 分組只是為了讓畫面好掃描，不影響判斷邏輯——三組共用同一個
// review_screening.data_use_types 欄位。

// 第一組：拿現成的資料來分析（CDC 資料庫回溯研究最常見的就是這組）
const EXISTING_DATA_OPTIONS: Array<{ value: ReviewDataUseType; label: string; description: string }> = [
  {
    value: 'deidentified_database',
    label: '資料庫去個資資料',
    description: '防疫資料庫、衛福資料科學中心、健保資料庫等，由資料提供單位處理後無法辨識個人。',
  },
  {
    value: 'business_data',
    label: '既有業務資料',
    description: '疫調報告、問卷、例行業務蒐集資料等。',
  },
  {
    value: 'medical_record',
    label: '病歷資料',
    description: '醫療院所病歷、臨床常規治療或診斷資料、個案報告。',
  },
  {
    value: 'public_info',
    label: '合法公開資訊',
    description: '已公開週知之資訊，且使用符合其公開目的。',
  },
  {
    value: 'other_existing_data',
    label: '其他既有資料',
    description: '不屬於以上類型的既有資料。',
  },
];

// 第二組：政策評估 / 教育評量 / 公開觀察（多屬免審的特定類別）
const EVALUATION_OPTIONS: Array<{ value: ReviewDataUseType; label: string; description: string }> = [
  {
    value: 'public_policy_evaluation',
    label: '公共政策評估',
    description: '公務機關執行法定職務進行之公共政策成效評估。',
  },
  {
    value: 'education_evaluation',
    label: '一般教育評量',
    description: '一般教學環境中的教育評量、測試、教學技巧或成效評估。',
  },
  {
    value: 'public_non_interactive_observation',
    label: '公開場合非互動觀察',
    description: '公開場合、非記名、非互動且非介入性研究。',
  },
];

// 第三組：你自己去收集的新資料（問卷、訪視、量測、錄影等）
const NEW_DATA_OPTIONS: Array<{ value: ReviewDataUseType; label: string; description: string }> = [
  {
    value: 'minimal_risk_new_data',
    label: '最低風險新收集資料',
    description: '問卷、訪視等新收集資料，且風險不高於未參加者。',
  },
  {
    value: 'noninvasive_measurement',
    label: '非侵入性量測',
    description: '體重、感覺測試、心電圖、超音波、適度運動測試等。',
  },
  {
    value: 'behavior_or_trait',
    label: '個人或群體特質/行為',
    description: '研究個人或群體特質或行為，且不涉及歧視風險。',
  },
  {
    value: 'recording_or_image',
    label: '錄音/錄影/影像資料',
    description: '以研究為目的蒐集錄音、錄影或影像資料。',
  },
  {
    value: 'other_new_data',
    label: '其他新收集資料',
    description: '不屬於以上類型的新收案、新訪談或新資料蒐集。',
  },
];

const SPECIMEN_USE_OPTIONS: Array<{ value: ReviewSpecimenUseType; label: string; description: string }> = [
  {
    value: 'cdc_residual_specimen',
    label: '防疫驗餘檢體',
    description: '僅使用防疫驗餘檢體，且符合傳染病防治法與最低風險。',
  },
  {
    value: 'strain_or_virus',
    label: '菌株/病毒株',
    description: '醫療院所依防疫需求送回本署之菌株或病毒株。',
  },
  {
    value: 'limited_blood_draw',
    label: '限量採血',
    description: '成年人採血，符合八週與每週採血量、頻率限制。',
  },
  {
    value: 'new_noninvasive_specimen',
    label: '非侵入性新採檢體',
    description: '頭髮、指甲、排泄物、非套管唾液、口腔或皮膚細胞等。',
  },
  {
    value: 'remaining_specimen_original_consent',
    label: '剩餘檢體',
    description: '符合檢體提供者原先同意之使用範圍。',
  },
  {
    value: 'external_remaining_specimen_original_consent',
    label: '外單位剩餘檢體',
    description: '外單位剩餘檢體，且符合原先同意之使用範圍。',
  },
  {
    value: 'legal_biobank_unlinkable',
    label: '合法生物資料庫檢體',
    description: '合法人體生物資料庫取得，且去連結或無法辨識特定個人。',
  },
  {
    value: 'cdc_residual_non_original_with_clinical_report',
    label: '驗餘檢體非原疾病檢驗',
    description: '進行非原通報疾病檢驗，且需核發檢驗報告至臨床端。',
  },
  {
    value: 'other_specimen',
    label: '其他檢體使用',
    description: '不屬於以上類型的檢體採集或使用。',
  },
];

const VULNERABLE_OPTIONS: Array<{ value: ReviewVulnerablePopulation; label: string }> = [
  { value: 'minor', label: '未成年人' },
  { value: 'prisoner', label: '收容人' },
  { value: 'indigenous', label: '原住民' },
  { value: 'pregnant', label: '孕婦' },
  { value: 'disability', label: '身心障礙者' },
  { value: 'mental_illness', label: '精神病患' },
  { value: 'hiv_positive', label: 'HIV 陽性個案' },
  { value: 'tb_case', label: '結核病個案' },
  { value: 'new_immigrant_or_migrant', label: '新住民/移工' },
  { value: 'long_term_care_resident', label: '長照機構住民' },
  { value: 'other_vulnerable', label: '其他易受傷害族群' },
];

const IDENTIFIABILITY_OPTIONS: Array<{ value: ReviewDataIdentifiability; label: string; description: string }> = [
  {
    value: 'provider_deidentified_unidentifiable',
    label: '資料提供單位已去個資，研究者無法辨識個人',
    description: '例如資料提供單位處理後，研究團隊拿到的是無法辨識特定個人的資料。',
  },
  {
    value: 'coded_researcher_unidentifiable',
    label: '匿名編碼，研究執行時無法辨識個人',
    description: '仍可能由提供者或特定程序回連，不等於去連結。',
  },
  {
    value: 'identifiable_or_linkable',
    label: '仍可識別或可回連個人',
    description: '包含姓名、身分證字號、可回連代碼，或小群體中可合理推知個人。',
  },
  {
    value: 'public_or_legally_open',
    label: '合法公開且符合公開目的',
    description: '資料本身已合法公開週知，且使用方式符合其公開目的。',
  },
  {
    value: 'unknown',
    label: '尚未確認',
    description: '目前還不確定資料提供與去識別化方式。',
  },
];

function getReviewTagColor(reviewType: string | null) {
  if (reviewType === 'exempt') return 'green';
  if (reviewType === 'expedited') return 'blue';
  if (reviewType === 'full') return 'volcano';
  return 'default';
}

// 面板標題右側的「已選 N 項」小標籤；沒選時不顯示，避免畫面雜訊
function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <Tag color="blue" style={{ marginLeft: 8 }}>已選 {count} 項</Tag>;
}

function OptionGrid<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; description: string }>;
  value: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
      {options.map((option) => {
        const checked = value.includes(option.value);
        return (
          <div
            key={option.value}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              border: '1px solid #D9D4CC',
              borderRadius: 6,
              padding: 10,
              background: '#fff',
              minHeight: 86,
            }}
          >
            <Checkbox
              checked={checked}
              onChange={(event) => {
                const next = event.target.checked
                  ? Array.from(new Set([...value, option.value]))
                  : value.filter((item) => item !== option.value);
                onChange(next);
              }}
              style={{ alignItems: 'flex-start' }}
            >
              <span>
                <Text strong>{option.label}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>{option.description}</Text>
              </span>
            </Checkbox>
          </div>
        );
      })}
    </div>
  );
}

// 資料用途的子分組面板：三組都綁同一個 data_use_types 欄位。
// 因為 OptionGrid 收到的是「完整的 value 陣列」，每組只負責 toggle 自己那幾個 value，
// 所以三組各自獨立勾選不會互相蓋掉。
function DataUseGroup({
  options,
}: {
  options: Array<{ value: ReviewDataUseType; label: string; description: string }>;
}) {
  const { control } = useFormStore();
  return (
    <Controller
      name="review_screening.data_use_types"
      control={control}
      render={({ field }) => (
        <OptionGrid
          options={options}
          value={(field.value || []) as ReviewDataUseType[]}
          onChange={field.onChange}
        />
      )}
    />
  );
}

export default function ReviewTypeScreening() {
  const { control, setValue } = useFormStore();
  const screening = useWatch({ control, name: 'review_screening' });
  const reviewType = useWatch({ control, name: 'review_type' });
  const reviewTypeSource = useWatch({ control, name: 'review_type_source' });
  const decision = useMemo(() => classifyReviewType(screening), [screening]);
  const decisionPlan = decision.review_type ? getPlanConfig(decision.review_type) : null;
  const applied = Boolean(decision.review_type && decision.review_type === reviewType && reviewTypeSource === 'screening');

  const handleApplyDecision = useCallback(() => {
    if (!decision.review_type) return;
    setValue('review_type', decision.review_type, { shouldDirty: true });
    setValue('review_type_source', 'screening', { shouldDirty: true });

    if (decision.review_type === 'exempt') {
      // exempt_category 是「可複選」陣列；判斷器只給單一建議值，包成陣列帶入。
      const category: ExemptCategory = decision.suggested_exempt_category || 'minimal_risk';
      setValue('exempt_category', [category], { shouldDirty: true });
      setValue('exempt_reason', decision.reasons.join('；'), { shouldDirty: true });
    }
  }, [decision, setValue]);

  // 各面板「已選數量」——讓使用者收合著也知道自己在哪些題目選過東西。
  // 用 value 屬於哪一組來計數（避免把別組的選項算進來）。
  const dataUseTypes = (screening?.data_use_types || []) as ReviewDataUseType[];
  const existingCount = dataUseTypes.filter((v) => EXISTING_DATA_OPTIONS.some((o) => o.value === v)).length;
  const evaluationCount = dataUseTypes.filter((v) => EVALUATION_OPTIONS.some((o) => o.value === v)).length;
  const newDataCount = dataUseTypes.filter((v) => NEW_DATA_OPTIONS.some((o) => o.value === v)).length;
  const specimenCount = (screening?.specimen_use_types || []).length;
  // 是否已回答最低風險（true/false 都算已答；只有 null/undefined 才算沒答）
  const minimalRiskAnswered = screening?.is_minimal_risk !== null && screening?.is_minimal_risk !== undefined;
  // 「資料性質」面板：可識別性 + 最低風險兩題，各答一題算 1
  const dataNatureCount = (screening?.data_identifiability ? 1 : 0) + (minimalRiskAnswered ? 1 : 0);
  // 「研究對象與特殊風險」面板：族群數 + 幾個風險勾選（可識別性/最低風險已移到「資料性質」面板）
  const riskCount =
    (screening?.vulnerable_populations || []).length +
    [
      screening?.has_direct_subject_contact,
      screening?.has_high_risk_procedure,
      screening?.has_discrimination_risk,
      screening?.recording_is_identifiable_or_sensitive,
      screening?.has_other_irb_approval,
    ].filter(Boolean).length;
  // 這兩個條件一命中就「直接」判一般審查（不是只調高一級），值得即時跳警示提醒使用者
  const raisesToFull = Boolean(screening?.has_high_risk_procedure || screening?.has_discrimination_risk);
  // 引導提示：已選研究素材，但「資料性質」兩個關鍵題還沒答完。
  // 漏填會讓 classifier 從嚴（例如去個資資料庫研究被誤判成一般審查），所以要明確提醒補填。
  const hasMaterial = dataUseTypes.length > 0 || specimenCount > 0;
  const dataNatureIncomplete = hasMaterial && (!screening?.data_identifiability || !minimalRiskAnswered);

  // 六個「白話問句」面板。其中「資料性質」是判斷關鍵，預設展開（見下方 defaultActiveKey）；
  // 其餘預設收合，使用者只展開跟自己研究有關的那一兩個即可。
  const panels = [
    {
      key: 'existing',
      label: (
        <span>
          我分析<strong>既有資料 / 資料庫</strong>（拿現成的資料來研究）
          <CountBadge count={existingCount} />
        </span>
      ),
      children: <DataUseGroup options={EXISTING_DATA_OPTIONS} />,
    },
    {
      key: 'evaluation',
      label: (
        <span>
          我做<strong>政策評估 / 教育評量 / 公開觀察</strong>
          <CountBadge count={evaluationCount} />
        </span>
      ),
      children: <DataUseGroup options={EVALUATION_OPTIONS} />,
    },
    {
      key: 'new_data',
      label: (
        <span>
          我<strong>收集新資料</strong>（問卷、訪視、量測、錄音錄影等）
          <CountBadge count={newDataCount} />
        </span>
      ),
      children: <DataUseGroup options={NEW_DATA_OPTIONS} />,
    },
    {
      key: 'specimen',
      label: (
        <span>
          我使用<strong>檢體 / 菌株</strong>
          <CountBadge count={specimenCount} />
        </span>
      ),
      children: (
        <Controller
          name="review_screening.specimen_use_types"
          control={control}
          render={({ field }) => (
            <OptionGrid
              options={SPECIMEN_USE_OPTIONS}
              value={(field.value || []) as ReviewSpecimenUseType[]}
              onChange={field.onChange}
            />
          )}
        />
      ),
    },
    {
      // 「資料性質」面板：把判斷免審與否的兩個關鍵題（可識別性、最低風險）獨立出來，
      // 不再埋在「有才填」的風險面板裡，避免使用者漏填導致從嚴誤判。
      key: 'data_nature',
      label: (
        <span>
          <WarningOutlined style={{ color: '#d4811f', marginRight: 6 }} />
          <strong>資料性質</strong>（可識別性、是否最低風險）
          <Tag color="orange" style={{ marginLeft: 6 }}>建議填寫</Tag>
          <CountBadge count={dataNatureCount} />
        </span>
      ),
      children: (
        <div style={{ display: 'grid', gap: 18 }}>
          {/* 引導：這兩題是判斷免審與否的關鍵，漏填會被從嚴判成一般審查 */}
          <Text type="secondary" style={{ fontSize: 13 }}>
            這兩題是判斷能否「免審」的關鍵——尤其去個資資料庫研究，沒回答可識別性會被從嚴判為一般審查，建議務必填寫。
          </Text>

          <div>
            <Text strong>資料可識別性</Text>
            <Controller
              name="review_screening.data_identifiability"
              control={control}
              render={({ field }) => (
                <Radio.Group
                  value={field.value || ''}
                  onChange={(event) => field.onChange(event.target.value as ReviewDataIdentifiability)}
                  style={{ display: 'grid', gap: 8, marginTop: 8 }}
                >
                  {IDENTIFIABILITY_OPTIONS.map((option) => (
                    <Radio key={option.value} value={option.value}>
                      <Text>{option.label}</Text>
                      <br />
                      <Text type="secondary" style={{ fontSize: 12 }}>{option.description}</Text>
                    </Radio>
                  ))}
                </Radio.Group>
              )}
            />
          </div>

          <div>
            <Text strong>是否屬最低風險</Text>
            <Controller
              name="review_screening.is_minimal_risk"
              control={control}
              render={({ field }) => (
                <Radio.Group
                  value={field.value === true ? 'yes' : field.value === false ? 'no' : 'unknown'}
                  onChange={(event) => {
                    const value = event.target.value;
                    field.onChange(value === 'yes' ? true : value === 'no' ? false : null);
                  }}
                  style={{ display: 'grid', gap: 6, marginTop: 8 }}
                >
                  <Radio value="yes">是，風險不高於日常生活</Radio>
                  <Radio value="no">否，風險高於最低風險</Radio>
                  <Radio value="unknown">尚未確認</Radio>
                </Radio.Group>
              )}
            />
          </div>
        </div>
      ),
    },
    {
      key: 'subjects',
      label: (
        <span>
          <strong>研究對象與特殊風險</strong>（敏感族群、特殊風險條件）
          <Text type="warning" style={{ fontSize: 12, marginLeft: 6 }}>可能提高審查層級</Text>
          <CountBadge count={riskCount} />
        </span>
      ),
      children: (
        <div style={{ display: 'grid', gap: 18 }}>
          {/* 常駐說明：讓使用者理解這一區是「從嚴」條件，勾選會把層級往上調 */}
          <Text type="secondary" style={{ fontSize: 13 }}>
            這一區屬於「從嚴」條件——勾選下列項目可能把審查層級往上調（例如免審 → 簡審）。
          </Text>

          {/* 即時警示：命中這兩項會「直接」判一般審查，醒目提醒 */}
          {raisesToFull && (
            <Alert
              type="warning"
              showIcon
              message="勾選「高風險、人體試驗或安全性監測」或「可能造成歧視」會直接判為一般審查。"
            />
          )}

          <div>
            <Text strong>研究對象或資料是否包含下列族群</Text>
            <Controller
              name="review_screening.vulnerable_populations"
              control={control}
              render={({ field }) => (
                <Checkbox.Group
                  value={field.value || []}
                  onChange={(vals) => field.onChange(vals as ReviewVulnerablePopulation[])}
                  style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 14px', marginTop: 8 }}
                >
                  {VULNERABLE_OPTIONS.map((option) => (
                    <Checkbox key={option.value} value={option.value}>{option.label}</Checkbox>
                  ))}
                </Checkbox.Group>
              )}
            />
          </div>

          <div>
            <Text strong>特殊風險條件</Text>
            <Space direction="vertical" size={8} style={{ marginTop: 8 }}>
                <Controller
                  name="review_screening.has_direct_subject_contact"
                  control={control}
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)}>
                      會直接接觸研究對象或個案
                    </Checkbox>
                  )}
                />
                <Controller
                  name="review_screening.has_high_risk_procedure"
                  control={control}
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)}>
                      涉及高風險、人體試驗或安全性監測需求
                    </Checkbox>
                  )}
                />
                <Controller
                  name="review_screening.has_discrimination_risk"
                  control={control}
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)}>
                      可能造成個人或族群歧視
                    </Checkbox>
                  )}
                />
                <Controller
                  name="review_screening.recording_is_identifiable_or_sensitive"
                  control={control}
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)}>
                      錄音、錄影或影像資料可能識別個人或影響工作、保險、財務、社會關係
                    </Checkbox>
                  )}
                />
                <Controller
                  name="review_screening.has_other_irb_approval"
                  control={control}
                  render={({ field }) => (
                    <Checkbox checked={field.value} onChange={(event) => field.onChange(event.target.checked)}>
                      多中心研究已取得其他合法審查會同意證明
                    </Checkbox>
                  )}
                />
              </Space>
          </div>
        </div>
      ),
    },
  ];

  return (
    <section
      style={{
        border: '1px solid #D9D4CC',
        borderRadius: 8,
        background: '#FAF8F3',
        padding: 16,
        marginBottom: 24,
      }}
    >
      <Space align="center" style={{ marginBottom: 4 }}>
        <InfoCircleOutlined style={{ color: '#2C6FBF' }} />
        <Title level={4} style={{ margin: 0 }}>審查類型小幫手</Title>
        {/* 即使面板都收合，這裡也會即時顯示目前的系統建議 */}
        {decision.review_type && (
          <Tag color={getReviewTagColor(decision.review_type)}>
            建議：{REVIEW_TYPE_LABELS[decision.review_type]}
          </Tag>
        )}
      </Space>
      <div style={{ marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          不確定上面要選哪一種審查？展開下面跟你研究有關的問題逐項勾選，系統會幫你建議審查類型。
        </Text>
      </div>

      {/* 問句面板：「資料性質」是判斷關鍵，預設展開；其餘預設收合，使用者只展開相關的那一兩個 */}
      <Collapse items={panels} defaultActiveKey={['data_nature']} bordered={false} style={{ background: 'transparent' }} />

      <Divider />

      <div style={{ display: 'grid', gap: 12 }}>
        <Space wrap>
          <Text strong>系統建議：</Text>
          {decision.review_type ? (
            <Tag color={getReviewTagColor(decision.review_type)}>{REVIEW_TYPE_LABELS[decision.review_type]}</Tag>
          ) : (
            <Tag color="default">尚未完成判斷</Tag>
          )}
          {decision.confidence === 'clear' && <Tag color="green" icon={<CheckCircleOutlined />}>規則明確</Tag>}
          {decision.confidence === 'needs_review' && <Tag color="orange" icon={<WarningOutlined />}>需人工確認</Tag>}
          {decision.confidence === 'incomplete' && <Tag color="default">資料不足</Tag>}
          {applied && <Tag color="processing">已套用</Tag>}
        </Space>

        {/* 引導：已選素材但「資料性質」沒答完 → 提醒補填，否則會被從嚴判成一般審查 */}
        {dataNatureIncomplete && (
          <Alert
            type="info"
            showIcon
            message="請到上方「資料性質」面板補填可識別性與是否最低風險"
            description="你已選擇研究素材，但這兩個關鍵題尚未填完。補填後系統才能正確判斷是否符合免審，否則會從嚴判為一般審查。"
          />
        )}

        {decisionPlan && !decisionPlan.ready && (
          <Alert
            type="warning"
            showIcon
            message={`${decisionPlan.label}文件模板尚未完整支援`}
            description="目前可先協助判斷審查類型；後續文件產生仍需確認模板是否已備妥。"
          />
        )}

        {decision.reasons.length > 0 && (
          <Alert
            type={decision.confidence === 'needs_review' ? 'warning' : 'info'}
            showIcon
            message="判斷理由"
            description={(
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {decision.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            )}
          />
        )}

        {/* 「命中規則」（法規依據）已從畫面移除：對填表的研究者太生硬，主要看「判斷理由」即可。
            classifier 內部仍保留 matched_rules（型別與 snapshot 不動），日後若要做「查看法規依據」
            的展開區，資料現成可用。 */}

        {decision.warnings.length > 0 && (
          <Alert
            type="warning"
            showIcon
            message="注意事項"
            description={(
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {decision.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            )}
          />
        )}

        <div>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            disabled={!decision.review_type}
            onClick={handleApplyDecision}
          >
            套用建議審查類型
          </Button>
        </div>
      </div>
    </section>
  );
}
