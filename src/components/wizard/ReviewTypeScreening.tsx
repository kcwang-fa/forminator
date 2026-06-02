import { useMemo, useCallback } from 'react';
import { Alert, Button, Checkbox, Divider, Radio, Space, Tag, Typography } from 'antd';
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

const DATA_USE_OPTIONS: Array<{ value: ReviewDataUseType; label: string; description: string }> = [
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
    value: 'other_existing_data',
    label: '其他既有資料',
    description: '不屬於以上類型的既有資料。',
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
      const category: ExemptCategory = decision.suggested_exempt_category || 'minimal_risk';
      setValue('exempt_category', category, { shouldDirty: true });
      setValue('exempt_reason', decision.reasons.join('；'), { shouldDirty: true });
    }
  }, [decision, setValue]);

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
      <Space align="center" style={{ marginBottom: 8 }}>
        <InfoCircleOutlined style={{ color: '#2C6FBF' }} />
        <Title level={4} style={{ margin: 0 }}>審查類型判斷</Title>
      </Space>

      <div style={{ display: 'grid', gap: 18 }}>
        <div>
          <Text strong>使用資料或研究方法</Text>
          <Controller
            name="review_screening.data_use_types"
            control={control}
            render={({ field }) => (
              <div style={{ marginTop: 8 }}>
                <OptionGrid
                  options={DATA_USE_OPTIONS}
                  value={(field.value || []) as ReviewDataUseType[]}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
        </div>

        <div>
          <Text strong>使用檢體或菌株</Text>
          <Controller
            name="review_screening.specimen_use_types"
            control={control}
            render={({ field }) => (
              <div style={{ marginTop: 8 }}>
                <OptionGrid
                  options={SPECIMEN_USE_OPTIONS}
                  value={(field.value || []) as ReviewSpecimenUseType[]}
                  onChange={field.onChange}
                />
              </div>
            )}
          />
        </div>

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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
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
      </div>

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

        {decision.matched_rules.length > 0 && (
          <div style={{ fontSize: 13 }}>
            <Text strong>命中規則</Text>
            <ul style={{ margin: '6px 0 0', paddingLeft: 20 }}>
              {decision.matched_rules.map((rule) => (
                <li key={rule}><Text type="secondary">{rule}</Text></li>
              ))}
            </ul>
          </div>
        )}

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
